-- The Engine, first version (Marcus, 4 Nov 2026: "la oss jobbe"; docs/mvp/engine.md). A designer presses Render on a
-- creative in the Studio; the Engine writes the prompt from what Fume knows (the job's frozen snapshot, the approved
-- plan, the product's verified facts and pictures, the Brand DNA, the taste model and the lessons people taught it),
-- checks it by code and by meaning, and only then has an image model make the picture. The picture is a candidate of
-- the creative's job, like one made by hand: the designer sends it to check, the expert checks it, only the customer
-- approves it. Customers never see a candidate (production tables are staff only).
--
-- The database owns the job and its truth; the edge function `engine` only does the work:
--   render_creative     designer: the creative's Engine job (started with its snapshot, or the open one again)
--   engine_take         service: the next attempt of a job and everything the prompt is written from
--   engine_prompted     service: the prompt and its checks; a prompt that did not pass fails the attempt
--   engine_submitted    service: the image model's request id
--   engine_finish       service: the pictures as candidates
--   engine_fail         service: why the attempt failed; the job waits for another try or fails
--   fume_engine_budget  service: what the image models cost this week, against the ceiling
-- An attempt that has run for ten minutes without an answer is taken again.

insert into app.settings (key, value) values
  ('engine_week_usd', '20'),
  ('engine_image_model', '"nano-banana-pro"')
on conflict (key) do nothing;

-- ─── Prompts and lessons ─────────────────────────────────────────────────────

create table public.engine_prompts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  job_id uuid not null references public.production_jobs (id) on delete cascade,
  attempt_id uuid not null references public.job_attempts (id) on delete cascade,
  -- sha256 of the compile package: the same package always gives the same hash.
  hash text not null,
  status text not null check (status in ('validated', 'escalated', 'blocked')),
  reason text,
  image_model text not null,
  compile_package jsonb not null default '{}',
  slots jsonb not null default '[]',
  text text,
  findings jsonb not null default '[]',
  attempts jsonb not null default '[]',
  calls jsonb not null default '[]',
  llm_usd numeric(10, 4) not null default 0,
  created_at timestamptz not null default now()
);
create index engine_prompts_job_id_idx on public.engine_prompts (job_id);
create index engine_prompts_attempt_id_idx on public.engine_prompts (attempt_id);
create index engine_prompts_workspace_id_idx on public.engine_prompts (workspace_id);
alter table public.engine_prompts enable row level security;
create policy engine_prompts_read on public.engine_prompts for select to authenticated using (app.is_staff(workspace_id));
grant select on public.engine_prompts to authenticated;

-- What people's verdicts taught the Engine about a brand (the feedback domain). Only people's verdicts teach.
create table public.engine_lessons (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  statement text not null,
  polarity text not null check (polarity in ('do', 'avoid')),
  reason text not null,
  scope text not null default 'brand' check (scope in ('brand', 'brand_and_model')),
  image_model text,
  state text not null default 'active' check (state in ('active', 'retired')),
  source_candidate_id uuid references public.candidates (id) on delete set null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index engine_lessons_workspace_id_idx on public.engine_lessons (workspace_id);
create index engine_lessons_source_candidate_id_idx on public.engine_lessons (source_candidate_id);
alter table public.engine_lessons enable row level security;
create policy engine_lessons_read on public.engine_lessons for select to authenticated using (app.is_staff(workspace_id));
grant select on public.engine_lessons to authenticated;

alter table public.job_attempts
  add column prompt_id uuid references public.engine_prompts (id) on delete set null,
  add column request jsonb,
  add column response jsonb;
create index job_attempts_prompt_id_idx on public.job_attempts (prompt_id);

-- ─── Budget ──────────────────────────────────────────────────────────────────

create or replace function app.engine_spent_usd() returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(a.cost_cents), 0)::numeric / 100 from public.job_attempts a
  where a.provider <> 'manual' and a.started_at > now() - interval '7 days'
$$;
revoke execute on function app.engine_spent_usd() from public, anon, authenticated;

create or replace function public.fume_engine_budget() returns jsonb
language sql stable security definer set search_path = '' as $$
  with cap as (
    select coalesce((select (value #>> '{}')::numeric from app.settings where key = 'engine_week_usd'), 0) as usd
  )
  select jsonb_build_object('spent_usd', app.engine_spent_usd(), 'cap_usd', cap.usd, 'allowed', app.engine_spent_usd() < cap.usd)
  from cap
$$;

-- The language model's week counts the Engine's prompts too.
create or replace function public.fume_llm_budget() returns jsonb
language sql stable security definer set search_path = '' as $$
  with spent as (
    select (
      coalesce((select sum(cost_usd) from public.task_runs where started_at > now() - interval '7 days'), 0)
      + coalesce((select sum(llm_usd) from public.engine_prompts where created_at > now() - interval '7 days'), 0)
    )::numeric as usd
  ), cap as (
    select coalesce((select (value #>> '{}')::numeric from app.settings where key = 'llm_week_usd'), 0) as usd
  )
  select jsonb_build_object('spent_usd', spent.usd, 'cap_usd', cap.usd, 'allowed', spent.usd < cap.usd) from spent, cap
$$;

-- ─── Render ──────────────────────────────────────────────────────────────────

-- The creative's Engine job: the first version's (master, variant or format, from the approved master version), or a
-- correction once a version waits for one, under the same rules as start_job. A job already rendering is returned as
-- it is; a failed one is queued again.
create or replace function public.render_creative(p_creative_id uuid, p_key text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('creative_id', p_creative_id);
  prior jsonb;
  cr public.creatives;
  v public.creative_versions;
  mv public.creative_versions;
  j public.production_jobs;
  v_kind text;
  open_job boolean;
  model text := coalesce((select value #>> '{}' from app.settings where key = 'engine_image_model'), 'nano-banana-pro');
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'render_creative', req);
  if prior is not null then return prior; end if;

  select * into cr from public.creatives where id = p_creative_id for update;
  if not found or not app.can_read(cr.workspace_id) then
    perform app.fail('not_found', 'No such creative.');
  end if;
  if not app.is_staff(cr.workspace_id, array['designer']) then
    perform app.fail('forbidden', 'Only a designer renders a creative.');
  end if;
  v := app.latest_version(cr.id);
  if v.id is null then
    v_kind := cr.kind;
    if v_kind in ('variant', 'format') then
      mv := app.approved_master_version(cr.master_id);
      if mv.id is null then
        perform app.fail('invalid', 'Variants and formats need an approved master.');
      end if;
    end if;
  elsif v.state in ('changes_requested', 'correcting', 'held') then
    v_kind := 'correction';
  else
    perform app.fail('conflict', format(
      'Version %s is %s. A new version follows the expert''s correction or the customer''s changes.',
      v.number, replace(v.state, '_', ' ')));
  end if;

  -- The open job: this creative's, of this kind, that no version has come from yet.
  select * into j from public.production_jobs pj
  where pj.creative_id = cr.id and pj.kind = v_kind and pj.state <> 'cancelled' and pj.mode = 'engine'
    and not exists (select 1 from public.creative_versions x where x.job_id = pj.id)
  order by pj.created_at desc limit 1;
  open_job := found;
  if open_job and j.state in ('queued', 'running', 'unknown') then
    return app.idem_end(p_key, 'render_creative', req, to_jsonb(j));
  end if;
  if not (public.fume_engine_budget() ->> 'allowed')::boolean then
    perform app.fail('unavailable', 'This week''s budget for the Engine''s pictures is used up.');
  end if;
  if open_job then
    -- Rendered before (failed, or made and not sent yet): the same job again, with what it knows now.
    update public.production_jobs set state = 'queued', error = null, updated_at = now() where id = j.id returning * into j;
    perform app.record(j.workspace_id, 'job.queued', 'production_job', j.id, jsonb_build_object('by', 'render'));
  else
    select * into j from jsonb_populate_record(null::public.production_jobs, public.start_job(
      cr.campaign_id, v_kind,
      jsonb_build_object('provider', 'engine', 'image_model', model, 'creative', cr.title, 'slot', cr.slot,
        'format', cr.format, 'corrects', v.id),
      '[]', cr.id, mv.id, 'engine', null));
    update public.production_jobs set creative_id = cr.id where id = j.id returning * into j;
  end if;
  return app.idem_end(p_key, 'render_creative', req, to_jsonb(j));
end $$;

-- ─── The edge function's side ────────────────────────────────────────────────

-- The next attempt of an Engine job and everything the prompt is written from. Null when there is nothing to do:
-- the job is done, cancelled, or being worked on right now. A submitted attempt comes back to be collected.
create or replace function public.engine_take(p_job_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  j public.production_jobs;
  a public.job_attempts;
  s public.context_snapshots;
  cr public.creatives;
  src public.creative_versions;
  src_title text;
  ws public.workspaces;
  n int;
  model text;
  change jsonb;
begin
  select * into j from public.production_jobs where id = p_job_id for update;
  if not found or j.mode <> 'engine' then return null; end if;
  select * into a from public.job_attempts where job_id = j.id order by number desc limit 1;

  if j.state in ('running', 'unknown') and a.id is not null and a.state = 'running' then
    if a.provider_job_id is not null then
      return jsonb_build_object('collect', jsonb_build_object(
        'job_id', j.id, 'attempt_id', a.id, 'workspace_id', j.workspace_id, 'provider', a.provider,
        'model', a.model, 'provider_job_id', a.provider_job_id, 'started_at', a.started_at));
    end if;
    if a.started_at > now() - interval '10 minutes' then return null; end if;
    update public.job_attempts set state = 'failed', error = 'No answer in ten minutes.', finished_at = now() where id = a.id;
  elsif j.state <> 'queued' then
    return null;
  end if;

  n := coalesce(a.number, 0) + 1;
  if n > 6 then
    update public.production_jobs set state = 'failed', error = 'The Engine tried six times.', updated_at = now() where id = j.id;
    return null;
  end if;
  if not (public.fume_engine_budget() ->> 'allowed')::boolean or not (public.fume_llm_budget() ->> 'allowed')::boolean then
    update public.production_jobs set state = 'failed', error = 'This week''s budget for the Engine is used up.', updated_at = now()
    where id = j.id;
    return null;
  end if;

  select * into s from public.context_snapshots where id = j.snapshot_id;
  select * into cr from public.creatives where id = j.creative_id;
  select * into ws from public.workspaces where id = j.workspace_id;
  model := coalesce(s.recipe ->> 'image_model', 'nano-banana-pro');

  -- What this is made from: the approved master for a variant or a format, the version it corrects for a correction.
  if j.kind in ('variant', 'format') then
    select * into src from public.creative_versions where id = j.master_version_id;
    select title into src_title from public.creatives where id = src.creative_id;
  elsif j.kind = 'correction' then
    src := app.latest_version(cr.id);
    src_title := cr.title || ', version ' || src.number;
    select jsonb_build_object('problem', x.problem, 'must_change', x.must_change, 'must_stay', x.must_stay) into change
    from public.change_requests x where x.version_id = src.id and x.withdrawn_at is null order by x.created_at desc limit 1;
    if change is null then
      select jsonb_build_object('problem', coalesce(ec.note, ''), 'must_change', coalesce((
        select jsonb_agg(f.finding order by f.created_at) from public.findings f where f.version_id = src.id and f.status = 'open'
      ), '[]'), 'must_stay', '[]'::jsonb) into change
      from public.expert_checks ec where ec.version_id = src.id;
    end if;
  end if;

  insert into public.job_attempts (workspace_id, job_id, number, provider, model, state)
  values (j.workspace_id, j.id, n, 'engine', model, 'running') returning * into a;
  update public.production_jobs set state = 'running', error = null, updated_at = now() where id = j.id;

  return jsonb_build_object(
    'run', jsonb_build_object('job_id', j.id, 'attempt_id', a.id, 'attempt', n, 'workspace_id', j.workspace_id,
      'campaign_id', j.campaign_id, 'kind', j.kind, 'image_model', model),
    'brand', jsonb_build_object('name', ws.brand_name),
    'creative', jsonb_build_object('id', cr.id, 'title', cr.title, 'slot', cr.slot, 'format', cr.format, 'kind', cr.kind),
    'plan', coalesce((select body from public.plan_versions where id = s.plan_version_id), '{}'),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pr.id, 'name', pr.name, 'variant', nullif(pr.variant, ''),
        'facts', coalesce((select jsonb_agg(f) from jsonb_array_elements(s.facts) f where f ->> 'product_id' = pr.id::text), '[]'),
        'pictures', coalesce((
          select jsonb_agg(jsonb_build_object('slot', x.slot, 'bucket', x.bucket, 'path', x.path, 'name', x.name))
          from (
            select distinct on (coalesce(so.slot, so.id::text)) so.slot, fi.bucket, fi.path, fi.name
            from public.sources so join public.files fi on fi.id = so.file_id
            where so.product_id = pr.id and so.kind = 'packshot' and fi.content_type like 'image/%'
            order by coalesce(so.slot, so.id::text), so.created_at desc
          ) x
        ), '[]')
      ) order by pr.name)
      from public.campaign_products cp join public.products pr on pr.id = cp.product_id
      where cp.campaign_id = j.campaign_id
    ), '[]'),
    'rules', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'area', r.area, 'statement', r.statement, 'kind', r.kind, 'origin', r.origin)
        order by r.created_at)
      from public.brand_rules r where r.brand_dna_version_id = s.brand_dna_version_id
    ), '[]'),
    'taste', coalesce((
      select jsonb_agg(jsonb_build_object('key', t.key, 'words', t.words, 'do_confidence', t.do_confidence,
        'avoid_words', t.avoid_words, 'avoid_confidence', t.avoid_confidence))
      from public.taste_variables t where t.workspace_id = j.workspace_id
    ), '[]'),
    'lessons', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'statement', l.statement, 'polarity', l.polarity, 'reason', l.reason)
        order by l.created_at desc)
      from public.engine_lessons l
      where l.workspace_id = j.workspace_id and l.state = 'active' and (l.image_model is null or l.image_model = model)
    ), '[]'),
    -- Prompts whose pictures the customer approved: the brand's own best examples.
    'exemplars', coalesce((
      select jsonb_agg(jsonb_build_object('text', x.text)) from (
        select ep.text from public.engine_prompts ep
        join public.candidates c on c.attempt_id = ep.attempt_id
        join public.creative_versions cv on cv.candidate_id = c.id and cv.state in ('approved', 'delivered')
        where ep.workspace_id = j.workspace_id and ep.status = 'validated'
        order by cv.created_at desc limit 3
      ) x
    ), '[]'),
    'master', case when src.id is null then null else (
      select jsonb_build_object('bucket', fi.bucket, 'path', fi.path, 'title', src_title)
      from public.files fi where fi.id = src.file_id
    ) end,
    'change', change
  );
end $$;

-- The prompt and its checks. One that did not pass fails the attempt and the job: a person looks at the findings.
create or replace function public.engine_prompted(p_attempt_id uuid, p_prompt jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a public.job_attempts;
  p public.engine_prompts;
  why text;
begin
  select * into a from public.job_attempts where id = p_attempt_id for update;
  if not found or a.state <> 'running' then return null; end if;
  insert into public.engine_prompts (
    workspace_id, job_id, attempt_id, hash, status, reason, image_model, compile_package, slots, text, findings,
    attempts, calls, llm_usd
  ) values (
    a.workspace_id, a.job_id, a.id, coalesce(p_prompt ->> 'hash', ''), p_prompt ->> 'status', p_prompt ->> 'reason',
    coalesce(p_prompt ->> 'image_model', a.model), coalesce(p_prompt -> 'compile_package', '{}'),
    coalesce(p_prompt -> 'slots', '[]'), p_prompt ->> 'text', coalesce(p_prompt -> 'findings', '[]'),
    coalesce(p_prompt -> 'attempts', '[]'), coalesce(p_prompt -> 'calls', '[]'),
    coalesce((p_prompt ->> 'llm_usd')::numeric, 0)
  ) returning * into p;
  update public.job_attempts set prompt_id = p.id where id = a.id;
  perform app.record(a.workspace_id, 'engine.prompted', 'production_job', a.job_id,
    jsonb_build_object('status', p.status, 'reason', p.reason, 'attempt', a.number));
  if p.status <> 'validated' then
    why := coalesce(
      (select string_agg(f ->> 'message', ' ') from (select f from jsonb_array_elements(p.findings) f limit 3) x),
      p_prompt ->> 'message', 'The prompt did not pass Fume''s checks.');
    why := 'The prompt did not pass Fume''s checks: ' || why;
    update public.job_attempts set state = 'failed', error = why, finished_at = now() where id = a.id;
    update public.production_jobs set state = 'failed', error = why, updated_at = now() where id = a.job_id;
    perform app.record(a.workspace_id, 'job.failed', 'production_job', a.job_id, jsonb_build_object('error', why));
  end if;
  return to_jsonb(p);
end $$;

create or replace function public.engine_submitted(
  p_attempt_id uuid, p_provider text, p_provider_job_id text, p_request jsonb
) returns void
language sql security definer set search_path = '' as $$
  update public.job_attempts set provider = p_provider, provider_job_id = p_provider_job_id, request = p_request
  where id = p_attempt_id and state = 'running'
$$;

-- The pictures (uploaded to the workspace's folder by the function) become candidates of the job, made by the
-- designer who pressed Render, so someone else checks them.
create or replace function public.engine_finish(
  p_attempt_id uuid, p_files jsonb, p_response jsonb, p_cost_cents int default 0
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a public.job_attempts;
  j public.production_jobs;
  x jsonb;
  f public.files;
  c public.candidates;
  out jsonb := '[]';
begin
  select * into a from public.job_attempts where id = p_attempt_id for update;
  if not found or a.state <> 'running' then return null; end if;
  select * into j from public.production_jobs where id = a.job_id for update;
  if jsonb_typeof(p_files) <> 'array' or jsonb_array_length(p_files) = 0 then
    perform app.fail('invalid', 'The Engine finished without a picture.');
  end if;
  for x in select y from jsonb_array_elements(p_files) y loop
    if split_part(x ->> 'path', '/', 1) <> a.workspace_id::text then
      perform app.fail('invalid', 'The picture must be stored in its workspace''s folder.');
    end if;
    insert into public.files (workspace_id, path, name, content_type, bytes, sha256, width, height, purpose, uploaded_by)
    values (a.workspace_id, x ->> 'path', x ->> 'name', coalesce(x ->> 'content_type', 'image/png'),
      coalesce((x ->> 'bytes')::bigint, 0), x ->> 'sha256', (x ->> 'width')::int, (x ->> 'height')::int, 'candidate',
      j.requested_by)
    returning * into f;
    insert into public.candidates (workspace_id, job_id, attempt_id, file_id, origin, note, made_by)
    values (a.workspace_id, j.id, a.id, f.id, 'engine', 'Made by the Engine with ' || coalesce(a.model, 'an image model'),
      j.requested_by)
    returning * into c;
    perform app.record(a.workspace_id, 'candidate.added', 'candidate', c.id,
      jsonb_build_object('origin', 'engine', 'model', a.model, 'attempt', a.number));
    out := out || jsonb_build_array(to_jsonb(c));
  end loop;
  update public.job_attempts set state = 'succeeded', response = p_response, cost_cents = coalesce(p_cost_cents, 0),
    finished_at = now() where id = a.id;
  update public.production_jobs set state = 'succeeded', error = null, cost_cents = cost_cents + coalesce(p_cost_cents, 0),
    updated_at = now() where id = j.id;
  perform app.record(a.workspace_id, 'job.succeeded', 'production_job', j.id, jsonb_build_object('by', 'engine'));
  return out;
end $$;

-- Why the attempt failed. The job is queued for another try unless the failure is final (or the attempts are used).
create or replace function public.engine_fail(
  p_attempt_id uuid, p_error text, p_response jsonb default null, p_cost_cents int default 0, p_final boolean default false
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a public.job_attempts;
  j public.production_jobs;
  final boolean;
begin
  select * into a from public.job_attempts where id = p_attempt_id for update;
  if not found or a.state <> 'running' then return null; end if;
  update public.job_attempts set state = 'failed', error = p_error, response = p_response,
    cost_cents = coalesce(p_cost_cents, 0), finished_at = now() where id = a.id;
  final := p_final or a.number >= 3;
  update public.production_jobs set
    state = case when final then 'failed' else 'queued' end,
    error = p_error, cost_cents = cost_cents + coalesce(p_cost_cents, 0), updated_at = now()
  where id = a.job_id and state in ('running', 'unknown') returning * into j;
  if final then
    perform app.record(a.workspace_id, 'job.failed', 'production_job', a.job_id, jsonb_build_object('error', p_error));
  end if;
  return to_jsonb(j);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.engine_take(uuid)', 'public.engine_prompted(uuid, jsonb)', 'public.engine_submitted(uuid, text, text, jsonb)',
    'public.engine_finish(uuid, jsonb, jsonb, int)', 'public.engine_fail(uuid, text, jsonb, int, boolean)',
    'public.fume_engine_budget()', 'public.fume_llm_budget()'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
revoke execute on function public.render_creative(uuid, text) from public, anon;
grant execute on function public.render_creative(uuid, text) to authenticated;
