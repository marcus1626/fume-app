-- The bell (ARCHITECTURE §4.8): what happened that a person should hear about, written by the database as the record
-- grows, so no command has to remember to notify anyone. Each record event notifies the people it concerns, never the
-- person who did it:
--   the brand's people: creatives sent to them (checked), a plan ready for them, a delivery ready;
--   Fume's people on the brand: a plan approved or sent back, creatives approved or sent back, a delivery downloaded
--   or live.
-- What waits on Fume's people to check is not here: Check and the overview already list it (the bell shows those
-- rows itself). A customer never hears about unsent work: only `versions.sent` reaches them, as the record does.
-- Repeats fold: while a notification is unread, the same news about the same campaign raises its count
-- ("Kristian approved 3 creatives in Night ritual") instead of adding a row.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null check (kind in ('checked', 'engine_done', 'changes_asked', 'mention', 'waiting_on_you', 'delivered', 'held', 'approved')),
  -- Who did it; null for Fume itself.
  actor uuid references public.profiles (id) on delete set null,
  -- The same news about the same thing: one unread row per person and key.
  group_key text not null,
  count int not null default 1,
  text text not null,
  href text not null,
  event_id bigint references public.record_events (id) on delete set null,
  read_at timestamptz,
  at timestamptz not null default now()
);
create unique index notifications_unread_key on public.notifications (user_id, group_key) where read_at is null;
create index on public.notifications (user_id, at desc);
create index on public.notifications (workspace_id);
create index on public.notifications (actor);
create index on public.notifications (event_id);

alter table public.notifications enable row level security;
create policy notifications_read on public.notifications for select to authenticated using (user_id = (select auth.uid()));
grant select on public.notifications to authenticated;

-- One notification, or one more of the same while it is unread. p_many says it for several, with {n} for the count.
create or replace function app.notify(
  p_user uuid, p_ws uuid, p_kind text, p_actor uuid, p_key text, p_one text, p_many text, p_href text, p_event bigint,
  p_n int default 1
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null or p_user is not distinct from p_actor then return; end if;
  insert into public.notifications as n (user_id, workspace_id, kind, actor, group_key, count, text, href, event_id)
  values (p_user, p_ws, p_kind, p_actor, p_key, p_n, case when p_n = 1 then p_one else replace(p_many, '{n}', p_n::text) end, p_href, p_event)
  on conflict (user_id, group_key) where read_at is null do update
    set count = n.count + excluded.count,
        text = replace(p_many, '{n}', (n.count + excluded.count)::text),
        actor = excluded.actor,
        event_id = excluded.event_id,
        at = now();
end $$;

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
revoke execute on function app.notify(uuid, uuid, text, uuid, text, text, text, text, bigint, int) from public, anon, authenticated;
revoke execute on function app.on_record_notify() from public, anon, authenticated;

create trigger record_notifies
after insert on public.record_events
for each row execute function app.on_record_notify();

-- Marks the caller's notifications read: these, or all of them (null).
create or replace function public.mark_notifications_read(p_ids uuid[] default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then perform app.fail('forbidden', 'Sign in first.'); end if;
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids));
end $$;
revoke execute on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
