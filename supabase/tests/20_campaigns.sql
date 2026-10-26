-- Campaigns, the brief and the plan as the live app drives them (app/src/api/live/campaigns.ts): a brief ordered on
-- the form and sent, the campaign's approver, and the plan changed in place as new versions. Runs after 10_rules.sql
-- in the same session (its campaign is delivered; the required facts are verified), on a campaign of its own.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
set role authenticated;

-- ─── A member orders a brief: the campaign names the brand's approver ────────

select test.act('member+lysne@fumecreatives.com');
select test.keep('c2', (public.create_campaign(test.id('lysne'), 'Winter evenings', array[test.id('oil')], 'order-c2') ->> 'id')::uuid);
select test.ok((select approver_id from public.campaigns where id = test.id('c2'))
  = (select id from public.profiles where email = 'marcus+lysne@fumecreatives.com'), 'a campaign a member starts names the brand''s approver');
select public.save_brief_draft(test.id('c2'),
  '{"objective":"Make winter evenings the reason to buy","audience":"Women 30-50","message":"For the long evenings","mandatory":["The label front and centred"],"never":["Faces"],"channels":["paid_social"],"formats":["feed","story"],"creatives":4,"references":[],"market":"Norway","language":"en","due_at":"2026-12-01T15:00:00Z","notes":"Keep it quiet"}');
select test.ok((select due_at from public.campaigns where id = test.id('c2')) = '2026-12-01T15:00:00Z', 'the order''s deadline is the campaign''s go-live');

-- ─── The approver ────────────────────────────────────────────────────────────

select test.refuses($$ select public.set_campaign_approver(test.id('c2'), (select id from public.profiles where email = 'member+lysne@fumecreatives.com')) $$,
  'forbidden', 'a member cannot name the approver');
select test.act('william@fumecreatives.com');
select test.refuses($$ select public.set_campaign_approver(test.id('c2'), (select id from public.profiles where email = 'member+lysne@fumecreatives.com')) $$,
  'invalid', 'the approver must be an owner or approver of the brand');
select test.refuses($$ select public.set_campaign_approver(test.id('c2'), (select id from public.profiles where email = 'user+solv@fumecreatives.com')) $$,
  'invalid', 'an approver of another brand cannot approve this campaign');
select public.set_campaign_approver(test.id('c2'), (select id from public.profiles where email = 'marcus+lysne@fumecreatives.com'));
select test.ok(true, 'the account manager names the brand''s approver');
select test.act('user+solv@fumecreatives.com');
select test.refuses($$ select public.set_campaign_approver(test.id('c2'), (select id from public.profiles where email = 'user+solv@fumecreatives.com')) $$,
  'not_found', 'another brand cannot reach the campaign');

-- ─── Sending the draft brief writes plan 1 ──────────────────────────────────

select test.act('marcus+lysne@fumecreatives.com');
select public.send_brief(test.id('c2'), null, 'send-c2');
select test.ok((select count(*) from public.brief_versions where campaign_id = test.id('c2')) = 1
  and (select body ->> 'notes' from public.brief_versions where campaign_id = test.id('c2')) = 'Keep it quiet', 'the draft is sent as brief 1, notes and all');
select test.ok((select state from public.plan_versions where campaign_id = test.id('c2') and version = 1) = 'ready'
  and (select jsonb_array_length(body -> 'planned_creatives') from public.plan_versions where campaign_id = test.id('c2') and version = 1) = 2,
  'Fume''s plan 1 is ready: a master and the story from it');

-- ─── The plan changed in place ───────────────────────────────────────────────

select test.act('member+lysne@fumecreatives.com');
select test.refuses($$ select public.change_plan(test.id('c2'), 1, (select body from public.plan_versions where campaign_id = test.id('c2') and version = 1), array['x']) $$,
  'forbidden', 'a member cannot change the plan');

select test.act('marcus+lysne@fumecreatives.com');
select test.refuses($$ select public.change_plan(test.id('c2'), 1, '{"directions":[]}', array['x']) $$,
  'invalid', 'a changed plan still needs its directions and creatives');
select test.refuses($$ select public.change_plan(test.id('c2'), 1, (select body from public.plan_versions where campaign_id = test.id('c2') and version = 1), '{}') $$,
  'invalid', 'a change says what changed');
select public.change_plan(test.id('c2'), 1,
  (select jsonb_set(body, '{summary}', '"Winter, slowed down."') from public.plan_versions where campaign_id = test.id('c2') and version = 1),
  array['The summary'], 'change-c2-1');
select test.ok((select state from public.plan_versions where campaign_id = test.id('c2') and version = 1) = 'superseded'
  and (select state from public.plan_versions where campaign_id = test.id('c2') and version = 2) = 'ready'
  and (select changes from public.plan_versions where campaign_id = test.id('c2') and version = 2) = array['The summary'],
  'the approver''s change is plan 2, ready, saying what changed');
select test.refuses($$ select public.change_plan(test.id('c2'), 1, (select body from public.plan_versions where campaign_id = test.id('c2') and version = 2), array['x']) $$,
  'conflict', 'a change to a stale version is refused');

-- She asks for the expert's check; a designer's change keeps it in check, and its writer cannot check it.
select public.ask_plan_check(test.id('c2'), 2);
select test.refuses($$ select public.change_plan(test.id('c2'), 2, (select body from public.plan_versions where campaign_id = test.id('c2') and version = 2), array['x']) $$,
  'conflict', 'the approver cannot change a plan in check');
select test.act('marcus@fumecreatives.com');
select public.change_plan(test.id('c2'), 2,
  (select jsonb_set(body, '{chosen_reason}', '"Quieter"') from public.plan_versions where campaign_id = test.id('c2') and version = 2),
  array['Master 1''s scene: the bottle by the window']);
select test.ok((select state from public.plan_versions where campaign_id = test.id('c2') and version = 3) = 'in_check'
  and (select check_asked_by from public.plan_versions where campaign_id = test.id('c2') and version = 3)
    = (select id from public.profiles where email = 'marcus+lysne@fumecreatives.com'),
  'a designer''s change to a plan in check stays in check, asked by the approver');
select test.refuses($$ select public.check_plan(test.id('c2'), 3) $$, 'forbidden', 'the designer who changed the plan cannot check it');
select test.act('william@fumecreatives.com');
select test.refuses($$ select public.change_plan(test.id('c2'), 3, (select body from public.plan_versions where campaign_id = test.id('c2') and version = 3), array['x']) $$,
  'forbidden', 'the account manager does not change the plan');
select test.act('kristian@fumecreatives.com');
select public.check_plan(test.id('c2'), 3);

-- She asks for changes; the designer's next version is hers again.
select test.act('marcus+lysne@fumecreatives.com');
select public.ask_plan_changes(test.id('c2'), 3, 'Warmer light');
select test.act('marcus@fumecreatives.com');
select public.change_plan(test.id('c2'), 3,
  (select body from public.plan_versions where campaign_id = test.id('c2') and version = 3), array['The light: warmer']);
select test.ok((select state from public.plan_versions where campaign_id = test.id('c2') and version = 4) = 'ready'
  and (select checked_by from public.plan_versions where campaign_id = test.id('c2') and version = 4) is null,
  'the version answering her ask is ready, with no check of its own');

select test.act('marcus+lysne@fumecreatives.com');
select public.approve_plan(test.id('c2'), 4, 'approve-c2');
select test.refuses($$ select public.change_plan(test.id('c2'), 4, (select body from public.plan_versions where campaign_id = test.id('c2') and version = 4), array['x']) $$,
  'conflict', 'an approved plan is not changed');
select test.ok((select count(*) from public.record_events where action = 'plan.changed') = 3, 'every change is in the record');

reset role;
select test.ok(true, 'all campaign tests passed');
