-- A product's own pictures are sources with the product and slot (20261028100000_product_pictures.sql).

\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;

insert into storage.objects (bucket_id, name, owner_id)
values ('workspace-files', test.id('lysne')::text || '/oil-front.jpg', (select id::text from public.profiles where email = 'marcus+lysne@fumecreatives.com')),
       ('workspace-files', test.id('lysne')::text || '/oil-front-2.jpg', (select id::text from public.profiles where email = 'marcus+lysne@fumecreatives.com'));
set role authenticated;

select test.act('marcus+lysne@fumecreatives.com');
select test.keep('pf1', (public.register_file(test.id('lysne'), test.id('lysne')::text || '/oil-front.jpg', 'oil-front.jpg', 'image/jpeg', 500000, 'sha-pf1', 1600, 2000) ->> 'id')::uuid);
select test.keep('ps1', (public.add_source(test.id('lysne'), 'packshot', 'oil-front.jpg', test.id('pf1'), test.id('oil'), 'front', 'pic-1') ->> 'id')::uuid);
select test.ok((public.add_source(test.id('lysne'), 'packshot', 'oil-front.jpg', test.id('pf1'), test.id('oil'), 'front', 'pic-1') ->> 'id')::uuid = test.id('ps1'),
  'the same key adds one picture');
select test.ok((select product_id = test.id('oil') and slot = 'front' and kind = 'packshot' and created_by = auth.uid() from public.sources where id = test.id('ps1')),
  'the customer adds the product''s front picture, kept with who added it');
select test.refuses($$ select public.add_source(test.id('lysne'), 'packshot', 'x', test.id('pf1'), null, 'front') $$, 'invalid', 'a slot belongs to a product');
select test.refuses($$ select public.add_source(test.id('lysne'), 'packshot', ' ', test.id('pf1'), test.id('oil'), 'front') $$, 'invalid', 'a source has a name');

select test.keep('pf2', (public.register_file(test.id('lysne'), test.id('lysne')::text || '/oil-front-2.jpg', 'oil-front-2.jpg', 'image/jpeg', 510000, 'sha-pf2', 1600, 2000) ->> 'id')::uuid);
select public.add_source(test.id('lysne'), 'packshot', 'oil-front-2.jpg', test.id('pf2'), test.id('oil'), 'front');
select test.ok((select count(*) from public.sources where product_id = test.id('oil') and slot = 'front') = 2,
  'a new front picture keeps the old one as history');

select test.act('user+solv@fumecreatives.com');
select test.refuses($$ select public.add_source(test.id('lysne'), 'packshot', 'x', test.id('pf1'), test.id('oil'), 'front') $$, 'not_found', 'another brand cannot add to LYSNE');
select test.ok(not exists (select 1 from public.sources where product_id = test.id('oil')), 'nor read LYSNE''s pictures');

select test.act('marcus@fumecreatives.com');
select test.ok((select count(*) from public.sources where product_id = test.id('oil')) = 2, 'Fume''s team reads them');

reset role;
delete from public.sources where product_id = test.id('oil');
select test.ok(true, 'all of Fume''s product picture tests passed');
