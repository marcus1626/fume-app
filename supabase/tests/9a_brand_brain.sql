-- The Brand Brain (20261103190000_brand_brain.sql): the graph mirrors the brand's tables (identity, products, facts,
-- pictures, campaigns), keeps notes nobody else holds, and gives one context bundle. On the agency's client from
-- 97_agency.sql, with the Brand DNA of 98 and the products of 99.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
set role authenticated;

select test.act('jon@halm.test');
create temp table ctx as select public.brain_context(test.id('client')) as c;
select test.ok((select jsonb_array_length(c -> 'identity') > 0 and jsonb_array_length(c -> 'products') >= 2 from ctx),
  'the graph is drawn from what the brand already has');
select test.ok(exists (select 1 from public.brain_nodes where workspace_id = test.id('client') and kind = 'colour' and label = 'Oak'),
  'its colours');
select test.ok(exists (select 1 from public.brain_edges e join public.brain_nodes p on p.id = e.to_id and p.kind = 'product'
    join public.brain_nodes s on s.id = e.from_id and s.kind = 'picture'
  where e.workspace_id = test.id('client') and e.kind = 'shows'), 'a picture shows its product');
select test.ok(exists (select 1 from public.brain_edges e join public.brain_nodes c on c.id = e.from_id and c.kind = 'campaign'
  where e.workspace_id = test.id('client') and e.kind = 'about'), 'a campaign is about its products');
select test.ok(exists (select 1 from public.brain_nodes where workspace_id = test.id('client') and layer = 'memory' and kind in ('approval', 'change')),
  'and what the brand approved or asked to change is remembered');

select test.keep('aud', (public.brain_note(test.id('client'), 'market', 'audience', 'Young families furnishing a first home') ->> 'id')::uuid);
select test.ok((select state = 'proposed' and origin = 'customer' from public.brain_nodes where id = test.id('aud')),
  'a member proposes an audience');
select test.refuses($$ select public.decide_brain_note(test.id('aud'), 'keep') $$, 'forbidden', 'a member does not decide it');

select test.act('sara@halm.test');
select test.ok((public.decide_brain_note(test.id('aud'), 'keep') ->> 'state') = 'approved', 'the owner keeps it');
select test.keep('oak', (select id from public.brain_nodes where workspace_id = test.id('client') and kind = 'product' and label like 'Oak chair%'));
select test.ok((public.brain_note(test.id('client'), 'taste', 'reference', 'Oak in low evening light, never studio white',
    jsonb_build_object('liked', true), jsonb_build_array(jsonb_build_object('to', test.id('oak'), 'kind', 'about'))) ->> 'state') = 'approved',
  'what she says is approved, and linked to the product');
select test.refuses($$ select public.decide_brain_note(test.id('oak'), 'remove') $$, 'invalid', 'a product is decided where it lives');
select test.refuses($$ select public.brain_note(test.id('client'), 'market', 'x', 'y', '{}',
  jsonb_build_array(jsonb_build_object('to', gen_random_uuid()))) $$, 'invalid', 'a note links only to what this brand knows');

-- A change to a table reaches the graph on the next read; what is gone from its table is gone from the graph.
select public.add_product(test.id('client'), 'Daybed', 'Linen');
select test.ok((select c -> 'products' @> '[{"product": "Daybed Linen"}]' from (select public.brain_context(test.id('client')) c) x),
  'a new product is in the next bundle');
reset role;
delete from public.products where name = 'Daybed';
set role authenticated;
select test.act('sara@halm.test');
select test.ok(not (public.brain_context(test.id('client')) -> 'products' @> '[{"product": "Daybed Linen"}]'), 'and gone when it is gone');
select test.ok((select c -> 'market' @> '[{"what": "Young families furnishing a first home", "confirmed": true}]'
    and c -> 'taste' @> '[{"confirmed": true}]' from (select public.brain_context(test.id('client')) c) x),
  'notes stay through a sync and are in the bundle');
select test.ok(exists (select 1 from public.brain_edges where from_id = (select id from public.brain_nodes where workspace_id = test.id('client') and kind = 'reference')
  and to_id = test.id('oak')), 'and so do the links people drew');

select test.act('user+solv@fumecreatives.com');
select test.refuses($$ select public.brain_context(test.id('client')) $$, 'not_found', 'another brand cannot read this one');
select test.ok(not exists (select 1 from public.brain_nodes where workspace_id = test.id('client')), 'nor see its graph');
reset role;
select test.ok(true, 'all of the Brand Brain''s tests passed');
