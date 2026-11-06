-- The picture from the person's Google account follows them into Fume, and kept current on each sign-in; a person
-- changes their own name and title (Settings > Profile). The title is the real job title on every check (F-D040).
alter table public.profiles add column avatar_url text;

create or replace function app.picture_of(meta jsonb) returns text
language sql immutable set search_path = '' as $$
  select nullif(coalesce(meta ->> 'avatar_url', meta ->> 'picture'), '')
$$;

-- Each sign-in can bring a new picture: copy it over when the account's metadata changes.
create or replace function app.on_user_updated() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if app.picture_of(new.raw_user_meta_data) is distinct from app.picture_of(old.raw_user_meta_data) then
    update public.profiles set avatar_url = app.picture_of(new.raw_user_meta_data) where id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated after update of raw_user_meta_data on auth.users
  for each row execute function app.on_user_updated();

-- A new account brings its picture too (on_new_user writes the profile first).
create or replace function app.on_user_created_picture() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set avatar_url = app.picture_of(new.raw_user_meta_data) where id = new.id;
  return new;
end $$;

drop trigger if exists on_auth_user_created_picture on auth.users;
create trigger on_auth_user_created_picture after insert on auth.users
  for each row execute function app.on_user_created_picture();

update public.profiles p set avatar_url = app.picture_of(u.raw_user_meta_data)
from auth.users u where u.id = p.id and p.avatar_url is null;

create or replace function public.update_profile(p_name text, p_title text) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles;
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = 'P0001', detail = 'forbidden'; end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Write your name.' using errcode = 'P0001', detail = 'invalid';
  end if;
  update public.profiles set name = trim(p_name), title = coalesce(trim(p_title), '')
  where id = auth.uid() returning * into me;
  return me;
end $$;

revoke execute on function public.update_profile(text, text) from public, anon;
grant execute on function public.update_profile(text, text) to authenticated;
revoke execute on function app.picture_of(jsonb), app.on_user_updated(), app.on_user_created_picture() from public, anon, authenticated;
