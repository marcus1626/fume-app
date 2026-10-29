-- Manual production in the Studio, the expert's check and its Undo, and formats from the approved master
-- (20261027110000_manual_production.sql). Runs after 10_rules.sql in the same session, on a campaign of its own.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
set role authenticated;

-- ─── A campaign with an approved plan: a master and two formats ─────────────

select test.act('marcus+lysne@fumecreatives.com');
select test.keep('c2', (public.create_campaign(test.id('lysne'), 'Evening, by hand', array[test.id('oil')]) ->> 'id')::uuid);

select test.act('marcus@fumecreatives.com');
select test.refuses($$ select public.open_creative(test.id('c2')) $$, 'invalid', 'nothing opens in the Studio before the plan is approved');

select test.act('marcus+lysne@fumecreatives.com');
select public.send_brief(test.id('c2'), '{"objective":"Evening ritual","audience":"Women 30-50","message":"For the hour before sleep","formats":"feed, square, story","count":"3"}');
select public.approve_plan(test.id('c2'), 1);

-- ─── Opening the planned creative ───────────────────────────────────────────

select test.act('william@fumecreatives.com');
select test.refuses($$ select public.open_creative(test.id('c2')) $$, 'forbidden', 'the account manager does not open creatives in the Studio');
select test.act('user+solv@fumecreatives.com');
select test.refuses($$ select public.open_creative(test.id('c2')) $$, 'not_found', 'another brand cannot open LYSNE''s creatives');

select test.act('marcus@fumecreatives.com');
select test.keep('m', (public.open_creative(test.id('c2'), null, null, null, null, null, 'open-1') ->> 'id')::uuid);
select test.ok((select slot = 'pc1' and kind = 'master' and format = 'feed' and title = 'Master 1' from public.creatives where id = test.id('m')),
  'the Studio opens the plan''s master first, as the creative for slot pc1');
select test.ok((public.open_creative(test.id('c2'), null, null, null, null, null, 'open-1') ->> 'id')::uuid = test.id('m'), 'the same key opens the same creative');
select test.ok((public.open_creative(test.id('c2')) ->> 'id')::uuid = test.id('m'), 'opening again, the formats wait for the master: the master opens again');
select test.ok((public.open_creative(test.id('c2'), 'pc1') ->> 'id')::uuid = test.id('m'), 'the slot by name opens the same creative');
select test.refuses($$ select public.open_creative(test.id('c2'), 'pc2') $$, 'invalid', 'a planned format waits for the approved master');
select test.refuses($$ select public.open_creative(test.id('c2'), 'pc9') $$, 'invalid', 'a slot the plan does not have is refused');

select test.act('marcus+lysne@fumecreatives.com');
select test.ok((select count(*) from public.creative_versions v join public.creatives c on c.id = v.creative_id where c.campaign_id = test.id('c2')) = 0,
  'an opened creative has no version for the customer to see');

-- ─── The picture made by hand ───────────────────────────────────────────────

reset role;
insert into storage.objects (bucket_id, name, owner_id)
select 'workspace-files', '0b000000-0000-4000-8000-000000000001/' || n, (select id::text from public.profiles where email = e)
from (values ('hand-m1.jpg', 'marcus@fumecreatives.com'), ('hand-m2.jpg', 'marcus@fumecreatives.com'),
             ('hand-m3.jpg', 'marcus@fumecreatives.com'), ('hand-sq.jpg', 'kristian@fumecreatives.com'),
             ('hand-va.jpg', 'marcus@fumecreatives.com')) f (n, e);
set role authenticated;

select test.act('marcus@fumecreatives.com');
select test.keep('hf1', (public.register_file(test.id('lysne'), '0b000000-0000-4000-8000-000000000001/hand-m1.jpg', 'hand-m1.jpg', 'image/jpeg', 900000, 'sha-h1', 1080, 1350, 'candidate') ->> 'id')::uuid);
select test.refuses($$ select public.add_manual_version(test.id('m'), test.id('hf1'), ' ') $$, 'invalid', 'a picture made by hand says how it was made');

select test.act('william@fumecreatives.com');
select test.refuses($$ select public.add_manual_version(test.id('m'), test.id('hf1'), 'x') $$, 'forbidden', 'the account manager adds no candidate');

select test.act('marcus@fumecreatives.com');
select test.keep('hc1', (public.add_manual_version(test.id('m'), test.id('hf1'), 'Shot on the stone set, retouched in Photoshop', 'hand-1') ->> 'id')::uuid);
select test.ok((public.add_manual_version(test.id('m'), test.id('hf1'), 'Shot on the stone set, retouched in Photoshop', 'hand-1') ->> 'id')::uuid = test.id('hc1'),
  'the same key adds one candidate');
select test.ok((select j.creative_id = test.id('m') and j.kind = 'master' and j.mode = 'manual' and j.state = 'succeeded'
  from public.candidates c join public.production_jobs j on j.id = c.job_id where c.id = test.id('hc1')),
  'the candidate sits on the creative''s own manual master job, done');
select test.ok((select s.plan_version_id = (select id from public.plan_versions where campaign_id = test.id('c2') and state = 'approved')
  from public.candidates c join public.production_jobs j on j.id = c.job_id join public.context_snapshots s on s.id = j.snapshot_id
  where c.id = test.id('hc1')), 'the job froze the approved plan in its snapshot');
select test.ok((select origin = 'manual' and note like 'Shot on the stone set%' and made_by = auth.uid() from public.candidates where id = test.id('hc1')),
  'the candidate keeps how and by whom it was made');

select test.keep('mv1', (public.send_to_check(test.id('hc1')) ->> 'id')::uuid);
select test.ok((select creative_id = test.id('m') and number = 1 and state = 'in_check' from public.creative_versions where id = test.id('mv1')),
  'sent to check, it is version 1 of the opened creative');
select test.ok((select count(*) from public.creatives where campaign_id = test.id('c2')) = 1, 'no second creative is made');
select test.refuses($$ select public.add_manual_version(test.id('m'), test.id('hf1'), 'again') $$, 'conflict', 'no new picture while version 1 waits for its check');

-- ─── The check and its Undo ─────────────────────────────────────────────────

select test.act('marcus@fumecreatives.com');
select test.refuses($$ select public.mark_checked(test.id('mv1')) $$, 'forbidden', 'the maker cannot check it');
select test.act('kristian@fumecreatives.com');
select public.mark_checked(test.id('mv1'), '[{"kind":"fact","label":"Cap","result":"pass"}]');
select test.act('marcus@fumecreatives.com');
select test.refuses($$ select public.uncheck_version(test.id('mv1')) $$, 'forbidden', 'only a designer who may check undoes a check');
select test.act('kristian@fumecreatives.com');
select public.uncheck_version(test.id('mv1'));
select test.ok((select v.state = 'in_check' and c.state = 'waiting' and c.expert_id is null and c.items = '[]'
  from public.creative_versions v join public.expert_checks c on c.version_id = v.id where v.id = test.id('mv1')),
  'the Undo puts the version back in check, its check waiting');
select test.refuses($$ select public.uncheck_version(test.id('mv1')) $$, 'conflict', 'an unchecked version cannot be unchecked');
select public.mark_checked(test.id('mv1'));

select test.act('marcus+lysne@fumecreatives.com');
select test.ok((select count(*) from public.creative_versions where id = test.id('mv1')) = 0, 'checked but not sent: the customer sees nothing');
select test.act('william@fumecreatives.com');
select public.send_checked(test.id('c2'), 'send-c2-1');
select test.act('kristian@fumecreatives.com');
select test.refuses($$ select public.uncheck_version(test.id('mv1')) $$, 'conflict', 'once sent, the check stays');

-- ─── The customer's changes, then the expert's correction ───────────────────

select test.act('marcus+lysne@fumecreatives.com');
select test.ok((select count(*) from public.creative_versions where id = test.id('mv1')) = 1, 'checked and sent: the customer sees it');
select public.request_changes(test.id('mv1'), 'revision', 'Warmer light on the bottle');

reset role;
select test.ok((select rounds_used from public.campaigns where id = test.id('c2')) = 1, 'the customer''s revision used a round');
set role authenticated;

select test.act('marcus@fumecreatives.com');
select test.keep('hf2', (public.register_file(test.id('lysne'), '0b000000-0000-4000-8000-000000000001/hand-m2.jpg', 'hand-m2.jpg', 'image/jpeg', 910000, 'sha-h2', 1080, 1350, 'candidate') ->> 'id')::uuid);
select test.keep('hc2', (public.add_manual_version(test.id('m'), test.id('hf2'), 'Regraded warmer in Lightroom') ->> 'id')::uuid);
select test.ok((select j.kind = 'correction' and j.creative_id = test.id('m') from public.candidates c join public.production_jobs j on j.id = c.job_id
  where c.id = test.id('hc2')), 'after the customer''s changes the picture goes on a correction job');
select test.keep('mv2', (public.send_to_check(test.id('hc2')) ->> 'id')::uuid);
select test.ok((select number from public.creative_versions where id = test.id('mv2')) = 2, 'it is version 2');

select test.act('kristian@fumecreatives.com');
select public.request_correction(test.id('mv2'), 'The label edge is soft', '["the label edge"]', '["light","scene"]',
  '[{"n":1,"x":0.52,"y":0.61,"text":"Label edge"}]');
select test.ok((select v.state = 'correcting' and cr.source = 'expert' and not cr.uses_round and cr.pins -> 0 ->> 'text' = 'Label edge'
  from public.creative_versions v join public.change_requests cr on cr.version_id = v.id where v.id = test.id('mv2')),
  'the expert''s correction keeps its pins and uses no round');

select test.act('marcus@fumecreatives.com');
select test.keep('hf3', (public.register_file(test.id('lysne'), '0b000000-0000-4000-8000-000000000001/hand-m3.jpg', 'hand-m3.jpg', 'image/jpeg', 905000, 'sha-h3', 1080, 1350, 'candidate') ->> 'id')::uuid);
select test.keep('hc3', (public.add_manual_version(test.id('m'), test.id('hf3'), 'Sharpened the label edge by hand') ->> 'id')::uuid);
select test.keep('mv3', (public.send_to_check(test.id('hc3')) ->> 'id')::uuid);
select test.ok((select number = 3 and state = 'in_check' from public.creative_versions where id = test.id('mv3')), 'the corrected picture is version 3, in check');
select test.ok((select new_version_id from public.change_requests where version_id = test.id('mv2')) = test.id('mv3'), 'the correction points at version 3');

select test.refuses($$ select public.open_creative(test.id('c2'), null, 'format', 'square', test.id('mv1')) $$, 'invalid', 'formats from an old, unapproved master version are refused');

select test.act('kristian@fumecreatives.com');
select public.mark_checked(test.id('mv3'));
select test.act('marcus@fumecreatives.com');
select public.send_checked(test.id('c2'));
select test.refuses($$ select public.open_creative(test.id('c2'), null, 'format', 'square', test.id('mv3')) $$, 'invalid', 'formats wait for the customer''s approval of the master');
select test.act('marcus+lysne@fumecreatives.com');
select public.approve_versions(array[test.id('mv3')]);

-- ─── Formats and a variant from the approved master ─────────────────────────

select test.act('marcus@fumecreatives.com');
select test.keep('sq', (public.open_creative(test.id('c2'), null, 'format', 'square', test.id('mv3')) ->> 'id')::uuid);
select test.ok((select slot = 'pc2' and kind = 'format' and format = 'square' and master_id = test.id('m') from public.creatives where id = test.id('sq')),
  'the square format is the plan''s pc2, made from the master');
select test.ok((select stage = 'variants' from public.campaigns where id = test.id('c2')), 'with a format made, the campaign is at Creatives');
select test.ok((public.open_creative(test.id('c2'), null, 'format', 'square', test.id('mv3')) ->> 'id')::uuid = test.id('sq'), 'asking for the square again opens the same creative');
select test.keep('st', (public.open_creative(test.id('c2')) ->> 'id')::uuid);
select test.ok((select slot = 'pc3' and kind = 'format' and format = 'story' from public.creatives where id = test.id('st')),
  'the next planned creative is the story format, now that the master is approved');
select test.keep('va', (public.open_creative(test.id('c2'), null, 'variant', null, test.id('mv3')) ->> 'id')::uuid);
select test.ok((select kind = 'variant' and format = 'feed' and master_id = test.id('m') and slot is null and title = 'Variant 1 from Master 1'
  from public.creatives where id = test.id('va')), 'a variant of the approved master opens in the master''s format');

select test.act('kristian@fumecreatives.com');
select test.keep('hfs', (public.register_file(test.id('lysne'), '0b000000-0000-4000-8000-000000000001/hand-sq.jpg', 'hand-sq.jpg', 'image/jpeg', 700000, 'sha-sq', 1080, 1080, 'candidate') ->> 'id')::uuid);
select test.keep('hcs', (public.add_manual_version(test.id('sq'), test.id('hfs'), 'Cropped the approved master to 1:1') ->> 'id')::uuid);
select test.ok((select j.kind = 'format' and j.master_version_id = test.id('mv3') from public.candidates c join public.production_jobs j on j.id = c.job_id
  where c.id = test.id('hcs')), 'the format''s job names the approved master version');
select test.keep('sv1', (public.send_to_check(test.id('hcs')) ->> 'id')::uuid);
select test.ok((select creative_id = test.id('sq') and master_version_id = test.id('mv3') from public.creative_versions where id = test.id('sv1')),
  'the format''s version 1 derives from master version 3');
select test.refuses($$ select public.mark_checked(test.id('sv1')) $$, 'forbidden', 'Kristian made the square, so he cannot check it');

reset role;
select test.ok((select count(*) from public.record_events where action = 'creative.opened') = 4, 'every opened creative is in the record');
select test.ok((select count(*) from public.record_events where action = 'version.check_undone') = 1, 'the Undo of a check is in the record');
select test.ok(true, 'all production tests passed');
