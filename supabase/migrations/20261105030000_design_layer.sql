-- The graphic design layer (docs/mvp/design-layer.md; Del 3 of "Fume Engine: statics og grafisk design ferdig").
-- A designer asks Fume to lay the plan's words on a picture the Engine (or a person) made. The edge function
-- `design` has the model look at the picture and choose, by name only, from the brand's approved design system;
-- the design service (OpenPencil, services/design) lays it out and checks it by code. The result is a new candidate
-- of the same job, with its editable design document beside it: the designer takes it as a version like any other,
-- the expert checks it, only the customer approves it. Customers never see a layer or a candidate.
--
--   design_candidate  designer: ask for the layer on a candidate (answered at once; the function does the work)
--   design_take       service: what the layer is made from
--   design_finish     service: the designed picture and its document become a candidate
--   design_fail       service: why it could not be made

create table public.design_layers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- The picture the words go on, and the job and creative it belongs to.
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  job_id uuid not null references public.production_jobs (id) on delete cascade,
  creative_id uuid references public.creatives (id) on delete cascade,
  state text not null default 'designing' check (state in ('designing', 'made', 'failed')),
  ask text,
  -- The design system it was made from.
  book_id uuid references public.brand_books (id) on delete set null,
  book_version int,
  -- What the model chose and the words it took from the plan; what code laid out and measured.
  choice jsonb,
  words jsonb,
  layout jsonb,
  checks jsonb not null default '[]',
  attempts jsonb not null default '[]',
  -- What Fume's look at the finished layout found, for the expert.
  findings jsonb not null default '[]',
  result_candidate_id uuid references public.candidates (id) on delete set null,
  document_file_id uuid references public.files (id) on delete set null,
  error text,
  llm_usd numeric(10, 4) not null default 0,
  ms int,
  started_at timestamptz,
  requested_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index design_layers_workspace_id_idx on public.design_layers (workspace_id);
create index design_layers_candidate_id_idx on public.design_layers (candidate_id);
create index design_layers_job_id_idx on public.design_layers (job_id);
create index design_layers_creative_id_idx on public.design_layers (creative_id);
create index design_layers_book_id_idx on public.design_layers (book_id);
create index design_layers_result_candidate_id_idx on public.design_layers (result_candidate_id);
create index design_layers_document_file_id_idx on public.design_layers (document_file_id);
create index design_layers_requested_by_idx on public.design_layers (requested_by);
alter table public.design_layers enable row level security;
create policy design_layers_read on public.design_layers for select to authenticated using (app.is_staff(workspace_id));
grant select on public.design_layers to authenticated;

-- A designed candidate knows the picture under it.
alter table public.candidates add column if not exists designed_from uuid references public.candidates (id) on delete set null;
create index if not exists candidates_designed_from_idx on public.candidates (designed_from);

-- The language model's week counts the design layer's looks too.
create or replace function public.fume_llm_budget() returns jsonb
language sql stable security definer set search_path = '' as $$
  with spent as (
    select (
      coalesce((select sum(cost_usd) from public.task_runs where started_at > now() - interval '7 days'), 0)
      + coalesce((select sum(llm_usd) from public.engine_prompts where created_at > now() - interval '7 days'), 0)
      + coalesce((select sum(llm_usd) from public.engine_lessons where updated_at > now() - interval '7 days'), 0)
      + coalesce((select sum(evaluation_usd) from public.candidates where created_at > now() - interval '7 days'), 0)
      + coalesce((select sum(llm_usd) from public.brand_books where created_at > now() - interval '7 days'), 0)
      + coalesce((select sum(llm_usd) from public.design_layers where created_at > now() - interval '7 days'), 0)
    )::numeric as usd
  ), cap as (
    select coalesce((select (value #>> '{}')::numeric from app.settings where key = 'llm_week_usd'), 0) as usd
  )
  select jsonb_build_object('spent_usd', spent.usd, 'cap_usd', cap.usd, 'allowed', spent.usd < cap.usd) from spent, cap
$$;
revoke execute on function public.fume_llm_budget() from public, anon, authenticated;
grant execute on function public.fume_llm_budget() to service_role;

-- A designer asks for the layer. On a designed candidate it is made again from the picture under it. One layer is
-- made on a picture at a time; asking while one is being made returns it.
create or replace function public.design_candidate(p_candidate_id uuid, p_ask text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c public.candidates;
  j public.production_jobs;
  l public.design_layers;
begin
  perform app.require_user();
  select * into c from public.candidates where id = p_candidate_id;
  if not found or not app.is_staff(c.workspace_id) then perform app.fail('not_found', 'No such candidate.'); end if;
  if not app.is_staff(c.workspace_id, array['designer']) then
    perform app.fail('forbidden', 'Only a designer asks Fume for the graphic design.');
  end if;
  if c.designed_from is not null then
    select * into c from public.candidates where id = c.designed_from;
  end if;
  if not exists (select 1 from public.files f where f.id = c.file_id and f.content_type like 'image/%') then
    perform app.fail('invalid', 'Graphic design goes on a picture.');
  end if;
  if app.brand_book_in_use(c.workspace_id, 'design') is null then
    perform app.fail('invalid', 'The brand has no design system yet. Ask Fume to write one first.');
  end if;
  select * into l from public.design_layers
  where candidate_id = c.id and state = 'designing' and created_at > now() - interval '5 minutes'
  order by created_at desc limit 1;
  if found then return to_jsonb(l); end if;
  if not (public.fume_llm_budget() ->> 'allowed')::boolean then
    perform app.fail('budget', 'This week''s budget for Fume''s language model is used up.');
  end if;
  select * into j from public.production_jobs where id = c.job_id;
  insert into public.design_layers (workspace_id, candidate_id, job_id, creative_id, ask, requested_by)
  values (c.workspace_id, c.id, j.id, j.creative_id, nullif(left(trim(coalesce(p_ask, '')), 1000), ''), auth.uid())
  returning * into l;
  perform app.record(c.workspace_id, 'design.asked', 'candidate', c.id, jsonb_build_object('layer_id', l.id));
  return to_jsonb(l);
end $$;
revoke execute on function public.design_candidate(uuid, text) from public, anon;
grant execute on function public.design_candidate(uuid, text) to authenticated;

-- What the layer is made from: the picture, the creative and its words in the approved plan, the products, the brand's
-- design system (approved, else checked, else draft), and where the result is stored. Null when there is nothing to
-- do or it is being made right now.
create or replace function public.design_take(p_layer_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  l public.design_layers;
  c public.candidates;
  f public.files;
  j public.production_jobs;
  cr public.creatives;
  s public.context_snapshots;
  w public.workspaces;
  plan jsonb;
  planned jsonb;
  book jsonb;
begin
  select * into l from public.design_layers where id = p_layer_id for update;
  if not found or l.state <> 'designing' then return null; end if;
  if l.started_at is not null and l.started_at > now() - interval '4 minutes' then return null; end if;
  if not (public.fume_llm_budget() ->> 'allowed')::boolean then
    update public.design_layers set state = 'failed', error = 'This week''s budget for Fume''s language model is used up.',
      finished_at = now() where id = l.id;
    return null;
  end if;
  book := app.brand_book_in_use(l.workspace_id, 'design');
  if book is null then
    update public.design_layers set state = 'failed', error = 'The brand has no design system.', finished_at = now() where id = l.id;
    return null;
  end if;
  select * into c from public.candidates where id = l.candidate_id;
  select * into f from public.files where id = c.file_id;
  select * into j from public.production_jobs where id = l.job_id;
  select * into cr from public.creatives where id = l.creative_id;
  select * into s from public.context_snapshots where id = j.snapshot_id;
  select * into w from public.workspaces where id = l.workspace_id;
  select body into plan from public.plan_versions where id = s.plan_version_id;
  select x into planned
  from jsonb_array_elements(coalesce(plan -> 'directions', '[]')) d, jsonb_array_elements(coalesce(d -> 'creatives', '[]')) x
  where d ->> 'id' = coalesce(plan ->> 'chosen_direction_id', d ->> 'id') and x ->> 'id' = cr.slot
  limit 1;
  update public.design_layers set started_at = now(), book_id = (book ->> 'id')::uuid, book_version = (book ->> 'version')::int
  where id = l.id;
  return jsonb_build_object(
    'layer_id', l.id, 'workspace_id', l.workspace_id, 'ask', l.ask,
    'brand', jsonb_build_object('name', w.brand_name, 'language', w.language, 'market', w.market),
    'picture', jsonb_build_object('bucket', f.bucket, 'path', f.path, 'width', f.width, 'height', f.height),
    'creative', jsonb_build_object('id', cr.id, 'title', cr.title, 'format', coalesce(cr.format, 'feed'), 'slot', cr.slot),
    'planned', coalesce(planned, '{}'),
    'copy', coalesce(plan -> 'content', '[]'),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object('name', pr.name, 'variant', nullif(pr.variant, '')) order by pr.name)
      from public.campaign_products cp join public.products pr on pr.id = cp.product_id
      where cp.campaign_id = j.campaign_id), '[]'),
    'book', jsonb_build_object('id', book -> 'id', 'version', book -> 'version', 'state', book -> 'state',
      'body', (book -> 'body') - 'sources' - 'gaps' - 'parts' - 'css' - 'tokens'),
    'store', jsonb_build_object('bucket', 'workspace-files',
      'png', l.workspace_id || '/design/' || l.id || '.png', 'fig', l.workspace_id || '/design/' || l.id || '.fig')
  );
end $$;

-- The designed picture and its document: a new candidate of the same job, made by the designer who asked.
create or replace function public.design_finish(p_layer_id uuid, p_result jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  l public.design_layers;
  j public.production_jobs;
  png public.files;
  doc public.files;
  c public.candidates;
  r jsonb := coalesce(p_result, '{}');
begin
  select * into l from public.design_layers where id = p_layer_id for update;
  if not found or l.state <> 'designing' then perform app.fail('conflict', 'This layer is no longer being made.'); end if;
  if r #>> '{png,path}' is distinct from l.workspace_id || '/design/' || l.id || '.png'
     or r #>> '{fig,path}' is distinct from l.workspace_id || '/design/' || l.id || '.fig' then
    perform app.fail('invalid', 'The layer is stored where design_take said.');
  end if;
  if jsonb_typeof(r -> 'words') is distinct from 'object' or nullif(r #>> '{words,headline}', '') is null then
    perform app.fail('invalid', 'A layer has the words it laid out.');
  end if;
  select * into j from public.production_jobs where id = l.job_id;
  insert into public.files (workspace_id, path, name, content_type, bytes, sha256, width, height, purpose, uploaded_by)
  values (l.workspace_id, r #>> '{png,path}', coalesce(r ->> 'name', 'Graphic design') || '.png', 'image/png',
    coalesce((r #>> '{png,bytes}')::bigint, 0), r #>> '{png,sha256}', (r ->> 'width')::int, (r ->> 'height')::int,
    'candidate', l.requested_by)
  returning * into png;
  insert into public.files (workspace_id, path, name, content_type, bytes, sha256, purpose, uploaded_by)
  values (l.workspace_id, r #>> '{fig,path}', coalesce(r ->> 'name', 'Graphic design') || '.fig', 'application/octet-stream',
    coalesce((r #>> '{fig,bytes}')::bigint, 0), r #>> '{fig,sha256}', 'candidate', l.requested_by)
  returning * into doc;
  insert into public.candidates (workspace_id, job_id, file_id, origin, note, made_by, designed_from)
  values (l.workspace_id, l.job_id, png.id, 'engine', 'Graphic design by Fume from the brand''s design system', l.requested_by,
    l.candidate_id)
  returning * into c;
  update public.design_layers set state = 'made', choice = r -> 'choice', words = r -> 'words', layout = r -> 'layout',
    checks = coalesce(r -> 'checks', '[]'), attempts = coalesce(r -> 'attempts', '[]'), findings = coalesce(r -> 'findings', '[]'),
    result_candidate_id = c.id, document_file_id = doc.id, llm_usd = coalesce((r ->> 'llm_usd')::numeric, 0),
    ms = (r ->> 'ms')::int, error = null, finished_at = now()
  where id = l.id;
  perform app.record(l.workspace_id, 'candidate.added', 'candidate', c.id,
    jsonb_build_object('origin', 'design', 'from', l.candidate_id, 'ok', coalesce((r ->> 'ok')::boolean, false)));
  return jsonb_build_object('candidate_id', c.id, 'layer_id', l.id);
end $$;

create or replace function public.design_fail(p_layer_id uuid, p_error text, p_llm_usd numeric default 0) returns void
language sql security definer set search_path = '' as $$
  update public.design_layers set state = 'failed', error = left(p_error, 2000), llm_usd = llm_usd + coalesce(p_llm_usd, 0),
    finished_at = now()
  where id = p_layer_id and state = 'designing'
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.design_take(uuid)', 'public.design_finish(uuid, jsonb)', 'public.design_fail(uuid, text, numeric)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
