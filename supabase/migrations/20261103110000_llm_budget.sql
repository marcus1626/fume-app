-- A weekly ceiling on what Fume's language model may cost (Marcus, 3 Nov: at most $50 a week, ideally far less).
-- The edge functions ask before each call; over the ceiling they do not call the model, and the work goes on as it
-- does with the model off (a plan from the brief, written by Fume's designer).
insert into app.settings (key, value) values ('llm_week_usd', '50') on conflict (key) do nothing;

-- What the model cost in the last seven days, the ceiling, and whether one more call is allowed.
create or replace function public.fume_llm_budget() returns jsonb
language sql stable security definer set search_path = '' as $$
  with spent as (
    select coalesce(sum(cost_usd), 0)::numeric as usd from public.task_runs where started_at > now() - interval '7 days'
  ), cap as (
    select coalesce((select (value #>> '{}')::numeric from app.settings where key = 'llm_week_usd'), 0) as usd
  )
  select jsonb_build_object('spent_usd', spent.usd, 'cap_usd', cap.usd, 'allowed', spent.usd < cap.usd) from spent, cap
$$;
revoke execute on function public.fume_llm_budget() from public, anon, authenticated;
grant execute on function public.fume_llm_budget() to service_role;
