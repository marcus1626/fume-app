-- The catalogue (FLOWS §3.1): categories (a tree, made from the shop's product types on import) and collections
-- ("AW26", "Evening ritual") that group products. The brand's people and Fume's people on it place products.

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  parent_id uuid references public.product_categories (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index product_categories_name on public.product_categories (workspace_id, lower(name));
create index on public.product_categories (parent_id);

alter table public.products add column category_id uuid references public.product_categories (id) on delete set null;
create index on public.products (category_id);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  kind text not null default 'custom' check (kind in ('season', 'launch', 'line', 'custom')),
  starts_at timestamptz,
  ends_at timestamptz,
  description text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index on public.collections (workspace_id);
create index on public.collections (created_by);

create table public.collection_products (
  collection_id uuid not null references public.collections (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  primary key (collection_id, product_id)
);
create index on public.collection_products (product_id);
create index on public.collection_products (workspace_id);

alter table public.product_categories enable row level security;
alter table public.collections enable row level security;
alter table public.collection_products enable row level security;
create policy product_categories_read on public.product_categories for select to authenticated using (app.can_read(workspace_id));
create policy collections_read on public.collections for select to authenticated using (app.can_read(workspace_id));
create policy collection_products_read on public.collection_products for select to authenticated using (app.can_read(workspace_id));
grant select on public.product_categories, public.collections, public.collection_products to authenticated;

-- The category of this name in the brand, made when it is new; null for no name.
create or replace function app.category_named(ws uuid, p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  id_ uuid;
begin
  if nullif(trim(coalesce(p_name, '')), '') is null then return null; end if;
  select id into id_ from public.product_categories where workspace_id = ws and lower(name) = lower(trim(p_name));
  if id_ is null then
    insert into public.product_categories (workspace_id, name) values (ws, left(trim(p_name), 80))
    on conflict do nothing returning id into id_;
    if id_ is null then
      select id into id_ from public.product_categories where workspace_id = ws and lower(name) = lower(trim(p_name));
    end if;
  end if;
  return id_;
end $$;

create or replace function public.add_collection(
  p_workspace_id uuid, p_name text, p_kind text default 'custom', p_product_ids uuid[] default '{}'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c public.collections;
begin
  perform app.require_user();
  if not app.can_read(p_workspace_id) then perform app.fail('not_found', 'No such brand.'); end if;
  if not app.product_writer(p_workspace_id) then perform app.fail('forbidden', 'Only the people on the brand make its collections.'); end if;
  if nullif(trim(coalesce(p_name, '')), '') is null then perform app.fail('invalid', 'Give the collection a name.'); end if;
  if p_kind not in ('season', 'launch', 'line', 'custom') then perform app.fail('invalid', 'No such kind of collection.'); end if;
  if exists (select 1 from unnest(coalesce(p_product_ids, '{}')) pid
             where not exists (select 1 from public.products p where p.id = pid and p.workspace_id = p_workspace_id)) then
    perform app.fail('not_found', 'No such product.');
  end if;
  insert into public.collections (workspace_id, name, kind, created_by) values (p_workspace_id, left(trim(p_name), 80), p_kind, auth.uid())
  returning * into c;
  insert into public.collection_products (collection_id, product_id, workspace_id)
  select c.id, pid, p_workspace_id from unnest(coalesce(p_product_ids, '{}')) pid on conflict do nothing;
  perform app.record(p_workspace_id, 'collection.added', 'collection', c.id, jsonb_build_object('name', c.name));
  return jsonb_build_object('id', c.id);
end $$;

-- A product's place: its category (p_set_category says whether to change it; null takes it out of any) and the
-- collections it is in (null leaves them as they are).
create or replace function public.set_product_place(
  p_product_id uuid, p_set_category boolean default false, p_category_id uuid default null, p_collection_ids uuid[] default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.products;
begin
  select * into p from public.products where id = p_product_id;
  if not found or not app.can_read(p.workspace_id) then perform app.fail('not_found', 'No such product.'); end if;
  if not app.product_writer(p.workspace_id) then perform app.fail('forbidden', 'Only the people on the brand place its products.'); end if;
  if p_set_category then
    if p_category_id is not null and not exists (select 1 from public.product_categories where id = p_category_id and workspace_id = p.workspace_id) then
      perform app.fail('not_found', 'No such category.');
    end if;
    update public.products set category_id = p_category_id where id = p.id;
  end if;
  if p_collection_ids is not null then
    if exists (select 1 from unnest(p_collection_ids) cid
               where not exists (select 1 from public.collections c where c.id = cid and c.workspace_id = p.workspace_id)) then
      perform app.fail('not_found', 'No such collection.');
    end if;
    delete from public.collection_products where product_id = p.id and not (collection_id = any (p_collection_ids));
    insert into public.collection_products (collection_id, product_id, workspace_id)
    select cid, p.id, p.workspace_id from unnest(p_collection_ids) cid on conflict do nothing;
  end if;
end $$;

create or replace function public.approve_import(p_import_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  j public.product_imports := app.import_of(p_import_id);
  f jsonb;
  p public.products;
  ids uuid[] := '{}';
  img text;
  n int;
begin
  if j.state <> 'review' then perform app.fail('invalid', 'This import is not waiting for review.'); end if;
  for f in select * from jsonb_array_elements(j.found) loop
    insert into public.products (workspace_id, name, variant, sku)
    values (j.workspace_id, f ->> 'name', coalesce(f ->> 'variant', ''),
            (select nullif(x ->> 'value', '') from jsonb_array_elements(f -> 'fields') x where x ->> 'fieldId' = 'sku' limit 1))
    returning * into p;
    update public.products set category_id = app.category_named(j.workspace_id,
      (select nullif(trim(x ->> 'value'), '') from jsonb_array_elements(f -> 'fields') x where x ->> 'fieldId' = 'type' limit 1))
    where id = p.id;
    ids := ids || p.id;
    n := 0;
    for img in select i #>> '{}' from jsonb_array_elements(f -> 'images') i loop
      n := n + 1;
      insert into public.sources (workspace_id, kind, name, url, retrieved_at, product_id, slot, created_by)
      values (j.workspace_id, 'packshot', p.name, img, j.created_at, p.id,
              case when n = 1 then 'front' else 'site-' || n end, auth.uid());
    end loop;
    if nullif(f ->> 'source', '') is not null then
      insert into public.sources (workspace_id, kind, name, url, retrieved_at, product_id, created_by)
      values (j.workspace_id, 'website', regexp_replace(f ->> 'source', '^https?://', ''), f ->> 'source', j.created_at, p.id, auth.uid());
    end if;
  end loop;
  update public.product_imports set state = 'done', approved_by = auth.uid(), approved_at = now(),
    result = jsonb_build_object('productIds', to_jsonb(ids), 'added', coalesce(array_length(ids, 1), 0), 'updated', 0)
  where id = j.id returning * into j;
  perform app.record(j.workspace_id, 'products.imported', 'product_import', j.id,
    jsonb_build_object('added', coalesce(array_length(ids, 1), 0)));
  return to_jsonb(j);
end $$;


-- The shop's product types of what was imported before become categories.
do $$
declare
  j public.product_imports;
  i int;
begin
  for j in select * from public.product_imports where state = 'done' and result ? 'productIds' loop
    for i in 0 .. jsonb_array_length(j.result -> 'productIds') - 1 loop
      update public.products set category_id = app.category_named(j.workspace_id,
        (select nullif(trim(x ->> 'value'), '') from jsonb_array_elements(j.found -> i -> 'fields') x where x ->> 'fieldId' = 'type' limit 1))
      where id = (j.result -> 'productIds' ->> i)::uuid and category_id is null;
    end loop;
  end loop;
end $$;

revoke execute on function app.category_named(uuid, text) from public, anon, authenticated;
revoke execute on function public.add_collection(uuid, text, text, uuid[]), public.set_product_place(uuid, boolean, uuid, uuid[]) from public, anon;
grant execute on function public.add_collection(uuid, text, text, uuid[]), public.set_product_place(uuid, boolean, uuid, uuid[]) to authenticated;
