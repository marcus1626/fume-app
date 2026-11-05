-- A fix is drawn from the product's photographs that show its own print best: the detail, the front and the back come
-- before photographs on a model.
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
