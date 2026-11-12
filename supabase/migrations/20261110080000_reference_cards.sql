-- Reference cards (functions/_shared/engine/references.ts; Marcus, 10 Nov 2026: for a picture of a model from the
-- front the Engine picks only the references that angle needs, and Jev classifies which those are). A product's
-- pictures come from a web import with slots that say nothing ("site-3"), so each one is looked at once by a
-- classifier and its card is kept: what it is of (the product alone, on a person, in a scene), from where it is seen,
-- and how close. The Engine reads the cards when it chooses which pictures to send.
--
-- These are the Engine's workings: Fume's people on the brand read them, a customer never does. Only the edge
-- function `taste-read` writes them.

create table public.reference_cards (
  source_id uuid primary key references public.sources (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- {"of", "view", "crop"}, or {"unread": why} for a picture nobody could fetch, so it is not fetched again each time.
  card jsonb not null check (jsonb_typeof(card) = 'object'),
  -- The classifier that looked at it.
  reader text check (length(reader) <= 40),
  read_at timestamptz not null default now()
);
create index reference_cards_workspace on public.reference_cards (workspace_id);

alter table public.reference_cards enable row level security;
create policy reference_cards_read on public.reference_cards for select to authenticated using (app.is_staff(workspace_id));
grant select on public.reference_cards to authenticated;

-- The brand's product pictures with no card yet, the newest first, and how many there are in all. A slot's picture is
-- its newest source (as public.engine_take takes it); the older ones are history and are not read.
create or replace function public.reference_pictures(p_workspace_id uuid, p_limit int default 20) returns jsonb
language sql stable security definer set search_path = '' as $$
  with current as (
    select distinct on (so.product_id, coalesce(so.slot, so.id::text)) so.id, so.created_at, so.slot, pr.name as product,
      fi.bucket, fi.path, case when fi.id is null then so.url end as url
    from public.sources so
    join public.products pr on pr.id = so.product_id
    left join public.files fi on fi.id = so.file_id
    where so.workspace_id = p_workspace_id and so.kind = 'packshot'
      and (fi.content_type like 'image/%' or (fi.id is null and so.url like 'https://%'))
    order by so.product_id, coalesce(so.slot, so.id::text), so.created_at desc
  ), waiting as (
    select c.* from current c where not exists (select 1 from public.reference_cards rc where rc.source_id = c.id)
  )
  select jsonb_build_object(
    'waiting', (select count(*) from waiting),
    'pictures', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('source_id', x.id, 'product', x.product, 'slot', x.slot,
        'bucket', x.bucket, 'path', x.path, 'url', x.url)))
      from (select * from waiting order by created_at desc, id limit greatest(1, least(coalesce(p_limit, 20), 40))) x
    ), '[]'))
$$;

-- Keeps a picture's card. Looked at again, the new card replaces the old.
create or replace function public.reference_card_save(p_workspace_id uuid, p_source_id uuid, p_card jsonb, p_reader text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- A picture of another brand is never kept here.
  if not exists (select 1 from public.sources where id = p_source_id and workspace_id = p_workspace_id and kind = 'packshot') then
    perform app.fail('not_found', 'No such picture.');
  end if;
  if jsonb_typeof(p_card) is distinct from 'object' or not (p_card ? 'of' or p_card ? 'unread') then
    perform app.fail('invalid', 'A card says what the picture is of, or why it could not be read.');
  end if;
  insert into public.reference_cards (source_id, workspace_id, card, reader)
  values (p_source_id, p_workspace_id, p_card, left(nullif(p_reader, ''), 40))
  on conflict (source_id) do update set card = excluded.card, reader = excluded.reader, read_at = now();
end $$;

-- The cards of the pictures a job could send, by the picture's address (its path in Fume's storage, or its link), which
-- is how public.engine_take names a picture.
create or replace function public.engine_reference_cards(p_job_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(coalesce(fi.path, so.url), rc.card), '{}')
  from public.production_jobs j
  join public.campaign_products cp on cp.campaign_id = j.campaign_id
  join public.sources so on so.product_id = cp.product_id and so.kind = 'packshot'
  join public.reference_cards rc on rc.source_id = so.id
  left join public.files fi on fi.id = so.file_id
  where j.id = p_job_id and coalesce(fi.path, so.url) is not null and rc.card ? 'of'
$$;

revoke execute on function public.reference_pictures(uuid, int), public.reference_card_save(uuid, uuid, jsonb, text),
  public.engine_reference_cards(uuid) from public, anon, authenticated;
grant execute on function public.reference_pictures(uuid, int), public.reference_card_save(uuid, uuid, jsonb, text),
  public.engine_reference_cards(uuid) to service_role;
