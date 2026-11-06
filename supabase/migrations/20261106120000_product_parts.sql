-- The validation machine (docs/mvp/product-parts.md): every part of the product checked on the picture against the
-- real product. Once per product, the `details` function maps the product's parts from its own photographs (the label,
-- the buttons and how many, the collar, the cuffs, the pockets, a zip, the pattern, the fabric, the finish, the shape).
-- Each picture's check then finds each part on the picture, crops it close beside the same part on the photograph, and
-- compares it; code decides counts and what is missing. The map is staff-only: it is the Engine's working knowledge,
-- not a fact the brand confirmed.

create table public.product_parts (
  product_id uuid primary key references public.products (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- [{"key", "kind", "what", "count", "looks", "photo", "box"}]: see docs/mvp/product-parts.md.
  parts jsonb not null default '[]' check (jsonb_typeof(parts) = 'array'),
  -- The photographs it was mapped from (file ids), so a new photograph maps it again.
  photos uuid[] not null default '{}',
  model text,
  llm_usd numeric(10, 6) not null default 0 check (llm_usd >= 0),
  made_at timestamptz not null default now()
);
alter table public.product_parts enable row level security;
create policy product_parts_read on public.product_parts for select to authenticated using (app.is_staff(workspace_id));
grant select on public.product_parts to authenticated;

-- What the function needs, now with each product's id, its photographs' file ids and its map when it has one for those
-- photographs.
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
        select jsonb_agg(jsonb_build_object('bucket', y.bucket, 'path', y.path, 'file_id', y.id) order by y.o)
        from (
          select fi.id, fi.bucket, fi.path,
            row_number() over (order by case so.slot when 'detail' then 0 when 'front' then 1 when 'back' then 2 else 3 end, so.created_at desc) o
          from public.sources so join public.files fi on fi.id = so.file_id
          where so.product_id = pr.id and so.kind = 'packshot' and fi.content_type like 'image/%'
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

-- The map, kept for the next picture of the product.
create or replace function public.product_parts_set(p_product_id uuid, p_parts jsonb, p_photos uuid[], p_model text, p_llm_usd numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare
  pr public.products;
begin
  if jsonb_typeof(coalesce(p_parts, 'null')) <> 'array' then perform app.fail('invalid', 'The parts are a list.'); end if;
  select * into pr from public.products where id = p_product_id;
  if not found then perform app.fail('not_found', 'No such product.'); end if;
  insert into public.product_parts (product_id, workspace_id, parts, photos, model, llm_usd, made_at)
  values (pr.id, pr.workspace_id, p_parts, coalesce(p_photos, '{}'), p_model, greatest(coalesce(p_llm_usd, 0), 0), now())
  on conflict (product_id) do update set parts = excluded.parts, photos = excluded.photos, model = excluded.model,
    llm_usd = public.product_parts.llm_usd + excluded.llm_usd, made_at = now();
end $$;
revoke execute on function public.product_parts_set(uuid, jsonb, uuid[], text, numeric) from public, anon, authenticated;
grant execute on function public.product_parts_set(uuid, jsonb, uuid[], text, numeric) to service_role;

-- The language model's week counts the maps.
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
      + coalesce((select sum(llm_usd) from public.product_parts where made_at > now() - interval '7 days'), 0)
    )::numeric as usd
  ), cap as (
    select coalesce((select (value #>> '{}')::numeric from app.settings where key = 'llm_week_usd'), 0) as usd
  )
  select jsonb_build_object('spent_usd', spent.usd, 'cap_usd', cap.usd, 'allowed', spent.usd < cap.usd) from spent, cap
$$;
