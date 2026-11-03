-- The agency's invitations carry the email's words (20261103223000_agency_invite_words.sql): the agency's name and
-- who invited; someone new is not joined yet.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;
set role authenticated;

select test.act('nora@brygga.test');
select test.keep('inv', (public.invite_agency_person(test.id('agency'), 'ida@brygga.test', null, null, 'creative') ->> 'id')::uuid);
select test.ok((select (r ->> 'agency_name') = 'Brygga Studio' and (r ->> 'inviter_name') = 'Nora Lie' and not (r ->> 'joined')::boolean
                from (select public.invite_agency_person(test.id('agency'), 'ida@brygga.test', null, null, 'creative') r) x),
  'the invitation names the agency and who invited, and the new person is not joined yet');
select test.refuses($$ select public.invite_agency_person(test.id('agency'), 'ida@brygga.test', null, null, 'operator') $$,
  'invalid', 'an operator seat waits for the Engine');

select test.ok(true, 'all of the agency invite word tests passed');
