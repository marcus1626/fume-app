-- Train the Engine: the deck in well under a second. The brands the caller works on are found once (not per picture),
-- and a card carries only what the check found wrong (the faults), not every part it read.

create or replace function public.train_cards(p_limit int default 60) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  cards jsonb;
begin
  if me is null then perform app.fail('forbidden', 'Sign in first.'); end if;
  with ws as (
    select w.id, w.brand_name from public.workspaces w where app.is_fume_staff(w.id)
  ), mine as (
    select e.source_candidate_id id from public.engine_lessons e where e.created_by = me and e.verdict is not null
  ), pick as (
    select x.id, x.workspace_id, ws.brand_name, x.created_at, x.file_id, j.campaign_id,
      coalesce(x.details, d.details) details,
      case when x.details is null and d.details is not null then d.id else x.id end details_of
    from public.candidates x
    join ws on ws.id = x.workspace_id
    join public.production_jobs j on j.id = x.job_id
    left join public.candidates d on d.id = x.designed_from
    where x.origin = 'engine' and not exists (select 1 from mine where mine.id = x.id)
    order by (coalesce(x.details, d.details) is not null) desc, x.created_at desc
    limit greatest(1, least(coalesce(p_limit, 60), 200))
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'workspace_id', p.workspace_id,
      'brand_name', p.brand_name,
      'made_at', p.created_at,
      'picture', jsonb_build_object('bucket', f.bucket, 'path', f.path, 'width', f.width, 'height', f.height),
      -- What the check found wrong; an empty list when it read the picture and found nothing; null when it never read it.
      'details', case when p.details is null then null else coalesce((
        select jsonb_agg(e) from jsonb_array_elements(p.details) e where (e ->> 'ok')::boolean is false), '[]') end,
      'details_of', p.details_of,
      'product', (
        select jsonb_build_object('name', pr.name, 'variant', nullif(pr.variant, ''),
          'bucket', pf.bucket, 'path', pf.path, 'url', case when pf.id is null then so.url end)
        from public.campaign_products cp
        join public.products pr on pr.id = cp.product_id
        join public.sources so on so.product_id = pr.id and so.kind = 'packshot'
        left join public.files pf on pf.id = so.file_id
        where cp.campaign_id = p.campaign_id
          and (pf.content_type like 'image/%' or (so.file_id is null and so.url ~ '^https://'))
        order by pr.name, case so.slot when 'front' then 0 when 'detail' then 1 when 'back' then 2 else 3 end, so.created_at desc
        limit 1),
      'labels', coalesce((
        select jsonb_agg(jsonb_build_object('detail', l.detail, 'verdict', l.verdict, 'note', l.note))
        from public.detail_labels l where l.candidate_id = p.id and l.created_by = me), '[]')
    ) order by (p.details is not null) desc, p.created_at desc), '[]') into cards
  from pick p
  join public.files f on f.id = p.file_id and f.content_type like 'image/%';
  return jsonb_build_object('cards', cards,
    'answered', (select count(*) from public.engine_lessons e where e.created_by = me and e.verdict is not null),
    'judged', (select count(*) from public.detail_labels l where l.created_by = me));
end $$;
revoke execute on function public.train_cards(int) from public, anon;
grant execute on function public.train_cards(int) to authenticated;
