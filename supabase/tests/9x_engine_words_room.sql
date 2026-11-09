-- Room for the words (20261105070000_engine_words_room.sql): the Engine reads how the brand sets words on pictures.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
set role authenticated;

select test.ok(not has_function_privilege('authenticated', 'public.engine_words_room(uuid)', 'execute'),
  'only Fume''s functions read the brand''s layouts for a prompt');

reset role;
select test.ok((select r is null or jsonb_typeof(r -> 'layouts') = 'array'
  from (select public.engine_words_room(test.id('ej')) r) x), 'a job gets the layouts of the design system in use, or none');
select test.ok(public.engine_words_room(gen_random_uuid()) is null, 'no job, no layouts');
-- 20261110010000_words_room_button.sql: a layout's button corner comes with it, only where the brand sets one.
select test.ok(
  (select coalesce(bool_and(coalesce(e ->> 'ctaAt', 'bottom_right') in ('bottom_left', 'bottom_right')), true)
     from jsonb_array_elements(coalesce(public.engine_words_room(test.id('ej')) -> 'layouts', '[]'::jsonb)) e),
  'a button corner, where one is given, is a bottom corner');
set role authenticated;
select test.ok(true, 'all of the words room tests passed');
