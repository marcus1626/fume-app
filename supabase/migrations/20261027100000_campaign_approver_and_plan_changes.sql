-- Who approves a campaign, and a plan changed in place (docs/mvp/domain-model.md §3: changePlan / choosePlanDirection
-- by the approver or a designer, as a new plan version; a version is never overwritten).
--
-- 1. create_campaign: a campaign started by a member (or by Fume's people) gets the brand's approver, so it always
--    names who approves it. Before, only an owner or approver starting it was named.
-- 2. set_campaign_approver: the approver of a campaign is one of the brand's owners or approvers.
-- 3. change_plan: the next plan version from the current one, changed line by line, with what changed.

-- ─── The campaign's approver ─────────────────────────────────────────────────

-- The brand's approver for a new campaign: the caller when they may approve, else its first approver, else its owner.
create or replace function app.default_approver(p_ws uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce(
    case when app.customer_is(p_ws, array['owner', 'approver']) then auth.uid() end,
    (select m.user_id from public.memberships m where m.workspace_id = p_ws and m.role = 'approver'
     order by m.created_at, m.user_id limit 1),
    (select m.user_id from public.memberships m where m.workspace_id = p_ws and m.role = 'owner'
     order by m.created_at, m.user_id limit 1)
  )
$$;
revoke execute on function app.default_approver(uuid) from public, anon;
grant execute on function app.default_approver(uuid) to authenticated;

create or replace function public.create_campaign(
  p_workspace_id uuid, p_name text, p_product_ids uuid[], p_key text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('workspace_id', p_workspace_id, 'name', p_name, 'product_ids', to_jsonb(p_product_ids));
  prior jsonb;
  c public.campaigns;
  pid uuid;
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'create_campaign', req);
  if prior is not null then return prior; end if;

  if not app.can_read(p_workspace_id) then
    perform app.fail('not_found', 'No such workspace.');
  end if;
  if not (app.customer_is(p_workspace_id, array['owner', 'approver', 'member']) or app.is_staff(p_workspace_id, array['account_manager', 'designer'])) then
    perform app.fail('forbidden', 'Viewers cannot start a campaign.');
  end if;
  if coalesce(trim(p_name), '') = '' or coalesce(cardinality(p_product_ids), 0) = 0 then
    perform app.fail('invalid', 'A campaign needs a name and at least one product.');
  end if;

  insert into public.campaigns (workspace_id, name, approver_id, created_by)
  values (p_workspace_id, p_name, app.default_approver(p_workspace_id), auth.uid())
  returning * into c;
  foreach pid in array p_product_ids loop
    if not exists (select 1 from public.products p where p.id = pid and p.workspace_id = p_workspace_id) then
      perform app.fail('invalid', 'A product is not in this workspace.');
    end if;
    insert into public.campaign_products (campaign_id, product_id, workspace_id) values (c.id, pid, p_workspace_id);
  end loop;
  perform app.record(c.workspace_id, 'campaign.created', 'campaign', c.id, jsonb_build_object('name', c.name));
  return app.idem_end(p_key, 'create_campaign', req, to_jsonb(c));
end $$;

-- The brand's owner or approver, or Fume's account manager, names who approves the campaign: one of the brand's
-- owners or approvers.
create or replace function public.set_campaign_approver(p_campaign_id uuid, p_user_id uuid, p_key text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('campaign_id', p_campaign_id, 'user_id', p_user_id);
  prior jsonb;
  c public.campaigns;
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'set_campaign_approver', req);
  if prior is not null then return prior; end if;

  select * into c from public.campaigns where id = p_campaign_id for update;
  if not found or not app.can_read(c.workspace_id) then
    perform app.fail('not_found', 'No such campaign.');
  end if;
  if not (app.customer_is(c.workspace_id, array['owner', 'approver']) or app.is_staff(c.workspace_id, array['account_manager'])) then
    perform app.fail('forbidden', 'Only the brand''s owner or approver, or Fume''s account manager, names the approver.');
  end if;
  if not exists (
    select 1 from public.memberships m
    where m.workspace_id = c.workspace_id and m.user_id = p_user_id and m.role in ('owner', 'approver')
  ) then
    perform app.fail('invalid', 'The approver must be one of the brand''s owners or approvers.');
  end if;

  update public.campaigns set approver_id = p_user_id where id = c.id returning * into c;
  perform app.record(c.workspace_id, 'campaign.approver_set', 'campaign', c.id, jsonb_build_object('approver', p_user_id));
  return app.idem_end(p_key, 'set_campaign_approver', req, to_jsonb(c));
end $$;

-- ─── The plan, changed in place ──────────────────────────────────────────────

-- The next version of the current plan, with its changed lines and what changed in words. The approver changes a
-- plan that is ready for her; a designer changes it until it is approved (also after the customer asked for
-- changes: that is how the next version reaches her). A plan in check stays in check. The new version has no check
-- and no approval of its own.
create or replace function public.change_plan(
  p_campaign_id uuid, p_version int, p_body jsonb, p_changes text[], p_key text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('campaign_id', p_campaign_id, 'version', p_version, 'body', p_body,
    'changes', to_jsonb(p_changes));
  prior jsonb;
  p public.plan_versions;
  n public.plan_versions;
  designer boolean;
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'change_plan', req);
  if prior is not null then return prior; end if;

  p := app.current_plan(p_campaign_id, p_version);
  designer := app.is_staff(p.workspace_id, array['designer']);
  if not designer and not app.customer_is(p.workspace_id, array['owner', 'approver']) then
    perform app.fail('forbidden', 'Only the approver or a designer changes the plan.');
  end if;
  if p.state = 'approved' then
    perform app.fail('conflict', 'The plan is approved. Ask for a change on a creative instead.');
  end if;
  if not designer and p.state <> 'ready' then
    perform app.fail('conflict', 'The plan can be changed once it is ready for you.');
  end if;
  if jsonb_typeof(p_body) is distinct from 'object' or jsonb_typeof(p_body -> 'directions') is distinct from 'array'
     or coalesce(p_body ->> 'chosen_direction_id', '') = '' or jsonb_typeof(p_body -> 'planned_creatives') is distinct from 'array' then
    perform app.fail('invalid', 'A plan needs its directions, the chosen direction and the planned creatives.');
  end if;
  if not exists (select 1 from jsonb_array_elements(p_body -> 'directions') d where d ->> 'id' = p_body ->> 'chosen_direction_id') then
    perform app.fail('invalid', 'The chosen direction is not one of the plan''s directions.');
  end if;
  if coalesce(cardinality(array_remove(p_changes, '')), 0) = 0 then
    perform app.fail('invalid', 'Say what changed in the plan.');
  end if;

  update public.plan_versions set state = 'superseded' where id = p.id;
  insert into public.plan_versions (
    workspace_id, campaign_id, version, brief_version_id, brand_dna_version_id, body, state, check_asked_by,
    written_by, changes
  ) values (
    p.workspace_id, p.campaign_id, p.version + 1, p.brief_version_id, p.brand_dna_version_id, p_body,
    case when p.state = 'in_check' then 'in_check' else 'ready' end,
    case when p.state = 'in_check' then p.check_asked_by end,
    auth.uid()::text, array_remove(p_changes, '')
  ) returning * into n;
  perform app.record(n.workspace_id, 'plan.changed', 'plan_version', n.id,
    jsonb_build_object('version', n.version, 'from', p.version, 'changes', to_jsonb(n.changes)));
  return app.idem_end(p_key, 'change_plan', req, to_jsonb(n));
end $$;

revoke execute on function public.set_campaign_approver(uuid, uuid, text) from public, anon;
grant execute on function public.set_campaign_approver(uuid, uuid, text) to authenticated;
revoke execute on function public.change_plan(uuid, int, jsonb, text[], text) from public, anon;
grant execute on function public.change_plan(uuid, int, jsonb, text[], text) to authenticated;
