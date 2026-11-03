-- Taste swipes (FLOWS §14): Fume shows the brand's own pictures, two at a time that differ most on one thing it is
-- least sure of (the light, the colour, the framing), or one picture it only proposed ("Is this the brand?"). Each
-- answer becomes taste signals (origin swipe) and the taste model is computed again. The deck is made from what Fume
-- has measured; the Engine will add pictures of its own later.

create table public.taste_cards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null check (kind in ('pair', 'single')),
  area text not null check (area in ('light', 'colour', 'people', 'composition', 'styling')),
  feature text,
  question text not null,
  a_signal uuid not null references public.taste_signals (id) on delete cascade,
  b_signal uuid references public.taste_signals (id) on delete cascade,
  answer text check (answer in ('a', 'b', 'yes', 'no', 'neither')),
  reason text,
  answered_by uuid references public.profiles (id),
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  check ((kind = 'pair') = (b_signal is not null))
);
create index on public.taste_cards (workspace_id, answered_at);
create index on public.taste_cards (a_signal);
create index on public.taste_cards (b_signal);
create index on public.taste_cards (answered_by);
alter table public.taste_cards enable row level security;
create policy taste_cards_read on public.taste_cards for select to authenticated using (app.can_read(workspace_id));
grant select on public.taste_cards to authenticated;

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
  delete from public.taste_signals where workspace_id = ws and ref_table is not null and ref_table <> 'taste_cards'
    and not (ref_table || '|' || ref_key = any (seen));
end $$;


-- Fills the deck up to eight unanswered cards: pairs first, from the measured area Fume is least sure of, then singles
-- for pictures it only proposed.
create or replace function app.taste_deck_fill(ws uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  brand text;
  open_n int;
  ar record;
  fk text;
  lo_s uuid;
  hi_s uuid;
  s record;
begin
  select brand_name into brand from public.workspaces where id = ws;
  select count(*) into open_n from public.taste_cards where workspace_id = ws and answered_at is null;
  for ar in
    select tf.area, avg(coalesce(v.do_confidence, 0)) conf
    from app.taste_features tf left join public.taste_variables v on v.key = tf.key and v.workspace_id = ws
    where tf.area in ('light', 'colour', 'composition') group by tf.area order by 2
  loop
    exit when open_n >= 8;
    -- The thing in this area Fume is least sure of, among those the pictures differ on.
    for fk in
      select tf.key from app.taste_features tf left join public.taste_variables v on v.key = tf.key and v.workspace_id = ws
      where tf.area = ar.area and not tf.circular order by coalesce(v.do_confidence, 0), tf.key
    loop
      exit when open_n >= 8;
      select id into lo_s from public.taste_signals where workspace_id = ws and features ? fk and ref_table is distinct from 'taste_cards'
        order by (features ->> fk)::real, id limit 1;
      select id into hi_s from public.taste_signals where workspace_id = ws and features ? fk and ref_table is distinct from 'taste_cards'
        order by (features ->> fk)::real desc, id limit 1;
      continue when lo_s is null or hi_s is null or lo_s = hi_s;
      continue when exists (select 1 from public.taste_cards where workspace_id = ws and kind = 'pair'
                            and ((a_signal = lo_s and b_signal = hi_s) or (a_signal = hi_s and b_signal = lo_s)));
      if random() < 0.5 then select hi_s, lo_s into lo_s, hi_s; end if;
      insert into public.taste_cards (workspace_id, kind, area, feature, question, a_signal, b_signal)
      values (ws, 'pair', ar.area, fk,
              case ar.area when 'light' then 'Which light is more ' || brand || '?'
                           when 'colour' then 'Which colours are more ' || brand || '?'
                           else 'Which framing is more ' || brand || '?' end,
              lo_s, hi_s);
      open_n := open_n + 1;
      exit;
    end loop;
  end loop;
  for s in
    select ts.id from public.taste_signals ts
    where ts.workspace_id = ws and ts.origin = 'brand_imagery' and ts.weight < 1 and ts.features is not null
      and not exists (select 1 from public.taste_cards c where c.a_signal = ts.id and c.kind = 'single')
    order by ts.weight desc, ts.created_at limit greatest(0, 8 - open_n)
  loop
    insert into public.taste_cards (workspace_id, kind, area, question, a_signal)
    values (ws, 'single', 'styling', 'Is this ' || brand || '?', s.id);
  end loop;
end $$;

-- How sure Fume is per area (the mean confidence of what it measures there; people are not measured yet), how many
-- cards were answered, and what it learned last.
create or replace function app.taste_state(ws uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'confidence', jsonb_build_object(
      'light', coalesce((select round(avg(coalesce(v.do_confidence, 0))::numeric, 2) from app.taste_features tf
                left join public.taste_variables v on v.key = tf.key and v.workspace_id = ws where tf.area = 'light'), 0),
      'colour', coalesce((select round(avg(coalesce(v.do_confidence, 0))::numeric, 2) from app.taste_features tf
                left join public.taste_variables v on v.key = tf.key and v.workspace_id = ws where tf.area = 'colour'), 0),
      'composition', coalesce((select round(avg(coalesce(v.do_confidence, 0))::numeric, 2) from app.taste_features tf
                left join public.taste_variables v on v.key = tf.key and v.workspace_id = ws where tf.area in ('composition', 'format')), 0),
      'styling', coalesce((select round(avg(coalesce(v.do_confidence, 0))::numeric, 2) from app.taste_features tf
                left join public.taste_variables v on v.key = tf.key and v.workspace_id = ws where tf.area = 'detail'), 0),
      'people', 0),
    'answered', (select count(*) from public.taste_cards where workspace_id = ws and answered_at is not null),
    'lastLesson', (select case
        when c.reason is not null then c.reason
        when c.kind = 'pair' and c.answer in ('a', 'b') then
          (select tf.label || ': ' || app.taste_words(c.feature, (sg.features ->> c.feature)::real)
           from app.taste_features tf, public.taste_signals sg
           where tf.key = c.feature and sg.id = case when c.answer = 'a' then c.a_signal else c.b_signal end)
        when c.answer = 'yes' then 'More pictures like this one'
        when c.answer in ('no', 'neither') then 'Not like this'
      end from public.taste_cards c where c.workspace_id = ws and c.answered_at is not null order by c.answered_at desc limit 1),
    'updatedAt', coalesce((select max(updated_at) from public.taste_variables where workspace_id = ws), now()))
$$;

create or replace function app.taste_card_json(c public.taste_cards) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', c.id, 'kind', c.kind, 'area', c.area, 'question', c.question,
    'a', a.image_url, 'aFile', a.file_id, 'b', b.image_url, 'bFile', b.file_id,
    'answer', c.answer, 'reason', c.reason))
  from public.taste_signals a left join public.taste_signals b on b.id = c.b_signal where a.id = c.a_signal
$$;

-- The deck for the Taste tab and the onboarding's taste step.
create or replace function public.taste_deck(p_workspace_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not app.can_read(p_workspace_id) then perform app.fail('not_found', 'No such brand.'); end if;
  perform app.taste_deck_fill(p_workspace_id);
  return jsonb_build_object(
    'cards', (select coalesce(jsonb_agg(app.taste_card_json(c) order by c.created_at), '[]') from public.taste_cards c
              where c.workspace_id = p_workspace_id and c.answered_at is null),
    'answered', (select coalesce(jsonb_agg(app.taste_card_json(c) order by c.answered_at desc), '[]') from (
                  select * from public.taste_cards where workspace_id = p_workspace_id and answered_at is not null
                  order by answered_at desc limit 20) c),
    'state', app.taste_state(p_workspace_id));
end $$;

-- Her answer: the picture she chose is liked, the other one a little less (disliked at half weight); "Is this us?"
-- yes or no; neither of two. Answering again replaces what she said. The model is computed again.
create or replace function public.answer_taste_card(p_card_id uuid, p_answer text, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c public.taste_cards;
  why text := nullif(trim(coalesce(p_reason, '')), '');
  win uuid;
  lose uuid;
begin
  perform app.require_user();
  select * into c from public.taste_cards where id = p_card_id;
  if not found or not app.can_read(c.workspace_id) then perform app.fail('not_found', 'No such card.'); end if;
  if not app.product_writer(c.workspace_id) then perform app.fail('forbidden', 'Only the people on the brand teach Fume its taste.'); end if;
  if (c.kind = 'pair' and p_answer not in ('a', 'b', 'neither')) or (c.kind = 'single' and p_answer not in ('yes', 'no', 'neither')) then
    perform app.fail('invalid', 'Answer the card as it asks.');
  end if;
  update public.taste_cards set answer = p_answer, reason = coalesce(why, case when answer = p_answer then reason end),
    answered_by = auth.uid(), answered_at = coalesce(answered_at, now())
  where id = p_card_id returning * into c;
  delete from public.taste_signals where workspace_id = c.workspace_id and ref_table = 'taste_cards' and ref_key like c.id || ':%';
  if p_answer in ('a', 'b', 'yes') then
    win := case when p_answer = 'b' then c.b_signal else c.a_signal end;
    lose := case p_answer when 'a' then c.b_signal when 'b' then c.a_signal end;
  end if;
  insert into public.taste_signals (workspace_id, verdict, weight, origin, reason, image_url, file_id, ref_table, ref_key,
    features, palette, measured_at, created_by)
  select c.workspace_id, x.verdict, x.weight, 'swipe', x.reason, s.image_url, s.file_id, 'taste_cards', c.id || ':' || x.side,
    s.features, s.palette, s.measured_at, auth.uid()
  from (values
      ('w', win, 'liked', 1.0::real, c.reason),
      ('l', lose, 'disliked', 0.5::real, null::text),
      ('a', case when p_answer in ('no', 'neither') then c.a_signal end, 'disliked', case when c.kind = 'pair' then 0.5 else 1 end::real, c.reason),
      ('b', case when p_answer = 'neither' then c.b_signal end, 'disliked', 0.5::real, c.reason)
    ) x(side, sig, verdict, weight, reason)
    join public.taste_signals s on s.id = x.sig;
  perform app.taste_compute(c.workspace_id);
  return jsonb_build_object('card', app.taste_card_json(c), 'state', app.taste_state(c.workspace_id));
end $$;

revoke execute on function app.taste_deck_fill(uuid), app.taste_state(uuid), app.taste_card_json(public.taste_cards)
  from public, anon, authenticated;
revoke execute on function public.taste_deck(uuid), public.answer_taste_card(uuid, text, text) from public, anon;
grant execute on function public.taste_deck(uuid), public.answer_taste_card(uuid, text, text) to authenticated;
