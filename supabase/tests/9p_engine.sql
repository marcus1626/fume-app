-- The Engine, first version (20261104130000_engine.sql): a designer renders a creative; the edge function takes the
-- attempt with everything the prompt is written from, records the prompt and its checks, and the picture becomes a
-- candidate of the creative's job. Customers see none of it. Runs on a LYSNE campaign of its own.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
set role authenticated;

select test.ok(not has_function_privilege('authenticated', 'public.engine_take(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.engine_prompted(uuid, jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.engine_finish(uuid, jsonb, jsonb, int)', 'execute')
  and not has_function_privilege('authenticated', 'public.engine_fail(uuid, text, jsonb, int, boolean)', 'execute')
  and not has_function_privilege('authenticated', 'public.fume_engine_budget()', 'execute')
  and has_function_privilege('service_role', 'public.engine_take(uuid)', 'execute'),
  'only the Engine''s function takes, records and finishes its work');

select test.act('marcus+lysne@fumecreatives.com');
select test.keep('ec', (public.create_campaign(test.id('lysne'), 'Engine round', array[test.id('oil')]) ->> 'id')::uuid);
select public.send_brief(test.id('ec'), '{"objective":"Evening ritual","audience":"Women 30-50","message":"Oil on warm skin before sleep","formats":"feed, story","count":"2"}');
select public.approve_plan(test.id('ec'), 1);

select test.act('marcus@fumecreatives.com');
select test.keep('em', (public.open_creative(test.id('ec')) ->> 'id')::uuid);

-- The product's front picture.
reset role;
insert into storage.objects (bucket_id, name, owner_id) values
  ('workspace-files', test.id('lysne') || '/oil-front.png', (select id::text from public.profiles where email = 'marcus@fumecreatives.com'));
insert into public.files (workspace_id, path, name, content_type, bytes, purpose)
values (test.id('lysne'), test.id('lysne') || '/oil-front.png', 'oil-front.png', 'image/png', 1000, 'source');
insert into public.sources (workspace_id, kind, name, file_id, product_id, slot)
select test.id('lysne'), 'packshot', 'Oil, front', id, test.id('oil'), 'front' from public.files where name = 'oil-front.png';
-- And one the product import found on the brand's website: an address, no file.
insert into public.sources (workspace_id, kind, name, url, product_id, slot)
values (test.id('lysne'), 'packshot', 'Oil, back', 'https://lysne.example/oil-back.png', test.id('oil'), 'back');
set role authenticated;

-- ─── Render ─────────────────────────────────────────────────────────────────

select test.act('marcus+lysne@fumecreatives.com');
select test.refuses($$ select public.render_creative(test.id('em')) $$, 'forbidden', 'the customer does not render');
select test.act('william@fumecreatives.com');
select test.refuses($$ select public.render_creative(test.id('em')) $$, 'forbidden', 'the account manager does not render');

select test.act('marcus@fumecreatives.com');
select test.keep('ej', (public.render_creative(test.id('em'), 'render-1') ->> 'id')::uuid);
select test.ok((select kind = 'master' and mode = 'engine' and state = 'queued' and creative_id = test.id('em')
  from public.production_jobs where id = test.id('ej')), 'Render starts the creative''s Engine master job, queued');
select test.ok((select coalesce(s.recipe ->> 'image_model', '') <> '' and s.recipe ->> 'slot' = 'pc1'
  from public.production_jobs j join public.context_snapshots s on s.id = j.snapshot_id where j.id = test.id('ej')),
  'its frozen recipe names the image model and the planned creative');
select test.ok((public.render_creative(test.id('em')) ->> 'id')::uuid = test.id('ej'), 'pressing again while it is queued gives the same job');

-- ─── The Engine takes the attempt ───────────────────────────────────────────

reset role;
select test.keep('ea1', (public.engine_take(test.id('ej')) #>> '{run,attempt_id}')::uuid);
select test.ok(public.engine_take(test.id('ej')) is null, 'an attempt under way is not taken twice');
select test.ok((select state = 'running' from public.production_jobs where id = test.id('ej')), 'the job runs');
do $$
declare t jsonb;
begin
  -- What the prompt is written from, read again as the function saw it (the attempt is taken; peek with a copy).
  update public.job_attempts set started_at = now() - interval '11 minutes' where id = test.id('ea1');
  t := public.engine_take(test.id('ej'));
  perform test.ok((t #>> '{run,attempt}')::int = 2, 'an attempt silent for ten minutes is taken again');
  perform test.keep('ea2', (t #>> '{run,attempt_id}')::uuid);
  perform test.ok((select state = 'failed' from public.job_attempts where id = test.id('ea1')), 'and the silent one is failed');
  perform test.ok(t #>> '{creative,slot}' = 'pc1' and t #>> '{creative,format}' = 'feed', 'it names the creative and its format');
  perform test.ok(t #>> '{plan,chosen_direction_id}' is not null and jsonb_array_length(t #> '{plan,planned_creatives}') = 2,
    'it carries the approved plan');
  perform test.ok(jsonb_array_length(t -> 'products') = 1 and jsonb_array_length(t #> '{products,0,facts}') > 0
    and exists (select 1 from jsonb_array_elements(t #> '{products,0,pictures}') x where x ->> 'slot' = 'front' and x ->> 'path' like '%/oil-front.png')
    and exists (select 1 from jsonb_array_elements(t #> '{products,0,pictures}') x where x ->> 'slot' = 'back' and x ->> 'url' = 'https://lysne.example/oil-back.png'),
    'it carries the product, its frozen facts, its picture file and the picture from its website');
  perform test.ok(t -> 'master' = 'null'::jsonb and t #>> '{brand,name}' is not null, 'a master is made from no earlier picture');
  perform test.ok(jsonb_typeof(t #> '{brain,palette}') = 'array' and jsonb_typeof(t #> '{brain,imagery}') = 'array'
    and jsonb_typeof(t #> '{brain,changes}') = 'array' and t #>> '{brain,market,market}' is not null,
    'it carries what the Brand Brain knows about the brand''s pictures');
  perform test.ok(not exists (select 1 from jsonb_array_elements(t #> '{brain,palette}') c where c ->> 'id' is null or c ->> 'hex' !~* '^#[0-9a-f]{6}$'),
    'every colour keeps its node and its hex');
end $$;

-- A prompt that did not pass fails the attempt and the job; a person looks at it.
select public.engine_prompted(test.id('ea2'), '{"hash":"h1","status":"escalated","reason":"attempts_exhausted","image_model":"nano-banana-pro","findings":[{"code":"conflict","message":"The prompt works against: no spilled oil."}],"llm_usd":0.002}');
select test.ok((select state = 'failed' and error like 'The prompt did not pass Fume''s checks: The prompt works against%'
  from public.production_jobs where id = test.id('ej')), 'a prompt that does not pass fails the job with its finding');
select test.ok((select llm_usd = 0.002 from public.engine_prompts where attempt_id = test.id('ea2')), 'the prompt keeps what its checks cost');
select test.ok((select ledger = '[]'::jsonb from public.engine_prompts where attempt_id = test.id('ea2')), 'a prompt without a ledger keeps an empty one');

-- Render again: the same job, queued, and this time the picture comes.
set role authenticated;
select test.act('marcus@fumecreatives.com');
select test.ok((public.render_creative(test.id('em')) ->> 'id')::uuid = test.id('ej'), 'Render again queues the same job');
reset role;
select test.keep('ea3', (public.engine_take(test.id('ej')) #>> '{run,attempt_id}')::uuid);
select public.engine_prompted(test.id('ea3'), '{"hash":"h2","status":"validated","image_model":"nano-banana-pro","text":"The first picture is the product itself.","llm_usd":0.003,"ledger":[{"ref":"f1","source":"product_fact","what":"Bottle","used":true,"how":"verbatim"}]}');
select test.ok((select ledger #>> '{0,ref}' = 'f1' from public.engine_prompts where attempt_id = test.id('ea3')), 'the prompt keeps its ledger');
select public.engine_submitted(test.id('ea3'), 'higgsfield', 'hf-req-1', '{"prompt":"The first picture is the product itself."}');
select test.ok((public.engine_take(test.id('ej')) #>> '{collect,provider_job_id}') = 'hf-req-1', 'a submitted attempt comes back to be collected');
insert into storage.objects (bucket_id, name, owner_id) values ('workspace-files', test.id('lysne') || '/engine/e1.png', null);
select test.refuses($$ select public.engine_finish(test.id('ea3'), jsonb_build_array(jsonb_build_object('path', 'elsewhere/e1.png', 'name', 'e1.png')), '{}') $$,
  'invalid', 'a picture outside the workspace''s folder is refused');
select test.keep('ecand', (public.engine_finish(test.id('ea3'),
  jsonb_build_array(jsonb_build_object('path', test.id('lysne') || '/engine/e1.png', 'name', 'Master 1, Engine.png', 'content_type', 'image/png', 'bytes', 2000, 'width', 1080, 'height', 1350)),
  '{"status":"completed"}', 12) -> 0 ->> 'id')::uuid);
select test.ok((select c.origin = 'engine' and c.made_by = j.requested_by and c.attempt_id = test.id('ea3') and f.purpose = 'candidate'
  from public.candidates c join public.production_jobs j on j.id = c.job_id join public.files f on f.id = c.file_id where c.id = test.id('ecand')),
  'the picture is a candidate made by the Engine for the designer who pressed Render');
select test.ok((select state = 'succeeded' and cost_cents = 12 from public.production_jobs where id = test.id('ej')), 'the job is done, with its cost');
select test.ok((public.fume_engine_budget() ->> 'spent_usd')::numeric >= 0.12, 'the week''s Engine budget counts it');
select test.ok((public.fume_llm_budget() ->> 'spent_usd')::numeric >= 0.005, 'the language model''s week counts the prompts');

-- ─── Customers see none of it; the designer sends it to check as usual ──────

set role authenticated;
select test.act('marcus+lysne@fumecreatives.com');
select test.ok((select count(*) from public.engine_prompts) = 0 and (select count(*) from public.candidates where id = test.id('ecand')) = 0,
  'the customer sees no prompt and no candidate');
select test.act('marcus@fumecreatives.com');
select test.ok((select count(*) from public.engine_prompts where job_id = test.id('ej')) = 2, 'the designer sees both prompts');
select test.keep('ev1', (public.send_to_check(test.id('ecand')) ->> 'id')::uuid);
select test.ok((select creative_id = test.id('em') and number = 1 from public.creative_versions where id = test.id('ev1')),
  'the Engine''s picture becomes version 1 of the creative');
select test.refuses($$ select public.mark_checked(test.id('ev1')) $$, 'forbidden', 'the designer who rendered it does not check it');
select test.refuses($$ select public.render_creative(test.id('em')) $$, 'conflict', 'no new render while version 1 waits for its check');

-- ─── A failed attempt is tried again, then fails for good ───────────────────

select test.act('kristian@fumecreatives.com');
select public.request_correction(test.id('ev1'), 'The cap reads too glossy', '["the cap"]', '["light","scene"]', '[]');
select test.act('marcus@fumecreatives.com');
select test.keep('ecj', (public.render_creative(test.id('em')) ->> 'id')::uuid);
select test.ok((select kind = 'correction' from public.production_jobs where id = test.id('ecj')), 'after the expert''s correction Render makes a correction');
reset role;
do $$
declare t jsonb := public.engine_take(test.id('ecj'));
begin
  perform test.ok(t #>> '{master,title}' like 'Master 1, version 1' and t #>> '{change,problem}' = 'The cap reads too glossy'
    and t #> '{change,must_stay}' = '["light","scene"]', 'a correction is made from the version it corrects, with what must change and stay');
  perform test.ok((public.engine_fail((t #>> '{run,attempt_id}')::uuid, 'The model refused the picture.') ->> 'state') = 'queued',
    'a refused picture is tried again');
end $$;
select test.ok((public.engine_fail((public.engine_take(test.id('ecj')) #>> '{run,attempt_id}')::uuid, 'The model could not be reached.', null, 0, true) ->> 'state') = 'failed',
  'a final failure fails the job');

-- ─── The week's ceiling ─────────────────────────────────────────────────────

update app.settings set value = '0' where key = 'engine_week_usd';
set role authenticated;
select test.act('marcus@fumecreatives.com');
select test.refuses($$ select public.render_creative(test.id('em')) $$, 'unavailable', 'over the week''s ceiling, nothing renders');
reset role;
update app.settings set value = '20' where key = 'engine_week_usd';
set role authenticated;

-- ─── Teaching the Engine; the prompt is Fume's own (20261104150000_engine_studio.sql) ─────────────────────

select test.act('marcus+lysne@fumecreatives.com');
select test.refuses($$ select public.teach_engine(test.id('ecand'), 'yes') $$, 'forbidden', 'the customer does not teach the Engine');
select test.act('marcus@fumecreatives.com');
select test.keep('lesson', (public.teach_engine(test.id('ecand'), 'yes') ->> 'id')::uuid);
select test.ok((select verdict = 'yes' and polarity = 'do' and state = 'pending' and why is null and created_by = (select id from public.profiles where email = 'marcus@fumecreatives.com')
  from public.engine_lessons where id = test.id('lesson')), 'a Yes is kept as an answer that waits to become a lesson');
select test.ok((public.teach_engine(test.id('ecand'), 'yes', 'The light') ->> 'id')::uuid = test.id('lesson'), 'the why goes to the same answer');
select test.ok((select why = 'The light' and statement = 'The light' and (select count(*) from public.engine_lessons where source_candidate_id = test.id('ecand')) = 1
  from public.engine_lessons where id = test.id('lesson')), 'and updates it');
select public.teach_engine(test.id('ecand'), 'no');
select test.ok((select verdict = 'no' and polarity = 'avoid' and why is null from public.engine_lessons where id = test.id('lesson')),
  'a changed answer drops the why given for the other one');
select test.refuses($$ select public.teach_engine(test.id('ecand'), 'maybe') $$, 'invalid', 'the answer is yes or no');
reset role;
update public.production_jobs set state = 'queued' where id = test.id('ecj');
update public.engine_lessons set statement = 'A person said: no gloss' where id = test.id('lesson');
do $$
declare t jsonb := public.engine_take(test.id('ecj'));
begin
  perform test.ok(t ? 'lessons' and not exists (select 1 from jsonb_array_elements(t -> 'lessons') x
    where x::text like '%no gloss%'), 'an answer reaches no prompt until it is a lesson');
end $$;
update public.production_jobs set state = 'failed' where id = test.id('ecj');
-- An agency's people on their own client see neither the prompts nor the answers.
with a as (
  insert into public.job_attempts (workspace_id, job_id, number, provider, state)
  values (test.id('client'), test.id('ja'), 1, 'test', 'failed') returning id
)
insert into public.engine_prompts (workspace_id, job_id, attempt_id, hash, status, image_model)
select test.id('client'), test.id('ja'), a.id, 'h-agency', 'validated', 'nano-banana-pro' from a;
select test.ok((select count(*) from public.engine_prompts where workspace_id = test.id('client')) = 1, 'a prompt on an agency''s client');
set role authenticated;
select test.act('nora@brygga.test');
select test.ok(app.is_staff(test.id('client')) and (select count(*) from public.engine_prompts where workspace_id = test.id('client')) = 0,
  'an agency''s designer does not see the prompt behind their client''s pictures');
select test.act('marcus@fumecreatives.com');
select test.ok((select count(*) from public.engine_prompts where job_id = test.id('ej')) = 2, 'Fume''s own designer still does');

-- ─── Lessons from the answers (20261104160000_engine_digest.sql) ────────────

set role authenticated;
select test.act('marcus@fumecreatives.com');
select public.teach_engine(test.id('ecand'), 'no', 'The cap reads too glossy');
reset role;
select test.ok(not has_function_privilege('authenticated', 'public.engine_pending(uuid, int)', 'execute')
  and not has_function_privilege('authenticated', 'public.engine_digested(uuid, timestamptz, jsonb, numeric)', 'execute'),
  'only the Engine digests the answers');
do $$
declare
  p jsonb := public.engine_pending(test.id('lysne'));
  at timestamptz;
  t jsonb;
begin
  perform test.ok(jsonb_array_length(p) = 1 and p #>> '{0,why}' = 'The cap reads too glossy' and p #>> '{0,verdict}' = 'no',
    'an answer with a why waits to be digested, with the prompt behind its picture');
  at := (p #>> '{0,updated_at}')::timestamptz;
  perform test.ok(public.engine_digested((p #>> '{0,id}')::uuid, at,
    '[{"statement":"Keep the cap matte, without glossy reflections.","polarity":"avoid","reason":"The cap reads too glossy","scope":"brand"},{"statement":"","polarity":"do"},{"statement":"x","polarity":"maybe"}]', 0.0007) = 1,
    'its lessons are kept; an empty or unreadable one is not');
  perform test.ok((select state = 'digested' and llm_usd = 0.0007 from public.engine_lessons where id = test.id('lesson')), 'the answer is digested, with what it cost');
  perform test.ok(public.engine_digested((p #>> '{0,id}')::uuid, at, '[{"statement":"Again","polarity":"do"}]', 0) = 0, 'an answer is digested once');
  perform test.ok(jsonb_array_length(public.engine_pending(test.id('lysne'))) = 0, 'and waits no more');
  update public.production_jobs set state = 'queued' where id = test.id('ecj');
  t := public.engine_take(test.id('ecj'));
  perform test.ok(exists (select 1 from jsonb_array_elements(t -> 'lessons') x where x ->> 'statement' = 'Keep the cap matte, without glossy reflections.'
    and x ->> 'polarity' = 'avoid'), 'the lesson reaches the next prompt');
  update public.production_jobs set state = 'failed' where id = test.id('ecj');
end $$;
set role authenticated;
select test.act('marcus@fumecreatives.com');
select public.teach_engine(test.id('ecand'), 'yes', 'The light is right');
reset role;
do $$
declare p jsonb := public.engine_pending(test.id('lysne'));
begin
  perform public.engine_digested((p #>> '{0,id}')::uuid, (p #>> '{0,updated_at}')::timestamptz, '[{"statement":"Soft side light from a window.","polarity":"do"}]', 0);
  perform test.ok((select array_agg(state order by created_at) = array['retired', 'active']
    from public.engine_lessons where source_candidate_id = test.id('ecand') and verdict is null), 'a changed answer retires the lessons of the one before');
end $$;
select test.ok((public.fume_llm_budget() ->> 'spent_usd')::numeric >= 0.0057, 'the language model''s week counts digesting');
set role authenticated;

-- ─── The Engine looks at its pictures (20261104170000_engine_evaluation.sql) ─

reset role;
select test.ok(not has_function_privilege('authenticated', 'public.engine_to_evaluate(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.engine_evaluated(uuid, jsonb, numeric)', 'execute'),
  'only the Engine looks at its pictures');
select test.ok(public.engine_to_evaluate(test.id('ea3')) #>> '{candidates,0,id}' = test.id('ecand')::text
  and public.engine_to_evaluate(test.id('ea3')) #>> '{candidates,0,path}' like '%/engine/e1.png', 'a kept picture waits to be looked at');
select test.refuses($$ select public.engine_evaluated(test.id('ecand'), '{"productTruth":"fine"}', 0) $$, 'invalid', 'an evaluation says what it must');
select public.engine_evaluated(test.id('ecand'),
  '{"productTruth":"flag","brandRules":"pass","artefacts":"none","notes":["The label is hidden."],"evaluated":true,"items":[]}', 0.0009);
select test.ok((select evaluation ->> 'productTruth' = 'flag' and evaluation_usd = 0.0009 from public.candidates where id = test.id('ecand'))
  and jsonb_array_length(public.engine_to_evaluate(test.id('ea3')) -> 'candidates') = 0, 'the picture keeps what the Engine saw, once');
select test.ok((public.fume_llm_budget() ->> 'spent_usd')::numeric >= 0.0066, 'the language model''s week counts looking');

-- ─── The picture check as findings (20261104210000_engine_findings.sql) ─
select test.keep('ev', (select id from public.creative_versions where candidate_id = test.id('ecand') order by number limit 1));
update public.candidates set evaluation = '{"productTruth":"flag","brandRules":"flag","artefacts":"major","notes":[],"evaluated":true,
  "items":[{"area":"product","item":"The bottle as in its photographs","verdict":"off","note":"The cork is black, not burgundy."},
           {"area":"brand","item":"One source of daylight","verdict":"off","note":"Two light sources.","hard":true},
           {"area":"brand","item":"Muted colour","verdict":"holds"},
           {"area":"scene","item":"Oil on warm skin","verdict":"off"}],
  "artefactNotes":["A sixth finger on the left hand.","A warped tile line."],"printedText":true}' where id = test.id('ecand');
delete from public.findings where version_id = test.id('ev') and method = 'automated' and dimension <> 'file_spec';
select test.ok(app.engine_findings(test.id('ev')) = 6, 'what the Engine saw becomes findings on the version');
select test.ok((select array_agg(dimension || ':' || severity order by created_at, id) @> array['product:major', 'artefacts:major', 'text_claims:major']
    and bool_and(severity <> 'critical') and count(*) filter (where dimension = 'brand_brief' and severity = 'minor') = 1
    and bool_or(dimension = 'product' and observed = 'The cork is black, not burgundy.' and expected = 'The bottle as in its photographs')
  from public.findings where version_id = test.id('ev') and method = 'automated' and dimension <> 'file_spec'),
  'by dimension and weight, with what was expected and seen, and none critical: the expert decides that');
select test.ok(app.engine_findings(test.id('ev')) = 0, 'once per version');
set role authenticated;
select test.act('marcus+lysne@fumecreatives.com');
select test.ok((select count(*) from public.findings where version_id = test.id('ev') and method = 'automated') = 0,
  'the customer never reads them');
select test.act('marcus@fumecreatives.com');
reset role;

-- ─── The prompt graph (20261104200000_engine_graph.sql) ─
select test.ok((select score = 0.2 and signal = 'changed' and pictures = 1 and 'used:product_fact' = any (features)
    from app.engine_prompt_rows(test.id('lysne')) where prompt_id = (select id from public.engine_prompts where attempt_id = test.id('ea3'))),
  'a prompt scores its best picture, and a person''s verdict (a correction asked) outranks the machine''s check');
select test.ok((public.engine_learning(test.id('lysne')) ->> 'scored')::int >= 1
  and public.engine_learning(test.id('lysne')) #>> '{by_type,0,image_model}' = 'nano-banana-pro'
  and public.engine_learning(test.id('lysne')) #>> '{recent,0,signal}' is not null, 'the Engine counts what works per model and kind of picture');
set role authenticated;
select test.act('marcus+lysne@fumecreatives.com');
select test.refuses($$ select public.engine_learning(test.id('lysne')) $$, 'forbidden', 'a customer never reads what the Engine learned');
select test.act('marcus@fumecreatives.com');
select test.ok((public.engine_learning(test.id('lysne')) ->> 'prompts')::int >= 1, 'Fume''s people on the brand read it');

-- ─── The designer's words reach the picture (20261104180000_engine_direction.sql) ─

select test.act('marcus+lysne@fumecreatives.com');
select test.keep('ec2', (public.create_campaign(test.id('lysne'), 'Morning round', array[test.id('oil')]) ->> 'id')::uuid);
select public.send_brief(test.id('ec2'), '{"objective":"Morning","audience":"Women 30-50","message":"Oil after the shower","formats":"feed","count":"1"}');
select public.approve_plan(test.id('ec2'), 1);
select test.act('marcus@fumecreatives.com');
select test.keep('em2', (public.open_creative(test.id('ec2')) ->> 'id')::uuid);
select test.refuses(format($$ select public.render_creative(%L, null, jsonb_build_object('instruction', repeat('x', 501))) $$, test.id('em2')),
  'invalid', 'the words have a length');
select test.keep('ej2', (public.render_creative(test.id('em2'), 'dir-1',
  jsonb_build_object('direction', ' Morning, the cup steaming ', 'instruction', '  ', 'from_candidate_id', test.id('ecand'))) ->> 'id')::uuid);
select test.ok((select direction = '{"direction":"Morning, the cup steaming"}' from public.production_jobs where id = test.id('ej2')),
  'the job keeps the Direction, without empty words or another creative''s picture');
reset role;
do $$
declare t jsonb := public.engine_take(test.id('ej2'));
begin
  perform test.ok(t #>> '{change,direction}' = 'Morning, the cup steaming' and t -> 'master' = 'null'::jsonb,
    'the Engine gets the Direction for a new picture');
  perform test.keep('ecand2', (public.engine_finish((t #>> '{run,attempt_id}')::uuid,
    jsonb_build_array(jsonb_build_object('path', test.id('lysne') || '/engine/e2.png', 'name', 'Master 2, Engine.png',
      'content_type', 'image/png', 'bytes', 2000, 'width', 1080, 'height', 1350)), '{}', 15) -> 0 ->> 'id')::uuid);
end $$;
set role authenticated;
select test.act('marcus@fumecreatives.com');
select test.ok((public.render_creative(test.id('em2'), 'dir-2',
  jsonb_build_object('instruction', 'Make the light warmer', 'from_candidate_id', test.id('ecand2'))) ->> 'id')::uuid = test.id('ej2'),
  'the words of the Engine bar render the same job again');
reset role;
do $$
declare t jsonb := public.engine_take(test.id('ej2'));
begin
  perform test.ok(t #>> '{change,ask}' = 'Make the light warmer' and (t #>> '{master,picked}')::boolean
    and t #>> '{master,path}' like '%/engine/e2.png', 'the Engine changes the picked picture as asked');
end $$;
do $$
declare a uuid;
begin
  -- A Render again has its own three tries: the try under way and two more.
  select id into a from public.job_attempts where job_id = test.id('ej2') and state = 'running';
  perform test.ok((public.engine_fail(a, 'The model refused the picture.') ->> 'state') = 'queued', 'a job rendered again tries again');
  perform public.engine_fail((public.engine_take(test.id('ej2')) #>> '{run,attempt_id}')::uuid, 'The model refused the picture.');
  perform test.ok((public.engine_fail((public.engine_take(test.id('ej2')) #>> '{run,attempt_id}')::uuid, 'The model refused the picture.')
    ->> 'state') = 'failed', 'and stops after its third try since that Render');
end $$;
set role authenticated;

select test.ok(true, 'all of the Engine tests passed');
