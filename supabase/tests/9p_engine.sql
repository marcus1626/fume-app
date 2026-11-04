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
select test.ok((select s.recipe ->> 'image_model' = 'nano-banana-pro' and s.recipe ->> 'slot' = 'pc1'
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
  perform test.ok(jsonb_array_length(t -> 'products') = 1 and t #>> '{products,0,pictures,0,slot}' = 'front'
    and jsonb_array_length(t #> '{products,0,facts}') > 0, 'it carries the product, its frozen facts and its front picture');
  perform test.ok(t -> 'master' = 'null'::jsonb and t #>> '{brand,name}' is not null, 'a master is made from no earlier picture');
end $$;

-- A prompt that did not pass fails the attempt and the job; a person looks at it.
select public.engine_prompted(test.id('ea2'), '{"hash":"h1","status":"escalated","reason":"attempts_exhausted","image_model":"nano-banana-pro","findings":[{"code":"conflict","message":"The prompt works against: no spilled oil."}],"llm_usd":0.002}');
select test.ok((select state = 'failed' and error like 'The prompt did not pass Fume''s checks: The prompt works against%'
  from public.production_jobs where id = test.id('ej')), 'a prompt that does not pass fails the job with its finding');
select test.ok((select llm_usd = 0.002 from public.engine_prompts where attempt_id = test.id('ea2')), 'the prompt keeps what its checks cost');

-- Render again: the same job, queued, and this time the picture comes.
set role authenticated;
select test.act('marcus@fumecreatives.com');
select test.ok((public.render_creative(test.id('em')) ->> 'id')::uuid = test.id('ej'), 'Render again queues the same job');
reset role;
select test.keep('ea3', (public.engine_take(test.id('ej')) #>> '{run,attempt_id}')::uuid);
select public.engine_prompted(test.id('ea3'), '{"hash":"h2","status":"validated","image_model":"nano-banana-pro","text":"The first picture is the product itself.","llm_usd":0.003}');
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

select test.ok(true, 'all of the Engine tests passed');
