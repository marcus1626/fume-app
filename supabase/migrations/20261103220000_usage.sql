-- The Usage page, live: for each brand, what was made, approved and delivered this month, last month and the last
-- eight weeks, counted from the work itself. Fume's people see the brands they work on (an admin sees every Fume
-- customer), with the package and what the language model cost; an agency's people see the agency's clients, with
-- no package (they run on the agency's licence) and no cost. Renders come with the Engine; until then they are 0.

create or replace function app.usage_figures(ws uuid, p_from timestamptz, p_to timestamptz, with_cost boolean)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'creatives', (select count(*) from public.creatives c where c.workspace_id = ws and c.created_at >= p_from and c.created_at < p_to),
    'approved', (select count(distinct v.creative_id) from public.approvals a join public.creative_versions v on v.id = a.version_id
                 where a.workspace_id = ws and a.revoked_at is null and a.created_at >= p_from and a.created_at < p_to),
    'delivered', (select count(distinct i.creative_id) from public.delivery_items i join public.deliveries d on d.id = i.delivery_id
                  where d.workspace_id = ws and d.created_at >= p_from and d.created_at < p_to),
    'renders', 0,
    'cost', case when with_cost then (select coalesce(round(sum(t.cost_usd), 2), 0) from public.task_runs t
                                      where t.workspace_id = ws and t.started_at >= p_from and t.started_at < p_to)
                 else 0 end)
$$;

create or replace function public.usage_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  agency uuid;
  month_from timestamptz := date_trunc('month', now());
  week_from timestamptz := date_trunc('week', now()) - interval '7 weeks';
  week_to timestamptz := date_trunc('week', now()) + interval '1 week';
  out jsonb;
begin
  perform app.require_user();
  select organisation_id into agency from public.agency_seats where user_id = auth.uid();
  if agency is null and not app.is_admin()
     and not exists (select 1 from public.staff_assignments where user_id = auth.uid()) then
    perform app.fail('forbidden', 'The Usage page is for Fume''s people and agencies.');
  end if;
  with brands as (
    select w.* from public.workspaces w
    where case when agency is not null then w.agency_id = agency
               else w.agency_id is null and (app.is_admin() or app.is_staff(w.id, array['designer', 'account_manager'])) end
  ), rows as (
    select w.id, w.brand_name, w.organisation_id, w.created_at,
      app.usage_figures(w.id, month_from, month_from + interval '1 month', agency is null) as month,
      app.usage_figures(w.id, month_from - interval '1 month', month_from, agency is null) as last_month,
      app.usage_figures(w.id, week_from, week_to, agency is null) as weeks,
      case when agency is null then app.package_of(w.organisation_id) end as pkg
    from brands w
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'workspaceId', r.id,
      'renders', 0,
      'cost', (r.weeks ->> 'cost')::numeric,
      'creatives', (r.weeks ->> 'creatives')::int,
      'delivered', (r.weeks ->> 'delivered')::int,
      'trend', '[0,0,0,0,0,0,0,0]'::jsonb,
      'periods', jsonb_build_object('month', r.month, 'last_month', r.last_month, 'weeks', r.weeks),
      'package', case when r.pkg is not null then jsonb_build_object(
        'used', (select count(*) from public.creatives c where c.workspace_id = r.id and c.created_at >= (r.pkg ->> 'from')::timestamptz),
        'included', (r.pkg ->> 'creativeCap')::int,
        'renewsAt', r.pkg -> 'to') end,
      'example', 'full')
    order by r.brand_name), '[]')
  into out from rows r;
  return out;
end $$;

revoke execute on function app.usage_figures(uuid, timestamptz, timestamptz, boolean) from public, anon, authenticated;
revoke execute on function public.usage_overview() from public, anon;
grant execute on function public.usage_overview() to authenticated;
