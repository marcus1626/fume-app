-- The Look Book (20261105040000_look_book.sql): the brand's photography, read from its own pictures, as the Engine's
-- prompts are written from it.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
set role authenticated;

select test.ok(not has_function_privilege('authenticated', 'public.engine_look(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.brand_look_pictures(uuid)', 'execute'),
  'only Fume''s functions read the pictures and the look for a prompt');

select test.act('william@fumecreatives.com');
select test.keep('lb', (public.write_brand_book(test.id('lysne'), 'look') ->> 'id')::uuid);
select test.refuses($$ select public.write_brand_book(test.id('lysne'), 'poster') $$, 'invalid', 'a Look Book is the third kind of book');

reset role;
select test.ok(public.brand_book_take(test.id('lb')) is not null, 'the writer takes it');
select test.ok(jsonb_typeof(public.brand_look_pictures(test.id('lysne'))) = 'array', 'the brand''s pictures to read the look from');
select test.refuses($$ select public.brand_book_finish(test.id('lb'), '{"camera":{},"light":{}}', '{}', 'test', 0) $$, 'invalid',
  'a Look Book without its colour, texture and what it never does is refused');
select public.brand_book_finish(test.id('lb'),
  '{"summary":"Low evening light","camera":{"capture":"full-frame"},"light":{"key":"lamp"},"colour":{"grade":"warm"},"texture":{"grain":"fine"},"never":["plastic skin"],"evidence":[{"picture":1}],"gaps":["x"]}',
  '{}', 'claude-sonnet-5-5', 0.2);
select test.ok((select public.engine_look(j.id) #>> '{body,light,key}' = 'lamp' and not (public.engine_look(j.id) -> 'body' ? 'evidence')
    and not (public.engine_look(j.id) -> 'body' ? 'gaps') and public.engine_look(j.id) ->> 'state' = 'draft'
  from public.production_jobs j where j.id = test.id('ej')),
  'the Engine reads the look for a job, even a draft, without its evidence and open questions');
select test.ok((public.fume_llm_budget() ->> 'spent_usd')::numeric >= 0.2, 'the stronger model''s cost counts in the week');
delete from public.brand_books where id = test.id('lb');
set role authenticated;
select test.ok(true, 'all of the look book tests passed');
