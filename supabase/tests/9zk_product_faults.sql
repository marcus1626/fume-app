-- A clear fault on the product stops the check until the expert decides (20261106150000_product_faults_stop_check.sql).

\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;
-- A version of the Engine's picture waiting for a check, with no other critical finding.
select test.keep('pv', (select id from public.creative_versions where candidate_id = test.id('ecand') order by number desc limit 1));
update public.creative_versions set state = 'in_check' where id = test.id('pv');
delete from public.findings where version_id = test.id('pv') and severity = 'critical';
select public.details_finish(test.id('ecand'), '[
  {"n":1,"kind":"part","part":"chest-pocket","what":"chest pocket","box":{"x":0.6,"y":0.4,"w":0.1,"h":0.1},"reads":"no pocket","expected":"A square patch pocket","ok":false,"note":"The picture shows 0 chest pocket; the product has 1."},
  {"n":2,"what":"collar label","reads":"DRESSMEANN","expected":"Dressmann","ok":false,"note":"The collar label reads DRESSMEANN; on the product it reads Dressmann."},
  {"n":3,"kind":"part","part":"cuffs","what":"cuffs","reads":"buttoned cuffs","expected":"buttoned cuffs","ok":true}]', 0);
select test.ok((select count(*) = 2 and bool_and(severity = 'critical' and status = 'open' and method = 'automated' and dimension = 'product')
    and bool_or(detail = 'chest-pocket' and finding = 'The picture shows 0 chest pocket; the product has 1.' and region ->> 'x' = '0.6'
                and expected = 'A square patch pocket' and observed = 'no pocket')
    and bool_or(detail = 'print:Dressmann')
  from public.findings where version_id = test.id('pv') and detail is not null),
  'each clear fault on the product is a critical finding on the version, with where, what was expected and what was seen');
select public.details_finish(test.id('ecand'), (select details from public.candidates where id = test.id('ecand')), 0);
select test.ok((select count(*) = 2 from public.findings where version_id = test.id('pv') and detail is not null),
  'read again, each fault is there once');

set role authenticated;
select test.act('kristian@fumecreatives.com');
select test.refuses($$ select public.mark_checked(test.id('pv')) $$, 'conflict', 'a clear fault on the product stops the check');
select public.resolve_finding(f.id, 'accepted') from public.findings f where f.version_id = test.id('pv') and f.detail = 'chest-pocket';
select test.refuses($$ select public.mark_checked(test.id('pv')) $$, 'conflict', 'until every one of them is decided');
select public.resolve_finding(f.id, 'accepted') from public.findings f where f.version_id = test.id('pv') and f.detail = 'print:Dressmann';
select test.ok((select bool_and(resolved_by = auth.uid()) from public.findings where version_id = test.id('pv') and detail is not null),
  'the expert who accepts a fault signs it');
select test.ok((public.mark_checked(test.id('pv')) ->> 'state') = 'checked', 'accepted by the expert, the version is checked');

reset role;
select public.details_finish(test.id('ecand'), (select details from public.candidates where id = test.id('ecand')), 0);
select test.ok((select count(*) = 2 and bool_and(status = 'accepted') from public.findings where version_id = test.id('pv') and detail is not null),
  'a fault the expert decided on is not raised again, and a checked version gets no new ones');
select public.details_finish(test.id('ecand'), '[]', 0);

set role authenticated;
select test.act('marcus+lysne@fumecreatives.com');
select test.ok((select count(*) = 0 from public.findings where version_id = test.id('pv')), 'the customer never reads them');
select test.ok(true, 'all of the product fault tests passed');
