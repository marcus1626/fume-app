-- The MVP cycle and its negative tests (docs/mvp/domain-model.md §5), run against the migrations and the seed.
-- Each step signs in as a person (test.act), calls the commands as the authenticated role, and checks the result or
-- the error code. Run by tools/db/test.sh; any failure stops the run.

\set ON_ERROR_STOP 1
set client_min_messages = warning;

-- Everyone signs in once, so their invitations turn into access.
select test.signup(e) from unnest(array['marcus@fumecreatives.com', 'william@fumecreatives.com', 'kristian@fumecreatives.com',
  'marcus+lysne@fumecreatives.com',
  'member+lysne@fumecreatives.com', 'user+solv@fumecreatives.com']) e;

set client_min_messages = notice;
select test.ok((select staff_role from public.profiles where email = 'marcus@fumecreatives.com') = 'admin', 'invitation makes Marcus admin');
select test.ok(exists (select 1 from public.memberships m join public.profiles p on p.id = m.user_id
  where p.email = 'marcus+lysne@fumecreatives.com' and m.role = 'approver'), 'invitation makes the approver LYSNE''s approver');
select test.ok(exists (select 1 from public.staff_assignments a join public.profiles p on p.id = a.user_id
  where p.email = 'kristian@fumecreatives.com' and a.staff_role = 'designer' and a.can_check), 'Kristian is a designer who may check');
select test.ok(exists (select 1 from public.staff_assignments a join public.profiles p on p.id = a.user_id
  where p.email = 'william@fumecreatives.com' and a.staff_role = 'account_manager' and not a.can_check), 'William is an account manager and may not check');

select test.refuses($$ select test.signup('stranger@example.com') $$, 'forbidden', 'an address without an invitation gets no account');

select test.keep('lysne', '0b000000-0000-4000-8000-000000000001');
select test.keep('solv', '0b000000-0000-4000-8000-000000000002');
select test.keep('oil', '0e000000-0000-4000-8000-000000000001');
select test.keep('fact_cap', (select id from public.product_facts where label = 'Cap' and product_id = test.id('oil')));

-- ─── Access ──────────────────────────────────────────────────────────────────
set role authenticated;

select test.act('user+solv@fumecreatives.com');
select test.ok((select count(*) from public.products) = 0, 'SOLV sees none of LYSNE''s products');
select test.ok((select count(*) from public.workspaces) = 1, 'SOLV sees only its own workspace');
select test.refuses($$ select public.verify_fact(test.id('fact_cap')) $$, 'not_found', 'SOLV cannot verify a LYSNE fact (5)');
select test.refuses($$ select public.create_campaign(test.id('lysne'), 'x', array[test.id('oil')]) $$, 'not_found', 'SOLV cannot start a LYSNE campaign (5)');

select set_config('request.jwt.claims', '', false);
select test.refuses($$ select public.verify_fact(test.id('fact_cap')) $$, 'forbidden', 'nobody signed in cannot act');

-- ─── Product evidence and the plan ───────────────────────────────────────────

select test.act('marcus+lysne@fumecreatives.com');
select test.keep('campaign', (public.create_campaign(test.id('lysne'), 'The hour before sleep', array[test.id('oil')]) ->> 'id')::uuid);
select test.refuses($$ select public.send_brief(test.id('campaign'), '{"objective":"Launch"}') $$, 'invalid', 'an incomplete brief names what is missing');
select public.send_brief(test.id('campaign'), '{"objective":"Make the evening ritual the reason to buy","audience":"Women 30-50 who wind down with a ritual","message":"For the hour before sleep","formats":"feed, square, story","count":"4"}');
select test.ok((select written_by from public.plan_versions where campaign_id = test.id('campaign') and version = 1) = 'fume'
  and (select jsonb_array_length(body -> 'planned_creatives') from public.plan_versions where campaign_id = test.id('campaign') and version = 1) = 3,
  'sending the brief has Fume write plan 1: a master and two formats');
select test.ok((select brief_draft ->> 'message' from public.campaigns where id = test.id('campaign')) = 'For the hour before sleep', 'the sent brief stays as the draft to change');

select test.act('member+lysne@fumecreatives.com');
select test.refuses($$ select public.write_plan(test.id('campaign'), '{}') $$, 'forbidden', 'a member cannot write Fume''s plan');

select test.act('marcus@fumecreatives.com');
select public.write_plan(test.id('campaign'),
  '{"directions":[{"id":"a","name":"Evening stone"}],"chosen_direction_id":"a","planned_creatives":[{"kind":"master","format":"feed"}]}');
select public.write_plan(test.id('campaign'),
  '{"directions":[{"id":"a","name":"Evening stone"}],"chosen_direction_id":"a","planned_creatives":[{"kind":"master","format":"feed"}]}',
  array['Master 1: the cap lit from the side']);
select test.refuses($$ select public.approve_plan(test.id('campaign'), 3) $$, 'forbidden', 'Fume''s admin cannot approve the plan (2)');

select test.act('marcus+lysne@fumecreatives.com');
select public.ask_plan_check(test.id('campaign'), 3);
select test.act('kristian@fumecreatives.com');
select public.check_plan(test.id('campaign'), 3);

select test.act('marcus+lysne@fumecreatives.com');
select test.refuses($$ select public.approve_plan(test.id('campaign'), 1) $$, 'conflict', 'approving a stale plan version is refused (6)');
select test.refuses($$ select public.approve_plan(test.id('campaign'), 3) $$, 'invalid', 'unverified required facts block the plan (7)');

select test.act('member+lysne@fumecreatives.com');
select test.refuses($$ select public.verify_fact(test.id('fact_cap')) $$, 'forbidden', 'a member cannot verify a fact');

select test.act('marcus@fumecreatives.com');
select test.refuses($$ select public.start_job(test.id('campaign'), 'master', '{"provider":"manual"}') $$, 'invalid', 'production waits for the approved plan (8)');

select test.act('marcus+lysne@fumecreatives.com');
select public.verify_fact(f.id) from public.product_facts f where f.required;
select test.ok(cardinality(app.unverified_required_facts(test.id('campaign'))) = 0, 'the approver verified the four required facts');
select public.approve_plan(test.id('campaign'), 3, 'approve-plan-1');
select test.ok((public.approve_plan(test.id('campaign'), 3, 'approve-plan-1') ->> 'state') = 'approved', 'approving again with the same key returns the first result');
select test.refuses($$ select public.approve_plan(test.id('campaign'), 4, 'approve-plan-1') $$, 'conflict', 'the same key with another body is refused');

-- ─── Manual production through the system ────────────────────────────────────

select test.act('marcus@fumecreatives.com');
select test.keep('job', (public.start_job(test.id('campaign'), 'master', '{"provider":"manual","task":"reference_guided"}', '[]', null, null, 'manual', 'job-1') ->> 'id')::uuid);
select test.ok((public.start_job(test.id('campaign'), 'master', '{"provider":"manual","task":"reference_guided"}', '[]', null, null, 'manual', 'job-1') ->> 'id')::uuid = test.id('job'), 'starting the same job twice makes one job (12)');
select test.ok((select count(*) from public.production_jobs where campaign_id = test.id('campaign')) = 1, 'one job in the database');
select test.ok((select jsonb_array_length(s.facts) from public.context_snapshots s join public.production_jobs j on j.snapshot_id = s.id where j.id = test.id('job')) = 6, 'the job''s snapshot holds the six facts');

-- the designer uploads a picture made by hand (storage is stubbed here; the app uploads to the bucket)
reset role;
insert into storage.objects (bucket_id, name, owner_id)
values ('workspace-files', '0b000000-0000-4000-8000-000000000001/master-v1.jpg', (select id::text from public.profiles where email = 'marcus@fumecreatives.com')),
       ('workspace-files', '0b000000-0000-4000-8000-000000000001/master-v2.jpg', (select id::text from public.profiles where email = 'marcus@fumecreatives.com'));
set role authenticated;

select test.act('marcus+lysne@fumecreatives.com');
select test.refuses($$ select public.register_file(test.id('lysne'), '0b000000-0000-4000-8000-000000000001/master-v1.jpg', 'm.jpg', 'image/jpeg', 1, null, null, null, 'candidate') $$, 'forbidden', 'a customer cannot add a production candidate');

select test.act('marcus@fumecreatives.com');
select test.keep('file1', (public.register_file(test.id('lysne'), '0b000000-0000-4000-8000-000000000001/master-v1.jpg', 'master-v1.jpg', 'image/jpeg', 812000, 'sha-v1', 1080, 1350, 'candidate') ->> 'id')::uuid);
select test.refuses($$ select public.add_candidate(test.id('job'), test.id('file1'), 'manual', '') $$, 'invalid', 'a manual candidate must say how it was made');
select test.keep('cand1', (public.add_candidate(test.id('job'), test.id('file1'), 'manual', 'Retouched packshot in a stone scene, Photoshop') ->> 'id')::uuid);
select test.ok((select state from public.production_jobs where id = test.id('job')) = 'succeeded', 'a manual candidate completes the job');
select test.keep('v1', (public.send_to_check(test.id('cand1'), 'feed', 'Night Body Oil · Feed 1') ->> 'id')::uuid);

-- ─── The gate: unchecked work never reaches the customer ─────────────────────

select test.act('marcus+lysne@fumecreatives.com');
select test.ok((select count(*) from public.creative_versions v join public.creatives c on c.id = v.creative_id where c.campaign_id = test.id('campaign')) = 0, 'the customer cannot see a version in check (4)');
select test.ok((select count(*) from public.files where id = test.id('file1')) = 0, 'the customer cannot see its file row (4)');
select test.ok(not app.can_read_object('0b000000-0000-4000-8000-000000000001/master-v1.jpg'), 'the customer cannot read its bytes from storage (4)');
select test.ok((select count(*) from public.production_jobs where campaign_id = test.id('campaign')) = 0 and (select count(*) from public.candidates) = 0, 'jobs and candidates stay with Fume');
select test.refuses($$ select public.approve_versions(array[test.id('v1')]) $$, 'not_found', 'the customer cannot approve an unchecked version (3)');

select test.act('marcus@fumecreatives.com');
select test.refuses($$ select public.mark_checked(test.id('v1')) $$, 'forbidden', 'a designer without the right to check cannot check');
select test.act('william@fumecreatives.com');
select test.refuses($$ select public.mark_checked(test.id('v1')) $$, 'forbidden', 'the account manager never checks a creative');
select test.refuses($$ select public.write_plan(test.id('campaign'), '{}') $$, 'forbidden', 'the account manager does not write the plan');
select test.act('kristian@fumecreatives.com');
select public.add_finding(test.id('v1'), 'product', 'critical', 'Cap reads glossy', 'automated');
select test.refuses($$ select public.mark_checked(test.id('v1')) $$, 'conflict', 'an open critical finding blocks the check');
select public.resolve_finding((select id from public.findings where version_id = test.id('v1') limit 1), 'accepted');
select public.mark_checked(test.id('v1'), '[{"against":"Cap","result":"pass"}]', 'check-v1');
select test.ok((public.mark_checked(test.id('v1'), '[{"against":"Cap","result":"pass"}]', 'check-v1') ->> 'state') = 'checked', 'checking twice with the same key is one check (13)');
select test.refuses($$ select public.approve_versions(array[test.id('v1')]) $$, 'forbidden', 'the one who checked cannot approve (2)');

select test.act('marcus+lysne@fumecreatives.com');
select test.ok((select count(*) from public.creative_versions v join public.creatives c on c.id = v.creative_id where c.campaign_id = test.id('campaign')) = 0, 'checked but not sent: still hidden');
select test.ok((select count(*) from public.record_events where workspace_id = test.id('lysne') and at >= test.since() and subject_type in ('creative_version', 'candidate', 'production_job', 'finding', 'file')) = 0, 'the record shows nothing of unsent work or production');
select test.act('marcus@fumecreatives.com');
select public.send_checked(test.id('campaign'));
select test.act('marcus+lysne@fumecreatives.com');
select test.ok((select count(*) from public.creative_versions v join public.creatives c on c.id = v.creative_id where c.campaign_id = test.id('campaign')) = 1, 'checked and sent: the customer sees it');
select test.ok((select count(*) from public.expert_checks e join public.creative_versions v on v.id = e.version_id join public.creatives c on c.id = v.creative_id where c.campaign_id = test.id('campaign') and e.state = 'checked' and e.expert_id is not null) = 1, 'the customer sees who checked it');
select test.ok((select count(*) from public.findings f join public.creative_versions v on v.id = f.version_id join public.creatives c on c.id = v.creative_id where c.campaign_id = test.id('campaign')) = 0, 'automated findings stay with Fume');
select test.ok(app.can_read_object('0b000000-0000-4000-8000-000000000001/master-v1.jpg'), 'now the customer can read its file');

select test.act('member+lysne@fumecreatives.com');
select test.refuses($$ select public.approve_versions(array[test.id('v1')]) $$, 'forbidden', 'a member cannot approve (1)');

-- ─── A correction makes a new version that starts from nothing ───────────────

select test.act('marcus+lysne@fumecreatives.com');
select public.request_changes(test.id('v1'), 'correction', 'The cap reads glossy', '["the cap''s finish"]', '["scene","light","label"]');
select test.ok((select rounds_used from public.campaigns where id = test.id('campaign')) = 0, 'a correction uses no round');

select test.act('marcus@fumecreatives.com');
select test.keep('job2', (public.start_job(test.id('campaign'), 'correction', '{"provider":"manual","task":"edit"}', '[]', (select creative_id from public.creative_versions where id = test.id('v1')), null, 'manual') ->> 'id')::uuid);
select test.keep('file2', (public.register_file(test.id('lysne'), '0b000000-0000-4000-8000-000000000001/master-v2.jpg', 'master-v2.jpg', 'image/jpeg', 820000, 'sha-v2', 1080, 1350, 'candidate') ->> 'id')::uuid);
select test.keep('cand2', (public.add_candidate(test.id('job2'), test.id('file2'), 'manual', 'Cap retouched to matte') ->> 'id')::uuid);
select test.keep('v2', (public.send_to_check(test.id('cand2')) ->> 'id')::uuid);
select test.ok((select number from public.creative_versions where id = test.id('v2')) = 2, 'the correction is version 2');
select test.ok(not exists (select 1 from public.approvals where version_id = test.id('v2'))
  and (select state from public.expert_checks where version_id = test.id('v2')) = 'waiting', 'version 2 has no approval and a waiting check (11)');
select test.ok((select new_version_id from public.change_requests where version_id = test.id('v1')) = test.id('v2'), 'the change request points at the version that answers it');

select test.act('kristian@fumecreatives.com');
select test.refuses($$ select public.mark_checked(test.id('v1')) $$, 'conflict', 'an old version cannot be checked');
select public.mark_checked(test.id('v2'));
select test.act('marcus@fumecreatives.com');
select public.send_checked(test.id('campaign'));

select test.act('marcus+lysne@fumecreatives.com');
select test.refuses($$ select public.approve_versions(array[test.id('v1')]) $$, 'conflict', 'approving version 1 after version 2 exists is refused (10)');
select public.approve_versions(array[test.id('v2')]);
select test.ok((select decided_by from public.approvals where version_id = test.id('v2')) = (select id from public.profiles where email = 'marcus+lysne@fumecreatives.com'), 'the approval names the approver and version 2');

-- ─── Formats need an approved master ─────────────────────────────────────────

select test.act('marcus@fumecreatives.com');
select test.refuses($$ select public.start_job(test.id('campaign'), 'format', '{"provider":"manual"}', '[]', null, test.id('v1'), 'manual') $$, 'invalid', 'a format from an unapproved master version is refused (9)');
select test.keep('job3', (public.start_job(test.id('campaign'), 'format', '{"provider":"manual"}', '[]', null, test.id('v2'), 'manual') ->> 'id')::uuid);

-- ─── Delivery points at exact approved files ─────────────────────────────────

select test.act('marcus+lysne@fumecreatives.com');
select test.refuses($$ select public.make_delivery(test.id('campaign'), '') $$, 'invalid', 'a delivery needs its usage rights');
select test.keep('delivery', (public.make_delivery(test.id('campaign'), 'Paid and organic social in Norway, 12 months') ->> 'id')::uuid);
select test.ok((select version_id from public.delivery_items where delivery_id = test.id('delivery')) = test.id('v2'), 'the delivery holds version 2');
select test.ok((select sha256 from public.delivery_items where delivery_id = test.id('delivery')) = 'sha-v2', 'its checksum is the approved file''s (15)');
select test.refuses($$ select public.undo_approval(test.id('v2')) $$, 'conflict', 'a delivered approval cannot be undone');
select public.confirm_live(test.id('delivery'));
select test.ok((select state from public.campaigns where id = test.id('campaign')) = 'delivered', 'the campaign is delivered');

-- ─── The record ──────────────────────────────────────────────────────────────

select test.ok((select count(*) from public.record_events where workspace_id = test.id('lysne') and at >= test.since() and action = 'version.approved') = 1, 'one approval event, though approve ran with retries');
select test.ok((select count(*) from public.record_events where workspace_id = test.id('lysne') and at >= test.since() and action = 'version.checked') = 2, 'two check events, one per version');

set role authenticated;

-- ─── Two pairs of eyes: nobody checks their own work ─────────────────────────

reset role;
insert into storage.objects (bucket_id, name, owner_id)
values ('workspace-files', '0b000000-0000-4000-8000-000000000001/square-v1.jpg', (select id::text from public.profiles where email = 'kristian@fumecreatives.com'));
set role authenticated;

select test.act('kristian@fumecreatives.com');
select test.keep('file3', (public.register_file(test.id('lysne'), '0b000000-0000-4000-8000-000000000001/square-v1.jpg', 'square-v1.jpg', 'image/jpeg', 700000, 'sha-s1', 1080, 1080, 'candidate') ->> 'id')::uuid);
select test.keep('cand3', (public.add_candidate(test.id('job3'), test.id('file3'), 'manual', 'Cropped the approved master to square') ->> 'id')::uuid);
select test.keep('v3', (public.send_to_check(test.id('cand3'), 'square', 'Night Body Oil · Square 1') ->> 'id')::uuid);
select test.refuses($$ select public.mark_checked(test.id('v3')) $$, 'forbidden', 'the one who made a version cannot check it');


reset role;
select test.ok(true, 'all rule tests passed');
