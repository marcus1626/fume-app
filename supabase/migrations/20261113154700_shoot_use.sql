-- FLOWS §38: expert picks and real photographs as zero-cost masters. No new table grants;
-- the shoot tables keep their existing read-only RLS. All writes go through checked commands.
create function app.require_shoot_check(ws uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_user();
  if not app.can_read(ws) then perform app.fail('not_found', 'No such shoot.'); end if;
  if app.is_admin() or not app.can_check(ws) or exists (select 1 from public.workspaces w
    where w.id = ws and w.agency_id is not null and app.agency_role(ws) is null) then
    perform app.fail('forbidden', 'An expert checks the picks.');
  end if;
end $$;

create function public.move_shoot_picture(p_picture_id uuid, p_sort text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.shoots; p public.shoot_pictures;
begin
  select sh.* into s from public.shoots sh join public.shoot_pictures sp on sp.shoot_id = sh.id
    where sp.id = p_picture_id for update of sh;
  if not found then perform app.fail('not_found', 'No such picture.'); end if;
  perform app.require_shoot_check(s.workspace_id);
  select * into p from public.shoot_pictures where id = p_picture_id;
  if s.state = 'reading' then perform app.fail('invalid', 'Wait until the Engine has read the shoot.'); end if;
  if p_sort is null or p_sort not in ('pick','rest','out') then perform app.fail('invalid', 'Choose a picture place.'); end if;
  if p.kind = 'clip' and p_sort = 'pick' then perform app.fail('invalid', 'A clip is kept for the video editor.'); end if;
  update public.shoot_pictures set
    moved_sort = case when p_sort is distinct from engine_read ->> 'sort' then p_sort end,
    moved_by = case when p_sort is distinct from engine_read ->> 'sort' then auth.uid() end,
    moved_at = case when p_sort is distinct from engine_read ->> 'sort' then now() end
    where id = p.id;
  update public.shoots set state = 'read', checked_by = null, checked_at = null where id = s.id returning * into s;
  perform app.record(s.workspace_id, 'shoot.picture_moved', 'shoot', s.id, jsonb_build_object('picture', p.id, 'sort', p_sort));
  return app.shoot_json(s);
end $$;

create function public.check_shoot_picks(p_shoot_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.shoots;
begin
  select * into s from public.shoots where id = p_shoot_id for update;
  if not found then perform app.fail('not_found', 'No such shoot.'); end if;
  perform app.require_shoot_check(s.workspace_id);
  if s.state = 'reading' then perform app.fail('invalid', 'Wait until the Engine has read the shoot.'); end if;
  if not exists (select 1 from public.shoot_pictures where shoot_id = s.id and kind = 'photo'
    and coalesce(moved_sort, engine_read ->> 'sort') = 'pick') then perform app.fail('invalid', 'Pick at least one picture.'); end if;
  update public.shoots set state = 'checked', checked_by = auth.uid(), checked_at = now() where id = s.id returning * into s;
  perform app.record(s.workspace_id, 'shoot.checked', 'shoot', s.id);
  return app.shoot_json(s);
end $$;

create or replace function app.require_shoot_use(p_shoot_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.shoots;
begin
  select * into s from public.shoots where id = p_shoot_id for share;
  if not found then perform app.fail('not_found', 'No such shoot.'); end if;
  if s.people = 'unsure' then perform app.fail('invalid', 'Ask who is in the pictures before they are used.'); end if;
  if s.people = 'released' and not s.consent_yes then perform app.fail('invalid', 'Record everyone''s consent first.'); end if;
  if s.usable_until < current_date then perform app.fail('invalid', 'The shoot''s usage period has ended.'); end if;
end $$;

-- A known person photograph stays protected even if the rights answer is later changed to "No people".
alter table public.shoots add column protected_photo boolean not null default false;
create function app.remember_shoot_people() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then new.protected_photo := new.protected_photo or old.protected_photo; end if;
  new.protected_photo := new.protected_photo or new.people = 'released';
  return new;
end $$;
create trigger remember_shoot_people before insert or update on public.shoots for each row execute function app.remember_shoot_people();
update public.shoots set protected_photo = true where people = 'released';

alter table public.creatives add column protected_photo boolean not null default false;
alter table public.creative_versions add column protected_photo boolean not null default false;
comment on column public.creatives.protected_photo is 'Real people: no generative rendering, correction or variants. Inherited by all descendants and never cleared.';
-- Derive protection server-side, including paths other than use_shoot_in_campaign.
create function app.protect_photo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then new.protected_photo := new.protected_photo or old.protected_photo; end if;
  if tg_table_name = 'creatives' then
    new.protected_photo := new.protected_photo or coalesce((select protected_photo from public.creatives where id = new.master_id), false);
  else
    new.protected_photo := new.protected_photo
      or coalesce((select protected_photo from public.creatives where id = new.creative_id), false)
      or coalesce((select protected_photo from public.creative_versions where id = new.master_version_id), false)
      or exists (select 1 from public.shoot_pictures p join public.shoots s on s.id = p.shoot_id
        where p.file_id = new.file_id and s.protected_photo);
    if new.protected_photo then update public.creatives set protected_photo = true where id = new.creative_id and not protected_photo; end if;
  end if;
  return new;
end $$;
create trigger protect_photo before insert or update on public.creatives for each row execute function app.protect_photo();
create trigger protect_photo before insert or update on public.creative_versions for each row execute function app.protect_photo();

create function public.use_shoot_in_campaign(p_shoot_id uuid, p_campaign_id uuid, p_picture_ids uuid[] default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.shoots; c public.campaigns; p public.shoot_pictures; f public.files;
  cr public.creatives; j public.production_jobs; cand public.candidates; snap public.context_snapshots; plan public.plan_versions;
  ids uuid[] := '{}'; brand text; note text; fmt text;
begin
  perform app.require_user();
  select * into s from public.shoots where id = p_shoot_id for update;
  if not found or not app.can_read(s.workspace_id) then perform app.fail('not_found', 'No such shoot.'); end if;
  if app.is_admin() or app.my_agency() is not null or not app.is_staff(s.workspace_id, array['designer','account_manager']) then
    perform app.fail('forbidden', 'Only Fume starts creatives from a shoot.'); end if;
  if s.state <> 'checked' then perform app.fail('invalid', 'An expert checks the picks first.'); end if;
  perform app.require_shoot_use(s.id);
  select * into c from public.campaigns where id = p_campaign_id for update;
  if not found or not app.can_read(c.workspace_id) then perform app.fail('not_found', 'No such campaign.'); end if;
  if c.workspace_id <> s.workspace_id then perform app.fail('invalid', 'The campaign is in another brand.'); end if;
  if c.state in ('approved','delivered','closed') then perform app.fail('invalid', 'Choose an open campaign.'); end if;
  -- An explicit selection is all-or-nothing; never silently use a subset from another shoot or a clip.
  if p_picture_ids is not null and (cardinality(p_picture_ids) = 0 or exists (
    select 1 from unnest(p_picture_ids) x where not exists (select 1 from public.shoot_pictures sp
      where sp.id = x and sp.shoot_id = s.id and sp.kind = 'photo' and coalesce(sp.moved_sort, sp.engine_read ->> 'sort') = 'pick')
  )) then perform app.fail('invalid', 'Choose only this shoot''s photo picks.'); end if;
  select brand_name into brand from public.workspaces where id = s.workspace_id;
  note := brand || '''s own photograph · ' || s.name || case when s.photographer is not null then ', by ' || s.photographer else '' end;
  -- Keep the existing production requirement: the customer's plan is approved first.
  select * into plan from public.plan_versions where campaign_id = c.id and state = 'approved' order by version desc limit 1;
  if not found then perform app.fail('invalid', 'The plan is not approved yet.'); end if;
  insert into public.context_snapshots(workspace_id,campaign_id,brief_version_id,plan_version_id,brand_dna_version_id,facts,recipe)
    values(s.workspace_id,c.id,plan.brief_version_id,plan.id,plan.brand_dna_version_id,
      coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'product_id',f.product_id,'area',f.area,
        'label',f.label,'statement',f.statement,'status',f.status) order by f.label)
        from public.campaign_products cp join public.product_facts f on f.product_id=cp.product_id
        where cp.campaign_id=c.id and f.superseded_by is null),'[]'),
      jsonb_build_object('provider','shoot','shoot_id',s.id)) returning * into snap;
  for p in select * from public.shoot_pictures where shoot_id = s.id and kind = 'photo'
    and coalesce(moved_sort, engine_read ->> 'sort') = 'pick' and (p_picture_ids is null or id = any(p_picture_ids)) order by number loop
    select * into f from public.files where id = p.file_id;
    -- Same ratio thresholds as domain/shoot.ts (wide photographs are square).
    fmt := case when f.width is null or f.height is null or f.width <= 0 or f.height <= 0 then 'feed'
      when f.width::numeric/f.height >= 0.9 then 'square'
      when f.width::numeric/f.height >= 0.66 then 'feed' else 'story' end;
    insert into public.creatives(workspace_id,campaign_id,kind,format,name,title,protected_photo)
      values(s.workspace_id,c.id,'master',fmt,'shoot_' || p.id || '_' || gen_random_uuid(),s.name || ' ' || lpad(p.number::text,2,'0'),s.protected_photo) returning * into cr;
    insert into public.production_jobs(workspace_id,campaign_id,kind,creative_id,snapshot_id,state,mode,cost_cents,requested_by)
      values(s.workspace_id,c.id,'master',cr.id,snap.id,'succeeded','manual',0,auth.uid()) returning * into j;
    insert into public.candidates(workspace_id,job_id,file_id,origin,note,made_by)
      values(s.workspace_id,j.id,f.id,'manual',note,auth.uid()) returning * into cand;
    insert into public.creative_versions(workspace_id,creative_id,number,state,file_id,candidate_id,job_id)
      values(s.workspace_id,cr.id,1,'making',f.id,cand.id,j.id);
    insert into public.shoot_uses(picture_id,creative_id) values(p.id,cr.id);
    ids := array_append(ids,cr.id);
    perform app.record(s.workspace_id,'shoot.used','creative',cr.id,jsonb_build_object('shoot',s.id,'picture',p.id));
  end loop;
  if cardinality(ids) = 0 then perform app.fail('invalid', 'Choose at least one pick.'); end if;
  update public.campaigns set stage = 'masters', state = 'in_production' where id = c.id;
  return jsonb_build_object('documentIds',to_jsonb(ids));
end $$;

-- Current rights follow the source through every descendant, even after design/crop replaces the original pixels.
create function app.require_photo_job(cr_id uuid, mv_id uuid, generative boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare s_id uuid; protected boolean;
begin
  with recursive lineage as (
    select id, master_id, protected_photo from public.creatives where id = cr_id
      or id = (select creative_id from public.creative_versions where id = mv_id)
    union select c.id,c.master_id,c.protected_photo from public.creatives c join lineage l on c.id = l.master_id
  ) select coalesce(bool_or(protected_photo),false) into protected from lineage;
  for s_id in with recursive lineage as (
    select id,master_id from public.creatives where id = cr_id or id = (select creative_id from public.creative_versions where id = mv_id)
    union select c.id,c.master_id from public.creatives c join lineage l on c.id = l.master_id
  ) select distinct p.shoot_id from public.shoot_pictures p where exists (
      select 1 from lineage l join public.shoot_uses u on u.creative_id = l.id where u.picture_id = p.id
    ) or exists (
      select 1 from lineage l join public.creative_versions v on v.creative_id = l.id where v.file_id = p.file_id
    ) or exists (
      select 1 from lineage l join public.production_jobs j on j.creative_id = l.id
        join public.candidates c on c.job_id = j.id where c.file_id = p.file_id
    ) loop
    perform app.require_shoot_use(s_id);
    protected := protected or exists(select 1 from public.shoots where id = s_id and protected_photo);
  end loop;
  if generative and protected then perform app.fail('invalid', 'Real people in this photograph are protected. Use graphic design or a pixel-preserving crop.'); end if;
end $$;
create or replace function app.guard_shoot_file_use() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p public.shoot_pictures;
begin
  if tg_op = 'UPDATE' and tg_table_name = 'creative_versions'
    and (to_jsonb(new) - 'protected_photo') = (to_jsonb(old) - 'protected_photo') then return new; end if;
  if tg_table_name = 'creative_versions' then
    perform app.require_photo_job(new.creative_id,new.master_version_id,false);
  end if;
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

create function app.guard_photo_job() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.state in ('failed','cancelled') then return new; end if;
  perform app.require_photo_job(new.creative_id,new.master_version_id,new.mode = 'engine');
  return new;
end $$;
create trigger photo_job before insert or update on public.production_jobs for each row execute function app.guard_photo_job();
-- Worker payloads carry storage coordinates, including product references linked before rights changed.
create function app.worker_picture_usable(p_picture jsonb) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.files f join public.shoot_pictures p on p.file_id = f.id
      join public.shoots s on s.id = p.shoot_id
    where f.bucket = p_picture ->> 'bucket' and f.path = p_picture ->> 'path'
      and (s.people = 'unsure' or (s.people = 'released' and not s.consent_yes) or s.usable_until < current_date)
  )
$$;
create function app.require_worker_pictures(p_task jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.worker_picture_usable(p_task -> 'picture') or exists (
    select 1 from jsonb_array_elements(p_task -> 'products') product,
      jsonb_array_elements(product -> 'pictures') picture where not app.worker_picture_usable(picture)
  ) then perform app.fail('invalid', 'The shoot picture cannot be used with its current rights.'); end if;
end $$;
revoke all on function app.worker_picture_usable(jsonb), app.require_worker_pictures(jsonb) from public,anon,authenticated,service_role;

-- Keep the existing Engine implementation private; guard before even collecting/retrying an old task.
alter function public.engine_take(uuid) rename to engine_take_before_shoot_use;
revoke all on function public.engine_take_before_shoot_use(uuid) from public, anon, authenticated, service_role;
create function public.engine_take(p_job_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare j public.production_jobs; task jsonb;
begin
  select * into j from public.production_jobs where id = p_job_id for update;
  if not found then return null; end if;
  perform app.require_photo_job(j.creative_id,j.master_version_id,true);
  task := public.engine_take_before_shoot_use(p_job_id);
  if not app.worker_picture_usable(task -> 'composition') then task := task || '{"composition": null}'; end if;
  return task;
end $$;
revoke all on function public.engine_take(uuid) from public, anon, authenticated;
grant execute on function public.engine_take(uuid) to service_role;

-- Format regeneration and brushed fixes also use image models, outside engine_take. Until a trusted product-only
-- mask is enforced server-side, refuse brushed fixes on protected people. Crops and graphic design remain available.
create function app.guard_photo_transform() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cr_id uuid;
begin
  if new.state = 'failed' then return new; end if;
  if tg_table_name = 'format_makes' then
    perform app.require_photo_job(new.creative_id,new.master_version_id,
      coalesce(new.method,new.asked,'regenerate') <> 'crop');
  elsif tg_table_name = 'design_layers' then
    perform app.require_photo_job(new.creative_id,null,false);
  else
    select j.creative_id into cr_id from public.candidates c join public.production_jobs j on j.id = c.job_id where c.id = new.candidate_id;
    perform app.require_photo_job(cr_id,null,true);
  end if;
  return new;
end $$;
create trigger photo_transform before insert or update on public.format_makes for each row execute function app.guard_photo_transform();
create trigger photo_transform before insert or update on public.design_layers for each row execute function app.guard_photo_transform();
create trigger photo_transform before insert or update on public.picture_fixes for each row execute function app.guard_photo_transform();

revoke all on function app.require_shoot_check(uuid), app.protect_photo(), app.require_photo_job(uuid,uuid,boolean),
 app.guard_photo_job(), app.guard_photo_transform() from public,anon,authenticated,service_role;
revoke all on function public.move_shoot_picture(uuid,text),public.check_shoot_picks(uuid),public.use_shoot_in_campaign(uuid,uuid,uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.move_shoot_picture(uuid,text),public.check_shoot_picks(uuid),public.use_shoot_in_campaign(uuid,uuid,uuid[]) to authenticated;

-- A shoot already has a private V1 before Send to check. Its original keeps V1; a design is a new version.
create or replace function public.send_to_check(
  p_candidate_id uuid, p_format text default 'feed', p_title text default null, p_key text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('candidate_id', p_candidate_id, 'format', p_format, 'title', p_title);
  prior jsonb;
  cand public.candidates;
  j public.production_jobs;
  cr public.creatives;
  mv public.creative_versions;
  prev public.creative_versions;
  v public.creative_versions;
  ws_slug text;
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'send_to_check', req);
  if prior is not null then return prior; end if;

  select * into cand from public.candidates where id = p_candidate_id;
  if not found or not app.can_read(cand.workspace_id) then
    perform app.fail('not_found', 'No such candidate.');
  end if;
  if not app.is_staff(cand.workspace_id, array['designer']) then
    perform app.fail('forbidden', 'Only a designer sends work to check.');
  end if;
  if exists (select 1 from public.creative_versions where candidate_id = cand.id and state <> 'making') then
    perform app.fail('conflict', 'This candidate is already a version.');
  end if;
  select * into j from public.production_jobs where id = cand.job_id for update;
  select slug into ws_slug from public.workspaces where id = cand.workspace_id;

  if j.kind = 'correction' then
    select * into cr from public.creatives where id = j.creative_id;
    prev := app.latest_version(cr.id);
    if prev.state not in ('changes_requested', 'correcting', 'held') then
      perform app.fail('conflict', 'This creative is not waiting for a new version.');
    end if;
  elsif j.creative_id is not null then
    select * into cr from public.creatives where id = j.creative_id for update;
    prev := app.latest_version(cr.id);
    if prev.id is not null and (prev.state <> 'making' or not exists (
      select 1 from public.shoot_uses u where u.creative_id = cr.id)) then
      perform app.fail('conflict', 'This creative has its first version already. A new one follows a correction or the customer''s changes.');
    end if;
  else
    if j.kind in ('variant', 'format') then
      select * into mv from public.creative_versions where id = j.master_version_id;
    end if;
    insert into public.creatives (workspace_id, campaign_id, master_id, kind, format, name, title)
    values (
      cand.workspace_id, j.campaign_id,
      case when j.kind in ('variant', 'format') then mv.creative_id end,
      j.kind, p_format,
      ws_slug || '_' || j.kind || '_' || p_format || '_' || left(replace(gen_random_uuid()::text, '-', ''), 6),
      coalesce(p_title, initcap(j.kind) || ' · ' || p_format)
    ) returning * into cr;
  end if;

  if prev.state = 'making' and prev.candidate_id = cand.id then
    update public.creative_versions set state = 'in_check' where id = prev.id returning * into v;
  else
  insert into public.creative_versions (workspace_id, creative_id, number, state, file_id, candidate_id, job_id, master_version_id)
  values (
    cand.workspace_id, cr.id, coalesce(prev.number, 0) + 1, 'in_check', cand.file_id, cand.id, j.id,
    coalesce(j.master_version_id, prev.master_version_id)
  ) returning * into v;
  end if;
  insert into public.expert_checks (workspace_id, version_id, snapshot_id) values (v.workspace_id, v.id, j.snapshot_id);
  update public.change_requests set new_version_id = v.id
  where prev.id is not null and version_id = prev.id and new_version_id is null;
  perform app.record(v.workspace_id, 'version.in_check', 'creative_version', v.id,
    jsonb_build_object('creative', cr.title, 'number', v.number));
  return app.idem_end(p_key, 'send_to_check', req, to_jsonb(v));
end $$;


-- Mark every descendant when rights disclose people later; protection is sticky even if the answer changes again.
create function app.propagate_photo_protection() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.protected_photo and not old.protected_photo then
    update public.creatives set protected_photo = true where master_id = new.id and not protected_photo;
    update public.creative_versions set protected_photo = true where creative_id = new.id and not protected_photo;
  end if;
  return new;
end $$;
create trigger propagate_photo_protection after update on public.creatives for each row execute function app.propagate_photo_protection();
create function app.protect_shoot_people() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.protected_photo then
    update public.creatives cr set protected_photo = true where not protected_photo and (
      exists (select 1 from public.shoot_uses u join public.shoot_pictures p on p.id = u.picture_id
        where p.shoot_id = new.id and u.creative_id = cr.id)
      or exists (select 1 from public.creative_versions v join public.shoot_pictures p on p.file_id = v.file_id
        where p.shoot_id = new.id and v.creative_id = cr.id)
      or exists (select 1 from public.production_jobs j join public.candidates c on c.job_id = j.id
        join public.shoot_pictures p on p.file_id = c.file_id where p.shoot_id = new.id and j.creative_id = cr.id));
  end if;
  return new;
end $$;
create trigger protect_shoot_people after update of people on public.shoots for each row execute function app.protect_shoot_people();
create function app.protect_shoot_candidate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.shoot_pictures p join public.shoots s on s.id = p.shoot_id
    where p.file_id = new.file_id and s.protected_photo) then
    update public.creatives set protected_photo = true where id = (select creative_id from public.production_jobs where id = new.job_id)
      and not protected_photo;
  end if;
  return new;
end $$;
create trigger protect_shoot_candidate after insert or update of file_id on public.candidates for each row execute function app.protect_shoot_candidate();
-- Existing real-photo versions/candidates receive the same protection, with descendants handled by the trigger.
update public.creatives cr set protected_photo = true where exists (
  select 1 from public.creative_versions v join public.shoot_pictures p on p.file_id = v.file_id
    join public.shoots s on s.id = p.shoot_id where v.creative_id = cr.id and s.protected_photo
) or exists (
  select 1 from public.production_jobs j join public.candidates c on c.job_id = j.id
    join public.shoot_pictures p on p.file_id = c.file_id join public.shoots s on s.id = p.shoot_id
  where j.creative_id = cr.id and s.protected_photo);
revoke all on function app.remember_shoot_people(),app.propagate_photo_protection(),app.protect_shoot_people(),app.protect_shoot_candidate() from public,anon,authenticated,service_role;

-- An original can already be a candidate when its shoot is uploaded. Link-time protection closes that order too.
create function app.protect_shoot_picture() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.shoots where id = new.shoot_id and protected_photo) then
    update public.creatives cr set protected_photo = true where not protected_photo and (
      exists(select 1 from public.creative_versions v where v.creative_id = cr.id and v.file_id = new.file_id)
      or exists(select 1 from public.production_jobs j join public.candidates c on c.job_id = j.id
        where j.creative_id = cr.id and c.file_id = new.file_id));
  end if;
  return new;
end $$;
create trigger protect_shoot_picture after insert on public.shoot_pictures for each row execute function app.protect_shoot_picture();
revoke all on function app.protect_shoot_picture() from public,anon,authenticated,service_role;

-- Recheck at collection time: tasks may have been queued before the shoot's rights changed.
alter function public.details_take(uuid) rename to details_take_before_shoot_use;
alter function public.format_take(uuid) rename to format_take_before_shoot_use;
alter function public.fix_take(uuid) rename to fix_take_before_shoot_use;
revoke all on function public.details_take_before_shoot_use(uuid), public.format_take_before_shoot_use(uuid),
  public.fix_take_before_shoot_use(uuid) from public,anon,authenticated,service_role;

create function public.details_take(p_candidate_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare j public.production_jobs; task jsonb;
begin
  select pj.* into j from public.candidates c join public.production_jobs pj on pj.id = c.job_id where c.id = p_candidate_id;
  perform app.require_photo_job(j.creative_id,j.master_version_id,false);
  task := public.details_take_before_shoot_use(p_candidate_id);
  perform app.require_worker_pictures(task);
  return task;
end $$;
create function public.format_take(p_make_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare x public.format_makes; task jsonb;
begin
  select * into x from public.format_makes where id = p_make_id;
  perform app.require_photo_job(x.creative_id,x.master_version_id,coalesce(x.method,x.asked,'regenerate') <> 'crop');
  task := public.format_take_before_shoot_use(p_make_id);
  perform app.require_worker_pictures(task);
  return task;
end $$;
create function public.fix_take(p_fix_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare j public.production_jobs; task jsonb;
begin
  select pj.* into j from public.picture_fixes x join public.production_jobs pj on pj.id = x.job_id where x.id = p_fix_id;
  perform app.require_photo_job(j.creative_id,j.master_version_id,true);
  task := public.fix_take_before_shoot_use(p_fix_id);
  perform app.require_worker_pictures(task);
  return task;
end $$;
revoke all on function public.details_take(uuid),public.format_take(uuid),public.fix_take(uuid) from public,anon,authenticated;
grant execute on function public.details_take(uuid),public.format_take(uuid),public.fix_take(uuid) to service_role;

-- Only the shoot's private original is a draft; a making version from any other path stays locked.
create function app.is_shoot_draft(v public.creative_versions) returns boolean
language sql stable security definer set search_path = '' as $$
  select (v).number = 1 and (v).state = 'making' and exists (
    select 1 from public.shoot_uses u join public.shoot_pictures p on p.id = u.picture_id
    where u.creative_id = (v).creative_id and p.file_id = (v).file_id)
$$;
revoke all on function app.is_shoot_draft(public.creative_versions) from public,anon,authenticated,service_role;

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
  if v.id is null or app.is_shoot_draft(v) then
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

create or replace function public.add_manual_version(
  p_creative_id uuid, p_file_id uuid, p_note text, p_key text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('creative_id', p_creative_id, 'file_id', p_file_id, 'note', p_note);
  prior jsonb;
  cr public.creatives;
  v public.creative_versions;
  mv public.creative_versions;
  j public.production_jobs;
  v_kind text;
  cand jsonb;
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'add_manual_version', req);
  if prior is not null then return prior; end if;

  select * into cr from public.creatives where id = p_creative_id for update;
  if not found or not app.can_read(cr.workspace_id) then
    perform app.fail('not_found', 'No such creative.');
  end if;
  if not app.is_staff(cr.workspace_id, array['designer']) then
    perform app.fail('forbidden', 'Only a designer adds a candidate.');
  end if;
  if coalesce(trim(p_note), '') = '' then
    perform app.fail('invalid', 'Say how a manual candidate was made.');
  end if;
  v := app.latest_version(cr.id);
  if v.id is null or app.is_shoot_draft(v) then
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
  where pj.creative_id = cr.id and pj.kind = v_kind and pj.state <> 'cancelled'
    and not exists (select 1 from public.creative_versions x where x.job_id = pj.id)
  order by pj.created_at desc limit 1;
  if not found then
    select * into j from jsonb_populate_record(null::public.production_jobs, public.start_job(
      cr.campaign_id, v_kind,
      jsonb_build_object('provider', 'manual', 'creative', cr.title, 'slot', cr.slot, 'format', cr.format),
      '[]', cr.id, mv.id, 'manual', null));
    update public.production_jobs set creative_id = cr.id where id = j.id;
  end if;
  cand := public.add_candidate(j.id, p_file_id, 'manual', p_note, null);
  return app.idem_end(p_key, 'add_manual_version', req, cand);
end $$;

-- The private V1 enters Check by UPDATE; run the same checks as an inserted in_check version.
create trigger check_file_on_draft_submission
after update of state on public.creative_versions
for each row when (old.state = 'making' and new.state = 'in_check')
execute function app.on_version_in_check();
