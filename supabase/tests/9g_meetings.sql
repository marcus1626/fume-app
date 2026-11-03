-- Meetings with Fume (20261103215000_meetings.sql): the client's owner books a free slot with the agency lead (the
-- brand's account manager); the slot is gone for the next; the host gets a bell line; she cancels it.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;
set role authenticated;

select test.act('sara@halm.test');
select test.ok(jsonb_array_length(public.meeting_slots(test.id('client'))) = 6, 'six free slots');
select test.keep('meeting', (public.book_meeting(test.id('client'), (public.meeting_slots(test.id('client')) ->> 0)::timestamptz, 'The plan') ->> 'id')::uuid);
select test.ok((select host_id = test.signup('nora@brygga.test') and state = 'booked' from public.meetings where id = test.id('meeting')),
  'the meeting is with the brand''s person at Fume');
select test.ok(not exists (select 1 from jsonb_array_elements_text(public.meeting_slots(test.id('client'))) s
                           where s::timestamptz = (select at from public.meetings where id = test.id('meeting'))), 'the slot is taken');
select test.refuses(format('select public.book_meeting(%L, %L, %L)', test.id('client'), (select at from public.meetings where id = test.id('meeting')), 'Again'),
  'conflict', 'nobody books it twice');
select test.refuses(format('select public.book_meeting(%L, %L, %L)', test.id('client'), now() + interval '1 day', ' '), 'invalid', 'a meeting is about something');

select test.act('nora@brygga.test');
select test.ok(exists (select 1 from public.notifications where user_id = auth.uid() and group_key = 'meeting:' || test.id('meeting')),
  'the host gets a bell line');
select test.refuses(format('select public.book_meeting(%L, now() + interval %L, %L)', test.id('client'), '2 days', 'Mine'), 'forbidden',
  'Fume''s people do not book with themselves');

select test.act('sara@halm.test');
select test.ok((public.cancel_meeting(test.id('meeting')) ->> 'state') = 'cancelled', 'she cancels it');

select test.act('jon@halm.test');
select test.ok(not exists (select 1 from public.meetings where id = test.id('meeting')), 'off the brand, he sees no meeting');

select test.ok(true, 'all of the meeting tests passed');
