-- What Supabase's database advisors asked for (27 Oct 2026).
-- 1. Every foreign key gets an index, so deletes and joins on it do not scan the whole table.
-- 2. profiles_read asks auth.uid() once per query, not once per row.
-- 3. app.require_user keeps a fixed search_path (an earlier `create or replace` dropped it).
-- Left as they are, on purpose: the commands in public are SECURITY DEFINER and callable by signed-in users
-- because that is the app's API (each one checks who may do what); the 24-hour email links were Marcus's choice.

create index if not exists approvals_decided_by_idx on public.approvals (decided_by);
create index if not exists approvals_workspace_id_idx on public.approvals (workspace_id);
create index if not exists brand_dna_versions_approved_by_idx on public.brand_dna_versions (approved_by);
create index if not exists brand_rules_source_id_idx on public.brand_rules (source_id);
create index if not exists brand_rules_workspace_id_idx on public.brand_rules (workspace_id);
create index if not exists brief_versions_sent_by_idx on public.brief_versions (sent_by);
create index if not exists brief_versions_workspace_id_idx on public.brief_versions (workspace_id);
create index if not exists campaign_products_product_id_idx on public.campaign_products (product_id);
create index if not exists campaign_products_workspace_id_idx on public.campaign_products (workspace_id);
create index if not exists campaigns_approver_id_idx on public.campaigns (approver_id);
create index if not exists campaigns_created_by_idx on public.campaigns (created_by);
create index if not exists candidates_attempt_id_idx on public.candidates (attempt_id);
create index if not exists candidates_file_id_idx on public.candidates (file_id);
create index if not exists candidates_made_by_idx on public.candidates (made_by);
create index if not exists candidates_workspace_id_idx on public.candidates (workspace_id);
create index if not exists change_requests_by_idx on public.change_requests (by);
create index if not exists change_requests_new_version_id_idx on public.change_requests (new_version_id);
create index if not exists change_requests_workspace_id_idx on public.change_requests (workspace_id);
create index if not exists comments_author_idx on public.comments (author);
create index if not exists comments_workspace_id_idx on public.comments (workspace_id);
create index if not exists context_snapshots_brand_dna_version_id_idx on public.context_snapshots (brand_dna_version_id);
create index if not exists context_snapshots_brief_version_id_idx on public.context_snapshots (brief_version_id);
create index if not exists context_snapshots_campaign_id_idx on public.context_snapshots (campaign_id);
create index if not exists context_snapshots_plan_version_id_idx on public.context_snapshots (plan_version_id);
create index if not exists context_snapshots_workspace_id_idx on public.context_snapshots (workspace_id);
create index if not exists creative_versions_candidate_id_idx on public.creative_versions (candidate_id);
create index if not exists creative_versions_job_id_idx on public.creative_versions (job_id);
create index if not exists creative_versions_master_version_id_idx on public.creative_versions (master_version_id);
create index if not exists creative_versions_sent_by_idx on public.creative_versions (sent_by);
create index if not exists creative_versions_workspace_id_idx on public.creative_versions (workspace_id);
create index if not exists creatives_master_id_idx on public.creatives (master_id);
create index if not exists creatives_workspace_id_idx on public.creatives (workspace_id);
create index if not exists deliveries_campaign_id_idx on public.deliveries (campaign_id);
create index if not exists deliveries_confirmed_live_by_idx on public.deliveries (confirmed_live_by);
create index if not exists deliveries_created_by_idx on public.deliveries (created_by);
create index if not exists deliveries_workspace_id_idx on public.deliveries (workspace_id);
create index if not exists delivery_items_approval_id_idx on public.delivery_items (approval_id);
create index if not exists delivery_items_creative_id_idx on public.delivery_items (creative_id);
create index if not exists delivery_items_version_id_idx on public.delivery_items (version_id);
create index if not exists delivery_items_workspace_id_idx on public.delivery_items (workspace_id);
create index if not exists expert_checks_expert_id_idx on public.expert_checks (expert_id);
create index if not exists expert_checks_snapshot_id_idx on public.expert_checks (snapshot_id);
create index if not exists expert_checks_workspace_id_idx on public.expert_checks (workspace_id);
create index if not exists files_uploaded_by_idx on public.files (uploaded_by);
create index if not exists findings_created_by_idx on public.findings (created_by);
create index if not exists findings_resolved_by_idx on public.findings (resolved_by);
create index if not exists findings_workspace_id_idx on public.findings (workspace_id);
create index if not exists invitations_invited_by_idx on public.invitations (invited_by);
create index if not exists invitations_workspace_id_idx on public.invitations (workspace_id);
create index if not exists job_attempts_workspace_id_idx on public.job_attempts (workspace_id);
create index if not exists memberships_workspace_id_idx on public.memberships (workspace_id);
create index if not exists plan_versions_approved_by_idx on public.plan_versions (approved_by);
create index if not exists plan_versions_brand_dna_version_id_idx on public.plan_versions (brand_dna_version_id);
create index if not exists plan_versions_brief_version_id_idx on public.plan_versions (brief_version_id);
create index if not exists plan_versions_check_asked_by_idx on public.plan_versions (check_asked_by);
create index if not exists plan_versions_checked_by_idx on public.plan_versions (checked_by);
create index if not exists plan_versions_workspace_id_idx on public.plan_versions (workspace_id);
create index if not exists product_facts_created_by_idx on public.product_facts (created_by);
create index if not exists product_facts_source_id_idx on public.product_facts (source_id);
create index if not exists product_facts_superseded_by_idx on public.product_facts (superseded_by);
create index if not exists product_facts_verified_by_idx on public.product_facts (verified_by);
create index if not exists product_facts_workspace_id_idx on public.product_facts (workspace_id);
create index if not exists production_jobs_requested_by_idx on public.production_jobs (requested_by);
create index if not exists production_jobs_snapshot_id_idx on public.production_jobs (snapshot_id);
create index if not exists production_jobs_workspace_id_idx on public.production_jobs (workspace_id);
create index if not exists record_events_actor_idx on public.record_events (actor);
create index if not exists sources_created_by_idx on public.sources (created_by);
create index if not exists sources_file_id_idx on public.sources (file_id);
create index if not exists staff_assignments_workspace_id_idx on public.staff_assignments (workspace_id);
create index if not exists task_runs_workspace_id_idx on public.task_runs (workspace_id);
create index if not exists workspaces_organisation_id_idx on public.workspaces (organisation_id);

drop policy profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (
  id = (select auth.uid()) or app.is_admin() or exists (
    select 1 from public.memberships m where m.user_id = profiles.id and app.can_read(m.workspace_id)
  ) or exists (
    select 1 from public.staff_assignments s where s.user_id = profiles.id and app.can_read(s.workspace_id)
  )
);

alter function app.require_user() set search_path = '';
