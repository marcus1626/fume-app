-- A brand read again kept only the items someone had answered one by one, and dropped the rest of the approved Brand
-- DNA with the old proposals. Anthem (9 Nov): its Brand DNA was approved as a whole, a new reading found one new
-- typeface, and approving the update left the brand with that typeface alone. What the approved version holds now
-- stays in the draft; only proposals nobody approved are replaced by the new reading.
create or replace function public.save_brand_scan(
  p_workspace_id uuid, p_url text, p_identity jsonb, p_sources jsonb default '[]', p_finds jsonb default '[]',
  p_error text default null, p_source text default 'website', p_files text[] default '{}'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  d public.brand_dna_versions;
  k text;
  merged jsonb;
  s public.brand_scans;
  approved jsonb;
begin
  perform app.require_user();
  if not app.can_read(p_workspace_id) then perform app.fail('not_found', 'No such brand.'); end if;
  if not app.brand_writer(p_workspace_id) then
    perform app.fail('forbidden', 'Only the brand''s owner or approver, or the people who run it, read the brand in.');
  end if;
  if p_error is null then
    d := app.draft_dna(p_workspace_id);
    -- What the approved Brand DNA holds stays, even where nobody answered it one by one: approving the version keeps
    -- it all. Only the proposals of a draft nobody approved are read again.
    select v.identity into approved from public.brand_dna_versions v
    where v.workspace_id = p_workspace_id and v.state = 'approved' order by v.version desc limit 1;
    merged := d.identity;
    foreach k in array array['colours', 'typefaces', 'logos', 'voice', 'imagery'] loop
      merged := jsonb_set(merged, array[k], (
        select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(coalesce(d.identity -> k, '[]')) x
        where x #>> '{provenance,state}' <> 'proposed' or x ->> 'id' in (select a ->> 'id' from jsonb_array_elements(coalesce(approved -> k, '[]')) a)
      ) || app.identity_items(p_identity -> k));
    end loop;
    if p_identity ? 'voiceBook' then merged := merged || jsonb_build_object('voiceBook', p_identity -> 'voiceBook'); end if;
    update public.brand_dna_versions set identity = merged where id = d.id;
    if nullif(trim(coalesce(p_url, '')), '') is not null and not exists (
      select 1 from public.sources where workspace_id = p_workspace_id and kind = 'website' and url = trim(p_url)
    ) then
      insert into public.sources (workspace_id, kind, name, url, retrieved_at, created_by)
      values (p_workspace_id, 'website', regexp_replace(trim(p_url), '^https?://', ''), trim(p_url), now(), auth.uid());
    end if;
  end if;
  insert into public.brand_scans (workspace_id, source, url, files, state, sources, finds, error, created_by)
  values (p_workspace_id, coalesce(p_source, 'website'), nullif(trim(coalesce(p_url, '')), ''), coalesce(p_files, '{}'),
          case when p_error is null then 'done' else 'failed' end, coalesce(p_sources, '[]'), coalesce(p_finds, '[]'),
          p_error, auth.uid())
  returning * into s;
  perform app.record(p_workspace_id, 'brand.read', 'workspace', p_workspace_id,
    jsonb_build_object('scan', s.id, 'url', s.url, 'finds', jsonb_array_length(s.finds), 'failed', p_error is not null));
  return to_jsonb(s);
end $$;
