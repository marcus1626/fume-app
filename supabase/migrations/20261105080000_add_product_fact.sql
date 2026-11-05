-- A fact the brand's people state themselves, such as this week's price ("Nå 199,- (før 399,-)"), the only thing
-- that lets a plan write a price (fume-plan's copy check, docs/mvp/brand-books.md). The brand's owner or approver
-- states it as true, so it is verified at once, as a correction is; anyone else who may add the brand's material
-- adds it for them to verify. A price is a claim fact: a plan's words rely on it by its id.
create or replace function public.add_product_fact(
  p_product_id uuid, p_area text, p_label text, p_statement text, p_key text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('product_id', p_product_id, 'area', p_area, 'label', p_label, 'statement', p_statement);
  prior jsonb;
  p public.products;
  nf public.product_facts;
  brand boolean;
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'add_product_fact', req);
  if prior is not null then return prior; end if;

  select * into p from public.products where id = p_product_id;
  if not found or not app.can_read(p.workspace_id) then
    perform app.fail('not_found', 'No such product.');
  end if;
  brand := app.customer_is(p.workspace_id, array['owner', 'approver']) or app.is_admin();
  if not (brand or app.customer_is(p.workspace_id, array['member']) or app.is_staff(p.workspace_id)) then
    perform app.fail('forbidden', 'Viewers cannot add product facts.');
  end if;
  if p_area not in ('shape', 'colour', 'material', 'label', 'packaging', 'claim', 'never') then
    perform app.fail('invalid', 'Unknown area.');
  end if;
  if coalesce(trim(p_label), '') = '' or coalesce(trim(p_statement), '') = '' or length(p_statement) > 500 or length(p_label) > 80 then
    perform app.fail('invalid', 'Write the fact in one short line, with a label.');
  end if;
  insert into public.product_facts (workspace_id, product_id, area, label, statement, origin, status, verified_by, verified_at, created_by)
  values (p.workspace_id, p.id, p_area, trim(p_label), trim(p_statement), 'supplied',
    case when brand then 'verified' else 'unverified' end,
    case when brand then auth.uid() end, case when brand then now() end, auth.uid())
  returning * into nf;
  perform app.record(p.workspace_id, 'fact.added', 'product_fact', nf.id, jsonb_build_object('label', nf.label, 'verified', brand));
  return app.idem_end(p_key, 'add_product_fact', req, to_jsonb(nf));
end $$;
revoke execute on function public.add_product_fact(uuid, text, text, text, text) from public, anon;
grant execute on function public.add_product_fact(uuid, text, text, text, text) to authenticated;
