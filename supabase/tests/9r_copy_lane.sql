-- The copy lane (20261105000000_copy_lane.sql): the plan writer reads the brand's Tone of Voice, the claim check is
-- kept on the run for Fume's people only, and a customer never reads Fume's own readings in the record.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;
update app.settings set value = 'true' where key = 'llm_plans';
set role authenticated;

select test.ok(not has_function_privilege('authenticated', 'public.brand_voice_of_campaign(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.fume_plan_copy_checked(uuid, jsonb)', 'execute')
  and has_function_privilege('service_role', 'public.fume_plan_copy_checked(uuid, jsonb)', 'execute'),
  'only the plan writer reads the voice and keeps the check');

select test.act('marcus+lysne@fumecreatives.com');
select test.keep('c9r', (public.create_campaign(test.id('lysne'), 'Evening words', array[test.id('oil')], 'order-c9r') ->> 'id')::uuid);
select public.send_brief(test.id('c9r'),
  '{"objective":"Own the evening","audience":"Women 30-50","message":"The evening is yours","mandatory":[],"never":[],"channels":["paid_social"],"formats":["feed"],"creatives":1,"language":"en"}',
  'send-c9r');

reset role;
-- 9q left LYSNE an approved Tone of Voice (version 2) and an older superseded one.
select test.ok((public.brand_voice_of_campaign(test.id('c9r')) ->> 'version')::int = 2
  and public.brand_voice_of_campaign(test.id('c9r')) ->> 'state' = 'approved'
  and public.brand_voice_of_campaign(test.id('c9r')) #>> '{body,summary}' = 'Quiet, evening'
  and not (public.brand_voice_of_campaign(test.id('c9r')) -> 'body' ? 'sources'),
  'the plan writer reads the approved Tone of Voice, without its sources');
-- A newer draft does not replace the approved one; without an approved one, a checked one comes before a draft.
insert into public.brand_books (workspace_id, kind, version, state, body)
values (test.id('lysne'), 'voice', 3, 'draft', '{"summary":"Draft"}');
select test.ok((public.brand_voice_of_campaign(test.id('c9r')) ->> 'version')::int = 2, 'a newer draft does not replace the approved book');
update public.brand_books set state = 'superseded' where workspace_id = test.id('lysne') and kind = 'voice' and version = 2;
select test.ok(public.brand_voice_of_campaign(test.id('c9r')) #>> '{body,summary}' = 'Draft', 'with nothing approved or checked, the draft guides');
update public.brand_books set state = 'approved' where workspace_id = test.id('lysne') and kind = 'voice' and version = 2;
delete from public.brand_books where workspace_id = test.id('lysne') and kind = 'voice' and version = 3;
select test.ok(public.brand_voice_of_campaign(gen_random_uuid()) is null, 'no campaign, no voice');

select test.keep('run9r', (public.fume_take_plan(test.id('c9r')) ->> 'run_id')::uuid);
select test.refuses($$ select public.fume_plan_copy_checked(test.id('run9r'), '{"read":true}') $$, 'invalid', 'a check names the lines it read');
select test.refuses($$ select public.fume_plan_copy_checked(gen_random_uuid(), '{"lines":[]}') $$, 'not_found', 'and belongs to a plan being written');
select public.fume_plan_copy_checked(test.id('run9r'),
  '{"read":true,"unbacked":1,"voice_book":{"version":2},"lines":[{"ref":"copy:headline","text":"Sleep better"}],"findings":[{"kind":"unbacked_claim"}]}');
select test.ok((select copy_check ->> 'unbacked' = '1' from public.task_runs where id = test.id('run9r')), 'the check is kept on the run');
-- An Engine reading on a version the customer may read, to see that the record keeps it from her.
insert into public.record_events (workspace_id, action, subject_type, subject_id, detail)
select test.id('lysne'), 'engine.findings', 'plan_version', subject_id, '{"findings":2}' from public.task_runs where id = test.id('run9r');

set role authenticated;
select test.act('marcus+lysne@fumecreatives.com');
select test.ok(not exists (select 1 from public.task_runs where id = test.id('run9r')), 'the customer never reads the run');
select test.ok(not exists (select 1 from public.record_events where workspace_id = test.id('lysne')
    and (action = 'plan.copy_checked' or action like 'engine.%')),
  'nor Fume''s own readings in the record: the copy check, the Engine''s prompts and findings');
select test.ok(not exists (select 1 from public.record_events r where r.workspace_id = test.id('lysne') and r.subject_type = 'brand_book'
    and not exists (select 1 from public.brand_books b where b.id = r.subject_id)),
  'nor an event about a brand book she may not read');
select test.ok(exists (select 1 from public.record_events where workspace_id = test.id('lysne') and action = 'brand_book.approved'),
  'while what she did with a book she reads stays in her record');
select test.act('kristian@fumecreatives.com');
select test.ok(exists (select 1 from public.record_events where workspace_id = test.id('lysne') and action = 'plan.copy_checked'),
  'Fume''s people read the copy check');

reset role;
update app.settings set value = 'false' where key = 'llm_plans';
set role authenticated;
select test.ok(true, 'all of the copy lane tests passed');
