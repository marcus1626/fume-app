-- Agencies (FLOWS §24, §26.8). An agency is an organisation of kind 'agency'; each client brand is a workspace it
-- runs (workspaces.agency_id). An agency's people hold one seat in it: lead (clients, the agency team) or creative.
-- On their clients they work as Fume's people do: a seat gives a checking designer's assignment on every client of the
-- agency, and a lead's an account manager's too, so every rule, the check, the bell and the chat hold for them as
-- they are. The agency checks; only the client approves: in Fume, or through a client link without an account.

-- ─── Agencies, seats and client brands ───────────────────────────────────────

create table public.agency_seats (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  role text not null check (role in ('lead', 'creative')),
  created_at timestamptz not null default now()
);
create index on public.agency_seats (organisation_id);

alter table public.workspaces add column agency_id uuid references public.organisations (id);
create index on public.workspaces (agency_id);

-- An invitation into an agency: the seat is made at the first sign-in, as a membership is.
alter table public.invitations
  add column agency_id uuid references public.organisations (id) on delete cascade,
  add column agency_role text check (agency_role in ('lead', 'creative'));
alter table public.invitations drop constraint invitations_check;
alter table public.invitations add constraint invitations_gives_access
  check (role is not null or staff_role is not null or agency_role is not null);
alter table public.invitations add constraint invitations_agency_seat check ((agency_id is null) = (agency_role is null));

-- The caller's agency, and their seat in the agency that runs a workspace.
create or replace function app.my_agency() returns uuid
language sql stable security definer set search_path = '' as $$
  select a.organisation_id from public.agency_seats a where a.user_id = auth.uid()
$$;
create or replace function app.agency_role(ws uuid) returns text
language sql stable security definer set search_path = '' as $$
  select a.role from public.agency_seats a join public.workspaces w on w.agency_id = a.organisation_id
  where a.user_id = auth.uid() and w.id = ws
$$;
-- The caller sees an agency when they hold a seat in it or can open one of its clients.
create or replace function app.sees_agency(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select org = app.my_agency() or app.is_admin()
    or exists (select 1 from public.workspaces w where w.agency_id = org and app.can_read(w.id))
$$;

-- A seat's assignments on one client: a checking designer, and a lead the account manager too.
create or replace function app.assign_seat(p_user uuid, p_role text, p_ws uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.staff_assignments (user_id, workspace_id, staff_role, can_check)
  select p_user, p_ws, r, r = 'designer'
  from unnest(case when p_role = 'lead' then array['designer', 'account_manager'] else array['designer'] end) r
  on conflict (user_id, workspace_id, staff_role) do update set can_check = excluded.can_check;
$$;

create or replace function app.on_seat_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  w record;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    delete from public.staff_assignments s using public.workspaces x
    where s.user_id = old.user_id and s.workspace_id = x.id and x.agency_id = old.organisation_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    for w in select id from public.workspaces where agency_id = new.organisation_id loop
      perform app.assign_seat(new.user_id, new.role, w.id);
    end loop;
    return new;
  end if;
  return old;
end $$;
create trigger agency_seat_assigns after insert or update or delete on public.agency_seats
for each row execute function app.on_seat_change();

create or replace function app.on_client_agency() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  a record;
begin
  if tg_op = 'UPDATE' and old.agency_id is not null and old.agency_id is distinct from new.agency_id then
    delete from public.staff_assignments s using public.agency_seats x
    where s.workspace_id = new.id and s.user_id = x.user_id and x.organisation_id = old.agency_id;
  end if;
  if new.agency_id is not null then
    for a in select user_id, role from public.agency_seats where organisation_id = new.agency_id loop
      perform app.assign_seat(a.user_id, a.role, new.id);
    end loop;
  end if;
  return new;
end $$;
create trigger client_agency_assigns after insert or update of agency_id on public.workspaces
for each row execute function app.on_client_agency();

-- The first sign-in: an agency invitation becomes the seat (before app.on_new_user marks it accepted).
create or replace function app.on_new_profile_seat() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.agency_seats (user_id, organisation_id, role)
  select new.id, i.agency_id, i.agency_role from public.invitations i
  where lower(i.email) = lower(new.email) and i.state = 'sent' and i.agency_id is not null
  order by i.created_at desc limit 1
  on conflict (user_id) do nothing;
  return new;
end $$;
create trigger profile_agency_seat after insert on public.profiles
for each row execute function app.on_new_profile_seat();

revoke execute on function app.assign_seat(uuid, text, uuid), app.on_seat_change(), app.on_client_agency(),
  app.on_new_profile_seat() from public, anon, authenticated;

-- ─── Who sees the agency ─────────────────────────────────────────────────────

alter table public.agency_seats enable row level security;
create policy agency_seats_read on public.agency_seats for select to authenticated using (app.sees_agency(organisation_id));
grant select on public.agency_seats to authenticated;

drop policy organisations_read on public.organisations;
create policy organisations_read on public.organisations for select to authenticated using (
  app.is_admin() or app.sees_agency(id)
  or exists (select 1 from public.workspaces w where w.organisation_id = organisations.id and app.can_read(w.id))
);

-- The agency's people see each other, and the client's people see who at the agency works on their brand (through
-- the assignments, as before).
drop policy profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (
  id = (select auth.uid()) or app.is_admin() or exists (
    select 1 from public.memberships m where m.user_id = profiles.id and app.can_read(m.workspace_id)
  ) or exists (
    select 1 from public.staff_assignments s where s.user_id = profiles.id and app.can_read(s.workspace_id)
  ) or exists (
    select 1 from public.agency_seats a where a.user_id = profiles.id and a.organisation_id = app.my_agency()
  )
);

-- ─── A plan on a client brand waits for the agency's check ───────────────────
-- Fume writes the plan; the agency checks it and sends it; only then is it the client's to approve (FLOWS §26.8).

create or replace function app.agency_plan_waits() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.state = 'ready' and new.checked_by is null
     and exists (select 1 from public.workspaces w where w.id = new.workspace_id and w.agency_id is not null) then
    new.state := 'in_check';
  end if;
  return new;
end $$;
revoke execute on function app.agency_plan_waits() from public, anon, authenticated;
create trigger plan_waits_for_agency before insert or update of state, checked_by on public.plan_versions
for each row execute function app.agency_plan_waits();

-- ─── What the agency sends to the client, and the client link ────────────────

-- One link per campaign while it works; it opens only what was sent in it.
create table public.client_links (
  token text primary key,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index on public.client_links (campaign_id);
create index on public.client_links (workspace_id);
create index on public.client_links (created_by);

create table public.client_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  version_ids uuid[] not null default '{}',
  plan_version int,
  to_ids uuid[] not null default '{}',
  link_token text references public.client_links (token) on delete set null,
  note text,
  sent_by uuid not null references public.profiles (id),
  sent_at timestamptz not null default clock_timestamp()
);
create index on public.client_sends (campaign_id);
create index on public.client_sends (workspace_id);
create index on public.client_sends (link_token);
create index on public.client_sends (sent_by);

alter table public.client_links enable row level security;
create policy client_links_read on public.client_links for select to authenticated using (app.is_staff(workspace_id));
alter table public.client_sends enable row level security;
create policy client_sends_read on public.client_sends for select to authenticated using (app.can_read(workspace_id));
grant select on public.client_links, public.client_sends to authenticated;

-- An approval the client gave outside Fume, recorded by the agency: approved by the client, recorded by its person.
alter table public.approvals
  add column recorded_by uuid references public.profiles (id),
  add column recorded_note text;
create index on public.approvals (recorded_by);

-- ─── What the agency asks of Fume ────────────────────────────────────────────

create table public.fume_requests (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  kind text not null check (kind in ('manpower', 'support')),
  client_id uuid references public.workspaces (id) on delete set null,
  campaign_id uuid references public.campaigns (id) on delete set null,
  work text[] not null default '{}',
  amount text,
  when_text text,
  topic text,
  text text,
  by uuid not null references public.profiles (id),
  at timestamptz not null default now(),
  state text not null default 'sent' check (state in ('sent'))
);
create index on public.fume_requests (organisation_id);
create index on public.fume_requests (client_id);
create index on public.fume_requests (campaign_id);
create index on public.fume_requests (by);
alter table public.fume_requests enable row level security;
create policy fume_requests_read on public.fume_requests for select to authenticated using (
  organisation_id = app.my_agency() or app.is_admin()
);
grant select on public.fume_requests to authenticated;

-- ─── Commands ────────────────────────────────────────────────────────────────

-- Fume admin: an agency and its first lead, by email (the seat is made at their first sign-in; the invite edge
-- function sends the email).
create or replace function public.create_agency(p_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o public.organisations;
begin
  perform app.require_user();
  if not app.is_admin() then perform app.fail('forbidden', 'Only Fume makes an agency.'); end if;
  if coalesce(trim(p_name), '') = '' then perform app.fail('invalid', 'Write the agency''s name.'); end if;
  insert into public.organisations (name, kind) values (trim(p_name), 'agency') returning * into o;
  return to_jsonb(o);
end $$;

-- A person into the agency: Fume's admin, or the agency's lead for their own agency. Someone who already uses Fume
-- gets the seat at once.
create or replace function public.invite_agency_person(
  p_agency_id uuid, p_email text, p_name text, p_title text, p_role text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  who uuid;
  inv public.invitations;
begin
  perform app.require_user();
  if not (app.is_admin() or (p_agency_id = app.my_agency() and
          (select role from public.agency_seats where user_id = auth.uid()) = 'lead')) then
    perform app.fail('forbidden', 'Only the agency''s lead invites people to the agency.');
  end if;
  if not exists (select 1 from public.organisations where id = p_agency_id and kind = 'agency') then
    perform app.fail('not_found', 'No such agency.');
  end if;
  if p_role not in ('lead', 'creative') then perform app.fail('invalid', 'Choose lead or creative.'); end if;
  if coalesce(p_email, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    perform app.fail('invalid', 'That email address doesn''t look right.');
  end if;
  select id into who from public.profiles where lower(email) = lower(trim(p_email));
  if who is not null then
    if exists (select 1 from public.agency_seats where user_id = who and organisation_id <> p_agency_id) then
      perform app.fail('conflict', 'This person works in another agency.');
    end if;
    insert into public.agency_seats (user_id, organisation_id, role) values (who, p_agency_id, p_role)
    on conflict (user_id) do update set role = excluded.role;
  end if;
  insert into public.invitations (email, agency_id, agency_role, name, title, invited_by, state)
  values (lower(trim(p_email)), p_agency_id, p_role, nullif(trim(p_name), ''), nullif(trim(p_title), ''), auth.uid(),
          case when who is null then 'sent' else 'accepted' end)
  returning * into inv;
  return to_jsonb(inv) || jsonb_build_object('joined', who is not null);
end $$;

-- The lead adds a client brand: its own organisation, run by the agency. The client's people are invited after, with
-- the invite edge function (a lead is the client's account manager).
create or replace function public.add_client(
  p_brand_name text, p_market text default '', p_language text default 'en', p_website text default null,
  p_key text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('brand_name', p_brand_name, 'market', p_market, 'language', p_language,
                                  'website', p_website);
  prior jsonb;
  agency uuid := app.my_agency();
  o public.organisations;
  w public.workspaces;
  base text;
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'add_client', req);
  if prior is not null then return prior; end if;
  if agency is null or (select role from public.agency_seats where user_id = auth.uid()) <> 'lead' then
    perform app.fail('forbidden', 'Only the agency lead adds clients.');
  end if;
  if coalesce(trim(p_brand_name), '') = '' then perform app.fail('invalid', 'Write the brand''s name.'); end if;
  insert into public.organisations (name, kind) values (trim(p_brand_name), 'brand') returning * into o;
  base := trim(both '-' from regexp_replace(lower(trim(p_brand_name)), '[^a-z0-9]+', '-', 'g'));
  insert into public.workspaces (organisation_id, slug, brand_name, market, language, agency_id)
  values (o.id, coalesce(nullif(base, ''), 'brand') || '-' || left(replace(gen_random_uuid()::text, '-', ''), 6),
          trim(p_brand_name), coalesce(trim(p_market), ''), coalesce(nullif(trim(p_language), ''), 'en'), agency)
  returning * into w;
  perform app.record(w.id, 'client.added', 'workspace', w.id,
    jsonb_build_object('agency', agency, 'website', nullif(trim(coalesce(p_website, '')), '')));
  return app.idem_end(p_key, 'add_client', req, to_jsonb(w));
end $$;

create or replace function app.client_send_json(s public.client_sends) returns jsonb
language sql stable security definer set search_path = '' as $$
  select to_jsonb(s) || jsonb_build_object('link', (
    select jsonb_build_object('token', l.token, 'expires_at', l.expires_at)
    from public.client_links l where l.token = s.link_token))
$$;
revoke execute on function app.client_send_json(public.client_sends) from public, anon, authenticated;

-- Checked creatives, the plan, or both, to the client. The client's people are told in Fume (the bell); with p_link the
-- campaign's client link holds it too. Sending the plan is the agency's check of it.
create or replace function public.send_to_client(
  p_campaign_id uuid, p_version_ids uuid[], p_to uuid[], p_link boolean, p_note text default null,
  p_plan boolean default false, p_key text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('campaign_id', p_campaign_id, 'version_ids', to_jsonb(p_version_ids),
                                  'to', to_jsonb(p_to), 'link', p_link, 'note', p_note, 'plan', p_plan);
  prior jsonb;
  c public.campaigns;
  pv public.plan_versions;
  tok text;
  n int := 0;
  s public.client_sends;
  ids uuid[] := coalesce(p_version_ids, '{}');
  people uuid[] := coalesce(p_to, '{}');
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'send_to_client', req);
  if prior is not null then return prior; end if;

  select * into c from public.campaigns where id = p_campaign_id for update;
  if not found or not app.can_read(c.workspace_id) then perform app.fail('not_found', 'No such campaign.'); end if;
  if not app.is_staff(c.workspace_id, array['designer', 'account_manager']) then
    perform app.fail('forbidden', 'This is for the agency''s people.');
  end if;
  if cardinality(ids) = 0 and not coalesce(p_plan, false) then
    perform app.fail('invalid', 'Choose the creatives to send.');
  end if;
  if exists (
    select 1 from unnest(ids) vid
    where not exists (
      select 1 from public.creative_versions v join public.creatives cr on cr.id = v.creative_id
      where v.id = vid and cr.campaign_id = c.id and v.state = 'checked' and v.number = (app.latest_version(cr.id)).number)
  ) then
    perform app.fail('conflict', 'Only checked creatives go to the client.');
  end if;
  if exists (
    select 1 from unnest(people) u
    where not exists (select 1 from public.memberships m where m.user_id = u and m.workspace_id = c.workspace_id)
  ) then
    perform app.fail('invalid', 'Send to the client''s own people.');
  end if;
  if cardinality(people) = 0 and not coalesce(p_link, false) then
    perform app.fail('invalid', 'Choose who at the client approves, or make a client link.');
  end if;

  if coalesce(p_plan, false) then
    select * into pv from public.plan_versions where campaign_id = c.id and state <> 'superseded'
    order by version desc limit 1;
    if not found then perform app.fail('conflict', 'This campaign has no plan to send yet.'); end if;
    if pv.state = 'approved' then perform app.fail('conflict', 'The client approved this plan already.'); end if;
    perform public.check_plan(c.id, pv.version);
  end if;

  if cardinality(ids) > 0 then
    update public.creative_versions set sent_at = now(), sent_by = auth.uid()
    where id = any (ids) and sent_at is null;
    get diagnostics n = row_count;
    update public.campaigns set state = 'in_review' where id = c.id and state not in ('approved', 'delivered');
    if n > 0 then
      perform app.record(c.workspace_id, 'versions.sent', 'campaign', c.id, jsonb_build_object('count', n));
    end if;
  end if;

  if coalesce(p_link, false) then
    select token into tok from public.client_links
    where campaign_id = c.id and expires_at > now() order by created_at desc limit 1;
    if tok is null then
      tok := replace(gen_random_uuid()::text, '-', '') || left(replace(gen_random_uuid()::text, '-', ''), 12);
      insert into public.client_links (token, campaign_id, workspace_id, created_by, expires_at)
      values (tok, c.id, c.workspace_id, auth.uid(), now() + interval '30 days');
    end if;
  end if;

  insert into public.client_sends (campaign_id, workspace_id, version_ids, plan_version, to_ids, link_token, note, sent_by)
  values (c.id, c.workspace_id, ids, case when coalesce(p_plan, false) then pv.version end, people, tok,
          nullif(trim(coalesce(p_note, '')), ''), auth.uid())
  returning * into s;
  perform app.record(c.workspace_id, 'client.sent', 'campaign', c.id,
    jsonb_build_object('send', s.id, 'versions', cardinality(ids), 'plan', s.plan_version, 'link', tok is not null));
  return app.idem_end(p_key, 'send_to_client', req, app.client_send_json(s));
end $$;

-- Act as another person inside one command (the client through a link, or an approval recorded for her), then go back.
create or replace function app.act_as(p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  was jsonb := jsonb_build_object('claims', current_setting('request.jwt.claims', true),
                                  'sub', current_setting('request.jwt.claim.sub', true));
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  return was;
end $$;
create or replace function app.act_back(p_was jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('request.jwt.claims', coalesce(p_was ->> 'claims', ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(p_was ->> 'sub', ''), true);
end $$;
revoke execute on function app.act_as(uuid), app.act_back(jsonb) from public, anon, authenticated;

-- An approval the client gave outside Fume (a mail, a call), recorded by the agency. It stays the client's approval.
create or replace function public.record_client_approval(
  p_version_ids uuid[], p_client_user_id uuid, p_note text, p_at timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := app.require_user();
  ws uuid;
  was jsonb;
  out jsonb;
begin
  if coalesce(trim(p_note), '') = '' then perform app.fail('invalid', 'Say how the client approved, for the record.'); end if;
  if coalesce(cardinality(p_version_ids), 0) = 0 then perform app.fail('invalid', 'Tick what the client approved.'); end if;
  select min(v.workspace_id::text)::uuid into ws from public.creative_versions v where v.id = any (p_version_ids);
  if ws is null or not app.can_read(ws)
     or exists (select 1 from public.creative_versions v where v.id = any (p_version_ids) and v.workspace_id <> ws) then
    perform app.fail('not_found', 'No such creative version.');
  end if;
  if not app.is_staff(ws, array['designer', 'account_manager']) then
    perform app.fail('forbidden', 'This is for the agency''s people.');
  end if;
  if not exists (select 1 from public.memberships m where m.user_id = p_client_user_id and m.workspace_id = ws
                 and m.role in ('owner', 'approver')) then
    perform app.fail('invalid', 'Name the person at the client who approved.');
  end if;
  if exists (select 1 from public.creative_versions v where v.id = any (p_version_ids) and v.state <> 'checked') then
    perform app.fail('conflict', 'Only checked creatives can be approved.');
  end if;
  update public.creative_versions set sent_at = now(), sent_by = me where id = any (p_version_ids) and sent_at is null;
  was := app.act_as(p_client_user_id);
  out := public.approve_versions(p_version_ids, null);
  perform app.act_back(was);
  update public.approvals set recorded_by = me, recorded_note = trim(p_note),
    created_at = least(coalesce(p_at, now()), now())
  where version_id = any (p_version_ids) and revoked_at is null;
  perform app.record(ws, 'approval.recorded', 'workspace', ws,
    jsonb_build_object('versions', to_jsonb(p_version_ids), 'client', p_client_user_id, 'note', trim(p_note)));
  return out;
end $$;

-- ─── The client link (service only: the edge function client-link reads and answers it) ─────────────────

create or replace function app.live_link(p_token text) returns public.client_links
language plpgsql stable security definer set search_path = '' as $$
declare
  l public.client_links;
begin
  select * into l from public.client_links where token = p_token and expires_at > now();
  if not found then perform app.fail('not_found', 'This client link has expired or was never made.'); end if;
  return l;
end $$;

-- What a client link opens: every send in it (newest first), the brand, its agency, the campaign, the creatives sent
-- in it (only versions that reached the client), the plan when a send carried it, and who sent it.
create or replace function public.client_link_view(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  l public.client_links := app.live_link(p_token);
  sent uuid[];
begin
  select coalesce(array_agg(distinct x), '{}') into sent
  from public.client_sends s, unnest(s.version_ids) x where s.link_token = l.token;
  return jsonb_build_object(
    'sends', (select jsonb_agg(app.client_send_json(s) order by s.sent_at desc) from public.client_sends s where s.link_token = l.token),
    'workspace', (select to_jsonb(w) from public.workspaces w where w.id = l.workspace_id),
    'agency', (select to_jsonb(o) from public.organisations o join public.workspaces w on w.agency_id = o.id where w.id = l.workspace_id),
    'campaign', (select to_jsonb(c) from public.campaigns c where c.id = l.campaign_id),
    'creatives', (
      select coalesce(jsonb_agg(to_jsonb(cr) || jsonb_build_object('creative_versions', (
        select coalesce(jsonb_agg(to_jsonb(v) || jsonb_build_object(
          'expert_checks', (select to_jsonb(e) from public.expert_checks e where e.version_id = v.id and e.state = 'checked'),
          'approvals', (select coalesce(jsonb_agg(to_jsonb(a)), '[]') from public.approvals a where a.version_id = v.id and a.revoked_at is null),
          'files', (select to_jsonb(f) from public.files f where f.id = v.file_id)
        ) order by v.number), '[]')
        from public.creative_versions v where v.creative_id = cr.id and v.sent_at is not null
      )) order by cr.created_at), '[]')
      from public.creatives cr
      where exists (select 1 from public.creative_versions v where v.creative_id = cr.id and v.id = any (sent))
    ),
    'plans', (
      select coalesce(jsonb_agg(to_jsonb(p) order by p.version), '[]') from public.plan_versions p
      where p.campaign_id = l.campaign_id and p.state <> 'superseded'
        and exists (select 1 from public.client_sends s where s.link_token = l.token and s.plan_version is not null)
    ),
    'brief_version', (select coalesce(max(b.version), 1) from public.brief_versions b where b.campaign_id = l.campaign_id),
    'people', (
      select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'title', p.title, 'email', p.email,
        'avatar_url', p.avatar_url)), '[]')
      from public.profiles p where p.id in (select s.sent_by from public.client_sends s where s.link_token = l.token)
    )
  );
end $$;

-- Who answers through the link: the first person it was sent to who approves for the client, else the client's
-- owner, else an approver.
create or replace function app.link_client(l public.client_links) returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select u from public.client_sends s, unnest(s.to_ids) with ordinality t(u, i)
     join public.memberships m on m.user_id = t.u and m.workspace_id = l.workspace_id and m.role in ('owner', 'approver')
     where s.link_token = l.token order by s.sent_at, t.i limit 1),
    (select m.user_id from public.memberships m where m.workspace_id = l.workspace_id and m.role in ('owner', 'approver')
     order by (m.role = 'owner') desc, m.created_at limit 1)
  )
$$;

-- The agency's own people (and Fume's) open the link as a preview; an answer there is never the client's.
create or replace function app.link_answerer(l public.client_links, p_caller uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  who uuid;
begin
  if p_caller is not null and (
    exists (select 1 from public.staff_assignments s where s.user_id = p_caller and s.workspace_id = l.workspace_id)
    or exists (select 1 from public.agency_seats a join public.workspaces w on w.agency_id = a.organisation_id
               where a.user_id = p_caller and w.id = l.workspace_id)
    or exists (select 1 from public.profiles p where p.id = p_caller and p.staff_role = 'admin')
  ) then
    perform app.fail('forbidden', 'This is a preview of the client''s page. Only the client answers here.');
  end if;
  who := app.link_client(l);
  if who is null then perform app.fail('conflict', 'No one at the client can approve yet. Ask the agency.'); end if;
  return who;
end $$;

create or replace function public.client_link_answer(
  p_token text, p_version_id uuid, p_verdict text, p_text text, p_name text, p_caller uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  l public.client_links := app.live_link(p_token);
  who uuid := app.link_answerer(l, p_caller);
  was jsonb;
  by_name text := nullif(trim(coalesce(p_name, '')), '');
  out jsonb;
begin
  if not exists (select 1 from public.client_sends s where s.link_token = l.token and p_version_id = any (s.version_ids)) then
    perform app.fail('not_found', 'This creative is not in the link.');
  end if;
  if p_verdict not in ('approve', 'changes') then perform app.fail('invalid', 'Approve, or ask for changes.'); end if;
  if p_verdict = 'changes' and coalesce(trim(p_text), '') = '' then perform app.fail('invalid', 'Say what should change.'); end if;
  was := app.act_as(who);
  if p_verdict = 'approve' then
    out := public.approve_versions(array[p_version_id], null) -> 0;
    update public.approvals set recorded_note = 'Through the client link' || coalesce(', by ' || by_name, '')
    where version_id = p_version_id and revoked_at is null;
  else
    perform public.request_changes(p_version_id, 'revision',
      case when by_name is null then trim(p_text) else trim(p_text) || ' (' || by_name || ', through the client link)' end);
    select to_jsonb(v) into out from public.creative_versions v where v.id = p_version_id;
  end if;
  perform app.act_back(was);
  return out;
end $$;

create or replace function public.client_link_plan(
  p_token text, p_verdict text, p_text text, p_name text, p_caller uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  l public.client_links := app.live_link(p_token);
  who uuid := app.link_answerer(l, p_caller);
  was jsonb;
  pv public.plan_versions;
  by_name text := nullif(trim(coalesce(p_name, '')), '');
begin
  if not exists (select 1 from public.client_sends s where s.link_token = l.token and s.plan_version is not null) then
    perform app.fail('not_found', 'This link holds no plan.');
  end if;
  if p_verdict not in ('approve', 'changes') then perform app.fail('invalid', 'Approve, or ask for changes.'); end if;
  if p_verdict = 'changes' and coalesce(trim(p_text), '') = '' then perform app.fail('invalid', 'Say what should change.'); end if;
  select * into pv from public.plan_versions where campaign_id = l.campaign_id and state <> 'superseded'
  order by version desc limit 1;
  was := app.act_as(who);
  if p_verdict = 'approve' then
    perform public.approve_plan(l.campaign_id, pv.version, null);
  else
    perform public.ask_plan_changes(l.campaign_id, pv.version,
      case when by_name is null then trim(p_text) else trim(p_text) || ' (' || by_name || ', through the client link)' end);
  end if;
  perform app.act_back(was);
  select * into pv from public.plan_versions where id = pv.id;
  return to_jsonb(pv);
end $$;

-- ─── Asking Fume ─────────────────────────────────────────────────────────────

create or replace function public.ask_fume(
  p_kind text, p_client_id uuid default null, p_campaign_id uuid default null, p_work text[] default '{}',
  p_amount text default null, p_when text default null, p_topic text default null, p_text text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  agency uuid := app.my_agency();
  r public.fume_requests;
begin
  perform app.require_user();
  if agency is null then perform app.fail('forbidden', 'This is for the agency''s people.'); end if;
  if p_kind = 'manpower' then
    if p_client_id is null or not exists (select 1 from public.workspaces w where w.id = p_client_id and w.agency_id = agency) then
      perform app.fail('invalid', 'Choose the client the work is for.');
    end if;
    if coalesce(cardinality(p_work), 0) = 0 or exists (select 1 from unnest(p_work) x where x not in ('checks', 'design', 'renders')) then
      perform app.fail('invalid', 'Choose what Fume''s people should do.');
    end if;
  elsif p_kind = 'support' then
    if coalesce(trim(p_text), '') = '' then perform app.fail('invalid', 'Write what it is about.'); end if;
  else
    perform app.fail('invalid', 'Borrow Fume''s people, or write to Fume.');
  end if;
  insert into public.fume_requests (organisation_id, kind, client_id, campaign_id, work, amount, when_text, topic, text, by)
  values (agency, p_kind, p_client_id, p_campaign_id, coalesce(p_work, '{}'), nullif(trim(coalesce(p_amount, '')), ''),
          nullif(trim(coalesce(p_when, '')), ''), nullif(trim(coalesce(p_topic, '')), ''),
          nullif(trim(coalesce(p_text, '')), ''), auth.uid())
  returning * into r;
  return to_jsonb(r);
end $$;

-- ─── Grants ──────────────────────────────────────────────────────────────────

revoke execute on function public.create_agency(text), public.invite_agency_person(uuid, text, text, text, text),
  public.add_client(text, text, text, text, text),
  public.send_to_client(uuid, uuid[], uuid[], boolean, text, boolean, text),
  public.record_client_approval(uuid[], uuid, text, timestamptz),
  public.ask_fume(text, uuid, uuid, text[], text, text, text, text) from public, anon;
grant execute on function public.create_agency(text), public.invite_agency_person(uuid, text, text, text, text),
  public.add_client(text, text, text, text, text),
  public.send_to_client(uuid, uuid[], uuid[], boolean, text, boolean, text),
  public.record_client_approval(uuid[], uuid, text, timestamptz),
  public.ask_fume(text, uuid, uuid, text[], text, text, text, text) to authenticated;

revoke execute on function public.client_link_view(text), public.client_link_answer(text, uuid, text, text, text, uuid),
  public.client_link_plan(text, text, text, text, uuid), app.live_link(text), app.link_client(public.client_links),
  app.link_answerer(public.client_links, uuid) from public, anon, authenticated;
grant execute on function public.client_link_view(text), public.client_link_answer(text, uuid, text, text, text, uuid),
  public.client_link_plan(text, text, text, text, uuid) to service_role;
