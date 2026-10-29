-- Fume writes the plan with a language model (20261027190000_fume_writes_plans.sql): with the setting off nothing
-- changes; with it on, the plan waits in 'writing' for the edge function, whose plan is checked before it becomes the
-- version; two failures leave the plan from the brief. "Change it with Fume" writes the next version the same way.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;

select test.ok(not has_function_privilege('authenticated', 'public.fume_take_plan(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.fume_finish_plan(uuid, jsonb, text[], jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.fume_fail_plan(uuid, text, jsonb, boolean)', 'execute'),
  'only the service role takes and finishes Fume''s plans');

-- A verified claim and a second product of the brand that is not in the campaign.
insert into public.product_facts (id, workspace_id, product_id, area, label, statement, status)
values ('0f000000-0000-4000-8000-0000000000c1', test.id('lysne'), test.id('oil'), 'claim', 'Evening line', 'For the hour before sleep.', 'verified'),
       ('0f000000-0000-4000-8000-0000000000c2', test.id('lysne'), test.id('oil'), 'claim', 'Unverified line', 'Skin like silk.', 'unverified');
insert into public.products (id, workspace_id, name) values ('0e000000-0000-4000-8000-0000000000f9', test.id('lysne'), 'Hand Cream');

update app.settings set value = 'true' where key = 'llm_plans';

-- ─── Sending a brief leaves the plan for Fume to write ──────────────────────

set role authenticated;
select test.act('marcus+lysne@fumecreatives.com');
select test.keep('c7', (public.create_campaign(test.id('lysne'), 'Quiet hour', array[test.id('oil')], 'order-c7') ->> 'id')::uuid);
select public.send_brief(test.id('c7'),
  '{"objective":"Own the hour before sleep","audience":"Women 30-50 who wind down at night","message":"The hour before sleep is yours","mandatory":[],"never":["Faces"],"channels":["paid_social"],"formats":["feed","story"],"creatives":2,"language":"en"}',
  'send-c7');
select test.ok((select state from public.plan_versions where campaign_id = test.id('c7') and version = 1) = 'writing',
  'with the setting on, plan 1 waits for Fume in ''writing''');
select test.ok(not exists (select 1 from public.record_events where workspace_id = test.id('lysne') and at >= test.since() and action = 'plan.written'
  and subject_id = (select id from public.plan_versions where campaign_id = test.id('c7') and version = 1)),
  'nothing says the plan is written yet');
select test.refuses($$ select public.ask_plan_check(test.id('c7'), 1) $$, 'conflict', 'a plan being written cannot go to check');
select test.ok((select count(*) from public.task_runs) = 0, 'the customer cannot read Fume''s runs');

-- ─── The function takes it, and only once at a time ─────────────────────────

reset role;
select test.keep('run1', (public.fume_take_plan(test.id('c7')) ->> 'run_id')::uuid);
select test.ok(public.fume_take_plan(test.id('c7')) is null, 'a plan under way is not taken twice');
select test.ok((select input -> 'brand' ->> 'name' from public.task_runs where id = test.id('run1')) = 'LYSNE'
  and (select jsonb_array_length(input -> 'products') from public.task_runs where id = test.id('run1')) = 1
  and (select input -> 'brief' ->> 'message' from public.task_runs where id = test.id('run1')) = 'The hour before sleep is yours'
  and (select input -> 'change' from public.task_runs where id = test.id('run1')) = 'null'::jsonb,
  'the run keeps what the model read: brand, the campaign''s products and facts, the brief');

-- A plan to check against: two directions, the second chosen.
create temp table good as select jsonb_build_object(
  'summary', 'The hour before sleep, slowed down.',
  'strategic_task', 'Make the last hour of the day feel like hers.',
  'directions', jsonb_build_array(
    jsonb_build_object('id', 'a', 'name', 'Lamp light', 'idea', 'The bottle in the last light of the day', 'hook', 'Yours, after nine',
      'creatives', jsonb_build_array(jsonb_build_object('id', 'pc1', 'name', 'Master 1', 'kind', 'master', 'format', 'feed',
        'productIds', jsonb_build_array(test.id('oil')), 'scene', 'Bedside', 'people', 'No people'))),
    jsonb_build_object('id', 'b', 'name', 'Slow hands', 'idea', 'Oil warmed between palms', 'hook', 'Slow down', 'recommended', true,
      'creatives', jsonb_build_array(
        jsonb_build_object('id', 'pc1', 'name', 'Master 1', 'kind', 'master', 'format', 'feed',
          'productIds', jsonb_build_array(test.id('oil')), 'scene', 'Hands by a lamp', 'people', 'Hands only',
          'text', 'For the hour before sleep.', 'claimRefs', jsonb_build_array('0f000000-0000-4000-8000-0000000000c1')),
        jsonb_build_object('id', 'pc2', 'name', 'Story from Master 1', 'kind', 'variant', 'of', 'pc1', 'format', 'story',
          'productIds', jsonb_build_array(test.id('oil')), 'scene', 'The same, tall', 'people', 'Hands only')))),
  'chosen_direction_id', 'b',
  'content', jsonb_build_array(jsonb_build_object('key', 'headline', 'label', 'Headline', 'value', 'Slow down', 'source', 'fume'))
) as body;

select test.refuses($$ select public.fume_finish_plan(test.id('run1'), (select body from good) || '{"chosen_direction_id":"z"}', '{}', '{}') $$,
  'invalid', 'the chosen direction must be one of the plan''s');
select test.refuses($$ select public.fume_finish_plan(test.id('run1'),
    jsonb_set((select body from good), '{directions,1,creatives,0,productIds}', '["0e000000-0000-4000-8000-0000000000f9"]'), '{}', '{}') $$,
  'invalid', 'a planned creative names the campaign''s products only');
select test.refuses($$ select public.fume_finish_plan(test.id('run1'),
    jsonb_set((select body from good), '{directions,1,creatives,0,claimRefs}', '["0f000000-0000-4000-8000-0000000000c2"]'), '{}', '{}') $$,
  'invalid', 'a claim must be a verified claim of the product');
select test.refuses($$ select public.fume_finish_plan(test.id('run1'),
    jsonb_set((select body from good), '{directions,1,creatives,1,of}', '"pc9"'), '{}', '{}') $$,
  'invalid', 'a variant names a master of its direction');
select test.refuses($$ select public.fume_finish_plan(test.id('run1'),
    jsonb_set((select body from good), '{directions,1,creatives,1,format}', '"billboard"'), '{}', '{}') $$,
  'invalid', 'a planned creative is in a format Fume makes');
select test.refuses($$ select public.fume_finish_plan(test.id('run1'),
    (select body from good) || '{"rules":[]}' || jsonb_build_object('directions', (select body -> 'directions' from good) || (select body -> 'directions' from good) ), '{}', '{}') $$,
  'invalid', 'at most three directions, each with its own id');

select public.fume_finish_plan(test.id('run1'), (select body from good) || '{"rules":[{"text":"anything","kind":"must"}]}', '{}',
  '{"model":"claude-opus-5-5","input_tokens":3000,"output_tokens":2000,"cost_usd":0.052}');
select test.ok((select state from public.plan_versions where campaign_id = test.id('c7') and version = 1) = 'ready'
  and (select body ->> 'chosen_direction_id' from public.plan_versions where campaign_id = test.id('c7') and version = 1) = 'b'
  and (select jsonb_array_length(body -> 'planned_creatives') from public.plan_versions where campaign_id = test.id('c7') and version = 1) = 2,
  'Fume''s plan is ready, the chosen direction''s creatives planned');
select test.ok((select body -> 'rules' from public.plan_versions where campaign_id = test.id('c7') and version = 1)
  @> '[{"text":"Faces","kind":"never","source":"brief"}]'
  and not (select body -> 'rules' from public.plan_versions where campaign_id = test.id('c7') and version = 1) @> '[{"text":"anything"}]',
  'the rules stay the brief''s and the Brand DNA''s, never the model''s');
select test.ok((select state from public.task_runs where id = test.id('run1')) = 'succeeded'
  and (select cost_usd from public.task_runs where id = test.id('run1')) = 0.052,
  'the run is kept with its tokens and cost');
select test.ok(exists (select 1 from public.record_events where workspace_id = test.id('lysne') and at >= test.since() and action = 'plan.written'
  and subject_id = (select id from public.plan_versions where campaign_id = test.id('c7') and version = 1)), 'the record says Fume wrote it');
select test.refuses($$ select public.fume_finish_plan(test.id('run1'), (select body from good), '{}', '{}') $$,
  'conflict', 'a finished run cannot write again');

-- ─── "Change it with Fume" ───────────────────────────────────────────────────

set role authenticated;
select test.act('member+lysne@fumecreatives.com');
select test.refuses($$ select public.change_plan_with_fume(test.id('c7'), 1, 'Warmer') $$, 'forbidden', 'a member cannot change the plan');
select test.act('marcus+lysne@fumecreatives.com');
select test.refuses($$ select public.change_plan_with_fume(test.id('c7'), 1, '  ') $$, 'invalid', 'she says what to change');
select public.change_plan_with_fume(test.id('c7'), 1, 'Make it warmer, candle light instead of a lamp', 'fume-c7-1');
select public.change_plan_with_fume(test.id('c7'), 1, 'Make it warmer, candle light instead of a lamp', 'fume-c7-1');
select test.ok((select state from public.plan_versions where campaign_id = test.id('c7') and version = 2) = 'writing'
  and (select state from public.plan_versions where campaign_id = test.id('c7') and version = 1) = 'superseded'
  and (select count(*) from public.plan_versions where campaign_id = test.id('c7')) = 2,
  'her words make plan 2, for Fume to write (once, however often she presses)');
select test.refuses($$ select public.change_plan_with_fume(test.id('c7'), 2, 'Again') $$, 'conflict', 'not while Fume is writing');

reset role;
select test.keep('run2', (public.fume_take_plan(test.id('c7')) ->> 'run_id')::uuid);
select test.ok((select input -> 'change' ->> 'asked' from public.task_runs where id = test.id('run2')) = 'Make it warmer, candle light instead of a lamp'
  and (select input -> 'change' -> 'plan' ->> 'chosen_direction_id' from public.task_runs where id = test.id('run2')) = 'b',
  'the model reads her words and the plan before');
select public.fume_finish_plan(test.id('run2'), jsonb_set((select body from good), '{directions,1,creatives,0,scene}', '"Hands by a candle"'),
  array['Master 1''s scene: candle light instead of a lamp'], '{}');
select test.ok((select changes from public.plan_versions where campaign_id = test.id('c7') and version = 2) = array['Master 1''s scene: candle light instead of a lamp']
  and (select state from public.plan_versions where campaign_id = test.id('c7') and version = 2) = 'ready',
  'plan 2 is ready, saying what Fume changed');

-- ─── Failures: the second one leaves the fallback ───────────────────────────

set role authenticated;
select test.act('marcus+lysne@fumecreatives.com');
select public.change_plan_with_fume(test.id('c7'), 2, 'Add a square one');
reset role;
select test.keep('run3', (public.fume_take_plan(test.id('c7')) ->> 'run_id')::uuid);
select public.fume_fail_plan(test.id('run3'), 'overloaded');
select test.ok((select state from public.plan_versions where campaign_id = test.id('c7') and version = 3) = 'writing',
  'one failure: the plan waits for the next try');
select test.keep('run4', (public.fume_take_plan(test.id('c7')) ->> 'run_id')::uuid);
select test.ok((select attempt from public.task_runs where id = test.id('run4')) = 2, 'the next read tries again');
select public.fume_fail_plan(test.id('run4'), 'overloaded');
select test.ok((select state from public.plan_versions where campaign_id = test.id('c7') and version = 3) = 'changes_asked'
  and (select body ->> 'chosen_direction_id' from public.plan_versions where campaign_id = test.id('c7') and version = 3) = 'b',
  'two failures on a change: the plan before stands, and her words wait for Fume''s designer');

-- A first plan that fails twice stands as the plan from the brief; a stale run counts as a failure.
set role authenticated;
select test.act('marcus+lysne@fumecreatives.com');
select test.keep('c8', (public.create_campaign(test.id('lysne'), 'Second', array[test.id('oil')], 'order-c8') ->> 'id')::uuid);
select public.send_brief(test.id('c8'),
  '{"objective":"o","audience":"a","message":"m","formats":["feed"],"creatives":1}', 'send-c8');
reset role;
select test.keep('run5', (public.fume_take_plan(test.id('c8')) ->> 'run_id')::uuid);
update public.task_runs set started_at = now() - interval '10 minutes' where id = test.id('run5');
select test.keep('run6', (public.fume_take_plan(test.id('c8')) ->> 'run_id')::uuid);
select test.ok((select state from public.task_runs where id = test.id('run5')) = 'failed', 'a run that never came back counts as failed');
select public.fume_fail_plan(test.id('run6'), 'refused', '{}', true);
select test.ok((select state from public.plan_versions where campaign_id = test.id('c8') and version = 1) = 'ready'
  and exists (select 1 from public.record_events where workspace_id = test.id('lysne') and at >= test.since() and action = 'plan.written' and (detail ->> 'fallback')::boolean
    and subject_id = (select id from public.plan_versions where campaign_id = test.id('c8') and version = 1)),
  'the plan from the brief stands, and the record says so');

-- With the setting off, "Change it with Fume" is a request to Fume's designer, as before.
update app.settings set value = 'false' where key = 'llm_plans';
set role authenticated;
select test.act('marcus+lysne@fumecreatives.com');
select public.change_plan_with_fume(test.id('c8'), 1, 'Warmer');
select test.ok((select state from public.plan_versions where campaign_id = test.id('c8') and version = 1) = 'changes_asked',
  'with the setting off, her words go to the designer');
reset role;
-- The brief's alternatives read the brand's products only, and only the service role reads them.
select test.ok(not has_function_privilege('authenticated', 'public.fume_brief_context(uuid, uuid[])', 'execute'),
  'only the service role reads a brand for the brief''s alternatives');
select test.ok(jsonb_array_length(public.fume_brief_context(test.id('lysne'), array[test.id('oil'), (select id from public.products where workspace_id <> test.id('lysne') limit 1)]) -> 'products') = 1
  and public.fume_brief_context(test.id('lysne'), array[test.id('oil')]) -> 'brand' ->> 'name' = 'LYSNE',
  'the alternatives read the brand and its own products, never another brand''s');
insert into public.task_runs (workspace_id, kind, subject_id, attempt, state) values (test.id('lysne'), 'brief', test.id('lysne'), 1, 'succeeded'),
  (test.id('lysne'), 'brief', test.id('lysne'), 1, 'succeeded');
select test.ok((select count(*) from public.task_runs where kind = 'brief') = 2, 'a brand keeps every run of its brief''s alternatives');
select test.ok(true, 'all of Fume''s plan tests passed');
