-- A finding set aside in Check can be opened again while the version waits (20261110030000_reopen_finding.sql).

\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;
select test.keep('rv', (select id from public.creative_versions where candidate_id = test.id('ecand') order by number desc limit 1));
update public.creative_versions set state = 'in_check' where id = test.id('rv');
insert into public.findings (workspace_id, version_id, method, dimension, severity, finding)
select workspace_id, id, 'automated', 'artefacts', 'major', 'An extra finger on the left hand.' from public.creative_versions where id = test.id('rv');
select test.keep('rf', (select id from public.findings where version_id = test.id('rv') and finding = 'An extra finger on the left hand.'));

set role authenticated;
select test.act('kristian@fumecreatives.com');
select public.resolve_finding(test.id('rf'), 'accepted');
select test.ok((public.reopen_finding(test.id('rf')) ->> 'status') = 'open', 'a finding set aside is opened again');
select test.ok((select resolved_by is null and resolved_at is null from public.findings where id = test.id('rf')),
  'and no longer carries the name of who set it aside');
select test.ok((public.reopen_finding(test.id('rf')) ->> 'status') = 'open', 'opening an open one changes nothing');

select test.act('marcus+lysne@fumecreatives.com');
select test.refuses($$ select public.reopen_finding(test.id('rf')) $$, 'not_found', 'a customer cannot touch a finding');

reset role;
update public.findings set status = 'accepted' where id = test.id('rf');
update public.creative_versions set state = 'checked' where id = test.id('rv');
set role authenticated;
select test.act('kristian@fumecreatives.com');
select test.refuses($$ select public.reopen_finding(test.id('rf')) $$, 'conflict', 'a checked version''s findings stay as they were');

reset role;
delete from public.findings where id = test.id('rf');
set role authenticated;
select test.ok(true, 'all of the reopen finding tests passed');
