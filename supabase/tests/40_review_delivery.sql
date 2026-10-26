-- The customer's review and the delivery (20261027120000_review_delivery.sql): one change request per review set and
-- its Undo, undo of several approvals, replies and resolving, what a member and a viewer may do, and a delivery that
-- never packs the same version twice. Runs after 10_rules.sql, on a campaign of its own.

\set ON_ERROR_STOP 1
set client_min_messages = warning;

-- A viewer for LYSNE, test only.
insert into public.invitations (email, workspace_id, role, name, title)
values ('viewer+lysne@fumecreatives.com', '0b000000-0000-4000-8000-000000000001', 'viewer', 'Test Viewer', 'Finance');
select test.signup('viewer+lysne@fumecreatives.com');

insert into storage.objects (bucket_id, name, owner_id)
select 'workspace-files', '0b000000-0000-4000-8000-000000000001/rd-' || n || '.jpg',
       (select id::text from public.profiles where email = 'marcus@fumecreatives.com')
from unnest(array['a1', 'b1', 'a2', 'a3']) n;

set client_min_messages = notice;
set role authenticated;

-- ─── A campaign with two checked, sent masters ───────────────────────────────

select test.act('marcus+lysne@fumecreatives.com');
select test.keep('rd', (public.create_campaign(test.id('lysne'), 'Review and delivery', array[test.id('oil')]) ->> 'id')::uuid);
select public.send_brief(test.id('rd'), '{"objective":"Rehearse review","audience":"Us","message":"For the hour before sleep","formats":"feed","count":"2"}');
select public.approve_plan(test.id('rd'), (select max(version) from public.plan_versions where campaign_id = test.id('rd')));

select test.act('marcus@fumecreatives.com');
select test.keep('rd_job_a', (public.start_job(test.id('rd'), 'master', '{"provider":"manual"}', '[]', null, null, 'manual') ->> 'id')::uuid);
select test.keep('rd_job_b', (public.start_job(test.id('rd'), 'master', '{"provider":"manual"}', '[]', null, null, 'manual') ->> 'id')::uuid);
select test.keep('rd_file_a1', (public.register_file(test.id('lysne'), '0b000000-0000-4000-8000-000000000001/rd-a1.jpg', 'rd-a1.jpg', 'image/jpeg', 500000, 'sha-rd-a1', 1080, 1350, 'candidate') ->> 'id')::uuid);
select test.keep('rd_file_b1', (public.register_file(test.id('lysne'), '0b000000-0000-4000-8000-000000000001/rd-b1.jpg', 'rd-b1.jpg', 'image/jpeg', 600000, 'sha-rd-b1', 1080, 1350, 'candidate') ->> 'id')::uuid);
select test.keep('rd_a1', (public.send_to_check((public.add_candidate(test.id('rd_job_a'), test.id('rd_file_a1'), 'manual', 'Stone scene, by hand') ->> 'id')::uuid, 'feed', 'Feed A') ->> 'id')::uuid);
select test.keep('rd_b1', (public.send_to_check((public.add_candidate(test.id('rd_job_b'), test.id('rd_file_b1'), 'manual', 'Linen scene, by hand') ->> 'id')::uuid, 'feed', 'Feed B') ->> 'id')::uuid);
select test.keep('rd_cr_a', (select creative_id from public.creative_versions where id = test.id('rd_a1')));

select test.act('kristian@fumecreatives.com');
select public.mark_checked(test.id('rd_a1'));
select public.mark_checked(test.id('rd_b1'));
select test.act('marcus@fumecreatives.com');
select public.send_checked(test.id('rd'));

-- ─── What a viewer and another brand may do ──────────────────────────────────

select test.act('viewer+lysne@fumecreatives.com');
select test.ok((select count(*) from public.creative_versions v join public.creatives c on c.id = v.creative_id
  where c.campaign_id = test.id('rd')) = 2, 'a viewer sees the two checked and sent versions');
select test.refuses($$ select public.add_comment(test.id('rd_a1'), 'Nice') $$, 'forbidden', 'a viewer cannot comment');
select test.refuses($$ select public.approve_versions(array[test.id('rd_a1')]) $$, 'forbidden', 'a viewer cannot approve');
select test.refuses($$ select public.request_change_round(test.id('rd'),
  jsonb_build_array(jsonb_build_object('version_id', test.id('rd_a1'), 'cause', 'revision', 'problem', 'x'))) $$,
  'forbidden', 'a viewer cannot ask for changes');

select test.act('user+solv@fumecreatives.com');
select test.refuses($$ select public.request_change_round(test.id('rd'),
  jsonb_build_array(jsonb_build_object('version_id', test.id('rd_a1'), 'cause', 'revision', 'problem', 'x'))) $$,
  'not_found', 'another brand cannot ask for changes on LYSNE''s campaign');

-- ─── Comments, replies, resolving ────────────────────────────────────────────

select test.act('marcus+lysne@fumecreatives.com');
select test.keep('rd_comment', (public.add_comment(test.id('rd_a1'), 'Could the oil catch the light?', '{"x":0.4,"y":0.6}') ->> 'id')::uuid);
select test.act('member+lysne@fumecreatives.com');
select test.keep('rd_reply', (public.reply_comment(test.id('rd_comment'), 'Agreed, a little warmer') ->> 'id')::uuid);
select test.ok((select reply_to from public.comments where id = test.id('rd_reply')) = test.id('rd_comment'), 'a member replies to a comment');
select test.ok((public.reply_comment(test.id('rd_reply'), 'And the cap?') ->> 'reply_to')::uuid = test.id('rd_comment'),
  'a reply to a reply answers the first comment');
select test.refuses($$ select public.resolve_comment(test.id('rd_reply')) $$, 'invalid', 'a reply is not resolved on its own');
select test.act('viewer+lysne@fumecreatives.com');
select test.refuses($$ select public.reply_comment(test.id('rd_comment'), 'x') $$, 'forbidden', 'a viewer cannot reply');
select test.refuses($$ select public.resolve_comment(test.id('rd_comment')) $$, 'forbidden', 'a viewer cannot resolve');
select test.act('user+solv@fumecreatives.com');
select test.refuses($$ select public.reply_comment(test.id('rd_comment'), 'x') $$, 'not_found', 'another brand cannot reply');
select test.act('marcus+lysne@fumecreatives.com');
select test.ok((public.resolve_comment(test.id('rd_comment')) ->> 'resolved_at') is not null, 'resolving a comment');
select test.ok((public.resolve_comment(test.id('rd_comment')) ->> 'resolved_at') is null, 'resolving again opens it again');

-- ─── One change request per review set, and its Undo ─────────────────────────

select test.refuses($$ select public.request_change_round(test.id('rd'), '[]') $$, 'invalid', 'a change request names at least one creative');
select test.refuses($$ select public.request_change_round(test.id('rd'),
  jsonb_build_array(jsonb_build_object('version_id', test.id('rd_a1'), 'cause', 'revision', 'problem', ' '))) $$,
  'invalid', 'a change request says what should change');
select test.refuses($$ select public.request_change_round(test.id('rd'),
  jsonb_build_array(jsonb_build_object('version_id', test.id('rd_a1'), 'cause', 'revision', 'problem', 'Warmer'),
                    jsonb_build_object('version_id', test.id('v2'), 'cause', 'revision', 'problem', 'Warmer'))) $$,
  'invalid', 'every creative in one change request is from the same campaign');
select test.ok((select rounds_used from public.campaigns where id = test.id('rd')) = 0, 'a refused change request uses no round');

-- a revision and a correction together: one round
select test.ok((public.request_change_round(test.id('rd'), jsonb_build_array(
  jsonb_build_object('version_id', test.id('rd_a1'), 'cause', 'revision', 'problem', 'Warmer light', 'must_change', '["colour"]',
                     'pins', '[{"x":0.4,"y":0.6,"text":"Could the oil catch the light?"}]'),
  jsonb_build_object('version_id', test.id('rd_b1'), 'cause', 'correction', 'problem', 'The cap reads glossy')), 'round-1') ->> 'rounds_left')::int = 1,
  'a set with a revision in it uses one round');
select test.ok((select count(distinct round_id) from public.change_requests cr join public.creative_versions v on v.id = cr.version_id
  where v.id in (test.id('rd_a1'), test.id('rd_b1'))) = 1, 'the set''s change requests share one round id');
select test.ok((select cause from public.change_requests where version_id = test.id('rd_b1')) = 'correction'
  and not (select uses_round from public.change_requests where version_id = test.id('rd_b1')), 'the correction in the set uses no round itself');
select test.ok((select state from public.campaigns where id = test.id('rd')) = 'revision', 'the campaign is in revision');
select test.ok((public.request_change_round(test.id('rd'), jsonb_build_array(
  jsonb_build_object('version_id', test.id('rd_a1'), 'cause', 'revision', 'problem', 'Warmer light', 'must_change', '["colour"]',
                     'pins', '[{"x":0.4,"y":0.6,"text":"Could the oil catch the light?"}]'),
  jsonb_build_object('version_id', test.id('rd_b1'), 'cause', 'correction', 'problem', 'The cap reads glossy')), 'round-1') ->> 'rounds_left')::int = 1
  and (select rounds_used from public.campaigns where id = test.id('rd')) = 1, 'sending the set again with the same key is one request');

select test.act('viewer+lysne@fumecreatives.com');
select test.refuses($$ select public.withdraw_change_round(test.id('rd'), array[test.id('rd_a1')]) $$, 'forbidden', 'a viewer cannot take a change request back');

select test.act('marcus+lysne@fumecreatives.com');
select test.ok(jsonb_array_length(public.withdraw_change_round(test.id('rd'), array[test.id('rd_a1'), test.id('rd_b1')])) = 2,
  'Undo takes the set back');
select test.ok((select rounds_used from public.campaigns where id = test.id('rd')) = 0
  and (select state from public.campaigns where id = test.id('rd')) = 'in_review'
  and (select count(*) from public.creative_versions where id in (test.id('rd_a1'), test.id('rd_b1')) and state = 'checked') = 2,
  'the round comes back and both creatives wait on her again');
select test.ok((select count(*) from public.change_requests where version_id in (test.id('rd_a1'), test.id('rd_b1')) and withdrawn_at is not null) = 2,
  'the withdrawn change requests stay on the record');
select test.refuses($$ select public.withdraw_change_round(test.id('rd'), array[test.id('rd_a1')]) $$, 'conflict', 'nothing to take back twice');

-- two revisions in one set: still one round; the round comes back only when the whole set is taken back
select public.request_change_round(test.id('rd'), jsonb_build_array(
  jsonb_build_object('version_id', test.id('rd_a1'), 'cause', 'revision', 'problem', 'Warmer'),
  jsonb_build_object('version_id', test.id('rd_b1'), 'cause', 'revision', 'problem', 'Closer')));
select test.ok((select rounds_used from public.campaigns where id = test.id('rd')) = 1, 'two revisions in one set use one round');
select public.withdraw_change_round(test.id('rd'), array[test.id('rd_a1')]);
select test.ok((select rounds_used from public.campaigns where id = test.id('rd')) = 1
  and (select state from public.campaigns where id = test.id('rd')) = 'revision', 'taking back part of the set keeps its round');
select public.withdraw_change_round(test.id('rd'), array[test.id('rd_b1')]);
select test.ok((select rounds_used from public.campaigns where id = test.id('rd')) = 0, 'taking back the rest gives the round back');

-- no rounds left
reset role;
update public.campaigns set rounds_used = rounds_included where id = test.id('rd');
set role authenticated;
select test.refuses($$ select public.request_change_round(test.id('rd'),
  jsonb_build_array(jsonb_build_object('version_id', test.id('rd_a1'), 'cause', 'revision', 'problem', 'Warmer'))) $$,
  'conflict', 'no revision when the package''s rounds are used');
select test.ok((public.request_change_round(test.id('rd'), jsonb_build_array(
  jsonb_build_object('version_id', test.id('rd_a1'), 'cause', 'correction', 'problem', 'The label is cropped'))) ->> 'uses_round')::boolean = false,
  'a correction still goes when no rounds are left');
reset role;
update public.campaigns set rounds_used = 0 where id = test.id('rd');
set role authenticated;

-- once Fume starts on it, Undo is refused
select test.act('marcus@fumecreatives.com');
select test.keep('rd_job_a2', (public.start_job(test.id('rd'), 'correction', '{"provider":"manual","task":"edit"}', '[]', test.id('rd_cr_a'), null, 'manual') ->> 'id')::uuid);
select test.act('marcus+lysne@fumecreatives.com');
select test.refuses($$ select public.withdraw_change_round(test.id('rd'), array[test.id('rd_a1')]) $$, 'conflict', 'Undo is refused once Fume has started');

-- the new version: in check it stays with Fume, comments on it too
select test.act('marcus@fumecreatives.com');
select test.keep('rd_file_a2', (public.register_file(test.id('lysne'), '0b000000-0000-4000-8000-000000000001/rd-a2.jpg', 'rd-a2.jpg', 'image/jpeg', 510000, 'sha-rd-a2', 1080, 1350, 'candidate') ->> 'id')::uuid);
select test.keep('rd_a2', (public.send_to_check((public.add_candidate(test.id('rd_job_a2'), test.id('rd_file_a2'), 'manual', 'Uncropped the label') ->> 'id')::uuid) ->> 'id')::uuid);
select test.act('kristian@fumecreatives.com');
select public.add_comment(test.id('rd_a2'), 'Label edge still soft?');
select test.act('marcus+lysne@fumecreatives.com');
select test.ok((select count(*) from public.creative_versions where id = test.id('rd_a2')) = 0, 'the approver cannot see version 2 in check');
select test.ok((select count(*) from public.comments where version_id = test.id('rd_a2')) = 0, 'nor Fume''s comment on it');
select test.refuses($$ select public.withdraw_change_round(test.id('rd'), array[test.id('rd_a1')]) $$, 'conflict', 'Undo is refused once a new version exists');
select test.act('kristian@fumecreatives.com');
select public.mark_checked(test.id('rd_a2'));
select test.act('marcus@fumecreatives.com');
select public.send_checked(test.id('rd'));

-- ─── Approve, and Undo of several ────────────────────────────────────────────

select test.act('member+lysne@fumecreatives.com');
select test.refuses($$ select public.undo_approvals(array[test.id('rd_a2')]) $$, 'forbidden', 'a member cannot undo an approval');

select test.act('marcus+lysne@fumecreatives.com');
select test.ok(jsonb_array_length(public.approve_versions(array[test.id('rd_a2'), test.id('rd_b1')])) = 2, 'the approver approves both');
select test.ok((select state from public.campaigns where id = test.id('rd')) = 'approved', 'the campaign is approved');
select test.ok(jsonb_array_length(public.undo_approvals(array[test.id('rd_a2'), test.id('rd_b1')])) = 2, 'Undo takes both approvals back');
select test.ok((select count(*) from public.approvals where version_id in (test.id('rd_a2'), test.id('rd_b1')) and revoked_at is null) = 0
  and (select state from public.campaigns where id = test.id('rd')) = 'in_review', 'no live approval is left; the campaign is in review');
select public.approve_versions(array[test.id('rd_a2')]);
select test.refuses($$ select public.undo_approvals(array[test.id('rd_a2'), test.id('rd_b1')]) $$, 'conflict', 'Undo of several is all or nothing');
select test.ok((select state from public.creative_versions where id = test.id('rd_a2')) = 'approved', 'so version 2 stays approved');
select public.approve_versions(array[test.id('rd_b1')]);

-- ─── The delivery ────────────────────────────────────────────────────────────

select test.act('member+lysne@fumecreatives.com');
select test.refuses($$ select public.make_delivery(test.id('rd'), 'Own channels') $$, 'forbidden', 'a member cannot make a delivery');

select test.act('marcus+lysne@fumecreatives.com');
select test.keep('rd_delivery', (public.make_delivery(test.id('rd'), 'For LYSNE''s own channels in Norway', null, null, 'deliver-rd') ->> 'id')::uuid);
select test.ok((select array_agg(version_id order by version_id) from public.delivery_items where delivery_id = test.id('rd_delivery'))
  = (select array_agg(x order by x) from unnest(array[test.id('rd_a2'), test.id('rd_b1')]) x), 'the delivery holds the approved versions');
select test.ok((select array_agg(sha256 order by sha256) from public.delivery_items where delivery_id = test.id('rd_delivery'))
  = array['sha-rd-a2', 'sha-rd-b1'], 'with the approved files'' checksums');
select test.ok((public.make_delivery(test.id('rd'), 'For LYSNE''s own channels in Norway', null, null, 'deliver-rd') ->> 'id')::uuid = test.id('rd_delivery'),
  'making it again with the same key is one delivery');
select test.refuses($$ select public.make_delivery(test.id('rd'), 'Again') $$, 'conflict', 'a second delivery never packs the same versions');
select test.refuses($$ select public.make_delivery(test.id('rd'), 'Again', array[test.id('rd_a2')]) $$, 'conflict', 'naming a delivered version is refused');
select test.ok((select count(*) from public.deliveries where campaign_id = test.id('rd')) = 1, 'one delivery for the campaign');

select test.act('viewer+lysne@fumecreatives.com');
select test.refuses($$ select public.mark_downloaded(test.id('rd_delivery')) $$, 'forbidden', 'a viewer takes no delivery');
select test.act('kristian@fumecreatives.com');
select test.ok((public.mark_downloaded(test.id('rd_delivery')) ->> 'state') = 'ready', 'Fume fetching it does not count as the customer''s download');
select test.act('member+lysne@fumecreatives.com');
select test.ok((public.mark_downloaded(test.id('rd_delivery')) ->> 'state') = 'downloaded', 'the customer''s download marks it downloaded');
select test.ok(app.can_read_object('0b000000-0000-4000-8000-000000000001/rd-a2.jpg')
  and not app.can_read_object('0b000000-0000-4000-8000-000000000001/rd-a3.jpg'), 'the customer reads the delivered file and nothing unregistered');
select test.refuses($$ select public.confirm_live(test.id('rd_delivery')) $$, 'forbidden', 'a member does not confirm it is live');
select test.act('marcus+lysne@fumecreatives.com');
select test.ok((public.confirm_live(test.id('rd_delivery')) ->> 'state') = 'confirmed_live', 'the approver confirms it is live');
select test.ok((select state from public.campaigns where id = test.id('rd')) = 'delivered', 'the campaign is delivered');

reset role;
select test.ok(true, 'all review and delivery tests passed');
