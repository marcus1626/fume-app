-- Continue where you left off: the furthest step (and, in "Confirm what Fume found", the furthest part) the brand's
-- people reached in the onboarding, and their word on each line of "What Fume understood". Kept on the workspace, so
-- leaving and coming back opens that step instead of step 1. Never moves back.

create table public.onboarding_progress (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  step text not null default '' check (step in ('', 'scan', 'review', 'taste')),
  part text check (part in ('logo', 'colour', 'type', 'imagery', 'voice')),
  lines jsonb not null default '[]',
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);
alter table public.onboarding_progress enable row level security;
create policy onboarding_progress_read on public.onboarding_progress for select to authenticated using (app.can_read(workspace_id));
grant select on public.onboarding_progress to authenticated;

create or replace function app.onboarding_of(ws uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_strip_nulls(jsonb_build_object('step', o.step, 'part', o.part, 'lines', o.lines))
     from public.onboarding_progress o where o.workspace_id = ws),
    jsonb_build_object('step', '', 'lines', '[]'::jsonb))
$$;

create or replace function public.save_onboarding_progress(
  p_workspace_id uuid, p_step text default null, p_part text default null, p_line jsonb default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  steps text[] := array['', 'scan', 'review', 'taste'];
  parts text[] := array['logo', 'colour', 'type', 'imagery', 'voice'];
  o public.onboarding_progress;
  now_i int;
  next_i int;
begin
  if not (app.customer_is(p_workspace_id, array['owner', 'approver', 'member']) or app.is_staff(p_workspace_id, array['designer', 'account_manager'])) then
    perform app.fail('forbidden', 'Only the brand''s people set up its Brand DNA.');
  end if;
  if p_step is not null and not (p_step = any (steps)) then perform app.fail('invalid', 'No such step.'); end if;
  if p_part is not null and not (p_part = any (parts)) then perform app.fail('invalid', 'No such part.'); end if;
  if p_line is not null and (nullif(p_line ->> 'id', '') is null or coalesce(p_line ->> 'verdict', '') not in ('right', 'not_quite')) then
    perform app.fail('invalid', 'Say right or not quite.');
  end if;
  insert into public.onboarding_progress (workspace_id) values (p_workspace_id) on conflict do nothing;
  select * into o from public.onboarding_progress where workspace_id = p_workspace_id for update;
  if p_step is not null then
    now_i := array_position(steps, o.step);
    next_i := array_position(steps, p_step);
    if next_i > now_i then
      o.step := p_step;
      o.part := case when p_step = 'review' then coalesce(p_part, parts[1]) end;
    elsif next_i = now_i and p_step = 'review' and p_part is not null
          and array_position(parts, p_part) > array_position(parts, coalesce(o.part, parts[1])) then
      o.part := p_part;
    end if;
  end if;
  if p_line is not null then
    o.lines := coalesce((select jsonb_agg(l) from jsonb_array_elements(o.lines) l where l ->> 'id' <> p_line ->> 'id'), '[]')
      || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('id', p_line ->> 'id', 'verdict', p_line ->> 'verdict',
           'reason', nullif(trim(coalesce(p_line ->> 'reason', '')), ''))));
  end if;
  update public.onboarding_progress set step = o.step, part = o.part, lines = o.lines, updated_by = auth.uid(), updated_at = now()
  where workspace_id = p_workspace_id;
  return app.onboarding_of(p_workspace_id);
end $$;

revoke execute on function app.onboarding_of(uuid) from public, anon, authenticated;
revoke execute on function public.save_onboarding_progress(uuid, text, text, jsonb) from public, anon;
grant execute on function public.save_onboarding_progress(uuid, text, text, jsonb) to authenticated;
