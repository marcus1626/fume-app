-- Agencies (20261103140000_agency.sql): Fume makes an agency and its lead; the lead adds a client and invites its
-- people; the agency checks the plan and the creatives and sends them; only the client approves, in Fume or through
-- the client link, which the agency's own people only preview.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;
set role authenticated;

-- ─── Fume makes the agency; the lead joins ───────────────────────────────────

select test.act('marcus@fumecreatives.com');
select test.keep('agency', (public.create_agency('Brygga Studio') ->> 'id')::uuid);
select public.invite_agency_person(test.id('agency'), 'nora@brygga.test', 'Nora Lie', 'Creative lead', 'lead');
select test.act('member+lysne@fumecreatives.com');
select test.refuses($$ select public.create_agency('Mine') $$, 'forbidden', 'only Fume makes an agency');

select test.act('nora@brygga.test');
select test.ok((select role = 'lead' from public.agency_seats where user_id = auth.uid()), 'the invitation becomes her seat at sign-in');
select test.ok((select name = 'Brygga Studio' from public.organisations where id = test.id('agency')), 'she sees her agency');
select public.invite_agency_person(test.id('agency'), 'even@brygga.test', 'Even Dahl', 'Designer', 'creative');
select test.keep('even', test.signup('even@brygga.test'));
select test.ok((select count(*) = 2 from public.agency_seats), 'the lead brings in a creative');

-- ─── The lead adds a client and invites its people ───────────────────────────

select test.keep('client', (public.add_client('Halm Møbler', 'Norway', 'no', 'https://halm.test', 'add-halm') ->> 'id')::uuid);
select test.ok((public.add_client('Halm Møbler', 'Norway', 'no', 'https://halm.test', 'add-halm') ->> 'id')::uuid = test.id('client'),
  'the same request twice is one client');
select test.ok((select agency_id = test.id('agency') and slug like 'halm-m-bler-%' from public.workspaces where id = test.id('client')),
  'the client brand is run by the agency');
select test.ok(app.can_check(test.id('client')) and app.is_staff(test.id('client'), array['account_manager']),
  'the lead checks and runs the client');
select public.invite_member(test.id('client'), 'sara@halm.test', 'owner', 'Sara Halm', 'CEO');
select public.invite_member(test.id('client'), 'jon@halm.test', 'member', 'Jon Halm', 'Marketing');
select test.keep('sara', test.signup('sara@halm.test'));
select test.keep('jon', test.signup('jon@halm.test'));
select test.ok(not exists (select 1 from public.workspaces where id = test.id('lysne')), 'the agency does not see Fume''s own brands');

select test.act('even@brygga.test');
select test.ok(app.can_check(test.id('client')) and not app.is_staff(test.id('client'), array['account_manager']),
  'a creative checks the client''s work but does not run the client');
select test.refuses($$ select public.add_client('Mine', '', 'en', null, null) $$, 'forbidden', 'only the lead adds clients');
select test.ok((select count(*) = 2 from public.profiles where email like '%@brygga.test'), 'the agency''s people see each other');

select test.act('sara@halm.test');
select test.ok((select name = 'Brygga Studio' from public.organisations where id = test.id('agency')),
  'the client sees which agency runs her brand');
select test.ok(exists (select 1 from public.profiles where email = 'nora@brygga.test'), 'and who at the agency works on it');

reset role;
insert into storage.objects (bucket_id, name, owner_id)
select 'workspace-files', test.id('client') || '/' || n || '.jpg', test.id('even')::text from unnest(array['a1', 'b1']) n;
insert into public.products (workspace_id, name, variant, sku) values (test.id('client'), 'Studio chair', 'Oak', 'SC-1');
select test.keep('chair', (select id from public.products where sku = 'SC-1'));
set role authenticated;
select test.act('sara@halm.test');

-- ─── The plan waits for the agency's check ───────────────────────────────────

select test.keep('hc', (public.create_campaign(test.id('client'), 'Black Friday', array[test.id('chair')]) ->> 'id')::uuid);
select public.send_brief(test.id('hc'), '{"objective":"Sell the chair","audience":"Home makers","message":"One chair, for good","formats":"feed","count":"2"}');
select test.ok((select state = 'in_check' from public.plan_versions where campaign_id = test.id('hc') order by version desc limit 1),
  'Fume''s plan for a client waits for the agency''s check');
select test.refuses($$ select public.approve_plan(test.id('hc'), 1) $$, 'conflict', 'the client cannot approve it before the agency sent it');
select test.refuses($$ select public.send_to_client(test.id('hc'), '{}', '{}', true, null, true, null) $$, 'forbidden',
  'the client does not send to herself');

select test.act('even@brygga.test');
select test.refuses($$ select public.send_to_client(test.id('hc'), '{}', array[test.id('even')], false, null, true, null) $$, 'invalid',
  'the agency sends to the client''s own people');
select test.refuses($$ select public.send_to_client(test.id('hc'), '{}', '{}', false, null, false, null) $$, 'invalid',
  'a send holds something');
select test.keep('send1', (public.send_to_client(test.id('hc'), '{}', array[test.id('sara')], true, 'The plan for Black Friday', true, 'send-1') ->> 'id')::uuid);
select test.keep('plan', (select id from public.plan_versions where campaign_id = test.id('hc') order by version desc limit 1));
select test.ok((select state = 'ready' and checked_by = test.id('even') from public.plan_versions where id = test.id('plan')),
  'sending the plan is the agency''s check of it');
select test.ok((select link_token is not null and plan_version = 1 from public.client_sends where id = test.id('send1')),
  'the send makes the campaign''s client link');

select test.act('sara@halm.test');
select test.ok(exists (select 1 from public.notifications where kind = 'waiting_on_you' and text = 'The plan for Black Friday is ready'),
  'the client hears the plan is hers');
select test.ok(exists (select 1 from public.client_sends where id = test.id('send1')), 'she sees what was sent to her');
select test.ok(not exists (select 1 from public.client_links), 'but not the link''s secret');

-- ─── The client link (the edge function, as the service role) ────────────────

reset role;
create temp table link as select link_token as token from public.client_sends where id = test.id('send1');
grant select on link to authenticated;
select test.ok((select jsonb_array_length(public.client_link_view(token) -> 'plans') >= 1
    and public.client_link_view(token) #>> '{agency,name}' = 'Brygga Studio' from link), 'the link opens the plan, from the agency');
select test.refuses($$ select public.client_link_view('nope') $$, 'not_found', 'a made-up link opens nothing');
select test.refuses(format($$ select public.client_link_plan(%L, 'approve', null, 'Nora', %L) $$,
  (select token from link), (select id from public.profiles where email = 'nora@brygga.test')), 'forbidden',
  'the agency only previews the link');
select test.ok((select public.client_link_plan(token, 'approve', null, 'Sara') ->> 'state' = 'approved' from link),
  'the client approves the plan through the link');
select test.ok((select approved_by = test.id('sara') from public.plan_versions where id = test.id('plan')), 'as herself');

-- ─── The agency makes, checks and sends; she approves ────────────────────────

set role authenticated;
select test.act('even@brygga.test');
select test.keep('ja', (public.start_job(test.id('hc'), 'master', '{"provider":"manual"}', '[]', null, null, 'manual') ->> 'id')::uuid);
select test.keep('jb', (public.start_job(test.id('hc'), 'master', '{"provider":"manual"}', '[]', null, null, 'manual') ->> 'id')::uuid);
select test.keep('fa', (public.register_file(test.id('client'), test.id('client') || '/a1.jpg', 'a1.jpg', 'image/jpeg', 500000, 'sha-ag-a1', 1080, 1350, 'candidate') ->> 'id')::uuid);
select test.keep('fb', (public.register_file(test.id('client'), test.id('client') || '/b1.jpg', 'b1.jpg', 'image/jpeg', 500000, 'sha-ag-b1', 1080, 1350, 'candidate') ->> 'id')::uuid);
select test.keep('va', (public.send_to_check((public.add_candidate(test.id('ja'), test.id('fa'), 'manual', 'Chair at dusk') ->> 'id')::uuid, 'feed', 'Feed A') ->> 'id')::uuid);
select test.keep('vb', (public.send_to_check((public.add_candidate(test.id('jb'), test.id('fb'), 'manual', 'Chair at dawn') ->> 'id')::uuid, 'feed', 'Feed B') ->> 'id')::uuid);
select test.refuses($$ select public.send_to_client(test.id('hc'), array[test.id('va')], array[test.id('sara')], true, null, false, null) $$,
  'conflict', 'only checked creatives go to the client');
select test.act('nora@brygga.test');
select public.mark_checked(test.id('va'));
select public.mark_checked(test.id('vb'));
select test.keep('send2', (public.send_to_client(test.id('hc'), array[test.id('va'), test.id('vb')], array[test.id('sara')], true, null, false, null) ->> 'id')::uuid);
select test.ok((select link_token from public.client_sends where id = test.id('send2')) = (select token from link),
  'a campaign has one client link');

select test.act('sara@halm.test');
select test.ok((select count(*) = 2 from public.creative_versions where id in (test.id('va'), test.id('vb'))), 'she sees the sent creatives');

reset role;
select test.ok((select jsonb_array_length(public.client_link_view(token) -> 'creatives') = 2 from link), 'the link holds them');
select test.ok((select public.client_link_answer(token, test.id('va'), 'approve', null, 'Sara H') ->> 'state' = 'approved' from link),
  'she approves one through the link');
select test.ok((select decided_by = test.id('sara') and recorded_note = 'Through the client link, by Sara H'
  from public.approvals where version_id = test.id('va')), 'the approval is hers, through the link');
select test.refuses(format($$ select public.client_link_answer(%L, %L, 'changes', '  ', 'Sara', null) $$, (select token from link), test.id('vb')),
  'invalid', 'a change says what should change');

set role authenticated;
select test.act('nora@brygga.test');
select test.ok(exists (select 1 from public.notifications where kind = 'approved' and text like 'Sara approved 1 creative in Black Friday'),
  'the agency hears she approved');
select test.refuses($$ select public.record_client_approval(array[test.id('vb')], test.id('jon'), 'By mail', null) $$, 'invalid',
  'a recorded approval names someone who approves for the client');
select test.ok((select jsonb_array_length(public.record_client_approval(array[test.id('vb')], test.id('sara'), 'Approved by mail on Monday',
  now() - interval '1 day')) = 1), 'the agency records an approval she gave by mail');
select test.ok((select decided_by = test.id('sara') and recorded_by = auth.uid() and created_at < now() - interval '23 hours'
  from public.approvals where version_id = test.id('vb')), 'it stays hers, recorded by the agency, on the day she gave it');
select test.ok((select state = 'approved' from public.campaigns where id = test.id('hc')), 'the campaign is approved');

-- ─── Asking Fume ─────────────────────────────────────────────────────────────

select test.ok((public.ask_fume('manpower', test.id('client'), test.id('hc'), array['checks'], 'About 20 creatives', 'This week') ->> 'state') = 'sent',
  'the agency borrows Fume''s people');
select test.refuses($$ select public.ask_fume('manpower', test.id('lysne'), null, array['checks']) $$, 'invalid',
  'for one of its own clients');
select test.refuses($$ select public.ask_fume('support', null, null, '{}', null, null, 'Invoice', '  ') $$, 'invalid',
  'a question says what it is about');
select test.act('sara@halm.test');
select test.refuses($$ select public.ask_fume('support', null, null, '{}', null, null, null, 'Hi') $$, 'forbidden',
  'the client asks Fume through her agency');
select test.ok(not exists (select 1 from public.fume_requests), 'nor reads what the agency asked');

-- ─── Leaving the agency ──────────────────────────────────────────────────────

reset role;
delete from public.agency_seats where user_id = test.id('even');
select test.ok(not exists (select 1 from public.staff_assignments where user_id = test.id('even')),
  'a person who leaves the agency leaves its clients');
reset role;
select test.ok(true, 'all of the agency''s tests passed');
