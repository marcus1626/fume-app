-- From the database advisor (3 Nov): the packages policy asks auth.uid() once per query, not once per row, and three
-- foreign keys get the index their joins and deletes look for.

drop policy if exists packages_read on public.packages;
create policy packages_read on public.packages for select to authenticated using (
  (select app.is_admin())
  or exists (select 1 from public.workspaces w where w.organisation_id = packages.organisation_id and app.can_read(w.id))
  or exists (select 1 from public.agency_seats s where s.organisation_id = packages.organisation_id and s.user_id = (select auth.uid()))
);

create index if not exists invitations_agency_id_idx on public.invitations (agency_id);
create index if not exists onboarding_progress_updated_by_idx on public.onboarding_progress (updated_by);
create index if not exists taste_variables_key_idx on public.taste_variables (key);
