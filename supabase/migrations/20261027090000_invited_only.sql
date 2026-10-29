-- Fume is invitation-only: an address without an invitation gets no account (the sign-in link is refused).

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
