-- A surgical fix on a picture (20261105100000_picture_fix.sql): a designer marks a part and says what is wrong; the
-- fixed picture is a new candidate of the same job, and its cost counts in the Engine's week.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
set role authenticated;

select test.ok(not has_function_privilege('authenticated', 'public.fix_take(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.fix_finish(uuid, jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.fix_fail(uuid, text, int)', 'execute')
  and has_function_privilege('service_role', 'public.fix_finish(uuid, jsonb)', 'execute'),
  'only the fix function takes and finishes a fix');

select test.act('marcus+lysne@fumecreatives.com');
select test.refuses($$ select public.fix_candidate(test.id('ecand'), '{"x":0.5,"y":0.3,"w":0.1,"h":0.06}', 'The label reads Dresemann') $$,
  'not_found', 'a customer never sees a candidate, nor fixes one');
select test.act('marcus@fumecreatives.com');
select test.refuses($$ select public.fix_candidate(test.id('ecand'), '{"x":0.5,"y":0.3,"w":0.1,"h":0.06}', '  ') $$,
  'invalid', 'a fix says what is wrong');
select test.refuses($$ select public.fix_candidate(test.id('ecand'), '{"x":0.95,"y":0.3,"w":0.1,"h":0.06}', 'Label') $$,
  'invalid', 'the part lies inside the picture');
select test.refuses($$ select public.fix_candidate(test.id('ecand'), '{"x":0,"y":0,"w":0.9,"h":0.9}', 'Everything') $$,
  'invalid', 'most of the picture is a new picture, not a fix');
select test.keep('fx', (public.fix_candidate(test.id('ecand'), '{"x":0.5,"y":0.3,"w":0.1,"h":0.06}',
  'The label reads Dresemann; it says Dressmann') ->> 'id')::uuid);
select test.ok((public.fix_candidate(test.id('ecand'), '{"x":0.5,"y":0.3,"w":0.1,"h":0.06}', 'Again') ->> 'id')::uuid = test.id('fx'),
  'asking again while one is made returns it');

reset role;
create temp table t9za (k text primary key, v jsonb);
insert into t9za values ('take', public.fix_take(test.id('fx')));
select test.ok(public.fix_take(test.id('fx')) is null, 'a fix being made is not taken twice');
select test.ok((select v ->> 'ask' = 'The label reads Dresemann; it says Dressmann'
    and (v #>> '{box,w}')::numeric = 0.1
    and v #>> '{picture,path}' = test.id('lysne') || '/engine/e1.png'
    and v #>> '{store,png}' = test.id('lysne') || '/fix/' || test.id('fx') || '.png'
    and jsonb_typeof(v -> 'products') = 'array'
  from t9za where k = 'take'),
  'the function gets the picture, the part, what is wrong and where to store the result');

select test.refuses($$ select public.fix_finish(test.id('fx'), '{"png":{"path":"elsewhere.png"}}') $$,
  'invalid', 'the fix is stored where it was told');
select test.ok(public.fume_engine_budget() is not null, 'the Engine''s week is read');
create temp table t9za_spent as select app.engine_spent_usd() as before;
insert into t9za values ('res', public.fix_finish(test.id('fx'), jsonb_build_object(
  'png', jsonb_build_object('path', test.id('lysne') || '/fix/' || test.id('fx') || '.png', 'bytes', 900, 'sha256', 'aa'),
  'width', 1856, 'height', 2304, 'prompt', 'Redraw the label', 'model', 'nano-banana-pro', 'cost_cents', 15, 'ms', 30000)));
select test.keep('fcand', (select (v ->> 'candidate_id')::uuid from t9za where k = 'res'));
select test.ok((select c.fixed_from = test.id('ecand') and c.designed_from is null
    and c.job_id = (select job_id from public.candidates where id = test.id('ecand'))
    and f.purpose = 'candidate' and f.content_type = 'image/png' and c.note like 'Fixed by Fume: The label reads%'
  from public.candidates c join public.files f on f.id = c.file_id where c.id = test.id('fcand')),
  'the fixed picture is a candidate of the same job, knowing the picture it was fixed from');
select test.ok((select state = 'made' and cost_cents = 15 and model = 'nano-banana-pro' and result_candidate_id = test.id('fcand')
  from public.picture_fixes where id = test.id('fx')), 'the fix keeps what it asked, of which model, and its cost');
select test.ok(app.engine_spent_usd() >= (select before from t9za_spent) + 0.15, 'the Engine''s week counts the fix');
select test.refuses($$ select public.fix_finish(test.id('fx'), '{}') $$, 'conflict', 'a fix is finished once');

-- A designed picture is fixed under its words.
set role authenticated;
select test.act('marcus@fumecreatives.com');
select test.ok((select (public.fix_candidate(c.id, '{"x":0.1,"y":0.1,"w":0.2,"h":0.2}', 'Label') ->> 'candidate_id')::uuid = c.designed_from
  from public.candidates c where c.designed_from is not null and c.workspace_id = test.id('lysne') limit 1),
  'a fix on a designed picture fixes the picture under the words');
reset role;
select public.fix_fail(x.id, 'fal was down', 0) from public.picture_fixes x where x.state = 'fixing';
select test.ok(not exists (select 1 from public.picture_fixes where state = 'fixing'), 'a failed fix says why');

set role authenticated;
select test.ok(true, 'all of the picture fix tests passed');
