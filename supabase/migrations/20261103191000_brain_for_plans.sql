-- The plan writer knows a campaign, not its brand: the Brand Brain bundle for a campaign, for the service only.
create or replace function public.brain_context_of_campaign(p_campaign_id uuid) returns jsonb
language sql security definer set search_path = '' as $$
  select public.brain_context(c.workspace_id, c.id) from public.campaigns c where c.id = p_campaign_id
$$;
revoke execute on function public.brain_context_of_campaign(uuid) from public, anon, authenticated;
grant execute on function public.brain_context_of_campaign(uuid) to service_role;
