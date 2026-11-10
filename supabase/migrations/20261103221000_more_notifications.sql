-- More of the bell: Fume's (or the agency's) people hear when a brief is sent, when a creative or a plan waits for
-- their check, and when an expert asks for a correction or holds a creative. (An agency's send of a plan is its check,
-- so the brand already hears "The plan is ready".) The rest is as before (20261103100000_notifications.sql).

create or replace function app.on_record_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ws uuid := new.workspace_id;
  who text;
  camp uuid;
  cname text;
  staff_href text;
  n int;
  r record;
begin
  -- The campaign the event is about, whatever its subject.
  camp := case new.subject_type
    when 'campaign' then new.subject_id
    when 'plan_version' then (select p.campaign_id from public.plan_versions p where p.id = new.subject_id)
    when 'creative_version' then (
      select c.campaign_id from public.creative_versions v join public.creatives c on c.id = v.creative_id
      where v.id = new.subject_id)
    when 'delivery' then (select d.campaign_id from public.deliveries d where d.id = new.subject_id)
    when 'brief_version' then (select b.campaign_id from public.brief_versions b where b.id = new.subject_id)
  end;
  if camp is null then return new; end if;
  select c.name into cname from public.campaigns c where c.id = camp;
  select coalesce(nullif(split_part(p.name, ' ', 1), ''), 'Someone') into who from public.profiles p where p.id = new.actor;
  who := coalesce(who, 'Fume');
  staff_href := '/studio/b/' || ws || '/campaigns/' || camp || '/plan';

  case new.action
  -- ─── To the brand's people ───────────────────────────────────────────────
  when 'versions.sent' then
    n := greatest(coalesce((new.detail ->> 'count')::int, 1), 1);
    for r in select m.user_id from public.memberships m where m.workspace_id = ws loop
      perform app.notify(r.user_id, ws, 'checked', new.actor, 'sent:' || camp,
        '1 checked creative in ' || cname || ' is ready for you',
        '{n} checked creatives in ' || cname || ' are ready for you',
        '/campaigns/' || camp || '/review', new.id, n);
    end loop;
  when 'plan.written', 'plan.changed', 'plan.checked' then
    if (select p.state from public.plan_versions p where p.id = new.subject_id) = 'ready' then
      for r in select m.user_id from public.memberships m where m.workspace_id = ws and m.role in ('owner', 'approver') loop
        perform app.notify(r.user_id, ws, 'waiting_on_you', new.actor, 'plan:' || camp,
          'The plan for ' || cname || ' is ready', 'The plan for ' || cname || ' is ready',
          '/campaigns/' || camp || '/plan', new.id);
      end loop;
    end if;
  when 'delivery.made' then
    for r in select m.user_id from public.memberships m where m.workspace_id = ws loop
      perform app.notify(r.user_id, ws, 'delivered', new.actor, 'delivery:' || new.subject_id,
        cname || ' is ready to download', cname || ' is ready to download',
        '/deliveries/' || new.subject_id, new.id);
    end loop;


  -- ─── To Fume's people on the brand ───────────────────────────────────────
  when 'brief.sent' then
    for r in select distinct s.user_id from public.staff_assignments s where s.workspace_id = ws loop
      perform app.notify(r.user_id, ws, 'waiting_on_you', new.actor, 'brief:' || camp,
        who || ' sent the brief for ' || cname, who || ' sent the brief for ' || cname,
        staff_href, new.id);
    end loop;
  when 'plan.check_asked' then
    for r in select distinct s.user_id from public.staff_assignments s
             where s.workspace_id = ws and s.staff_role = 'designer' and s.can_check loop
      perform app.notify(r.user_id, ws, 'waiting_on_you', new.actor, 'plan-check:' || camp,
        'The plan for ' || cname || ' waits for your check', 'The plan for ' || cname || ' waits for your check',
        staff_href, new.id);
    end loop;
  when 'version.in_check' then
    for r in select distinct s.user_id from public.staff_assignments s
             where s.workspace_id = ws and s.staff_role = 'designer' and s.can_check loop
      perform app.notify(r.user_id, ws, 'waiting_on_you', new.actor, 'check:' || camp,
        '1 creative in ' || cname || ' waits for its check', '{n} creatives in ' || cname || ' wait for their check',
        '/studio/b/' || ws || '/qa?campaign=' || camp, new.id);
    end loop;
  when 'version.correction_asked' then
    for r in select distinct s.user_id from public.staff_assignments s where s.workspace_id = ws and s.staff_role = 'designer' loop
      perform app.notify(r.user_id, ws, 'changes_asked', new.actor, 'correction:' || camp,
        who || ' asked for a correction in ' || cname, who || ' asked for {n} corrections in ' || cname,
        '/studio/b/' || ws || '/qa?campaign=' || camp, new.id);
    end loop;
  when 'version.held' then
    for r in select distinct s.user_id from public.staff_assignments s where s.workspace_id = ws loop
      perform app.notify(r.user_id, ws, 'held', new.actor, 'held:' || camp,
        who || ' held 1 creative in ' || cname, who || ' held {n} creatives in ' || cname,
        '/studio/b/' || ws || '/qa?campaign=' || camp, new.id);
    end loop;
  when 'plan.approved' then
    for r in select distinct s.user_id from public.staff_assignments s where s.workspace_id = ws loop
      perform app.notify(r.user_id, ws, 'approved', new.actor, 'plan-approved:' || camp,
        who || ' approved the plan for ' || cname, who || ' approved the plan for ' || cname,
        staff_href, new.id);
    end loop;
  when 'plan.changes_asked' then
    if coalesce(new.detail ->> 'to', 'designer') <> 'fume' then
      for r in select distinct s.user_id from public.staff_assignments s where s.workspace_id = ws and s.staff_role = 'designer' loop
        perform app.notify(r.user_id, ws, 'changes_asked', new.actor, 'plan-changes:' || camp,
          who || ' asked for changes to the plan for ' || cname, who || ' asked for changes to the plan for ' || cname,
          staff_href, new.id);
      end loop;
    end if;
  when 'version.approved' then
    for r in select distinct s.user_id from public.staff_assignments s where s.workspace_id = ws loop
      perform app.notify(r.user_id, ws, 'approved', new.actor, 'approved:' || camp,
        who || ' approved 1 creative in ' || cname, who || ' approved {n} creatives in ' || cname,
        staff_href, new.id);
    end loop;
  when 'version.changes_requested' then
    for r in select distinct s.user_id from public.staff_assignments s where s.workspace_id = ws loop
      perform app.notify(r.user_id, ws, 'changes_asked', new.actor, 'changes:' || camp,
        who || ' asked for changes to 1 creative in ' || cname, who || ' asked for changes to {n} creatives in ' || cname,
        '/studio/b/' || ws || '/qa?campaign=' || camp, new.id);
    end loop;
  when 'delivery.downloaded', 'delivery.confirmed_live' then
    for r in select distinct s.user_id from public.staff_assignments s where s.workspace_id = ws loop
      perform app.notify(r.user_id, ws, 'delivered', new.actor, new.action || ':' || new.subject_id,
        case new.action when 'delivery.downloaded' then who || ' downloaded ' || cname else who || ' says ' || cname || ' is live' end,
        case new.action when 'delivery.downloaded' then who || ' downloaded ' || cname else who || ' says ' || cname || ' is live' end,
        '/studio/b/' || ws || '/deliveries/' || new.subject_id, new.id);
    end loop;
  else
    null;
  end case;
  return new;
exception when others then
  -- The bell never stops the work: a failure here leaves the command's own change in place.
  raise warning 'notification for record event % failed: %', new.id, sqlerrm;
  return new;
end $$;
revoke execute on function app.on_record_notify() from public, anon, authenticated;
