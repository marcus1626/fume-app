-- The Engine chat, live (20261110060000_engine_chat.sql).

\set ON_ERROR_STOP 1
set client_min_messages = notice;
set role authenticated;

select test.act('kristian@fumecreatives.com');
select test.keep('em_q', (public.engine_say(test.id('lysne'), '  What waits for a check?  ') ->> 'id')::uuid);
select test.ok((select text = 'What waits for a check?' and campaign_id is null from public.engine_messages where id = test.id('em_q')),
  'a person''s words go to the brand''s Everything thread');
select test.keep('em_c', (public.engine_say(test.id('lysne'), 'Write the hook again.', test.id('campaign'),
  '{"kind": "plan_line", "campaignId": "x", "key": "hook", "label": "Hook", "value": "Sleep sooner"}', 'The plan') ->> 'id')::uuid);
select test.ok((select campaign_id = test.id('campaign') and field ->> 'key' = 'hook' and page = 'The plan'
  from public.engine_messages where id = test.id('em_c')), 'a campaign''s thread keeps the field and the page');
select test.refuses($$ select public.engine_say(test.id('lysne'), '   ') $$, 'invalid', 'nothing said is not kept');
select test.refuses($$ select public.engine_say(test.id('lysne'), 'x', test.id('solv')) $$, 'not_found', 'a campaign of another brand is refused');
select test.ok((select count(*) = 2 from public.engine_messages where workspace_id = test.id('lysne')), 'Fume''s people read the brand''s threads');
select test.ok((public.engine_write_context(jsonb_build_object('kind', 'plan_line', 'campaignId', test.id('campaign'),
  'key', 'hook', 'label', 'Hook', 'value', 'x')) -> 'knows' -> 'campaign' ->> 'name') = 'The hour before sleep',
  'Write with Engine knows the campaign');

-- The Engine never talks to a customer.
select test.act('marcus+lysne@fumecreatives.com');
select test.refuses($$ select public.engine_say(test.id('lysne'), 'Hello') $$, 'not_found', 'a customer cannot write to the Engine');
select test.ok((select count(*) = 0 from public.engine_messages), 'a customer reads none of the Engine''s threads');
select test.refuses($$ select public.engine_write_context(jsonb_build_object('kind', 'book_line', 'workspaceId', test.id('lysne'),
  'path', 'x', 'label', 'x', 'value', 'x')) $$, 'not_found', 'nor asks it to write');
select test.ok(not has_function_privilege('authenticated', 'public.engine_chat_answer(uuid, text, uuid[], text)', 'execute')
  and not has_function_privilege('authenticated', 'public.engine_chat_context(uuid)', 'execute'), 'only the Engine answers');

reset role;
select test.ok((public.engine_chat_context(test.id('em_q')) ->> 'answer')::boolean, 'a person''s message waits for an answer');
select test.ok(jsonb_typeof(public.engine_chat_context(test.id('em_c')) -> 'knows' -> 'campaign' -> 'brief') is not null,
  'the Engine knows the campaign of the thread');
select test.keep('em_a', (public.engine_chat_answer(test.id('em_c'), 'Try this.', array[gen_random_uuid()], 'Sleep sooner, wake softer') ->> 'id')::uuid);
select test.ok((select answers = test.id('em_c') and campaign_id = test.id('campaign') and author_id is null
  and widget ->> 'kind' = 'suggestion' and widget -> 'field' ->> 'key' = 'hook' and answer is null
  from public.engine_messages where id = test.id('em_a')), 'the answer is in the same thread, with words for the field and no stranger''s creative');
select test.ok(public.engine_chat_answer(test.id('em_c'), 'Again.') is null, 'a message is answered once');
select test.ok(not (public.engine_chat_context(test.id('em_c')) ->> 'answer')::boolean, 'and waits no more');
select test.ok(public.engine_chat_answer(test.id('em_a'), 'Echo.') is null, 'the Engine never answers itself');

delete from public.engine_messages where workspace_id = test.id('lysne');
set role authenticated;
select test.ok(true, 'all of the Engine chat tests passed');
