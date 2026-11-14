-- Keep the existing RPC and limits; own_area blocks only a room-for-words redo.
-- Crop reasons start with product-completeness: and still apply without words on the picture.
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
  -- Read the current Studio override: this attempt may have started before the designer changed it.
  if coalesce(btrim(p_reason), '') not like 'product-completeness:%'
    and (select coalesce(cr.words, (
        select pc ->> 'words'
        from public.context_snapshots s join public.plan_versions pv on pv.id = s.plan_version_id,
          jsonb_array_elements(coalesce(pv.body -> 'planned_creatives', '[]')) pc
        where s.id = j.snapshot_id and pc ->> 'id' = cr.slot
        limit 1), 'on_picture')
      from public.creatives cr where cr.id = j.creative_id) = 'own_area' then return false; end if;
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

