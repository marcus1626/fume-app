-- The agency's own invitations get an email (edge function `invite`, agencyId): the command answers the agency's name
-- and who invited, for the email's words, as invite_member does for a brand.

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
  return to_jsonb(inv) || jsonb_build_object(
    'joined', who is not null,
    'agency_name', (select name from public.organisations where id = p_agency_id),
    'inviter_name', (select nullif(trim(name), '') from public.profiles where id = auth.uid()));
end $$;
