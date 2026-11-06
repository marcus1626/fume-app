-- A surgical fix copies the product's own part (docs/mvp/picture-fix.md): before the image model redraws, the language
-- model finds where the marked part shows best on the product's own photographs, and the design service crops it
-- close, so the model reads the real label letter for letter. The language model's cost counts in its week.

alter table public.picture_fixes
  add column llm_usd numeric(10, 6) not null default 0 check (llm_usd >= 0),
  add column reference jsonb;

comment on column public.picture_fixes.reference is
  'Where the part shows on the product''s own photograph: {"photo": n, "box": {x,y,w,h}, "why": text}, or null when none shows it.';

-- The fix function records what finding the reference cost and where it was found, whatever happens after.
create or replace function public.fix_spent(p_fix_id uuid, p_llm_usd numeric, p_reference jsonb) returns void
language sql security definer set search_path = '' as $$
  update public.picture_fixes set llm_usd = llm_usd + greatest(coalesce(p_llm_usd, 0), 0),
    reference = coalesce(p_reference, reference)
  where id = p_fix_id and state = 'fixing'
$$;
revoke execute on function public.fix_spent(uuid, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.fix_spent(uuid, numeric, jsonb) to service_role;

create or replace function public.fume_llm_budget() returns jsonb
language sql stable security definer set search_path = '' as $$
  with spent as (
    select (
      coalesce((select sum(cost_usd) from public.task_runs where started_at > now() - interval '7 days'), 0)
      + coalesce((select sum(llm_usd) from public.engine_prompts where created_at > now() - interval '7 days'), 0)
      + coalesce((select sum(llm_usd) from public.engine_lessons where updated_at > now() - interval '7 days'), 0)
      + coalesce((select sum(evaluation_usd) from public.candidates where created_at > now() - interval '7 days'), 0)
      + coalesce((select sum(llm_usd) from public.brand_books where created_at > now() - interval '7 days'), 0)
      + coalesce((select sum(llm_usd) from public.design_layers where created_at > now() - interval '7 days'), 0)
      + coalesce((select sum(llm_usd) from public.picture_fixes where created_at > now() - interval '7 days'), 0)
    )::numeric as usd
  ), cap as (
    select coalesce((select (value #>> '{}')::numeric from app.settings where key = 'llm_week_usd'), 0) as usd
  )
  select jsonb_build_object('spent_usd', spent.usd, 'cap_usd', cap.usd, 'allowed', spent.usd < cap.usd) from spent, cap
$$;
