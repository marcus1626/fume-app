-- The Engine chooses how to write (docs/mvp/engine.md, step 14). engine_take hands over, for the job's image model,
-- how each of the dialect's ways of writing a prompt did: its scored prompts and the sum of their scores, from the
-- prompt graph. The Engine draws one way for each choice from that evidence (supabase/functions/_shared/engine/learn.ts).

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
    'change', change,
    -- What the Brand Brain knows that shapes a picture (app.engine_brain); the Engine writes down what it used.
    'brain', app.engine_brain(j.workspace_id, j.campaign_id, cr.title),
    -- A picture for composition, light and mood: the campaign moodboard's newest liked picture, else its newest one
    -- that was not disliked. Never for a change to a picture already made, nor a variant or a format of a master.
    'composition', case when picked.id is null and j.kind not in ('variant', 'format', 'correction') then (
      select jsonb_strip_nulls(jsonb_build_object('id', bi.id, 'bucket', fi.bucket, 'path', fi.path,
          'url', case when fi.id is null then bi.image_url end, 'note', nullif(btrim(coalesce(bi.note, bi.text, '')), '')))
      from public.board_items bi join public.boards b on b.id = bi.board_id
      left join public.files fi on fi.id = bi.file_id and fi.content_type like 'image/%'
      where b.campaign_id = j.campaign_id and b.kind = 'campaign_moodboard' and bi.kind = 'image'
        and bi.verdict is distinct from 'disliked' and (fi.id is not null or bi.image_url like 'https://%')
      order by (bi.verdict = 'liked') desc nulls last, bi.created_at desc limit 1) end,
    -- How each way of writing a prompt did for this model (the prompt graph's newest 500 scored prompts, every brand:
    -- how a model reads a prompt is the model's, and no brand's data is in it).
    'arms', coalesce((
      select jsonb_agg(jsonb_build_object('image_type', arm.kind, 'feature', arm.feature, 'n', arm.cnt, 'sum', arm.total))
      from (
        select pr.image_type kind, ft feature, count(*) cnt, round(sum(pr.score), 3) total
        from (select * from app.engine_prompt_rows(null) where image_model = model and score is not null
              order by created_at desc limit 500) pr, unnest(pr.features) ft
        where ft like 'dialect:%'
        group by 1, 2
      ) arm), '[]')
  );
end $$;
revoke execute on function public.engine_take(uuid) from public, anon, authenticated;
grant execute on function public.engine_take(uuid) to service_role;
