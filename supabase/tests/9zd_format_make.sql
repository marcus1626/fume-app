-- A format made from the master's own picture (20261105160000_format_make.sql): a designer asks, the function crops
-- or expands the approved master, and the result is a candidate of the format's job; staff only.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
set role authenticated;

select test.ok(not has_function_privilege('authenticated', 'public.format_take(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.format_finish(uuid, jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.format_fail(uuid, text, int, numeric)', 'execute')
  and has_function_privilege('service_role', 'public.format_finish(uuid, jsonb)', 'execute'),
  'only the format function takes and finishes a format');

select test.act('marcus+lysne@fumecreatives.com');
select test.refuses($$ select public.make_format(test.id('st')) $$, 'forbidden', 'a customer never makes a format');
select test.act('marcus@fumecreatives.com');
select test.refuses($$ select public.make_format(test.id('m')) $$, 'invalid', 'a master is not made from itself');
select test.refuses($$ select public.make_format(test.id('st'), 'stretch') $$, 'invalid', 'crop or expand');
select test.refuses($$ select public.make_format(test.id('st'), 'crop', '{"x":0.6,"y":0,"w":0.6,"h":1}') $$, 'invalid', 'a crop window lies inside the master');
select test.refuses($$ select public.make_format(test.id('sq')) $$, 'conflict', 'a format with a version follows the expert''s correction');
select test.keep('fm', (public.make_format(test.id('st')) ->> 'id')::uuid);
select test.ok((public.make_format(test.id('st')) ->> 'id')::uuid = test.id('fm'), 'asking again while one is made returns it');
select test.ok((select x.asked is null and x.master_version_id = test.id('mv3') and j.kind = 'format' and j.mode = 'manual'
    and j.creative_id = test.id('st') and j.master_version_id = test.id('mv3')
  from public.format_makes x join public.production_jobs j on j.id = x.job_id where x.id = test.id('fm')),
  'the format''s job names the approved master, and the Engine does not take it as a new picture');
select test.ok((select count(*) = 1 from public.format_makes where id = test.id('fm')), 'staff read the make');
select test.act('marcus+lysne@fumecreatives.com');
select test.ok((select count(*) = 0 from public.format_makes), 'a customer never reads a make');

reset role;
create temp table t9zd (k text primary key, v jsonb);
insert into t9zd values ('take', public.format_take(test.id('fm')));
select test.ok(public.format_take(test.id('fm')) is null, 'a format being made is not taken twice');
select test.ok((select v ->> 'format' = 'story' and v #>> '{picture,path}' like '%hand-m3.jpg'
    and v #>> '{store,prefix}' = test.id('lysne') || '/format/' || test.id('fm')
  from t9zd where k = 'take'), 'the function gets the master''s picture, the shape and where to store it');
select test.ok(app.can_read_object(test.id('lysne') || '/format/' || test.id('fm') || '-padded.png') is false,
  'without a signed-in staff member, the parts are not read');

select test.refuses($$ select public.format_finish(test.id('fm'), '{"png":{"path":"elsewhere.png"},"method":"crop"}') $$,
  'invalid', 'the format is stored where it was told');
create temp table t9zd_spent as select app.engine_spent_usd() as img, (public.fume_llm_budget() ->> 'spent_usd')::numeric as llm;
insert into t9zd values ('res', public.format_finish(test.id('fm'), jsonb_build_object(
  'png', jsonb_build_object('path', test.id('lysne') || '/format/' || test.id('fm') || '.png', 'bytes', 900, 'sha256', 'aa'),
  'width', 1080, 'height', 1920, 'method', 'expand', 'why', 'The product fills the picture; a crop would cut it.',
  'window', '{"x":0,"y":0.16,"w":1,"h":0.68}'::jsonb, 'prompt', 'Extend the picture', 'model', 'nano-banana-pro',
  'cost_cents', 15, 'llm_usd', 0.002, 'ms', 40000)));
select test.keep('fmc', (select (v ->> 'candidate_id')::uuid from t9zd where k = 'res'));
select test.ok((select c.job_id = (select job_id from public.format_makes where id = test.id('fm')) and c.origin = 'engine'
    and c.note like 'Expanded from the master:%' and f.width = 1080 and f.height = 1920 and f.purpose = 'candidate'
  from public.candidates c join public.files f on f.id = c.file_id where c.id = test.id('fmc')),
  'the format is a candidate of the format''s job, saying how it was made');
select test.ok((select state = 'made' and method = 'expand' and cost_cents = 15 and result_candidate_id = test.id('fmc')
    and ("window" ->> 'y')::numeric = 0.16
  from public.format_makes where id = test.id('fm')), 'the make keeps the method, why, the window and the cost');
select test.ok(app.engine_spent_usd() >= (select img from t9zd_spent) + 0.15, 'the Engine''s week counts the format');
select test.ok((public.fume_llm_budget() ->> 'spent_usd')::numeric >= (select llm from t9zd_spent) + 0.002, 'the language model''s week counts it too');
select test.refuses($$ select public.format_finish(test.id('fm'), '{}') $$, 'conflict', 'a format is finished once');

-- The designer can ask for the other method; a failed make says why.
set role authenticated;
select test.act('marcus@fumecreatives.com');
select test.keep('fm2', (public.make_format(test.id('st'), 'crop') ->> 'id')::uuid);
select test.ok((select asked = 'crop' and job_id = (select job_id from public.format_makes where id = test.id('fm'))
  from public.format_makes where id = test.id('fm2')), 'asking for a crop reuses the format''s job');
reset role;
select public.format_fail(test.id('fm2'), 'fal was down', 0, 0.001);
select test.ok((select state = 'failed' and error = 'fal was down' and llm_usd = 0.001 from public.format_makes where id = test.id('fm2')),
  'a failed make says why and keeps what it cost');

set role authenticated;
select test.ok(true, 'all of the format make tests passed');
