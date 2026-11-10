-- The Engine chat, live (FLOWS §19, §29, §34.1, §35.7, §36.2): Fume's people talk with the Engine about a brand, in
-- threads. A brand has its Everything thread (no topic) and one per campaign. The Engine never talks to a customer, so
-- only Fume's people on the brand read and write here. A person's words are kept by engine_say; the edge function
-- `engine-chat` reads what the Engine may know (engine_chat_context) and keeps its answer (engine_chat_answer), once.
-- "Write with Engine" asks for words for one field (engine_write_context); the words go back to the one who asked and
-- are kept only when she keeps them in the field.

create table public.engine_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- None: the brand's Everything thread.
  campaign_id uuid references public.campaigns (id) on delete cascade,
  -- None: the Engine.
  author_id uuid references public.profiles (id),
  text text not null check (length(text) <= 4000),
  -- The person's message it answers (the Engine's only).
  answers uuid references public.engine_messages (id) on delete cascade,
  -- The field she asked about ("Ask about this"), and the part of the project she wrote from.
  field jsonb,
  page text check (length(page) <= 80),
  -- What the Engine shows with its answer: words for the field, or the creatives in Check it is about.
  widget jsonb,
  answer jsonb,
  created_at timestamptz not null default now()
);
create index engine_messages_thread on public.engine_messages (workspace_id, campaign_id, created_at);
create index engine_messages_campaign on public.engine_messages (campaign_id);
create index engine_messages_author on public.engine_messages (author_id);
create unique index engine_messages_answers on public.engine_messages (answers);
alter table public.engine_messages enable row level security;
create policy engine_messages_read on public.engine_messages for select to authenticated using (app.is_staff(workspace_id));
grant select on public.engine_messages to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'engine_messages') then
    alter publication supabase_realtime add table public.engine_messages;
  end if;
end $$;

alter table public.task_runs drop constraint if exists task_runs_kind_check;
alter table public.task_runs add constraint task_runs_kind_check
  check (kind in ('plan', 'brief', 'chat', 'facts', 'engine_chat', 'engine_write'));

-- A person's words to the Engine. Fume's people on the brand only.
create or replace function public.engine_say(
  p_workspace_id uuid, p_text text, p_campaign_id uuid default null, p_field jsonb default null, p_page text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  words text := btrim(coalesce(p_text, ''));
  m public.engine_messages;
begin
  if auth.uid() is null then perform app.fail('forbidden', 'Sign in first.'); end if;
  if not app.is_staff(p_workspace_id) then perform app.fail('not_found', 'No such brand.'); end if;
  if words = '' then perform app.fail('invalid', 'Say something to the Engine.'); end if;
  if length(words) > 4000 then perform app.fail('invalid', 'Keep it under 4,000 characters.'); end if;
  if p_campaign_id is not null
     and not exists (select 1 from public.campaigns where id = p_campaign_id and workspace_id = p_workspace_id) then
    perform app.fail('not_found', 'No such campaign.');
  end if;
  insert into public.engine_messages (workspace_id, campaign_id, author_id, text, field, page)
  values (p_workspace_id, p_campaign_id, auth.uid(), words,
    case when jsonb_typeof(p_field) = 'object' then p_field end, nullif(left(btrim(coalesce(p_page, '')), 80), ''))
  returning * into m;
  return to_jsonb(m);
end $$;
revoke execute on function public.engine_say(uuid, text, uuid, jsonb, text) from public, anon;
grant execute on function public.engine_say(uuid, text, uuid, jsonb, text) to authenticated;

-- What the Engine knows when it answers in a brand's thread: the brand, its rules and voice, its campaigns with their
-- brief and plan, what waits in Check, and the thread so far.
create or replace function app.engine_knows(p_workspace_id uuid, p_campaign_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with dna as (
    select d.id from public.brand_dna_versions d
    where d.workspace_id = p_workspace_id and d.state = 'approved' order by d.version desc limit 1
  ),
  latest as (
    select distinct on (v.creative_id) v.id, v.creative_id, v.state, v.sent_at, c.campaign_id, c.title, c.format, c.kind
    from public.creative_versions v join public.creatives c on c.id = v.creative_id
    where c.workspace_id = p_workspace_id
    order by v.creative_id, v.number desc
  )
  select jsonb_build_object(
    'brand', (select jsonb_build_object('name', w.brand_name, 'market', w.market, 'language', w.language)
              from public.workspaces w where w.id = p_workspace_id),
    'rules', (select coalesce(jsonb_agg(jsonb_build_object('area', r.area, 'kind', r.kind, 'rule', r.statement)
                order by r.area), '[]')
              from public.brand_rules r where r.brand_dna_version_id = (select id from dna)),
    'voice', (select b.body from public.brand_books b
              where b.workspace_id = p_workspace_id and b.kind = 'voice' and b.state in ('approved', 'checked', 'draft')
              order by (b.state = 'approved') desc, b.version desc limit 1),
    'campaigns', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'stage', c.stage, 'state', c.state, 'due_at', c.due_at,
        'products', (select coalesce(jsonb_agg(pr.name order by pr.name), '[]')
                     from public.campaign_products cp join public.products pr on pr.id = cp.product_id
                     where cp.campaign_id = c.id)
      ) order by c.created_at desc), '[]')
      from public.campaigns c where c.workspace_id = p_workspace_id
    ),
    'campaign', (
      select jsonb_build_object(
        'id', c.id, 'name', c.name,
        'brief', (select b.body from public.brief_versions b where b.campaign_id = c.id order by b.version desc limit 1),
        'plan', (select jsonb_build_object('version', p.version, 'state', p.state, 'body', p.body)
                 from public.plan_versions p where p.campaign_id = c.id and p.state <> 'superseded'
                 order by p.version desc limit 1))
      from public.campaigns c where c.id = p_campaign_id and c.workspace_id = p_workspace_id
    ),
    'in_check', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'version_id', l.id, 'title', l.title, 'format', l.format, 'kind', l.kind,
        'state', case l.state when 'correcting' then 'with a designer for a fix' when 'held' then 'held' else 'waiting for a check' end,
        'campaign', (select c.name from public.campaigns c where c.id = l.campaign_id),
        'due_at', (select c.due_at from public.campaigns c where c.id = l.campaign_id)
      ) order by (select c.due_at from public.campaigns c where c.id = l.campaign_id) nulls last), '[]')
      from latest l
      where l.state in ('in_check', 'correcting', 'held') and (p_campaign_id is null or l.campaign_id = p_campaign_id)
    )
  )
$$;
revoke execute on function app.engine_knows(uuid, uuid) from public, anon, authenticated;

create or replace function public.engine_chat_context(p_message_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with m as (select * from public.engine_messages where id = p_message_id)
  select jsonb_build_object(
    'message', (select jsonb_build_object('id', m.id, 'workspace_id', m.workspace_id, 'campaign_id', m.campaign_id,
                 'text', m.text, 'field', m.field, 'page', m.page, 'at', m.created_at,
                 'by', (select split_part(p.name, ' ', 1) from public.profiles p where p.id = m.author_id)) from m),
    'answer', (select m.author_id is not null and not exists (select 1 from public.engine_messages a where a.answers = m.id) from m),
    'talk', (
      select coalesce(jsonb_agg(jsonb_build_object('from', case when h.author_id is null then 'engine' else 'person' end,
               'text', h.text, 'at', h.created_at) order by h.created_at), '[]')
      from (select * from public.engine_messages h
            where h.workspace_id = (select workspace_id from m)
              and h.campaign_id is not distinct from (select campaign_id from m)
              and h.created_at <= (select created_at from m) and h.id <> (select id from m)
            order by h.created_at desc limit 20) h
    ),
    'knows', app.engine_knows((select workspace_id from m), (select campaign_id from m))
  )
$$;
revoke execute on function public.engine_chat_context(uuid) from public, anon, authenticated;
grant execute on function public.engine_chat_context(uuid) to service_role;

-- The Engine's answer to one message, in the same thread; once. Check answers name only versions of this brand in
-- Check; words for a field go back with the field she asked about.
create or replace function public.engine_chat_answer(
  p_message_id uuid, p_text text, p_items uuid[] default null, p_suggestion text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m public.engine_messages;
  a public.engine_messages;
  items uuid[];
begin
  select * into m from public.engine_messages where id = p_message_id;
  if not found then perform app.fail('not_found', 'No such message.'); end if;
  if m.author_id is null or exists (select 1 from public.engine_messages x where x.answers = m.id) then return null; end if;
  select array_agg(v.id) into items from public.creative_versions v
  where v.id = any (coalesce(p_items, '{}')) and v.workspace_id = m.workspace_id and v.state in ('in_check', 'correcting', 'held');
  insert into public.engine_messages (workspace_id, campaign_id, text, answers, widget, answer)
  values (m.workspace_id, m.campaign_id, left(coalesce(nullif(btrim(p_text), ''), 'I could not answer that just now.'), 4000), m.id,
    case when m.field is not null and nullif(btrim(p_suggestion), '') is not null
      then jsonb_build_object('kind', 'suggestion', 'field', m.field, 'text', left(btrim(p_suggestion), 2000)) end,
    case when items is not null then jsonb_build_object('kind', 'check', 'itemIds', to_jsonb(items)) end)
  returning * into a;
  return to_jsonb(a);
end $$;
revoke execute on function public.engine_chat_answer(uuid, text, uuid[], text) from public, anon, authenticated;
grant execute on function public.engine_chat_answer(uuid, text, uuid[], text) to service_role;

-- "Write with Engine": what the Engine knows for words in one field, asked as the one who writes (Fume's people on the
-- brand). The field names the campaign, or the brand for a line of a book.
create or replace function public.engine_write_context(p_field jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  ws uuid;
  campaign uuid;
begin
  if auth.uid() is null then perform app.fail('forbidden', 'Sign in first.'); end if;
  if p_field ->> 'kind' in ('plan_line', 'plan_creative') then
    campaign := (p_field ->> 'campaignId')::uuid;
    select workspace_id into ws from public.campaigns where id = campaign;
  elsif p_field ->> 'kind' = 'book_line' then
    ws := (p_field ->> 'workspaceId')::uuid;
  else
    perform app.fail('invalid', 'The Engine writes a line of a plan or of a brand book.');
  end if;
  if ws is null or not app.is_staff(ws) then perform app.fail('not_found', 'No such field.'); end if;
  return jsonb_build_object('workspace_id', ws, 'field', p_field, 'knows', app.engine_knows(ws, campaign));
end $$;
revoke execute on function public.engine_write_context(jsonb) from public, anon;
grant execute on function public.engine_write_context(jsonb) to authenticated;
