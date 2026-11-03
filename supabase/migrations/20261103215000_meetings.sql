-- Meetings with Fume (FLOWS §21): the brand's people book half an hour with their person at Fume (the account
-- manager, else the checking designer: app.chat_person), on a free weekday slot. The host gets a bell line; the
-- meeting shows in the content calendar. Cancelling is the booker's, the brand's owner's, or the host's.

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  topic text not null check (length(trim(topic)) > 0),
  at timestamptz not null,
  minutes int not null default 30 check (minutes between 15 and 120),
  host_id uuid references public.profiles (id) on delete set null,
  booked_by uuid not null references public.profiles (id),
  guest_ids uuid[] not null default '{}',
  state text not null default 'booked' check (state in ('booked', 'done', 'cancelled')),
  created_at timestamptz not null default now()
);
create index on public.meetings (workspace_id, at);
create index on public.meetings (host_id, at);
create index on public.meetings (booked_by);
alter table public.meetings enable row level security;
create policy meetings_read on public.meetings for select to authenticated using (app.can_read(workspace_id));
grant select on public.meetings to authenticated;

-- Free slots in the next working days, 09:00 and 13:00 in Oslo, that the host has not booked.
create or replace function public.meeting_slots(p_workspace_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  host uuid;
begin
  if not app.can_read(p_workspace_id) then perform app.fail('not_found', 'No such brand.'); end if;
  host := app.chat_person(p_workspace_id);
  return (select coalesce(jsonb_agg(s order by s), '[]') from (
    select s from (
      select ((d::date + t) at time zone 'Europe/Oslo') s
      from generate_series((now() at time zone 'Europe/Oslo')::date + 1, (now() at time zone 'Europe/Oslo')::date + 14, interval '1 day') d,
           (values (time '09:00'), (time '13:00')) h(t)
      where extract(isodow from d) < 6
    ) all_slots
    where not exists (select 1 from public.meetings m where m.state = 'booked' and m.at = all_slots.s
                      and (m.host_id = host or (host is null and m.workspace_id = p_workspace_id)))
    order by s limit 6) free);
end $$;

create or replace function app.meeting_json(m public.meetings) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', m.id, 'workspaceId', m.workspace_id, 'topic', m.topic, 'at', m.at, 'minutes', m.minutes,
    'hostId', coalesce(m.host_id::text, ''), 'guestIds', to_jsonb(m.guest_ids), 'state', m.state)
$$;

create or replace function public.book_meeting(p_workspace_id uuid, p_at timestamptz, p_topic text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m public.meetings;
  host uuid;
  who text;
  ev bigint;
begin
  perform app.require_user();
  if not app.customer_is(p_workspace_id, array['owner', 'approver', 'member']) then
    perform app.fail('forbidden', 'Only the brand''s people book a meeting with Fume.');
  end if;
  if nullif(trim(coalesce(p_topic, '')), '') is null then perform app.fail('invalid', 'Say what it is about.'); end if;
  if p_at is null or p_at < now() then perform app.fail('invalid', 'Choose a time to come.'); end if;
  host := app.chat_person(p_workspace_id);
  if exists (select 1 from public.meetings x where x.state = 'booked' and x.at = p_at
             and (x.host_id = host or (host is null and x.workspace_id = p_workspace_id))) then
    perform app.fail('conflict', 'That time was just taken. Choose another.');
  end if;
  insert into public.meetings (workspace_id, topic, at, host_id, booked_by, guest_ids)
  values (p_workspace_id, trim(p_topic), p_at, host, auth.uid(), array[auth.uid()]) returning * into m;
  insert into public.record_events (workspace_id, actor, action, subject_type, subject_id, detail)
  values (p_workspace_id, auth.uid(), 'meeting.booked', 'meeting', m.id, jsonb_build_object('at', p_at, 'topic', m.topic))
  returning id into ev;
  select name into who from public.profiles where id = auth.uid();
  perform app.notify(host, p_workspace_id, 'waiting_on_you', auth.uid(), 'meeting:' || m.id,
    coalesce(who, 'Someone') || ' booked a meeting: ' || m.topic || ', ' || to_char(p_at at time zone 'Europe/Oslo', 'Dy DD Mon HH24:MI'),
    '{n} meetings booked', '/studio/b/' || p_workspace_id, ev);
  return app.meeting_json(m);
end $$;

create or replace function public.cancel_meeting(p_meeting_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m public.meetings;
begin
  select * into m from public.meetings where id = p_meeting_id;
  if not found or not app.can_read(m.workspace_id) then perform app.fail('not_found', 'No such meeting.'); end if;
  if not (m.booked_by = auth.uid() or m.host_id = auth.uid() or app.customer_is(m.workspace_id, array['owner'])) then
    perform app.fail('forbidden', 'Only who booked it, the owner or the host cancels it.');
  end if;
  update public.meetings set state = 'cancelled' where id = p_meeting_id returning * into m;
  perform app.record(m.workspace_id, 'meeting.cancelled', 'meeting', m.id, '{}');
  return app.meeting_json(m);
end $$;

revoke execute on function app.meeting_json(public.meetings) from public, anon;
grant execute on function app.meeting_json(public.meetings) to authenticated;
revoke execute on function public.meeting_slots(uuid), public.book_meeting(uuid, timestamptz, text), public.cancel_meeting(uuid)
  from public, anon;
grant execute on function public.meeting_slots(uuid), public.book_meeting(uuid, timestamptz, text), public.cancel_meeting(uuid)
  to authenticated;
