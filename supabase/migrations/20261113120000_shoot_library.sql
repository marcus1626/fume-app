-- FLOWS §38: originals stay in workspace-files. Rights belong to the whole shoot.
-- No service_role table grants: edge workers enter only through the explicitly granted functions below.
create table public.shoots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  shot_on date,
  photographer text,
  usable_until date,
  people text not null check (people in ('none', 'released', 'unsure')),
  consent_yes boolean not null,
  rights_by uuid not null references public.profiles(id),
  rights_at timestamptz not null default now(),
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  state text not null default 'reading' check (state in ('reading', 'read', 'checked')),
  checked_by uuid references public.profiles(id),
  checked_at timestamptz,
  unique(id, workspace_id),
  check (consent_yes = (people = 'released')),
  check ((state = 'checked') = (checked_by is not null and checked_at is not null))
);
create index shoots_workspace on public.shoots(workspace_id, created_at desc, id);
-- A composite key prevents an original from another workspace being attached.
alter table public.files add constraint files_id_workspace_unique unique(id, workspace_id);
create table public.shoot_pictures (
  id uuid primary key default gen_random_uuid(),
  shoot_id uuid not null,
  workspace_id uuid not null,
  file_id uuid not null unique,
  number int not null check (number > 0),
  kind text not null check (kind in ('photo', 'clip')),
  seconds numeric check (seconds >= 0),
  engine_read jsonb check (engine_read is null or (jsonb_typeof(engine_read) = 'object'
    and engine_read ->> 'sort' in ('pick', 'rest', 'out') and engine_read ? 'why' and engine_read ? 'sharp')),
  moved_sort text check (moved_sort in ('pick', 'rest', 'out')),
  moved_by uuid references public.profiles(id),
  moved_at timestamptz,
  foreign key(shoot_id, workspace_id) references public.shoots(id, workspace_id) on delete cascade,
  foreign key(file_id, workspace_id) references public.files(id, workspace_id),
  unique(shoot_id, number),
  check (kind <> 'clip' or (coalesce(moved_sort, engine_read ->> 'sort', 'rest') <> 'pick'))
);
create index shoot_pictures_workspace on public.shoot_pictures(workspace_id);
create table public.shoot_uses (
  picture_id uuid not null references public.shoot_pictures(id),
  creative_id uuid not null references public.creatives(id),
  created_at timestamptz not null default now(),
  primary key(picture_id, creative_id)
);
alter table public.shoots enable row level security;
alter table public.shoot_pictures enable row level security;
alter table public.shoot_uses enable row level security;
create policy shoots_read on public.shoots for select to authenticated using(app.can_read(workspace_id));
-- Engine reads and moves are private until checked. Customers read the redacted RPC, never these rows directly.
create policy shoot_pictures_read on public.shoot_pictures for select to authenticated using(app.is_staff(workspace_id));
create policy shoot_uses_read on public.shoot_uses for select to authenticated using(exists (
  select 1 from public.shoot_pictures p where p.id = picture_id and app.can_read(p.workspace_id)));
grant select on public.shoots, public.shoot_pictures, public.shoot_uses to authenticated;
revoke all on public.shoots, public.shoot_pictures, public.shoot_uses from service_role;

create function app.require_shoot_write(ws uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_user();
  if not app.can_read(ws) then perform app.fail('not_found', 'No such brand.'); end if;
  if app.is_admin() or not (app.customer_is(ws, array['owner','approver','member'])
    or app.is_staff(ws, array['designer','account_manager'])) then
    perform app.fail('forbidden', 'Only the brand team and Fume add pictures or edit rights.');
  end if;
end $$;

create function app.shoot_json(s public.shoots) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object('id', s.id, 'workspaceId', s.workspace_id, 'name', s.name,
    'shotOn', s.shot_on, 'by', s.uploaded_by, 'at', s.created_at, 'state', s.state,
    'checkedBy', s.checked_by, 'checkedAt', s.checked_at,
    'rights', jsonb_strip_nulls(jsonb_build_object('photographer', s.photographer, 'until', s.usable_until, 'people', s.people)),
    'pictures', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', p.id, 'shootId', p.shoot_id, 'workspaceId', p.workspace_id, 'number', p.number,
      'kind', p.kind, 'name', f.name, 'fileId', f.id, 'width', f.width, 'height', f.height,
      'bytes', f.bytes, 'seconds', p.seconds,
      'read', case when app.is_staff(s.workspace_id) or s.state = 'checked' then p.engine_read end,
      'moved', case when (app.is_staff(s.workspace_id) or s.state = 'checked') and p.moved_sort is not null
        then jsonb_build_object('sort', p.moved_sort, 'by', p.moved_by, 'at', p.moved_at) end,
      'usedIn', coalesce((select jsonb_agg(jsonb_build_object('campaignId', c.id, 'campaignName', c.name,
        'documentId', cr.id, 'at', u.created_at)) from public.shoot_uses u
        join public.creatives cr on cr.id = u.creative_id join public.campaigns c on c.id = cr.campaign_id
        where u.picture_id = p.id), '[]')
    )) order by p.number) from public.shoot_pictures p join public.files f on f.id = p.file_id
      where p.shoot_id = s.id), '[]')))
$$;

create function public.get_shoot(p_shoot_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.shoots;
begin
  select * into s from public.shoots where id = p_shoot_id and app.can_read(workspace_id);
  if not found then perform app.fail('not_found', 'No such shoot.'); end if;
  return app.shoot_json(s);
end $$;
create function public.list_shoots(p_workspace_id uuid default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(app.shoot_json(s) order by s.created_at desc, s.id), '[]') from public.shoots s
  where app.can_read(s.workspace_id) and (p_workspace_id is null or s.workspace_id = p_workspace_id)
$$;

-- Every original is uploaded and registered first, exactly as other app uploads are. This command is atomic:
-- a failed attachment never leaves a half-created shoot. Unattached storage originals can be retried.
create function public.add_shoot(p_workspace_id uuid, p_name text, p_shot_on date, p_rights jsonb, p_pictures jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.shoots; p jsonb; n int := 0; f public.files;
begin
  perform app.require_shoot_write(p_workspace_id);
  if jsonb_typeof(p_pictures) is distinct from 'array' or jsonb_array_length(p_pictures) = 0
    or nullif(trim(p_name), '') is null then perform app.fail('invalid', 'Give the shoot a name and pictures.'); end if;
  if coalesce(p_rights ->> 'people', '') not in ('none','released','unsure') then
    perform app.fail('invalid', 'Say who is in the pictures.'); end if;
  insert into public.shoots(workspace_id, name, shot_on, photographer, usable_until, people, consent_yes, rights_by, uploaded_by)
  values(p_workspace_id, trim(p_name), p_shot_on, nullif(trim(p_rights ->> 'photographer'), ''),
    (p_rights ->> 'until')::date, p_rights ->> 'people', p_rights ->> 'people' = 'released', auth.uid(), auth.uid()) returning * into s;
  for p in select value from jsonb_array_elements(p_pictures) loop
    select * into f from public.files where id = (p ->> 'fileId')::uuid and workspace_id = p_workspace_id
      and purpose = 'source' and uploaded_by = auth.uid() and bucket = 'workspace-files';
    if not found or f.bytes > 2000000000 or f.bytes <= 0 or not (
      (p ->> 'kind' = 'photo' and (f.content_type in ('image/jpeg','image/png','image/webp','image/heic','image/heif','image/x-adobe-dng','image/x-canon-cr2','image/x-nikon-nef')
        or (f.content_type = 'application/octet-stream' and lower(f.name) ~ '\.(raw|arw|cr2|cr3|nef|dng|orf|rw2)$')))
      or (p ->> 'kind' = 'clip' and f.content_type in ('video/mp4','video/quicktime'))
    ) then perform app.fail('invalid', 'Upload a supported picture or clip in this brand first (up to 2 GB).'); end if;
    n := n + 1;
    insert into public.shoot_pictures(shoot_id, workspace_id, file_id, number, kind, seconds)
    values(s.id, s.workspace_id, f.id, n, p ->> 'kind', (p ->> 'seconds')::numeric);
  end loop;
  return app.shoot_json(s);
end $$;

create function public.update_shoot_rights(p_shoot_id uuid, p_rights jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.shoots;
begin
  select * into s from public.shoots where id = p_shoot_id for update;
  if not found then perform app.fail('not_found', 'No such shoot.'); end if;
  perform app.require_shoot_write(s.workspace_id);
  if coalesce(p_rights ->> 'people', '') not in ('none','released','unsure') then
    perform app.fail('invalid', 'Say who is in the pictures.'); end if;
  update public.shoots set photographer = nullif(trim(p_rights ->> 'photographer'), ''),
    usable_until = (p_rights ->> 'until')::date, people = p_rights ->> 'people',
    consent_yes = p_rights ->> 'people' = 'released', rights_by = auth.uid(), rights_at = now()
  where id = s.id returning * into s;
  return app.shoot_json(s);
end $$;

-- One gate for photographs AND clips, called by all production consumers, including service workers.
create function app.require_shoot_use(p_shoot_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.shoots;
begin
  select * into s from public.shoots where id = p_shoot_id for share;
  if not found then perform app.fail('not_found', 'No such shoot.'); end if;
  if s.people = 'unsure' then perform app.fail('invalid', 'Ask who is in the pictures before they are used.'); end if;
  if s.usable_until < current_date then perform app.fail('invalid', 'The shoot''s usage period has ended.'); end if;
end $$;
create function app.guard_shoot_file_use() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p public.shoot_pictures;
begin
  select * into p from public.shoot_pictures where file_id = new.file_id;
  if found then
    perform app.require_shoot_use(p.shoot_id);
    if new.workspace_id <> p.workspace_id then perform app.fail('invalid', 'The picture is in another brand.'); end if;
    -- Starting from an original is Fume's action. Later customer decisions keep their existing permissions.
    if tg_op = 'INSERT' or new.file_id is distinct from old.file_id then
      if not app.is_staff(p.workspace_id, array['designer','account_manager']) or app.my_agency() is not null or app.is_admin() then
        perform app.fail('forbidden', 'Only Fume starts creatives from a shoot.');
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger source_shoot_rights before insert or update of file_id on public.sources
for each row execute function app.guard_shoot_file_use();
create trigger candidate_shoot_rights before insert or update of file_id on public.candidates
for each row execute function app.guard_shoot_file_use();
create trigger version_shoot_rights before insert or update on public.creative_versions
for each row execute function app.guard_shoot_file_use();

-- Edge functions can read originals for assessment without receiving general table privileges.
create function public.shoot_read_input(p_shoot_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', s.id, 'workspaceId', s.workspace_id, 'rights',
    jsonb_build_object('photographer', s.photographer, 'until', s.usable_until, 'people', s.people, 'consentYes', s.consent_yes),
    'pictures', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'number', p.number, 'kind', p.kind,
      'bucket', f.bucket, 'path', f.path)) from public.shoot_pictures p join public.files f on f.id = p.file_id
      where p.shoot_id = s.id), '[]')) from public.shoots s where s.id = p_shoot_id
$$;
-- Production workers must use this gated reader (assessment above is allowed before rights are settled).
create function public.shoot_use_input(p_shoot_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_shoot_use(p_shoot_id);
  return public.shoot_read_input(p_shoot_id);
end $$;

revoke all on function app.require_shoot_write(uuid), app.shoot_json(public.shoots), app.require_shoot_use(uuid),
  app.guard_shoot_file_use() from public, anon, authenticated, service_role;
revoke all on function public.get_shoot(uuid), public.list_shoots(uuid), public.add_shoot(uuid,text,date,jsonb,jsonb),
  public.update_shoot_rights(uuid,jsonb), public.shoot_read_input(uuid), public.shoot_use_input(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_shoot(uuid), public.list_shoots(uuid), public.add_shoot(uuid,text,date,jsonb,jsonb),
  public.update_shoot_rights(uuid,jsonb) to authenticated;
grant execute on function public.shoot_read_input(uuid), public.shoot_use_input(uuid) to service_role;

-- Product packshots can also be shoot originals. Recheck current rights on every production read,
-- including originals linked before their shoot existed or before its rights were tightened.
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
    'creative', jsonb_build_object('id', cr.id, 'title', cr.title, 'slot', cr.slot, 'format', cr.format, 'kind', cr.kind,
      'words', coalesce(cr.words, (
        select pc ->> 'words'
        from public.plan_versions pv, jsonb_array_elements(coalesce(pv.body -> 'planned_creatives', '[]')) pc
        where pv.id = s.plan_version_id and pc ->> 'id' = cr.slot
        limit 1), 'on_picture')),
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
              and not exists (
                select 1 from public.shoot_pictures sp join public.shoots sh on sh.id = sp.shoot_id
                where sp.file_id = so.file_id and (sh.people = 'unsure'
                  or (sh.people = 'released' and not sh.consent_yes) or sh.usable_until < current_date)
              )
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

-- Customers may know the kind of a sent version, never the private design layer behind it.
create function public.library_version_kinds(p_version_ids uuid[])
returns table (version_id uuid, kind text)
language sql stable security definer set search_path = '' as $$
  select v.id, case when exists (
    select 1 from public.design_layers d
    where d.workspace_id = v.workspace_id and d.result_candidate_id = v.candidate_id and d.state = 'made'
  ) then 'design' else 'picture' end
  from public.creative_versions v
  where v.id = any(p_version_ids)
    and auth.uid() is not null
    and app.customer_role(v.workspace_id) is not null
    and app.customer_may_see_version(v)
$$;
revoke all on function public.library_version_kinds(uuid[]) from public, anon;
grant execute on function public.library_version_kinds(uuid[]) to authenticated;
