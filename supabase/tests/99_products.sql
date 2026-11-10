-- Products for a new brand (20261103160000_product_import.sql): an import from the website waits for her review,
-- each found product is kept, fixed, merged or removed, approving lands them with their pictures, and a product
-- already in the catalogue is not offered again. On the agency's client from 97_agency.sql.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
set role authenticated;

select test.act('nora@brygga.test');
select test.keep('imp', (public.save_product_import(test.id('client'), 'website', 'https://halm.test', jsonb_build_array(
  jsonb_build_object('name', 'Oak chair', 'variant', '', 'images', jsonb_build_array('https://halm.test/oak.jpg', 'https://halm.test/oak-2.jpg', 'http://x.test/no.jpg'),
    'fields', jsonb_build_array(jsonb_build_object('fieldId', 'sku', 'label', 'SKU', 'value', 'OAK-1'),
      jsonb_build_object('fieldId', 'price', 'label', 'Price', 'value', '4 990 kr')), 'source', 'https://halm.test/products/oak'),
  jsonb_build_object('name', 'Oak chair', 'variant', ''),
  jsonb_build_object('name', 'Linen cushion', 'variant', 'Sand'),
  jsonb_build_object('name', 'Linen cushion (2)', 'variant', 'Sand', 'images', jsonb_build_array('https://halm.test/c2.jpg')),
  jsonb_build_object('name', 'Gift card'),
  jsonb_build_object('name', '  ')
)) ->> 'id')::uuid);
select test.ok((select state = 'review' and jsonb_array_length(found) = 4 and found #>> '{0,images,1}' = 'https://halm.test/oak-2.jpg'
    and jsonb_array_length(found -> 0 -> 'images') = 2
  from public.product_imports where id = test.id('imp')), 'a reading waits for review, once per product, https pictures only');

select test.act('jon@halm.test');
select test.ok((public.decide_found(test.id('imp'), 'f1', '{"verdict": "keep"}') #>> '{found,0,decision}') = 'kept',
  'anyone on the brand goes through what Fume found');
select test.ok((select x ->> 'variant' = 'Sand, 45 cm' and x ->> 'decision' = 'fixed' from jsonb_array_elements(
  public.decide_found(test.id('imp'), 'f3', '{"verdict": "fix", "variant": "Sand, 45 cm"}') -> 'found') x where x ->> 'id' = 'f3'),
  'she fixes one');
select test.ok((select jsonb_array_length(found) = 4 from public.product_imports where id = test.id('imp'))
  and (public.decide_found(test.id('imp'), 'f4', '{"verdict": "merge", "intoId": "f3"}') -> 'found') @> '[{"id": "f3", "images": ["https://halm.test/c2.jpg"]}]',
  'and merges a double into it');
select public.decide_found(test.id('imp'), 'f5', '{"verdict": "remove"}');
select test.refuses($$ select public.decide_found(test.id('imp'), 'f1', '{"verdict": "split"}') $$, 'invalid', 'a website product has nothing to split');

select test.act('user+solv@fumecreatives.com');
select test.refuses($$ select public.approve_import(test.id('imp')) $$, 'not_found', 'another brand cannot approve it');

select test.act('jon@halm.test');
select test.ok((public.approve_import(test.id('imp')) #>> '{result,added}') = '2', 'approving lands what is left');
select test.ok((select count(*) = 2 from public.sources s join public.products p on p.id = s.product_id
  where p.name = 'Oak chair' and s.kind = 'packshot') and exists (select 1 from public.sources s join public.products p on p.id = s.product_id
  where p.name = 'Oak chair' and s.kind = 'packshot' and s.slot = 'front' and s.url = 'https://halm.test/oak.jpg')
  and exists (select 1 from public.products where name = 'Oak chair' and sku = 'OAK-1'), 'with its pictures, the first as the front, and its SKU');
select test.refuses($$ select public.approve_import(test.id('imp')) $$, 'invalid', 'an import lands once');

select test.act('nora@brygga.test');
select test.ok((select (x ->> 'unchanged')::int = 1 and jsonb_array_length(x -> 'found') = 1 from (select public.save_product_import(test.id('client'), 'website', 'https://halm.test',
  '[{"name": "oak chair"}, {"name": "Stool"}]') x) s), 'reading again offers only what is new');
select test.ok((public.add_product(test.id('client'), 'Bench', '180 cm', 'https://halm.test/bench') ->> 'name') = 'Bench',
  'the agency adds one by hand');
select test.refuses($$ select public.add_product(test.id('client'), ' ') $$, 'invalid', 'a product needs a name');
select test.keep('bench', (public.add_product(test.id('client'), 'Stool', 'Oak', null, null, 'kind-furniture') ->> 'id')::uuid);
select test.ok((select kind_id = 'kind-furniture' from public.products where id = test.id('bench')), 'a product added by hand has its kind');

select test.act('jon@halm.test');
select test.ok((public.save_product_specs(test.id('bench'), null, '[{"fieldId": "height", "value": 45, "unit": "cm"}]') #>> '{specs,0,provenance,state}') = 'approved',
  'she fills in what Fume still needs, as hers');
select test.ok(jsonb_array_length(public.save_product_specs(test.id('bench'), null, '[]', '{}', array['height']) -> 'specs') = 0, 'and removes a value');
select test.refuses($$ select public.save_product_specs(test.id('bench'), null, '[{"value": 1}]') $$, 'invalid', 'a value needs its field');

select test.refuses($$ select public.verify_product(test.id('bench')) $$, 'forbidden', 'a member does not confirm a product');
select test.act('sara@halm.test');
select test.ok((public.verify_product(test.id('bench')) ->> 'verified_at') is not null, 'the owner confirms it');

select test.act('nora@brygga.test');
select test.ok((public.add_identity_item(test.id('client'), 'colour', '{"name": "Moss", "hex": "#4A5D3A", "role": "accent"}')
  #>> '{provenance,origin}') = 'fume', 'what the agency adds to the Brand DNA is from Fume''s side');

select test.act('user+solv@fumecreatives.com');
select test.refuses($$ select public.add_product(test.id('client'), 'Bench') $$, 'not_found', 'another brand cannot add to this one');
select test.ok(not exists (select 1 from public.product_imports where workspace_id = test.id('client')), 'nor see its imports');
reset role;
select test.ok(true, 'all of the product import''s tests passed');
