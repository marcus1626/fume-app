-- The catalogue (20261103217000_catalogue.sql): an import's product types become categories; the owner makes a
-- collection and places a product; someone off the brand does not.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;
set role authenticated;

select test.act('sara@halm.test');
select test.keep('imp2', (public.save_product_import(test.id('client'), 'website', 'https://halm.test', jsonb_build_array(
  jsonb_build_object('name', 'Oak stool', 'fields', jsonb_build_array(jsonb_build_object('fieldId', 'type', 'label', 'Type', 'value', 'Stools')),
    'images', '[]'::jsonb, 'files', '[]'::jsonb, 'confidence', 'high')), 'imp-cat') ->> 'id')::uuid);
select public.approve_import(test.id('imp2'));
select test.keep('stool', (select id from public.products where workspace_id = test.id('client') and name = 'Oak stool'));
select test.ok((select c.name = 'Stools' from public.products p join public.product_categories c on c.id = p.category_id where p.id = test.id('stool')),
  'the shop''s product type becomes its category');
select test.keep('aw', (public.add_collection(test.id('client'), 'AW26', 'season', array[test.id('stool')]) ->> 'id')::uuid);
select test.ok((select count(*) = 1 from public.collection_products where collection_id = test.id('aw')), 'a collection with its product');
select test.refuses($$ select public.add_collection(test.id('client'), ' ') $$, 'invalid', 'a collection has a name');
select public.set_product_place(test.id('chair'), true, (select category_id from public.products where id = test.id('stool')), array[test.id('aw')]);
select test.ok((select count(*) = 2 from public.collection_products where collection_id = test.id('aw')), 'she places the chair in it');
select public.set_product_place(test.id('chair'), true, null, '{}');
select test.ok((select category_id is null from public.products where id = test.id('chair'))
  and not exists (select 1 from public.collection_products where product_id = test.id('chair')), 'and takes it out again');

select test.act('jon@halm.test');
select test.refuses(format('select public.set_product_place(%L, false, null, %L)', test.id('stool'), '{}'), 'not_found', 'off the brand, he places nothing');

select test.ok(true, 'all of the catalogue tests passed');
