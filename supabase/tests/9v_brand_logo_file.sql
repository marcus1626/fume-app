-- The brand's own logo file for the design system (20261105050000_brand_logo_file.sql).

\set ON_ERROR_STOP 1
set client_min_messages = notice;
set role authenticated;

select test.ok(not has_function_privilege('authenticated', 'public.brand_logo_file(uuid)', 'execute'),
  'only Fume''s functions read the logo file this way');

reset role;
select test.ok(public.brand_logo_file(test.id('lysne')) is null, 'a brand with no logo file has none');
select test.keep('lf', gen_random_uuid());
insert into public.files (id, workspace_id, bucket, path, name, content_type, bytes, purpose)
values (test.id('lf'), test.id('lysne'), 'workspace-files', test.id('lysne')::text || '/logo-test.svg', 'logo.svg', 'image/svg+xml', 10, 'source');
insert into public.sources (workspace_id, kind, name, file_id) values (test.id('lysne'), 'logo', 'LYSNE logo', test.id('lf'));
select test.ok(public.brand_logo_file(test.id('lysne')) ->> 'type' = 'image/svg+xml'
  and public.brand_logo_file(test.id('lysne')) ->> 'name' = 'LYSNE logo', 'the newest logo file the brand added is the one');
delete from public.sources where file_id = test.id('lf');
delete from public.files where id = test.id('lf');
set role authenticated;
select test.ok(true, 'all of the brand logo file tests passed');
