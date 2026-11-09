-- Train the Engine (Marcus, 6 Nov 2026): Fume's own people go through the Engine's pictures one at a time and say yes
-- or no, with why in their own words, because they have the eye and the experience. The same card shows what Fume's
-- check found on the product, and they say whether the check was right. A yes or no is the answer `teach_engine`
-- already keeps (it becomes a lesson for the brand); a word on the check is kept here, and the bench measures the
-- check against it.

create table public.detail_labels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  -- What the check said: a part's key ("front-buttons"), a print ("print:Dressmann"), or "none" (it found nothing).
  detail text not null check (length(detail) between 1 and 200),
  -- right: the check is right; wrong: it is not (a false alarm, or for "none" a fault it missed).
  verdict text not null check (verdict in ('right', 'wrong')),
  note text check (length(note) <= 500),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, detail, created_by)
);
create index detail_labels_workspace_idx on public.detail_labels (workspace_id);
alter table public.detail_labels enable row level security;
create policy detail_labels_read on public.detail_labels for select to authenticated using (app.is_fume_staff(workspace_id));
revoke all on public.detail_labels from anon;
grant select on public.detail_labels to authenticated;

-- The Engine's pictures the caller has not answered yet, on the brands they work on as Fume's own people: the ones the
-- check has read first (they also ask about the check), then the newest. Each card carries the picture, the product's
-- own photograph, what the check found, and the caller's words on the check so far. `answered` counts what they have
-- answered before.
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

-- A word on what the check found on one picture: right or wrong, and why. A null verdict takes the word back.
create or replace function public.judge_detail(p_candidate_id uuid, p_detail text, p_verdict text, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c public.candidates;
  note text := nullif(btrim(coalesce(p_note, '')), '');
  key text := nullif(btrim(coalesce(p_detail, '')), '');
  l public.detail_labels;
begin
  select * into c from public.candidates where id = p_candidate_id;
  if c.id is null then perform app.fail('not_found', 'That picture is gone.'); end if;
  if not app.is_fume_staff(c.workspace_id) then perform app.fail('forbidden', 'Only Fume''s own team trains the Engine.'); end if;
  if c.origin <> 'engine' then perform app.fail('invalid', 'Only the Engine''s pictures train the Engine.'); end if;
  if key is null or length(key) > 200 then perform app.fail('invalid', 'Say which finding this is about.'); end if;
  if length(note) > 500 then perform app.fail('invalid', 'Keep it under 500 characters.'); end if;
  if p_verdict is null then
    delete from public.detail_labels where candidate_id = c.id and detail = key and created_by = auth.uid();
    return null;
  end if;
  if p_verdict not in ('right', 'wrong') then perform app.fail('invalid', 'The check is right or wrong.'); end if;
  insert into public.detail_labels as e (workspace_id, candidate_id, detail, verdict, note, created_by)
  values (c.workspace_id, c.id, key, p_verdict, note, auth.uid())
  on conflict (candidate_id, detail, created_by) do update set
    verdict = excluded.verdict,
    -- New words replace the old; none keeps the old only when the answer is the same.
    note = case when excluded.note is not null then excluded.note when e.verdict = excluded.verdict then e.note end,
    updated_at = now()
  returning * into l;
  return jsonb_build_object('detail', l.detail, 'verdict', l.verdict, 'note', l.note);
end $$;
revoke execute on function public.judge_detail(uuid, text, text, text) from public, anon;
grant execute on function public.judge_detail(uuid, text, text, text) to authenticated;
