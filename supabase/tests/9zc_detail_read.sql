-- The picture check reads the product's small print (20261105140000_detail_read.sql): a label that reads wrong flags
-- the picture's product truth, with its note; the crops are staff-only; the cost counts in the language model's week.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
set role authenticated;

select test.ok(not has_function_privilege('authenticated', 'public.details_take(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.details_finish(uuid, jsonb, numeric)', 'execute')
  and has_function_privilege('service_role', 'public.details_finish(uuid, jsonb, numeric)', 'execute'),
  'only the details function reads and records the small print');

reset role;
create temp table t9zc_take as select public.details_take(test.id('ecand')) as v;
select test.ok((select v is null or (jsonb_array_length(v -> 'products') > 0 and v #>> '{store,prefix}' like '%/check/%') from t9zc_take),
  'the function gets the product''s photographs to read against, or nothing to do');
select test.ok((select v is null from t9zc_take) or public.details_take(test.id('ecand')) is null, 'a read under way is not taken twice');
update public.candidates set evaluation = '{"productTruth":"pass","brandRules":"pass","artefacts":"none","notes":[],"evaluated":true}'
where id = test.id('ecand');
create temp table t9zc as select (public.fume_llm_budget() ->> 'spent_usd')::numeric as before;
select public.details_finish(test.id('ecand'), '[{"n":1,"what":"collar label","box":{"x":0.5,"y":0.2,"w":0.1,"h":0.05},"reads":"DRESSMEANN","expected":"Dressmann","ok":false,"note":"The collar label reads DRESSMEANN; on the product it reads Dressmann."},{"n":2,"what":"button","box":{"x":0.5,"y":0.4,"w":0.05,"h":0.05},"reads":"","expected":"","ok":true}]', 0.002);
select test.ok((select evaluation ->> 'productTruth' = 'flag' and evaluation -> 'notes' ? 'The collar label reads DRESSMEANN; on the product it reads Dressmann.'
    and jsonb_array_length(details) = 2 and details_usd = 0.002 from public.candidates where id = test.id('ecand')),
  'a label that reads wrong flags product truth, with its note');
select test.ok((public.fume_llm_budget() ->> 'spent_usd')::numeric >= (select before from t9zc) + 0.002, 'the language model''s week counts it');
select public.details_finish(test.id('ecand'), '[{"n":1,"what":"collar label","box":{"x":0.5,"y":0.2,"w":0.1,"h":0.05},"reads":"DRESSMEANN","expected":"Dressmann","ok":false,"note":"The collar label reads DRESSMEANN; on the product it reads Dressmann."}]', 0);
select test.ok((select jsonb_array_length(evaluation -> 'notes') = 1 from public.candidates where id = test.id('ecand')),
  'read again, the note is there once');
select public.details_finish(test.id('ecand'), '[]', 0);
select test.ok((select details = '[]' and details_usd = 0.002 from public.candidates where id = test.id('ecand')), 'a new read replaces the old');
select test.refuses($$ select public.details_finish(test.id('ecand'), '{"a":1}', 0) $$, 'invalid', 'the details are a list');

set role authenticated;
select test.act('marcus@fumecreatives.com');
select test.ok(app.can_read_object(test.id('lysne') || '/check/' || test.id('ecand') || '-1.png')
  and app.can_read_object(test.id('lysne') || '/check/' || test.id('ecand') || '-1-ref.png')
  and not app.can_read_object(test.id('lysne') || '/check/' || test.id('ecand') || '-x.png'), 'a designer sees the crops');
select test.act('marcus+lysne@fumecreatives.com');
select test.ok(not app.can_read_object(test.id('lysne') || '/check/' || test.id('ecand') || '-1.png'), 'a customer does not');

select test.ok(true, 'all of the detail read tests passed');
