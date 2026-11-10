-- Onboarding progress (20261103211000_onboarding_progress.sql): it moves forward, never back; lines merge by id; a
-- viewer and people off the brand cannot move it.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;
set role authenticated;

select test.act('sara@halm.test');
select test.ok((public.save_onboarding_progress(test.id('client'), 'scan') ->> 'step') = 'scan', 'she reaches the scan');
select test.ok((public.save_onboarding_progress(test.id('client'), 'review') ->> 'part') = 'logo', 'the review starts at the logo');
select test.ok((public.save_onboarding_progress(test.id('client'), 'review', 'imagery') ->> 'part') = 'imagery', 'and moves to the pictures');
select test.ok((public.save_onboarding_progress(test.id('client'), 'review', 'colour') ->> 'part') = 'imagery', 'never back');
select test.ok((public.save_onboarding_progress(test.id('client'), 'scan') ->> 'step') = 'review', 'not to an earlier step either');
select public.save_onboarding_progress(test.id('client'), null, null, '{"id":"light","verdict":"not_quite","reason":"Warmer"}');
select test.ok(jsonb_array_length(public.save_onboarding_progress(test.id('client'), null, null, '{"id":"light","verdict":"right"}') -> 'lines') = 1,
  'a line she answers again replaces her first word');
select test.refuses($$ select public.save_onboarding_progress(test.id('client'), 'done') $$, 'invalid', 'only the steps there are');
select test.ok((select step = 'review' from public.onboarding_progress where workspace_id = test.id('client')), 'her people read it');

select test.act('jon@halm.test');
select test.refuses($$ select public.save_onboarding_progress(test.id('client'), 'taste') $$, 'forbidden', 'off the brand, he moves nothing');

select test.ok(true, 'all of the onboarding progress tests passed');
