-- The Brand Brain (docs/mvp/brand-brain.md): one knowledge graph per brand. A node is one thing Fume knows (a colour,
-- a product, a fact, a rule, an audience, a change request and its reason), with where it came from, who said it, how
-- sure Fume is and its state; an edge is a typed link between two nodes. Nodes that mirror an existing row (ref_table,
-- ref_key) are kept in step with it: a change to those tables marks the brand, and the next read brings the graph up
-- to date. Knowledge with no table of its own (an audience, a competitor, a season, something said) is a note, written
-- by brain_note. brain_context gives the bundle the chat, the plan writer and the Engine read.

create table public.brain_nodes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  layer text not null check (layer in ('identity', 'products', 'rules', 'taste', 'market', 'memory', 'sources')),
  kind text not null,
  -- The row it mirrors, or null for a note.
  ref_table text,
  ref_key text,
  label text not null,
  body jsonb not null default '{}',
  origin text not null default 'engine' check (origin in ('engine', 'customer', 'fume', 'learned')),
  state text not null default 'proposed' check (state in ('proposed', 'approved', 'changed', 'removed', 'contradicted')),
  confidence text check (confidence in ('high', 'medium', 'low')),
  source_id uuid references public.sources (id) on delete set null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, ref_table, ref_key)
);
create index on public.brain_nodes (workspace_id, layer, kind);
create index on public.brain_nodes (source_id);
create index on public.brain_nodes (created_by);

create table public.brain_edges (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  from_id uuid not null references public.brain_nodes (id) on delete cascade,
  to_id uuid not null references public.brain_nodes (id) on delete cascade,
  kind text not null check (kind in (
    'about', 'shows', 'uses', 'for', 'from', 'part_of', 'rejected_because', 'replaces', 'contradicts', 'approved', 'related'
  )),
  -- sync: drawn from the existing tables (redrawn on every sync); otherwise someone drew it.
  origin text not null default 'sync' check (origin in ('sync', 'engine', 'customer', 'fume', 'learned')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (from_id, to_id, kind)
);
create index on public.brain_edges (workspace_id, origin);
create index on public.brain_edges (to_id);
create index on public.brain_edges (created_by);

-- Brands whose graph is behind their tables.
create table app.brain_dirty (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  at timestamptz not null default now()
);

alter table public.brain_nodes enable row level security;
alter table public.brain_edges enable row level security;
create policy brain_nodes_read on public.brain_nodes for select to authenticated using (app.can_read(workspace_id));
create policy brain_edges_read on public.brain_edges for select to authenticated using (app.can_read(workspace_id));
grant select on public.brain_nodes, public.brain_edges to authenticated;

-- ─── Keeping it in step ──────────────────────────────────────────────────────

create or replace function app.brain_mark() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ws uuid := coalesce((to_jsonb(new) ->> 'workspace_id')::uuid, (to_jsonb(old) ->> 'workspace_id')::uuid);
begin
  if ws is not null then
    insert into app.brain_dirty (workspace_id) values (ws) on conflict (workspace_id) do update set at = now();
  end if;
  return null;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array['brand_dna_versions', 'brand_rules', 'products', 'product_facts', 'sources', 'campaigns',
    'campaign_products', 'approvals', 'change_requests', 'expert_checks'] loop
    execute format('create trigger brain_mark after insert or update or delete on public.%I for each row execute function app.brain_mark()', t);
  end loop;
end $$;

create or replace function app.brain_origin(o text) returns text
language sql immutable set search_path = '' as $$
  select case o when 'customer' then 'customer' when 'supplied' then 'customer' when 'fume' then 'fume'
    when 'expert' then 'fume' when 'learned' then 'learned' when 'campaign' then 'learned' else 'engine' end
$$;

create or replace function app.brain_put(
  ws uuid, p_layer text, p_kind text, p_table text, p_key text, p_label text, p_body jsonb, p_origin text,
  p_state text, p_confidence text default null, p_source uuid default null
) returns uuid
language sql security definer set search_path = '' as $$
  insert into public.brain_nodes (workspace_id, layer, kind, ref_table, ref_key, label, body, origin, state, confidence, source_id)
  values (ws, p_layer, p_kind, p_table, p_key, left(coalesce(nullif(trim(p_label), ''), p_kind), 300), coalesce(p_body, '{}'),
          app.brain_origin(p_origin), coalesce(p_state, 'proposed'), p_confidence, p_source)
  on conflict (workspace_id, ref_table, ref_key) do update set
    layer = excluded.layer, kind = excluded.kind, label = excluded.label, body = excluded.body, origin = excluded.origin,
    state = excluded.state, confidence = excluded.confidence, source_id = excluded.source_id,
    updated_at = case when (brain_nodes.label, brain_nodes.body, brain_nodes.state)
      is distinct from (excluded.label, excluded.body, excluded.state) then now() else brain_nodes.updated_at end
  returning id
$$;

create or replace function app.brain_edge(ws uuid, p_from uuid, p_to uuid, p_kind text) returns void
language sql security definer set search_path = '' as $$
  insert into public.brain_edges (workspace_id, from_id, to_id, kind)
  select ws, p_from, p_to, p_kind where p_from is not null and p_to is not null and p_from <> p_to
  on conflict (from_id, to_id, kind) do nothing
$$;

create or replace function app.brain_node(ws uuid, p_table text, p_key text) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.brain_nodes where workspace_id = ws and ref_table = p_table and ref_key = p_key
$$;

create or replace function app.brain_who(p uuid) returns text
language sql stable security definer set search_path = '' as $$
  select split_part(name, ' ', 1) from public.profiles where id = p
$$;

-- Bring one brand's graph up to date with its tables. Notes and the edges people drew stay as they are.
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
  delete from public.brain_nodes where workspace_id = ws and ref_table is not null and not (ref_table || '|' || ref_key = any (seen));

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

create or replace function app.brain_fresh(ws uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from app.brain_dirty where workspace_id = ws)
     or not exists (select 1 from public.brain_nodes where workspace_id = ws) then
    perform app.brain_sync(ws);
  end if;
end $$;

revoke execute on function app.brain_mark(), app.brain_origin(text),
  app.brain_put(uuid, text, text, text, text, text, jsonb, text, text, text, uuid), app.brain_edge(uuid, uuid, uuid, text),
  app.brain_node(uuid, text, text), app.brain_who(uuid), app.brain_sync(uuid), app.brain_fresh(uuid) from public, anon;

-- ─── Notes: knowledge with no table of its own ────────────────────────────────

-- An audience, a market, a channel, a competitor, a season, a taste reason, a rule said in words. The brand's owner or
-- approver writes approved knowledge; anyone else on the brand, Fume's or the agency's people propose it. links: the
-- nodes it is about ([{to, kind}]).
create or replace function public.brain_note(
  p_workspace_id uuid, p_layer text, p_kind text, p_label text, p_body jsonb default '{}', p_links jsonb default '[]'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  n public.brain_nodes;
  l jsonb;
begin
  perform app.require_user();
  if not app.can_read(p_workspace_id) then perform app.fail('not_found', 'No such brand.'); end if;
  if not app.product_writer(p_workspace_id) then perform app.fail('forbidden', 'Only the people on the brand add to what Fume knows.'); end if;
  if p_layer not in ('identity', 'products', 'rules', 'taste', 'market', 'memory') or nullif(trim(coalesce(p_kind, '')), '') is null
     or nullif(trim(coalesce(p_label, '')), '') is null then
    perform app.fail('invalid', 'Say what Fume should know.');
  end if;
  perform app.brain_fresh(p_workspace_id);
  insert into public.brain_nodes (workspace_id, layer, kind, label, body, origin, state, created_by)
  values (p_workspace_id, p_layer, left(trim(p_kind), 40), left(trim(p_label), 300), coalesce(p_body, '{}'),
          case when app.customer_role(p_workspace_id) is not null then 'customer' else 'fume' end,
          case when app.customer_is(p_workspace_id, array['owner', 'approver']) then 'approved' else 'proposed' end,
          auth.uid())
  returning * into n;
  for l in select * from jsonb_array_elements(coalesce(p_links, '[]')) loop
    if not exists (select 1 from public.brain_nodes where id = (l ->> 'to')::uuid and workspace_id = p_workspace_id) then
      perform app.fail('invalid', 'It can only link to what this brand knows.');
    end if;
    insert into public.brain_edges (workspace_id, from_id, to_id, kind, origin, created_by)
    values (p_workspace_id, n.id, (l ->> 'to')::uuid, coalesce(l ->> 'kind', 'about'), n.origin, auth.uid())
    on conflict (from_id, to_id, kind) do nothing;
  end loop;
  perform app.record(p_workspace_id, 'brain.noted', 'brain_node', n.id, jsonb_build_object('layer', n.layer, 'kind', n.kind));
  return to_jsonb(n);
end $$;

-- The owner or approver keeps or removes a note someone proposed. A mirrored node is decided where it lives (the Brand
-- DNA, the product).
create or replace function public.decide_brain_note(p_node_id uuid, p_verdict text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  n public.brain_nodes;
begin
  perform app.require_user();
  select * into n from public.brain_nodes where id = p_node_id for update;
  if not found or not app.can_read(n.workspace_id) then perform app.fail('not_found', 'Fume knows nothing by that name.'); end if;
  if n.ref_table is not null then perform app.fail('invalid', 'Decide this where it lives: the Brand DNA or the product.'); end if;
  if not app.customer_is(n.workspace_id, array['owner', 'approver']) then
    perform app.fail('forbidden', 'Only the brand''s owner or approver decides what Fume keeps.');
  end if;
  if p_verdict not in ('keep', 'remove') then perform app.fail('invalid', 'Keep or remove it.'); end if;
  update public.brain_nodes set state = case p_verdict when 'keep' then 'approved' else 'removed' end, updated_at = now()
  where id = n.id returning * into n;
  return to_jsonb(n);
end $$;

-- ─── What the chat, the plan writer and the Engine read ──────────────────────

-- The brand in one small bundle: what is approved, and what is only proposed (marked), never what was removed. With a
-- campaign: its products and what the brand said in its earlier campaigns. Readable by the brand's people and by the
-- service (the edge functions).
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
      from public.brain_nodes where workspace_id = p_workspace_id and layer = 'taste' and state <> 'removed'),
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

revoke execute on function public.brain_note(uuid, text, text, text, jsonb, jsonb), public.decide_brain_note(uuid, text),
  public.brain_context(uuid, uuid) from public, anon;
grant execute on function public.brain_note(uuid, text, text, text, jsonb, jsonb), public.decide_brain_note(uuid, text),
  public.brain_context(uuid, uuid) to authenticated, service_role;
