-- The Brand DNA board on real data (FLOWS §2, §7): the identity Fume read (logos, colours, typefaces, voice lines,
-- pictures, the voice book) is kept on the Brand DNA version as the contract's BrandIdentity, each item with its
-- provenance. The website reading (edge function brand-scan) proposes; only the customer keeps, changes or removes,
-- and approves. A change after approval goes into a new draft version; the approved one stays in use until then.

alter table public.brand_dna_versions
  add column identity jsonb not null default '{"colours": [], "typefaces": [], "logos": [], "voice": [], "imagery": []}';

-- One reading of the brand: what was read and what was found (the onboarding's animation, and "Read again").
create table public.brand_scans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  source text not null default 'website' check (source in ('website', 'upload', 'both')),
  url text,
  files text[] not null default '{}',
  state text not null default 'done' check (state in ('reading', 'done', 'failed')),
  sources jsonb not null default '[]',
  finds jsonb not null default '[]',
  error text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index on public.brand_scans (workspace_id, created_at desc);
create index on public.brand_scans (created_by);
alter table public.brand_scans enable row level security;
create policy brand_scans_read on public.brand_scans for select to authenticated using (app.can_read(workspace_id));
grant select on public.brand_scans to authenticated;

-- ─── Helpers ─────────────────────────────────────────────────────────────────

-- Who may put what Fume read into the brand: the people who run it (Fume's or the agency's) and its owner or approver.
create or replace function app.brand_writer(ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_staff(ws, array['designer', 'account_manager']) or app.customer_is(ws, array['owner', 'approver'])
$$;

-- The version that takes changes: the newest draft, else a new draft copied from the approved one (its rules too).
create or replace function app.draft_dna(ws uuid) returns public.brand_dna_versions
language plpgsql security definer set search_path = '' as $$
declare
  d public.brand_dna_versions;
  n public.brand_dna_versions;
begin
  select * into d from public.brand_dna_versions where workspace_id = ws and state <> 'superseded'
  order by version desc limit 1 for update;
  if found and d.state in ('draft', 'in_review') then return d; end if;
  insert into public.brand_dna_versions (workspace_id, version, state, identity)
  values (ws, coalesce(d.version, 0) + 1, 'draft',
          coalesce(d.identity, '{"colours": [], "typefaces": [], "logos": [], "voice": [], "imagery": []}'))
  returning * into n;
  if d.id is not null then
    insert into public.brand_rules (workspace_id, brand_dna_version_id, area, statement, kind, source_id)
    select workspace_id, n.id, area, statement, kind, source_id from public.brand_rules where brand_dna_version_id = d.id;
  end if;
  return n;
end $$;

create or replace function app.identity_key(p_kind text) returns text
language sql immutable set search_path = '' as $$
  select case p_kind when 'colour' then 'colours' when 'typeface' then 'typefaces' when 'logo' then 'logos'
    when 'voice' then 'voice' when 'image' then 'imagery' end
$$;

-- Every item gets an id and a provenance (proposed, by the Engine, unless it says otherwise).
create or replace function app.identity_items(p_items jsonb) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(
    x || jsonb_build_object(
      'id', coalesce(nullif(x ->> 'id', ''), gen_random_uuid()::text),
      'provenance', jsonb_build_object('origin', 'engine', 'state', 'proposed') || coalesce(x -> 'provenance', '{}'))
  ), '[]')
  from jsonb_array_elements(coalesce(p_items, '[]')) x
$$;

revoke execute on function app.brand_writer(uuid), app.draft_dna(uuid) from public, anon;

-- ─── What Fume read ──────────────────────────────────────────────────────────

-- A reading of the website or files: what she already decided stays; Fume's open proposals give way to the new ones.
create or replace function public.save_brand_scan(
  p_workspace_id uuid, p_url text, p_identity jsonb, p_sources jsonb default '[]', p_finds jsonb default '[]',
  p_error text default null, p_source text default 'website', p_files text[] default '{}'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  d public.brand_dna_versions;
  k text;
  merged jsonb;
  s public.brand_scans;
begin
  perform app.require_user();
  if not app.can_read(p_workspace_id) then perform app.fail('not_found', 'No such brand.'); end if;
  if not app.brand_writer(p_workspace_id) then
    perform app.fail('forbidden', 'Only the brand''s owner or approver, or the people who run it, read the brand in.');
  end if;
  if p_error is null then
    d := app.draft_dna(p_workspace_id);
    merged := d.identity;
    foreach k in array array['colours', 'typefaces', 'logos', 'voice', 'imagery'] loop
      merged := jsonb_set(merged, array[k], (
        select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(coalesce(d.identity -> k, '[]')) x
        where x #>> '{provenance,state}' <> 'proposed'
      ) || app.identity_items(p_identity -> k));
    end loop;
    if p_identity ? 'voiceBook' then merged := merged || jsonb_build_object('voiceBook', p_identity -> 'voiceBook'); end if;
    update public.brand_dna_versions set identity = merged where id = d.id;
    if nullif(trim(coalesce(p_url, '')), '') is not null and not exists (
      select 1 from public.sources where workspace_id = p_workspace_id and kind = 'website' and url = trim(p_url)
    ) then
      insert into public.sources (workspace_id, kind, name, url, retrieved_at, created_by)
      values (p_workspace_id, 'website', regexp_replace(trim(p_url), '^https?://', ''), trim(p_url), now(), auth.uid());
    end if;
  end if;
  insert into public.brand_scans (workspace_id, source, url, files, state, sources, finds, error, created_by)
  values (p_workspace_id, coalesce(p_source, 'website'), nullif(trim(coalesce(p_url, '')), ''), coalesce(p_files, '{}'),
          case when p_error is null then 'done' else 'failed' end, coalesce(p_sources, '[]'), coalesce(p_finds, '[]'),
          p_error, auth.uid())
  returning * into s;
  perform app.record(p_workspace_id, 'brand.read', 'workspace', p_workspace_id,
    jsonb_build_object('scan', s.id, 'url', s.url, 'finds', jsonb_array_length(s.finds), 'failed', p_error is not null));
  return to_jsonb(s);
end $$;

-- One item put in by hand (a logo, a colour, a typeface, a voice line, a picture): proposed, for the customer to keep.
create or replace function public.add_identity_item(p_workspace_id uuid, p_kind text, p_item jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  d public.brand_dna_versions;
  k text := app.identity_key(p_kind);
  item jsonb;
begin
  perform app.require_user();
  if not app.can_read(p_workspace_id) then perform app.fail('not_found', 'No such brand.'); end if;
  if not app.brand_writer(p_workspace_id) then perform app.fail('forbidden', 'Only the people who run the brand add to it.'); end if;
  if k is null or jsonb_typeof(p_item) <> 'object' then perform app.fail('invalid', 'Say what to add.'); end if;
  d := app.draft_dna(p_workspace_id);
  item := app.identity_items(jsonb_build_array(p_item || jsonb_build_object('provenance', jsonb_build_object(
    'origin', case when app.customer_role(p_workspace_id) is not null then 'customer' else 'expert' end,
    'state', case when app.customer_is(p_workspace_id, array['owner', 'approver']) then 'approved' else 'proposed' end,
    'by', auth.uid(), 'at', now())))) -> 0;
  update public.brand_dna_versions set identity = jsonb_set(identity, array[k], coalesce(identity -> k, '[]') || jsonb_build_array(item))
  where id = d.id;
  return item;
end $$;

-- ─── Her decisions ───────────────────────────────────────────────────────────

-- Change one item in the draft: p_patch merges into it. Answers the item as it stands.
create or replace function app.patch_identity(p_ws uuid, p_kind text, p_id text, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  d public.brand_dna_versions := app.draft_dna(p_ws);
  k text := app.identity_key(p_kind);
  out jsonb;
begin
  if k is null then perform app.fail('invalid', 'Nothing to decide for ' || coalesce(p_kind, 'that') || '.'); end if;
  if not exists (select 1 from jsonb_array_elements(coalesce(d.identity -> k, '[]')) x where x ->> 'id' = p_id) then
    perform app.fail('not_found', 'No such ' || p_kind || '.');
  end if;
  update public.brand_dna_versions set identity = jsonb_set(identity, array[k], (
    select jsonb_agg(case when x ->> 'id' = p_id then x || p_patch else x end order by i)
    from jsonb_array_elements(identity -> k) with ordinality t(x, i)
  )) where id = d.id
  returning (select x from jsonb_array_elements(identity -> k) x where x ->> 'id' = p_id) into out;
  return out;
end $$;
revoke execute on function app.patch_identity(uuid, text, text, jsonb) from public, anon, authenticated;

create or replace function public.decide_identity(
  p_workspace_id uuid, p_kind text, p_id text, p_verdict text, p_value text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k text := app.identity_key(p_kind);
  cur jsonb;
  field text;
  patch jsonb;
begin
  perform app.require_user();
  if not app.can_read(p_workspace_id) then perform app.fail('not_found', 'No such brand.'); end if;
  if not app.customer_is(p_workspace_id, array['owner', 'approver']) then
    perform app.fail('forbidden', 'Only the brand''s owner or approver decides on its Brand DNA.');
  end if;
  if p_verdict not in ('keep', 'change', 'remove') then perform app.fail('invalid', 'Keep, change or remove.'); end if;
  select x into cur from jsonb_array_elements(coalesce((app.draft_dna(p_workspace_id)).identity -> k, '[]')) x
  where x ->> 'id' = p_id;
  if cur is null then perform app.fail('not_found', 'No such ' || coalesce(p_kind, 'item') || '.'); end if;
  field := case p_kind when 'colour' then 'hex' when 'voice' then 'statement' when 'image' then 'caption' else 'name' end;
  if p_verdict = 'change' and coalesce(trim(p_value), '') = '' then perform app.fail('invalid', 'Write what is right.'); end if;
  if p_verdict = 'change' and p_kind = 'colour' and trim(p_value) !~* '^#[0-9a-f]{6}$' then
    perform app.fail('invalid', 'A colour is written like #2B1D17.');
  end if;
  patch := jsonb_build_object('provenance', coalesce(cur -> 'provenance', '{}') || jsonb_build_object(
    'state', case p_verdict when 'keep' then 'approved' when 'change' then 'changed' else 'removed' end,
    'by', auth.uid(), 'at', now()));
  if p_verdict = 'change' then
    patch := patch || jsonb_build_object(field, trim(p_value));
    patch := jsonb_set(patch, '{provenance,was}', coalesce(cur -> field, '""'));
  end if;
  return app.patch_identity(p_workspace_id, p_kind, p_id, patch);
end $$;

create or replace function public.set_colour_uses(p_workspace_id uuid, p_colour_id text, p_uses text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_user();
  if not app.can_read(p_workspace_id) then perform app.fail('not_found', 'No such brand.'); end if;
  if not app.brand_writer(p_workspace_id) then perform app.fail('forbidden', 'Only the owner or approver sets this.'); end if;
  if exists (select 1 from unnest(coalesce(p_uses, '{}')) u
             where u not in ('buttons', 'accent', 'backgrounds', 'text', 'light', 'packaging', 'ui')) then
    perform app.fail('invalid', 'Choose what the colour is for.');
  end if;
  return app.patch_identity(p_workspace_id, 'colour', p_colour_id, jsonb_build_object('uses', to_jsonb(coalesce(p_uses, '{}'))));
end $$;

create or replace function public.move_image(p_workspace_id uuid, p_image_id text, p_group text, p_campaign text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_user();
  if not app.can_read(p_workspace_id) then perform app.fail('not_found', 'No such brand.'); end if;
  if not app.brand_writer(p_workspace_id) then perform app.fail('forbidden', 'Only the owner or approver moves pictures.'); end if;
  if p_group not in ('look', 'campaign', 'product', 'unused') then perform app.fail('invalid', 'Choose a group.'); end if;
  return app.patch_identity(p_workspace_id, 'image', p_image_id, jsonb_build_object('group', p_group,
    'campaign', case when p_group = 'campaign' then coalesce(nullif(trim(coalesce(p_campaign, '')), ''), 'A campaign') end));
end $$;

create or replace function public.decide_voice_part(p_workspace_id uuid, p_part text, p_verdict text, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  d public.brand_dna_versions;
  book jsonb;
begin
  perform app.require_user();
  if not app.can_read(p_workspace_id) then perform app.fail('not_found', 'No such brand.'); end if;
  if not app.customer_is(p_workspace_id, array['owner', 'approver']) then
    perform app.fail('forbidden', 'Only the brand''s owner or approver decides on its voice.');
  end if;
  if p_verdict not in ('keep', 'change') then perform app.fail('invalid', 'Confirm, or say what is right.'); end if;
  if p_verdict = 'change' and coalesce(trim(p_note), '') = '' then perform app.fail('invalid', 'Say what is right.'); end if;
  d := app.draft_dna(p_workspace_id);
  book := d.identity -> 'voiceBook';
  if book is null or not exists (select 1 from jsonb_array_elements(book -> 'parts') x where x ->> 'id' = p_part) then
    perform app.fail('not_found', 'No such part of the voice.');
  end if;
  book := jsonb_set(book, '{parts}', (
    select jsonb_agg(case when x ->> 'id' = p_part then
      (x - 'note') || jsonb_build_object('provenance', coalesce(x -> 'provenance', '{}') || jsonb_build_object(
        'state', case when p_verdict = 'keep' then 'approved' else 'changed' end, 'by', auth.uid(), 'at', now()))
      || case when p_verdict = 'change' then jsonb_build_object('note', trim(p_note)) else '{}' end
      else x end order by i)
    from jsonb_array_elements(book -> 'parts') with ordinality t(x, i)));
  update public.brand_dna_versions set identity = identity || jsonb_build_object('voiceBook', book) where id = d.id;
  -- Confirming how the brand speaks confirms the board's short voice lines too.
  if p_part = 'speak' and p_verdict = 'keep' then
    update public.brand_dna_versions set identity = jsonb_set(identity, '{voice}', (
      select coalesce(jsonb_agg(case when x #>> '{provenance,state}' = 'proposed'
        then jsonb_set(x, '{provenance}', (x -> 'provenance') || jsonb_build_object('state', 'approved', 'by', auth.uid(), 'at', now()))
        else x end order by i), '[]')
      from jsonb_array_elements(coalesce(identity -> 'voice', '[]')) with ordinality t(x, i)))
    where id = d.id;
  end if;
  return book;
end $$;

-- She approves the Brand DNA: the draft becomes the version campaigns are made from.
create or replace function public.approve_brand_dna(p_workspace_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  d public.brand_dna_versions;
begin
  perform app.require_user();
  if not app.can_read(p_workspace_id) then perform app.fail('not_found', 'No such brand.'); end if;
  if not app.customer_is(p_workspace_id, array['owner', 'approver']) then
    perform app.fail('forbidden', 'Only the brand''s owner or approver approves its Brand DNA.');
  end if;
  select * into d from public.brand_dna_versions where workspace_id = p_workspace_id and state <> 'superseded'
  order by version desc limit 1 for update;
  if not found then perform app.fail('conflict', 'Fume has not read the brand yet.'); end if;
  if d.state = 'approved' then return to_jsonb(d); end if;
  update public.brand_dna_versions set state = 'superseded'
  where workspace_id = p_workspace_id and state = 'approved' and id <> d.id;
  update public.brand_dna_versions set state = 'approved', approved_by = auth.uid(), approved_at = now()
  where id = d.id returning * into d;
  perform app.record(p_workspace_id, 'brand.approved', 'workspace', p_workspace_id, jsonb_build_object('version', d.version));
  return to_jsonb(d);
end $$;

revoke execute on function public.save_brand_scan(uuid, text, jsonb, jsonb, jsonb, text, text, text[]),
  public.add_identity_item(uuid, text, jsonb), public.decide_identity(uuid, text, text, text, text),
  public.set_colour_uses(uuid, text, text[]), public.move_image(uuid, text, text, text),
  public.decide_voice_part(uuid, text, text, text), public.approve_brand_dna(uuid) from public, anon;
grant execute on function public.save_brand_scan(uuid, text, jsonb, jsonb, jsonb, text, text, text[]),
  public.add_identity_item(uuid, text, jsonb), public.decide_identity(uuid, text, text, text, text),
  public.set_colour_uses(uuid, text, text[]), public.move_image(uuid, text, text, text),
  public.decide_voice_part(uuid, text, text, text), public.approve_brand_dna(uuid) to authenticated;
