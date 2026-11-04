-- The graphic design layer (20261105030000_design_layer.sql): a designer asks Fume to lay the plan's words on a
-- picture from the brand's design system; the result is a new candidate of the same job, with its design document.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
set role authenticated;

select test.ok(not has_function_privilege('authenticated', 'public.design_take(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.design_finish(uuid, jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.design_fail(uuid, text, numeric)', 'execute')
  and has_function_privilege('service_role', 'public.design_finish(uuid, jsonb)', 'execute'),
  'only the design function takes and finishes a layer');

-- Without a design system there is nothing to lay out from.
select test.act('marcus@fumecreatives.com');
select test.refuses($$ select public.design_candidate(test.id('ecand')) $$, 'invalid', 'a brand without a design system');
reset role;
insert into public.brand_books (workspace_id, kind, version, state, body)
values (test.id('lysne'), 'design', 20, 'approved',
  '{"summary":"Calm","styles":[{"name":"h1"}],"colours":[{"hex":"#111111","role":"text"}],"sources":["x"],"css":".brand{}","tokens":{}}');
set role authenticated;

select test.act('marcus+lysne@fumecreatives.com');
select test.refuses($$ select public.design_candidate(test.id('ecand')) $$, 'not_found', 'a customer never sees a candidate');
select test.act('marcus@fumecreatives.com');
select test.keep('dl', (public.design_candidate(test.id('ecand'), 'Words at the top') ->> 'id')::uuid);
select test.ok((public.design_candidate(test.id('ecand')) ->> 'id')::uuid = test.id('dl'), 'asking again while one is made returns it');

reset role;
create temp table t9t (k text primary key, v jsonb);
insert into t9t values ('take', public.design_take(test.id('dl')));
select test.ok(public.design_take(test.id('dl')) is null, 'a layer being made is not taken twice');
select test.ok((select (v #>> '{book,version}')::int = 20 and v #>> '{book,body,summary}' = 'Calm'
    and not (v -> 'book' -> 'body' ? 'sources') and not (v -> 'book' -> 'body' ? 'css')
    and v #>> '{store,png}' = test.id('lysne') || '/design/' || test.id('dl') || '.png'
    and v #>> '{picture,path}' = test.id('lysne') || '/engine/e1.png'
    and v ->> 'ask' = 'Words at the top'
  from t9t where k = 'take'),
  'the function gets the picture, the approved design system and where to store the result');

select test.refuses($$ select public.design_finish(test.id('dl'), '{"png":{"path":"elsewhere.png"},"fig":{"path":"x.fig"},"words":{"headline":"Hi"}}') $$,
  'invalid', 'the result is stored where it was told');
insert into t9t values ('res', public.design_finish(test.id('dl'), jsonb_build_object(
  'png', jsonb_build_object('path', test.id('lysne') || '/design/' || test.id('dl') || '.png', 'bytes', 900, 'sha256', 'aa'),
  'fig', jsonb_build_object('path', test.id('lysne') || '/design/' || test.id('dl') || '.fig', 'bytes', 400),
  'width', 1080, 'height', 1350, 'words', '{"headline":"Own the evening"}'::jsonb, 'layout', '{"band":"top"}'::jsonb,
  'checks', '[{"check":"contrast","ok":true}]'::jsonb, 'findings', '[{"note":"Calm"}]'::jsonb, 'llm_usd', 0.004, 'ok', true)));
select test.keep('dcand', (select (v ->> 'candidate_id')::uuid from t9t where k = 'res'));
select test.ok((select c.designed_from = test.id('ecand') and c.job_id = (select job_id from public.candidates where id = test.id('ecand'))
    and f.purpose = 'candidate' and f.content_type = 'image/png'
  from public.candidates c join public.files f on f.id = c.file_id where c.id = test.id('dcand')),
  'the designed picture is a candidate of the same job, knowing the picture under it');
select test.ok((select state = 'made' and llm_usd = 0.004 and document_file_id is not null and layout ->> 'band' = 'top'
  from public.design_layers where id = test.id('dl')), 'the layer keeps what code laid out, measured and cost');
select test.ok((public.fume_llm_budget() ->> 'spent_usd')::numeric >= 0.004, 'the language model''s week counts it');
select test.refuses($$ select public.design_finish(test.id('dl'), '{}') $$, 'conflict', 'a layer is finished once');

-- On a designed candidate, the layer is made again from the picture under it.
set role authenticated;
select test.act('marcus@fumecreatives.com');
select test.ok((public.design_candidate(test.id('dcand')) ->> 'candidate_id')::uuid = test.id('ecand'),
  'a new layer goes on the picture, not on the old layer');
select test.ok(exists (select 1 from public.design_layers where id = test.id('dl')), 'the designer reads the layer');
select test.act('marcus+lysne@fumecreatives.com');
select test.ok(not exists (select 1 from public.design_layers) and not exists (
    select 1 from public.record_events where action = 'design.asked'), 'a customer never reads a layer, nor that one was asked for');

reset role;
select public.design_fail(id, 'The service did not answer.', 0.001) from public.design_layers where state = 'designing';
select test.ok((select count(*) = 0 from public.design_layers where state = 'designing'), 'a layer that could not be made says why');
delete from public.brand_books where workspace_id = test.id('lysne') and kind = 'design' and version = 20;
set role authenticated;
select test.ok(true, 'all of the design layer tests passed');
