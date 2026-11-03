-- The one Fume chat (FLOWS §12, §21, §23; ARCHITECTURE §4.8). One conversation per brand, kept as a general thread
-- and a thread per campaign that the app merges into one stream. Fume (AI) answers what it can from what the app
-- knows; when it cannot, it hands the talk to a named person at Fume in the same chat ("Sander at Fume will answer
-- you here"). While a thread is handed over, that person answers and Fume stays quiet in it.
--
-- Writing is a command (say). Fume's answers are written by the edge function `fume-chat` through
-- fume_chat_answer, which the service role alone may call; the model proposes the words and the card, this decides
-- what the card may point at and who takes over.

create table public.conversation_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- Null for the talk about no campaign.
  campaign_id uuid references public.campaigns (id) on delete cascade,
  title text not null,
  -- The person at Fume the talk is handed to; null while Fume answers.
  handed_to uuid references public.profiles (id) on delete set null,
  handed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index conversation_threads_general on public.conversation_threads (workspace_id) where campaign_id is null;
create unique index conversation_threads_campaign on public.conversation_threads (campaign_id) where campaign_id is not null;
create index on public.conversation_threads (handed_to);

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.conversation_threads (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  author_kind text not null check (author_kind in ('person', 'fume')),
  author_id uuid references public.profiles (id) on delete set null,
  text text not null default '' check (length(text) <= 4000),
  -- A card Fume shows with its words (contract MessageCard): link, summary, handover.
  card jsonb,
  attachments jsonb not null default '[]',
  -- Fume's answer names the message it answers: one answer per message.
  answers uuid references public.conversation_messages (id) on delete set null,
  at timestamptz not null default now()
);
create unique index conversation_messages_one_answer on public.conversation_messages (answers) where answers is not null;
create index on public.conversation_messages (thread_id, at);
create index on public.conversation_messages (workspace_id, at);
create index on public.conversation_messages (author_id);

-- How far each person has read each thread.
create table public.conversation_reads (
  user_id uuid not null references public.profiles (id) on delete cascade,
  thread_id uuid not null references public.conversation_threads (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, thread_id)
);
create index on public.conversation_reads (thread_id);

alter table public.conversation_threads enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.conversation_reads enable row level security;
create policy conversation_threads_read on public.conversation_threads for select to authenticated
  using (app.can_read(workspace_id));
create policy conversation_messages_read on public.conversation_messages for select to authenticated
  using (app.can_read(workspace_id));
create policy conversation_reads_read on public.conversation_reads for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.conversation_threads, public.conversation_messages, public.conversation_reads to authenticated;

-- The new messages reach the open chat over Realtime (the same row-level security as a read), and so does the bell.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'
                   and tablename = 'conversation_messages') then
      alter publication supabase_realtime add table public.conversation_messages;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'
                   and tablename = 'notifications') then
      alter publication supabase_realtime add table public.notifications;
    end if;
  end if;
end $$;

-- ─── Helpers ─────────────────────────────────────────────────────────────────

-- The brand's thread for a campaign, or its talk about no campaign (null), made the first time it is needed.
create or replace function app.thread_for(p_ws uuid, p_campaign uuid) returns public.conversation_threads
language plpgsql security definer set search_path = '' as $$
declare
  t public.conversation_threads;
begin
  if p_campaign is null then
    select * into t from public.conversation_threads where workspace_id = p_ws and campaign_id is null;
  else
    select * into t from public.conversation_threads where campaign_id = p_campaign;
  end if;
  if found then return t; end if;
  insert into public.conversation_threads (workspace_id, campaign_id, title)
  values (p_ws, p_campaign, coalesce((select c.name from public.campaigns c where c.id = p_campaign), 'Fume'))
  on conflict do nothing
  returning * into t;
  if t.id is null then
    -- Made at the same moment by someone else.
    if p_campaign is null then
      select * into t from public.conversation_threads where workspace_id = p_ws and campaign_id is null;
    else
      select * into t from public.conversation_threads where campaign_id = p_campaign;
    end if;
  end if;
  return t;
end $$;

-- Where Fume's people open a customer's talk. One place, so it changes once the staff side has its page.
create or replace function app.staff_chat_href(p_ws uuid, p_thread uuid) returns text
language sql immutable set search_path = '' as $$ select '/studio/b/' || p_ws $$;

-- Who at Fume takes a talk Fume cannot answer: the brand's account manager, else its checking designer, else any
-- designer on it. Null when the brand has no one at Fume.
create or replace function app.chat_person(p_ws uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select s.user_id from public.staff_assignments s
  where s.workspace_id = p_ws
  order by (s.staff_role = 'account_manager') desc, s.can_check desc, s.created_at
  limit 1
$$;

create or replace function app.message_json(p_m public.conversation_messages) returns jsonb
language sql stable set search_path = '' as $$ select to_jsonb(p_m) $$;

-- ─── Commands ────────────────────────────────────────────────────────────────

-- Her words (or a person at Fume's) in the brand's conversation: in the thread named, else the talk about no
-- campaign. The brand's owner, approver and member write; a viewer reads. Fume's designers and account managers on
-- the brand write as themselves. Returns the message, and whether Fume should answer it (a customer's words in a
-- thread no person has taken over).
create or replace function public.say(
  p_workspace_id uuid, p_text text, p_thread_id uuid default null, p_attachments jsonb default '[]',
  p_key text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('workspace_id', p_workspace_id, 'text', p_text, 'thread_id', p_thread_id,
    'attachments', coalesce(p_attachments, '[]'));
  prior jsonb;
  me uuid := app.require_user();
  staff boolean;
  t public.conversation_threads;
  msg public.conversation_messages;
  words text := trim(coalesce(p_text, ''));
  files jsonb := coalesce(p_attachments, '[]');
  who text;
  r record;
begin
  prior := app.idem_begin(p_key, 'say', req);
  if prior is not null then return prior; end if;

  if not app.can_read(p_workspace_id) then perform app.fail('not_found', 'No such brand.'); end if;
  staff := app.is_staff(p_workspace_id, array['designer', 'account_manager']);
  if not staff and not app.customer_is(p_workspace_id, array['owner', 'approver', 'member']) then
    perform app.fail('forbidden', 'Viewers read the conversation; ask the owner for the right to write.');
  end if;
  if words = '' and jsonb_array_length(files) = 0 then perform app.fail('invalid', 'Write something first.'); end if;
  if length(words) > 4000 then perform app.fail('invalid', 'That is too long for one message.'); end if;

  if p_thread_id is null then
    t := app.thread_for(p_workspace_id, null);
  else
    select * into t from public.conversation_threads where id = p_thread_id and workspace_id = p_workspace_id;
    if not found then perform app.fail('not_found', 'No such conversation.'); end if;
  end if;

  insert into public.conversation_messages (thread_id, workspace_id, author_kind, author_id, text, attachments)
  values (t.id, p_workspace_id, 'person', me, words,
    (select coalesce(jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'name', a ->> 'name',
       'bytes', coalesce((a ->> 'bytes')::bigint, 0), 'kind', 'document')), '[]') from jsonb_array_elements(files) a))
  returning * into msg;
  update public.conversation_threads set updated_at = msg.at where id = t.id;
  insert into public.conversation_reads (user_id, thread_id, read_at) values (me, t.id, msg.at)
  on conflict (user_id, thread_id) do update set read_at = excluded.read_at;

  select coalesce(nullif(split_part(p.name, ' ', 1), ''), 'Someone') into who from public.profiles p where p.id = me;
  if staff then
    -- A person at Fume answered: the brand's people hear it.
    for r in select m.user_id from public.memberships m where m.workspace_id = p_workspace_id loop
      perform app.notify(r.user_id, p_workspace_id, 'mention', me, 'chat:' || t.id,
        who || ' at Fume answered you', who || ' at Fume wrote {n} messages', '/fume/' || t.id, null);
    end loop;
  elsif t.handed_to is not null then
    perform app.notify(t.handed_to, p_workspace_id, 'mention', me, 'chat:' || t.id,
      who || ' wrote to you in the chat', who || ' wrote {n} messages to you in the chat',
      app.staff_chat_href(p_workspace_id, t.id), null);
  end if;

  return app.idem_end(p_key, 'say', req,
    app.message_json(msg) || jsonb_build_object('fume_answers', not staff and t.handed_to is null));
end $$;

-- Marks the caller's conversation on this brand read, every thread of it.
create or replace function public.mark_conversation_read(p_workspace_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := app.require_user();
begin
  if not app.can_read(p_workspace_id) then perform app.fail('not_found', 'No such brand.'); end if;
  insert into public.conversation_reads (user_id, thread_id, read_at)
  select me, t.id, now() from public.conversation_threads t where t.workspace_id = p_workspace_id
  on conflict (user_id, thread_id) do update set read_at = excluded.read_at;
end $$;

-- ─── Fume's side (the edge function, service role only) ─────────────────────

-- What Fume may know when it answers this message: the brand, the talk so far, the campaigns as the customer sees
-- them (counts only, and only sent work counts as checked), the products and whether they are confirmed, and the
-- people at Fume. `answer` is false when Fume should stay quiet (answered already, a person took over, or the words
-- are not a customer's).
create or replace function public.fume_chat_context(p_message_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with m as (select * from public.conversation_messages where id = p_message_id),
  t as (select t.* from public.conversation_threads t join m on m.thread_id = t.id),
  ws as (select w.* from public.workspaces w join m on m.workspace_id = w.id),
  latest as (
    select distinct on (v.creative_id) c.campaign_id, v.state, v.sent_at
    from public.creative_versions v join public.creatives c on c.id = v.creative_id
    where c.workspace_id = (select workspace_id from m)
    order by v.creative_id, v.number desc
  )
  select jsonb_build_object(
    'message', (select jsonb_build_object('id', m.id, 'thread_id', m.thread_id, 'workspace_id', m.workspace_id,
                 'text', m.text, 'at', m.at, 'author', m.author_id) from m),
    'answer', (select m.author_kind = 'person'
                 and exists (select 1 from public.memberships x where x.user_id = m.author_id and x.workspace_id = m.workspace_id)
                 and not exists (select 1 from public.conversation_messages a where a.answers = m.id)
                 and (select handed_to is null from t)
               from m),
    'brand', (select jsonb_build_object('name', ws.brand_name, 'market', ws.market, 'language', ws.language) from ws),
    'customer', (select jsonb_build_object('name', p.name, 'role', x.role)
                 from m join public.profiles p on p.id = m.author_id
                 left join public.memberships x on x.user_id = p.id and x.workspace_id = m.workspace_id),
    'campaign_of_thread', (select t.campaign_id from t),
    'talk', (
      select coalesce(jsonb_agg(jsonb_build_object('from', case when h.author_kind = 'fume' then 'fume'
                 when exists (select 1 from public.memberships x where x.user_id = h.author_id and x.workspace_id = h.workspace_id)
                 then 'customer' else 'fume_person' end,
               'name', (select split_part(p.name, ' ', 1) from public.profiles p where p.id = h.author_id),
               'text', h.text, 'at', h.at) order by h.at), '[]')
      from (select * from public.conversation_messages h
            where h.workspace_id = (select workspace_id from m) and h.at <= (select at from m) and h.id <> (select id from m)
            order by h.at desc limit 16) h
    ),
    'campaigns', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'stage', c.stage, 'state', c.state, 'due_at', c.due_at,
        'brief_sent', exists (select 1 from public.brief_versions b where b.campaign_id = c.id),
        'plan', (select jsonb_build_object('version', p.version, 'state', p.state)
                 from public.plan_versions p where p.campaign_id = c.id and p.state <> 'superseded'
                 order by p.version desc limit 1),
        'products', (select coalesce(jsonb_agg(pr.name order by pr.name), '[]')
                     from public.campaign_products cp join public.products pr on pr.id = cp.product_id
                     where cp.campaign_id = c.id),
        'creatives', jsonb_build_object(
          'in_check', (select count(*) from latest l where l.campaign_id = c.id
                       and (l.state in ('making', 'in_check', 'correcting', 'held') or (l.state = 'checked' and l.sent_at is null))),
          'waiting_on_you', (select count(*) from latest l where l.campaign_id = c.id and l.state = 'checked' and l.sent_at is not null),
          'changes_asked', (select count(*) from latest l where l.campaign_id = c.id and l.state = 'changes_requested'),
          'approved', (select count(*) from latest l where l.campaign_id = c.id and l.state = 'approved'),
          'delivered', (select count(*) from latest l where l.campaign_id = c.id and l.state = 'delivered'))
      ) order by c.created_at desc), '[]')
      from public.campaigns c where c.workspace_id = (select workspace_id from m)
    ),
    'products', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', pr.id, 'name', trim(pr.name || ' ' || pr.variant),
        'confirmed', not exists (select 1 from public.product_facts f where f.product_id = pr.id and f.required
                                 and f.superseded_by is null and f.status <> 'verified'),
        'missing', (select coalesce(jsonb_agg(f.label order by f.label), '[]') from public.product_facts f
                    where f.product_id = pr.id and f.required and f.superseded_by is null and f.status <> 'verified')
      ) order by pr.name), '[]')
      from public.products pr where pr.workspace_id = (select workspace_id from m)
    ),
    'people_at_fume', (
      select coalesce(jsonb_agg(distinct jsonb_build_object('name', p.name, 'title', p.title, 'role', s.staff_role)), '[]')
      from public.staff_assignments s join public.profiles p on p.id = s.user_id
      where s.workspace_id = (select workspace_id from m)
    )
  )
$$;
revoke execute on function public.fume_chat_context(uuid) from public, anon, authenticated;
grant execute on function public.fume_chat_context(uuid) to service_role;

-- Fume's answer to one message. The card is kept only when it points at something of this brand; a handover goes to
-- the brand's person at Fume (app.chat_person), who is told, and Fume stays quiet in that thread from then on. A
-- message answered already is not answered again (null is returned).
create or replace function public.fume_chat_answer(p_message_id uuid, p_text text, p_card jsonb default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m public.conversation_messages;
  t public.conversation_threads;
  answer public.conversation_messages;
  card jsonb := p_card;
  kind text := p_card ->> 'kind';
  target uuid;
  person uuid;
  person_name text;
  customer text;
  words text := trim(coalesce(p_text, ''));
  into_thread uuid;
begin
  select * into m from public.conversation_messages where id = p_message_id;
  if not found then perform app.fail('not_found', 'No such message.'); end if;
  if exists (select 1 from public.conversation_messages a where a.answers = m.id) then return null; end if;
  select * into t from public.conversation_threads where id = m.thread_id for update;
  if t.handed_to is not null then return null; end if;
  into_thread := t.id;

  if kind = 'link' then
    begin
      target := coalesce(card #>> '{link,campaignId}', card #>> '{link,productId}')::uuid;
    exception when others then target := null;
    end;
    if (card #>> '{link,kind}') in ('campaign', 'plan')
       and exists (select 1 from public.campaigns c where c.id = target and c.workspace_id = m.workspace_id) then
      card := jsonb_build_object('kind', 'link', 'link', jsonb_build_object('kind', card #>> '{link,kind}', 'campaignId', target));
      -- Talk about a campaign lands in its own thread, so the stream marks where it turns to it.
      into_thread := (app.thread_for(m.workspace_id, target)).id;
    elsif (card #>> '{link,kind}') = 'product'
       and exists (select 1 from public.products p where p.id = target and p.workspace_id = m.workspace_id) then
      card := jsonb_build_object('kind', 'link', 'link', jsonb_build_object('kind', 'product', 'productId', target));
    else
      card := null;
    end if;
  elsif kind = 'summary' and (card ->> 'of') in ('waiting', 'month') then
    card := jsonb_build_object('kind', 'summary', 'of', card ->> 'of');
  elsif kind = 'handover' then
    person := app.chat_person(m.workspace_id);
    if person is null then
      card := null;
      words := 'A person at Fume will answer you here.';
    else
      select split_part(p.name, ' ', 1) into person_name from public.profiles p where p.id = person;
      card := jsonb_build_object('kind', 'handover', 'userId', person,
        'reason', left(coalesce(nullif(trim(p_card ->> 'reason'), ''), 'This is one for a person at Fume.'), 200));
      if words = '' then words := 'That is one for a person. ' || person_name || ' at Fume will answer you here.'; end if;
    end if;
  else
    card := null;
  end if;
  if words = '' then perform app.fail('invalid', 'Fume''s answer is empty.'); end if;

  insert into public.conversation_messages (thread_id, workspace_id, author_kind, text, card, answers)
  values (into_thread, m.workspace_id, 'fume', left(words, 4000), card, m.id)
  returning * into answer;
  update public.conversation_threads set updated_at = answer.at where id = into_thread;

  if person is not null then
    update public.conversation_threads set handed_to = person, handed_at = answer.at where id = t.id;
    select coalesce(nullif(split_part(p.name, ' ', 1), ''), 'The customer') into customer
    from public.profiles p where p.id = m.author_id;
    perform app.notify(person, m.workspace_id, 'mention', null, 'chat:' || t.id,
      'Fume handed ' || customer || '''s question to you', customer || ' wrote {n} messages to you in the chat',
      app.staff_chat_href(m.workspace_id, t.id), null);
  end if;
  return app.message_json(answer);
end $$;
revoke execute on function public.fume_chat_answer(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.fume_chat_answer(uuid, text, jsonb) to service_role;

revoke execute on function app.thread_for(uuid, uuid) from public, anon, authenticated;
revoke execute on function app.chat_person(uuid) from public, anon, authenticated;
revoke execute on function public.say(uuid, text, uuid, jsonb, text) from public, anon;
grant execute on function public.say(uuid, text, uuid, jsonb, text) to authenticated;
revoke execute on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- The chat's runs are kept with the others, so they count against the week's ceiling.
alter table public.task_runs drop constraint if exists task_runs_kind_check;
alter table public.task_runs add constraint task_runs_kind_check check (kind in ('plan', 'brief', 'chat'));
