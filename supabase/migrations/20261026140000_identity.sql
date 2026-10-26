-- Identity and tenancy (ARCHITECTURE §3, docs/mvp/domain-model.md §1).
-- Organisation ── Workspace (one brand) ── everything else. A person reaches a workspace through a Membership
-- (customer role) or, for Fume's people, a StaffAssignment or the admin role. Every other table carries workspace_id
-- and is read through app.can_read(workspace_id).
--
-- Writes never go straight into tables: the authenticated role only reads. Every change is a command (a function in
-- the public schema, see *_commands.sql) that checks the caller's role and the rules, then writes and records it.

create schema if not exists app;
grant usage on schema app to authenticated, anon;

-- ─── Tables ──────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text not null,
  -- Real job title, shown with the name on every check (F-D040).
  title text not null default '',
  -- Set for Fume's own people only.
  staff_role text check (staff_role in ('expert', 'operator', 'admin')),
  created_at timestamptz not null default now()
);

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'brand' check (kind in ('brand', 'agency')),
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id),
  slug text not null unique,
  brand_name text not null,
  market text not null default '',
  language text not null default 'en',
  created_at timestamptz not null default now()
);

create table public.memberships (
  user_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  role text not null check (role in ('owner', 'approver', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (user_id, workspace_id)
);

create table public.staff_assignments (
  user_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  staff_role text not null check (staff_role in ('expert', 'operator')),
  created_at timestamptz not null default now(),
  primary key (user_id, workspace_id, staff_role)
);

-- An invitation by email. When that person signs in for the first time, their invitations become memberships (or a
-- staff role), so access is set up before anyone has an account.
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  role text check (role in ('owner', 'approver', 'member', 'viewer')),
  staff_role text check (staff_role in ('expert', 'operator', 'admin')),
  name text,
  title text,
  invited_by uuid references public.profiles (id),
  state text not null default 'sent' check (state in ('sent', 'accepted', 'expired')),
  created_at timestamptz not null default now(),
  check (role is not null or staff_role is not null),
  check (role is null or workspace_id is not null),
  check (staff_role is null or staff_role = 'admin' or workspace_id is not null)
);
create index on public.invitations (lower(email)) where state = 'sent';

-- ─── Who may do what (used by every policy and command) ────────────────────

create or replace function app.uid() returns uuid
language sql stable as $$ select auth.uid() $$;

create or replace function app.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.staff_role = 'admin')
$$;

-- The caller's customer role on a workspace, or null.
create or replace function app.customer_role(ws uuid) returns text
language sql stable security definer set search_path = '' as $$
  select m.role from public.memberships m where m.user_id = auth.uid() and m.workspace_id = ws
$$;

-- True when the caller works on this workspace for Fume with one of the given staff roles. An admin reads every
-- workspace and acts as its operator, but checks creatives only when assigned as its expert: the check carries a
-- named expert, never a role by default.
create or replace function app.is_staff(ws uuid, roles text[] default array['expert', 'operator']) returns boolean
language sql stable security definer set search_path = '' as $$
  select (app.is_admin() and 'operator' = any (roles)) or exists (
    select 1 from public.staff_assignments s
    where s.user_id = auth.uid() and s.workspace_id = ws and s.staff_role = any (roles)
  )
$$;

create or replace function app.can_read(ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.customer_role(ws) is not null or app.is_staff(ws)
$$;

-- Raise one of the contract's error codes (app/src/contract/errors.ts). The client maps the code back to FumeError.
create or replace function app.fail(code text, message text) returns void
language plpgsql as $$
begin
  raise exception using errcode = 'P0001', message = message, detail = code;
end $$;

-- ─── A person's first sign-in ────────────────────────────────────────────────

create or replace function app.on_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  inv record;
  staff text;
begin
  select i.staff_role into staff from public.invitations i
  where lower(i.email) = lower(new.email) and i.state = 'sent' and i.staff_role = 'admin' limit 1;

  insert into public.profiles (id, email, name, title, staff_role)
  values (
    new.id,
    new.email,
    coalesce(
      (select i.name from public.invitations i where lower(i.email) = lower(new.email) and i.name is not null limit 1),
      split_part(new.email, '@', 1)
    ),
    coalesce(
      (select i.title from public.invitations i where lower(i.email) = lower(new.email) and i.title is not null limit 1),
      ''
    ),
    coalesce(staff, (
      select i.staff_role from public.invitations i
      where lower(i.email) = lower(new.email) and i.state = 'sent' and i.staff_role is not null limit 1
    ))
  );

  for inv in
    select * from public.invitations i where lower(i.email) = lower(new.email) and i.state = 'sent'
  loop
    if inv.role is not null then
      insert into public.memberships (user_id, workspace_id, role) values (new.id, inv.workspace_id, inv.role)
      on conflict (user_id, workspace_id) do update set role = excluded.role;
    end if;
    if inv.staff_role in ('expert', 'operator') then
      insert into public.staff_assignments (user_id, workspace_id, staff_role)
      values (new.id, inv.workspace_id, inv.staff_role) on conflict do nothing;
    end if;
    update public.invitations set state = 'accepted' where id = inv.id;
  end loop;
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function app.on_new_user();

-- ─── Read access ─────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.organisations enable row level security;
alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
alter table public.staff_assignments enable row level security;
alter table public.invitations enable row level security;

-- A person sees themselves and everyone who shares a workspace with them.
create policy profiles_read on public.profiles for select to authenticated using (
  id = auth.uid() or app.is_admin() or exists (
    select 1 from public.memberships m where m.user_id = profiles.id and app.can_read(m.workspace_id)
  ) or exists (
    select 1 from public.staff_assignments s where s.user_id = profiles.id and app.can_read(s.workspace_id)
  )
);
create policy workspaces_read on public.workspaces for select to authenticated using (app.can_read(id));
create policy organisations_read on public.organisations for select to authenticated using (
  app.is_admin() or exists (select 1 from public.workspaces w where w.organisation_id = organisations.id and app.can_read(w.id))
);
create policy memberships_read on public.memberships for select to authenticated using (app.can_read(workspace_id));
create policy staff_assignments_read on public.staff_assignments for select to authenticated using (app.can_read(workspace_id));
create policy invitations_read on public.invitations for select to authenticated using (
  app.is_admin() or (workspace_id is not null and (app.customer_role(workspace_id) = 'owner' or app.is_staff(workspace_id, array['operator'])))
);

grant select on public.profiles, public.organisations, public.workspaces, public.memberships, public.staff_assignments,
  public.invitations to authenticated;
