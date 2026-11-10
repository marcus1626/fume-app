-- The taste schema, kept (docs/mvp/taste-schema.md; Marcus, 10 Nov 2026: every picture of the brand analysed and
-- categorised, a taste score, and a schema that grows when the customer adds more). A reading is one picture read
-- against the schema: what code measured in it and what a vision model answered about it. A brand's readings together
-- give its taste profile, its taste score and the direction the Engine is told (functions/_shared/taste). The Engine's
-- own pictures for the brand are read against the same schema, so the profile also knows where the Engine missed.
--
-- These are the Engine's workings: Fume's people on the brand read them, a customer never does. Only the edge
-- function `taste-read` writes them.

create table public.taste_readings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- The brand's own picture, or one the Engine made for it.
  source text not null check (source in ('brand', 'engine')),
  -- Which picture, so reading it again replaces the reading: a taste signal's id, a file's id, or the name it came with.
  ref text not null check (length(ref) between 1 and 200),
  signal_id uuid references public.taste_signals (id) on delete cascade,
  file_id uuid references public.files (id) on delete cascade,
  title text check (length(title) <= 200),
  -- The campaign it belongs to, where known: a habit that follows the campaigns is the campaign's choice, not the brand's.
  campaign text check (length(campaign) <= 120),
  schema_version int not null check (schema_version > 0),
  -- The vision model that read it; none when it was only measured.
  reader text check (length(reader) <= 40),
  shows jsonb,
  measured jsonb not null default '{}' check (jsonb_typeof(measured) = 'object'),
  read jsonb not null default '{}' check (jsonb_typeof(read) = 'object'),
  -- The questions the reader could not answer, to ask again.
  failed jsonb not null default '[]' check (jsonb_typeof(failed) = 'array'),
  cost_usd numeric(10, 4) not null default 0 check (cost_usd >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, source, ref)
);
create index taste_readings_signal on public.taste_readings (signal_id);
create index taste_readings_file on public.taste_readings (file_id);

create table public.taste_profiles (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  schema_version int not null check (schema_version > 0),
  pictures int not null check (pictures >= 0),
  campaigns int not null check (campaigns >= 0),
  engine_pictures int not null default 0 check (engine_pictures >= 0),
  -- 0 to 100: how well Fume knows the brand's taste, and the parts it is made of.
  score int not null check (score between 0 and 100),
  score_parts jsonb not null,
  -- Field by field: what the brand does and how sure Fume is.
  profile jsonb not null,
  -- The same for the Engine's own pictures of the brand, once a round of them was read.
  engine jsonb,
  -- What the plan writer, the prompt and the finish step are told.
  direction jsonb not null,
  built_at timestamptz not null default now()
);

alter table public.taste_readings enable row level security;
alter table public.taste_profiles enable row level security;
create policy taste_readings_read on public.taste_readings for select to authenticated using (app.is_staff(workspace_id));
create policy taste_profiles_read on public.taste_profiles for select to authenticated using (app.is_staff(workspace_id));
grant select on public.taste_readings, public.taste_profiles to authenticated;

-- Keeps one reading. A picture read again replaces its reading; a half that is not sent (only measured, or only read)
-- keeps what was there.
create or replace function public.taste_reading_save(p_workspace_id uuid, p_reading jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  src text := p_reading ->> 'source';
  r text := nullif(btrim(coalesce(p_reading ->> 'ref', '')), '');
  sig uuid := nullif(p_reading ->> 'signal_id', '')::uuid;
  fl uuid := nullif(p_reading ->> 'file_id', '')::uuid;
  kept uuid;
begin
  if not exists (select 1 from public.workspaces where id = p_workspace_id) then perform app.fail('not_found', 'No such brand.'); end if;
  if src is null or src not in ('brand', 'engine') or r is null or length(r) > 200 then
    perform app.fail('invalid', 'A reading needs a source and a name for the picture.');
  end if;
  if coalesce((p_reading ->> 'schema_version')::int, 0) < 1 then perform app.fail('invalid', 'A reading needs the schema it was read against.'); end if;
  -- A picture of another brand is never kept here.
  if sig is not null and not exists (select 1 from public.taste_signals where id = sig and workspace_id = p_workspace_id) then
    perform app.fail('not_found', 'No such picture.');
  end if;
  if fl is not null and not exists (select 1 from public.files where id = fl and workspace_id = p_workspace_id) then
    perform app.fail('not_found', 'No such picture.');
  end if;
  insert into public.taste_readings (workspace_id, source, ref, signal_id, file_id, title, campaign, schema_version, reader,
    shows, measured, read, failed, cost_usd)
  values (p_workspace_id, src, r, sig, fl, left(nullif(btrim(coalesce(p_reading ->> 'title', '')), ''), 200),
    left(nullif(btrim(coalesce(p_reading ->> 'campaign', '')), ''), 120), (p_reading ->> 'schema_version')::int,
    left(nullif(p_reading ->> 'reader', ''), 40),
    case when jsonb_typeof(p_reading -> 'shows') = 'object' then p_reading -> 'shows' end,
    case when jsonb_typeof(p_reading -> 'measured') = 'object' then p_reading -> 'measured' else '{}' end,
    case when jsonb_typeof(p_reading -> 'read') = 'object' then p_reading -> 'read' else '{}' end,
    case when jsonb_typeof(p_reading -> 'failed') = 'array' then p_reading -> 'failed' else '[]' end,
    greatest(0, coalesce((p_reading ->> 'cost_usd')::numeric, 0)))
  on conflict (workspace_id, source, ref) do update set
    signal_id = coalesce(excluded.signal_id, public.taste_readings.signal_id),
    file_id = coalesce(excluded.file_id, public.taste_readings.file_id),
    title = coalesce(excluded.title, public.taste_readings.title),
    campaign = coalesce(excluded.campaign, public.taste_readings.campaign),
    schema_version = excluded.schema_version,
    reader = case when excluded.read <> '{}' then excluded.reader else public.taste_readings.reader end,
    shows = case when excluded.read <> '{}' then excluded.shows else public.taste_readings.shows end,
    measured = case when excluded.measured <> '{}' then excluded.measured else public.taste_readings.measured end,
    read = case when excluded.read <> '{}' then excluded.read else public.taste_readings.read end,
    failed = case when excluded.read <> '{}' then excluded.failed else public.taste_readings.failed end,
    cost_usd = public.taste_readings.cost_usd + excluded.cost_usd,
    updated_at = now()
  returning id into kept;
  return kept;
end $$;

-- A brand's readings as cards, the brand's own and the Engine's apart, for the profile to be counted from.
create or replace function public.taste_cards(p_workspace_id uuid, p_schema_version int) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'brand', coalesce(jsonb_agg(c.card order by c.created_at) filter (where c.source = 'brand'), '[]'),
    'engine', coalesce(jsonb_agg(c.card order by c.created_at) filter (where c.source = 'engine'), '[]'))
  from (
    select r.source, r.created_at, jsonb_strip_nulls(jsonb_build_object('id', r.ref, 'source', r.source, 'campaign', r.campaign,
      'shows', r.shows)) || jsonb_build_object('measured', r.measured, 'read', r.read) as card
    from public.taste_readings r
    where r.workspace_id = p_workspace_id and r.schema_version = p_schema_version
  ) c
$$;

-- Keeps the brand's profile as it was just counted.
create or replace function public.taste_profile_save(p_workspace_id uuid, p_built jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.workspaces where id = p_workspace_id) then perform app.fail('not_found', 'No such brand.'); end if;
  if jsonb_typeof(p_built -> 'profile') is distinct from 'object' or jsonb_typeof(p_built -> 'direction') is distinct from 'object'
     or jsonb_typeof(p_built -> 'score') is distinct from 'object' or (p_built -> 'profile' ->> 'pictures') is null
     or (p_built -> 'score' ->> 'score') is null then
    perform app.fail('invalid', 'A profile needs its fields, its score and its direction.');
  end if;
  insert into public.taste_profiles (workspace_id, schema_version, pictures, campaigns, engine_pictures, score, score_parts,
    profile, engine, direction)
  values (p_workspace_id, (p_built ->> 'schema_version')::int, (p_built -> 'profile' ->> 'pictures')::int,
    (p_built -> 'profile' ->> 'campaigns')::int, coalesce((p_built -> 'engine' ->> 'pictures')::int, 0),
    (p_built -> 'score' ->> 'score')::int, p_built -> 'score', p_built -> 'profile',
    case when jsonb_typeof(p_built -> 'engine') = 'object' then p_built -> 'engine' end, p_built -> 'direction')
  on conflict (workspace_id) do update set
    schema_version = excluded.schema_version, pictures = excluded.pictures, campaigns = excluded.campaigns,
    engine_pictures = excluded.engine_pictures, score = excluded.score, score_parts = excluded.score_parts,
    profile = excluded.profile, engine = excluded.engine, direction = excluded.direction, built_at = now();
end $$;

-- What the Engine is told of the brand's taste when it makes a picture, and what the plan writer is told when it
-- writes a plan: the direction of the brand's profile, or nothing until the brand has one.
create or replace function public.engine_taste(p_job_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select p.direction from public.production_jobs j join public.taste_profiles p on p.workspace_id = j.workspace_id
  where j.id = p_job_id
$$;
create or replace function public.taste_direction_of_campaign(p_campaign_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select p.direction from public.campaigns c join public.taste_profiles p on p.workspace_id = c.workspace_id
  where c.id = p_campaign_id
$$;

revoke execute on function public.taste_reading_save(uuid, jsonb), public.taste_cards(uuid, int), public.taste_profile_save(uuid, jsonb),
  public.engine_taste(uuid), public.taste_direction_of_campaign(uuid) from public, anon, authenticated;
grant execute on function public.taste_reading_save(uuid, jsonb), public.taste_cards(uuid, int), public.taste_profile_save(uuid, jsonb),
  public.engine_taste(uuid), public.taste_direction_of_campaign(uuid) to service_role;
