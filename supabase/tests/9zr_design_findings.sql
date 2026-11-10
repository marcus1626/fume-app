-- Fume's own look at a design reaches Check as automated findings (20261110040000_design_findings.sql).

\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;
-- The layer made in 9t_design_layer.sql, with what Fume's review and the measured checks found.
update public.design_layers set
  findings = '[{"severity":"critical","what":"The headline runs over the player''s arm.","by":"fume_review"},
               {"severity":"minor","what":"Not like the brand''s own work: no navy band.","by":"fume_review"},
               {"note":"no severity"}]'::jsonb,
  checks = '[{"check":"fits","node":"Headline","ok":false,"hard":true,"note":"Breaks inside a word: LEAGUE."},
             {"check":"busy","node":"Words","ok":false,"hard":false,"note":"A busy ground."},
             {"check":"contrast","node":"Words","ok":true,"hard":true,"note":"Reads."}]'::jsonb
where id = test.id('dl');
insert into public.creative_versions (workspace_id, creative_id, number, state, candidate_id)
select workspace_id, creative_id, (select max(number) + 1 from public.creative_versions x where x.creative_id = v.creative_id),
  'in_check', test.id('dcand')
from public.creative_versions v where candidate_id = test.id('ecand') order by number desc limit 1;
select test.keep('dv', (select id from public.creative_versions where candidate_id = test.id('dcand')));

select test.ok((select count(*) = 3 from public.findings where version_id = test.id('dv') and method = 'automated'),
  'a design sent to check carries what Fume found on it: the review''s points and the hard check that failed');
select test.ok((select severity = 'major' and dimension = 'composition' from public.findings
    where version_id = test.id('dv') and finding like 'The headline runs over%'),
  'a critical point of the review is major: a machine''s reading never stops a check on its own');
select test.ok((select dimension = 'brand_brief' and severity = 'minor' from public.findings
    where version_id = test.id('dv') and finding like 'Not like the brand%'), 'off brand goes under the brief');
select test.ok((select severity = 'major' from public.findings
    where version_id = test.id('dv') and finding = 'Headline: Breaks inside a word: LEAGUE.'), 'a failed measured check is major');
select test.ok(app.design_findings(test.id('dv')) = 0, 'the findings come once');

set role authenticated;
select test.act('marcus+lysne@fumecreatives.com');
select test.ok(not exists (select 1 from public.findings where version_id = test.id('dv')), 'a customer never reads them');
select test.act('marcus@fumecreatives.com');
select test.ok((select count(*) = 3 from public.findings where version_id = test.id('dv')), 'the checker reads them');

reset role;
delete from public.findings where version_id = test.id('dv');
delete from public.record_events where action = 'design.findings';
delete from public.creative_versions where id = test.id('dv');
set role authenticated;
select test.ok(true, 'all of the design findings tests passed');
