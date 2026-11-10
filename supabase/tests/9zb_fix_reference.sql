-- A fix finds the product's own part first (20261105120000_fix_reference.sql): where it was found is kept, and the
-- language model's cost counts in its week.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
set role authenticated;

select test.ok(not has_function_privilege('authenticated', 'public.fix_spent(uuid, numeric, jsonb)', 'execute')
  and has_function_privilege('service_role', 'public.fix_spent(uuid, numeric, jsonb)', 'execute'),
  'only the fix function records what finding the part cost');

select test.act('marcus@fumecreatives.com');
select test.keep('fx2', (public.fix_candidate(test.id('ecand'), '{"x":0.4,"y":0.2,"w":0.1,"h":0.06}',
  'The label reads Dresemann; it says Dressmann') ->> 'id')::uuid);

reset role;
create temp table t9zb as select (public.fume_llm_budget() ->> 'spent_usd')::numeric as before;
select public.fix_take(test.id('fx2')) is not null;
select public.fix_spent(test.id('fx2'), 0.004, '{"photo":1,"box":{"x":0.45,"y":0.17,"w":0.14,"h":0.05},"why":"the collar label"}');
select test.ok((select llm_usd = 0.004 and reference #>> '{box,x}' = '0.45' from public.picture_fixes where id = test.id('fx2')),
  'the fix keeps where the part was found and what finding it cost');
select test.ok((public.fume_llm_budget() ->> 'spent_usd')::numeric >= (select before from t9zb) + 0.004,
  'the language model''s week counts it');
select public.fix_spent(test.id('fx2'), 0.001, null);
select test.ok((select llm_usd = 0.005 and reference is not null from public.picture_fixes where id = test.id('fx2')),
  'a later cost adds up and keeps the part');
select public.fix_fail(test.id('fx2'), 'test', 0);
select public.fix_spent(test.id('fx2'), 1, null);
select test.ok((select llm_usd = 0.005 from public.picture_fixes where id = test.id('fx2')), 'a finished fix is not changed');

-- The fix's parts are read by staff only.
set role authenticated;
select test.act('marcus@fumecreatives.com');
select test.ok(app.can_read_object(test.id('lysne') || '/fix/' || test.id('fx2') || '-ref.png')
  and app.can_read_object(test.id('lysne') || '/fix/' || test.id('fx2') || '-redrawn.png')
  and not app.can_read_object(test.id('lysne') || '/fix/' || test.id('fx2') || '-other.png'),
  'a designer sees the parts of a fix');
select test.act('marcus+lysne@fumecreatives.com');
select test.ok(not app.can_read_object(test.id('lysne') || '/fix/' || test.id('fx2') || '-ref.png'), 'a customer does not');

select test.ok(true, 'all of the fix reference tests passed');
