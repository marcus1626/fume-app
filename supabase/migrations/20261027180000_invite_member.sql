-- Inviting someone to a brand from the app (Settings › Team). The brand's owner, Fume's account manager on the brand
-- or an admin invites an address with a role. What happens next depends on the address:
--   new     nobody has it yet: the invitation waits ('sent'), and the edge function `invite` sends the invitation
--           email, which creates the account (app.on_new_user turns the invitation into the membership);
--   invited the account exists but has never signed in (an earlier invitation): the membership is added now and the
--           invitation email goes again;
--   active  the person already uses Fume: the membership is added now, and the brand is in their list next time.
-- The edge function calls this as the person inviting, so these rules decide; it only sends the email.

create or replace function public.invite_member(
  p_workspace_id uuid, p_email text, p_role text, p_name text default null, p_title text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := app.require_user();
  address text := lower(trim(coalesce(p_email, '')));
  ws public.workspaces;
  inv public.invitations;
  person public.profiles;
  account text;
begin
  select * into ws from public.workspaces where id = p_workspace_id;
  if not found or not app.can_read(ws.id) then
    perform app.fail('not_found', 'No such brand.');
  end if;
  if not (app.customer_is(ws.id, array['owner']) or app.is_staff(ws.id, array['account_manager']) or app.is_admin()) then
    perform app.fail('forbidden', 'Only the brand''s owner, or Fume''s account manager, invites people.');
  end if;
  if p_role is null or p_role not in ('owner', 'approver', 'member', 'viewer') then
    perform app.fail('invalid', 'Choose what they can do.');
  end if;
  if p_role = 'owner' and not (app.is_staff(ws.id, array['account_manager']) or app.is_admin()) then
    perform app.fail('forbidden', 'Fume names a brand''s owners.');
  end if;
  if address !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    perform app.fail('invalid', 'That email address doesn''t look right.');
  end if;

  select * into person from public.profiles where lower(email) = address;
  if person.id is not null and exists (
    select 1 from public.memberships m where m.workspace_id = ws.id and m.user_id = person.id
  ) then
    perform app.fail('conflict', 'This person is already on the brand''s team.');
  end if;

  if person.id is null then
    account := 'new';
    -- Asking again for the same address sends the email again; the latest role counts.
    update public.invitations
    set role = p_role, invited_by = me, name = coalesce(nullif(trim(p_name), ''), name),
        title = coalesce(nullif(trim(p_title), ''), title), created_at = now()
    where workspace_id = ws.id and lower(email) = address and state = 'sent' and role is not null
    returning * into inv;
    if inv.id is null then
      insert into public.invitations (email, workspace_id, role, invited_by, name, title)
      values (address, ws.id, p_role, me, nullif(trim(p_name), ''), nullif(trim(p_title), ''))
      returning * into inv;
    end if;
  else
    account := case
      when exists (select 1 from auth.users u where u.id = person.id and u.last_sign_in_at is not null) then 'active'
      else 'invited'
    end;
    insert into public.memberships (user_id, workspace_id, role) values (person.id, ws.id, p_role);
    insert into public.invitations (email, workspace_id, role, invited_by, state)
    values (address, ws.id, p_role, me, 'accepted')
    returning * into inv;
  end if;

  perform app.record(ws.id, 'member.invited', 'invitation', inv.id,
    jsonb_build_object('email', address, 'role', p_role, 'account', account));
  return jsonb_build_object(
    'invitation', to_jsonb(inv),
    'account', account,
    'user_id', person.id,
    'brand_name', ws.brand_name,
    'inviter_name', (select p.name from public.profiles p where p.id = me)
  );
end $$;

revoke execute on function public.invite_member(uuid, text, text, text, text) from public, anon;
grant execute on function public.invite_member(uuid, text, text, text, text) to authenticated;
