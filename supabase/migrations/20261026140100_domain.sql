-- The MVP domain (docs/mvp/domain-model.md): context, campaign, production, creatives and their checks and decisions,
-- delivery, and the record. The relational database is the knowledge graph: rows are objects, foreign keys are typed
-- relationships, and every fact and decision says who, when and against which version.
--
-- Read rules here; write rules in *_commands.sql. Three kinds of rows:
--   shared   both sides of a workspace read them (app.can_read).
--   staff    Fume's people only: lineage, jobs, candidates, automated findings (ARCHITECTURE §1, principle 2).
--   gated    the customer reads a creative version only once it is checked and sent (F-D025).

-- ─── Files ───────────────────────────────────────────────────────────────────

-- A file in the private bucket "workspace-files", stored at <workspace_id>/<file id>. The checksum ties a delivery to
-- the exact bytes that were approved.
create table public.files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  bucket text not null default 'workspace-files',
  path text not null unique,
  name text not null,
  content_type text not null,
  bytes bigint not null default 0,
  sha256 text,
  width int,
  height int,
  -- source: brand and product material; candidate: made in production, staff only until it becomes a checked version.
  purpose text not null default 'source' check (purpose in ('source', 'candidate', 'delivery')),
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ─── Context: sources, Brand DNA, Product Truth ──────────────────────────────

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null check (kind in ('logo', 'guideline', 'packshot', 'campaign', 'font', 'website', 'other')),
  name text not null,
  file_id uuid references public.files (id),
  url text,
  retrieved_at timestamptz,
  usage_rights text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.brand_dna_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  version int not null,
  state text not null default 'draft' check (state in ('draft', 'in_review', 'approved', 'superseded')),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, version)
);

create table public.brand_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  brand_dna_version_id uuid not null references public.brand_dna_versions (id) on delete cascade,
  area text not null check (area in ('logo', 'colour', 'type', 'voice', 'layout', 'imagery', 'claims')),
  statement text not null,
  kind text not null check (kind in ('rule', 'hard_constraint', 'preference')),
  origin text not null default 'supplied' check (origin in ('supplied', 'inferred', 'learned')),
  source_id uuid references public.sources (id),
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  variant text not null default '',
  sku text,
  created_at timestamptz not null default now()
);

-- A fact about a product (an assertion). Unknown stays unknown; a correction writes a new row and supersedes the old,
-- so a job's snapshot keeps pointing at what it used.
create table public.product_facts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  area text not null check (area in ('shape', 'colour', 'material', 'label', 'packaging', 'claim', 'never')),
  label text not null,
  statement text not null,
  origin text not null default 'supplied' check (origin in ('supplied', 'inferred', 'learned', 'campaign')),
  status text not null default 'unverified' check (status in ('unverified', 'verified', 'conflict')),
  -- Production that depends on this product waits until a required fact is verified.
  required boolean not null default false,
  source_id uuid references public.sources (id),
  source_location text,
  verified_by uuid references public.profiles (id),
  verified_at timestamptz,
  superseded_by uuid references public.product_facts (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ─── Campaign, brief, plan ───────────────────────────────────────────────────

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  state text not null default 'draft' check (
    state in ('draft', 'awaiting_input', 'scoped', 'in_production', 'in_review', 'revision', 'approved', 'delivered', 'closed')
  ),
  stage text not null default 'brief' check (stage in ('brief', 'plan', 'masters', 'variants', 'delivery')),
  approver_id uuid references public.profiles (id),
  rounds_included int not null default 2,
  rounds_used int not null default 0,
  due_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.campaign_products (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  product_id uuid not null references public.products (id),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  primary key (campaign_id, product_id)
);

-- The customer's order (T02). Every send is a new version; none is overwritten.
create table public.brief_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  version int not null,
  body jsonb not null,
  sent_by uuid references public.profiles (id),
  sent_at timestamptz not null default now(),
  unique (campaign_id, version)
);

-- Fume's plan (T03, FLOWS §22). An approval belongs to one version.
create table public.plan_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  version int not null,
  brief_version_id uuid not null references public.brief_versions (id),
  brand_dna_version_id uuid references public.brand_dna_versions (id),
  body jsonb not null,
  state text not null default 'ready' check (state in ('writing', 'in_check', 'ready', 'changes_asked', 'approved', 'superseded')),
  check_asked_by uuid references public.profiles (id),
  checked_by uuid references public.profiles (id),
  checked_at timestamptz,
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  -- 'fume' when the LLM wrote it, else the person's id as text.
  written_by text not null,
  changes text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (campaign_id, version)
);

-- ─── Production ──────────────────────────────────────────────────────────────

-- What a job used, frozen when it starts: the brief, plan, Brand DNA, product facts (ids and statements), recipe and
-- references. New facts or rules never rewrite it.
create table public.context_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  brief_version_id uuid not null references public.brief_versions (id),
  plan_version_id uuid not null references public.plan_versions (id),
  brand_dna_version_id uuid references public.brand_dna_versions (id),
  facts jsonb not null,
  recipe jsonb not null,
  "references" jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table public.production_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  kind text not null check (kind in ('master', 'variant', 'format', 'correction')),
  -- For a correction, a variant or a format: the creative it makes a new version of, or derives from.
  creative_id uuid,
  master_version_id uuid,
  snapshot_id uuid not null references public.context_snapshots (id),
  -- queued → running → succeeded | failed | cancelled; unknown when the provider timed out and must be reconciled.
  state text not null default 'queued' check (state in ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'unknown')),
  mode text not null default 'engine' check (mode in ('engine', 'manual')),
  cost_cents int not null default 0,
  error text,
  requested_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.job_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  job_id uuid not null references public.production_jobs (id) on delete cascade,
  number int not null,
  provider text not null,
  model text,
  provider_job_id text,
  state text not null default 'running' check (state in ('running', 'succeeded', 'failed', 'unknown')),
  cost_cents int not null default 0,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (job_id, number)
);

-- A picture a job produced, by the Engine or by hand (manual production uses the same job and history).
create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  job_id uuid not null references public.production_jobs (id) on delete cascade,
  attempt_id uuid references public.job_attempts (id),
  file_id uuid not null references public.files (id),
  origin text not null check (origin in ('engine', 'manual')),
  note text,
  made_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ─── Creatives, versions, checks, decisions ──────────────────────────────────

create table public.creatives (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  -- Null for a master; a variant or a format points at its master.
  master_id uuid references public.creatives (id),
  kind text not null check (kind in ('master', 'variant', 'format')),
  format text not null check (format in ('feed', 'square', 'story', 'banner')),
  channel text not null default 'instagram',
  name text not null,
  title text not null,
  created_at timestamptz not null default now()
);

-- making → in_check → checked → (sent) → approved → delivered; in_check → correcting | held → in_check;
-- checked → changes_requested (the customer), which starts version n+1.
create table public.creative_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  creative_id uuid not null references public.creatives (id) on delete cascade,
  number int not null,
  state text not null check (
    state in ('making', 'in_check', 'correcting', 'held', 'checked', 'changes_requested', 'approved', 'delivered')
  ),
  file_id uuid references public.files (id),
  candidate_id uuid references public.candidates (id),
  job_id uuid references public.production_jobs (id),
  -- Derived from this exact master version (variants and formats).
  master_version_id uuid references public.creative_versions (id),
  held_reason text,
  -- When the operator sent it to the customer (FLOWS §25.3). Null means the customer cannot see it.
  sent_at timestamptz,
  sent_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (creative_id, number)
);

create table public.expert_checks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  version_id uuid not null unique references public.creative_versions (id) on delete cascade,
  state text not null default 'waiting' check (state in ('waiting', 'checked', 'correction', 'held')),
  -- What it was checked against (Product Truth and Brand Rules, by id), with pass or note per item.
  items jsonb not null default '[]',
  snapshot_id uuid references public.context_snapshots (id),
  expert_id uuid references public.profiles (id),
  decided_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create table public.findings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  version_id uuid not null references public.creative_versions (id) on delete cascade,
  method text not null check (method in ('automated', 'expert')),
  dimension text not null check (
    dimension in ('product', 'text_claims', 'brand_brief', 'composition', 'artefacts', 'file_spec', 'rights')
  ),
  severity text not null check (severity in ('critical', 'major', 'minor')),
  finding text not null,
  region jsonb,
  expected text,
  observed text,
  status text not null default 'open' check (status in ('open', 'resolved', 'accepted')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz
);

-- The customer's decision on one version. Only the customer approves (F-D077).
create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  version_id uuid not null references public.creative_versions (id) on delete cascade,
  decided_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  -- Undo, while nothing has been delivered from it.
  revoked_at timestamptz
);
create unique index approvals_one_live on public.approvals (version_id) where revoked_at is null;

-- T07. A correction is Fume's fault and uses no round; a revision uses one; a changed brief is scoped anew.
create table public.change_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  version_id uuid not null references public.creative_versions (id) on delete cascade,
  source text not null check (source in ('expert', 'customer')),
  cause text not null check (cause in ('correction', 'revision', 'changed_brief')),
  problem text not null,
  must_change jsonb not null default '[]',
  must_stay jsonb not null default '[]',
  pins jsonb not null default '[]',
  uses_round boolean not null,
  new_version_id uuid references public.creative_versions (id),
  by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  version_id uuid not null references public.creative_versions (id) on delete cascade,
  author uuid not null references public.profiles (id),
  text text not null,
  pin jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ─── Delivery ────────────────────────────────────────────────────────────────

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null,
  state text not null default 'ready' check (state in ('preparing', 'ready', 'downloaded', 'confirmed_live')),
  rights_note text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  downloaded_at timestamptz,
  confirmed_live_at timestamptz,
  confirmed_live_by uuid references public.profiles (id)
);

-- T08. One approved version and its exact file; a later version never replaces a delivered item.
create table public.delivery_items (
  delivery_id uuid not null references public.deliveries (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  creative_id uuid not null references public.creatives (id),
  version_id uuid not null references public.creative_versions (id),
  approval_id uuid not null references public.approvals (id),
  file_id uuid not null references public.files (id),
  sha256 text,
  filename text not null,
  primary key (delivery_id, version_id)
);

-- ─── The record and idempotency ──────────────────────────────────────────────

-- Append-only: who did what to which object, when (the record behind "who checked and who approved").
create table public.record_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor uuid references public.profiles (id),
  action text not null,
  subject_type text not null,
  subject_id uuid not null,
  detail jsonb not null default '{}',
  at timestamptz not null default now()
);
create index on public.record_events (workspace_id, at desc);

-- A command repeated with the same key returns its first result instead of acting twice.
create table app.idempotency (
  user_id uuid not null,
  key text not null,
  command text not null,
  request jsonb not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- ─── Indexes on the foreign keys the policies and commands follow ────────────

create index on public.files (workspace_id);
create index on public.sources (workspace_id);
create index on public.brand_rules (brand_dna_version_id);
create index on public.products (workspace_id);
create index on public.product_facts (product_id);
create index on public.campaigns (workspace_id);
create index on public.brief_versions (campaign_id);
create index on public.plan_versions (campaign_id);
create index on public.production_jobs (campaign_id);
create index on public.job_attempts (job_id);
create index on public.candidates (job_id);
create index on public.creatives (campaign_id);
create index on public.creative_versions (creative_id);
create index on public.creative_versions (file_id);
create index on public.findings (version_id);
create index on public.approvals (version_id);
create index on public.change_requests (version_id);
create index on public.comments (version_id);
create index on public.delivery_items (file_id);

-- ─── What a customer may see ─────────────────────────────────────────────────

-- A version reaches the customer only once an expert checked it and the operator sent it.
create or replace function app.customer_may_see_version(v public.creative_versions) returns boolean
language sql stable as $$
  select v.sent_at is not null and v.state in ('checked', 'changes_requested', 'approved', 'delivered')
$$;

create or replace function app.can_read_version(version_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.creative_versions v
    where v.id = version_id
      and (app.is_staff(v.workspace_id) or (app.customer_role(v.workspace_id) is not null and app.customer_may_see_version(v)))
  )
$$;

-- A file is readable by staff of its workspace; by the customer when it is source material, or it is the file of a
-- version they may see, or it is in their delivery.
create or replace function app.can_read_file(file_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.files f
    where f.id = file_id and (
      app.is_staff(f.workspace_id)
      or (app.customer_role(f.workspace_id) is not null and (
        f.purpose = 'source'
        or exists (select 1 from public.creative_versions v where v.file_id = f.id and app.customer_may_see_version(v))
        or exists (select 1 from public.delivery_items d where d.file_id = f.id)
      ))
    )
  )
$$;

-- ─── Read policies ───────────────────────────────────────────────────────────

do $$
declare t text;
begin
  -- shared: both sides read
  foreach t in array array[
    'sources', 'brand_dna_versions', 'brand_rules', 'products', 'product_facts', 'campaigns', 'campaign_products',
    'brief_versions', 'plan_versions', 'creatives', 'deliveries', 'delivery_items', 'record_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (app.can_read(workspace_id))', t || '_read', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
  -- staff: lineage and production never reach the customer
  foreach t in array array['context_snapshots', 'production_jobs', 'job_attempts', 'candidates'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (app.is_staff(workspace_id))', t || '_read', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
  -- gated by the version they belong to
  foreach t in array array['approvals', 'change_requests', 'comments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (app.can_read_version(version_id))', t || '_read', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

alter table public.files enable row level security;
create policy files_read on public.files for select to authenticated using (app.can_read_file(id));
grant select on public.files to authenticated;

alter table public.creative_versions enable row level security;
create policy creative_versions_read on public.creative_versions for select to authenticated using (
  app.is_staff(workspace_id) or (app.customer_role(workspace_id) is not null and app.customer_may_see_version(creative_versions))
);
grant select on public.creative_versions to authenticated;

-- The customer sees a check once it is decided as checked ("Checked by William"); staff see every check.
alter table public.expert_checks enable row level security;
create policy expert_checks_read on public.expert_checks for select to authenticated using (
  app.is_staff(workspace_id) or (state = 'checked' and app.can_read_version(version_id))
);
grant select on public.expert_checks to authenticated;

-- Automated findings are evidence for the expert; the customer sees only what an expert wrote on a version they see.
alter table public.findings enable row level security;
create policy findings_read on public.findings for select to authenticated using (
  app.is_staff(workspace_id) or (method = 'expert' and app.can_read_version(version_id))
);
grant select on public.findings to authenticated;
