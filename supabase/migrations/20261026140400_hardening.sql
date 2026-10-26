-- From Supabase's security advisor after the first deploy (26 Oct 2026).
-- 1. Pin the search path of the helpers that did not set it.
-- 2. Supabase's own rls_auto_enable() (the "automatic RLS" project setting) is an event-trigger function; nobody needs
--    to call it over the API.
-- The advisor also lists every command as "callable by signed-in users while SECURITY DEFINER". That is the design:
-- commands are the only way to write, and each checks the caller's role itself (20261026140200_commands.sql).

alter function app.uid() set search_path = '';
alter function app.fail(text, text) set search_path = '';
alter function app.customer_may_see_version(public.creative_versions) set search_path = '';
alter function app.require_user() set search_path = '';

do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
