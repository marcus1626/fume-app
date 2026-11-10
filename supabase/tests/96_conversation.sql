-- The Fume chat (20261103120000_conversation.sql): who writes, what Fume may know, what its cards may point at, the
-- handover to a person at Fume, and the bell around it.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
set role authenticated;

-- ─── She writes; Fume will answer ────────────────────────────────────────────
select test.act('marcus+lysne@fumecreatives.com');
select test.keep('m1', (public.say(test.id('lysne'), '  Where is Night ritual?  ', null, '[]', 'chat-1') ->> 'id')::uuid);
select test.ok((select text = 'Where is Night ritual?' and author_kind = 'person' from public.conversation_messages where id = test.id('m1')),
  'her words are kept, trimmed, as hers');
select test.ok((select count(*) = 1 and bool_and(campaign_id is null) from public.conversation_threads where workspace_id = test.id('lysne')),
  'the first message makes the talk about no campaign');
select test.ok((public.say(test.id('lysne'), '  Where is Night ritual?  ', null, '[]', 'chat-1') ->> 'id')::uuid = test.id('m1'),
  'the same request twice is one message');
select test.ok((public.say(test.id('lysne'), 'And the plan?', null, '[]', null) ->> 'fume_answers')::boolean,
  'Fume answers a customer while no person has taken over');
select test.refuses($$ select public.say(test.id('lysne'), '   ', null, '[]', null) $$, 'invalid', 'an empty message is refused');
select test.refuses($$ select public.say(test.id('lysne'), repeat('x', 4001), null, '[]', null) $$, 'invalid', 'so is one too long');
select test.keep('file', (public.say(test.id('lysne'), '', null, '[{"name": "brief.pdf", "bytes": 1200}]', null) ->> 'id')::uuid);
select test.ok((select attachments @> '[{"name": "brief.pdf", "bytes": 1200}]' from public.conversation_messages where id = test.id('file')),
  'a file alone is a message');

select test.act('user+solv@fumecreatives.com');
select test.refuses($$ select public.say(test.id('lysne'), 'Hello', null, '[]', null) $$, 'not_found', 'another brand cannot write here');
select test.ok(not exists (select 1 from public.conversation_messages where workspace_id = test.id('lysne')), 'nor read it');

-- ─── What Fume knows, and what it may write (the service role) ──────────────
reset role;
select test.ok((public.fume_chat_context(test.id('m1')) ->> 'answer')::boolean, 'Fume may answer her message');
select test.ok((select bool_and((c -> 'creatives' ->> 'waiting_on_you')::int <= (select count(*) from public.creative_versions v
    join public.creatives cr on cr.id = v.creative_id where cr.campaign_id = (c ->> 'id')::uuid and v.sent_at is not null))
  from jsonb_array_elements(public.fume_chat_context(test.id('m1')) -> 'campaigns') c),
  'only sent work counts as waiting on her');
select test.ok(jsonb_array_length(public.fume_chat_context(test.id('m1')) -> 'talk') = 0, 'the talk holds what came before it');

select test.keep('a1', (public.fume_chat_answer(test.id('m1'), 'Night ritual is at the plan.',
  jsonb_build_object('kind', 'link', 'link', jsonb_build_object('kind', 'campaign', 'campaignId', test.id('campaign')))) ->> 'id')::uuid);
select test.ok((select m.author_kind = 'fume' and m.card #>> '{link,campaignId}' = test.id('campaign')::text and t.campaign_id = test.id('campaign')
  from public.conversation_messages m join public.conversation_threads t on t.id = m.thread_id where m.id = test.id('a1')),
  'talk about a campaign lands in its thread, with a link to it');
select test.ok(public.fume_chat_answer(test.id('m1'), 'Again', null) is null, 'a message is answered once');
select test.ok(not (public.fume_chat_context(test.id('m1')) ->> 'answer')::boolean, 'and Fume knows it');

select test.keep('m2', (select id from public.conversation_messages where text = 'And the plan?'));
select test.ok((public.fume_chat_answer(test.id('m2'), 'Here.',
  jsonb_build_object('kind', 'link', 'link', jsonb_build_object('kind', 'campaign', 'campaignId', gen_random_uuid()))) -> 'card') = 'null'::jsonb,
  'a card that points outside the brand is dropped');

-- ─── The handover ────────────────────────────────────────────────────────────
set role authenticated;
select test.act('marcus+lysne@fumecreatives.com');
select test.keep('m3', (public.say(test.id('lysne'), 'Can I change my package?', null, '[]', null) ->> 'id')::uuid);
reset role;
select test.keep('a3', (public.fume_chat_answer(test.id('m3'), '', jsonb_build_object('kind', 'handover', 'reason', 'Packages are handled by people at Fume.')) ->> 'id')::uuid);
select test.ok((select card ->> 'userId' = (select id::text from public.profiles where email = 'william@fumecreatives.com')
    and text = 'That is one for a person. William at Fume will answer you here.' from public.conversation_messages where id = test.id('a3')),
  'Fume hands over to the brand''s account manager, by name');
select test.ok((select handed_to = (select id from public.profiles where email = 'william@fumecreatives.com')
  from public.conversation_threads where workspace_id = test.id('lysne') and campaign_id is null), 'the talk is his now');
select test.ok(not (public.fume_chat_context(test.id('m3')) ->> 'answer')::boolean, 'Fume stays quiet once a person has it');

set role authenticated;
select test.act('marcus+lysne@fumecreatives.com');
select test.ok(not (public.say(test.id('lysne'), 'Thanks!', null, '[]', null) ->> 'fume_answers')::boolean,
  'her next words go to him, not to Fume');
select test.act('william@fumecreatives.com');
select test.ok((select count(*) = 1 and bool_and(kind = 'mention' and count = 2 and text = 'LYSNE wrote 2 messages to you in the chat')
  from public.notifications where group_key like 'chat:%'), 'he hears it in the bell, folded');
select test.ok(not (public.say(test.id('lysne'), 'Hi, William here. Yes you can.', null, '[]', null) ->> 'fume_answers')::boolean,
  'he answers as himself');

select test.act('marcus+lysne@fumecreatives.com');
select test.ok(exists (select 1 from public.notifications where kind = 'mention' and text = 'William at Fume answered you'
  and href like '/fume/%'), 'she hears that a person answered');
select public.mark_conversation_read(test.id('lysne'));
select test.ok((select count(*) from public.conversation_reads) = (select count(*) from public.conversation_threads where workspace_id = test.id('lysne')),
  'she marks the whole conversation read');

-- ─── Only Fume writes Fume's words ───────────────────────────────────────────
do $$
begin
  perform public.fume_chat_answer(test.id('m2'), 'I am Fume', null);
  raise exception 'FAIL a signed-in person cannot write as Fume';
exception when insufficient_privilege then
  raise notice 'ok   a signed-in person cannot write as Fume';
end $$;
do $$
begin
  perform public.fume_chat_context(test.id('m2'));
  raise exception 'FAIL nor read what Fume reads';
exception when insufficient_privilege then
  raise notice 'ok   nor read what Fume reads';
end $$;
select test.ok(true, 'all of the chat''s tests passed');
