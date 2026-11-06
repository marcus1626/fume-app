-- The content calendar (20261103212000_calendar.sql): the client's owner plans a creative she may see, moves it and
-- takes it off; the agency's people plan too; someone off the brand neither sees nor plans.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;
set role authenticated;

reset role;
select test.keep('ca', (select creative_id from public.creative_versions where id = test.id('va')));
set role authenticated;

select test.act('sara@halm.test');
select test.keep('post', (public.schedule_post(test.id('ca'), 'p-ig-feed', '2026-11-20 09:00+01') ->> 'id')::uuid);
select test.ok((select count(*) = 1 from public.calendar_posts where id = test.id('post')), 'the owner plans a creative she sees');
select test.ok((public.move_post(test.id('post'), '2026-11-21 09:00+01') ->> 'start')::timestamptz = '2026-11-21 09:00+01', 'and moves it');
select test.refuses($$ select public.schedule_post(test.id('ca'), ' ', now()) $$, 'invalid', 'a post runs somewhere');

select test.act('nora@brygga.test');
select test.ok((public.schedule_post(test.id('ca'), 'p-ig-story', '2026-11-22 18:00+01') ->> 'placementId') = 'p-ig-story', 'the agency plans for its client');

select test.act('jon@halm.test');
select test.ok(not exists (select 1 from public.calendar_posts where id = test.id('post')), 'off the brand, he sees no post');
select test.refuses($$ select public.move_post(test.id('post'), now()) $$, 'not_found', 'and moves none');

select test.act('sara@halm.test');
select public.remove_post(test.id('post'));
select test.ok(not exists (select 1 from public.calendar_posts where id = test.id('post')), 'she takes it off');

select test.ok(true, 'all of the calendar tests passed');
