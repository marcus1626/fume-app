-- Taste swipes (20261103213000_taste_swipes.sql), on the brand of 9b_taste.sql: the deck pairs measured pictures that
-- differ, the answers become swipe signals, answering again replaces them, and the state says what Fume learned.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;
set role authenticated;

select test.act('sara@halm.test');
select test.ok(jsonb_array_length(public.taste_deck(test.id('client')) -> 'cards') >= 1, 'the deck has cards from the measured pictures');
select test.ok(not exists (select 1 from public.taste_cards c where c.kind = 'pair' and c.a_signal = c.b_signal), 'a pair shows two pictures');
select test.keep('pair', (select id from public.taste_cards where workspace_id = test.id('client') and kind = 'pair' order by created_at limit 1));
select test.ok((public.answer_taste_card(test.id('pair'), 'a', 'Warmer') #>> '{card,answer}') = 'a', 'she picks one');
select test.ok((select count(*) = 2 from public.taste_signals where ref_table = 'taste_cards' and ref_key like test.id('pair') || ':%'),
  'it becomes a liked and a disliked signal');
select test.ok((select verdict = 'liked' and reason = 'Warmer' from public.taste_signals where ref_key = test.id('pair') || ':w'), 'with her reason');
select public.answer_taste_card(test.id('pair'), 'b');
select test.ok((select count(*) = 2 from public.taste_signals where ref_table = 'taste_cards' and ref_key like test.id('pair') || ':%'),
  'answering again replaces what she said');
select test.ok((select reason = 'Warmer' from public.taste_cards where id = test.id('pair')) is not true, 'a new answer drops the old reason');
select test.ok(((public.taste_deck(test.id('client')) #>> '{state,answered}')::int) >= 1, 'the state counts her answers');
select test.ok((public.taste_deck(test.id('client')) #>> '{state,lastLesson}') is not null, 'and says what Fume learned');
select test.refuses(format('select public.answer_taste_card(%L, %L)', test.id('pair'), 'yes'), 'invalid', 'a pair is answered a, b or neither');

reset role;
select app.taste_sync(test.id('client'));
set role authenticated;
select test.ok((select count(*) = 2 from public.taste_signals where ref_table = 'taste_cards' and ref_key like test.id('pair') || ':%'),
  'gathering the evidence again keeps her swipes');

select test.act('jon@halm.test');
select test.refuses(format('select public.answer_taste_card(%L, %L)', test.id('pair'), 'a'), 'not_found', 'off the brand, he answers nothing');

select test.act('sara@halm.test');
select test.keep('ref', (public.add_taste_reference(test.id('client'), false, null, 'https://halm.test/glossy.jpg', 'Too glossy') ->> 'id')::uuid);
select test.ok((select verdict = 'disliked' and origin = 'reference' and reason = 'Too glossy' from public.taste_signals where id = test.id('ref')),
  'she adds a picture that is not us, with why');
select test.refuses($$ select public.add_taste_reference(test.id('client'), true, null, 'http://halm.test/x.jpg') $$, 'invalid', 'a picture Fume may open');
select public.remove_taste_reference(test.id('ref'));
select test.ok(not exists (select 1 from public.taste_signals where id = test.id('ref')), 'and takes it back');

select test.ok(true, 'all of the taste swipe tests passed');
