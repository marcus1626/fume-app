-- A product read from the website, or added by hand, waits for the brand to confirm it: its owner or approver says
-- the name, variant and pictures are right (and every open fact with it). Until then it is "Waiting on you".

alter table public.products
  add column verified_by uuid references public.profiles (id),
  add column verified_at timestamptz;
create index if not exists products_verified_by_idx on public.products (verified_by);

create or replace function public.verify_product(p_product_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.products;
begin
  perform app.require_user();
  select * into p from public.products where id = p_product_id for update;
  if not found or not app.can_read(p.workspace_id) then perform app.fail('not_found', 'No such product.'); end if;
  if not (app.customer_is(p.workspace_id, array['owner', 'approver']) or app.is_admin()) then
    perform app.fail('forbidden', 'Only the brand''s owner or approver confirms its products.');
  end if;
  update public.product_facts set status = 'verified', verified_by = auth.uid(), verified_at = now()
  where product_id = p.id and superseded_by is null and status <> 'verified';
  update public.products set verified_by = auth.uid(), verified_at = now() where id = p.id returning * into p;
  perform app.record(p.workspace_id, 'product.verified', 'product', p.id, jsonb_build_object('name', p.name));
  return to_jsonb(p);
end $$;
revoke execute on function public.verify_product(uuid) from public, anon;
grant execute on function public.verify_product(uuid) to authenticated;
