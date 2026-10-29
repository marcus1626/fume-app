-- The customer's review and the delivery, as the app's review and delivery screens need them (docs/mvp/code-map.md §3,
-- rows 10 and 13):
--   1. A review set's change requests go as ONE (request_change_round): one round at most, however many creatives are
--      in it, and Undo while Fume has not started (withdraw_change_round) gives the round back.
--   2. Undo of several approvals at once (undo_approvals), in one transaction.
--   3. Replies to a comment and resolving a comment (reply_comment, resolve_comment).
--   4. A delivery never packs a version that is in a delivery already (make_delivery).
--   5. Only the customer's download marks a delivery downloaded, and a viewer takes no delivery (mark_downloaded).

-- ─── Columns ─────────────────────────────────────────────────────────────────

-- The review set a change request was sent with: one set uses one round at most. Withdrawn: taken back by Undo before
-- Fume started on it (kept, never deleted: the record shows it was asked and taken back).
alter table public.change_requests add column round_id uuid;
alter table public.change_requests add column withdrawn_at timestamptz;
create index on public.change_requests (round_id);

-- A reply belongs to the comment it answers (one level: a reply to a reply answers the first comment).
alter table public.comments add column reply_to uuid references public.comments (id) on delete cascade;
create index on public.comments (reply_to);

-- ─── Change requests for a review set ────────────────────────────────────────

-- p_items: [{ "version_id", "cause": correction | revision | changed_brief, "problem", "must_change", "must_stay",
-- "pins" }]. The set uses one round when any item in it is a revision; corrections (Fume's own mistake) and a changed
-- brief use none. Answers { versions, uses_round, rounds_left, round_id }.
create or replace function public.request_change_round(p_campaign_id uuid, p_items jsonb, p_key text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('campaign_id', p_campaign_id, 'items', p_items);
  prior jsonb;
  c public.campaigns;
  item jsonb;
  v public.creative_versions;
  cause text;
  round uuid := gen_random_uuid();
  uses boolean;
  out jsonb := '[]';
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'request_change_round', req);
  if prior is not null then return prior; end if;

  select * into c from public.campaigns where id = p_campaign_id for update;
  if not found or not app.can_read(c.workspace_id) then
    perform app.fail('not_found', 'No such campaign.');
  end if;
  if not app.customer_is(c.workspace_id, array['owner', 'approver', 'member']) then
    perform app.fail('forbidden', 'Only the customer asks for changes on a creative.');
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    perform app.fail('invalid', 'Say what should change on at least one creative.');
  end if;

  uses := exists (select 1 from jsonb_array_elements(p_items) i where i ->> 'cause' = 'revision');
  if uses then
    if c.rounds_used >= c.rounds_included then
      perform app.fail('conflict', 'The change requests in your package are used for this campaign. Ask Fume what one more takes.');
    end if;
    update public.campaigns set rounds_used = rounds_used + 1 where id = c.id returning * into c;
  end if;

  for item in select * from jsonb_array_elements(p_items) loop
    v := app.decidable_version((item ->> 'version_id')::uuid, array['owner', 'approver', 'member']);
    if (select campaign_id from public.creatives where id = v.creative_id) <> c.id then
      perform app.fail('invalid', 'Every creative in one change request is from the same campaign.');
    end if;
    if v.state <> 'checked' or v.sent_at is null then
      perform app.fail('conflict', 'Only creatives that wait on you can be changed.');
    end if;
    cause := item ->> 'cause';
    if cause is null or cause not in ('correction', 'revision', 'changed_brief') then
      perform app.fail('invalid', 'Say whether this is a correction, a revision or a changed brief.');
    end if;
    if coalesce(trim(item ->> 'problem'), '') = '' then
      perform app.fail('invalid', 'Say what should change.');
    end if;
    update public.creative_versions set state = 'changes_requested' where id = v.id returning * into v;
    insert into public.change_requests (
      workspace_id, version_id, source, cause, problem, must_change, must_stay, pins, uses_round, by, round_id
    ) values (
      v.workspace_id, v.id, 'customer', cause, item ->> 'problem',
      coalesce(item -> 'must_change', '[]'), coalesce(item -> 'must_stay', '[]'), coalesce(item -> 'pins', '[]'),
      cause = 'revision', auth.uid(), round
    );
    perform app.record(v.workspace_id, 'version.changes_requested', 'creative_version', v.id,
      jsonb_build_object('cause', cause, 'problem', item ->> 'problem', 'round', round));
    out := out || to_jsonb(v);
  end loop;

  update public.campaigns set state = 'revision' where id = c.id;
  return app.idem_end(p_key, 'request_change_round', req, jsonb_build_object(
    'versions', out, 'uses_round', uses, 'rounds_left', c.rounds_included - c.rounds_used, 'round_id', round));
end $$;

-- Undo for a change request just sent: each version waits on the customer again, while Fume has not started on it
-- (no correction job since, no new version). A round comes back once nothing left in its set uses it.
create or replace function public.withdraw_change_round(
  p_campaign_id uuid, p_version_ids uuid[], p_key text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('campaign_id', p_campaign_id, 'version_ids', to_jsonb(p_version_ids));
  prior jsonb;
  c public.campaigns;
  vid uuid;
  v public.creative_versions;
  cr public.change_requests;
  rounds uuid[] := '{}';
  r uuid;
  out jsonb := '[]';
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'withdraw_change_round', req);
  if prior is not null then return prior; end if;

  select * into c from public.campaigns where id = p_campaign_id for update;
  if not found or not app.can_read(c.workspace_id) then
    perform app.fail('not_found', 'No such campaign.');
  end if;
  if coalesce(cardinality(p_version_ids), 0) = 0 then
    perform app.fail('invalid', 'Name the creatives to take back.');
  end if;

  foreach vid in array p_version_ids loop
    v := app.decidable_version(vid, array['owner', 'approver', 'member']);
    if (select campaign_id from public.creatives where id = v.creative_id) <> c.id then
      perform app.fail('not_found', 'No such creative version in this campaign.');
    end if;
    select * into cr from public.change_requests x
    where x.version_id = v.id and x.source = 'customer' and x.withdrawn_at is null
    order by x.created_at desc limit 1;
    if v.state <> 'changes_requested' or cr.id is null or cr.new_version_id is not null
       or exists (select 1 from public.production_jobs j
                  where j.creative_id = v.creative_id and j.kind = 'correction' and j.state <> 'cancelled'
                    and j.created_at >= cr.created_at) then
      perform app.fail('conflict', 'Fume has started on these changes already.');
    end if;
    update public.change_requests set withdrawn_at = now() where id = cr.id;
    update public.creative_versions set state = 'checked' where id = v.id returning * into v;
    if cr.uses_round and cr.round_id is not null then
      rounds := rounds || cr.round_id;
    end if;
    perform app.record(v.workspace_id, 'version.changes_withdrawn', 'creative_version', v.id,
      jsonb_build_object('round', cr.round_id));
    out := out || to_jsonb(v);
  end loop;

  foreach r in array (select coalesce(array_agg(distinct x), '{}') from unnest(rounds) x) loop
    if not exists (select 1 from public.change_requests x where x.round_id = r and x.uses_round and x.withdrawn_at is null) then
      update public.campaigns set rounds_used = greatest(rounds_used - 1, 0) where id = c.id;
    end if;
  end loop;

  -- Back in review once nothing the customer asked for is still open.
  if not exists (
    select 1 from public.change_requests x
    join public.creative_versions cv on cv.id = x.version_id
    join public.creatives cre on cre.id = cv.creative_id
    left join public.creative_versions nv on nv.id = x.new_version_id
    where cre.campaign_id = c.id and x.source = 'customer' and x.withdrawn_at is null
      and (nv.id is null or nv.state in ('making', 'in_check', 'correcting', 'held'))
  ) then
    update public.campaigns set state = 'in_review' where id = c.id and state = 'revision';
  end if;
  return app.idem_end(p_key, 'withdraw_change_round', req, out);
end $$;

-- ─── Undo of approvals ───────────────────────────────────────────────────────

-- The toast's Undo after approving several at once: all go back, or none does.
create or replace function public.undo_approvals(p_version_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  vid uuid;
  out jsonb := '[]';
begin
  perform app.require_user();
  if coalesce(cardinality(p_version_ids), 0) = 0 then
    perform app.fail('invalid', 'Name the versions to take back.');
  end if;
  foreach vid in array p_version_ids loop
    out := out || public.undo_approval(vid);
  end loop;
  return out;
end $$;

-- ─── Comments ────────────────────────────────────────────────────────────────

create or replace function public.reply_comment(p_comment_id uuid, p_text text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  parent public.comments;
  cm public.comments;
begin
  perform app.require_user();
  select * into parent from public.comments where id = p_comment_id;
  if not found or not app.can_read_version(parent.version_id) then
    perform app.fail('not_found', 'No such comment.');
  end if;
  if app.customer_is(parent.workspace_id, array['viewer']) then
    perform app.fail('forbidden', 'Viewers cannot comment.');
  end if;
  if coalesce(trim(p_text), '') = '' then
    perform app.fail('invalid', 'Write the reply.');
  end if;
  insert into public.comments (workspace_id, version_id, author, text, reply_to)
  values (parent.workspace_id, parent.version_id, auth.uid(), p_text, coalesce(parent.reply_to, parent.id))
  returning * into cm;
  perform app.record(cm.workspace_id, 'comment.replied', 'comment', cm.id, jsonb_build_object('reply_to', cm.reply_to));
  return to_jsonb(cm);
end $$;

-- Resolve a comment, or open it again (a resolved comment is no longer on the creative's change list).
create or replace function public.resolve_comment(p_comment_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  cm public.comments;
begin
  perform app.require_user();
  select * into cm from public.comments where id = p_comment_id for update;
  if not found or not app.can_read_version(cm.version_id) then
    perform app.fail('not_found', 'No such comment.');
  end if;
  if app.customer_is(cm.workspace_id, array['viewer']) then
    perform app.fail('forbidden', 'Viewers cannot resolve comments.');
  end if;
  if cm.reply_to is not null then
    perform app.fail('invalid', 'Resolve the comment, not its reply.');
  end if;
  update public.comments set resolved_at = case when resolved_at is null then now() end
  where id = cm.id returning * into cm;
  perform app.record(cm.workspace_id, case when cm.resolved_at is null then 'comment.reopened' else 'comment.resolved' end,
    'comment', cm.id);
  return to_jsonb(cm);
end $$;

-- ─── Delivery ────────────────────────────────────────────────────────────────

-- As before (20261026140200_commands.sql), and a version already in a delivery is never packed again: left out when
-- the whole campaign is delivered, refused when it is named.
create or replace function public.make_delivery(
  p_campaign_id uuid, p_rights_note text, p_version_ids uuid[] default null, p_name text default null,
  p_key text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('campaign_id', p_campaign_id, 'rights_note', p_rights_note,
                                  'version_ids', to_jsonb(p_version_ids), 'name', p_name);
  prior jsonb;
  c public.campaigns;
  d public.deliveries;
  v record;
  n int := 0;
  packed int := 0;
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'make_delivery', req);
  if prior is not null then return prior; end if;

  select * into c from public.campaigns where id = p_campaign_id;
  if not found or not app.can_read(c.workspace_id) then
    perform app.fail('not_found', 'No such campaign.');
  end if;
  if not (app.customer_is(c.workspace_id, array['owner', 'approver']) or app.is_staff(c.workspace_id, array['account_manager', 'designer'])) then
    perform app.fail('forbidden', 'Only the approver, an account manager or a designer makes a delivery.');
  end if;
  if coalesce(trim(p_rights_note), '') = '' then
    perform app.fail('invalid', 'A delivery needs its usage rights.');
  end if;

  insert into public.deliveries (workspace_id, campaign_id, name, rights_note, created_by)
  values (c.workspace_id, c.id, coalesce(nullif(trim(p_name), ''), c.name), p_rights_note, auth.uid()) returning * into d;

  for v in
    select cv.*, cr.name as creative_name, cr.format, a.id as approval_id, f.sha256 as file_sha, f.name as file_name
    from public.creatives cr
    join lateral (select * from public.creative_versions x where x.creative_id = cr.id order by number desc limit 1) cv on true
    left join public.approvals a on a.version_id = cv.id and a.revoked_at is null
    left join public.files f on f.id = cv.file_id
    where cr.campaign_id = c.id and (p_version_ids is null or cv.id = any (p_version_ids))
  loop
    if v.state not in ('approved', 'delivered') or v.approval_id is null then
      if p_version_ids is not null then
        perform app.fail('invalid', 'Only approved versions go into a delivery.');
      end if;
      continue;
    end if;
    if exists (select 1 from public.delivery_items di where di.version_id = v.id and di.delivery_id <> d.id) then
      if p_version_ids is not null then
        perform app.fail('conflict', 'A version named is in a delivery already.');
      end if;
      packed := packed + 1;
      continue;
    end if;
    if v.file_id is null then
      perform app.fail('invalid', 'An approved version has no file.');
    end if;
    if exists (select 1 from public.findings fi where fi.version_id = v.id and fi.severity = 'critical' and fi.status = 'open') then
      perform app.fail('invalid', 'A critical finding is open on an approved version.');
    end if;
    insert into public.delivery_items (delivery_id, workspace_id, creative_id, version_id, approval_id, file_id, sha256, filename)
    values (
      d.id, d.workspace_id, v.creative_id, v.id, v.approval_id, v.file_id, v.file_sha,
      v.creative_name || '_v' || v.number || coalesce('.' || nullif(split_part(v.file_name, '.', -1), v.file_name), '')
    );
    update public.creative_versions set state = 'delivered' where id = v.id;
    n := n + 1;
  end loop;
  if n = 0 and packed > 0 then
    perform app.fail('conflict', 'Every approved creative in this campaign is in a delivery already.');
  end if;
  if n = 0 then
    perform app.fail('invalid', 'Nothing approved to deliver yet.');
  end if;
  if (p_version_ids is not null and n <> cardinality(p_version_ids)) then
    perform app.fail('invalid', 'Some of the versions named are not the current, approved ones.');
  end if;
  if not exists (
    select 1 from public.creatives cr where cr.campaign_id = c.id and (app.latest_version(cr.id)).state <> 'delivered'
  ) then
    update public.campaigns set state = 'delivered', stage = 'delivery' where id = c.id;
  end if;
  perform app.record(c.workspace_id, 'delivery.made', 'delivery', d.id, jsonb_build_object('items', n));
  return app.idem_end(p_key, 'make_delivery', req, to_jsonb(d) || jsonb_build_object('items', n));
end $$;

-- The customer took the delivery. Fume's people may fetch it too, but only the customer's download counts; a viewer
-- takes no delivery (the app's canTake).
create or replace function public.mark_downloaded(p_delivery_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  d public.deliveries;
begin
  perform app.require_user();
  select * into d from public.deliveries where id = p_delivery_id;
  if not found or not app.can_read(d.workspace_id) then
    perform app.fail('not_found', 'No such delivery.');
  end if;
  if app.customer_is(d.workspace_id, array['viewer']) then
    perform app.fail('forbidden', 'Viewers cannot download a delivery.');
  end if;
  if d.state = 'ready' and app.customer_is(d.workspace_id, array['owner', 'approver', 'member']) then
    update public.deliveries set state = 'downloaded', downloaded_at = now() where id = d.id returning * into d;
    perform app.record(d.workspace_id, 'delivery.downloaded', 'delivery', d.id);
  end if;
  return to_jsonb(d);
end $$;

-- ─── Grants ──────────────────────────────────────────────────────────────────

revoke execute on function public.request_change_round(uuid, jsonb, text) from public, anon;
revoke execute on function public.withdraw_change_round(uuid, uuid[], text) from public, anon;
revoke execute on function public.undo_approvals(uuid[]) from public, anon;
revoke execute on function public.reply_comment(uuid, text) from public, anon;
revoke execute on function public.resolve_comment(uuid) from public, anon;
grant execute on function public.request_change_round(uuid, jsonb, text) to authenticated;
grant execute on function public.withdraw_change_round(uuid, uuid[], text) to authenticated;
grant execute on function public.undo_approvals(uuid[]) to authenticated;
grant execute on function public.reply_comment(uuid, text) to authenticated;
grant execute on function public.resolve_comment(uuid) to authenticated;
