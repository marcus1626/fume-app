-- The validation machine checks products whose photographs were imported from the brand's own site, too
-- (docs/mvp/product-parts.md). A packshot kept only as a link is fetched once by the `details` function into Fume's
-- storage (<ws>/check/source-<source>.img, read only by the function), and compared from there.

create or replace function public.details_take(p_candidate_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c public.candidates;
  pic public.candidates;
  f public.files;
  j public.production_jobs;
  w public.workspaces;
  products jsonb;
begin
  select * into c from public.candidates where id = p_candidate_id for update;
  if not found then return null; end if;
  if c.details_at is not null and c.details is null and c.details_at > now() - interval '4 minutes' then return null; end if;
  if not (public.fume_llm_budget() ->> 'allowed')::boolean then return null; end if;
  select * into pic from public.candidates where id = coalesce(c.designed_from, c.id);
  select * into f from public.files where id = pic.file_id;
  select * into j from public.production_jobs where id = c.job_id;
  select * into w from public.workspaces where id = c.workspace_id;
  select coalesce(jsonb_agg(p order by p ->> 'name'), '[]') into products from (
    select jsonb_build_object('id', pr.id, 'name', pr.name, 'variant', nullif(pr.variant, ''),
      'pictures', coalesce((
        select jsonb_agg(case when y.path is not null
            then jsonb_build_object('bucket', y.bucket, 'path', y.path, 'file_id', y.id)
            else jsonb_build_object('bucket', 'workspace-files', 'path', pr.workspace_id || '/check/source-' || y.id || '.img', 'file_id', y.id, 'url', y.url)
          end order by y.o)
        from (
          select coalesce(fi.id, so.id) id, fi.bucket, fi.path, so.url,
            row_number() over (order by case so.slot when 'detail' then 0 when 'front' then 1 when 'back' then 2 else 3 end, so.created_at desc) o
          from public.sources so left join public.files fi on fi.id = so.file_id
          where so.product_id = pr.id and so.kind = 'packshot'
            and (fi.content_type like 'image/%' or (so.file_id is null and so.url ~ '^https://'))
          order by o limit 3
        ) y), '[]'),
      'parts', (select pp.parts from public.product_parts pp where pp.product_id = pr.id)) as p
    from public.campaign_products cp join public.products pr on pr.id = cp.product_id
    where cp.campaign_id = j.campaign_id
  ) q where jsonb_array_length(p -> 'pictures') > 0;
  if f.id is null or jsonb_array_length(products) = 0 then return null; end if;
  -- A map made from other photographs than these is made again.
  products := (
    select jsonb_agg(case
      when (select pp.photos from public.product_parts pp where pp.product_id = (p ->> 'id')::uuid)
        @> (select coalesce(array_agg((x ->> 'file_id')::uuid), '{}') from jsonb_array_elements(p -> 'pictures') x)
      then p else p || '{"parts": null}' end)
    from jsonb_array_elements(products) p);
  update public.candidates set details_at = now(), details = null where id = c.id;
  return jsonb_build_object(
    'candidate_id', c.id, 'workspace_id', c.workspace_id,
    'brand', jsonb_build_object('name', w.brand_name, 'language', w.language),
    'picture', jsonb_build_object('bucket', f.bucket, 'path', f.path, 'width', f.width, 'height', f.height),
    'products', products,
    'store', jsonb_build_object('bucket', 'workspace-files', 'prefix', c.workspace_id || '/check/' || c.id));
end $$;
revoke execute on function public.details_take(uuid) from public, anon, authenticated;
grant execute on function public.details_take(uuid) to service_role;
