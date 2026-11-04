-- The Brand Brain in the Engine (docs/mvp/engine.md, step 10). engine_take hands the Engine what the brand's knowledge
-- graph knows that shapes a picture: the palette, the brand's own pictures in words, notes people added, the market,
-- and what was asked to change in the brand's earlier creatives and why. Every item keeps its node's id, so the prompt's
-- ledger can say what went into the prompt, what was left out and why, and the prompt graph can count what works.

alter table public.engine_prompts add column ledger jsonb not null default '[]';

-- brain_sync again, unchanged but for one word: in PL/pgSQL `by` is a keyword, so `r.by` failed as soon as a brand had a
-- change request, and with it the brand's whole graph (the chat, the plan writer and the Engine read it).
create or replace function app.brain_sync(ws uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  d public.brand_dna_versions;
  k text;
  x jsonb;
  seen text[] := '{}';
  r record;
  n uuid;
begin
  -- Identity: the newest Brand DNA that is not superseded.
  select * into d from public.brand_dna_versions where workspace_id = ws and state <> 'superseded'
  order by version desc limit 1;
  if found then
    foreach k in array array['colours', 'typefaces', 'logos', 'voice', 'imagery'] loop
      for x in select * from jsonb_array_elements(coalesce(d.identity -> k, '[]')) loop
        continue when nullif(x ->> 'id', '') is null;
        perform app.brain_put(ws, 'identity', rtrim(case k when 'imagery' then 'image' when 'voice' then 'voice' else k end, 's'),
          'identity', k || ':' || (x ->> 'id'),
          coalesce(x ->> 'name', x ->> 'statement', x ->> 'caption', x ->> 'wordmark', x ->> 'hex'),
          x - 'provenance', x #>> '{provenance,origin}', coalesce(x #>> '{provenance,state}', 'proposed'),
          x #>> '{provenance,confidence}');
        seen := seen || ('identity|' || k || ':' || (x ->> 'id'));
      end loop;
    end loop;
    for x in select * from jsonb_array_elements(coalesce(d.identity #> '{voiceBook,parts}', '[]')) loop
      continue when nullif(x ->> 'id', '') is null;
      perform app.brain_put(ws, 'identity', 'voice_part', 'identity', 'voiceBook:' || (x ->> 'id'),
        coalesce(x ->> 'title', x ->> 'found', x ->> 'id'), x - 'provenance', x #>> '{provenance,origin}',
        coalesce(x #>> '{provenance,state}', 'proposed'));
      seen := seen || ('identity|voiceBook:' || (x ->> 'id'));
    end loop;
    for r in select * from public.brand_rules where brand_dna_version_id = d.id loop
      perform app.brain_put(ws, 'rules', 'rule', 'brand_rules', r.id::text, r.statement,
        jsonb_build_object('area', r.area, 'kind', r.kind), r.origin,
        case when d.state = 'approved' then 'approved' else 'proposed' end, null, r.source_id);
      seen := seen || ('brand_rules|' || r.id);
    end loop;
  end if;

  -- Sources that are not a product's picture.
  for r in select * from public.sources where workspace_id = ws and not (kind = 'packshot' and product_id is not null) loop
    perform app.brain_put(ws, 'sources', 'source', 'sources', r.id::text, r.name,
      jsonb_strip_nulls(jsonb_build_object('kind', r.kind, 'url', r.url, 'file_id', r.file_id, 'read_at', r.retrieved_at)),
      'customer', 'approved', null, null);
    seen := seen || ('sources|' || r.id);
  end loop;

  -- Products, their facts and their pictures.
  for r in select * from public.products where workspace_id = ws loop
    n := app.brain_put(ws, 'products', 'product', 'products', r.id::text, trim(r.name || ' ' || coalesce(r.variant, '')),
      jsonb_strip_nulls(jsonb_build_object('name', r.name, 'variant', nullif(r.variant, ''), 'sku', r.sku, 'kind', r.kind_id,
        'specs', nullif(r.specs, '[]'::jsonb))),
      'customer', case when r.verified_at is not null then 'approved' else 'proposed' end);
    seen := seen || ('products|' || r.id);
  end loop;
  for r in select f.* from public.product_facts f where f.workspace_id = ws and f.superseded_by is null loop
    n := app.brain_put(ws, 'products', 'fact', 'product_facts', r.id::text, r.label || ': ' || r.statement,
      jsonb_build_object('area', r.area, 'label', r.label, 'statement', r.statement, 'required', r.required), r.origin,
      case r.status when 'verified' then 'approved' when 'conflict' then 'contradicted' else 'proposed' end, null, r.source_id);
    seen := seen || ('product_facts|' || r.id);
  end loop;
  for r in select * from public.sources where workspace_id = ws and kind = 'packshot' and product_id is not null loop
    perform app.brain_put(ws, 'products', 'picture', 'sources', r.id::text, r.name,
      jsonb_strip_nulls(jsonb_build_object('slot', r.slot, 'url', r.url, 'file_id', r.file_id)), 'customer', 'approved');
    seen := seen || ('sources|' || r.id);
  end loop;

  -- Creative Memory: campaigns, approvals, change requests and why, expert checks with a note.
  for r in select * from public.campaigns where workspace_id = ws loop
    perform app.brain_put(ws, 'memory', 'campaign', 'campaigns', r.id::text, r.name,
      jsonb_strip_nulls(jsonb_build_object('state', r.state, 'stage', r.stage, 'due_at', r.due_at, 'at', r.created_at)),
      'customer', 'approved');
    seen := seen || ('campaigns|' || r.id);
  end loop;
  for r in select a.*, cr.title, cr.campaign_id, v.number from public.approvals a
           join public.creative_versions v on v.id = a.version_id join public.creatives cr on cr.id = v.creative_id
           where a.workspace_id = ws and a.revoked_at is null loop
    perform app.brain_put(ws, 'memory', 'approval', 'approvals', r.id::text, 'Approved: ' || r.title,
      jsonb_build_object('creative', r.title, 'version', r.number, 'by', app.brain_who(r.decided_by), 'at', r.created_at,
        'campaign_id', r.campaign_id), 'customer', 'approved');
    seen := seen || ('approvals|' || r.id);
  end loop;
  for r in select c.*, cr.title, cr.campaign_id from public.change_requests c
           join public.creative_versions v on v.id = c.version_id join public.creatives cr on cr.id = v.creative_id
           where c.workspace_id = ws loop
    perform app.brain_put(ws, 'memory', 'change', 'change_requests', r.id::text, r.problem,
      jsonb_build_object('creative', r.title, 'cause', r.cause, 'from', r.source, 'must_change', r.must_change,
        'must_stay', r.must_stay, 'by', app.brain_who(r."by"), 'at', r.created_at, 'campaign_id', r.campaign_id),
      case when r.source = 'customer' then 'customer' else 'fume' end, 'approved');
    seen := seen || ('change_requests|' || r.id);
  end loop;
  for r in select e.*, cr.title, cr.campaign_id from public.expert_checks e
           join public.creative_versions v on v.id = e.version_id join public.creatives cr on cr.id = v.creative_id
           where e.workspace_id = ws and e.state <> 'waiting' and nullif(trim(coalesce(e.note, '')), '') is not null loop
    perform app.brain_put(ws, 'memory', 'check', 'expert_checks', r.id::text, r.note,
      jsonb_build_object('creative', r.title, 'state', r.state, 'by', app.brain_who(r.expert_id), 'at', r.decided_at,
        'campaign_id', r.campaign_id), 'fume', 'approved');
    seen := seen || ('expert_checks|' || r.id);
  end loop;

  -- What is gone from its table is gone from the graph (its edges with it).
  delete from public.brain_nodes where workspace_id = ws and ref_table is not null
    and ref_table not in ('taste_variables', 'taste_palette') and not (ref_table || '|' || ref_key = any (seen));

  -- The links the tables give, drawn again.
  delete from public.brain_edges where workspace_id = ws and origin = 'sync';
  insert into public.brain_edges (workspace_id, from_id, to_id, kind)
  select distinct ws, a.id, b.id, l.kind from (
    select 'product_facts' ft, f.id::text fk, 'products' tt, f.product_id::text tk, 'about' kind
      from public.product_facts f where f.workspace_id = ws and f.superseded_by is null
    union all select 'product_facts', f.id::text, 'sources', f.source_id::text, 'from'
      from public.product_facts f where f.workspace_id = ws and f.superseded_by is null and f.source_id is not null
    union all select 'sources', s.id::text, 'products', s.product_id::text, case when s.kind = 'packshot' then 'shows' else 'about' end
      from public.sources s where s.workspace_id = ws and s.product_id is not null
    union all select 'campaigns', cp.campaign_id::text, 'products', cp.product_id::text, 'about'
      from public.campaign_products cp where cp.workspace_id = ws
    union all select 'brand_rules', br.id::text, 'sources', br.source_id::text, 'from'
      from public.brand_rules br where br.workspace_id = ws and br.source_id is not null
    union all select mt, mk, 'campaigns', mc, 'part_of' from (
      select 'approvals' mt, ap.id::text mk, cr.campaign_id::text mc from public.approvals ap
        join public.creative_versions v on v.id = ap.version_id join public.creatives cr on cr.id = v.creative_id
        where ap.workspace_id = ws and ap.revoked_at is null
      union all select 'change_requests', ch.id::text, cr.campaign_id::text from public.change_requests ch
        join public.creative_versions v on v.id = ch.version_id join public.creatives cr on cr.id = v.creative_id
        where ch.workspace_id = ws
      union all select 'expert_checks', e.id::text, cr.campaign_id::text from public.expert_checks e
        join public.creative_versions v on v.id = e.version_id join public.creatives cr on cr.id = v.creative_id
        where e.workspace_id = ws) m
  ) l
  join public.brain_nodes a on a.workspace_id = ws and a.ref_table = l.ft and a.ref_key = l.fk
  join public.brain_nodes b on b.workspace_id = ws and b.ref_table = l.tt and b.ref_key = l.tk
  on conflict (from_id, to_id, kind) do nothing;
  -- Identity items read from the website come from it.
  insert into public.brain_edges (workspace_id, from_id, to_id, kind)
  select ws, i.id, s.id, 'from' from public.brain_nodes i
  join lateral (select src.id from public.brain_nodes src where src.workspace_id = ws and src.kind = 'source' and src.body ->> 'kind' = 'website'
                order by src.created_at limit 1) s on true
  where i.workspace_id = ws and i.layer = 'identity' and i.origin = 'engine'
  on conflict (from_id, to_id, kind) do nothing;

  delete from app.brain_dirty where workspace_id = ws;
end $$;

create or replace function app.engine_brain(ws uuid, p_campaign_id uuid, p_title text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform app.brain_fresh(ws);
  return jsonb_build_object(
    'market', (select jsonb_strip_nulls(jsonb_build_object('market', nullif(w.market, ''), 'language', nullif(w.language, '')))
               from public.workspaces w where w.id = ws),
    'palette', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', n.id, 'name', n.label, 'hex', n.body ->> 'hex',
          'role', n.body ->> 'role', 'use', coalesce(n.body ->> 'usage', n.body ->> 'use'), 'confidence', n.confidence,
          'confirmed', n.state in ('approved', 'changed'))) order by n.label)
      from public.brain_nodes n
      where n.workspace_id = ws and n.layer = 'identity' and n.kind = 'colour' and n.state not in ('removed', 'contradicted')
        and n.body ->> 'hex' ~* '^#[0-9a-f]{6}$'), '[]'),
    'imagery', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'what', n.label, 'confirmed', n.state in ('approved', 'changed')) order by n.created_at)
      from public.brain_nodes n
      where n.workspace_id = ws and n.layer = 'identity' and n.kind = 'image' and n.state not in ('removed', 'contradicted')), '[]'),
    -- Knowledge with no table of its own: what people told Fume about the brand, its market and its pictures.
    'notes', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'layer', n.layer, 'kind', n.kind, 'what', n.label,
          'confirmed', n.state = 'approved') order by n.created_at desc)
      from (select * from public.brain_nodes where workspace_id = ws and ref_table is null
              and layer in ('identity', 'rules', 'market', 'memory', 'products') and state not in ('removed', 'contradicted')
            order by created_at desc limit 20) n), '[]'),
    -- What people asked to change in the brand's other creatives, newest first: this creative's own is the job's change.
    'changes', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', n.id, 'what', n.label, 'cause', n.body ->> 'cause',
          'from', n.body ->> 'from', 'creative', n.body ->> 'creative', 'must_change', n.body -> 'must_change',
          'this_campaign', n.body ->> 'campaign_id' = p_campaign_id::text)) order by n.at desc)
      from (select *, coalesce(body ->> 'at', created_at::text) at from public.brain_nodes
            where workspace_id = ws and layer = 'memory' and kind = 'change'
              and not (body ->> 'campaign_id' = p_campaign_id::text and body ->> 'creative' = p_title)
            order by coalesce(body ->> 'at', created_at::text) desc limit 12) n), '[]'),
    'checks', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'what', n.label, 'state', n.body ->> 'state', 'creative', n.body ->> 'creative') order by n.at desc)
      from (select *, coalesce(body ->> 'at', created_at::text) at from public.brain_nodes
            where workspace_id = ws and layer = 'memory' and kind = 'check'
              and not (body ->> 'campaign_id' = p_campaign_id::text and body ->> 'creative' = p_title)
            order by coalesce(body ->> 'at', created_at::text) desc limit 8) n), '[]')
  );
end $$;
revoke execute on function app.engine_brain(uuid, uuid, text) from public, anon, authenticated;

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
    'brain', app.engine_brain(j.workspace_id, j.campaign_id, cr.title)
  );
end $$;
revoke execute on function public.engine_take(uuid) from public, anon, authenticated;
grant execute on function public.engine_take(uuid) to service_role;

-- The prompt's ledger is kept with it.
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
    attempts, calls, llm_usd, ledger
  ) values (
    a.workspace_id, a.job_id, a.id, coalesce(p_prompt ->> 'hash', ''), p_prompt ->> 'status', p_prompt ->> 'reason',
    coalesce(p_prompt ->> 'image_model', a.model), coalesce(p_prompt -> 'compile_package', '{}'),
    coalesce(p_prompt -> 'slots', '[]'), p_prompt ->> 'text', coalesce(p_prompt -> 'findings', '[]'),
    coalesce(p_prompt -> 'attempts', '[]'), coalesce(p_prompt -> 'calls', '[]'),
    coalesce((p_prompt ->> 'llm_usd')::numeric, 0),
    case when jsonb_typeof(p_prompt -> 'ledger') = 'array' then p_prompt -> 'ledger' else '[]'::jsonb end
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
