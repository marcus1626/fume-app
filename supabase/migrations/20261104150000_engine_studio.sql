-- The Engine in the Studio (app/FLOWS.md §29, the design thread's handover of 4 Nov 2026): the prompt behind a version
-- is for Fume's own people only, never an agency's, and a person's Yes or No on one of the Engine's pictures is kept as
-- an answer that becomes a lesson for the brand. Only people's answers teach.

-- Fume's own people on a workspace: its staff, and no seat in an agency.
create or replace function app.is_fume_staff(ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_staff(ws) and app.my_agency() is null
$$;
revoke execute on function app.is_fume_staff(uuid) from public, anon;
grant execute on function app.is_fume_staff(uuid) to authenticated;

drop policy engine_prompts_read on public.engine_prompts;
create policy engine_prompts_read on public.engine_prompts for select to authenticated using (app.is_fume_staff(workspace_id));
drop policy engine_lessons_read on public.engine_lessons;
create policy engine_lessons_read on public.engine_lessons for select to authenticated using (app.is_fume_staff(workspace_id));

-- A person's answer is kept as it was given (verdict and why). It waits ('pending') until the Engine has turned it into
-- a lesson it can write from; only active lessons reach a prompt.
alter table public.engine_lessons
  add column verdict text check (verdict in ('yes', 'no')),
  add column why text,
  add column updated_at timestamptz not null default now();
alter table public.engine_lessons drop constraint engine_lessons_state_check;
alter table public.engine_lessons add constraint engine_lessons_state_check check (state in ('pending', 'active', 'retired'));
-- One answer per person and picture: the why updates the same answer.
create unique index engine_lessons_answer_idx on public.engine_lessons (source_candidate_id, created_by) where verdict is not null;

create or replace function public.teach_engine(p_candidate_id uuid, p_verdict text, p_why text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c record;
  why text := nullif(btrim(coalesce(p_why, '')), '');
  l public.engine_lessons;
begin
  select x.id, x.origin, j.workspace_id, s.recipe ->> 'image_model' as image_model into c
  from public.candidates x
  join public.production_jobs j on j.id = x.job_id
  left join public.context_snapshots s on s.id = j.snapshot_id
  where x.id = p_candidate_id;
  if c.id is null then perform app.fail('not_found', 'That picture is gone.'); end if;
  if not app.is_fume_staff(c.workspace_id) then perform app.fail('forbidden', 'Only Fume''s own team teaches the Engine.'); end if;
  if c.origin <> 'engine' then perform app.fail('invalid', 'Only the Engine''s pictures teach the Engine.'); end if;
  if p_verdict is null or p_verdict not in ('yes', 'no') then perform app.fail('invalid', 'The answer is yes or no.'); end if;
  if length(why) > 500 then perform app.fail('invalid', 'Keep the why under 500 characters.'); end if;

  insert into public.engine_lessons as e (workspace_id, statement, polarity, reason, scope, image_model, state,
    source_candidate_id, created_by, verdict, why)
  values (c.workspace_id,
    coalesce(why, case when p_verdict = 'yes' then 'A person said this picture is right.' else 'A person said this picture is wrong.' end),
    case when p_verdict = 'yes' then 'do' else 'avoid' end,
    coalesce(why, ''), 'brand', c.image_model, 'pending', c.id, auth.uid(), p_verdict, why)
  on conflict (source_candidate_id, created_by) where verdict is not null do update set
    verdict = excluded.verdict,
    polarity = excluded.polarity,
    -- A new answer without words keeps the words given before only when the answer is the same.
    why = case when excluded.why is not null then excluded.why when e.verdict = excluded.verdict then e.why end,
    statement = coalesce(case when excluded.why is not null then excluded.why when e.verdict = excluded.verdict then e.why end, excluded.statement),
    reason = coalesce(case when excluded.why is not null then excluded.why when e.verdict = excluded.verdict then e.why end, ''),
    state = 'pending',
    updated_at = now()
  returning * into l;
  return jsonb_build_object('id', l.id, 'candidate_id', l.source_candidate_id, 'verdict', l.verdict, 'why', l.why, 'state', l.state);
end $$;
revoke execute on function public.teach_engine(uuid, text, text) from public, anon;
grant execute on function public.teach_engine(uuid, text, text) to authenticated;
