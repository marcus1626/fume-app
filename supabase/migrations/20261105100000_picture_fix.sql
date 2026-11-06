-- A surgical fix on a picture (docs/mvp/picture-fix.md; Del 4 of "Fume Engine: statics og grafisk design ferdig").
-- A designer marks a part of a picture the Engine made (the label that reads "Dresemann") and says what is wrong. The
-- edge function `fix` crops that part, has the image model redraw only the crop with the product's own photographs
-- as reference, and sets it back into the picture with a soft edge, so the rest of the picture stays as it was. The
-- result is a new candidate of the same job: the designer takes it as a version, the expert checks it, only the
-- customer approves it. Customers never see a fix or a candidate.
--
--   fix_candidate  designer: ask for the fix on a part of a candidate (answered at once; the function does the work)
--   fix_take       service: what the fix is made from
--   fix_finish     service: the fixed picture becomes a candidate
--   fix_fail       service: why it could not be made

create table public.picture_fixes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- The picture that is fixed, and the job and creative it belongs to.
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  job_id uuid not null references public.production_jobs (id) on delete cascade,
  creative_id uuid references public.creatives (id) on delete cascade,
  state text not null default 'fixing' check (state in ('fixing', 'made', 'failed')),
  -- The part to fix, as shares of the picture from its top left corner, and what is wrong there.
  box jsonb not null,
  ask text not null,
  -- What the image model was asked, with which model; the crop it was given.
  prompt text,
  model text,
  result_candidate_id uuid references public.candidates (id) on delete set null,
  error text,
  cost_cents int not null default 0,
  ms int,
  started_at timestamptz,
  requested_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index picture_fixes_workspace_id_idx on public.picture_fixes (workspace_id);
create index picture_fixes_candidate_id_idx on public.picture_fixes (candidate_id);
create index picture_fixes_job_id_idx on public.picture_fixes (job_id);
create index picture_fixes_creative_id_idx on public.picture_fixes (creative_id);
create index picture_fixes_result_candidate_id_idx on public.picture_fixes (result_candidate_id);
create index picture_fixes_requested_by_idx on public.picture_fixes (requested_by);
alter table public.picture_fixes enable row level security;
create policy picture_fixes_read on public.picture_fixes for select to authenticated using (app.is_staff(workspace_id));
grant select on public.picture_fixes to authenticated;

-- A fixed candidate knows the picture it was fixed from.
alter table public.candidates add column if not exists fixed_from uuid references public.candidates (id) on delete set null;
create index if not exists candidates_fixed_from_idx on public.candidates (fixed_from);

-- The Engine's week counts the fixes too.
create or replace function app.engine_spent_usd() returns numeric
language sql stable security definer set search_path = '' as $$
  select (
    coalesce((select sum(a.cost_cents) from public.job_attempts a
      where a.provider <> 'manual' and a.started_at > now() - interval '7 days'), 0)
    + coalesce((select sum(x.cost_cents) from public.picture_fixes x where x.created_at > now() - interval '7 days'), 0)
  )::numeric / 100
$$;
revoke execute on function app.engine_spent_usd() from public, anon, authenticated;

-- A designer asks for the fix. On a designed candidate the picture under the words is fixed (the words are laid on it
-- again after). One fix is made on a picture at a time; asking while one is being made returns it.
create or replace function public.fix_candidate(p_candidate_id uuid, p_box jsonb, p_ask text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c public.candidates;
  j public.production_jobs;
  x public.picture_fixes;
  b_x numeric; b_y numeric; b_w numeric; b_h numeric;
  ask text := nullif(left(trim(coalesce(p_ask, '')), 1000), '');
begin
  perform app.require_user();
  select * into c from public.candidates where id = p_candidate_id;
  if not found or not app.is_staff(c.workspace_id) then perform app.fail('not_found', 'No such candidate.'); end if;
  if not app.is_staff(c.workspace_id, array['designer']) then
    perform app.fail('forbidden', 'Only a designer asks Fume to fix a picture.');
  end if;
  if c.designed_from is not null then
    select * into c from public.candidates where id = c.designed_from;
  end if;
  if not exists (select 1 from public.files f where f.id = c.file_id and f.content_type like 'image/%') then
    perform app.fail('invalid', 'A fix is made on a picture.');
  end if;
  if ask is null then perform app.fail('invalid', 'Say what is wrong in the part you marked.'); end if;
  if jsonb_typeof(p_box) is distinct from 'object'
     or jsonb_typeof(p_box -> 'x') is distinct from 'number' or jsonb_typeof(p_box -> 'y') is distinct from 'number'
     or jsonb_typeof(p_box -> 'w') is distinct from 'number' or jsonb_typeof(p_box -> 'h') is distinct from 'number' then
    perform app.fail('invalid', 'Mark the part to fix.');
  end if;
  b_x := (p_box ->> 'x')::numeric; b_y := (p_box ->> 'y')::numeric; b_w := (p_box ->> 'w')::numeric; b_h := (p_box ->> 'h')::numeric;
  if b_x < 0 or b_y < 0 or b_w < 0.02 or b_h < 0.02 or b_x + b_w > 1.0001 or b_y + b_h > 1.0001 then
    perform app.fail('invalid', 'The part to fix lies inside the picture.');
  end if;
  -- A fix redraws a part; a change to most of the picture is a new picture (Render with words).
  if b_w * b_h > 0.5 then perform app.fail('invalid', 'Mark a smaller part, or render the picture again with your words.'); end if;
  select * into x from public.picture_fixes
  where candidate_id = c.id and state = 'fixing' and created_at > now() - interval '5 minutes'
  order by created_at desc limit 1;
  if found then return to_jsonb(x); end if;
  if not (public.fume_engine_budget() ->> 'allowed')::boolean then
    perform app.fail('budget', 'This week''s budget for the Engine is used up.');
  end if;
  select * into j from public.production_jobs where id = c.job_id;
  insert into public.picture_fixes (workspace_id, candidate_id, job_id, creative_id, box, ask, requested_by)
  values (c.workspace_id, c.id, j.id, j.creative_id, jsonb_build_object('x', b_x, 'y', b_y, 'w', b_w, 'h', b_h), ask, auth.uid())
  returning * into x;
  perform app.record(c.workspace_id, 'fix.asked', 'candidate', c.id, jsonb_build_object('fix_id', x.id));
  return to_jsonb(x);
end $$;
revoke execute on function public.fix_candidate(uuid, jsonb, text) from public, anon;
grant execute on function public.fix_candidate(uuid, jsonb, text) to authenticated;

-- What the fix is made from: the picture, the part and what is wrong there, the products in the job with their own
-- photographs, and where the result is stored. Null when there is nothing to do or it is being made right now.
create or replace function public.fix_take(p_fix_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  x public.picture_fixes;
  c public.candidates;
  f public.files;
  j public.production_jobs;
  w public.workspaces;
begin
  select * into x from public.picture_fixes where id = p_fix_id for update;
  if not found or x.state <> 'fixing' then return null; end if;
  if x.started_at is not null and x.started_at > now() - interval '4 minutes' then return null; end if;
  if not (public.fume_engine_budget() ->> 'allowed')::boolean then
    update public.picture_fixes set state = 'failed', error = 'This week''s budget for the Engine is used up.', finished_at = now()
    where id = x.id;
    return null;
  end if;
  select * into c from public.candidates where id = x.candidate_id;
  select * into f from public.files where id = c.file_id;
  select * into j from public.production_jobs where id = x.job_id;
  select * into w from public.workspaces where id = x.workspace_id;
  update public.picture_fixes set started_at = now() where id = x.id;
  return jsonb_build_object(
    'fix_id', x.id, 'workspace_id', x.workspace_id, 'box', x.box, 'ask', x.ask,
    'brand', jsonb_build_object('name', w.brand_name, 'language', w.language),
    'picture', jsonb_build_object('bucket', f.bucket, 'path', f.path, 'width', f.width, 'height', f.height),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', pr.name, 'variant', nullif(pr.variant, ''),
        'pictures', coalesce((
          select jsonb_agg(jsonb_build_object('bucket', y.bucket, 'path', y.path))
          from (
            select fi.bucket, fi.path from public.sources so join public.files fi on fi.id = so.file_id
            where so.product_id = pr.id and so.kind = 'packshot' and fi.content_type like 'image/%'
            order by so.created_at desc limit 3
          ) y), '[]')
      ) order by pr.name)
      from public.campaign_products cp join public.products pr on pr.id = cp.product_id
      where cp.campaign_id = j.campaign_id), '[]'),
    'store', jsonb_build_object('bucket', 'workspace-files',
      'png', x.workspace_id || '/fix/' || x.id || '.png', 'crop', x.workspace_id || '/fix/' || x.id || '-crop.png')
  );
end $$;

-- The fixed picture: a new candidate of the same job, made by the designer who asked.
create or replace function public.fix_finish(p_fix_id uuid, p_result jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  x public.picture_fixes;
  png public.files;
  c public.candidates;
  r jsonb := coalesce(p_result, '{}');
begin
  select * into x from public.picture_fixes where id = p_fix_id for update;
  if not found or x.state <> 'fixing' then perform app.fail('conflict', 'This fix is no longer being made.'); end if;
  if r #>> '{png,path}' is distinct from x.workspace_id || '/fix/' || x.id || '.png' then
    perform app.fail('invalid', 'The fix is stored where fix_take said.');
  end if;
  insert into public.files (workspace_id, path, name, content_type, bytes, sha256, width, height, purpose, uploaded_by)
  values (x.workspace_id, r #>> '{png,path}', 'Fixed picture.png', 'image/png',
    coalesce((r #>> '{png,bytes}')::bigint, 0), r #>> '{png,sha256}', (r ->> 'width')::int, (r ->> 'height')::int,
    'candidate', x.requested_by)
  returning * into png;
  insert into public.candidates (workspace_id, job_id, file_id, origin, note, made_by, fixed_from)
  values (x.workspace_id, x.job_id, png.id, 'engine', left('Fixed by Fume: ' || x.ask, 500), x.requested_by, x.candidate_id)
  returning * into c;
  update public.picture_fixes set state = 'made', prompt = r ->> 'prompt', model = r ->> 'model',
    cost_cents = coalesce((r ->> 'cost_cents')::int, 0), ms = (r ->> 'ms')::int, result_candidate_id = c.id,
    error = null, finished_at = now()
  where id = x.id;
  perform app.record(x.workspace_id, 'candidate.added', 'candidate', c.id,
    jsonb_build_object('origin', 'fix', 'from', x.candidate_id));
  return jsonb_build_object('candidate_id', c.id, 'fix_id', x.id);
end $$;

create or replace function public.fix_fail(p_fix_id uuid, p_error text, p_cost_cents int default 0) returns void
language sql security definer set search_path = '' as $$
  update public.picture_fixes set state = 'failed', error = left(p_error, 2000),
    cost_cents = cost_cents + coalesce(p_cost_cents, 0), finished_at = now()
  where id = p_fix_id and state = 'fixing'
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.fix_take(uuid)', 'public.fix_finish(uuid, jsonb)', 'public.fix_fail(uuid, text, int)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
