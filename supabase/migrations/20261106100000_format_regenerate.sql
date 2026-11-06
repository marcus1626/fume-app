-- The third way to make a format (docs/mvp/formats.md): regenerate. When neither a crop nor an expansion of the master
-- works (a wide banner from a tall master, a scene that has to be laid out again), the designer asks the image model
-- to draw the picture again in the new shape, from the approved master and the product's own photographs. The picture
-- is new, so the Engine looks at the product against its photographs (engine_evaluated) and the expert checks it like
-- any new picture. Only the designer chooses it; the Engine itself crops or expands.

alter table public.format_makes drop constraint format_makes_asked_check,
  add constraint format_makes_asked_check check (asked in ('crop', 'expand', 'regenerate'));
alter table public.format_makes drop constraint format_makes_method_check,
  add constraint format_makes_method_check check (method in ('crop', 'expand', 'regenerate'));

update app.settings set value = value || '{"regenerate": "nano-banana-pro"}' where key = 'task_models' and not value ? 'regenerate';

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
  if p_method is not null and p_method not in ('crop', 'expand', 'regenerate') then perform app.fail('invalid', 'Crop, expand or regenerate.'); end if;
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
    -- A redrawn format is a new picture: the image model and the Engine's look get the product's own photographs.
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', pr.name, 'variant', nullif(pr.variant, ''),
        'pictures', coalesce((
          select jsonb_agg(jsonb_build_object('bucket', y.bucket, 'path', y.path))
          from (
            select fi.bucket, fi.path from public.sources so join public.files fi on fi.id = so.file_id
            where so.product_id = pr.id and so.kind = 'packshot' and fi.content_type like 'image/%'
            order by case so.slot when 'front' then 0 when 'detail' then 1 when 'back' then 2 else 3 end, so.created_at desc limit 2
          ) y), '[]')
      ) order by pr.name)
      from public.campaign_products cp join public.products pr on pr.id = cp.product_id
      where cp.campaign_id = cr.campaign_id), '[]'),
    'store', jsonb_build_object('bucket', 'workspace-files', 'prefix', x.workspace_id || '/format/' || x.id));
end $$;

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
  if r ->> 'method' not in ('crop', 'expand', 'regenerate') then perform app.fail('invalid', 'Crop, expand or regenerate.'); end if;
  insert into public.files (workspace_id, path, name, content_type, bytes, sha256, width, height, purpose, uploaded_by)
  values (x.workspace_id, r #>> '{png,path}', 'Format from the master.png', 'image/png',
    coalesce((r #>> '{png,bytes}')::bigint, 0), r #>> '{png,sha256}', (r ->> 'width')::int, (r ->> 'height')::int,
    'candidate', x.requested_by)
  returning * into png;
  insert into public.candidates (workspace_id, job_id, file_id, origin, note, made_by)
  values (x.workspace_id, x.job_id, png.id, 'engine',
    left(case r ->> 'method' when 'crop' then 'Cropped from the master: ' when 'regenerate' then 'Redrawn from the master: '
      else 'Expanded from the master: ' end || coalesce(r ->> 'why', ''), 500),
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

revoke execute on function public.format_take(uuid) from public, anon, authenticated;
revoke execute on function public.format_finish(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.format_take(uuid), public.format_finish(uuid, jsonb) to service_role;
