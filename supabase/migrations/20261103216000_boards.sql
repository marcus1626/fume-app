-- Moodboards (FLOWS §6): the brand's own moodboard and a campaign's, each a board of pictures, notes, swatches and
-- sections placed on a canvas. A picture she likes or does not, with her note, teaches Fume her taste (taste_sync).
-- The brand's people (not a viewer) and Fume's people on the brand change a board.

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null check (kind in ('brand_moodboard', 'campaign_moodboard', 'ideas', 'layout')),
  campaign_id uuid references public.campaigns (id) on delete cascade,
  name text not null,
  width int not null default 1100,
  height int not null default 900,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index boards_one_brand_moodboard on public.boards (workspace_id) where kind = 'brand_moodboard';
create unique index boards_one_campaign_moodboard on public.boards (campaign_id) where kind = 'campaign_moodboard';
create index on public.boards (created_by);

create table public.board_items (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null check (kind in ('image', 'note', 'section', 'creative', 'swatch')),
  x real not null default 0,
  y real not null default 0,
  w real not null default 320 check (w > 0),
  h real not null default 320 check (h > 0),
  image_url text,
  file_id uuid references public.files (id) on delete set null,
  text text,
  hex text check (hex is null or hex ~ '^#[0-9A-Fa-f]{6}$'),
  verdict text check (verdict in ('liked', 'disliked')),
  note text,
  origin text not null default 'customer' check (origin in ('customer', 'fume', 'engine')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index on public.board_items (board_id);
create index on public.board_items (workspace_id);
create index on public.board_items (file_id);
create index on public.board_items (created_by);

alter table public.campaigns add column board_id uuid references public.boards (id) on delete set null,
  add column moodboard_skipped boolean not null default false;
create index on public.campaigns (board_id);

alter table public.boards enable row level security;
alter table public.board_items enable row level security;
create policy boards_read on public.boards for select to authenticated using (app.can_read(workspace_id));
create policy board_items_read on public.board_items for select to authenticated using (app.can_read(workspace_id));
grant select on public.boards, public.board_items to authenticated;

create or replace function app.board_json(b uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object('id', bd.id, 'workspaceId', bd.workspace_id, 'kind', bd.kind, 'campaignId', bd.campaign_id,
    'name', bd.name, 'width', bd.width, 'height', bd.height, 'updatedAt', bd.updated_at))
  from public.boards bd where bd.id = b
$$;

-- The brand's own moodboard, made the first time someone asks for it.
create or replace function public.brand_moodboard(p_workspace_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  b uuid;
begin
  if not app.can_read(p_workspace_id) then perform app.fail('not_found', 'No such brand.'); end if;
  select id into b from public.boards where workspace_id = p_workspace_id and kind = 'brand_moodboard';
  if b is null then
    insert into public.boards (workspace_id, kind, name, created_by) values (p_workspace_id, 'brand_moodboard', 'Moodboard', auth.uid())
    on conflict do nothing;
    select id into b from public.boards where workspace_id = p_workspace_id and kind = 'brand_moodboard';
  end if;
  return app.board_json(b);
end $$;

create or replace function app.board_for_change(p_board uuid) returns public.boards
language plpgsql security definer set search_path = '' as $$
declare
  bd public.boards;
begin
  select * into bd from public.boards where id = p_board;
  if not found or not app.can_read(bd.workspace_id) then perform app.fail('not_found', 'No such board.'); end if;
  if not app.can_plan(bd.workspace_id) then perform app.fail('forbidden', 'Only the brand''s people change its moodboard.'); end if;
  return bd;
end $$;

-- The board grows to hold what is on it.
create or replace function app.board_touch(p_board uuid) returns void
language sql security definer set search_path = '' as $$
  update public.boards bd set updated_at = now(),
    width = greatest(bd.width, coalesce((select ceil(max(i.x + i.w)) + 40 from public.board_items i where i.board_id = bd.id), 0)::int),
    height = greatest(bd.height, coalesce((select ceil(max(i.y + i.h)) + 40 from public.board_items i where i.board_id = bd.id), 0)::int)
  where bd.id = p_board
$$;

create or replace function public.add_board_item(p_board_id uuid, p_item jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  bd public.boards;
  k text := p_item ->> 'kind';
  img text := nullif(p_item ->> 'image', '');
  fid uuid := nullif(p_item ->> 'fileId', '')::uuid;
  id_ uuid;
begin
  bd := app.board_for_change(p_board_id);
  if k is null or k not in ('image', 'note', 'section', 'creative', 'swatch') then perform app.fail('invalid', 'No such kind of item.'); end if;
  if k in ('image', 'creative') and img is null and fid is null then perform app.fail('invalid', 'Add the picture.'); end if;
  if img is not null and img !~ '^(https://|/)' then perform app.fail('invalid', 'Give the picture''s address.'); end if;
  if fid is not null and not exists (select 1 from public.files where id = fid and workspace_id = bd.workspace_id) then
    perform app.fail('not_found', 'No such picture.');
  end if;
  insert into public.board_items (board_id, workspace_id, kind, x, y, w, h, image_url, file_id, text, hex, verdict, note, origin, created_by)
  values (bd.id, bd.workspace_id, k, coalesce((p_item ->> 'x')::real, 40), coalesce((p_item ->> 'y')::real, 40),
    coalesce((p_item ->> 'w')::real, 320), coalesce((p_item ->> 'h')::real, 320), case when fid is null then img end, fid,
    nullif(p_item ->> 'text', ''), nullif(p_item ->> 'hex', ''), nullif(p_item ->> 'verdict', ''), nullif(trim(coalesce(p_item ->> 'note', '')), ''),
    case when app.is_staff(bd.workspace_id) then 'fume' else 'customer' end, auth.uid())
  returning id into id_;
  perform app.board_touch(bd.id);
  return id_;
end $$;

create or replace function public.update_board_item(p_item_id uuid, p_change jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  it public.board_items;
begin
  select * into it from public.board_items where id = p_item_id;
  if not found then perform app.fail('not_found', 'No such item.'); end if;
  perform app.board_for_change(it.board_id);
  if p_change ? 'verdict' and coalesce(p_change ->> 'verdict', '') not in ('', 'liked', 'disliked') then
    perform app.fail('invalid', 'Liked or not.');
  end if;
  update public.board_items set
    x = coalesce((p_change ->> 'x')::real, x), y = coalesce((p_change ->> 'y')::real, y),
    w = coalesce((p_change ->> 'w')::real, w), h = coalesce((p_change ->> 'h')::real, h),
    verdict = case when p_change ? 'verdict' then nullif(p_change ->> 'verdict', '') else verdict end,
    note = case when p_change ? 'note' then nullif(trim(coalesce(p_change ->> 'note', '')), '') else note end,
    text = case when p_change ? 'text' then p_change ->> 'text' else text end
  where id = p_item_id;
  perform app.board_touch(it.board_id);
end $$;

create or replace function public.remove_board_item(p_item_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  it public.board_items;
begin
  select * into it from public.board_items where id = p_item_id;
  if not found then perform app.fail('not_found', 'No such item.'); end if;
  perform app.board_for_change(it.board_id);
  delete from public.board_items where id = p_item_id;
  perform app.board_touch(it.board_id);
end $$;

-- A campaign's moodboard, started on the spot with these pictures in rows of three, liked by whoever started it.
create or replace function public.start_moodboard(p_campaign_id uuid, p_images jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c public.campaigns;
  b uuid;
  pic jsonb;
  n int := 0;
begin
  select * into c from public.campaigns where id = p_campaign_id;
  if not found or not app.can_read(c.workspace_id) then perform app.fail('not_found', 'No such campaign.'); end if;
  if not app.can_plan(c.workspace_id) then perform app.fail('forbidden', 'Only the brand''s people make its moodboard.'); end if;
  if c.board_id is not null then return app.board_json(c.board_id); end if;
  insert into public.boards (workspace_id, kind, campaign_id, name, created_by)
  values (c.workspace_id, 'campaign_moodboard', c.id, c.name || ' moodboard', auth.uid()) returning id into b;
  for pic in select * from jsonb_array_elements(coalesce(p_images, '[]')) loop
    perform public.add_board_item(b, jsonb_build_object('kind', 'image', 'x', 40 + (n % 3) * 340, 'y', 40 + (n / 3) * 405,
      'w', 320, 'h', 385, 'verdict', 'liked') || case when jsonb_typeof(pic) = 'string' then jsonb_build_object('image', pic #>> '{}') else pic end);
    n := n + 1;
  end loop;
  update public.campaigns set board_id = b, moodboard_skipped = false where id = c.id;
  perform app.record(c.workspace_id, 'moodboard.started', 'campaign', c.id, jsonb_build_object('pictures', n));
  return app.board_json(b);
end $$;

-- She goes on without a moodboard; Fume plans from the brief and the Brand DNA alone. It stays optional.
create or replace function public.skip_moodboard(p_campaign_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.campaigns;
begin
  select * into c from public.campaigns where id = p_campaign_id;
  if not found or not app.can_read(c.workspace_id) then perform app.fail('not_found', 'No such campaign.'); end if;
  if not (app.customer_is(c.workspace_id, array['owner', 'approver']) or app.is_staff(c.workspace_id, array['designer', 'account_manager'])) then
    perform app.fail('forbidden', 'Only who approves the campaign skips its moodboard.');
  end if;
  update public.campaigns set moodboard_skipped = true where id = c.id;
  perform app.record(c.workspace_id, 'moodboard.skipped', 'campaign', c.id, '{}');
end $$;

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
  -- Pictures on the brand's and its campaigns' moodboards that she liked or did not, with her note.
  for r in select i.id, i.verdict, i.note, i.image_url, i.file_id from public.board_items i
           where i.workspace_id = ws and i.kind = 'image' and i.verdict is not null and (i.file_id is not null or i.image_url is not null) loop
    insert into public.taste_signals (workspace_id, verdict, weight, origin, reason, image_url, file_id, ref_table, ref_key)
    values (ws, r.verdict, 1, 'board', r.note, case when r.file_id is null then r.image_url end, r.file_id, 'board_items', r.id::text)
    on conflict (workspace_id, ref_table, ref_key) do update set verdict = excluded.verdict, reason = excluded.reason;
    seen := seen || ('board_items|' || r.id);
  end loop;
  delete from public.taste_signals where workspace_id = ws and ref_table is not null and ref_table <> 'taste_cards'
    and not (ref_table || '|' || ref_key = any (seen));
end $$;



revoke execute on function app.board_json(uuid), app.board_for_change(uuid), app.board_touch(uuid) from public, anon, authenticated;
revoke execute on function public.brand_moodboard(uuid), public.add_board_item(uuid, jsonb), public.update_board_item(uuid, jsonb),
  public.remove_board_item(uuid), public.start_moodboard(uuid, jsonb), public.skip_moodboard(uuid) from public, anon;
grant execute on function public.brand_moodboard(uuid), public.add_board_item(uuid, jsonb), public.update_board_item(uuid, jsonb),
  public.remove_board_item(uuid), public.start_moodboard(uuid, jsonb), public.skip_moodboard(uuid) to authenticated;
