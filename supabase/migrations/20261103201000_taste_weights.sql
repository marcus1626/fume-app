-- The taste model, second pass. Product pictures (packshots on white) count for less than scenes, so a shop full of
-- packshots does not become the brand's whole taste; the profile says what it learned from. A picture Fume could not
-- open is tried again after an hour.

create or replace function app.taste_sync(ws uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  d public.brand_dna_versions;
  x jsonb;
  seen text[] := '{}';
  r record;
  st text;
begin
  select * into d from public.brand_dna_versions where workspace_id = ws and state <> 'superseded' order by version desc limit 1;
  if found then
    for x in select * from jsonb_array_elements(coalesce(d.identity -> 'imagery', '[]')) loop
      continue when nullif(x ->> 'id', '') is null or nullif(x ->> 'image', '') is null;
      st := coalesce(x #>> '{provenance,state}', 'proposed');
      insert into public.taste_signals (workspace_id, verdict, weight, origin, reason, image_url, ref_table, ref_key)
      values (ws, case when st = 'removed' then 'disliked' else 'liked' end,
              (case when st = 'proposed' then 0.4 else 1 end) * (case when x ->> 'group' = 'product' then 0.3 else 1 end), 'brand_imagery', x ->> 'caption', x ->> 'image', 'identity', x ->> 'id')
      on conflict (workspace_id, ref_table, ref_key) do update set verdict = excluded.verdict, weight = excluded.weight,
        reason = excluded.reason, image_url = excluded.image_url,
        features = case when taste_signals.image_url is distinct from excluded.image_url then null else taste_signals.features end,
        measured_at = case when taste_signals.image_url is distinct from excluded.image_url then null else taste_signals.measured_at end;
      seen := seen || ('identity|' || (x ->> 'id'));
    end loop;
  end if;
  for r in select a.id, v.file_id from public.approvals a join public.creative_versions v on v.id = a.version_id
           where a.workspace_id = ws and a.revoked_at is null and v.file_id is not null loop
    insert into public.taste_signals (workspace_id, verdict, weight, origin, file_id, ref_table, ref_key)
    values (ws, 'liked', 2, 'approval', r.file_id, 'approvals', r.id::text)
    on conflict (workspace_id, ref_table, ref_key) do nothing;
    seen := seen || ('approvals|' || r.id);
  end loop;
  for r in select c.id, c.problem, v.file_id from public.change_requests c join public.creative_versions v on v.id = c.version_id
           where c.workspace_id = ws and c.source = 'customer' and v.file_id is not null loop
    insert into public.taste_signals (workspace_id, verdict, weight, origin, reason, file_id, ref_table, ref_key)
    values (ws, 'disliked', 1.5, 'change', r.problem, r.file_id, 'change_requests', r.id::text)
    on conflict (workspace_id, ref_table, ref_key) do update set reason = excluded.reason;
    seen := seen || ('change_requests|' || r.id);
  end loop;
  for r in select id, label, body from public.brain_nodes
           where workspace_id = ws and layer = 'taste' and ref_table is null and state <> 'removed' and body ->> 'image' ~ '^https?://' loop
    insert into public.taste_signals (workspace_id, verdict, weight, origin, reason, image_url, ref_table, ref_key)
    values (ws, case when (r.body ->> 'liked') = 'false' then 'disliked' else 'liked' end, 1, 'reference', r.label, r.body ->> 'image',
            'brain_nodes', r.id::text)
    on conflict (workspace_id, ref_table, ref_key) do update set verdict = excluded.verdict, reason = excluded.reason;
    seen := seen || ('brain_nodes|' || r.id);
  end loop;
  delete from public.taste_signals where workspace_id = ws and ref_table is not null and not (ref_table || '|' || ref_key = any (seen));
end $$;

create or replace function app.taste_profile(ws uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'measured_pictures', (select count(*) from public.taste_signals where workspace_id = ws and features is not null),
    'from', (select coalesce(jsonb_object_agg(o, n), '{}') from (select case when s.origin = 'brand_imagery' and s.weight < 0.4 then 'packshots'
              else s.origin end o, count(*) n from public.taste_signals s where s.workspace_id = ws and s.features is not null group by 1) c),
    'do', (select coalesce(jsonb_agg(jsonb_build_object('area', f.area, 'what', f.label || ': ' || v.words,
              'target', round(v.target::numeric, 2), 'range', jsonb_build_array(round(v.range_lo::numeric, 2), round(v.range_hi::numeric, 2)),
              'unit', f.unit, 'confidence', v.do_confidence, 'pictures', (v.liked ->> 'n')::int) order by v.do_confidence desc), '[]')
           from public.taste_variables v join app.taste_features f on f.key = v.key
           where v.workspace_id = ws and v.do_confidence >= 0.2),
    'dont', (select coalesce(jsonb_agg(jsonb_build_object('area', f.area, 'what', 'Avoid ' || v.avoid_words,
              'target', round(v.avoid_target::numeric, 2), 'unit', f.unit, 'confidence', v.avoid_confidence,
              'pictures', (v.disliked ->> 'n')::int) order by v.avoid_confidence desc), '[]')
           from public.taste_variables v join app.taste_features f on f.key = v.key
           where v.workspace_id = ws and v.avoid_confidence >= 0.2 and v.avoid_words is distinct from v.words),
    'reasons', (select coalesce(jsonb_agg(distinct reason), '[]') from public.taste_signals
                where workspace_id = ws and verdict = 'disliked' and nullif(trim(coalesce(reason, '')), '') is not null),
    'palette', (select coalesce(jsonb_agg(jsonb_build_object('hex', hex, 'share', round(share::numeric, 3)) order by share desc), '[]')
      from (select p ->> 'hex' hex, sum(s.weight * (p ->> 'share')::real) / nullif((select sum(weight) from public.taste_signals
                   where workspace_id = ws and verdict = 'liked' and palette is not null), 0) share
            from public.taste_signals s cross join lateral jsonb_array_elements(s.palette) p
            where s.workspace_id = ws and s.verdict = 'liked' and s.palette is not null
            group by 1 order by 2 desc limit 8) top)
  )
$$;

create or replace function public.taste_pending(p_workspace_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not app.can_read(p_workspace_id) then perform app.fail('not_found', 'No such brand.'); end if;
  perform app.taste_sync(p_workspace_id);
  return (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'url', s.image_url, 'bucket', fl.bucket, 'path', fl.path)), '[]')
    from (select * from public.taste_signals where workspace_id = p_workspace_id and (measured_at is null or (error is not null and measured_at < now() - interval '1 hour'))
          order by weight desc, created_at limit 24) s
    left join public.files fl on fl.id = s.file_id);
end $$;

