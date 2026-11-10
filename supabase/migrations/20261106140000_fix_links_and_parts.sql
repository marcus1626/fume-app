-- «Fix with the real product» for every product, and for more than one part of a picture at a time.
--
-- 1. A packshot kept only as a link to the brand's site (Nike, Møllers) gave a fix no photograph of the real product.
--    Now it comes with the place the picture check keeps it (<ws>/check/source-<source>.img) and its link, so the fix
--    reads the kept copy, or keeps it first.
-- 2. A second fix asked on the same picture within five minutes was answered with the first one, even for another
--    part. Now only the same part with the same words is (a double click); another part is its own fix.

create or replace function public.fix_candidate(p_candidate_id uuid, p_box jsonb, p_ask text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c public.candidates;
  j public.production_jobs;
  x public.picture_fixes;
  b_x numeric; b_y numeric; b_w numeric; b_h numeric;
  v_ask text := nullif(left(trim(coalesce(p_ask, '')), 1000), '');
  v_box jsonb;
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
  if v_ask is null then perform app.fail('invalid', 'Say what is wrong in the part you marked.'); end if;
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
  v_box := jsonb_build_object('x', b_x, 'y', b_y, 'w', b_w, 'h', b_h);
  -- The same part asked again with the same words while it is being fixed is the same fix.
  select * into x from public.picture_fixes
  where candidate_id = c.id and state = 'fixing' and created_at > now() - interval '5 minutes'
    and picture_fixes.box = v_box and picture_fixes.ask = v_ask
  order by created_at desc limit 1;
  if found then return to_jsonb(x); end if;
  if not (public.fume_engine_budget() ->> 'allowed')::boolean then
    perform app.fail('budget', 'This week''s budget for the Engine is used up.');
  end if;
  select * into j from public.production_jobs where id = c.job_id;
  insert into public.picture_fixes (workspace_id, candidate_id, job_id, creative_id, box, ask, requested_by)
  values (c.workspace_id, c.id, j.id, j.creative_id, v_box, v_ask, auth.uid())
  returning * into x;
  perform app.record(c.workspace_id, 'fix.asked', 'candidate', c.id, jsonb_build_object('fix_id', x.id));
  return to_jsonb(x);
end $$;
revoke execute on function public.fix_candidate(uuid, jsonb, text) from public, anon;
grant execute on function public.fix_candidate(uuid, jsonb, text) to authenticated;

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
          select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('bucket', y.bucket, 'path', y.path, 'url', y.url)))
          from (
            -- A photograph in Fume's storage, or one kept only as a link: then where the picture check keeps it.
            select coalesce(fi.bucket, 'workspace-files') bucket,
                   coalesce(fi.path, pr.workspace_id || '/check/source-' || so.id || '.img') path,
                   case when fi.id is null then so.url end url
            from public.sources so left join public.files fi on fi.id = so.file_id
            where so.product_id = pr.id and so.kind = 'packshot'
              and (fi.content_type like 'image/%' or (so.file_id is null and so.url ~ '^https://'))
            -- The photographs that show the product's own print best come first: the detail, then the front and back.
            order by case so.slot when 'detail' then 0 when 'front' then 1 when 'back' then 2 else 3 end, so.created_at desc limit 3
          ) y), '[]')
      ) order by pr.name)
      from public.campaign_products cp join public.products pr on pr.id = cp.product_id
      where cp.campaign_id = j.campaign_id), '[]'),
    'store', jsonb_build_object('bucket', 'workspace-files',
      'png', x.workspace_id || '/fix/' || x.id || '.png', 'crop', x.workspace_id || '/fix/' || x.id || '-crop.png')
  );
end $$;
revoke execute on function public.fix_take(uuid) from public, anon, authenticated;
grant execute on function public.fix_take(uuid) to service_role;
