-- The Engine bar (FLOWS §9.1): the designer's words reach the picture. With a Render the app may send what the designer
-- said: the words of the Engine bar, the creative's Direction, and the picture those words change (one of this
-- creative's own pictures). The job keeps them for its next picture; the Engine edits the picked picture with the
-- image model, keeping everything else, or writes a new one with the Direction. A variant or a format is still made
-- from its approved master.
--
-- Also: a job's tries count from the Render that queued it (tries_from), so a job rendered again has its three tries
-- for a refused picture, and six in all, each time; before, its attempts counted over its whole life.

alter table public.production_jobs add column direction jsonb;
alter table public.production_jobs add column tries_from int not null default 1;

drop function public.render_creative(uuid, text);
create function public.render_creative(p_creative_id uuid, p_key text default null, p_direction jsonb default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('creative_id', p_creative_id, 'direction', p_direction);
  d jsonb;
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
  -- What the designer said with this Render: the words of the Engine bar, the creative's Direction, the picture to change.
  if p_direction is not null then
    if jsonb_typeof(p_direction) <> 'object' or length(coalesce(p_direction ->> 'instruction', '')) > 500
      or length(coalesce(p_direction ->> 'direction', '')) > 1000 then
      perform app.fail('invalid', 'Say it in fewer words: up to 500 characters, and 1000 for the Direction.');
    end if;
    d := jsonb_strip_nulls(jsonb_build_object(
      'instruction', nullif(btrim(p_direction ->> 'instruction'), ''),
      'direction', nullif(btrim(p_direction ->> 'direction'), ''),
      'from_candidate_id', (
        select c.id from public.candidates c join public.production_jobs pj on pj.id = c.job_id
        where c.id::text = p_direction ->> 'from_candidate_id' and pj.creative_id = cr.id)));
    if d = '{}'::jsonb then d := null; end if;
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
    -- Still at work: the words wait for the next Render.
    return app.idem_end(p_key, 'render_creative', req, to_jsonb(j));
  end if;
  if not (public.fume_engine_budget() ->> 'allowed')::boolean then
    perform app.fail('unavailable', 'This week''s budget for the Engine''s pictures is used up.');
  end if;
  if open_job then
    -- Rendered before (failed, or made and not sent yet): the same job again, with what it knows now.
    update public.production_jobs set state = 'queued', error = null, direction = d, updated_at = now(),
      tries_from = coalesce((select max(x.number) from public.job_attempts x where x.job_id = j.id), 0) + 1
    where id = j.id returning * into j;
    perform app.record(j.workspace_id, 'job.queued', 'production_job', j.id, jsonb_build_object('by', 'render'));
  else
    select * into j from jsonb_populate_record(null::public.production_jobs, public.start_job(
      cr.campaign_id, v_kind,
      jsonb_build_object('provider', 'engine', 'image_model', model, 'creative', cr.title, 'slot', cr.slot,
        'format', cr.format, 'corrects', v.id),
      '[]', cr.id, mv.id, 'engine', null));
    update public.production_jobs set creative_id = cr.id, direction = d where id = j.id returning * into j;
  end if;
  return app.idem_end(p_key, 'render_creative', req, to_jsonb(j));
end $$;

revoke execute on function public.render_creative(uuid, text, jsonb) from public, anon;
grant execute on function public.render_creative(uuid, text, jsonb) to authenticated;

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
  picked public.candidates;
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
  -- Six tries since the Render that queued it stop the job.
  if n - j.tries_from >= 6 then
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

  -- The designer's words with this Render (render_creative): the picture they change, what they ask of it, and the
  -- Direction of the creative. A picture of a variant or a format is always made from its approved master.
  if j.direction ? 'from_candidate_id' and j.kind not in ('variant', 'format') then
    select c.* into picked from public.candidates c join public.production_jobs pj on pj.id = c.job_id
    where c.id = (j.direction ->> 'from_candidate_id')::uuid and pj.creative_id = j.creative_id;
  end if;
  if j.direction is not null then
    change := coalesce(change, jsonb_build_object('problem', '', 'must_change', '[]'::jsonb, 'must_stay', '[]'::jsonb))
      || jsonb_strip_nulls(jsonb_build_object('ask', nullif(btrim(j.direction ->> 'instruction'), ''),
        'direction', nullif(btrim(j.direction ->> 'direction'), '')));
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
          select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('slot', x.slot, 'bucket', x.bucket, 'path', x.path,
            'url', x.url, 'name', x.name)))
          from (
            select distinct on (coalesce(so.slot, so.id::text)) so.slot, fi.bucket, fi.path,
              case when fi.id is null then so.url end as url, coalesce(fi.name, so.name) as name
            from public.sources so left join public.files fi on fi.id = so.file_id
            where so.product_id = pr.id and so.kind = 'packshot'
              and (fi.content_type like 'image/%' or (fi.id is null and so.url like 'https://%'))
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
    'master', case
      when picked.id is not null then (
        select jsonb_build_object('bucket', fi.bucket, 'path', fi.path, 'title', cr.title, 'picked', true)
        from public.files fi where fi.id = picked.file_id)
      when src.id is null then null
      else (
        select jsonb_build_object('bucket', fi.bucket, 'path', fi.path, 'title', src_title)
        from public.files fi where fi.id = src.file_id)
    end,
    'change', change
  );
end $$;
revoke execute on function public.engine_take(uuid) from public, anon, authenticated;
grant execute on function public.engine_take(uuid) to service_role;

-- A refused picture is tried again, three tries in all from the Render that queued the job.
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
  select * into j from public.production_jobs where id = a.job_id;
  -- The third try since the Render that queued it is the last.
  final := p_final or a.number - coalesce(j.tries_from, 1) >= 2;
  update public.production_jobs set
    state = case when final then 'failed' else 'queued' end,
    error = p_error, cost_cents = cost_cents + coalesce(p_cost_cents, 0), updated_at = now()
  where id = a.job_id and state in ('running', 'unknown') returning * into j;
  if final then
    perform app.record(a.workspace_id, 'job.failed', 'production_job', a.job_id, jsonb_build_object('error', p_error));
  end if;
  return to_jsonb(j);
end $$;
