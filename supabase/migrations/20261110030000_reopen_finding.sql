-- "Not a problem" in Check can be taken back (FLOWS §35.1, DECIDED 10 Nov 2026): the one who checks sets one of the
-- Engine's findings aside (resolve_finding, accepted), and while the version still waits for its check, they may open
-- it again. A finding the Engine fixed (resolved) stays resolved, and a checked version's findings stay as they were.
create or replace function public.reopen_finding(p_finding_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  f public.findings;
  v public.creative_versions;
begin
  perform app.require_user();
  select * into f from public.findings where id = p_finding_id;
  if not found or not app.can_check(f.workspace_id) then
    perform app.fail('not_found', 'No such finding.');
  end if;
  if f.status = 'open' then return to_jsonb(f); end if;
  if f.status <> 'accepted' then
    perform app.fail('invalid', 'Only a finding set aside can be opened again.');
  end if;
  select * into v from public.creative_versions where id = f.version_id;
  if v.state not in ('in_check', 'correcting', 'held') then
    perform app.fail('conflict', 'This version has been checked; its findings stay as they were.');
  end if;
  update public.findings set status = 'open', resolved_by = null, resolved_at = null where id = f.id returning * into f;
  perform app.record(f.workspace_id, 'finding.reopened', 'finding', f.id);
  return to_jsonb(f);
end $$;

revoke all on function public.reopen_finding(uuid) from public, anon;
grant execute on function public.reopen_finding(uuid) to authenticated;
