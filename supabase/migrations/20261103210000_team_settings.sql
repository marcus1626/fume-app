-- The team and the workspace's settings, live: the owner changes what someone can do or takes them off the brand, and
-- changes the brand's name, market and language. The package (what a brand or an agency has bought) gets a table of
-- its own, set by Fume's admins; the usage of the period and an agency's licence are counted from the work itself.

-- ─── Packages ────────────────────────────────────────────────────────────────

-- One package per organisation (a brand's company or an agency). None yet: the Core package from the day the
-- organisation came (app.package_of).
create table public.packages (
  organisation_id uuid primary key references public.organisations (id) on delete cascade,
  kind text not null default 'core' check (kind in ('launch', 'core', 'growth')),
  creative_cap int not null default 27 check (creative_cap > 0),
  direction_rounds int not null default 1 check (direction_rounds >= 0),
  production_rounds int not null default 2 check (production_rounds >= 0),
  period text not null default 'monthly' check (period in ('one_off', 'monthly')),
  started_at timestamptz not null default now(),
  -- An agency's licence: the seats it includes and what it covers, in words.
  seats_included int not null default 6 check (seats_included >= 0),
  scope text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.packages enable row level security;
-- Read by the organisation's people: a brand's team and Fume's people on it, an agency's seats.
create policy packages_read on public.packages for select to authenticated using (
  app.is_admin()
  or exists (select 1 from public.workspaces w where w.organisation_id = packages.organisation_id and app.can_read(w.id))
  or exists (select 1 from public.agency_seats s where s.organisation_id = packages.organisation_id and s.user_id = auth.uid())
);
grant select on public.packages to authenticated;

-- The package as the contract has it, with the period it is in now.
create or replace function app.package_of(p_org uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  p public.packages;
  o public.organisations;
  months int;
  period_from timestamptz;
begin
  select * into p from public.packages where organisation_id = p_org;
  if not found then
    select * into o from public.organisations where id = p_org;
    p := row(p_org, 'core', 27, 1, 2, 'monthly', coalesce(o.created_at, now()), 6, '', now())::public.packages;
  end if;
  if p.period = 'monthly' then
    months := (extract(year from age(now(), p.started_at)) * 12 + extract(month from age(now(), p.started_at)))::int;
    period_from := p.started_at + make_interval(months => months);
  else
    period_from := p.started_at;
  end if;
  return jsonb_build_object(
    'id', 'package-' || p_org, 'kind', p.kind, 'creativeCap', p.creative_cap, 'directionRounds', p.direction_rounds,
    'productionRounds', p.production_rounds, 'period', p.period, 'seatsIncluded', p.seats_included, 'scope', p.scope,
    'from', period_from, 'to', case when p.period = 'monthly' then period_from + interval '1 month' end);
end $$;

-- Fume's admin sets an organisation's package.
create or replace function public.set_package(
  p_organisation_id uuid, p_kind text, p_creative_cap int, p_period text default 'monthly',
  p_direction_rounds int default 1, p_production_rounds int default 2, p_seats_included int default 6,
  p_scope text default '', p_started_at timestamptz default now()
) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_admin() then perform app.fail('forbidden', 'Only Fume''s admins set a package.'); end if;
  if not exists (select 1 from public.organisations where id = p_organisation_id) then
    perform app.fail('not_found', 'No such organisation.');
  end if;
  insert into public.packages (organisation_id, kind, creative_cap, direction_rounds, production_rounds, period, started_at,
    seats_included, scope)
  values (p_organisation_id, p_kind, p_creative_cap, p_direction_rounds, p_production_rounds, p_period, p_started_at,
    p_seats_included, coalesce(p_scope, ''))
  on conflict (organisation_id) do update set kind = excluded.kind, creative_cap = excluded.creative_cap,
    direction_rounds = excluded.direction_rounds, production_rounds = excluded.production_rounds, period = excluded.period,
    started_at = excluded.started_at, seats_included = excluded.seats_included, scope = excluded.scope, updated_at = now();
  return app.package_of(p_organisation_id);
end $$;

-- The brand's package and what this period has used: creatives made since the period began (Fume's own corrections
-- are new versions, not new creatives, so they never count), and campaigns still open.
create or replace function public.package_usage(p_workspace_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  w public.workspaces;
  pkg jsonb;
begin
  if not app.can_read(p_workspace_id) then perform app.fail('not_found', 'No such brand.'); end if;
  select * into w from public.workspaces where id = p_workspace_id;
  pkg := app.package_of(w.organisation_id);
  return jsonb_build_object(
    'package', pkg,
    'usage', jsonb_build_object(
      'creativesUsed', (select count(*) from public.creatives c
                        where c.workspace_id = p_workspace_id and c.created_at >= (pkg ->> 'from')::timestamptz),
      'creativeCap', (pkg ->> 'creativeCap')::int,
      'campaignsActive', (select count(*) from public.campaigns c
                          where c.workspace_id = p_workspace_id and c.state not in ('draft', 'delivered', 'closed')),
      'periodEndsAt', pkg -> 'to'));
end $$;

-- The agency's licence: its period, what it covers, the creatives made and approved per client in the period, and
-- its seats.
create or replace function public.agency_licence() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  org uuid;
  pkg jsonb;
  since timestamptz;
  per jsonb;
begin
  select organisation_id into org from public.agency_seats where user_id = auth.uid();
  if org is null then perform app.fail('forbidden', 'Only an agency''s people see its licence.'); end if;
  pkg := app.package_of(org);
  since := (pkg ->> 'from')::timestamptz;
  select coalesce(jsonb_agg(jsonb_build_object(
           'workspaceId', w.id,
           'creativesMade', (select count(*) from public.creatives c where c.workspace_id = w.id and c.created_at >= since),
           'creativesApproved', (select count(distinct v.creative_id) from public.approvals a
                                 join public.creative_versions v on v.id = a.version_id
                                 where a.workspace_id = w.id and a.revoked_at is null and a.created_at >= since))
         order by w.brand_name), '[]')
    into per from public.workspaces w where w.agency_id = org;
  return jsonb_build_object(
    'package', pkg,
    'clients', per,
    'seats', jsonb_build_object('used', (select count(*) from public.agency_seats where organisation_id = org),
                                'included', (pkg ->> 'seatsIncluded')::int));
end $$;

-- ─── The team ────────────────────────────────────────────────────────────────

-- The owner changes what someone can do. Ownership itself is not handed over here: the owner stays the owner.
create or replace function public.change_role(p_workspace_id uuid, p_user_id uuid, p_role text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m public.memberships;
begin
  if not app.customer_is(p_workspace_id, array['owner']) then
    perform app.fail('forbidden', 'Only the owner changes what someone can do.');
  end if;
  if p_role not in ('approver', 'member', 'viewer') then perform app.fail('invalid', 'Choose approver, member or viewer.'); end if;
  if p_user_id = auth.uid() then perform app.fail('invalid', 'You stay the owner.'); end if;
  select * into m from public.memberships where workspace_id = p_workspace_id and user_id = p_user_id;
  if not found then perform app.fail('not_found', 'They are not on this brand.'); end if;
  if m.role = 'owner' then perform app.fail('forbidden', 'The owner stays the owner.'); end if;
  if m.role = p_role then return jsonb_build_object('userId', m.user_id, 'workspaceId', m.workspace_id, 'role', m.role); end if;
  update public.memberships set role = p_role where workspace_id = p_workspace_id and user_id = p_user_id;
  -- Someone who no longer approves is no longer a campaign's approver: the owner approves those until someone is named.
  if p_role not in ('approver') then
    update public.campaigns set approver_id = null where workspace_id = p_workspace_id and approver_id = p_user_id;
  end if;
  perform app.record(p_workspace_id, 'role.changed', 'membership', p_user_id, jsonb_build_object('from', m.role, 'to', p_role));
  return jsonb_build_object('userId', p_user_id, 'workspaceId', p_workspace_id, 'role', p_role);
end $$;

-- The owner takes someone off the brand; what they decided stays in the record. Their unanswered invitations to the
-- brand go too.
create or replace function public.remove_member(p_workspace_id uuid, p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m public.memberships;
  mail text;
begin
  if not app.customer_is(p_workspace_id, array['owner']) then
    perform app.fail('forbidden', 'Only the owner takes someone off the brand.');
  end if;
  if p_user_id = auth.uid() then perform app.fail('invalid', 'The owner stays on the brand.'); end if;
  select * into m from public.memberships where workspace_id = p_workspace_id and user_id = p_user_id;
  if not found then perform app.fail('not_found', 'They are not on this brand.'); end if;
  if m.role = 'owner' then perform app.fail('forbidden', 'The owner stays on the brand.'); end if;
  delete from public.memberships where workspace_id = p_workspace_id and user_id = p_user_id;
  update public.campaigns set approver_id = null where workspace_id = p_workspace_id and approver_id = p_user_id;
  select email into mail from public.profiles where id = p_user_id;
  update public.invitations set state = 'expired'
  where workspace_id = p_workspace_id and lower(email) = lower(mail) and state = 'sent';
  perform app.record(p_workspace_id, 'member.removed', 'membership', p_user_id, jsonb_build_object('role', m.role));
end $$;

-- The owner names the brand and says where its creatives run and in which language.
create or replace function public.update_workspace(
  p_workspace_id uuid, p_brand_name text default null, p_market text default null, p_language text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  w public.workspaces;
begin
  if not app.customer_is(p_workspace_id, array['owner']) then
    perform app.fail('forbidden', 'Only the owner changes the workspace.');
  end if;
  if p_brand_name is not null and trim(p_brand_name) = '' then perform app.fail('invalid', 'Give the brand its name.'); end if;
  update public.workspaces set
    brand_name = coalesce(nullif(trim(p_brand_name), ''), brand_name),
    market = coalesce(trim(p_market), market),
    language = coalesce(nullif(trim(p_language), ''), language)
  where id = p_workspace_id returning * into w;
  perform app.record(p_workspace_id, 'workspace.changed', 'workspace', p_workspace_id,
    jsonb_build_object('brand_name', w.brand_name, 'market', w.market, 'language', w.language));
  return jsonb_build_object('id', w.id, 'organisationId', w.organisation_id, 'brandName', w.brand_name, 'market', w.market,
    'language', w.language);
end $$;

revoke execute on function app.package_of(uuid) from public, anon, authenticated;
revoke execute on function public.set_package(uuid, text, int, text, int, int, int, text, timestamptz),
  public.package_usage(uuid), public.agency_licence(), public.change_role(uuid, uuid, text),
  public.remove_member(uuid, uuid), public.update_workspace(uuid, text, text, text) from public, anon;
grant execute on function public.set_package(uuid, text, int, text, int, int, int, text, timestamptz),
  public.package_usage(uuid), public.agency_licence(), public.change_role(uuid, uuid, text),
  public.remove_member(uuid, uuid), public.update_workspace(uuid, text, text, text) to authenticated;
