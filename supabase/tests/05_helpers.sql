-- Test helpers for every rule test file (tools/db/test.sh runs them in name order after the seed): sign in as a
-- person (test.act), keep ids by name (test.keep, test.id), and require a result (test.ok) or an error code
-- (test.refuses).

\set ON_ERROR_STOP 1
set client_min_messages = warning;

create schema test;
grant usage on schema test to authenticated;
create table test.ids (name text primary key, id uuid not null);
grant select, insert, update on test.ids to authenticated;

-- Sign a person in: create their auth user once (their invitations become access), then act as them.
create function test.signup(p_email text) returns uuid language plpgsql security definer as $$
declare uid uuid;
begin
  select id into uid from auth.users where email = p_email;
  if uid is null then insert into auth.users (email) values (p_email) returning id into uid; end if;
  return uid;
end $$;

create function test.act(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', test.signup(p_email), 'role', 'authenticated')::text, false);
end $$;

create function test.id(p_name text) returns uuid language sql stable as $$ select id from test.ids where name = p_name $$;
create function test.keep(p_name text, p_id uuid) returns uuid language sql as $$
  insert into test.ids values (p_name, p_id) on conflict (name) do update set id = excluded.id returning id
$$;

-- Run a statement and require it to fail with the contract's error code.
create function test.refuses(p_sql text, p_code text, p_what text) returns void language plpgsql as $$
declare d text; m text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics d = pg_exception_detail, m = message_text;
    if d is distinct from p_code then
      raise exception 'FAIL %: expected %, got % (%)', p_what, p_code, coalesce(d, 'no code'), m;
    end if;
    raise notice 'ok   %', p_what;
    return;
  end;
  raise exception 'FAIL %: expected %, but it succeeded', p_what, p_code;
end $$;

create function test.ok(p_cond boolean, p_what text) returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'FAIL %', p_what; end if;
  raise notice 'ok   %', p_what;
end $$;

grant execute on all functions in schema test to authenticated;

