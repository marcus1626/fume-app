-- Lessons from people's answers (the feedback domain, docs/mvp/engine.md): before the Engine writes a prompt for a
-- brand, it turns the brand's answers that say why into at most three short lessons each, with the language model and
-- only from what the person said. The answer itself stays as it was given ('digested'); its lessons are rows of their
-- own (no verdict) that reach the next prompts. A changed answer is digested again and its old lessons retire.

alter table public.engine_lessons drop constraint engine_lessons_state_check;
alter table public.engine_lessons add constraint engine_lessons_state_check
  check (state in ('pending', 'digested', 'active', 'retired'));
alter table public.engine_lessons add column llm_usd numeric not null default 0;

-- The brand's answers that wait to be digested, oldest first, with the prompt behind each picture.
create or replace function public.engine_pending(p_workspace_id uuid, p_limit int default 3) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x order by x ->> 'updated_at'), '[]') from (
    select jsonb_build_object(
      'id', l.id,
      'verdict', l.verdict,
      'why', l.why,
      'image_model', l.image_model,
      'updated_at', l.updated_at,
      'concept', coalesce(p.compile_package #>> '{concept,sceneIdea}', p.compile_package #>> '{concept,title}', ''),
      'slots', coalesce(p.slots, '[]')
    ) as x
    from public.engine_lessons l
    left join public.candidates c on c.id = l.source_candidate_id
    left join public.engine_prompts p on p.attempt_id = c.attempt_id
    where l.workspace_id = p_workspace_id and l.state = 'pending' and l.verdict is not null and l.why is not null
    order by l.updated_at
    limit greatest(1, least(p_limit, 10))
  ) q
$$;
revoke execute on function public.engine_pending(uuid, int) from public, anon, authenticated;
grant execute on function public.engine_pending(uuid, int) to service_role;

-- An answer's lessons, as the language model wrote them from it. Only what the answer was given at the time counts: an
-- answer changed in the meantime is digested again.
create or replace function public.engine_digested(p_answer_id uuid, p_updated_at timestamptz, p_lessons jsonb, p_llm_usd numeric)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  a public.engine_lessons;
  item jsonb;
  n int := 0;
begin
  select * into a from public.engine_lessons where id = p_answer_id and verdict is not null for update;
  if a.id is null then perform app.fail('not_found', 'No such answer.'); end if;
  if a.state <> 'pending' or a.updated_at <> p_updated_at then return 0; end if;
  if jsonb_typeof(coalesce(p_lessons, '[]')) <> 'array' then perform app.fail('invalid', 'Lessons are a list.'); end if;
  update public.engine_lessons set state = 'retired'
  where source_candidate_id = a.source_candidate_id and created_by is not distinct from a.created_by
    and verdict is null and state = 'active';
  for item in select * from jsonb_array_elements(coalesce(p_lessons, '[]')) limit 3 loop
    if coalesce(btrim(item ->> 'statement'), '') = '' or length(item ->> 'statement') > 300
      or item ->> 'polarity' not in ('do', 'avoid') then continue; end if;
    insert into public.engine_lessons (workspace_id, statement, polarity, reason, scope, image_model, state,
      source_candidate_id, created_by)
    values (a.workspace_id, btrim(item ->> 'statement'), item ->> 'polarity', left(coalesce(item ->> 'reason', a.why), 500),
      case when item ->> 'scope' = 'brand_and_model' and a.image_model is not null then 'brand_and_model' else 'brand' end,
      case when item ->> 'scope' = 'brand_and_model' then a.image_model end, 'active', a.source_candidate_id, a.created_by);
    n := n + 1;
  end loop;
  update public.engine_lessons set state = 'digested', llm_usd = llm_usd + greatest(coalesce(p_llm_usd, 0), 0) where id = a.id;
  return n;
end $$;
revoke execute on function public.engine_digested(uuid, timestamptz, jsonb, numeric) from public, anon, authenticated;
grant execute on function public.engine_digested(uuid, timestamptz, jsonb, numeric) to service_role;

-- The language model's week counts digesting answers too.
create or replace function public.fume_llm_budget() returns jsonb
language sql stable security definer set search_path = '' as $$
  with spent as (
    select (
      coalesce((select sum(cost_usd) from public.task_runs where started_at > now() - interval '7 days'), 0)
      + coalesce((select sum(llm_usd) from public.engine_prompts where created_at > now() - interval '7 days'), 0)
      + coalesce((select sum(llm_usd) from public.engine_lessons where updated_at > now() - interval '7 days'), 0)
    )::numeric as usd
  ), cap as (
    select coalesce((select (value #>> '{}')::numeric from app.settings where key = 'llm_week_usd'), 0) as usd
  )
  select jsonb_build_object('spent_usd', spent.usd, 'cap_usd', cap.usd, 'allowed', spent.usd < cap.usd) from spent, cap
$$;
