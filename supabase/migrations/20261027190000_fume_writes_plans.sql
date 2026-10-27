-- Fume writes the plan with a language model (docs/mvp/library.md B06–B08, templates T03 and T04).
--
-- The model proposes; these commands decide. When the setting 'llm_plans' is on, sending a brief leaves Fume's plan in
-- 'writing' with the plan built from the brief as its body, and the edge function `fume-plan` asks the model for the
-- real one. "Change it with Fume" does the same for the next version, from the approver's words. The function takes the
-- work (fume_take_plan), and hands the model's plan to fume_finish_plan, which checks it against the campaign's products
-- and verified claims before anyone sees it. When the model fails twice, the plan built from the brief is the plan, so
-- a campaign never waits on the model. With the setting off nothing changes from before.
--
-- Every run is kept in public.task_runs (what it read, what it wrote, tokens and cost), readable by Fume's staff only.

create table if not exists app.settings (key text primary key, value jsonb not null);
insert into app.settings (key, value) values ('llm_plans', 'false') on conflict (key) do nothing;

create or replace function app.setting_on(p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select value = 'true'::jsonb from app.settings where key = p_key), false)
$$;

create table public.task_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete cascade,
  kind text not null check (kind in ('plan')),
  subject_id uuid not null,
  attempt int not null,
  state text not null default 'running' check (state in ('running', 'succeeded', 'failed')),
  model text,
  input jsonb not null default '{}',
  output jsonb,
  error text,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_usd numeric(10, 4) not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (subject_id, attempt)
);
create index if not exists task_runs_campaign on public.task_runs (campaign_id);
alter table public.task_runs enable row level security;
create policy task_runs_read on public.task_runs for select to authenticated using (app.is_staff(workspace_id));
grant select on public.task_runs to authenticated;

-- Fume's first plan: as before, and left in 'writing' for the model when the setting is on.
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
  llm boolean := app.setting_on('llm_plans');
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

  rules := app.plan_rules(p_brief);

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
    case when llm then 'writing' else 'ready' end, 'fume'
  ) returning * into p;
  if not llm then
    perform app.record(p.workspace_id, 'plan.written', 'plan_version', p.id, jsonb_build_object('version', p.version, 'by', 'fume'));
  end if;
  return p;
end $$;

-- The plan's rules: the brief's musts and nevers, and the brand's approved Brand DNA. Never the model's to write.
create or replace function app.plan_rules(p_brief public.brief_versions) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x), '[]') from (
    select jsonb_build_object('text', m, 'kind', 'must', 'source', 'brief') as x
    from jsonb_array_elements_text(case when jsonb_typeof(p_brief.body -> 'mandatory') = 'array' then p_brief.body -> 'mandatory' else '[]' end) m
    union all
    select jsonb_build_object('text', m, 'kind', 'never', 'source', 'brief')
    from jsonb_array_elements_text(case when jsonb_typeof(p_brief.body -> 'never') = 'array' then p_brief.body -> 'never' else '[]' end) m
    union all
    select jsonb_build_object('text', r.statement, 'kind', case when r.kind = 'hard_constraint' then 'never' else 'must' end,
      'source', 'brand_dna', 'ruleId', r.id)
    from public.brand_rules r
    join public.brand_dna_versions d on d.id = r.brand_dna_version_id and d.state = 'approved'
    where r.workspace_id = p_brief.workspace_id
  ) rules_rows
$$;
revoke execute on function app.plan_rules(public.brief_versions) from public, anon, authenticated;

-- "Change it with Fume": the approver's words, and Fume writes the next version from them. With the setting off, her
-- words go to Fume's designer as a request for changes (ask_plan_changes), as before.
create or replace function public.change_plan_with_fume(p_campaign_id uuid, p_version int, p_note text, p_key text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('campaign_id', p_campaign_id, 'version', p_version, 'note', p_note);
  prior jsonb;
  p public.plan_versions;
  n public.plan_versions;
  note text := trim(coalesce(p_note, ''));
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'change_plan_with_fume', req);
  if prior is not null then return prior; end if;

  if note = '' then perform app.fail('invalid', 'Write what Fume should change.'); end if;
  if not app.setting_on('llm_plans') then
    return app.idem_end(p_key, 'change_plan_with_fume', req, public.ask_plan_changes(p_campaign_id, p_version, note));
  end if;
  p := app.current_plan(p_campaign_id, p_version);
  if not app.customer_is(p.workspace_id, array['owner', 'approver']) and not app.is_staff(p.workspace_id, array['designer']) then
    perform app.fail('forbidden', 'Only the approver or a designer changes the plan.');
  end if;
  if p.state = 'approved' then
    perform app.fail('conflict', 'This plan is approved and the work has started, so it stays as it is. Ask for a change on a creative once you see it.');
  end if;
  if p.state <> 'ready' then
    perform app.fail('conflict', 'Fume is still working on the plan. Tell me again once it is ready.');
  end if;

  perform app.record(p.workspace_id, 'plan.changes_asked', 'plan_version', p.id, jsonb_build_object('note', note, 'to', 'fume'));
  update public.plan_versions set state = 'superseded' where id = p.id;
  insert into public.plan_versions (
    workspace_id, campaign_id, version, brief_version_id, brand_dna_version_id, body, state, written_by, changes
  ) values (
    p.workspace_id, p.campaign_id, p.version + 1, p.brief_version_id, p.brand_dna_version_id, p.body, 'writing', 'fume',
    '{}'
  ) returning * into n;
  return app.idem_end(p_key, 'change_plan_with_fume', req, to_jsonb(n));
end $$;
revoke execute on function public.change_plan_with_fume(uuid, int, text, text) from public, anon;
grant execute on function public.change_plan_with_fume(uuid, int, text, text) to authenticated;

-- ─── The edge function's commands (service role only) ───────────────────────

-- Take the campaign's plan to write: null when there is nothing to write or a run is under way. The third time, the
-- plan built from the brief becomes the plan. Returns what the model may read: the brief, the brand, the products with
-- their facts, the rules, and for a change the plan before and her words.
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
            'id', f.id, 'area', f.area, 'label', f.label, 'statement', f.statement, 'status', f.status, 'required', f.required
          ) order by f.area, f.label), '[]')
          from public.product_facts f where f.product_id = pr.id and f.superseded_by is null
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

-- The plan built from the brief stands (or, for a change, the plan before it with her words to Fume's designer).
create or replace function app.fume_plan_fallback(p public.plan_versions, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  before public.plan_versions;
  asked text;
begin
  select * into before from public.plan_versions
  where campaign_id = p.campaign_id and version = p.version - 1 and brief_version_id = p.brief_version_id;
  if found then
    select detail ->> 'note' into asked from public.record_events
    where subject_id = before.id and action = 'plan.changes_asked' order by at desc limit 1;
  end if;
  if asked is not null then
    -- A change Fume could not write: the version waits for Fume's designer with her words.
    update public.plan_versions set state = 'changes_asked', changes = array[p_note] where id = p.id;
    perform app.record(p.workspace_id, 'plan.changes_asked', 'plan_version', p.id, jsonb_build_object('note', asked, 'to', 'designer', 'campaign_id', p.campaign_id));
  else
    update public.plan_versions set state = 'ready' where id = p.id;
    perform app.record(p.workspace_id, 'plan.written', 'plan_version', p.id,
      jsonb_build_object('version', p.version, 'by', 'fume', 'fallback', true, 'note', p_note, 'campaign_id', p.campaign_id));
  end if;
end $$;
revoke execute on function app.fume_plan_fallback(public.plan_versions, text) from public, anon, authenticated;

-- The model's plan, checked before it becomes the version: 1–3 directions with distinct ids and one chosen; every
-- planned creative in a known format, about the campaign's products only, a variant naming a master of its
-- direction; every claim it uses a verified, current claim fact of those products. The rules stay the plan's own.
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
  where f.product_id = any (products) and f.area = 'claim' and f.status = 'verified' and f.superseded_by is null;

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

-- A run that failed: the next read tries again, and after the second failure the fallback stands.
create or replace function public.fume_fail_plan(p_run_id uuid, p_error text, p_usage jsonb default '{}', p_final boolean default false)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  run public.task_runs;
  p public.plan_versions;
begin
  select * into run from public.task_runs where id = p_run_id for update;
  if not found or run.state <> 'running' then return; end if;
  update public.task_runs set state = 'failed', error = left(p_error, 2000), finished_at = now(),
    model = coalesce(p_usage ->> 'model', model),
    input_tokens = coalesce((p_usage ->> 'input_tokens')::int, 0),
    output_tokens = coalesce((p_usage ->> 'output_tokens')::int, 0),
    cost_usd = coalesce((p_usage ->> 'cost_usd')::numeric, 0)
  where id = run.id;
  select * into p from public.plan_versions where id = run.subject_id for update;
  if p.state = 'writing' and (p_final or run.attempt >= 2) then
    perform app.fume_plan_fallback(p, 'The model did not write the plan; the plan from the brief stands.');
  end if;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.fume_take_plan(uuid)', 'public.fume_finish_plan(uuid, jsonb, text[], jsonb)',
    'public.fume_fail_plan(uuid, text, jsonb, boolean)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
