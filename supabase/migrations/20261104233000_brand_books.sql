-- The brand's books (docs/mvp/brand-books.md; Marcus, 4 Nov 2026): every brand gets a long Tone of Voice and a full
-- design system of tokens with examples of graphic design, so the Engine's words and layouts are the brand's own.
-- Fume writes a book from what it knows about the brand (the edge function `brand-book`), an expert checks it, and
-- only the customer approves it. Each is versioned: the approved version is the one in use until a newer one is
-- approved. A customer never sees a book that is being written or not yet checked.

create table public.brand_books (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null check (kind in ('voice', 'design')),
  version int not null,
  state text not null default 'writing'
    check (state in ('writing', 'failed', 'draft', 'checked', 'changes_asked', 'approved', 'superseded')),
  body jsonb not null default '{}',
  -- What it was written from: the brand's knowledge (node ids), the pages read, the previous version and the ask.
  sources jsonb not null default '{}',
  -- A customer's or an expert's words for the next version.
  ask text,
  error text,
  attempts int not null default 0,
  model text,
  llm_usd numeric(10, 4) not null default 0,
  started_at timestamptz,
  written_at timestamptz,
  checked_by uuid references public.profiles (id),
  checked_at timestamptz,
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (workspace_id, kind, version)
);
create index on public.brand_books (workspace_id, kind, state);
create index on public.brand_books (checked_by);
create index on public.brand_books (approved_by);
create index on public.brand_books (created_by);
alter table public.brand_books enable row level security;
-- The brand's own people read what an expert checked; Fume's and the agency's people read every version.
create policy brand_books_read on public.brand_books for select to authenticated using (
  app.is_staff(workspace_id) or (app.can_read(workspace_id) and state in ('checked', 'approved', 'superseded'))
);
grant select on public.brand_books to authenticated;

-- Fume writes a new version: the people who run the brand, or its owner or approver (with what they want changed).
create or replace function public.write_brand_book(p_workspace_id uuid, p_kind text, p_ask text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  b public.brand_books;
begin
  perform app.require_user();
  if not app.can_read(p_workspace_id) then perform app.fail('not_found', 'No such brand.'); end if;
  if not app.brand_writer(p_workspace_id) then
    perform app.fail('forbidden', 'Only the people who run the brand, or its owner or approver, ask for this.');
  end if;
  if p_kind not in ('voice', 'design') then perform app.fail('invalid', 'A Tone of Voice or a design system.'); end if;
  if length(coalesce(p_ask, '')) > 2000 then perform app.fail('invalid', 'Say it in fewer words.'); end if;
  -- One at a time: the one being written is the answer.
  select * into b from public.brand_books where workspace_id = p_workspace_id and kind = p_kind and state = 'writing';
  if found then return to_jsonb(b); end if;
  insert into public.brand_books (workspace_id, kind, version, ask, created_by)
  values (p_workspace_id, p_kind,
    coalesce((select max(version) from public.brand_books where workspace_id = p_workspace_id and kind = p_kind), 0) + 1,
    nullif(btrim(coalesce(p_ask, '')), ''), auth.uid())
  returning * into b;
  perform app.record(p_workspace_id, 'brand_book.writing', 'brand_book', b.id, jsonb_build_object('kind', p_kind, 'version', b.version));
  return to_jsonb(b);
end $$;

-- The writer (service) takes the work: what Fume knows about the brand, and the version this one follows.
create or replace function public.brand_book_take(p_book_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  b public.brand_books;
  d public.brand_dna_versions;
  prev public.brand_books;
  site text;
begin
  select * into b from public.brand_books where id = p_book_id for update;
  if not found then return null; end if;
  -- A writing that never came back is taken again after four minutes; three tries in all.
  if b.state <> 'writing' or (b.started_at is not null and b.started_at > now() - interval '4 minutes') then return null; end if;
  if b.attempts >= 3 then
    update public.brand_books set state = 'failed', error = coalesce(error, 'Fume tried three times.') where id = b.id;
    return null;
  end if;
  if not (public.fume_llm_budget() ->> 'allowed')::boolean then
    update public.brand_books set state = 'failed', error = 'This week''s budget for Fume''s language model is used up.' where id = b.id;
    return null;
  end if;
  update public.brand_books set attempts = attempts + 1, started_at = now() where id = b.id returning * into b;

  select * into d from public.brand_dna_versions where workspace_id = b.workspace_id and state <> 'superseded'
  order by version desc limit 1;
  select * into prev from public.brand_books where workspace_id = b.workspace_id and kind = b.kind and version < b.version
    and state in ('draft', 'checked', 'changes_asked', 'approved', 'superseded')
  order by (state = 'approved') desc, version desc limit 1;
  select coalesce(
    (select s.url from public.brand_scans s where s.workspace_id = b.workspace_id and s.url like 'https://%' order by s.created_at desc limit 1),
    (select s.url from public.sources s where s.workspace_id = b.workspace_id and s.kind = 'website' and s.url like 'https://%' order by s.created_at limit 1)
  ) into site;

  return jsonb_build_object(
    'book', jsonb_build_object('id', b.id, 'workspace_id', b.workspace_id, 'kind', b.kind, 'version', b.version,
      'ask', b.ask, 'attempt', b.attempts),
    'brand', public.brain_context(b.workspace_id),
    -- The Brand DNA's identity as read and kept (voice lines with their examples, typefaces with their CSS, logos,
    -- colours with their use, pictures) and every rule, the words' as well as the pictures'.
    'identity', coalesce(d.identity, '{}'),
    'dna_state', d.state,
    'rules', coalesce((select jsonb_agg(jsonb_build_object('area', r.area, 'kind', r.kind, 'statement', r.statement, 'origin', r.origin)
        order by r.area, r.created_at) from public.brand_rules r where r.brand_dna_version_id = d.id), '[]'),
    'claims', coalesce((select jsonb_agg(jsonb_build_object('product', p.name, 'claim', f.statement, 'verified', f.status = 'verified'))
        from public.product_facts f join public.products p on p.id = f.product_id
        where f.workspace_id = b.workspace_id and f.area = 'claim' and f.superseded_by is null), '[]'),
    'website', site,
    'previous', case when prev.id is null then null else jsonb_build_object('version', prev.version, 'state', prev.state, 'body', prev.body) end,
    -- For a design system: the approved Tone of Voice, so the examples speak in the brand's words.
    'voice', case when b.kind = 'design' then (
      select bb.body from public.brand_books bb where bb.workspace_id = b.workspace_id and bb.kind = 'voice'
      and bb.state in ('approved', 'checked', 'draft') order by (bb.state = 'approved') desc, bb.version desc limit 1) end
  );
end $$;

-- The writer hands the book back. Code checked its shape and its colours' contrast before; here the parts that must be
-- there are checked once more.
create or replace function public.brand_book_finish(p_book_id uuid, p_body jsonb, p_sources jsonb, p_model text, p_llm_usd numeric)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  b public.brand_books;
begin
  select * into b from public.brand_books where id = p_book_id for update;
  if not found or b.state <> 'writing' then return null; end if;
  if jsonb_typeof(p_body) <> 'object' or (b.kind = 'voice' and not (p_body ? 'identity' and p_body ? 'speak' and p_body ? 'examples'))
     or (b.kind = 'design' and not (p_body ? 'tokens' and p_body ? 'css' and p_body ? 'examples')) then
    perform app.fail('invalid', 'The book is missing a part it must have.');
  end if;
  update public.brand_books set state = 'draft', body = p_body, sources = coalesce(p_sources, '{}'), model = p_model,
    llm_usd = llm_usd + greatest(coalesce(p_llm_usd, 0), 0), error = null, written_at = now()
  where id = b.id returning * into b;
  perform app.record(b.workspace_id, 'brand_book.written', 'brand_book', b.id, jsonb_build_object('kind', b.kind, 'version', b.version));
  return to_jsonb(b);
end $$;

create or replace function public.brand_book_fail(p_book_id uuid, p_error text, p_llm_usd numeric, p_final boolean default false)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.brand_books set error = left(p_error, 500), llm_usd = llm_usd + greatest(coalesce(p_llm_usd, 0), 0),
    state = case when p_final or attempts >= 3 then 'failed' else state end, started_at = case when p_final then started_at else null end
  where id = p_book_id and state = 'writing';
end $$;

-- An expert checks a draft before the customer sees it.
create or replace function public.check_brand_book(p_book_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  b public.brand_books;
begin
  perform app.require_user();
  select * into b from public.brand_books where id = p_book_id for update;
  if not found or not app.is_staff(b.workspace_id) then perform app.fail('not_found', 'No such book.'); end if;
  if not app.can_check(b.workspace_id) then perform app.fail('forbidden', 'An expert checks it.'); end if;
  if b.state <> 'draft' then perform app.fail('conflict', 'Only a draft is checked.'); end if;
  update public.brand_books set state = 'checked', checked_by = auth.uid(), checked_at = now() where id = b.id returning * into b;
  perform app.record(b.workspace_id, 'brand_book.checked', 'brand_book', b.id, jsonb_build_object('kind', b.kind, 'version', b.version));
  return to_jsonb(b);
end $$;

-- Only the customer approves: the owner or approver. The version it replaces is superseded.
create or replace function public.approve_brand_book(p_book_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  b public.brand_books;
begin
  perform app.require_user();
  select * into b from public.brand_books where id = p_book_id for update;
  if not found or not app.can_read(b.workspace_id) or b.state not in ('checked', 'approved', 'superseded', 'changes_asked') then
    perform app.fail('not_found', 'No such book.');
  end if;
  if not app.customer_is(b.workspace_id, array['owner', 'approver']) then
    perform app.fail('forbidden', 'Only the brand''s owner or approver approves it.');
  end if;
  if b.state <> 'checked' then perform app.fail('conflict', 'Only a checked version is approved.'); end if;
  update public.brand_books set state = 'superseded' where workspace_id = b.workspace_id and kind = b.kind and state = 'approved';
  update public.brand_books set state = 'approved', approved_by = auth.uid(), approved_at = now() where id = b.id returning * into b;
  perform app.record(b.workspace_id, 'brand_book.approved', 'brand_book', b.id, jsonb_build_object('kind', b.kind, 'version', b.version));
  return to_jsonb(b);
end $$;

-- The customer asks for a change: this version waits, and Fume writes the next one with their words.
create or replace function public.ask_brand_book_change(p_book_id uuid, p_ask text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  b public.brand_books;
begin
  perform app.require_user();
  select * into b from public.brand_books where id = p_book_id for update;
  if not found or not app.can_read(b.workspace_id) or b.state not in ('checked', 'approved', 'superseded', 'changes_asked') then
    perform app.fail('not_found', 'No such book.');
  end if;
  if not app.customer_is(b.workspace_id, array['owner', 'approver']) then
    perform app.fail('forbidden', 'Only the brand''s owner or approver asks for a change.');
  end if;
  if nullif(btrim(coalesce(p_ask, '')), '') is null then perform app.fail('invalid', 'Say what should change.'); end if;
  if b.state = 'checked' then update public.brand_books set state = 'changes_asked' where id = b.id; end if;
  return public.write_brand_book(b.workspace_id, b.kind, p_ask);
end $$;

revoke execute on function public.brand_book_take(uuid), public.brand_book_finish(uuid, jsonb, jsonb, text, numeric),
  public.brand_book_fail(uuid, text, numeric, boolean) from public, anon, authenticated;
grant execute on function public.brand_book_take(uuid), public.brand_book_finish(uuid, jsonb, jsonb, text, numeric),
  public.brand_book_fail(uuid, text, numeric, boolean) to service_role;
revoke execute on function public.write_brand_book(uuid, text, text), public.check_brand_book(uuid),
  public.approve_brand_book(uuid), public.ask_brand_book_change(uuid, text) from public, anon;
grant execute on function public.write_brand_book(uuid, text, text), public.check_brand_book(uuid),
  public.approve_brand_book(uuid), public.ask_brand_book_change(uuid, text) to authenticated;

-- The language model's week counts writing the books too.
create or replace function public.fume_llm_budget() returns jsonb
language sql stable security definer set search_path = '' as $$
  with spent as (
    select (
      coalesce((select sum(cost_usd) from public.task_runs where started_at > now() - interval '7 days'), 0)
      + coalesce((select sum(llm_usd) from public.engine_prompts where created_at > now() - interval '7 days'), 0)
      + coalesce((select sum(llm_usd) from public.engine_lessons where updated_at > now() - interval '7 days'), 0)
      + coalesce((select sum(evaluation_usd) from public.candidates where created_at > now() - interval '7 days'), 0)
      + coalesce((select sum(llm_usd) from public.brand_books where created_at > now() - interval '7 days'), 0)
    )::numeric as usd
  ), cap as (
    select coalesce((select (value #>> '{}')::numeric from app.settings where key = 'llm_week_usd'), 0) as usd
  )
  select jsonb_build_object('spent_usd', spent.usd, 'cap_usd', cap.usd, 'allowed', spent.usd < cap.usd) from spent, cap
$$;
