-- The content calendar (FLOWS §21): a creative planned on a day in a placement. Campaigns (their span) and deliveries
-- come from their own tables; only the planned posts are kept here. The brand's people (not a viewer) and Fume's people
-- on the brand plan, move and take off; a customer plans only a creative she may see.

create table public.calendar_posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  creative_id uuid not null references public.creatives (id) on delete cascade,
  placement_id text not null,
  at timestamptz not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index on public.calendar_posts (workspace_id, at);
create index on public.calendar_posts (creative_id);
create index on public.calendar_posts (created_by);
alter table public.calendar_posts enable row level security;
-- A post is read with its creative: who may not see the creative does not see it planned either.
create policy calendar_posts_read on public.calendar_posts for select to authenticated using (
  app.can_read(workspace_id) and exists (select 1 from public.creatives c where c.id = creative_id)
);
grant select on public.calendar_posts to authenticated;

create or replace function app.can_plan(ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.customer_is(ws, array['owner', 'approver', 'member']) or app.is_staff(ws, array['designer', 'account_manager'])
$$;

create or replace function app.post_json(p public.calendar_posts) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'workspaceId', p.workspace_id, 'kind', 'post', 'creativeId', p.creative_id,
    'placementId', p.placement_id, 'start', p.at, 'campaignId', c.campaign_id, 'title', c.title)
  from public.creatives c where c.id = p.creative_id
$$;

create or replace function public.schedule_post(p_creative_id uuid, p_placement_id text, p_at timestamptz) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  ws uuid;
  p public.calendar_posts;
begin
  -- As the caller: a creative she may not see is no creative to her.
  select workspace_id into ws from public.creatives where id = p_creative_id;
  if ws is null then perform app.fail('not_found', 'No such creative.'); end if;
  if not app.can_plan(ws) then perform app.fail('forbidden', 'Only the brand''s people plan the calendar.'); end if;
  if nullif(trim(coalesce(p_placement_id, '')), '') is null then perform app.fail('invalid', 'Choose where it runs.'); end if;
  if p_at is null then perform app.fail('invalid', 'Choose the day.'); end if;
  p := app.insert_post(ws, p_creative_id, trim(p_placement_id), p_at);
  return app.post_json(p);
end $$;

create or replace function app.insert_post(ws uuid, creative uuid, placement text, at timestamptz) returns public.calendar_posts
language plpgsql security definer set search_path = '' as $$
declare
  p public.calendar_posts;
begin
  insert into public.calendar_posts (workspace_id, creative_id, placement_id, at, created_by)
  values (ws, creative, placement, at, auth.uid()) returning * into p;
  perform app.record(ws, 'post.planned', 'creative', creative, jsonb_build_object('placement', placement, 'at', at));
  return p;
end $$;

create or replace function public.move_post(p_post_id uuid, p_at timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.calendar_posts;
begin
  select * into p from public.calendar_posts where id = p_post_id;
  if not found or not app.can_read(p.workspace_id) then perform app.fail('not_found', 'No such post.'); end if;
  if not app.can_plan(p.workspace_id) then perform app.fail('forbidden', 'Only the brand''s people plan the calendar.'); end if;
  if p_at is null then perform app.fail('invalid', 'Choose the day.'); end if;
  update public.calendar_posts set at = p_at where id = p_post_id returning * into p;
  perform app.record(p.workspace_id, 'post.moved', 'creative', p.creative_id, jsonb_build_object('at', p_at));
  return app.post_json(p);
end $$;

create or replace function public.remove_post(p_post_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.calendar_posts;
begin
  select * into p from public.calendar_posts where id = p_post_id;
  if not found or not app.can_read(p.workspace_id) then perform app.fail('not_found', 'No such post.'); end if;
  if not app.can_plan(p.workspace_id) then perform app.fail('forbidden', 'Only the brand''s people plan the calendar.'); end if;
  delete from public.calendar_posts where id = p_post_id;
  perform app.record(p.workspace_id, 'post.removed', 'creative', p.creative_id, '{}');
end $$;

revoke execute on function app.can_plan(uuid), app.post_json(public.calendar_posts),
  app.insert_post(uuid, uuid, text, timestamptz) from public, anon;
grant execute on function app.can_plan(uuid), app.post_json(public.calendar_posts),
  app.insert_post(uuid, uuid, text, timestamptz) to authenticated;
revoke execute on function public.schedule_post(uuid, text, timestamptz), public.move_post(uuid, timestamptz),
  public.remove_post(uuid) from public, anon;
grant execute on function public.schedule_post(uuid, text, timestamptz), public.move_post(uuid, timestamptz),
  public.remove_post(uuid) to authenticated;
