-- A price is true for a while (docs/mvp/price-expiry.md). A claim fact can say until when it holds; a price or an offer
-- always does: the brand says the date, or it holds for 14 days from when it was stated. After that date:
--   - the plan writer is not given the fact, and a plan cannot rely on it,
--   - a creative whose planned words rely on it cannot be checked, sent, approved or delivered; the message says which
--     price ran out and when, so the brand states this week's price or the words are laid again without it.
-- The brand's owner or approver sets a new date; Fume's people may only bring it closer.

alter table public.product_facts add column valid_until timestamptz;
comment on column public.product_facts.valid_until is
  'Until when the fact holds (a price, an offer). Null: it does not run out. After it, nothing new relies on it.';

-- Whether a statement names a price or an offer: a figure with a currency or ",-", or a share off with a sale word
-- ("100% recycled paper" is no offer).
create or replace function app.is_price(p_statement text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(p_statement, '') ~* '([0-9][0-9 .]*\s*(,-|kr\M|nok\M|sek\M|dkk\M|eur\M|usd\M|gbp\M|€|\$|£))|((€|\$|£|kr\.?)\s*[0-9])'
    or (coalesce(p_statement, '') ~ '[0-9]\s*%'
        and coalesce(p_statement, '') ~* '(rabatt|avslag|spar|tilbud|salg|\moff\M|save|sale|discount|-\s*[0-9]+\s*%)')
$$;

create or replace function app.fact_live(p_until timestamptz) returns boolean
language sql stable set search_path = '' as $$
  select p_until is null or p_until > now()
$$;

-- A price stated before today holds 14 days from when it was stated.
update public.product_facts set valid_until = created_at + interval '14 days'
where area = 'claim' and valid_until is null and superseded_by is null and app.is_price(statement);

-- The brand's people state a fact; a price holds until p_valid_until, or 14 days.
drop function if exists public.add_product_fact(uuid, text, text, text, text);
create or replace function public.add_product_fact(
  p_product_id uuid, p_area text, p_label text, p_statement text, p_key text default null, p_valid_until timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('product_id', p_product_id, 'area', p_area, 'label', p_label, 'statement', p_statement,
                                  'valid_until', p_valid_until);
  prior jsonb;
  p public.products;
  nf public.product_facts;
  brand boolean;
  until timestamptz := p_valid_until;
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'add_product_fact', req);
  if prior is not null then return prior; end if;

  select * into p from public.products where id = p_product_id;
  if not found or not app.can_read(p.workspace_id) then
    perform app.fail('not_found', 'No such product.');
  end if;
  brand := app.customer_is(p.workspace_id, array['owner', 'approver']) or app.is_admin();
  if not (brand or app.customer_is(p.workspace_id, array['member']) or app.is_staff(p.workspace_id)) then
    perform app.fail('forbidden', 'Viewers cannot add product facts.');
  end if;
  if p_area not in ('shape', 'colour', 'material', 'label', 'packaging', 'claim', 'never') then
    perform app.fail('invalid', 'Unknown area.');
  end if;
  if coalesce(trim(p_label), '') = '' or coalesce(trim(p_statement), '') = '' or length(p_statement) > 500 or length(p_label) > 80 then
    perform app.fail('invalid', 'Write the fact in one short line, with a label.');
  end if;
  if until is not null and until <= now() then perform app.fail('invalid', 'The date it holds until has passed.'); end if;
  if until is null and p_area = 'claim' and app.is_price(p_statement) then until := now() + interval '14 days'; end if;
  insert into public.product_facts (workspace_id, product_id, area, label, statement, origin, status, verified_by, verified_at,
    created_by, valid_until)
  values (p.workspace_id, p.id, p_area, trim(p_label), trim(p_statement), 'supplied',
    case when brand then 'verified' else 'unverified' end,
    case when brand then auth.uid() end, case when brand then now() end, auth.uid(), until)
  returning * into nf;
  perform app.record(p.workspace_id, 'fact.added', 'product_fact', nf.id,
    jsonb_build_object('label', nf.label, 'verified', brand, 'valid_until', nf.valid_until));
  return app.idem_end(p_key, 'add_product_fact', req, to_jsonb(nf));
end $$;
revoke execute on function public.add_product_fact(uuid, text, text, text, text, timestamptz) from public, anon;
grant execute on function public.add_product_fact(uuid, text, text, text, text, timestamptz) to authenticated;

-- A new date for a fact: the brand's owner or approver sets any date; Fume's people only an earlier one. Null: it no
-- longer runs out (the brand only, and never for a price).
create or replace function public.set_fact_until(p_fact_id uuid, p_until timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  f public.product_facts;
  brand boolean;
begin
  perform app.require_user();
  select * into f from public.product_facts where id = p_fact_id for update;
  if not found or not app.can_read(f.workspace_id) then perform app.fail('not_found', 'No such fact.'); end if;
  if f.superseded_by is not null then perform app.fail('conflict', 'A newer fact replaced this one.'); end if;
  brand := app.customer_is(f.workspace_id, array['owner', 'approver']) or app.is_admin();
  if not brand and not app.is_staff(f.workspace_id) then
    perform app.fail('forbidden', 'The brand says until when its prices hold.');
  end if;
  if p_until is null and app.is_price(f.statement) then perform app.fail('invalid', 'A price always holds until a date.'); end if;
  if not brand and (p_until is null or (f.valid_until is not null and p_until > f.valid_until)) then
    perform app.fail('forbidden', 'Only the brand makes a price hold longer.');
  end if;
  update public.product_facts set valid_until = p_until where id = f.id returning * into f;
  perform app.record(f.workspace_id, 'fact.until', 'product_fact', f.id, jsonb_build_object('label', f.label, 'valid_until', p_until));
  return to_jsonb(f);
end $$;
revoke execute on function public.set_fact_until(uuid, timestamptz) from public, anon;
grant execute on function public.set_fact_until(uuid, timestamptz) to authenticated;

-- The facts a creative's words rely on that have run out: its planned creative's claims in the campaign's approved
-- plan, and for a format or variant its master's too (it carries the master's words), as "label (statement), ran out
-- on date".
create or replace function app.expired_claims(p_creative_id uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  with cr as (
    select c.campaign_id, array_remove(array[c.slot, m.slot], null) as slots
    from public.creatives c left join public.creatives m on m.id = c.master_id
    where c.id = p_creative_id
  ), plan as (
    select pv.body from public.plan_versions pv join cr on cr.campaign_id = pv.campaign_id
    where pv.state = 'approved' order by pv.version desc limit 1
  ), refs as (
    select distinct r.ref from plan, cr,
      jsonb_array_elements(case when jsonb_typeof(plan.body -> 'planned_creatives') = 'array' then plan.body -> 'planned_creatives' else '[]' end) pc,
      jsonb_array_elements_text(case when jsonb_typeof(pc -> 'claimRefs') = 'array' then pc -> 'claimRefs' else '[]' end) r(ref)
    where pc ->> 'id' = any (cr.slots) and r.ref ~ '^[0-9a-f-]{36}$'
  )
  select coalesce(array_agg(f.label || ' (' || left(f.statement, 80) || '), ran out on ' || to_char(f.valid_until at time zone 'Europe/Oslo', 'DD.MM.YYYY')
    order by f.label), '{}')
  from refs join public.product_facts f on f.id = refs.ref::uuid
  where not app.fact_live(f.valid_until)
$$;
revoke execute on function app.expired_claims(uuid) from public, anon;

-- Nothing that relies on a price that ran out is checked, sent, approved or delivered, whichever way it is asked.
create or replace function app.version_claims_live() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  gone text[];
begin
  if not ((new.state in ('checked', 'approved', 'delivered') and new.state is distinct from old.state)
          or (new.sent_at is not null and old.sent_at is null)) then
    return new;
  end if;
  gone := app.expired_claims(new.creative_id);
  if cardinality(gone) > 0 then
    perform app.fail('invalid', 'A price on this creative has run out: ' || array_to_string(gone, '; ')
      || '. The brand states the new price and its date, or the words are laid again without it.');
  end if;
  return new;
end $$;
create trigger creative_versions_claims_live before update on public.creative_versions
  for each row execute function app.version_claims_live();

-- The plan writer is given only facts that still hold.
create or replace function public.fume_take_plan(p_campaign_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.plan_versions;
  b public.brief_versions;
  w public.workspaces;
  before public.plan_versions;
  asked text;
  tries int;
  run public.task_runs;
  input jsonb;
begin
  select * into p from public.plan_versions where campaign_id = p_campaign_id order by version desc limit 1 for update;
  if not found or p.state <> 'writing' then return null; end if;
  if exists (select 1 from public.task_runs where subject_id = p.id and state = 'running' and started_at > now() - interval '4 minutes') then
    return null;
  end if;
  update public.task_runs set state = 'failed', error = 'Timed out', finished_at = now()
  where subject_id = p.id and state = 'running';
  select count(*) into tries from public.task_runs where subject_id = p.id;
  if tries >= 2 then
    perform app.fume_plan_fallback(p, 'The model did not write the plan; the plan from the brief stands.');
    return null;
  end if;

  select * into b from public.brief_versions where id = p.brief_version_id;
  select * into w from public.workspaces where id = p.workspace_id;
  select * into before from public.plan_versions
  where campaign_id = p.campaign_id and version = p.version - 1 and brief_version_id = p.brief_version_id;
  if found then
    select detail ->> 'note' into asked from public.record_events
    where subject_id = before.id and action = 'plan.changes_asked' order by at desc limit 1;
  end if;

  input := jsonb_build_object(
    'plan_id', p.id, 'version', p.version, 'campaign_id', p.campaign_id,
    'brand', jsonb_build_object('name', w.brand_name, 'market', w.market, 'language', w.language),
    'campaign', (select jsonb_build_object('name', c.name, 'due_at', c.due_at) from public.campaigns c where c.id = p.campaign_id),
    'brief', b.body,
    'products', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', pr.id, 'name', pr.name, 'variant', pr.variant,
        'facts', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', f.id, 'area', f.area, 'label', f.label, 'statement', f.statement, 'status', f.status, 'required', f.required,
            'valid_until', f.valid_until
          ) order by f.area, f.label), '[]')
          from public.product_facts f where f.product_id = pr.id and f.superseded_by is null and app.fact_live(f.valid_until)
        )
      ) order by pr.name), '[]')
      from public.campaign_products cp join public.products pr on pr.id = cp.product_id
      where cp.campaign_id = p.campaign_id
    ),
    'rules', p.body -> 'rules',
    'change', case when asked is not null then jsonb_build_object('asked', asked, 'plan', before.body) end
  );
  insert into public.task_runs (workspace_id, campaign_id, kind, subject_id, attempt, input)
  values (p.workspace_id, p.campaign_id, 'plan', p.id, tries + 1, input)
  returning * into run;
  return input || jsonb_build_object('run_id', run.id, 'attempt', run.attempt);
end $$;

-- A plan relies only on claims that still hold.
create or replace function public.fume_finish_plan(p_run_id uuid, p_body jsonb, p_changes text[], p_usage jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  run public.task_runs;
  p public.plan_versions;
  d jsonb;
  pc jsonb;
  ids text[];
  masters text[];
  products uuid[];
  claims uuid[];
  problems text[] := '{}';
  new_body jsonb;
  chosen jsonb;
begin
  select * into run from public.task_runs where id = p_run_id for update;
  if not found then perform app.fail('not_found', 'No such run.'); end if;
  select * into p from public.plan_versions where id = run.subject_id for update;
  if run.state <> 'running' or p.state <> 'writing' then
    perform app.fail('conflict', 'This plan is no longer being written.');
  end if;

  select coalesce(array_agg(product_id), '{}') into products from public.campaign_products where campaign_id = p.campaign_id;
  select coalesce(array_agg(f.id), '{}') into claims from public.product_facts f
  where f.product_id = any (products) and f.area = 'claim' and f.status = 'verified' and f.superseded_by is null
    and app.fact_live(f.valid_until);

  if jsonb_typeof(p_body) is distinct from 'object' or jsonb_typeof(p_body -> 'directions') is distinct from 'array'
     or jsonb_array_length(p_body -> 'directions') not between 1 and 3 then
    problems := problems || 'The plan needs one to three directions.'::text;
  else
    select array_agg(x ->> 'id') into ids from jsonb_array_elements(p_body -> 'directions') x;
    if cardinality(ids) <> (select count(distinct i) from unnest(ids) i) or array_position(ids, null) is not null then
      problems := problems || 'Each direction needs its own id.'::text;
    end if;
    select x into chosen from jsonb_array_elements(p_body -> 'directions') x where x ->> 'id' = p_body ->> 'chosen_direction_id';
    if chosen is null then problems := problems || 'The chosen direction is not one of the directions.'::text; end if;
    for d in select * from jsonb_array_elements(p_body -> 'directions') loop
      if coalesce(trim(d ->> 'name'), '') = '' or coalesce(trim(d ->> 'idea'), '') = '' then
        problems := problems || format('Direction %s needs a name and an idea.', d ->> 'id');
      end if;
      if jsonb_typeof(d -> 'creatives') is distinct from 'array' or jsonb_array_length(d -> 'creatives') not between 1 and 12 then
        problems := problems || format('Direction %s needs one to twelve planned creatives.', d ->> 'id');
        continue;
      end if;
      select coalesce(array_agg(x ->> 'id') filter (where x ->> 'kind' = 'master'), '{}') into masters
      from jsonb_array_elements(d -> 'creatives') x;
      for pc in select * from jsonb_array_elements(d -> 'creatives') loop
        if coalesce(pc ->> 'format', '') not in ('feed', 'square', 'story') then
          problems := problems || format('%s: the format must be feed, square or story.', pc ->> 'name');
        end if;
        if coalesce(pc ->> 'kind', '') not in ('master', 'variant') then
          problems := problems || format('%s: a planned creative is a master or a variant.', pc ->> 'name');
        elsif pc ->> 'kind' = 'variant' and not (pc ->> 'of' = any (masters)) then
          problems := problems || format('%s: a variant names a master of its direction.', pc ->> 'name');
        end if;
        if jsonb_typeof(pc -> 'productIds') is distinct from 'array' or jsonb_array_length(pc -> 'productIds') = 0
           or exists (select 1 from jsonb_array_elements_text(pc -> 'productIds') i where not (i::uuid = any (products))) then
          problems := problems || format('%s: name the campaign''s products only.', pc ->> 'name');
        end if;
        if exists (
          select 1 from jsonb_array_elements_text(case when jsonb_typeof(pc -> 'claimRefs') = 'array' then pc -> 'claimRefs' else '[]' end) i
          where not (i::uuid = any (claims))
        ) then
          problems := problems || format('%s: a claim that is not a verified claim of the product.', pc ->> 'name');
        end if;
      end loop;
    end loop;
  end if;

  if cardinality(problems) > 0 then
    perform app.fail('invalid', array_to_string(problems, ' '));
  end if;

  new_body := p_body || jsonb_build_object(
    'rules', coalesce(p.body -> 'rules', '[]'),
    'planned_creatives', chosen -> 'creatives',
    'timeline', coalesce(p_body -> 'timeline', p.body -> 'timeline', '[]')
  );
  update public.plan_versions set body = new_body, state = 'ready',
    changes = coalesce(array_remove(p_changes, ''), '{}')
  where id = p.id returning * into p;
  update public.task_runs set state = 'succeeded', output = p_body, finished_at = now(),
    model = p_usage ->> 'model',
    input_tokens = coalesce((p_usage ->> 'input_tokens')::int, 0),
    output_tokens = coalesce((p_usage ->> 'output_tokens')::int, 0),
    cost_usd = coalesce((p_usage ->> 'cost_usd')::numeric, 0)
  where id = run.id;
  perform app.record(p.workspace_id, case when p.version > 1 and cardinality(p.changes) > 0 then 'plan.changed' else 'plan.written' end,
    'plan_version', p.id, jsonb_build_object('version', p.version, 'by', 'fume', 'changes', to_jsonb(p.changes), 'campaign_id', p.campaign_id));
  return to_jsonb(p);
end $$;
