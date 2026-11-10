-- The Engine looks at its own pictures (Marcus's motor: "render; analyse the image"). Right after a picture is kept,
-- a vision model checks it against what its prompt had to carry: the product's verified facts and colours, the brand's
-- rules and the lessons people taught. The result is the candidate's evaluation, for Fume's people and the expert who
-- checks it; it never replaces the expert's check, and customers see none of it.

alter table public.candidates
  add column evaluation jsonb,
  add column evaluation_usd numeric not null default 0;

-- The pictures of an attempt that wait to be looked at, with the checklist of the prompt behind them.
create or replace function public.engine_to_evaluate(p_attempt_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'candidates', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'path', f.path, 'width', f.width, 'height', f.height) order by c.created_at)
      from public.candidates c join public.files f on f.id = c.file_id
      where c.attempt_id = p_attempt_id and c.origin = 'engine' and c.evaluation is null
    ), '[]'),
    'manifest', coalesce((select p.compile_package -> 'manifest' from public.engine_prompts p where p.attempt_id = p_attempt_id
      order by p.created_at desc limit 1), '[]'),
    'references', coalesce((select p.compile_package -> 'references' from public.engine_prompts p where p.attempt_id = p_attempt_id
      order by p.created_at desc limit 1), '[]')
  )
$$;
revoke execute on function public.engine_to_evaluate(uuid) from public, anon, authenticated;
grant execute on function public.engine_to_evaluate(uuid) to service_role;

create or replace function public.engine_evaluated(p_candidate_id uuid, p_evaluation jsonb, p_llm_usd numeric) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if jsonb_typeof(p_evaluation) <> 'object'
    or p_evaluation ->> 'productTruth' not in ('pass', 'flag')
    or p_evaluation ->> 'brandRules' not in ('pass', 'flag')
    or p_evaluation ->> 'artefacts' not in ('none', 'minor', 'major')
    or jsonb_typeof(p_evaluation -> 'notes') <> 'array' then
    perform app.fail('invalid', 'An evaluation says product truth, brand rules, artefacts and notes.');
  end if;
  update public.candidates set evaluation = p_evaluation, evaluation_usd = greatest(coalesce(p_llm_usd, 0), 0)
  where id = p_candidate_id and origin = 'engine';
  if not found then perform app.fail('not_found', 'No such picture of the Engine.'); end if;
end $$;
revoke execute on function public.engine_evaluated(uuid, jsonb, numeric) from public, anon, authenticated;
grant execute on function public.engine_evaluated(uuid, jsonb, numeric) to service_role;

-- The language model's week counts looking at the pictures too.
create or replace function public.fume_llm_budget() returns jsonb
language sql stable security definer set search_path = '' as $$
  with spent as (
    select (
      coalesce((select sum(cost_usd) from public.task_runs where started_at > now() - interval '7 days'), 0)
      + coalesce((select sum(llm_usd) from public.engine_prompts where created_at > now() - interval '7 days'), 0)
      + coalesce((select sum(llm_usd) from public.engine_lessons where updated_at > now() - interval '7 days'), 0)
      + coalesce((select sum(evaluation_usd) from public.candidates where created_at > now() - interval '7 days'), 0)
    )::numeric as usd
  ), cap as (
    select coalesce((select (value #>> '{}')::numeric from app.settings where key = 'llm_week_usd'), 0) as usd
  )
  select jsonb_build_object('spent_usd', spent.usd, 'cap_usd', cap.usd, 'allowed', spent.usd < cap.usd) from spent, cap
$$;
