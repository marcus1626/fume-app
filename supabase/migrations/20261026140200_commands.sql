-- Commands: the only way anything changes (docs/mvp/domain-model.md §3). Each one, in one transaction:
--   1. returns the first result again when the same idempotency key comes back (and refuses the key with another body);
--   2. finds the object and refuses (not_found) when the caller cannot read its workspace;
--   3. checks the caller's role (forbidden) and the object's state and version (conflict, invalid);
--   4. writes, and appends a record event.
-- Errors carry the contract's code in the error's detail (app/src/contract/errors.ts).
-- Parameters are named p_* so they never collide with column names; supabase-js passes them by name.

-- ─── Helpers ─────────────────────────────────────────────────────────────────

create or replace function app.require_user() returns uuid
language plpgsql stable as $$
begin
  if auth.uid() is null then
    perform app.fail('forbidden', 'Sign in first.');
  end if;
  return auth.uid();
end $$;

create or replace function app.idem_begin(p_key text, p_command text, p_request jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  hit app.idempotency;
begin
  if p_key is null then
    return null;
  end if;
  select * into hit from app.idempotency where user_id = auth.uid() and key = p_key;
  if not found then
    return null;
  end if;
  if hit.command <> p_command or hit.request <> p_request then
    perform app.fail('conflict', 'This request key was already used for another request.');
  end if;
  return hit.response;
end $$;

create or replace function app.idem_end(p_key text, p_command text, p_request jsonb, p_response jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if p_key is not null then
    insert into app.idempotency (user_id, key, command, request, response)
    values (auth.uid(), p_key, p_command, p_request, p_response);
  end if;
  return p_response;
end $$;

create or replace function app.record(p_ws uuid, p_action text, p_type text, p_id uuid, p_detail jsonb default '{}')
returns void language sql security definer set search_path = '' as $$
  insert into public.record_events (workspace_id, actor, action, subject_type, subject_id, detail)
  values (p_ws, auth.uid(), p_action, p_type, p_id, p_detail)
$$;

-- The caller may act as the customer with one of these roles.
create or replace function app.customer_is(p_ws uuid, p_roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app.customer_role(p_ws) = any (p_roles), false)
$$;

-- The latest version of a creative.
create or replace function app.latest_version(p_creative uuid) returns public.creative_versions
language sql stable security definer set search_path = '' as $$
  select * from public.creative_versions where creative_id = p_creative order by number desc limit 1
$$;

-- The required product facts of a campaign's products that are not verified (current rows only).
create or replace function app.unverified_required_facts(p_campaign uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(p.name || ': ' || f.label order by p.name, f.label), '{}')
  from public.campaign_products cp
  join public.products p on p.id = cp.product_id
  join public.product_facts f on f.product_id = p.id
  where cp.campaign_id = p_campaign and f.required and f.superseded_by is null and f.status <> 'verified'
$$;

-- ─── Product Truth ───────────────────────────────────────────────────────────

create or replace function public.verify_fact(p_fact_id uuid, p_key text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('fact_id', p_fact_id);
  prior jsonb;
  f public.product_facts;
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'verify_fact', req);
  if prior is not null then return prior; end if;

  select * into f from public.product_facts where id = p_fact_id;
  if not found or not app.can_read(f.workspace_id) then
    perform app.fail('not_found', 'No such fact.');
  end if;
  if not (app.customer_is(f.workspace_id, array['owner', 'approver']) or app.is_admin()) then
    perform app.fail('forbidden', 'Only the brand''s owner or approver verifies its product facts.');
  end if;
  if f.superseded_by is not null then
    perform app.fail('conflict', 'This fact has been corrected since. Verify the current line.');
  end if;

  update public.product_facts set status = 'verified', verified_by = auth.uid(), verified_at = now()
  where id = p_fact_id returning * into f;
  perform app.record(f.workspace_id, 'fact.verified', 'product_fact', f.id, jsonb_build_object('label', f.label));
  return app.idem_end(p_key, 'verify_fact', req, to_jsonb(f));
end $$;

-- A correction writes a new, verified line and supersedes the old one; history and old snapshots keep the old line.
create or replace function public.correct_fact(p_fact_id uuid, p_statement text, p_key text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('fact_id', p_fact_id, 'statement', p_statement);
  prior jsonb;
  f public.product_facts;
  nf public.product_facts;
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'correct_fact', req);
  if prior is not null then return prior; end if;

  select * into f from public.product_facts where id = p_fact_id;
  if not found or not app.can_read(f.workspace_id) then
    perform app.fail('not_found', 'No such fact.');
  end if;
  if not (app.customer_is(f.workspace_id, array['owner', 'approver']) or app.is_admin()) then
    perform app.fail('forbidden', 'Only the brand''s owner or approver corrects its product facts.');
  end if;
  if f.superseded_by is not null then
    perform app.fail('conflict', 'This fact has been corrected since.');
  end if;
  if coalesce(trim(p_statement), '') = '' then
    perform app.fail('invalid', 'Write the corrected line.');
  end if;

  insert into public.product_facts (
    workspace_id, product_id, area, label, statement, origin, status, required, source_id, source_location,
    verified_by, verified_at, created_by
  ) values (
    f.workspace_id, f.product_id, f.area, f.label, p_statement, 'supplied', 'verified', f.required, f.source_id,
    f.source_location, auth.uid(), now(), auth.uid()
  ) returning * into nf;
  update public.product_facts set superseded_by = nf.id where id = f.id;
  perform app.record(f.workspace_id, 'fact.corrected', 'product_fact', nf.id, jsonb_build_object('was', f.id));
  return app.idem_end(p_key, 'correct_fact', req, to_jsonb(nf));
end $$;

-- ─── Files ───────────────────────────────────────────────────────────────────

-- After the browser uploads to Storage at <workspace_id>/<name>, it registers the file. Candidates are staff only.
create or replace function public.register_file(
  p_workspace_id uuid, p_path text, p_name text, p_content_type text, p_bytes bigint,
  p_sha256 text default null, p_width int default null, p_height int default null, p_purpose text default 'source',
  p_key text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('workspace_id', p_workspace_id, 'path', p_path, 'purpose', p_purpose);
  prior jsonb;
  f public.files;
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'register_file', req);
  if prior is not null then return prior; end if;

  if not app.can_read(p_workspace_id) then
    perform app.fail('not_found', 'No such workspace.');
  end if;
  if p_purpose = 'candidate' and not app.is_staff(p_workspace_id, array['operator']) then
    perform app.fail('forbidden', 'Only an operator adds production candidates.');
  end if;
  if p_purpose = 'source'
     and not (app.customer_is(p_workspace_id, array['owner', 'approver', 'member']) or app.is_staff(p_workspace_id)) then
    perform app.fail('forbidden', 'Viewers cannot add files.');
  end if;
  if p_purpose not in ('source', 'candidate') then
    perform app.fail('invalid', 'Delivery files are made by the delivery.');
  end if;
  if split_part(p_path, '/', 1) <> p_workspace_id::text then
    perform app.fail('invalid', 'The file must be stored in its workspace''s folder.');
  end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'workspace-files' and o.name = p_path and o.owner_id = auth.uid()::text
  ) then
    perform app.fail('invalid', 'Upload the file yourself before registering it.');
  end if;

  insert into public.files (workspace_id, path, name, content_type, bytes, sha256, width, height, purpose, uploaded_by)
  values (p_workspace_id, p_path, p_name, p_content_type, p_bytes, p_sha256, p_width, p_height, p_purpose, auth.uid())
  returning * into f;
  perform app.record(f.workspace_id, 'file.added', 'file', f.id, jsonb_build_object('name', f.name, 'purpose', f.purpose));
  return app.idem_end(p_key, 'register_file', req, to_jsonb(f));
end $$;

-- ─── Campaign, brief, plan ───────────────────────────────────────────────────

create or replace function public.create_campaign(
  p_workspace_id uuid, p_name text, p_product_ids uuid[], p_key text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('workspace_id', p_workspace_id, 'name', p_name, 'product_ids', to_jsonb(p_product_ids));
  prior jsonb;
  c public.campaigns;
  pid uuid;
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'create_campaign', req);
  if prior is not null then return prior; end if;

  if not app.can_read(p_workspace_id) then
    perform app.fail('not_found', 'No such workspace.');
  end if;
  if not (app.customer_is(p_workspace_id, array['owner', 'approver', 'member']) or app.is_staff(p_workspace_id, array['operator'])) then
    perform app.fail('forbidden', 'Viewers cannot start a campaign.');
  end if;
  if coalesce(trim(p_name), '') = '' or coalesce(cardinality(p_product_ids), 0) = 0 then
    perform app.fail('invalid', 'A campaign needs a name and at least one product.');
  end if;

  insert into public.campaigns (workspace_id, name, approver_id, created_by)
  values (
    p_workspace_id, p_name,
    case when app.customer_is(p_workspace_id, array['owner', 'approver']) then auth.uid() end,
    auth.uid()
  ) returning * into c;
  foreach pid in array p_product_ids loop
    if not exists (select 1 from public.products p where p.id = pid and p.workspace_id = p_workspace_id) then
      perform app.fail('invalid', 'A product is not in this workspace.');
    end if;
    insert into public.campaign_products (campaign_id, product_id, workspace_id) values (c.id, pid, p_workspace_id);
  end loop;
  perform app.record(c.workspace_id, 'campaign.created', 'campaign', c.id, jsonb_build_object('name', c.name));
  return app.idem_end(p_key, 'create_campaign', req, to_jsonb(c));
end $$;

-- The customer sends her brief (T02). A new version every time; a plan not yet approved is set aside.
create or replace function public.send_brief(p_campaign_id uuid, p_body jsonb, p_key text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('campaign_id', p_campaign_id, 'body', p_body);
  prior jsonb;
  c public.campaigns;
  b public.brief_versions;
  missing text[] := '{}';
  field text;
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'send_brief', req);
  if prior is not null then return prior; end if;

  select * into c from public.campaigns where id = p_campaign_id;
  if not found or not app.can_read(c.workspace_id) then
    perform app.fail('not_found', 'No such campaign.');
  end if;
  if not app.customer_is(c.workspace_id, array['owner', 'approver', 'member']) and not app.is_staff(c.workspace_id, array['operator']) then
    perform app.fail('forbidden', 'Viewers cannot send a brief.');
  end if;
  if exists (select 1 from public.plan_versions where campaign_id = c.id and state = 'approved') then
    perform app.fail('conflict', 'The plan is approved. Change the work through the plan or a change request.');
  end if;
  foreach field in array array['objective', 'audience', 'message', 'formats', 'count'] loop
    if coalesce(p_body ->> field, '') = '' then
      missing := missing || field;
    end if;
  end loop;
  if cardinality(missing) > 0 then
    perform app.fail('invalid', 'The brief is missing: ' || array_to_string(missing, ', ') || '.');
  end if;

  insert into public.brief_versions (workspace_id, campaign_id, version, body, sent_by)
  values (
    c.workspace_id, c.id,
    coalesce((select max(version) from public.brief_versions where campaign_id = c.id), 0) + 1,
    p_body, auth.uid()
  ) returning * into b;
  update public.plan_versions set state = 'superseded' where campaign_id = c.id and state <> 'superseded';
  update public.campaigns set stage = 'plan' where id = c.id;
  perform app.record(c.workspace_id, 'brief.sent', 'brief_version', b.id, jsonb_build_object('version', b.version));
  return app.idem_end(p_key, 'send_brief', req, to_jsonb(b));
end $$;

-- Fume writes a plan version (T03) from the latest brief: the LLM proposes, an operator or expert submits it here.
create or replace function public.write_plan(
  p_campaign_id uuid, p_body jsonb, p_changes text[] default '{}', p_by_fume boolean default true, p_key text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('campaign_id', p_campaign_id, 'body', p_body, 'changes', to_jsonb(p_changes));
  prior jsonb;
  c public.campaigns;
  b public.brief_versions;
  p public.plan_versions;
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'write_plan', req);
  if prior is not null then return prior; end if;

  select * into c from public.campaigns where id = p_campaign_id;
  if not found or not app.can_read(c.workspace_id) then
    perform app.fail('not_found', 'No such campaign.');
  end if;
  if not app.is_staff(c.workspace_id) then
    perform app.fail('forbidden', 'Fume writes the plan.');
  end if;
  if exists (select 1 from public.plan_versions where campaign_id = c.id and state = 'approved') then
    perform app.fail('conflict', 'The plan is already approved.');
  end if;
  select * into b from public.brief_versions where campaign_id = c.id order by version desc limit 1;
  if not found then
    perform app.fail('invalid', 'The brief has not been sent yet.');
  end if;
  if p_body -> 'directions' is null or p_body ->> 'chosen_direction_id' is null or p_body -> 'planned_creatives' is null then
    perform app.fail('invalid', 'A plan needs its directions, the chosen direction and the planned creatives.');
  end if;

  update public.plan_versions set state = 'superseded' where campaign_id = c.id and state <> 'superseded';
  insert into public.plan_versions (
    workspace_id, campaign_id, version, brief_version_id, brand_dna_version_id, body, state, written_by, changes
  ) values (
    c.workspace_id, c.id,
    coalesce((select max(version) from public.plan_versions where campaign_id = c.id), 0) + 1,
    b.id,
    (select id from public.brand_dna_versions d where d.workspace_id = c.workspace_id and d.state = 'approved'
     order by version desc limit 1),
    p_body, 'ready', case when p_by_fume then 'fume' else auth.uid()::text end, p_changes
  ) returning * into p;
  perform app.record(c.workspace_id, 'plan.written', 'plan_version', p.id, jsonb_build_object('version', p.version));
  return app.idem_end(p_key, 'write_plan', req, to_jsonb(p));
end $$;

-- The current plan version, locked, after checking it is the one the caller named.
create or replace function app.current_plan(p_campaign uuid, p_version int) returns public.plan_versions
language plpgsql security definer set search_path = '' as $$
declare
  p public.plan_versions;
begin
  select * into p from public.plan_versions where campaign_id = p_campaign order by version desc limit 1 for update;
  if not found or not app.can_read(p.workspace_id) then
    perform app.fail('not_found', 'No plan yet.');
  end if;
  if p.version <> p_version then
    perform app.fail('conflict', format('The plan has changed since: version %s is current, not %s.', p.version, p_version));
  end if;
  return p;
end $$;

create or replace function public.ask_plan_check(p_campaign_id uuid, p_version int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.plan_versions;
begin
  perform app.require_user();
  p := app.current_plan(p_campaign_id, p_version);
  if not (app.customer_is(p.workspace_id, array['owner', 'approver']) or app.is_staff(p.workspace_id)) then
    perform app.fail('forbidden', 'Only the approver or Fume asks for the plan''s check.');
  end if;
  if p.state = 'in_check' then return to_jsonb(p); end if;
  if p.state <> 'ready' then
    perform app.fail('conflict', 'Only a plan that is ready can go to check.');
  end if;
  update public.plan_versions set state = 'in_check', check_asked_by = auth.uid() where id = p.id returning * into p;
  perform app.record(p.workspace_id, 'plan.check_asked', 'plan_version', p.id);
  return to_jsonb(p);
end $$;

create or replace function public.check_plan(p_campaign_id uuid, p_version int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.plan_versions;
begin
  perform app.require_user();
  p := app.current_plan(p_campaign_id, p_version);
  if not app.is_staff(p.workspace_id, array['expert']) then
    perform app.fail('forbidden', 'Only an expert checks the plan.');
  end if;
  if p.checked_by is not null and p.state = 'ready' then return to_jsonb(p); end if;
  if p.state not in ('in_check', 'ready') then
    perform app.fail('conflict', 'This plan is not waiting for a check.');
  end if;
  update public.plan_versions set state = 'ready', checked_by = auth.uid(), checked_at = now() where id = p.id returning * into p;
  perform app.record(p.workspace_id, 'plan.checked', 'plan_version', p.id);
  return to_jsonb(p);
end $$;

create or replace function public.ask_plan_changes(p_campaign_id uuid, p_version int, p_note text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.plan_versions;
begin
  perform app.require_user();
  p := app.current_plan(p_campaign_id, p_version);
  if not app.customer_is(p.workspace_id, array['owner', 'approver']) then
    perform app.fail('forbidden', 'Only the approver asks for changes to the plan.');
  end if;
  if p.state not in ('ready', 'in_check') then
    perform app.fail('conflict', 'This plan cannot be changed now.');
  end if;
  update public.plan_versions set state = 'changes_asked' where id = p.id returning * into p;
  perform app.record(p.workspace_id, 'plan.changes_asked', 'plan_version', p.id, jsonb_build_object('note', p_note));
  return to_jsonb(p);
end $$;

-- Only the customer approves, one named version, and only when the product facts it depends on are verified.
create or replace function public.approve_plan(p_campaign_id uuid, p_version int, p_key text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('campaign_id', p_campaign_id, 'version', p_version);
  prior jsonb;
  p public.plan_versions;
  unverified text[];
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'approve_plan', req);
  if prior is not null then return prior; end if;

  p := app.current_plan(p_campaign_id, p_version);
  if not app.customer_is(p.workspace_id, array['owner', 'approver']) then
    perform app.fail('forbidden', 'Only the customer''s approver approves the plan.');
  end if;
  if p.state <> 'ready' then
    perform app.fail('conflict', 'This plan is not ready to approve.');
  end if;
  unverified := app.unverified_required_facts(p_campaign_id);
  if cardinality(unverified) > 0 then
    perform app.fail('invalid', 'Verify these product facts first: ' || array_to_string(unverified, '; ') || '.');
  end if;

  update public.plan_versions set state = 'approved', approved_by = auth.uid(), approved_at = now()
  where id = p.id returning * into p;
  update public.campaigns set state = 'in_production', stage = 'masters', approver_id = coalesce(approver_id, auth.uid())
  where id = p_campaign_id;
  perform app.record(p.workspace_id, 'plan.approved', 'plan_version', p.id, jsonb_build_object('version', p.version));
  return app.idem_end(p_key, 'approve_plan', req, to_jsonb(p));
end $$;

-- Undo, while no production has started from it.
create or replace function public.undo_approve_plan(p_campaign_id uuid, p_version int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.plan_versions;
begin
  perform app.require_user();
  p := app.current_plan(p_campaign_id, p_version);
  if not app.customer_is(p.workspace_id, array['owner', 'approver']) then
    perform app.fail('forbidden', 'Only the customer''s approver can undo the approval.');
  end if;
  if p.state <> 'approved' then
    perform app.fail('conflict', 'This plan is not approved.');
  end if;
  if exists (select 1 from public.production_jobs j join public.context_snapshots s on s.id = j.snapshot_id
             where s.plan_version_id = p.id) then
    perform app.fail('conflict', 'Production has started from this plan.');
  end if;
  update public.plan_versions set state = 'ready', approved_by = null, approved_at = null where id = p.id returning * into p;
  update public.campaigns set state = 'draft', stage = 'plan' where id = p_campaign_id;
  perform app.record(p.workspace_id, 'plan.approval_undone', 'plan_version', p.id);
  return to_jsonb(p);
end $$;

-- ─── Production ──────────────────────────────────────────────────────────────

-- A job saves its context before anything runs. Masters need the approved plan; variants and formats an approved
-- master version; a correction the creative it corrects.
create or replace function public.start_job(
  p_campaign_id uuid, p_kind text, p_recipe jsonb, p_references jsonb default '[]',
  p_creative_id uuid default null, p_master_version_id uuid default null, p_mode text default 'engine',
  p_key text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object(
    'campaign_id', p_campaign_id, 'kind', p_kind, 'recipe', p_recipe, 'references', p_references,
    'creative_id', p_creative_id, 'master_version_id', p_master_version_id, 'mode', p_mode
  );
  prior jsonb;
  c public.campaigns;
  p public.plan_versions;
  mv public.creative_versions;
  s public.context_snapshots;
  j public.production_jobs;
  unverified text[];
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'start_job', req);
  if prior is not null then return prior; end if;

  select * into c from public.campaigns where id = p_campaign_id;
  if not found or not app.can_read(c.workspace_id) then
    perform app.fail('not_found', 'No such campaign.');
  end if;
  if not app.is_staff(c.workspace_id, array['operator']) then
    perform app.fail('forbidden', 'Only an operator starts production.');
  end if;
  select * into p from public.plan_versions where campaign_id = c.id and state = 'approved' order by version desc limit 1;
  if not found then
    perform app.fail('invalid', 'The plan is not approved yet.');
  end if;
  unverified := app.unverified_required_facts(c.id);
  if cardinality(unverified) > 0 then
    perform app.fail('invalid', 'Verify these product facts first: ' || array_to_string(unverified, '; ') || '.');
  end if;
  if p_kind in ('variant', 'format') then
    select * into mv from public.creative_versions where id = p_master_version_id;
    if not found or mv.workspace_id <> c.workspace_id then
      perform app.fail('invalid', 'Name the master version this derives from.');
    end if;
    if mv.state not in ('approved', 'delivered')
       or not exists (select 1 from public.creatives cr where cr.id = mv.creative_id and cr.kind = 'master' and cr.campaign_id = c.id) then
      perform app.fail('invalid', 'Variants and formats need an approved master.');
    end if;
  elsif p_kind = 'correction' then
    if not exists (select 1 from public.creatives cr where cr.id = p_creative_id and cr.campaign_id = c.id) then
      perform app.fail('invalid', 'Name the creative this corrects.');
    end if;
  elsif p_kind <> 'master' then
    perform app.fail('invalid', 'Unknown kind of job.');
  end if;
  if p_recipe is null or p_recipe = '{}'::jsonb then
    perform app.fail('invalid', 'A job needs its recipe.');
  end if;

  insert into public.context_snapshots (
    workspace_id, campaign_id, brief_version_id, plan_version_id, brand_dna_version_id, facts, recipe, "references"
  ) values (
    c.workspace_id, c.id, p.brief_version_id, p.id, p.brand_dna_version_id,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'product_id', f.product_id, 'area', f.area, 'label', f.label,
                                          'statement', f.statement, 'status', f.status) order by f.label)
      from public.campaign_products cp join public.product_facts f on f.product_id = cp.product_id
      where cp.campaign_id = c.id and f.superseded_by is null
    ), '[]'),
    p_recipe, coalesce(p_references, '[]')
  ) returning * into s;

  insert into public.production_jobs (
    workspace_id, campaign_id, kind, creative_id, master_version_id, snapshot_id, mode, requested_by
  ) values (
    c.workspace_id, c.id, p_kind,
    case when p_kind = 'correction' then p_creative_id end,
    case when p_kind in ('variant', 'format') then p_master_version_id end,
    s.id, p_mode, auth.uid()
  ) returning * into j;
  perform app.record(c.workspace_id, 'job.started', 'production_job', j.id, jsonb_build_object('kind', j.kind, 'mode', j.mode));
  return app.idem_end(p_key, 'start_job', req, to_jsonb(j));
end $$;

create or replace function public.set_job_state(p_job_id uuid, p_state text, p_error text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  j public.production_jobs;
begin
  perform app.require_user();
  select * into j from public.production_jobs where id = p_job_id for update;
  if not found or not app.can_read(j.workspace_id) then
    perform app.fail('not_found', 'No such job.');
  end if;
  if not app.is_staff(j.workspace_id, array['operator']) then
    perform app.fail('forbidden', 'Only an operator changes a job.');
  end if;
  if j.state = p_state then return to_jsonb(j); end if;
  if not (
    (j.state = 'queued' and p_state in ('running', 'cancelled', 'failed'))
    or (j.state = 'running' and p_state in ('succeeded', 'failed', 'cancelled', 'unknown'))
    or (j.state = 'unknown' and p_state in ('succeeded', 'failed'))
    or (j.state = 'failed' and p_state = 'queued')
  ) then
    perform app.fail('conflict', format('A job cannot go from %s to %s.', j.state, p_state));
  end if;
  update public.production_jobs set state = p_state, error = p_error, updated_at = now() where id = j.id returning * into j;
  perform app.record(j.workspace_id, 'job.' || p_state, 'production_job', j.id, jsonb_build_object('error', p_error));
  return to_jsonb(j);
end $$;

-- A picture made for a job, by the Engine or by hand, with its provenance.
create or replace function public.add_candidate(
  p_job_id uuid, p_file_id uuid, p_origin text default 'manual', p_note text default null, p_key text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('job_id', p_job_id, 'file_id', p_file_id, 'origin', p_origin, 'note', p_note);
  prior jsonb;
  j public.production_jobs;
  f public.files;
  cand public.candidates;
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'add_candidate', req);
  if prior is not null then return prior; end if;

  select * into j from public.production_jobs where id = p_job_id for update;
  if not found or not app.can_read(j.workspace_id) then
    perform app.fail('not_found', 'No such job.');
  end if;
  if not app.is_staff(j.workspace_id, array['operator']) then
    perform app.fail('forbidden', 'Only an operator adds a candidate.');
  end if;
  if j.state in ('cancelled') then
    perform app.fail('conflict', 'This job was cancelled.');
  end if;
  select * into f from public.files where id = p_file_id;
  if not found or f.workspace_id <> j.workspace_id or f.purpose <> 'candidate' then
    perform app.fail('invalid', 'The file must be a candidate uploaded to this workspace.');
  end if;
  if p_origin = 'manual' and coalesce(trim(p_note), '') = '' then
    perform app.fail('invalid', 'Say how a manual candidate was made.');
  end if;

  insert into public.candidates (workspace_id, job_id, file_id, origin, note, made_by)
  values (j.workspace_id, j.id, f.id, p_origin, p_note, auth.uid()) returning * into cand;
  if p_origin = 'manual' and j.state in ('queued', 'running', 'failed', 'unknown') then
    update public.production_jobs set state = 'succeeded', mode = 'manual', updated_at = now() where id = j.id;
  end if;
  perform app.record(j.workspace_id, 'candidate.added', 'candidate', cand.id, jsonb_build_object('origin', p_origin, 'note', p_note));
  return app.idem_end(p_key, 'add_candidate', req, to_jsonb(cand));
end $$;

-- A candidate becomes a creative version in check. A new version starts with no check and no approval.
create or replace function public.send_to_check(
  p_candidate_id uuid, p_format text default 'feed', p_title text default null, p_key text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('candidate_id', p_candidate_id, 'format', p_format, 'title', p_title);
  prior jsonb;
  cand public.candidates;
  j public.production_jobs;
  cr public.creatives;
  mv public.creative_versions;
  prev public.creative_versions;
  v public.creative_versions;
  ws_slug text;
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'send_to_check', req);
  if prior is not null then return prior; end if;

  select * into cand from public.candidates where id = p_candidate_id;
  if not found or not app.can_read(cand.workspace_id) then
    perform app.fail('not_found', 'No such candidate.');
  end if;
  if not app.is_staff(cand.workspace_id, array['operator']) then
    perform app.fail('forbidden', 'Only an operator sends work to check.');
  end if;
  if exists (select 1 from public.creative_versions where candidate_id = cand.id) then
    perform app.fail('conflict', 'This candidate is already a version.');
  end if;
  select * into j from public.production_jobs where id = cand.job_id;
  select slug into ws_slug from public.workspaces where id = cand.workspace_id;

  if j.kind = 'correction' then
    select * into cr from public.creatives where id = j.creative_id;
    prev := app.latest_version(cr.id);
    if prev.state not in ('changes_requested', 'correcting', 'held') then
      perform app.fail('conflict', 'This creative is not waiting for a new version.');
    end if;
  else
    if j.kind in ('variant', 'format') then
      select * into mv from public.creative_versions where id = j.master_version_id;
    end if;
    insert into public.creatives (workspace_id, campaign_id, master_id, kind, format, name, title)
    values (
      cand.workspace_id, j.campaign_id,
      case when j.kind in ('variant', 'format') then mv.creative_id end,
      j.kind, p_format,
      ws_slug || '_' || j.kind || '_' || p_format || '_' || left(replace(gen_random_uuid()::text, '-', ''), 6),
      coalesce(p_title, initcap(j.kind) || ' · ' || p_format)
    ) returning * into cr;
  end if;

  insert into public.creative_versions (workspace_id, creative_id, number, state, file_id, candidate_id, job_id, master_version_id)
  values (
    cand.workspace_id, cr.id, coalesce(prev.number, 0) + 1, 'in_check', cand.file_id, cand.id, j.id,
    coalesce(j.master_version_id, prev.master_version_id)
  ) returning * into v;
  insert into public.expert_checks (workspace_id, version_id, snapshot_id) values (v.workspace_id, v.id, j.snapshot_id);
  update public.change_requests set new_version_id = v.id
  where prev.id is not null and version_id = prev.id and new_version_id is null;
  perform app.record(v.workspace_id, 'version.in_check', 'creative_version', v.id,
    jsonb_build_object('creative', cr.title, 'number', v.number));
  return app.idem_end(p_key, 'send_to_check', req, to_jsonb(v));
end $$;

-- ─── The Quality Gate ────────────────────────────────────────────────────────

create or replace function app.checkable_version(p_version uuid) returns public.creative_versions
language plpgsql security definer set search_path = '' as $$
declare
  v public.creative_versions;
begin
  select * into v from public.creative_versions where id = p_version for update;
  if not found or not app.can_read_version(p_version) then
    perform app.fail('not_found', 'No such creative version.');
  end if;
  if not app.is_staff(v.workspace_id, array['expert']) then
    perform app.fail('forbidden', 'Only an expert checks creatives.');
  end if;
  if v.number <> (app.latest_version(v.creative_id)).number then
    perform app.fail('conflict', 'A newer version of this creative exists.');
  end if;
  return v;
end $$;

create or replace function public.add_finding(
  p_version_id uuid, p_dimension text, p_severity text, p_finding text, p_method text default 'expert',
  p_region jsonb default null, p_expected text default null, p_observed text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.creative_versions;
  f public.findings;
begin
  perform app.require_user();
  select * into v from public.creative_versions where id = p_version_id;
  if not found or not app.is_staff(v.workspace_id) then
    perform app.fail('not_found', 'No such creative version.');
  end if;
  insert into public.findings (workspace_id, version_id, method, dimension, severity, finding, region, expected, observed, created_by)
  values (v.workspace_id, v.id, p_method, p_dimension, p_severity, p_finding, p_region, p_expected, p_observed, auth.uid())
  returning * into f;
  perform app.record(v.workspace_id, 'finding.added', 'finding', f.id, jsonb_build_object('severity', p_severity));
  return to_jsonb(f);
end $$;

create or replace function public.resolve_finding(p_finding_id uuid, p_status text default 'resolved') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  f public.findings;
begin
  perform app.require_user();
  select * into f from public.findings where id = p_finding_id;
  if not found or not app.is_staff(f.workspace_id, array['expert']) then
    perform app.fail('not_found', 'No such finding.');
  end if;
  if p_status not in ('resolved', 'accepted') then
    perform app.fail('invalid', 'A finding is resolved or accepted.');
  end if;
  update public.findings set status = p_status, resolved_by = auth.uid(), resolved_at = now() where id = f.id returning * into f;
  perform app.record(f.workspace_id, 'finding.' || p_status, 'finding', f.id);
  return to_jsonb(f);
end $$;

create or replace function public.mark_checked(p_version_id uuid, p_items jsonb default '[]', p_key text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('version_id', p_version_id, 'items', p_items);
  prior jsonb;
  v public.creative_versions;
  ch public.expert_checks;
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'mark_checked', req);
  if prior is not null then return prior; end if;

  v := app.checkable_version(p_version_id);
  if v.state <> 'in_check' then
    perform app.fail('conflict', 'This version is not in check.');
  end if;
  if exists (select 1 from public.findings where version_id = v.id and severity = 'critical' and status = 'open') then
    perform app.fail('conflict', 'A critical finding is still open on this version.');
  end if;
  update public.creative_versions set state = 'checked' where id = v.id returning * into v;
  update public.expert_checks set state = 'checked', expert_id = auth.uid(), decided_at = now(), items = p_items
  where version_id = v.id returning * into ch;
  perform app.record(v.workspace_id, 'version.checked', 'creative_version', v.id);
  return app.idem_end(p_key, 'mark_checked', req, to_jsonb(v));
end $$;

-- The expert sends it back for Fume's own fix: a correction, no round used.
create or replace function public.request_correction(
  p_version_id uuid, p_problem text, p_must_change jsonb default '[]', p_must_stay jsonb default '[]',
  p_pins jsonb default '[]'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.creative_versions;
  cr public.change_requests;
begin
  perform app.require_user();
  v := app.checkable_version(p_version_id);
  if v.state <> 'in_check' then
    perform app.fail('conflict', 'This version is not in check.');
  end if;
  update public.creative_versions set state = 'correcting' where id = v.id;
  update public.expert_checks set state = 'correction', expert_id = auth.uid(), decided_at = now(), note = p_problem
  where version_id = v.id;
  insert into public.change_requests (workspace_id, version_id, source, cause, problem, must_change, must_stay, pins, uses_round, by)
  values (v.workspace_id, v.id, 'expert', 'correction', p_problem, p_must_change, p_must_stay, p_pins, false, auth.uid())
  returning * into cr;
  perform app.record(v.workspace_id, 'version.correction_asked', 'creative_version', v.id, jsonb_build_object('problem', p_problem));
  return to_jsonb(cr);
end $$;

create or replace function public.hold_version(p_version_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.creative_versions;
begin
  perform app.require_user();
  v := app.checkable_version(p_version_id);
  if v.state <> 'in_check' then
    perform app.fail('conflict', 'This version is not in check.');
  end if;
  update public.creative_versions set state = 'held', held_reason = p_reason where id = v.id returning * into v;
  update public.expert_checks set state = 'held', expert_id = auth.uid(), decided_at = now(), note = p_reason
  where version_id = v.id;
  perform app.record(v.workspace_id, 'version.held', 'creative_version', v.id, jsonb_build_object('reason', p_reason));
  return to_jsonb(v);
end $$;

-- Checked work reaches the customer only when it is sent (FLOWS §25.3).
create or replace function public.send_checked(p_campaign_id uuid, p_key text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('campaign_id', p_campaign_id);
  prior jsonb;
  c public.campaigns;
  n int;
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'send_checked', req);
  if prior is not null then return prior; end if;

  select * into c from public.campaigns where id = p_campaign_id;
  if not found or not app.can_read(c.workspace_id) then
    perform app.fail('not_found', 'No such campaign.');
  end if;
  if not app.is_staff(c.workspace_id, array['operator']) then
    perform app.fail('forbidden', 'Only an operator sends checked work.');
  end if;
  update public.creative_versions v set sent_at = now(), sent_by = auth.uid()
  from public.creatives cr
  where cr.id = v.creative_id and cr.campaign_id = c.id and v.state = 'checked' and v.sent_at is null;
  get diagnostics n = row_count;
  if n = 0 then
    perform app.fail('conflict', 'Nothing checked is waiting to be sent.');
  end if;
  update public.campaigns set state = 'in_review' where id = c.id;
  perform app.record(c.workspace_id, 'versions.sent', 'campaign', c.id, jsonb_build_object('count', n));
  return app.idem_end(p_key, 'send_checked', req, jsonb_build_object('sent', n));
end $$;

-- ─── The customer's decisions ────────────────────────────────────────────────

create or replace function app.decidable_version(p_version uuid, p_roles text[]) returns public.creative_versions
language plpgsql security definer set search_path = '' as $$
declare
  v public.creative_versions;
begin
  select * into v from public.creative_versions where id = p_version for update;
  if not found or not app.can_read_version(p_version) then
    perform app.fail('not_found', 'No such creative version.');
  end if;
  if not app.customer_is(v.workspace_id, p_roles) then
    perform app.fail('forbidden', 'Only the customer decides on a creative.');
  end if;
  if v.number <> (app.latest_version(v.creative_id)).number then
    perform app.fail('conflict', 'A newer version of this creative exists. Look at that one.');
  end if;
  return v;
end $$;

create or replace function public.approve_versions(p_version_ids uuid[], p_key text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('version_ids', to_jsonb(p_version_ids));
  prior jsonb;
  vid uuid;
  v public.creative_versions;
  out jsonb := '[]';
  camp uuid;
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'approve_versions', req);
  if prior is not null then return prior; end if;
  if coalesce(cardinality(p_version_ids), 0) = 0 then
    perform app.fail('invalid', 'Name the versions to approve.');
  end if;

  foreach vid in array p_version_ids loop
    v := app.decidable_version(vid, array['owner', 'approver']);
    if v.state <> 'checked' or v.sent_at is null then
      perform app.fail('conflict', 'Only checked creatives that were sent to you can be approved.');
    end if;
    update public.creative_versions set state = 'approved' where id = v.id returning * into v;
    insert into public.approvals (workspace_id, version_id, decided_by) values (v.workspace_id, v.id, auth.uid());
    perform app.record(v.workspace_id, 'version.approved', 'creative_version', v.id);
    out := out || to_jsonb(v);
    select campaign_id into camp from public.creatives where id = v.creative_id;
    -- The campaign is approved once every creative's latest version is.
    if not exists (
      select 1 from public.creatives cr
      where cr.campaign_id = camp and (app.latest_version(cr.id)).state not in ('approved', 'delivered')
    ) then
      update public.campaigns set state = 'approved' where id = camp and state <> 'delivered';
    end if;
  end loop;
  return app.idem_end(p_key, 'approve_versions', req, out);
end $$;

create or replace function public.undo_approval(p_version_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.creative_versions;
begin
  perform app.require_user();
  v := app.decidable_version(p_version_id, array['owner', 'approver']);
  if v.state <> 'approved' then
    perform app.fail('conflict', 'This version is not approved.');
  end if;
  update public.approvals set revoked_at = now() where version_id = v.id and revoked_at is null;
  update public.creative_versions set state = 'checked' where id = v.id returning * into v;
  update public.campaigns set state = 'in_review'
  where id = (select campaign_id from public.creatives where id = v.creative_id) and state = 'approved';
  perform app.record(v.workspace_id, 'version.approval_undone', 'creative_version', v.id);
  return to_jsonb(v);
end $$;

-- The customer asks for a change. A revision uses one of the package's rounds; a correction (Fume's fault) does not.
create or replace function public.request_changes(
  p_version_id uuid, p_cause text, p_problem text, p_must_change jsonb default '[]', p_must_stay jsonb default '[]',
  p_pins jsonb default '[]', p_key text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('version_id', p_version_id, 'cause', p_cause, 'problem', p_problem,
                                  'must_change', p_must_change, 'must_stay', p_must_stay, 'pins', p_pins);
  prior jsonb;
  v public.creative_versions;
  c public.campaigns;
  cr public.change_requests;
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'request_changes', req);
  if prior is not null then return prior; end if;

  v := app.decidable_version(p_version_id, array['owner', 'approver', 'member']);
  if v.state <> 'checked' or v.sent_at is null then
    perform app.fail('conflict', 'Only a checked creative waiting for you can get a change request.');
  end if;
  if p_cause not in ('correction', 'revision', 'changed_brief') then
    perform app.fail('invalid', 'Say whether this is a correction, a revision or a changed brief.');
  end if;
  if coalesce(trim(p_problem), '') = '' then
    perform app.fail('invalid', 'Say what should change.');
  end if;
  select * into c from public.campaigns where id = (select campaign_id from public.creatives where id = v.creative_id) for update;
  if p_cause = 'revision' then
    if c.rounds_used >= c.rounds_included then
      perform app.fail('conflict', 'The rounds in your package are used for this campaign. Ask Fume for an extra round.');
    end if;
    update public.campaigns set rounds_used = rounds_used + 1 where id = c.id;
  end if;
  update public.creative_versions set state = 'changes_requested' where id = v.id;
  insert into public.change_requests (workspace_id, version_id, source, cause, problem, must_change, must_stay, pins, uses_round, by)
  values (v.workspace_id, v.id, 'customer', p_cause, p_problem, p_must_change, p_must_stay, p_pins, p_cause = 'revision', auth.uid())
  returning * into cr;
  update public.campaigns set state = 'revision' where id = c.id;
  perform app.record(v.workspace_id, 'version.changes_requested', 'creative_version', v.id,
    jsonb_build_object('cause', p_cause, 'problem', p_problem));
  return app.idem_end(p_key, 'request_changes', req, to_jsonb(cr));
end $$;

create or replace function public.add_comment(p_version_id uuid, p_text text, p_pin jsonb default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.creative_versions;
  cm public.comments;
begin
  perform app.require_user();
  select * into v from public.creative_versions where id = p_version_id;
  if not found or not app.can_read_version(p_version_id) then
    perform app.fail('not_found', 'No such creative version.');
  end if;
  if app.customer_is(v.workspace_id, array['viewer']) then
    perform app.fail('forbidden', 'Viewers cannot comment.');
  end if;
  if coalesce(trim(p_text), '') = '' then
    perform app.fail('invalid', 'Write the comment.');
  end if;
  insert into public.comments (workspace_id, version_id, author, text, pin)
  values (v.workspace_id, v.id, auth.uid(), p_text, p_pin) returning * into cm;
  perform app.record(v.workspace_id, 'comment.added', 'comment', cm.id);
  return to_jsonb(cm);
end $$;

-- ─── Delivery ────────────────────────────────────────────────────────────────

-- A delivery names exact approved versions and their files. Open critical findings block it.
create or replace function public.make_delivery(
  p_campaign_id uuid, p_rights_note text, p_version_ids uuid[] default null, p_name text default null,
  p_key text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('campaign_id', p_campaign_id, 'rights_note', p_rights_note,
                                  'version_ids', to_jsonb(p_version_ids), 'name', p_name);
  prior jsonb;
  c public.campaigns;
  d public.deliveries;
  v record;
  n int := 0;
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'make_delivery', req);
  if prior is not null then return prior; end if;

  select * into c from public.campaigns where id = p_campaign_id;
  if not found or not app.can_read(c.workspace_id) then
    perform app.fail('not_found', 'No such campaign.');
  end if;
  if not (app.customer_is(c.workspace_id, array['owner', 'approver']) or app.is_staff(c.workspace_id, array['operator'])) then
    perform app.fail('forbidden', 'Only the approver or an operator makes a delivery.');
  end if;
  if coalesce(trim(p_rights_note), '') = '' then
    perform app.fail('invalid', 'A delivery needs its usage rights.');
  end if;

  insert into public.deliveries (workspace_id, campaign_id, name, rights_note, created_by)
  values (c.workspace_id, c.id, coalesce(p_name, c.name), p_rights_note, auth.uid()) returning * into d;

  for v in
    select cv.*, cr.name as creative_name, cr.format, a.id as approval_id, f.sha256 as file_sha, f.name as file_name
    from public.creatives cr
    join lateral (select * from public.creative_versions x where x.creative_id = cr.id order by number desc limit 1) cv on true
    left join public.approvals a on a.version_id = cv.id and a.revoked_at is null
    left join public.files f on f.id = cv.file_id
    where cr.campaign_id = c.id and (p_version_ids is null or cv.id = any (p_version_ids))
  loop
    if v.state not in ('approved', 'delivered') or v.approval_id is null then
      if p_version_ids is not null then
        perform app.fail('invalid', 'Only approved versions go into a delivery.');
      end if;
      continue;
    end if;
    if v.file_id is null then
      perform app.fail('invalid', 'An approved version has no file.');
    end if;
    if exists (select 1 from public.findings fi where fi.version_id = v.id and fi.severity = 'critical' and fi.status = 'open') then
      perform app.fail('invalid', 'A critical finding is open on an approved version.');
    end if;
    insert into public.delivery_items (delivery_id, workspace_id, creative_id, version_id, approval_id, file_id, sha256, filename)
    values (
      d.id, d.workspace_id, v.creative_id, v.id, v.approval_id, v.file_id, v.file_sha,
      v.creative_name || '_v' || v.number || coalesce('.' || nullif(split_part(v.file_name, '.', -1), v.file_name), '')
    );
    update public.creative_versions set state = 'delivered' where id = v.id;
    n := n + 1;
  end loop;
  if n = 0 then
    perform app.fail('invalid', 'Nothing approved to deliver yet.');
  end if;
  if (p_version_ids is not null and n <> cardinality(p_version_ids)) then
    perform app.fail('invalid', 'Some of the versions named are not the current, approved ones.');
  end if;
  if not exists (
    select 1 from public.creatives cr where cr.campaign_id = c.id and (app.latest_version(cr.id)).state <> 'delivered'
  ) then
    update public.campaigns set state = 'delivered', stage = 'delivery' where id = c.id;
  end if;
  perform app.record(c.workspace_id, 'delivery.made', 'delivery', d.id, jsonb_build_object('items', n));
  return app.idem_end(p_key, 'make_delivery', req, to_jsonb(d) || jsonb_build_object('items', n));
end $$;

create or replace function public.mark_downloaded(p_delivery_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  d public.deliveries;
begin
  perform app.require_user();
  select * into d from public.deliveries where id = p_delivery_id;
  if not found or not app.can_read(d.workspace_id) then
    perform app.fail('not_found', 'No such delivery.');
  end if;
  if d.state = 'ready' then
    update public.deliveries set state = 'downloaded', downloaded_at = now() where id = d.id returning * into d;
    perform app.record(d.workspace_id, 'delivery.downloaded', 'delivery', d.id);
  end if;
  return to_jsonb(d);
end $$;

create or replace function public.confirm_live(p_delivery_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  d public.deliveries;
begin
  perform app.require_user();
  select * into d from public.deliveries where id = p_delivery_id;
  if not found or not app.can_read(d.workspace_id) then
    perform app.fail('not_found', 'No such delivery.');
  end if;
  if not app.customer_is(d.workspace_id, array['owner', 'approver']) then
    perform app.fail('forbidden', 'Only the approver confirms it is live.');
  end if;
  update public.deliveries set state = 'confirmed_live', confirmed_live_at = now(), confirmed_live_by = auth.uid()
  where id = d.id returning * into d;
  perform app.record(d.workspace_id, 'delivery.confirmed_live', 'delivery', d.id);
  return to_jsonb(d);
end $$;

-- ─── Grants: commands are callable by signed-in people; helpers are not ─────

revoke execute on all functions in schema app from public, anon;
grant execute on all functions in schema app to authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'verify_fact', 'correct_fact', 'register_file', 'create_campaign', 'send_brief', 'write_plan', 'ask_plan_check',
    'check_plan', 'ask_plan_changes', 'approve_plan', 'undo_approve_plan', 'start_job', 'set_job_state', 'add_candidate',
    'send_to_check', 'add_finding', 'resolve_finding', 'mark_checked', 'request_correction', 'hold_version',
    'send_checked', 'approve_versions', 'undo_approval', 'request_changes', 'add_comment', 'make_delivery',
    'mark_downloaded', 'confirm_live'
  ] loop
    execute format('revoke execute on function public.%I from public, anon', f);
    execute format('grant execute on function public.%I to authenticated', f);
  end loop;
end $$;
