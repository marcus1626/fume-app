-- A format made from the master's own picture (docs/mvp/formats.md): the approved master's picture is cropped to the
-- new shape when the product fits, or expanded (the image model draws only the new edges and every pixel of the
-- master is set back as it was). The product stays the product the customer approved. The Engine chooses, says why,
-- and the designer can switch (FLOWS §15, FormatTile). The result is a candidate of the format creative's job, and goes
-- to the expert's check like any other picture. Staff only; customers never see it before it is checked.

create table public.format_makes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  creative_id uuid not null references public.creatives (id) on delete cascade,
  job_id uuid not null references public.production_jobs (id) on delete cascade,
  master_version_id uuid not null references public.creative_versions (id),
  -- null: the Engine chooses; crop or expand: the designer chose.
  asked text check (asked in ('crop', 'expand')),
  method text check (method in ('crop', 'expand')),
  why text,
  "window" jsonb,
  state text not null default 'making' check (state in ('making', 'made', 'failed')),
  prompt text,
  model text,
  cost_cents int not null default 0 check (cost_cents >= 0),
  llm_usd numeric(10, 6) not null default 0 check (llm_usd >= 0),
  ms int,
  error text,
  result_candidate_id uuid references public.candidates (id) on delete set null,
  started_at timestamptz,
  requested_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index format_makes_creative on public.format_makes (creative_id, created_at desc);
create index format_makes_job on public.format_makes (job_id);
create index format_makes_requested_by on public.format_makes (requested_by);
create index format_makes_master_version on public.format_makes (master_version_id);
create index format_makes_result on public.format_makes (result_candidate_id);
alter table public.format_makes enable row level security;
create policy format_makes_read on public.format_makes for select to authenticated using (app.is_staff(workspace_id));
grant select on public.format_makes to authenticated;

-- The Engine's week counts formats too.
create or replace function app.engine_spent_usd() returns numeric
language sql stable security definer set search_path = '' as $$
  select (
    coalesce((select sum(a.cost_cents) from public.job_attempts a
      where a.provider <> 'manual' and a.started_at > now() - interval '7 days'), 0)
    + coalesce((select sum(x.cost_cents) from public.picture_fixes x where x.created_at > now() - interval '7 days'), 0)
    + coalesce((select sum(m.cost_cents) from public.format_makes m where m.created_at > now() - interval '7 days'), 0)
  )::numeric / 100
$$;
revoke execute on function app.engine_spent_usd() from public, anon, authenticated;

-- A designer asks for the format: the format creative's job (opened here when none is open), and the make.
-- p_window: the designer's own crop window on the master (shares, 0 to 1), with p_method crop.
create or replace function public.make_format(p_creative_id uuid, p_method text default null, p_window jsonb default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  cr public.creatives;
  mv public.creative_versions;
  j public.production_jobs;
  x public.format_makes;
begin
  perform app.require_user();
  select * into cr from public.creatives where id = p_creative_id for update;
  if not found or not app.can_read(cr.workspace_id) then perform app.fail('not_found', 'No such creative.'); end if;
  if not app.is_staff(cr.workspace_id, array['designer']) then perform app.fail('forbidden', 'Only a designer makes a format.'); end if;
  if cr.kind <> 'format' then perform app.fail('invalid', 'Only a format is made from its master.'); end if;
  if p_method is not null and p_method not in ('crop', 'expand') then perform app.fail('invalid', 'Crop or expand.'); end if;
  if p_window is not null and (p_method is distinct from 'crop' or jsonb_typeof(p_window) <> 'object'
      or not ((p_window ->> 'x')::numeric >= 0 and (p_window ->> 'y')::numeric >= 0
        and (p_window ->> 'w')::numeric > 0.1 and (p_window ->> 'h')::numeric > 0.1
        and (p_window ->> 'x')::numeric + (p_window ->> 'w')::numeric <= 1.0001
        and (p_window ->> 'y')::numeric + (p_window ->> 'h')::numeric <= 1.0001)) then
    perform app.fail('invalid', 'A crop window lies inside the master.');
  end if;
  if (app.latest_version(cr.id)).id is not null then
    perform app.fail('conflict', 'This format has a version already. A new one follows the expert''s correction.');
  end if;
  mv := app.approved_master_version(cr.master_id);
  if mv.id is null then perform app.fail('invalid', 'Formats need an approved master.'); end if;
  select * into x from public.format_makes
  where creative_id = cr.id and state = 'making' and created_at > now() - interval '5 minutes'
    and asked is not distinct from p_method and "window" is not distinct from p_window
  order by created_at desc limit 1;
  if found then return to_jsonb(x); end if;
  if not (public.fume_engine_budget() ->> 'allowed')::boolean then
    perform app.fail('unavailable', 'This week''s budget for the Engine''s pictures is used up.');
  end if;
  select * into j from public.production_jobs pj
  where pj.creative_id = cr.id and pj.kind = 'format' and pj.state <> 'cancelled'
    and not exists (select 1 from public.creative_versions v where v.job_id = pj.id)
  order by pj.created_at desc limit 1;
  if not found then
    select * into j from jsonb_populate_record(null::public.production_jobs, public.start_job(
      cr.campaign_id, 'format',
      jsonb_build_object('provider', 'format', 'creative', cr.title, 'format', cr.format),
      '[]', cr.id, mv.id, 'manual', null));
    update public.production_jobs set creative_id = cr.id where id = j.id returning * into j;
  end if;
  insert into public.format_makes (workspace_id, creative_id, job_id, master_version_id, asked, "window", requested_by)
  values (cr.workspace_id, cr.id, j.id, mv.id, p_method, p_window, auth.uid())
  returning * into x;
  perform app.record(cr.workspace_id, 'format.asked', 'creative', cr.id, jsonb_build_object('make', x.id, 'method', p_method));
  return to_jsonb(x);
end $$;
revoke execute on function public.make_format(uuid, text, jsonb) from public, anon;
grant execute on function public.make_format(uuid, text, jsonb) to authenticated;

-- What the function needs: the master's approved picture (under its words, when designed: the format gets its own
-- words), the shape to make, and where to store it.
create or replace function public.format_take(p_make_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  x public.format_makes;
  mv public.creative_versions;
  c public.candidates;
  f public.files;
  cr public.creatives;
  w public.workspaces;
begin
  select * into x from public.format_makes where id = p_make_id for update;
  if not found or x.state <> 'making' then return null; end if;
  if x.started_at is not null and x.started_at > now() - interval '4 minutes' then return null; end if;
  select * into mv from public.creative_versions where id = x.master_version_id;
  select * into c from public.candidates where id = mv.candidate_id;
  if c.designed_from is not null then select * into c from public.candidates where id = c.designed_from; end if;
  select * into f from public.files where id = coalesce(c.file_id, mv.file_id);
  select * into cr from public.creatives where id = x.creative_id;
  select * into w from public.workspaces where id = x.workspace_id;
  if f.id is null then
    update public.format_makes set state = 'failed', error = 'The master has no picture to make it from.', finished_at = now() where id = x.id;
    return null;
  end if;
  update public.format_makes set started_at = now() where id = x.id;
  return jsonb_build_object(
    'make_id', x.id, 'workspace_id', x.workspace_id, 'asked', x.asked, 'window', x."window", 'format', cr.format,
    'brand', jsonb_build_object('name', w.brand_name),
    'picture', jsonb_build_object('bucket', f.bucket, 'path', f.path, 'width', f.width, 'height', f.height),
    'store', jsonb_build_object('bucket', 'workspace-files', 'prefix', x.workspace_id || '/format/' || x.id));
end $$;

-- The made format: its file and a candidate of the format creative's job.
create or replace function public.format_finish(p_make_id uuid, p_result jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  x public.format_makes;
  png public.files;
  c public.candidates;
  r jsonb := coalesce(p_result, '{}');
begin
  select * into x from public.format_makes where id = p_make_id for update;
  if not found or x.state <> 'making' then perform app.fail('conflict', 'This format is no longer being made.'); end if;
  if r #>> '{png,path}' is distinct from x.workspace_id || '/format/' || x.id || '.png' then
    perform app.fail('invalid', 'The format is stored where format_take said.');
  end if;
  if r ->> 'method' not in ('crop', 'expand') then perform app.fail('invalid', 'Crop or expand.'); end if;
  insert into public.files (workspace_id, path, name, content_type, bytes, sha256, width, height, purpose, uploaded_by)
  values (x.workspace_id, r #>> '{png,path}', 'Format from the master.png', 'image/png',
    coalesce((r #>> '{png,bytes}')::bigint, 0), r #>> '{png,sha256}', (r ->> 'width')::int, (r ->> 'height')::int,
    'candidate', x.requested_by)
  returning * into png;
  insert into public.candidates (workspace_id, job_id, file_id, origin, note, made_by)
  values (x.workspace_id, x.job_id, png.id, 'engine',
    left(case r ->> 'method' when 'crop' then 'Cropped from the master: ' else 'Expanded from the master: ' end || coalesce(r ->> 'why', ''), 500),
    x.requested_by)
  returning * into c;
  update public.format_makes set state = 'made', method = r ->> 'method', why = left(r ->> 'why', 500), "window" = r -> 'window',
    prompt = r ->> 'prompt', model = r ->> 'model', cost_cents = coalesce((r ->> 'cost_cents')::int, 0),
    llm_usd = greatest(coalesce((r ->> 'llm_usd')::numeric, 0), 0), ms = (r ->> 'ms')::int,
    result_candidate_id = c.id, error = null, finished_at = now()
  where id = x.id;
  update public.production_jobs set state = 'succeeded', updated_at = now() where id = x.job_id and state <> 'succeeded';
  perform app.record(x.workspace_id, 'candidate.added', 'candidate', c.id, jsonb_build_object('origin', 'format', 'method', r ->> 'method'));
  return jsonb_build_object('candidate_id', c.id, 'make_id', x.id);
end $$;

create or replace function public.format_fail(p_make_id uuid, p_error text, p_cost_cents int default 0, p_llm_usd numeric default 0) returns void
language plpgsql security definer set search_path = '' as $$
declare
  x public.format_makes;
begin
  update public.format_makes set state = 'failed', error = left(p_error, 2000),
    cost_cents = cost_cents + greatest(coalesce(p_cost_cents, 0), 0), llm_usd = llm_usd + greatest(coalesce(p_llm_usd, 0), 0),
    finished_at = now()
  where id = p_make_id and state = 'making'
  returning * into x;
  -- The open Studio reads again, and shows why.
  if found then perform app.record(x.workspace_id, 'format.failed', 'creative', x.creative_id, jsonb_build_object('make', x.id)); end if;
end $$;

revoke execute on function public.format_take(uuid) from public, anon, authenticated;
revoke execute on function public.format_finish(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.format_fail(uuid, text, int, numeric) from public, anon, authenticated;
grant execute on function public.format_take(uuid), public.format_finish(uuid, jsonb), public.format_fail(uuid, text, int, numeric) to service_role;

-- The language model's week counts what choosing the method cost.
create or replace function public.fume_llm_budget() returns jsonb
language sql stable security definer set search_path = '' as $$
  with spent as (
    select (
      coalesce((select sum(cost_usd) from public.task_runs where started_at > now() - interval '7 days'), 0)
      + coalesce((select sum(llm_usd) from public.engine_prompts where created_at > now() - interval '7 days'), 0)
      + coalesce((select sum(llm_usd) from public.engine_lessons where updated_at > now() - interval '7 days'), 0)
      + coalesce((select coalesce(sum(evaluation_usd), 0) + coalesce(sum(details_usd), 0) from public.candidates where created_at > now() - interval '7 days'), 0)
      + coalesce((select sum(llm_usd) from public.brand_books where created_at > now() - interval '7 days'), 0)
      + coalesce((select sum(llm_usd) from public.design_layers where created_at > now() - interval '7 days'), 0)
      + coalesce((select sum(llm_usd) from public.picture_fixes where created_at > now() - interval '7 days'), 0)
      + coalesce((select sum(llm_usd) from public.format_makes where created_at > now() - interval '7 days'), 0)
    )::numeric as usd
  ), cap as (
    select coalesce((select (value #>> '{}')::numeric from app.settings where key = 'llm_week_usd'), 0) as usd
  )
  select jsonb_build_object('spent_usd', spent.usd, 'cap_usd', cap.usd, 'allowed', spent.usd < cap.usd) from spent, cap
$$;

-- The parts of a format (the padded picture and what the image model drew) are staff-only reads, like a fix's.
create or replace function app.can_read_object(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.files f where f.path = p_name and app.can_read_file(f.id))
    or (p_name ~ '^[0-9a-f-]{36}/fix/[0-9a-f-]{36}-(crop|ref|redrawn)\.png$' and exists (
      select 1 from public.picture_fixes x
      where x.workspace_id::text = split_part(p_name, '/', 1)
        and x.id::text = substring(split_part(p_name, '/', 3) from 1 for 36)
        and app.is_staff(x.workspace_id)))
    or (p_name ~ '^[0-9a-f-]{36}/check/[0-9a-f-]{36}-[0-9]+(-ref)?\.png$' and exists (
      select 1 from public.candidates c
      where c.workspace_id::text = split_part(p_name, '/', 1)
        and c.id::text = substring(split_part(p_name, '/', 3) from 1 for 36)
        and app.is_staff(c.workspace_id)))
    or (p_name ~ '^[0-9a-f-]{36}/format/[0-9a-f-]{36}-(padded|drawn)\.png$' and exists (
      select 1 from public.format_makes x
      where x.workspace_id::text = split_part(p_name, '/', 1)
        and x.id::text = substring(split_part(p_name, '/', 3) from 1 for 36)
        and app.is_staff(x.workspace_id)))
$$;
