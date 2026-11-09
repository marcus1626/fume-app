-- Train the Engine: each card names the picture whose close-ups the check kept, so a finding shows the part on the
-- picture beside the same part on the product.

create or replace function public.train_cards(p_limit int default 60) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  cards jsonb;
begin
  if me is null then perform app.fail('forbidden', 'Sign in first.'); end if;
  select coalesce(jsonb_agg(card order by checked desc, made desc), '[]') into cards from (
    select (x.details is not null or d.details is not null) checked, x.created_at made, jsonb_build_object(
      'id', x.id,
      'workspace_id', x.workspace_id,
      'brand_name', w.brand_name,
      'made_at', x.created_at,
      'picture', jsonb_build_object('bucket', f.bucket, 'path', f.path, 'width', f.width, 'height', f.height),
      'details', coalesce(x.details, d.details),
      -- The check's close-ups of each part sit under the picture it read: <ws>/check/<details_of>-<n>.png and -ref.png.
      'details_of', case when x.details is null and d.details is not null then d.id else x.id end,
      'product', (
        select jsonb_build_object('name', pr.name, 'variant', nullif(pr.variant, ''),
          'bucket', pf.bucket, 'path', pf.path, 'url', case when pf.id is null then so.url end)
        from public.campaign_products cp
        join public.products pr on pr.id = cp.product_id
        join public.sources so on so.product_id = pr.id and so.kind = 'packshot'
        left join public.files pf on pf.id = so.file_id
        where cp.campaign_id = j.campaign_id
          and (pf.content_type like 'image/%' or (so.file_id is null and so.url ~ '^https://'))
        order by pr.name, case so.slot when 'front' then 0 when 'detail' then 1 when 'back' then 2 else 3 end, so.created_at desc
        limit 1),
      'labels', coalesce((
        select jsonb_agg(jsonb_build_object('detail', l.detail, 'verdict', l.verdict, 'note', l.note))
        from public.detail_labels l where l.candidate_id = x.id and l.created_by = me), '[]')
    ) card
    from public.candidates x
    join public.production_jobs j on j.id = x.job_id
    join public.workspaces w on w.id = x.workspace_id
    join public.files f on f.id = x.file_id and f.content_type like 'image/%'
    left join public.candidates d on d.id = x.designed_from
    where x.origin = 'engine'
      and app.is_fume_staff(x.workspace_id)
      and not exists (select 1 from public.engine_lessons e where e.source_candidate_id = x.id and e.created_by = me and e.verdict is not null)
    order by checked desc, made desc
    limit greatest(1, least(coalesce(p_limit, 60), 200))
  ) q;
  return jsonb_build_object('cards', cards,
    'answered', (select count(*) from public.engine_lessons e where e.created_by = me and e.verdict is not null),
    'judged', (select count(*) from public.detail_labels l where l.created_by = me));
end $$;
revoke execute on function public.train_cards(int) from public, anon;
grant execute on function public.train_cards(int) to authenticated;
