-- A product's own files (20261103218000_product_files.sql): the owner adds a dieline to the chair; a file of another
-- kind or from another brand is refused; someone off the brand adds nothing.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;
insert into storage.objects (bucket_id, name, owner_id)
select 'workspace-files', test.id('client') || '/chair-dieline.pdf', (select id::text from public.profiles where email = 'sara@halm.test');
set role authenticated;

select test.act('sara@halm.test');
select test.keep('dl', (public.register_file(test.id('client'), test.id('client') || '/chair-dieline.pdf', 'chair-dieline.pdf',
  'application/pdf', 120000, 'sha-dl', null, null, 'source') ->> 'id')::uuid);
select test.keep('pf', (public.add_product_file(test.id('chair'), 'dieline', test.id('dl')) ->> 'id')::uuid);
select test.ok((select kind = 'product_file' and slot = 'dieline' and product_id = test.id('chair') and name = 'chair-dieline.pdf'
  from public.sources where id = test.id('pf')), 'the dieline is a source of the chair');
select test.refuses(format('select public.add_product_file(%L, %L, %L)', test.id('chair'), 'poster', test.id('dl')),
  'invalid', 'a file has one of the product file kinds');
select test.refuses(format('select public.add_product_file(%L, %L, %L)', test.id('chair'), 'model', gen_random_uuid()),
  'invalid', 'the file must be uploaded to the brand first');

select test.act('jon@halm.test');
select test.refuses(format('select public.add_product_file(%L, %L, %L)', test.id('chair'), 'model', test.id('dl')),
  'not_found', 'off the brand, he adds nothing');

select test.ok(true, 'all of the product file tests passed');
