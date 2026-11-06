-- A product's own files, live: a 3D model, a dieline, label artwork, a tech pack, flats, CAD or a spec sheet. Each is a
-- source of the product (kind 'product_file', the file's kind in slot), so it sits with the product's pictures and
-- comes into the Brand Brain the same way. Anyone who may change the brand's products adds one.

alter table public.sources drop constraint sources_kind_check;
alter table public.sources add constraint sources_kind_check
  check (kind in ('logo', 'guideline', 'packshot', 'campaign', 'font', 'website', 'other', 'product_file'));

create or replace function public.add_product_file(p_product_id uuid, p_kind text, p_file_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.products;
  f public.files;
  s public.sources;
begin
  perform app.require_user();
  select * into p from public.products where id = p_product_id;
  if not found or not app.can_read(p.workspace_id) then perform app.fail('not_found', 'No such product.'); end if;
  if not app.product_writer(p.workspace_id) then
    perform app.fail('forbidden', 'Only the people on the brand add files to its products.');
  end if;
  if p_kind not in ('model', 'dieline', 'artwork', 'techpack', 'flats', 'cad', 'spec') then
    perform app.fail('invalid', 'Choose what kind of file it is.');
  end if;
  select * into f from public.files where id = p_file_id and workspace_id = p.workspace_id and purpose = 'source';
  if not found then perform app.fail('invalid', 'Upload the file to this brand first.'); end if;

  insert into public.sources (workspace_id, kind, name, file_id, product_id, slot, retrieved_at, created_by)
  values (p.workspace_id, 'product_file', f.name, f.id, p.id, p_kind, now(), auth.uid())
  returning * into s;
  perform app.record(p.workspace_id, 'source.added', 'source', s.id,
    jsonb_build_object('name', s.name, 'kind', s.kind, 'product_id', p.id, 'slot', p_kind));
  return jsonb_build_object('id', s.id, 'productId', p.id, 'kind', p_kind, 'name', f.name, 'bytes', f.bytes,
    'at', s.created_at, 'by', s.created_by);
end $$;

revoke execute on function public.add_product_file(uuid, text, uuid) from public, anon;
grant execute on function public.add_product_file(uuid, text, uuid) to authenticated;
