-- The Engine makes a picture once more when it left no room for the words (functions/engine/handler.ts makeRoom).
-- The prompt asks for bare ground where the brand sets its words (context.ts roomRules), and the picture check answers
-- whether the picture holds it. When every picture of an attempt says no, the words would cover the product: the job is
-- queued once more, and the next prompt is told what stood in the room. Once per job, never past the Engine's six
-- attempts or the week's budget; the pictures already made stay for the expert. Anthem, 10 Nov: six of eight pictures
-- had the product where the words go.

-- What filled the room on this attempt's pictures, when the job was made once more for it.
alter table public.job_attempts add column if not exists again text;

create or replace function public.engine_again(p_attempt_id uuid, p_reason text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  a public.job_attempts;
  j public.production_jobs;
begin
  select * into a from public.job_attempts where id = p_attempt_id for update;
  if not found or a.state <> 'succeeded' then return false; end if;
  select * into j from public.production_jobs where id = a.job_id for update;
  if j.mode <> 'engine' or j.state <> 'succeeded' then return false; end if;
  -- Only the job's newest attempt, once per job, and within the Engine's six attempts.
  if exists (select 1 from public.job_attempts x where x.job_id = j.id and x.number > a.number) then return false; end if;
  if exists (select 1 from public.job_attempts x where x.job_id = j.id and x.again is not null) then return false; end if;
  if a.number >= 6 then return false; end if;
  if not (public.fume_engine_budget() ->> 'allowed')::boolean then return false; end if;

  update public.job_attempts
  set again = left(coalesce(nullif(btrim(p_reason), ''), 'Something stood in the room kept for the words.'), 240)
  where id = a.id;
  update public.production_jobs set state = 'queued', error = null, updated_at = now() where id = j.id;
  perform app.record(j.workspace_id, 'job.again', 'production_job', j.id,
    jsonb_build_object('by', 'engine', 'attempt', a.number, 'why', 'room-for-words'));
  return true;
end $$;
revoke execute on function public.engine_again(uuid, text) from public, anon, authenticated;
grant execute on function public.engine_again(uuid, text) to service_role;

-- What the next prompt is told: what filled the room on the job's last picture, while that attempt is the newest one
-- with pictures.
create or replace function public.engine_again_note(p_job_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select a.again from public.job_attempts a
  where a.job_id = p_job_id and a.state = 'succeeded'
  order by a.number desc
  limit 1
$$;
revoke execute on function public.engine_again_note(uuid) from public, anon, authenticated;
grant execute on function public.engine_again_note(uuid) to service_role;
