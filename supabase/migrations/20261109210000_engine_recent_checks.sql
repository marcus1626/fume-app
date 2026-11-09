-- The Engine learns from its own picture check (handler.ts seenLessons): what the check found on the brand's recent
-- pictures (waxy skin, surfaces too clean to be real, glow) goes to the next prompt as something to avoid. Anthem,
-- 9 Nov: 24 of 26 pictures had the same marks of a generated picture, and nothing carried that to the next one.
create or replace function public.engine_recent_checks(p_job_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(n.note order by n.at desc), '[]'::jsonb)
  from (
    select distinct on (lower(x.note)) x.note, x.at
    from (
      select c.created_at as at, jsonb_array_elements_text(c.evaluation -> 'artefactNotes') as note
      from public.candidates c
      where c.workspace_id = (select workspace_id from public.production_jobs where id = p_job_id)
        and c.origin = 'engine' and c.attempt_id is not null
        and jsonb_typeof(c.evaluation -> 'artefactNotes') = 'array'
        and c.created_at > now() - interval '30 days'
      order by c.created_at desc
      limit 12
    ) x
    where length(btrim(x.note)) between 12 and 240
    order by lower(x.note), x.at desc
  ) n
$$;
revoke execute on function public.engine_recent_checks(uuid) from public, anon, authenticated;
grant execute on function public.engine_recent_checks(uuid) to service_role;
