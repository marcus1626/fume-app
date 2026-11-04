-- The copy lane (docs/mvp/brand-books.md): the plan writer writes the words in the brand's own Tone of Voice, and
-- every line of words is checked for claims before the plan is kept. The check is Fume's own reading: it is kept
-- on the run (staff only, like every run), never in the plan the customer reads.

-- The book of a kind Fume writes with: the approved one; else the newest an expert checked; else the newest draft.
create or replace function app.brand_book_in_use(p_workspace_id uuid, p_kind text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', b.id, 'version', b.version, 'state', b.state, 'body', b.body)
  from public.brand_books b
  where b.workspace_id = p_workspace_id and b.kind = p_kind and b.state in ('approved', 'checked', 'draft')
  order by case b.state when 'approved' then 0 when 'checked' then 1 else 2 end, b.version desc
  limit 1
$$;
revoke execute on function app.brand_book_in_use(uuid, text) from public, anon, authenticated;

-- The plan writer knows a campaign: the brand's Tone of Voice for it, without the sources and open gaps.
create or replace function public.brand_voice_of_campaign(p_campaign_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when v is null then null
    else jsonb_build_object('id', v -> 'id', 'version', v -> 'version', 'state', v -> 'state',
      'body', (v -> 'body') - 'sources' - 'gaps' - 'parts')
  end
  from public.campaigns c, lateral (select app.brand_book_in_use(c.workspace_id, 'voice') v) x
  where c.id = p_campaign_id
$$;
revoke execute on function public.brand_voice_of_campaign(uuid) from public, anon, authenticated;
grant execute on function public.brand_voice_of_campaign(uuid) to service_role;

-- What the claim check read in the plan's words, kept on the run before the plan is handed over.
alter table public.task_runs add column if not exists copy_check jsonb;

create or replace function public.fume_plan_copy_checked(p_run_id uuid, p_check jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  run public.task_runs;
begin
  if jsonb_typeof(p_check) is distinct from 'object' or jsonb_typeof(p_check -> 'lines') is distinct from 'array' then
    perform app.fail('invalid', 'A copy check names the lines it read.');
  end if;
  update public.task_runs set copy_check = p_check where id = p_run_id and kind = 'plan' and state = 'running'
  returning * into run;
  if not found then perform app.fail('not_found', 'No such plan being written.'); end if;
  perform app.record(run.workspace_id, 'plan.copy_checked', 'plan_version', run.subject_id,
    jsonb_build_object('lines', jsonb_array_length(p_check -> 'lines'), 'unbacked', coalesce((p_check ->> 'unbacked')::int, 0),
      'voice_book', p_check -> 'voice_book', 'campaign_id', run.campaign_id));
end $$;
revoke execute on function public.fume_plan_copy_checked(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.fume_plan_copy_checked(uuid, jsonb) to service_role;

-- The record follows what the reader may see (20261027130000): a customer never reads Fume's own readings (the
-- Engine's prompts and findings, the copy check), nor an event about a brand book they may not yet read.
drop policy if exists record_events_read on public.record_events;
create policy record_events_read on public.record_events for select to authenticated using (
  app.is_staff(workspace_id)
  or (
    app.can_read(workspace_id)
    and action not like 'engine.%' and action <> 'plan.copy_checked'
    and case subject_type
      when 'creative_version' then app.can_read_version(subject_id)
      when 'comment' then exists (select 1 from public.comments c where c.id = subject_id)
      when 'brand_book' then exists (select 1 from public.brand_books b where b.id = subject_id)
      when 'candidate' then false
      when 'production_job' then false
      when 'finding' then false
      when 'file' then false
      else true
    end
  )
);
