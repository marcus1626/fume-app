-- Products for a new brand: add one by hand, or import them from the website (and later a CSV). The edge function
-- `product-import` reads the shop (Shopify's product feed, else the product pages' structured data) and saves what it
-- found here as an import waiting for review; the brand keeps, fixes, merges or removes each one and approves the
-- rest, and they land in the catalogue with the website's pictures. A product already in the catalogue under the same
-- name and variant is counted as unchanged, not offered again.
-- Also: a Brand DNA item added by Fume's or the agency's people is origin 'fume' (the contract's Origin), not 'expert'.

-- ─── The import ──────────────────────────────────────────────────────────────

create table public.product_imports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  source text not null default 'website' check (source in ('website', 'csv', 'zip')),
  url text,
  file_name text,
  state text not null default 'review' check (state in ('review', 'done', 'dismissed')),
  -- FoundProduct[] in the contract's shape (contract/entities/products.ts).
  found jsonb not null default '[]',
  unchanged int not null default 0,
  unchanged_names text[] not null default '{}',
  counts jsonb not null default '[]',
  log text[] not null default '{}',
  result jsonb,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz
);
create index on public.product_imports (workspace_id, created_at desc);
create index on public.product_imports (created_by);
create index on public.product_imports (approved_by);
alter table public.product_imports enable row level security;
create policy product_imports_read on public.product_imports for select to authenticated using (app.can_read(workspace_id));
grant select on public.product_imports to authenticated;

-- Who adds products: anyone on the brand's side, and the people who run the brand (Fume's or the agency's).
create or replace function app.product_writer(ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_staff(ws, array['designer', 'account_manager']) or app.customer_role(ws) is not null or app.is_admin()
$$;
revoke execute on function app.product_writer(uuid) from public, anon;

create or replace function app.import_of(p_id uuid) returns public.product_imports
language plpgsql security definer set search_path = '' as $$
declare
  j public.product_imports;
begin
  perform app.require_user();
  select * into j from public.product_imports where id = p_id for update;
  if not found or not app.can_read(j.workspace_id) then perform app.fail('not_found', 'No such import.'); end if;
  if not app.product_writer(j.workspace_id) then perform app.fail('forbidden', 'Only the people on the brand import its products.'); end if;
  return j;
end $$;
revoke execute on function app.import_of(uuid) from public, anon;

-- One found product, tidied: an id, a name, the lists it needs, status new.
create or replace function app.found_item(x jsonb, n int) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'id', coalesce(nullif(x ->> 'id', ''), 'f' || n),
    'status', 'new',
    'name', left(trim(x ->> 'name'), 200),
    'variant', left(trim(coalesce(x ->> 'variant', '')), 120),
    'confidence', coalesce(nullif(x ->> 'confidence', ''), 'medium'),
    'images', coalesce((select jsonb_agg(i) from (
      select i from jsonb_array_elements(case when jsonb_typeof(x -> 'images') = 'array' then x -> 'images' else '[]' end) i
      where jsonb_typeof(i) = 'string' and i #>> '{}' ~ '^https://' limit 8) s), '[]'),
    'files', case when jsonb_typeof(x -> 'files') = 'array' then x -> 'files' else '[]' end,
    'fields', case when jsonb_typeof(x -> 'fields') = 'array' then x -> 'fields' else '[]' end)
    || case when nullif(x ->> 'source', '') is not null then jsonb_build_object('source', x ->> 'source') else '{}' end
    || case when nullif(x ->> 'note', '') is not null then jsonb_build_object('note', x ->> 'note') else '{}' end
$$;
revoke execute on function app.found_item(jsonb, int) from public, anon;

-- What the reading found. An earlier import still open gives way to this one.
create or replace function public.save_product_import(
  p_workspace_id uuid, p_source text, p_url text, p_found jsonb, p_file_name text default null,
  p_log text[] default '{}'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  j public.product_imports;
  items jsonb := '[]';
  same text[] := '{}';
  x jsonb;
  n int := 0;
begin
  perform app.require_user();
  if not app.can_read(p_workspace_id) then perform app.fail('not_found', 'No such brand.'); end if;
  if not app.product_writer(p_workspace_id) then perform app.fail('forbidden', 'Only the people on the brand import its products.'); end if;
  if jsonb_typeof(p_found) <> 'array' then perform app.fail('invalid', 'Nothing was read.'); end if;
  for x in select * from jsonb_array_elements(p_found) loop
    n := n + 1;
    continue when nullif(trim(coalesce(x ->> 'name', '')), '') is null;
    if exists (select 1 from public.products p where p.workspace_id = p_workspace_id
               and lower(p.name) = lower(trim(x ->> 'name')) and lower(p.variant) = lower(trim(coalesce(x ->> 'variant', '')))) then
      same := same || trim(x ->> 'name');
    elsif not exists (select 1 from jsonb_array_elements(items) y
                      where lower(y ->> 'name') = lower(trim(x ->> 'name'))
                        and lower(y ->> 'variant') = lower(trim(coalesce(x ->> 'variant', '')))) then
      items := items || jsonb_build_array(app.found_item(x, n));
    end if;
  end loop;
  update public.product_imports set state = 'dismissed' where workspace_id = p_workspace_id and state = 'review';
  insert into public.product_imports (workspace_id, source, url, file_name, found, unchanged, unchanged_names, counts, log, created_by)
  values (p_workspace_id, coalesce(p_source, 'website'), nullif(trim(coalesce(p_url, '')), ''), p_file_name, items,
          coalesce(array_length(same, 1), 0), same[1:20],
          jsonb_build_array(jsonb_build_object('label', 'Products found', 'n', jsonb_array_length(items) + coalesce(array_length(same, 1), 0))),
          coalesce(p_log, '{}'), auth.uid())
  returning * into j;
  if p_source = 'website' and nullif(trim(coalesce(p_url, '')), '') is not null and not exists (
    select 1 from public.sources where workspace_id = p_workspace_id and kind = 'website' and url = trim(p_url) and product_id is null
  ) then
    insert into public.sources (workspace_id, kind, name, url, retrieved_at, created_by)
    values (p_workspace_id, 'website', regexp_replace(trim(p_url), '^https?://', ''), trim(p_url), now(), auth.uid());
  end if;
  perform app.record(p_workspace_id, 'products.read', 'product_import', j.id,
    jsonb_build_object('source', j.source, 'found', jsonb_array_length(items), 'unchanged', j.unchanged));
  return to_jsonb(j);
end $$;

-- Her answer on one found product: keep, fix, merge into another, or remove.
create or replace function public.decide_found(p_import_id uuid, p_found_id text, p_decision jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  j public.product_imports := app.import_of(p_import_id);
  v text := p_decision ->> 'verdict';
  f jsonb;
  into_item jsonb;
  list jsonb;
begin
  if j.state <> 'review' then perform app.fail('invalid', 'This import is not waiting for review.'); end if;
  select x into f from jsonb_array_elements(j.found) x where x ->> 'id' = p_found_id;
  if f is null then perform app.fail('not_found', 'No such product in this import.'); end if;
  list := (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(j.found) x where x ->> 'id' <> p_found_id);
  if v = 'keep' then
    f := f || '{"decision": "kept"}';
  elsif v = 'fix' then
    if nullif(trim(coalesce(p_decision ->> 'name', f ->> 'name')), '') is null then perform app.fail('invalid', 'A product needs a name.'); end if;
    f := f || jsonb_build_object('name', trim(coalesce(p_decision ->> 'name', f ->> 'name')),
      'variant', trim(coalesce(p_decision ->> 'variant', f ->> 'variant', '')), 'decision', 'fixed', 'status', 'new', 'confidence', 'high')
      || case when p_decision ? 'kindId' then jsonb_build_object('kindId', p_decision ->> 'kindId', 'kindConfidence', 'high') else '{}' end;
    f := f - 'note';
    if jsonb_typeof(p_decision -> 'fields') = 'array' then
      f := jsonb_set(f, '{fields}', (select coalesce(jsonb_agg(case when a is null then x else x || jsonb_build_object('value', a ->> 'value') end), '[]')
        from jsonb_array_elements(f -> 'fields') x
        left join lateral (select a from jsonb_array_elements(p_decision -> 'fields') a where a ->> 'fieldId' = x ->> 'fieldId' limit 1) l on true));
    end if;
  elsif v = 'merge' then
    select x into into_item from jsonb_array_elements(list) x where x ->> 'id' = p_decision ->> 'intoId';
    if into_item is null then perform app.fail('invalid', 'Pick another product to merge with.'); end if;
    into_item := into_item || jsonb_build_object(
      'images', (select coalesce(jsonb_agg(distinct i), '[]') from jsonb_array_elements((into_item -> 'images') || (f -> 'images')) i),
      'files', (into_item -> 'files') || (f -> 'files'));
    update public.product_imports set found = (select jsonb_agg(case when x ->> 'id' = into_item ->> 'id' then into_item else x end)
      from jsonb_array_elements(list) x) where id = j.id returning * into j;
    return to_jsonb(j);
  elsif v = 'remove' then
    update public.product_imports set found = list where id = j.id returning * into j;
    return to_jsonb(j);
  elsif v = 'split' then
    perform app.fail('invalid', 'There is nothing to split.');
  else
    perform app.fail('invalid', 'Keep, fix, merge or remove it.');
  end if;
  update public.product_imports set found = (select jsonb_agg(case when x ->> 'id' = p_found_id then f else x end)
    from jsonb_array_elements(j.found) x) where id = j.id returning * into j;
  return to_jsonb(j);
end $$;

-- Approve all that is left: each lands in the catalogue, with the website's pictures (the first is the front).
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

create or replace function public.dismiss_import(p_import_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  j public.product_imports := app.import_of(p_import_id);
begin
  update public.product_imports set state = 'dismissed' where id = j.id;
end $$;

-- ─── One product by hand ─────────────────────────────────────────────────────

create or replace function public.add_product(
  p_workspace_id uuid, p_name text, p_variant text default '', p_url text default null, p_key text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('ws', p_workspace_id, 'name', p_name, 'variant', p_variant, 'url', p_url);
  prior jsonb;
  p public.products;
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'add_product', req);
  if prior is not null then return prior; end if;
  if not app.can_read(p_workspace_id) then perform app.fail('not_found', 'No such brand.'); end if;
  if not app.product_writer(p_workspace_id) then perform app.fail('forbidden', 'Only the people on the brand add its products.'); end if;
  if nullif(trim(coalesce(p_name, '')), '') is null then perform app.fail('invalid', 'A product needs a name.'); end if;
  insert into public.products (workspace_id, name, variant)
  values (p_workspace_id, left(trim(p_name), 200), left(trim(coalesce(p_variant, '')), 120)) returning * into p;
  if nullif(trim(coalesce(p_url, '')), '') ~ '^https?://' then
    insert into public.sources (workspace_id, kind, name, url, retrieved_at, product_id, created_by)
    values (p_workspace_id, 'website', regexp_replace(trim(p_url), '^https?://', ''), trim(p_url), now(), p.id, auth.uid());
  end if;
  perform app.record(p_workspace_id, 'product.added', 'product', p.id, jsonb_build_object('name', p.name));
  return app.idem_end(p_key, 'add_product', req, to_jsonb(p));
end $$;

revoke execute on function public.save_product_import(uuid, text, text, jsonb, text, text[]),
  public.decide_found(uuid, text, jsonb), public.approve_import(uuid), public.dismiss_import(uuid),
  public.add_product(uuid, text, text, text, text) from public, anon;
grant execute on function public.save_product_import(uuid, text, text, jsonb, text, text[]),
  public.decide_found(uuid, text, jsonb), public.approve_import(uuid), public.dismiss_import(uuid),
  public.add_product(uuid, text, text, text, text) to authenticated;

-- ─── Brand DNA: what Fume's or the agency's people add is origin 'fume' ───────

create or replace function public.add_identity_item(p_workspace_id uuid, p_kind text, p_item jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  d public.brand_dna_versions;
  k text := app.identity_key(p_kind);
  item jsonb;
begin
  perform app.require_user();
  if not app.can_read(p_workspace_id) then perform app.fail('not_found', 'No such brand.'); end if;
  if not app.brand_writer(p_workspace_id) then perform app.fail('forbidden', 'Only the people who run the brand add to it.'); end if;
  if k is null or jsonb_typeof(p_item) <> 'object' then perform app.fail('invalid', 'Say what to add.'); end if;
  d := app.draft_dna(p_workspace_id);
  item := app.identity_items(jsonb_build_array(p_item || jsonb_build_object('provenance', jsonb_build_object(
    'origin', case when app.customer_role(p_workspace_id) is not null then 'customer' else 'fume' end,
    'state', case when app.customer_is(p_workspace_id, array['owner', 'approver']) then 'approved' else 'proposed' end,
    'by', auth.uid(), 'at', now())))) -> 0;
  update public.brand_dna_versions set identity = jsonb_set(identity, array[k], coalesce(identity -> k, '[]') || jsonb_build_array(item))
  where id = d.id;
  return item;
end $$;
