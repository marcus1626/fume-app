-- A campaign's products and collections (20261103219000_campaign_scope.sql): the owner gives a new campaign the AW26
-- collection and the chair; a stool added to AW26 later joins it; a campaign in production keeps its products.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;
set role authenticated;

select test.act('sara@halm.test');
select test.keep('sc', (public.create_campaign(test.id('client'), 'Winter', array[test.id('chair')]) ->> 'id')::uuid);
select public.set_campaign_scope(test.id('sc'), array[test.id('chair')], array[test.id('aw')]);
select test.ok((select count(*) = 2 from public.campaign_products where campaign_id = test.id('sc')),
  'the chair and the collection''s stool are in the campaign');
select test.ok((select count(*) = 1 from public.campaign_collections where campaign_id = test.id('sc')), 'and the collection');

select test.keep('bench', (public.add_product(test.id('client'), 'Oak bench') ->> 'id')::uuid);
select public.set_product_place(test.id('bench'), false, null, array[test.id('aw')]);
select test.ok(exists (select 1 from public.campaign_products where campaign_id = test.id('sc') and product_id = test.id('bench')),
  'a product added to the collection later joins the campaign');

select public.set_campaign_scope(test.id('sc'), array[test.id('chair')], '{}');
select test.ok((select count(*) = 1 from public.campaign_products where campaign_id = test.id('sc'))
  and not exists (select 1 from public.campaign_collections where campaign_id = test.id('sc')), 'she takes the collection out');
select test.refuses(format('select public.set_campaign_scope(%L, %L, %L)', test.id('sc'), '{}', '{}'), 'invalid',
  'a campaign keeps at least one product');
select test.refuses(format('select public.set_campaign_scope(%L, %L, %L)', test.id('hc'), array[test.id('chair')], '{}'),
  'invalid', 'a campaign in production keeps its products');

select test.act('jon@halm.test');
select test.refuses(format('select public.set_campaign_scope(%L, %L, %L)', test.id('sc'), array[test.id('chair')], '{}'),
  'not_found', 'off the brand, he changes nothing');

select test.ok(true, 'all of the campaign scope tests passed');
