-- The Engine looks again at a job's pictures nobody has looked at yet: a look that failed (Anthem, 9 Nov: the brand's
-- product photos never reached the vision model, so none of its pictures was looked at), or one from before a fix.
create or replace function public.engine_unevaluated(p_job_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(distinct c.attempt_id), '[]')
  from public.candidates c
  where c.job_id = p_job_id and c.origin = 'engine' and c.evaluation is null and c.attempt_id is not null
$$;
revoke execute on function public.engine_unevaluated(uuid) from public, anon, authenticated;
grant execute on function public.engine_unevaluated(uuid) to service_role;
