-- The validation machine's part map (20261106120000_product_parts.sql): the map of each product's parts is kept once per
-- product, is staff-only, counts in the language model's week, and is made again from new photographs.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
set role authenticated;

select test.ok(not has_function_privilege('authenticated', 'public.product_parts_set(uuid, jsonb, uuid[], text, numeric)', 'execute')
  and has_function_privilege('service_role', 'public.product_parts_set(uuid, jsonb, uuid[], text, numeric)', 'execute'),
  'only the details function keeps a part map');

reset role;
create temp table t9zh as select (public.fume_llm_budget() ->> 'spent_usd')::numeric as before;
select public.product_parts_set(test.id('bench'), '[{"key":"legs","kind":"count","what":"legs","count":3,"looks":"three oak legs"}]',
  array[test.id('bench')], 'claude-haiku-5-5', 0.004);
select public.product_parts_set(test.id('bench'), '[{"key":"legs","kind":"count","what":"legs","count":4,"looks":"four oak legs"}]',
  array[test.id('bench')], 'claude-haiku-5-5', 0.001);
select test.ok((select parts #>> '{0,count}' = '4' and llm_usd = 0.005 from public.product_parts where product_id = test.id('bench')),
  'a new map replaces the old one, and both cost');
select test.ok((public.fume_llm_budget() ->> 'spent_usd')::numeric >= (select before from t9zh) + 0.005, 'the language model''s week counts it');
select test.refuses($$ select public.product_parts_set(test.id('bench'), '{"a":1}', '{}', null, 0) $$, 'invalid', 'the parts are a list');
select test.refuses($$ select public.product_parts_set(gen_random_uuid(), '[]', '{}', null, 0) $$, 'not_found', 'the product must exist');

set role authenticated;
select test.act('marcus@fumecreatives.com');
select test.ok(exists (select 1 from public.product_parts where product_id = test.id('bench')), 'a designer sees the map');
select test.act('marcus+lysne@fumecreatives.com');
select test.ok(not exists (select 1 from public.product_parts where product_id = test.id('bench')), 'a customer does not');

select test.ok(true, 'all of the product parts tests passed');
