-- The brand's own font files for the design system (20261105060000_brand_font_files.sql).

\set ON_ERROR_STOP 1
set client_min_messages = notice;
set role authenticated;

select test.ok(not has_function_privilege('authenticated', 'public.brand_font_files(uuid)', 'execute'),
  'only Fume''s functions read the font files this way');

reset role;
select test.ok(public.brand_font_files(test.id('lysne')) = '[]'::jsonb, 'a brand with no font files has none');
select test.keep('ff1', gen_random_uuid());
select test.keep('ff2', gen_random_uuid());
select test.keep('ff3', gen_random_uuid());
insert into public.files (id, workspace_id, bucket, path, name, content_type, bytes, purpose) values
  (test.id('ff1'), test.id('lysne'), 'workspace-files', test.id('lysne')::text || '/font-1.ttf', 'Lysne-Bold.ttf', 'application/octet-stream', 10, 'source'),
  (test.id('ff2'), test.id('lysne'), 'workspace-files', test.id('lysne')::text || '/font-2.otf', 'Lysne-Regular', 'font/otf', 10, 'source'),
  (test.id('ff3'), test.id('lysne'), 'workspace-files', test.id('lysne')::text || '/font-3.woff2', 'Lysne.woff2', 'font/woff2', 10, 'source');
insert into public.sources (workspace_id, kind, name, file_id) values
  (test.id('lysne'), 'font', 'Lysne Bold', test.id('ff1')),
  (test.id('lysne'), 'font', 'Lysne Regular', test.id('ff2')),
  (test.id('lysne'), 'font', 'Lysne web', test.id('ff3'));
select test.ok(jsonb_array_length(public.brand_font_files(test.id('lysne'))) = 2,
  'TrueType and OpenType files are read, by type or by name; a web font is not');
select test.ok(public.brand_font_files(test.id('solv')) = '[]'::jsonb, 'another brand never gets them');
delete from public.sources where file_id in (test.id('ff1'), test.id('ff2'), test.id('ff3'));
delete from public.files where id in (test.id('ff1'), test.id('ff2'), test.id('ff3'));
set role authenticated;
select test.ok(true, 'all of the brand font file tests passed');
