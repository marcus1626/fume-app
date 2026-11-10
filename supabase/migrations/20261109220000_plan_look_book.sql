-- The plan writer reads the brand's Look Book (fume-plan lookPart and offLook).
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
    'scenes', coalesce((
      select jsonb_agg(s.scene order by s.created_at desc)
      from (
        select left(cr ->> 'scene', 300) as scene, x.created_at
        from (
          select distinct on (p.campaign_id) p.campaign_id, p.created_at, p.body
          from public.plan_versions p
          where p.workspace_id = c.workspace_id and p.campaign_id <> c.id and p.state <> 'superseded'
          order by p.campaign_id, p.created_at desc
        ) x,
        lateral jsonb_array_elements(case when jsonb_typeof(x.body -> 'directions') = 'array' then x.body -> 'directions' else '[]'::jsonb end) d,
        lateral jsonb_array_elements(case when jsonb_typeof(d -> 'creatives') = 'array' then d -> 'creatives' else '[]'::jsonb end) cr
        where d ->> 'id' = x.body ->> 'chosen_direction_id' and coalesce(cr ->> 'kind', 'master') = 'master'
          and coalesce(cr ->> 'scene', '') <> ''
        order by x.created_at desc limit 10
      ) s), '[]'::jsonb),
    'layouts', coalesce(app.brand_book_in_use(c.workspace_id, 'design') #> '{body,onPictures,layouts}', '[]'::jsonb),
    -- The brand's Look Book, so every planned picture is made in its light, with its camera, and never one of its
    -- never list (Anthem, 9 Nov: plans asked for golden hour and dusk the Look Book rules out).
    'look', (select jsonb_build_object(
        'summary', b -> 'summary', 'signature', b -> 'signature', 'light', b -> 'light',
        'camera', b -> 'camera', 'never', b -> 'never')
      from (select app.brand_book_in_use(c.workspace_id, 'look') -> 'body' as b) lb where lb.b is not null))
  from public.campaigns c
  where c.id = p_campaign_id
$$;
revoke execute on function public.fume_plan_extras(uuid) from public, anon, authenticated;
grant execute on function public.fume_plan_extras(uuid) to service_role;
