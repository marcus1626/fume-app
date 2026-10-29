-- The brief while she writes it, and Fume's first plan the moment she sends it (docs/mvp/domain-model.md §3).
-- The brief's lines use the contract's names (app/src/contract/entities/campaigns.ts Brief): objective, audience,
-- offer, message, mandatory, never, channels, formats, creatives, references, market, language, due_at.
-- Until the LLM writes plans (Wednesday), the first plan is built from the brief itself: one direction, a master in
-- the first format and one format version per other format. The LLM's plan comes as the next version.

alter table public.campaigns add column if not exists brief_draft jsonb not null default '{}';

-- The draft brief, line by line: what she changed is merged into what is there. It is hers until she sends it.
create or replace function public.save_brief_draft(p_campaign_id uuid, p_change jsonb, p_key text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('campaign_id', p_campaign_id, 'change', p_change);
  prior jsonb;
  c public.campaigns;
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'save_brief_draft', req);
  if prior is not null then return prior; end if;

  select * into c from public.campaigns where id = p_campaign_id for update;
  if not found or not app.can_read(c.workspace_id) then
    perform app.fail('not_found', 'No such campaign.');
  end if;
  if not app.customer_is(c.workspace_id, array['owner', 'approver', 'member']) and not app.is_staff(c.workspace_id, array['account_manager']) then
    perform app.fail('forbidden', 'Viewers cannot change the brief.');
  end if;
  if exists (select 1 from public.plan_versions where campaign_id = c.id and state = 'approved') then
    perform app.fail('conflict', 'The plan is approved. Change the work through the plan or a change request.');
  end if;
  if jsonb_typeof(p_change) <> 'object' then
    perform app.fail('invalid', 'A brief change is a set of lines.');
  end if;

  update public.campaigns set brief_draft = brief_draft || p_change,
    due_at = case when p_change ? 'due_at' then nullif(p_change ->> 'due_at', '')::timestamptz else due_at end
  where id = c.id returning * into c;
  return app.idem_end(p_key, 'save_brief_draft', req, to_jsonb(c));
end $$;

-- Fume's first plan, from the brief as sent.
create or replace function app.first_plan(p_brief public.brief_versions) returns public.plan_versions
language plpgsql security definer set search_path = '' as $$
declare
  body jsonb := p_brief.body;
  formats jsonb := case when jsonb_typeof(body -> 'formats') = 'array' then body -> 'formats' else '["feed"]' end;
  products jsonb;
  planned jsonb := '[]';
  rules jsonb := '[]';
  f text;
  n int := 0;
  p public.plan_versions;
begin
  select coalesce(jsonb_agg(cp.product_id order by pr.name), '[]') into products
  from public.campaign_products cp join public.products pr on pr.id = cp.product_id
  where cp.campaign_id = p_brief.campaign_id;

  for f in select jsonb_array_elements_text(formats) loop
    n := n + 1;
    planned := planned || jsonb_build_array(jsonb_build_object(
      'id', 'pc' || n,
      'name', case when n = 1 then 'Master 1' else initcap(f) || ' from Master 1' end,
      'kind', case when n = 1 then 'master' else 'variant' end,
      'of', case when n = 1 then null else 'pc1' end,
      'format', f,
      'productIds', products,
      'scene', coalesce(body ->> 'message', ''),
      'people', 'No people'
    ));
  end loop;

  select coalesce(jsonb_agg(x), '[]') into rules from (
    select jsonb_build_object('text', m, 'kind', 'must', 'source', 'brief') as x
    from jsonb_array_elements_text(case when jsonb_typeof(body -> 'mandatory') = 'array' then body -> 'mandatory' else '[]' end) m
    union all
    select jsonb_build_object('text', m, 'kind', 'never', 'source', 'brief')
    from jsonb_array_elements_text(case when jsonb_typeof(body -> 'never') = 'array' then body -> 'never' else '[]' end) m
    union all
    select jsonb_build_object('text', r.statement, 'kind', case when r.kind = 'hard_constraint' then 'never' else 'must' end,
      'source', 'brand_dna', 'ruleId', r.id)
    from public.brand_rules r
    join public.brand_dna_versions d on d.id = r.brand_dna_version_id and d.state = 'approved'
    where r.workspace_id = p_brief.workspace_id
  ) rules_rows;

  update public.plan_versions set state = 'superseded' where campaign_id = p_brief.campaign_id and state <> 'superseded';
  insert into public.plan_versions (
    workspace_id, campaign_id, version, brief_version_id, brand_dna_version_id, body, state, written_by
  ) values (
    p_brief.workspace_id, p_brief.campaign_id,
    coalesce((select max(version) from public.plan_versions where campaign_id = p_brief.campaign_id), 0) + 1,
    p_brief.id,
    (select id from public.brand_dna_versions d where d.workspace_id = p_brief.workspace_id and d.state = 'approved'
     order by version desc limit 1),
    jsonb_build_object(
      'summary', concat_ws(' ', nullif(body ->> 'objective', '') || '.', 'For ' || nullif(body ->> 'audience', '') || '.',
        nullif(body ->> 'message', '')),
      'directions', jsonb_build_array(jsonb_build_object(
        'id', 'a', 'letter', 'A', 'name', 'From your brief', 'idea', coalesce(body ->> 'message', ''),
        'hook', coalesce(body ->> 'message', ''), 'why', '[]'::jsonb, 'references', '[]'::jsonb, 'look', '[]'::jsonb,
        'creatives', planned, 'recommended', true
      )),
      'chosen_direction_id', 'a',
      'planned_creatives', planned,
      'content', '[]'::jsonb,
      'rules', rules,
      'timeline', '[]'::jsonb
    ),
    'ready', 'fume'
  ) returning * into p;
  perform app.record(p.workspace_id, 'plan.written', 'plan_version', p.id, jsonb_build_object('version', p.version, 'by', 'fume'));
  return p;
end $$;

-- She sends the brief: the draft (or the lines given) becomes a new brief version, and Fume writes the plan from it.
create or replace function public.send_brief(p_campaign_id uuid, p_body jsonb default null, p_key text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('campaign_id', p_campaign_id, 'body', p_body);
  prior jsonb;
  c public.campaigns;
  b public.brief_versions;
  body jsonb;
  missing text[] := '{}';
  field text;
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'send_brief', req);
  if prior is not null then return prior; end if;

  select * into c from public.campaigns where id = p_campaign_id for update;
  if not found or not app.can_read(c.workspace_id) then
    perform app.fail('not_found', 'No such campaign.');
  end if;
  if not app.customer_is(c.workspace_id, array['owner', 'approver', 'member']) and not app.is_staff(c.workspace_id, array['account_manager']) then
    perform app.fail('forbidden', 'Viewers cannot send a brief.');
  end if;
  if exists (select 1 from public.plan_versions where campaign_id = c.id and state = 'approved') then
    perform app.fail('conflict', 'The plan is approved. Change the work through the plan or a change request.');
  end if;
  body := c.brief_draft || coalesce(p_body, '{}');
  if body ? 'count' and not body ? 'creatives' then
    body := body || jsonb_build_object('creatives', body -> 'count');
  end if;
  foreach field in array array['objective', 'audience', 'message'] loop
    if coalesce(trim(body ->> field), '') = '' then
      missing := missing || field;
    end if;
  end loop;
  if coalesce(case when jsonb_typeof(body -> 'formats') = 'array' then jsonb_array_length(body -> 'formats') end,
              length(coalesce(body ->> 'formats', ''))) = 0 then
    missing := missing || 'formats'::text;
  end if;
  if coalesce(body ->> 'creatives', '') !~ '^[1-9][0-9]*$' then
    missing := missing || 'creatives'::text;
  end if;
  if cardinality(missing) > 0 then
    perform app.fail('invalid', 'The brief is missing: ' || array_to_string(missing, ', ') || '.');
  end if;
  if jsonb_typeof(body -> 'formats') = 'string' then
    body := body || jsonb_build_object('formats',
      (select jsonb_agg(trim(x)) from unnest(string_to_array(body ->> 'formats', ',')) x));
  end if;

  insert into public.brief_versions (workspace_id, campaign_id, version, body, sent_by)
  values (
    c.workspace_id, c.id,
    coalesce((select max(version) from public.brief_versions where campaign_id = c.id), 0) + 1,
    body, auth.uid()
  ) returning * into b;
  update public.campaigns set stage = 'plan', state = 'scoped', brief_draft = body where id = c.id;
  perform app.record(c.workspace_id, 'brief.sent', 'brief_version', b.id, jsonb_build_object('version', b.version));
  perform app.first_plan(b);
  return app.idem_end(p_key, 'send_brief', req, to_jsonb(b));
end $$;

revoke execute on function public.save_brief_draft(uuid, jsonb, text) from public, anon;
grant execute on function public.save_brief_draft(uuid, jsonb, text) to authenticated;
revoke execute on function app.first_plan(public.brief_versions) from public, anon, authenticated;
