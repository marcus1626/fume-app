-- The taste model in the Brand Brain. Fume measures every picture the brand has a verdict on (kept or removed from its
-- Brand DNA, approved, asked to change, swiped, put on a board) in about thirty numbers (supabase/functions/taste-learn/
-- measure.ts), and learns, per number, what the brand likes and what it does not, with how sure it is: the evidence
-- (how many pictures, how much they weigh) and how consistent they are. Each becomes a do or a don't in the graph,
-- with its confidence, and the taste profile goes into every prompt with the exact numbers for production.

-- ─── The variables ───────────────────────────────────────────────────────────

create table app.taste_features (
  key text primary key,
  area text not null check (area in ('light', 'colour', 'detail', 'composition', 'format')),
  label text not null,
  unit text not null default '',
  lo real not null,
  hi real not null,
  circular boolean not null default false,
  -- [[upper bound, words], ...] in rising order; the words for a value are the first band it is under.
  words jsonb not null
);

insert into app.taste_features (key, area, label, unit, lo, hi, circular, words) values
  ('light.key', 'light', 'Brightness', 'L*', 0, 100, false, '[[25,"very dark, low key"],[40,"dark and moody"],[55,"mid-tone"],[70,"bright"],[101,"high key"]]'),
  ('light.contrast', 'light', 'Contrast', 'L* range', 0, 100, false, '[[35,"flat"],[55,"soft"],[70,"medium"],[85,"punchy"],[101,"hard"]]'),
  ('light.shadows', 'light', 'Shadows', 'L*', 0, 60, false, '[[5,"deep black shadows"],[15,"dark shadows"],[30,"lifted shadows"],[101,"milky, faded shadows"]]'),
  ('light.midtone', 'light', 'Mid-tones', 'L*', 0, 100, false, '[[30,"dark mid-tones"],[50,"low mid-tones"],[65,"open mid-tones"],[101,"bright mid-tones"]]'),
  ('light.highlights', 'light', 'Highlights', 'L*', 40, 100, false, '[[75,"muted highlights"],[90,"clear highlights"],[101,"bright, near white highlights"]]'),
  ('light.mid_share', 'light', 'Tonal range', 'share in mid-tones', 0, 1, false, '[[0.35,"mostly deep darks and bright lights"],[0.65,"a full range of tones"],[1.01,"mostly mid-tones, gentle"]]'),
  ('light.clip_shadows', 'light', 'Crushed blacks', '% of picture', 0, 30, false, '[[0.5,"no crushed blacks"],[3,"a few crushed blacks"],[101,"crushed blacks"]]'),
  ('light.clip_highlights', 'light', 'Blown highlights', '% of picture', 0, 30, false, '[[0.5,"no blown highlights"],[3,"a few blown highlights"],[101,"blown highlights"]]'),
  ('light.vignette', 'light', 'Vignette', 'corners / centre', 0.4, 1.4, false, '[[0.8,"strong vignette"],[0.93,"light vignette"],[1.05,"even light, no vignette"],[2,"brighter edges than centre"]]'),
  ('light.from_side', 'light', 'Light direction across', 'right minus left', -1, 1, false, '[[-0.1,"light from the left"],[0.1,"light even across"],[2,"light from the right"]]'),
  ('light.from_above', 'light', 'Light direction down', 'top minus bottom', -1, 1, false, '[[-0.1,"brighter below"],[0.1,"even top to bottom"],[2,"light from above"]]'),
  ('colour.warmth', 'colour', 'Warmth', 'b*', -30, 50, false, '[[-5,"cool"],[5,"neutral"],[15,"warm"],[101,"very warm, golden"]]'),
  ('colour.tint', 'colour', 'Tint', 'a*', -20, 30, false, '[[-4,"green-leaning"],[4,"neutral tint"],[12,"rosy"],[101,"red or magenta-leaning"]]'),
  ('colour.white_balance', 'colour', 'White balance', 'b* of neutrals', -20, 30, false, '[[-3,"cool white balance"],[3,"neutral white balance"],[101,"warm white balance"]]'),
  ('colour.white_tint', 'colour', 'Neutral tint', 'a* of neutrals', -15, 15, false, '[[-2,"greenish neutrals"],[2,"clean neutrals"],[101,"pinkish neutrals"]]'),
  ('colour.saturation', 'colour', 'Saturation', 'C*', 0, 60, false, '[[8,"near monochrome"],[18,"muted"],[30,"natural"],[45,"rich"],[101,"vivid"]]'),
  ('colour.saturation_peak', 'colour', 'Strongest colours', 'C* p90', 0, 100, false, '[[15,"no strong colour anywhere"],[35,"a few soft accents"],[60,"clear colour accents"],[200,"intense accents"]]'),
  ('colour.colourfulness', 'colour', 'Colourfulness', 'M', 0, 120, false, '[[15,"not colourful"],[33,"slightly colourful"],[45,"moderately colourful"],[59,"quite colourful"],[200,"highly colourful"]]'),
  ('colour.hue_main', 'colour', 'Main colour family', 'hue°', 0, 360, true, '[]'),
  ('colour.hue_spread', 'colour', 'Colour families', 'spread', 0, 1, false, '[[0.3,"one colour family"],[0.6,"a few colour families"],[1.01,"many colour families"]]'),
  ('colour.warm_share', 'colour', 'Warm against cool', 'share warm', 0, 1, false, '[[0.35,"mostly cool colours"],[0.65,"warm and cool mixed"],[1.01,"mostly warm colours"]]'),
  ('colour.coloured_share', 'colour', 'How much is coloured', 'share', 0, 1, false, '[[0.2,"mostly neutral, colour in small places"],[0.6,"colour in parts"],[1.01,"colour everywhere"]]'),
  ('detail.sharpness', 'detail', 'Sharpness', 'log Laplacian', 0, 4, false, '[[1.5,"soft, dreamy"],[2.3,"gently sharp"],[3,"crisp"],[10,"very sharp"]]'),
  ('detail.edges', 'detail', 'Busyness', 'edge share', 0, 0.5, false, '[[0.04,"calm, few details"],[0.1,"some detail"],[0.2,"busy"],[1,"very busy"]]'),
  ('detail.grain', 'detail', 'Grain', 'noise', 0, 10, false, '[[1,"clean, no grain"],[2.5,"fine grain"],[100,"heavy grain"]]'),
  ('composition.space', 'composition', 'Empty space', 'share of frame', 0, 1, false, '[[0.2,"filled frame"],[0.45,"some empty space"],[0.7,"generous empty space"],[1.01,"mostly empty, minimal"]]'),
  ('composition.across', 'composition', 'Subject across', '0 left, 1 right', 0, 1, false, '[[0.4,"subject left of centre"],[0.6,"subject centred"],[1.01,"subject right of centre"]]'),
  ('composition.down', 'composition', 'Subject height', '0 top, 1 bottom', 0, 1, false, '[[0.4,"subject high in the frame"],[0.6,"subject at the middle"],[1.01,"subject low in the frame"]]'),
  ('composition.thirds', 'composition', 'Rule of thirds', 'distance to a thirds point', 0, 0.5, false, '[[0.08,"subject on a thirds point"],[0.16,"subject near a thirds point"],[1,"subject off the thirds"]]'),
  ('composition.symmetry', 'composition', 'Symmetry', '1 = mirror', 0, 1, false, '[[0.8,"asymmetric"],[0.9,"loosely balanced"],[1.01,"symmetric"]]'),
  ('composition.subject_size', 'composition', 'Subject size', 'share of frame', 0, 1, false, '[[0.25,"small subject, lots of room"],[0.5,"medium subject"],[0.8,"large subject"],[1.01,"subject fills the frame"]]'),
  ('composition.headroom', 'composition', 'Headroom', 'share above', 0, 1, false, '[[0.1,"tight at the top"],[0.25,"some headroom"],[1.01,"lots of headroom"]]'),
  ('format.aspect', 'format', 'Shape', 'width / height', 0.4, 2, false, '[[0.7,"tall"],[0.95,"portrait"],[1.05,"square"],[1.6,"landscape"],[9,"wide"]]');

create or replace function app.taste_words(p_key text, v real) returns text
language sql stable set search_path = '' as $$
  select case when f.circular then
      case when v < 20 or v >= 345 then 'red-pink' when v < 60 then 'orange, terracotta and brown' when v < 100 then 'yellow and sand'
        when v < 160 then 'green' when v < 200 then 'teal' when v < 260 then 'blue' when v < 300 then 'violet' else 'magenta' end
    else (select w ->> 1 from jsonb_array_elements(f.words) w where v < (w ->> 0)::real limit 1) end
  from app.taste_features f where f.key = p_key
$$;

-- ─── The evidence ────────────────────────────────────────────────────────────

create table public.taste_signals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  verdict text not null check (verdict in ('liked', 'disliked')),
  weight real not null default 1 check (weight > 0 and weight <= 5),
  origin text not null check (origin in ('brand_imagery', 'approval', 'change', 'swipe', 'board', 'reference', 'upload')),
  reason text,
  image_url text,
  file_id uuid references public.files (id) on delete cascade,
  ref_table text,
  ref_key text,
  features jsonb,
  palette jsonb,
  measured_at timestamptz,
  error text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (workspace_id, ref_table, ref_key)
);
create index on public.taste_signals (workspace_id, measured_at);
create index on public.taste_signals (file_id);
create index on public.taste_signals (created_by);

create table public.taste_variables (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  key text not null references app.taste_features (key),
  liked jsonb,
  disliked jsonb,
  target real,
  range_lo real,
  range_hi real,
  words text,
  do_confidence real not null default 0,
  avoid_target real,
  avoid_words text,
  avoid_confidence real not null default 0,
  evidence int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, key)
);

alter table public.taste_signals enable row level security;
alter table public.taste_variables enable row level security;
create policy taste_signals_read on public.taste_signals for select to authenticated using (app.can_read(workspace_id));
create policy taste_variables_read on public.taste_variables for select to authenticated using (app.can_read(workspace_id));
grant select on public.taste_signals, public.taste_variables to authenticated;

-- A number on the brain's nodes: the taste model's confidence (0–1) and how many pictures it rests on.
alter table public.brain_nodes add column score real, add column evidence int;

-- Gather the evidence the brand already gave: pictures kept or removed in its Brand DNA, creatives approved, creatives
-- the customer asked to change (with her words), and taste notes with a picture. New or changed pictures are measured
-- again; what is gone is forgotten. Swipes and uploads (no ref) stay.
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
              case when st = 'proposed' then 0.4 else 1 end, 'brand_imagery', x ->> 'caption', x ->> 'image', 'identity', x ->> 'id')
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

-- ─── The model ───────────────────────────────────────────────────────────────

-- Per variable: the weighted mean and spread of what she liked and of what she did not. A do's confidence grows with
-- the evidence (1 − e^(−weight/3)) and with how consistent it is (spread against a quarter of the variable's range); a
-- don't needs pictures she did not like that sit clearly apart from the ones she did (separation in pooled spreads).
create or replace function app.taste_compute(ws uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  f app.taste_features;
  lw real; lm real; lsd real; ln int;
  dw real; dm real; dsd real; dn int;
  scale real; sep real; doc real; avc real; rl real;
begin
  for f in select * from app.taste_features loop
    if f.circular then
      -- Hue: a weighted vector mean, weighted by how coloured each picture is too.
      select sum(s.weight * coalesce((s.features ->> 'colour.coloured_share')::real, 0.5)),
             count(*),
             (degrees(atan2(sum(s.weight * sin(radians((s.features ->> f.key)::real))), sum(s.weight * cos(radians((s.features ->> f.key)::real))))) + 360)::numeric % 360,
             sqrt(power(sum(s.weight * sin(radians((s.features ->> f.key)::real))), 2) + power(sum(s.weight * cos(radians((s.features ->> f.key)::real))), 2)) / nullif(sum(s.weight), 0)
        into lw, ln, lm, rl
      from public.taste_signals s where s.workspace_id = ws and s.verdict = 'liked' and s.features ? f.key;
      if coalesce(ln, 0) = 0 then delete from public.taste_variables where workspace_id = ws and key = f.key; continue; end if;
      doc := round(((1 - exp(-coalesce(lw, 0) / 3)) * coalesce(rl, 0))::numeric, 2);
      insert into public.taste_variables (workspace_id, key, liked, target, words, do_confidence, evidence, updated_at)
      values (ws, f.key, jsonb_build_object('mean', round(lm::numeric, 1), 'resultant', round(rl::numeric, 2), 'n', ln, 'weight', round(lw::numeric, 2)),
              lm, app.taste_words(f.key, lm), doc, ln, now())
      on conflict (workspace_id, key) do update set liked = excluded.liked, target = excluded.target, words = excluded.words,
        do_confidence = excluded.do_confidence, evidence = excluded.evidence, updated_at = now();
      continue;
    end if;
    select sum(s.weight), count(*), sum(s.weight * (s.features ->> f.key)::real) / nullif(sum(s.weight), 0)
      into lw, ln, lm from public.taste_signals s where s.workspace_id = ws and s.verdict = 'liked' and s.features ? f.key;
    select sqrt(sum(s.weight * power((s.features ->> f.key)::real - lm, 2)) / nullif(sum(s.weight), 0))
      into lsd from public.taste_signals s where s.workspace_id = ws and s.verdict = 'liked' and s.features ? f.key;
    select sum(s.weight), count(*), sum(s.weight * (s.features ->> f.key)::real) / nullif(sum(s.weight), 0)
      into dw, dn, dm from public.taste_signals s where s.workspace_id = ws and s.verdict = 'disliked' and s.features ? f.key;
    select sqrt(sum(s.weight * power((s.features ->> f.key)::real - dm, 2)) / nullif(sum(s.weight), 0))
      into dsd from public.taste_signals s where s.workspace_id = ws and s.verdict = 'disliked' and s.features ? f.key;
    if coalesce(ln, 0) + coalesce(dn, 0) = 0 then delete from public.taste_variables where workspace_id = ws and key = f.key; continue; end if;
    scale := (f.hi - f.lo);
    doc := case when coalesce(ln, 0) = 0 then 0 else
      round(((1 - exp(-lw / 3)) * greatest(0, 1 - coalesce(lsd, 0) / (0.25 * scale)))::numeric, 2) end;
    avc := 0;
    if coalesce(dn, 0) > 0 and coalesce(ln, 0) > 0 then
      sep := abs(lm - dm) / sqrt((power(coalesce(lsd, 0), 2) + power(coalesce(dsd, 0), 2)) / 2 + power(0.05 * scale, 2));
      avc := round(((1 - exp(-dw / 2)) * least(1, sep / 2) * greatest(0, 1 - coalesce(dsd, 0) / (0.25 * scale)))::numeric, 2);
      if sep < 0.8 then avc := 0; end if;
    elsif coalesce(dn, 0) > 0 then
      avc := round(((1 - exp(-dw / 2)) * 0.5 * greatest(0, 1 - coalesce(dsd, 0) / (0.25 * scale)))::numeric, 2);
    end if;
    insert into public.taste_variables (workspace_id, key, liked, disliked, target, range_lo, range_hi, words, do_confidence,
      avoid_target, avoid_words, avoid_confidence, evidence, updated_at)
    values (ws, f.key,
      case when ln > 0 then jsonb_build_object('mean', round(lm::numeric, 3), 'sd', round(coalesce(lsd, 0)::numeric, 3), 'n', ln, 'weight', round(lw::numeric, 2)) end,
      case when dn > 0 then jsonb_build_object('mean', round(dm::numeric, 3), 'sd', round(coalesce(dsd, 0)::numeric, 3), 'n', dn, 'weight', round(dw::numeric, 2)) end,
      lm, greatest(f.lo, lm - coalesce(lsd, 0)), least(f.hi, lm + coalesce(lsd, 0)), app.taste_words(f.key, lm), doc,
      dm, app.taste_words(f.key, dm), avc, coalesce(ln, 0) + coalesce(dn, 0), now())
    on conflict (workspace_id, key) do update set liked = excluded.liked, disliked = excluded.disliked, target = excluded.target,
      range_lo = excluded.range_lo, range_hi = excluded.range_hi, words = excluded.words, do_confidence = excluded.do_confidence,
      avoid_target = excluded.avoid_target, avoid_words = excluded.avoid_words, avoid_confidence = excluded.avoid_confidence,
      evidence = excluded.evidence, updated_at = now();
  end loop;

  -- Into the graph: one do and one don't per variable, with the confidence and the evidence.
  delete from public.brain_nodes where workspace_id = ws and ref_table in ('taste_variables', 'taste_palette');
  insert into public.brain_nodes (workspace_id, layer, kind, ref_table, ref_key, label, body, origin, state, score, evidence)
  select ws, 'taste', 'do', 'taste_variables', 'do:' || v.key, tf.label || ': ' || v.words,
         jsonb_build_object('key', v.key, 'area', tf.area, 'target', v.target, 'from', v.range_lo, 'to', v.range_hi, 'unit', tf.unit),
         'learned', 'proposed', v.do_confidence, v.evidence
  from public.taste_variables v join app.taste_features tf on tf.key = v.key
  where v.workspace_id = ws and v.do_confidence >= 0.1 and v.words is not null;
  insert into public.brain_nodes (workspace_id, layer, kind, ref_table, ref_key, label, body, origin, state, score, evidence)
  select ws, 'taste', 'dont', 'taste_variables', 'dont:' || v.key, 'Avoid ' || v.avoid_words,
         jsonb_build_object('key', v.key, 'area', tf.area, 'target', v.avoid_target, 'unit', tf.unit),
         'learned', 'proposed', v.avoid_confidence, v.evidence
  from public.taste_variables v join app.taste_features tf on tf.key = v.key
  where v.workspace_id = ws and v.avoid_confidence >= 0.1 and v.avoid_words is not null and v.avoid_words is distinct from v.words;
end $$;

-- The taste profile for a prompt: the dos and don'ts Fume is surest of, in words and numbers, and the palette of what
-- she liked.
create or replace function app.taste_profile(ws uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'measured_pictures', (select count(*) from public.taste_signals where workspace_id = ws and features is not null),
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

-- ─── The edge function's side ────────────────────────────────────────────────

-- The pictures waiting to be measured (after gathering the evidence), for the edge function `taste-learn`. A person
-- who may read the brand starts it; the measuring itself is saved by the service.
create or replace function public.taste_pending(p_workspace_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not app.can_read(p_workspace_id) then perform app.fail('not_found', 'No such brand.'); end if;
  perform app.taste_sync(p_workspace_id);
  return (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'url', s.image_url, 'bucket', fl.bucket, 'path', fl.path)), '[]')
    from (select * from public.taste_signals where workspace_id = p_workspace_id and measured_at is null
          order by weight desc, created_at limit 24) s
    left join public.files fl on fl.id = s.file_id);
end $$;

create or replace function public.save_taste_measures(p_workspace_id uuid, p_measures jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb;
begin
  for m in select * from jsonb_array_elements(coalesce(p_measures, '[]')) loop
    update public.taste_signals set features = m -> 'v', palette = m -> 'palette', error = m ->> 'error', measured_at = now()
    where id = (m ->> 'id')::uuid and workspace_id = p_workspace_id;
  end loop;
  perform app.taste_compute(p_workspace_id);
  return app.taste_profile(p_workspace_id);
end $$;

-- A swipe or a picture she adds: liked or not, with why. Anyone on the brand.
create or replace function public.add_taste_signal(
  p_workspace_id uuid, p_image_url text, p_liked boolean, p_reason text default null, p_origin text default 'swipe'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s public.taste_signals;
begin
  perform app.require_user();
  if not app.can_read(p_workspace_id) then perform app.fail('not_found', 'No such brand.'); end if;
  if not app.product_writer(p_workspace_id) then perform app.fail('forbidden', 'Only the people on the brand teach Fume its taste.'); end if;
  if coalesce(p_image_url, '') !~ '^https://' then perform app.fail('invalid', 'Give the picture''s address.'); end if;
  if p_origin not in ('swipe', 'board', 'reference', 'upload') then perform app.fail('invalid', 'Say where the picture is from.'); end if;
  insert into public.taste_signals (workspace_id, verdict, weight, origin, reason, image_url, created_by)
  values (p_workspace_id, case when p_liked then 'liked' else 'disliked' end, 1, p_origin, nullif(trim(coalesce(p_reason, '')), ''),
          p_image_url, auth.uid())
  returning * into s;
  return to_jsonb(s);
end $$;

revoke execute on function app.taste_words(text, real), app.taste_sync(uuid), app.taste_compute(uuid), app.taste_profile(uuid)
  from public, anon;
revoke execute on function public.taste_pending(uuid), public.save_taste_measures(uuid, jsonb),
  public.add_taste_signal(uuid, text, boolean, text, text) from public, anon;
grant execute on function public.taste_pending(uuid), public.add_taste_signal(uuid, text, boolean, text, text) to authenticated, service_role;
revoke execute on function public.save_taste_measures(uuid, jsonb) from authenticated;
grant execute on function public.save_taste_measures(uuid, jsonb) to service_role;

-- ─── The graph keeps the taste nodes, and the bundle carries the profile ─────

create or replace function app.brain_sync(ws uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  d public.brand_dna_versions;
  k text;
  x jsonb;
  seen text[] := '{}';
  r record;
  n uuid;
begin
  -- Identity: the newest Brand DNA that is not superseded.
  select * into d from public.brand_dna_versions where workspace_id = ws and state <> 'superseded'
  order by version desc limit 1;
  if found then
    foreach k in array array['colours', 'typefaces', 'logos', 'voice', 'imagery'] loop
      for x in select * from jsonb_array_elements(coalesce(d.identity -> k, '[]')) loop
        continue when nullif(x ->> 'id', '') is null;
        perform app.brain_put(ws, 'identity', rtrim(case k when 'imagery' then 'image' when 'voice' then 'voice' else k end, 's'),
          'identity', k || ':' || (x ->> 'id'),
          coalesce(x ->> 'name', x ->> 'statement', x ->> 'caption', x ->> 'wordmark', x ->> 'hex'),
          x - 'provenance', x #>> '{provenance,origin}', coalesce(x #>> '{provenance,state}', 'proposed'),
          x #>> '{provenance,confidence}');
        seen := seen || ('identity|' || k || ':' || (x ->> 'id'));
      end loop;
    end loop;
    for x in select * from jsonb_array_elements(coalesce(d.identity #> '{voiceBook,parts}', '[]')) loop
      continue when nullif(x ->> 'id', '') is null;
      perform app.brain_put(ws, 'identity', 'voice_part', 'identity', 'voiceBook:' || (x ->> 'id'),
        coalesce(x ->> 'title', x ->> 'found', x ->> 'id'), x - 'provenance', x #>> '{provenance,origin}',
        coalesce(x #>> '{provenance,state}', 'proposed'));
      seen := seen || ('identity|voiceBook:' || (x ->> 'id'));
    end loop;
    for r in select * from public.brand_rules where brand_dna_version_id = d.id loop
      perform app.brain_put(ws, 'rules', 'rule', 'brand_rules', r.id::text, r.statement,
        jsonb_build_object('area', r.area, 'kind', r.kind), r.origin,
        case when d.state = 'approved' then 'approved' else 'proposed' end, null, r.source_id);
      seen := seen || ('brand_rules|' || r.id);
    end loop;
  end if;

  -- Sources that are not a product's picture.
  for r in select * from public.sources where workspace_id = ws and not (kind = 'packshot' and product_id is not null) loop
    perform app.brain_put(ws, 'sources', 'source', 'sources', r.id::text, r.name,
      jsonb_strip_nulls(jsonb_build_object('kind', r.kind, 'url', r.url, 'file_id', r.file_id, 'read_at', r.retrieved_at)),
      'customer', 'approved', null, null);
    seen := seen || ('sources|' || r.id);
  end loop;

  -- Products, their facts and their pictures.
  for r in select * from public.products where workspace_id = ws loop
    n := app.brain_put(ws, 'products', 'product', 'products', r.id::text, trim(r.name || ' ' || coalesce(r.variant, '')),
      jsonb_strip_nulls(jsonb_build_object('name', r.name, 'variant', nullif(r.variant, ''), 'sku', r.sku, 'kind', r.kind_id,
        'specs', nullif(r.specs, '[]'::jsonb))),
      'customer', case when r.verified_at is not null then 'approved' else 'proposed' end);
    seen := seen || ('products|' || r.id);
  end loop;
  for r in select f.* from public.product_facts f where f.workspace_id = ws and f.superseded_by is null loop
    n := app.brain_put(ws, 'products', 'fact', 'product_facts', r.id::text, r.label || ': ' || r.statement,
      jsonb_build_object('area', r.area, 'label', r.label, 'statement', r.statement, 'required', r.required), r.origin,
      case r.status when 'verified' then 'approved' when 'conflict' then 'contradicted' else 'proposed' end, null, r.source_id);
    seen := seen || ('product_facts|' || r.id);
  end loop;
  for r in select * from public.sources where workspace_id = ws and kind = 'packshot' and product_id is not null loop
    perform app.brain_put(ws, 'products', 'picture', 'sources', r.id::text, r.name,
      jsonb_strip_nulls(jsonb_build_object('slot', r.slot, 'url', r.url, 'file_id', r.file_id)), 'customer', 'approved');
    seen := seen || ('sources|' || r.id);
  end loop;

  -- Creative Memory: campaigns, approvals, change requests and why, expert checks with a note.
  for r in select * from public.campaigns where workspace_id = ws loop
    perform app.brain_put(ws, 'memory', 'campaign', 'campaigns', r.id::text, r.name,
      jsonb_strip_nulls(jsonb_build_object('state', r.state, 'stage', r.stage, 'due_at', r.due_at, 'at', r.created_at)),
      'customer', 'approved');
    seen := seen || ('campaigns|' || r.id);
  end loop;
  for r in select a.*, cr.title, cr.campaign_id, v.number from public.approvals a
           join public.creative_versions v on v.id = a.version_id join public.creatives cr on cr.id = v.creative_id
           where a.workspace_id = ws and a.revoked_at is null loop
    perform app.brain_put(ws, 'memory', 'approval', 'approvals', r.id::text, 'Approved: ' || r.title,
      jsonb_build_object('creative', r.title, 'version', r.number, 'by', app.brain_who(r.decided_by), 'at', r.created_at,
        'campaign_id', r.campaign_id), 'customer', 'approved');
    seen := seen || ('approvals|' || r.id);
  end loop;
  for r in select c.*, cr.title, cr.campaign_id from public.change_requests c
           join public.creative_versions v on v.id = c.version_id join public.creatives cr on cr.id = v.creative_id
           where c.workspace_id = ws loop
    perform app.brain_put(ws, 'memory', 'change', 'change_requests', r.id::text, r.problem,
      jsonb_build_object('creative', r.title, 'cause', r.cause, 'from', r.source, 'must_change', r.must_change,
        'must_stay', r.must_stay, 'by', app.brain_who(r.by), 'at', r.created_at, 'campaign_id', r.campaign_id),
      case when r.source = 'customer' then 'customer' else 'fume' end, 'approved');
    seen := seen || ('change_requests|' || r.id);
  end loop;
  for r in select e.*, cr.title, cr.campaign_id from public.expert_checks e
           join public.creative_versions v on v.id = e.version_id join public.creatives cr on cr.id = v.creative_id
           where e.workspace_id = ws and e.state <> 'waiting' and nullif(trim(coalesce(e.note, '')), '') is not null loop
    perform app.brain_put(ws, 'memory', 'check', 'expert_checks', r.id::text, r.note,
      jsonb_build_object('creative', r.title, 'state', r.state, 'by', app.brain_who(r.expert_id), 'at', r.decided_at,
        'campaign_id', r.campaign_id), 'fume', 'approved');
    seen := seen || ('expert_checks|' || r.id);
  end loop;

  -- What is gone from its table is gone from the graph (its edges with it).
  delete from public.brain_nodes where workspace_id = ws and ref_table is not null
    and ref_table not in ('taste_variables', 'taste_palette') and not (ref_table || '|' || ref_key = any (seen));

  -- The links the tables give, drawn again.
  delete from public.brain_edges where workspace_id = ws and origin = 'sync';
  insert into public.brain_edges (workspace_id, from_id, to_id, kind)
  select distinct ws, a.id, b.id, l.kind from (
    select 'product_facts' ft, f.id::text fk, 'products' tt, f.product_id::text tk, 'about' kind
      from public.product_facts f where f.workspace_id = ws and f.superseded_by is null
    union all select 'product_facts', f.id::text, 'sources', f.source_id::text, 'from'
      from public.product_facts f where f.workspace_id = ws and f.superseded_by is null and f.source_id is not null
    union all select 'sources', s.id::text, 'products', s.product_id::text, case when s.kind = 'packshot' then 'shows' else 'about' end
      from public.sources s where s.workspace_id = ws and s.product_id is not null
    union all select 'campaigns', cp.campaign_id::text, 'products', cp.product_id::text, 'about'
      from public.campaign_products cp where cp.workspace_id = ws
    union all select 'brand_rules', br.id::text, 'sources', br.source_id::text, 'from'
      from public.brand_rules br where br.workspace_id = ws and br.source_id is not null
    union all select mt, mk, 'campaigns', mc, 'part_of' from (
      select 'approvals' mt, ap.id::text mk, cr.campaign_id::text mc from public.approvals ap
        join public.creative_versions v on v.id = ap.version_id join public.creatives cr on cr.id = v.creative_id
        where ap.workspace_id = ws and ap.revoked_at is null
      union all select 'change_requests', ch.id::text, cr.campaign_id::text from public.change_requests ch
        join public.creative_versions v on v.id = ch.version_id join public.creatives cr on cr.id = v.creative_id
        where ch.workspace_id = ws
      union all select 'expert_checks', e.id::text, cr.campaign_id::text from public.expert_checks e
        join public.creative_versions v on v.id = e.version_id join public.creatives cr on cr.id = v.creative_id
        where e.workspace_id = ws) m
  ) l
  join public.brain_nodes a on a.workspace_id = ws and a.ref_table = l.ft and a.ref_key = l.fk
  join public.brain_nodes b on b.workspace_id = ws and b.ref_table = l.tt and b.ref_key = l.tk
  on conflict (from_id, to_id, kind) do nothing;
  -- Identity items read from the website come from it.
  insert into public.brain_edges (workspace_id, from_id, to_id, kind)
  select ws, i.id, s.id, 'from' from public.brain_nodes i
  join lateral (select src.id from public.brain_nodes src where src.workspace_id = ws and src.kind = 'source' and src.body ->> 'kind' = 'website'
                order by src.created_at limit 1) s on true
  where i.workspace_id = ws and i.layer = 'identity' and i.origin = 'engine'
  on conflict (from_id, to_id, kind) do nothing;

  delete from app.brain_dirty where workspace_id = ws;
end $$;

create or replace function public.brain_context(p_workspace_id uuid, p_campaign_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  products uuid[];
begin
  -- A person reads only a brand they may read; the service (no person) reads for the edge functions. anon has no grant.
  if auth.uid() is not null and not app.can_read(p_workspace_id) then perform app.fail('not_found', 'No such brand.'); end if;
  perform app.brain_fresh(p_workspace_id);
  if p_campaign_id is not null then
    select array_agg(product_id) into products from public.campaign_products where campaign_id = p_campaign_id;
  end if;
  return jsonb_build_object(
    'brand', (select jsonb_build_object('name', w.brand_name, 'market', w.market, 'language', w.language)
              from public.workspaces w where w.id = p_workspace_id),
    'identity', (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('kind', kind, 'what', label,
        'hex', body ->> 'hex', 'role', body ->> 'role', 'use', body ->> 'use', 'example', body ->> 'example',
        'confirmed', state in ('approved', 'changed'))) order by kind, label), '[]')
      from public.brain_nodes where workspace_id = p_workspace_id and layer = 'identity' and state <> 'removed'),
    'rules', (select coalesce(jsonb_agg(jsonb_build_object('rule', label, 'area', body ->> 'area', 'kind', coalesce(body ->> 'kind', kind),
        'confirmed', state = 'approved') order by label), '[]')
      from public.brain_nodes where workspace_id = p_workspace_id and layer = 'rules' and state <> 'removed'),
    'products', (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('product', p.label,
        'confirmed', p.state = 'approved', 'specs', p.body -> 'specs',
        'facts', (select jsonb_agg(jsonb_build_object('fact', f.label, 'confirmed', f.state = 'approved',
                    'disputed', f.state = 'contradicted') order by f.label)
                  from public.brain_edges e join public.brain_nodes f on f.id = e.from_id and f.kind = 'fact'
                  where e.to_id = p.id and e.kind = 'about'))) order by p.label), '[]')
      from (select * from public.brain_nodes p where p.workspace_id = p_workspace_id and p.kind = 'product' and p.state <> 'removed'
              and (products is null or p.ref_key = any (select unnest(products)::text))
            order by p.label limit 40) p),
    'taste', (select coalesce(jsonb_agg(jsonb_build_object('what', label, 'kind', kind, 'confirmed', state = 'approved') order by created_at), '[]')
      from public.brain_nodes where workspace_id = p_workspace_id and layer = 'taste' and state <> 'removed' and ref_table is null),
    'taste_profile', app.taste_profile(p_workspace_id),
    'market', (select coalesce(jsonb_agg(jsonb_build_object('what', label, 'kind', kind, 'confirmed', state = 'approved') order by kind, label), '[]')
      from public.brain_nodes where workspace_id = p_workspace_id and layer = 'market' and state <> 'removed'),
    'memory', (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('kind', kind, 'what', label,
        'creative', body ->> 'creative', 'cause', body ->> 'cause', 'from', body ->> 'from', 'at', body ->> 'at')) order by at desc), '[]')
      from (select *, coalesce(body ->> 'at', created_at::text) at from public.brain_nodes
            where workspace_id = p_workspace_id and layer = 'memory' and kind in ('change', 'check', 'approval', 'note')
              and (p_campaign_id is null or body ->> 'campaign_id' is distinct from p_campaign_id::text)
            order by coalesce(body ->> 'at', created_at::text) desc limit 20) m)
  );
end $$;
