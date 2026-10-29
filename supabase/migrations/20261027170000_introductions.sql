-- A person says who they are once, on their first sign-in: their name and job title, which sign what they decide in
-- Fume. Until then the app opens "About you" before anything else. The name starts from the invitation, then from
-- the Google account, and only then from the address (which "About you" does not offer as a name).
alter table public.profiles add column introduced_at timestamptz;

-- Everyone already in Fume has named themselves (or was named by Fume).
update public.profiles set introduced_at = now() where introduced_at is null;

create or replace function app.name_of(meta jsonb) returns text
language sql immutable set search_path = '' as $$
  select nullif(trim(coalesce(meta ->> 'full_name', meta ->> 'name', '')), '')
$$;

create or replace function app.on_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  inv record;
  staff text;
begin
  -- Only invited people get an account: Fume is invitation-only while it is internal.
  if not exists (select 1 from public.invitations i where lower(i.email) = lower(new.email) and i.state = 'sent') then
    raise exception 'No invitation for this address.' using errcode = 'P0001', detail = 'forbidden';
  end if;

  select i.staff_role into staff from public.invitations i
  where lower(i.email) = lower(new.email) and i.state = 'sent' and i.staff_role = 'admin' limit 1;

  insert into public.profiles (id, email, name, title, staff_role)
  values (
    new.id,
    new.email,
    coalesce(
      (select i.name from public.invitations i where lower(i.email) = lower(new.email) and i.name is not null limit 1),
      app.name_of(new.raw_user_meta_data),
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
    if inv.staff_role in ('designer', 'account_manager') then
      insert into public.staff_assignments (user_id, workspace_id, staff_role, can_check)
      values (new.id, inv.workspace_id, inv.staff_role, inv.can_check)
      on conflict (user_id, workspace_id, staff_role) do update set can_check = excluded.can_check;
    end if;
    update public.invitations set state = 'accepted' where id = inv.id;
  end loop;
  return new;
end $$;

-- Saving the name and title, the first time on "About you", is the introduction.
create or replace function public.update_profile(p_name text, p_title text) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles;
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = 'P0001', detail = 'forbidden'; end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Write your name.' using errcode = 'P0001', detail = 'invalid';
  end if;
  update public.profiles
  set name = trim(p_name), title = coalesce(trim(p_title), ''), introduced_at = coalesce(introduced_at, now())
  where id = auth.uid() returning * into me;
  return me;
end $$;

revoke execute on function public.update_profile(text, text) from public, anon;
grant execute on function public.update_profile(text, text) to authenticated;
revoke execute on function app.name_of(jsonb) from public, anon, authenticated;
