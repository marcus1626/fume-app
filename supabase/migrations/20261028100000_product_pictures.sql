-- A product's own pictures (acceptance script line 1: "sources open as files"). A picture the customer or Fume's team
-- adds to a product is a source of kind 'packshot' with the product and the reference slot it shows ("front", "back",
-- ...). The newest source of a slot is the product's picture there; older ones stay as history.

alter table public.sources
  add column product_id uuid references public.products (id) on delete cascade,
  add column slot text;
create index sources_product_id_idx on public.sources (product_id);

create or replace function public.add_source(
  p_workspace_id uuid, p_kind text, p_name text, p_file_id uuid,
  p_product_id uuid default null, p_slot text default null, p_key text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('workspace_id', p_workspace_id, 'kind', p_kind, 'name', p_name, 'file_id', p_file_id,
    'product_id', p_product_id, 'slot', p_slot);
  prior jsonb;
  s public.sources;
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'add_source', req);
  if prior is not null then return prior; end if;

  if not app.can_read(p_workspace_id) then
    perform app.fail('not_found', 'No such workspace.');
  end if;
  if not (app.customer_is(p_workspace_id, array['owner', 'approver', 'member']) or app.is_staff(p_workspace_id)) then
    perform app.fail('forbidden', 'Viewers cannot add sources.');
  end if;
  if coalesce(trim(p_name), '') = '' then
    perform app.fail('invalid', 'Name the source.');
  end if;
  if not exists (select 1 from public.files where id = p_file_id and workspace_id = p_workspace_id and purpose = 'source') then
    perform app.fail('invalid', 'Upload the file to this brand first.');
  end if;
  if p_product_id is not null and not exists (
    select 1 from public.products where id = p_product_id and workspace_id = p_workspace_id
  ) then
    perform app.fail('not_found', 'No such product.');
  end if;
  if p_slot is not null and p_product_id is null then
    perform app.fail('invalid', 'A picture of a slot belongs to a product.');
  end if;

  insert into public.sources (workspace_id, kind, name, file_id, product_id, slot, retrieved_at, created_by)
  values (p_workspace_id, p_kind, trim(p_name), p_file_id, p_product_id, nullif(trim(p_slot), ''), now(), auth.uid())
  returning * into s;
  perform app.record(s.workspace_id, 'source.added', 'source', s.id,
    jsonb_build_object('name', s.name, 'kind', s.kind, 'product_id', s.product_id, 'slot', s.slot));
  return app.idem_end(p_key, 'add_source', req, to_jsonb(s));
end $$;
revoke execute on function public.add_source(uuid, text, text, uuid, uuid, text, text) from public, anon;
grant execute on function public.add_source(uuid, text, text, uuid, uuid, text, text) to authenticated;
