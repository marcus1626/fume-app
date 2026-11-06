-- The team and the settings (20261103210000_team_settings.sql), on the agency's client from 97_agency.sql: only the
-- owner changes roles, takes people off and renames the brand; the package and its usage; the agency's licence.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;
set role authenticated;

select test.act('jon@halm.test');
select test.refuses($$ select public.change_role(test.id('client'), test.id('sara'), 'viewer') $$, 'forbidden', 'a member changes no roles');
select test.refuses($$ select public.update_workspace(test.id('client'), 'Mine') $$, 'forbidden', 'a member does not rename the brand');
select test.ok((public.package_usage(test.id('client')) #>> '{package,kind}') = 'core', 'with no package of its own, a brand has Core');
select test.ok((public.package_usage(test.id('client')) #>> '{usage,creativeCap}')::int = 27, 'Core makes 27 creatives a period');
select test.ok((public.package_usage(test.id('client')) #>> '{usage,creativesUsed}')::int >= 1, 'the creatives made this period count');

select test.act('sara@halm.test');
select test.ok((public.change_role(test.id('client'), test.id('jon'), 'approver') ->> 'role') = 'approver', 'the owner makes Jon an approver');
select test.ok((select role = 'approver' from public.memberships where user_id = test.id('jon') and workspace_id = test.id('client')), 'and it holds');
select test.refuses($$ select public.change_role(test.id('client'), test.id('sara'), 'viewer') $$, 'invalid', 'the owner stays the owner');
select test.refuses($$ select public.change_role(test.id('client'), test.id('jon'), 'owner') $$, 'invalid', 'ownership is not handed over here');
select test.ok((public.update_workspace(test.id('client'), ' Halm ', 'Sweden', null) ->> 'brandName') = 'Halm', 'the owner renames the brand');
select test.ok((select market = 'Sweden' and language = 'no' from public.workspaces where id = test.id('client')), 'what she left out stays');
select test.refuses($$ select public.update_workspace(test.id('client'), '  ') $$, 'invalid', 'a brand keeps a name');
select public.remove_member(test.id('client'), test.id('jon'));
select test.ok(not exists (select 1 from public.memberships where user_id = test.id('jon') and workspace_id = test.id('client')), 'the owner takes Jon off');
select test.ok(exists (select 1 from public.record_events where workspace_id = test.id('client') and action = 'member.removed'), 'the record keeps it');
select test.refuses($$ select public.remove_member(test.id('client'), test.id('sara')) $$, 'invalid', 'the owner stays on the brand');

select test.act('jon@halm.test');
select test.refuses($$ select public.package_usage(test.id('client')) $$, 'not_found', 'off the brand, he reads nothing of it');

select test.act('marcus@fumecreatives.com');
select test.ok((public.set_package(test.id('agency'), 'growth', 54, 'monthly', 1, 2, 4, 'Paid social for our clients') ->> 'creativeCap')::int = 54,
  'Fume''s admin sets the agency''s package');

select test.act('nora@brygga.test');
select test.ok((public.agency_licence() #>> '{seats,included}')::int = 4 and (public.agency_licence() #>> '{seats,used}')::int >= 1,
  'the licence counts the agency''s seats against what it includes');
select test.ok(jsonb_array_length(public.agency_licence() -> 'clients') >= 1, 'and its clients, each with what was made');
select test.refuses($$ select public.set_package(test.id('agency'), 'core', 27) $$, 'forbidden', 'only Fume sets a package');

select test.act('sara@halm.test');
select test.refuses($$ select public.agency_licence() $$, 'forbidden', 'the licence is the agency''s');

select test.ok(true, 'all of the team and settings tests passed');
