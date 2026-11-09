-- What the Engine's edge functions look up beside their task. The service role has no rights on the tables themselves,
-- so these reads went through the client and quietly found nothing (9 Nov 2026): the plan writer never saw the brand's
-- recent headlines or its column of words, and a redone design never found the layout it had before.

-- The plan writer: the brand's other recent headlines (newest first, one per campaign) and the layouts of its design
-- system in use (the column the words are set in).
create or replace function public.fume_plan_extras(p_campaign_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'recent', coalesce((
      select jsonb_agg(h.headline order by h.created_at desc)
      from (
        select x.headline, x.created_at from (
          select distinct on (p.campaign_id) p.campaign_id, p.created_at,
            (select l ->> 'value' from jsonb_array_elements(
                case when jsonb_typeof(p.body -> 'content') = 'array' then p.body -> 'content' else '[]'::jsonb end) l
              where concat(l ->> 'key', ' ', l ->> 'label') ~* 'headline|overskrift' limit 1) as headline
          from public.plan_versions p
          where p.workspace_id = c.workspace_id and p.campaign_id <> c.id and p.state <> 'superseded'
          order by p.campaign_id, p.created_at desc
        ) x where x.headline is not null order by x.created_at desc limit 12
      ) h), '[]'::jsonb),
    'layouts', coalesce(app.brand_book_in_use(c.workspace_id, 'design') #> '{body,onPictures,layouts}', '[]'::jsonb))
  from public.campaigns c
  where c.id = p_campaign_id
$$;
revoke execute on function public.fume_plan_extras(uuid) from public, anon, authenticated;
grant execute on function public.fume_plan_extras(uuid) to service_role;

-- The design layer: the layout chosen before for this picture's line (itself, then up its fixes). A designer's latest
-- ask set it last; without one, the line's first design is kept, so a redo (new words, a fixed label) looks the same.
create or replace function public.design_layout_before(p_layer_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  cand uuid;
  line uuid[] := '{}';
  i int := 0;
  pick jsonb;
begin
  select candidate_id into cand from public.design_layers where id = p_layer_id;
  while cand is not null and i < 5 loop
    line := line || cand;
    i := i + 1;
    select fixed_from into cand from public.candidates where id = cand;
  end loop;
  select d.choice into pick from public.design_layers d
  where d.candidate_id = any(line) and d.state = 'made' and d.id <> p_layer_id and d.ask is not null and d.choice is not null
  order by d.created_at desc limit 1;
  if pick is null then
    select d.choice into pick from public.design_layers d
    where d.candidate_id = any(line) and d.state = 'made' and d.id <> p_layer_id and d.choice is not null
    order by d.created_at asc limit 1;
  end if;
  return pick;
end $$;
revoke execute on function public.design_layout_before(uuid) from public, anon, authenticated;
grant execute on function public.design_layout_before(uuid) to service_role;
