-- An agency of one person does everything itself (Marcus, 4 Nov 2026): the only person in the agency may check a
-- version they made. Two pairs of eyes still hold for Fume's own people and for every agency with two or more people.
-- The check is marked as one's own in the record (detail own_work), so the quality log can tell.

-- Whether the caller is the one and only person of the agency that runs this workspace.
create or replace function app.solo_agency(ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspaces w join public.agency_seats a on a.organisation_id = w.agency_id
    where w.id = ws and a.user_id = auth.uid()
  ) and (
    select count(*) from public.workspaces w join public.agency_seats a on a.organisation_id = w.agency_id
    where w.id = ws
  ) = 1
$$;
revoke execute on function app.solo_agency(uuid) from public, anon;

create or replace function public.mark_checked(p_version_id uuid, p_items jsonb default '[]', p_key text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('version_id', p_version_id, 'items', p_items);
  prior jsonb;
  v public.creative_versions;
  ch public.expert_checks;
  own boolean;
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
  -- Two pairs of eyes: the person who made a version never checks it, unless they are the whole agency.
  own := exists (select 1 from public.candidates cand where cand.id = v.candidate_id and cand.made_by = auth.uid());
  if own and not app.solo_agency(v.workspace_id) then
    perform app.fail('forbidden', 'Someone else checks a version you made.');
  end if;
  update public.creative_versions set state = 'checked' where id = v.id returning * into v;
  update public.expert_checks set state = 'checked', expert_id = auth.uid(), decided_at = now(), items = p_items
  where version_id = v.id returning * into ch;
  perform app.record(v.workspace_id, 'version.checked', 'creative_version', v.id,
    case when own then '{"own_work": true}'::jsonb else '{}'::jsonb end);
  return app.idem_end(p_key, 'mark_checked', req, to_jsonb(v));
end $$;
