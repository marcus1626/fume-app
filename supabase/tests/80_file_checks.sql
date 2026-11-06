-- Fume checks the file of every version that goes to check (20261028090000_file_checks.sql).

\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;

select test.ok(not exists (select 1 from public.findings where version_id = test.id('mv1') and method = 'automated'),
  'a feed picture of 1080 × 1350 in JPEG passes the file check');

-- Pictures sent to check on the feed master, with what is wrong with each.
insert into public.files (id, workspace_id, path, name, content_type, bytes, width, height, purpose)
values ('0f000000-0000-4000-8000-0000000000a1', test.id('lysne'), 'fc/square.jpg', 'square.jpg', 'image/jpeg', 800000, 1080, 1080, 'candidate'),
       ('0f000000-0000-4000-8000-0000000000a2', test.id('lysne'), 'fc/small.png', 'small.png', 'image/png', 300000, 800, 1000, 'candidate'),
       ('0f000000-0000-4000-8000-0000000000a3', test.id('lysne'), 'fc/brief.pdf', 'brief.pdf', 'application/pdf', 40 * 1024 * 1024, null, null, 'candidate');
insert into public.creative_versions (id, workspace_id, creative_id, number, state, file_id)
values ('0f000000-0000-4000-8000-0000000000b1', test.id('lysne'), test.id('m'), 91, 'in_check', '0f000000-0000-4000-8000-0000000000a1'),
       ('0f000000-0000-4000-8000-0000000000b2', test.id('lysne'), test.id('m'), 92, 'in_check', '0f000000-0000-4000-8000-0000000000a2'),
       ('0f000000-0000-4000-8000-0000000000b3', test.id('lysne'), test.id('m'), 93, 'in_check', '0f000000-0000-4000-8000-0000000000a3');

select test.ok((select count(*) = 1 and bool_and(dimension = 'file_spec' and severity = 'major' and observed = '1080 × 1080'
  and expected like '1080 × 1350%') from public.findings where version_id = '0f000000-0000-4000-8000-0000000000b1'),
  'a square picture on a feed creative is found the wrong shape');
select test.ok((select count(*) = 1 and bool_and(finding like '%smaller%' and observed = '800 × 1000')
  from public.findings where version_id = '0f000000-0000-4000-8000-0000000000b2'),
  'a picture of the right shape but too small is found too small');
select test.ok((select count(*) = 3 and count(*) filter (where severity = 'major') = 1 and bool_and(method = 'automated')
  from public.findings where version_id = '0f000000-0000-4000-8000-0000000000b3'),
  'a PDF of unknown size and 40 MB is found three times');
select test.ok(not exists (select 1 from public.findings where version_id::text like '0f000000-0000-4000-8000-0000000000b%' and severity = 'critical'),
  'no file check is critical: the expert decides');

set role authenticated;
select test.act('marcus+lysne@fumecreatives.com');
select test.ok(not exists (select 1 from public.findings where version_id::text like '0f000000-0000-4000-8000-0000000000b%'), 'the customer never reads the file checks');
select test.act('marcus@fumecreatives.com');
select test.ok((select count(*) from public.findings where version_id::text like '0f000000-0000-4000-8000-0000000000b%') = 5, 'Fume''s team reads them');

reset role;
delete from public.creative_versions where number > 90 and creative_id = test.id('m');
delete from public.files where path like 'fc/%';
select test.ok(true, 'all of Fume''s file checks passed');
