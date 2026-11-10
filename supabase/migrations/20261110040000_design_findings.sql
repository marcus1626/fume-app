-- Fume's own look at a design reaches Check (FLOWS §33/§35, DECIDED 10 Nov 2026). What Fume's review and the design
-- service's measured checks found on a design (design_layers.findings and .checks) stayed in the staff-only layer: a
-- design sent to check said "Nothing flagged" while its layer named eleven faults (Anthem Sand league V6, 10 Nov). They
-- become automated findings on the version made from the design, as the Engine's picture check does
-- (20261104210000_engine_findings.sql): the review's "Not like the brand" points under the brief, the rest under
-- composition, and a measured check that failed (words that break or run out of the safe area) as major. Like the
-- Engine's, a machine's reading is never critical on its own: the expert decides. Customers never read automated
-- findings (findings_read).

create or replace function app.design_findings(p_version_id uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v public.creative_versions;
  l public.design_layers;
  n int;
begin
  select * into v from public.creative_versions where id = p_version_id;
  if not found or v.candidate_id is null or v.state not in ('making', 'in_check', 'correcting', 'held') then
    return 0;
  end if;
  select * into l from public.design_layers
  where result_candidate_id = v.candidate_id and state = 'made' order by created_at desc limit 1;
  if not found then return 0; end if;
  -- Once per version.
  if exists (select 1 from public.findings where version_id = v.id and method = 'automated' and detail like 'design:%') then
    return 0;
  end if;

  insert into public.findings (workspace_id, version_id, method, dimension, severity, finding, detail)
  select v.workspace_id, v.id, 'automated', x.dimension, x.severity, left(x.finding, 500), 'design:' || x.ord
  from (
    select case when f ->> 'what' like 'Not like the brand%' then 'brand_brief' else 'composition' end dimension,
      case when f ->> 'severity' in ('critical', 'major') then 'major' else 'minor' end severity,
      trim(f ->> 'what') finding, o ord
    from jsonb_array_elements(case when jsonb_typeof(l.findings) = 'array' then l.findings else '[]' end)
      with ordinality t(f, o)
    where f ->> 'severity' in ('critical', 'major', 'minor') and nullif(trim(f ->> 'what'), '') is not null
    union all
    select 'composition', 'major', coalesce(nullif(c ->> 'node', ''), 'Words') || ': ' || coalesce(nullif(trim(c ->> 'note'), ''), 'a measured check failed.'),
      1000 + o
    from jsonb_array_elements(case when jsonb_typeof(l.checks) = 'array' then l.checks else '[]' end)
      with ordinality t(c, o)
    where c ->> 'ok' = 'false' and c ->> 'hard' = 'true'
  ) x
  order by x.ord;
  get diagnostics n = row_count;
  if n > 0 then
    perform app.record(v.workspace_id, 'design.findings', 'creative_version', v.id, jsonb_build_object('findings', n));
  end if;
  return n;
end $$;
revoke execute on function app.design_findings(uuid) from public, anon, authenticated;

create or replace function app.on_version_design_findings() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.design_findings(new.id);
  return new;
end $$;
revoke execute on function app.on_version_design_findings() from public, anon, authenticated;
create trigger design_findings_on_new_version
after insert on public.creative_versions
for each row when (new.candidate_id is not null)
execute function app.on_version_design_findings();

-- A design already waiting for a check gets them now.
select app.design_findings(id) from public.creative_versions
where state in ('making', 'in_check', 'correcting', 'held') and candidate_id is not null;
