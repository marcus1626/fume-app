-- A clear fault on the product stops the check until the expert decides (Marcus, 6 Nov 2026: «Stopp til eksperten
-- avgjør»). What the picture check found wrong on a picture (a part missing or different, a label that reads wrong:
-- candidates.details, docs/mvp/product-parts.md) becomes a critical finding on each version made from that picture.
-- mark_checked already refuses a version with an open critical finding; the expert fixes the picture (a new version)
-- or accepts the finding with their name (resolve_finding 'accepted'). Customers never read automated findings.

-- Which detail of the picture a finding came from (the part's key, or the print's words), so a read made again adds
-- only what is new, and the Engine's own findings still come once.
alter table public.findings add column detail text;
comment on column public.findings.detail is
  'The detail of the picture check this automated finding came from: a part''s key, or ''print:'' and the words.';

create or replace function app.detail_findings(p_version_id uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v public.creative_versions;
  c public.candidates;
  n int;
begin
  select * into v from public.creative_versions where id = p_version_id;
  if not found or v.candidate_id is null or v.state not in ('making', 'in_check', 'correcting', 'held') then return 0; end if;
  select * into c from public.candidates where id = v.candidate_id;
  -- A designed picture is read on the picture under its words.
  if c.details is null and c.designed_from is not null then
    select * into c from public.candidates where id = c.designed_from;
  end if;
  if c.details is null then return 0; end if;
  insert into public.findings (workspace_id, version_id, method, dimension, severity, finding, region, expected, observed, detail)
  select v.workspace_id, v.id, 'automated', 'product', 'critical',
    left(coalesce(nullif(d ->> 'note', ''), 'The ' || coalesce(d ->> 'what', 'product') || ' is not as on the product.'), 500),
    case when jsonb_typeof(d -> 'box') = 'object' then d -> 'box' end,
    left(d ->> 'expected', 500), left(d ->> 'reads', 500), x.detail
  from jsonb_array_elements(c.details) d
  cross join lateral (select case when d ->> 'kind' = 'part' then d ->> 'part' else 'print:' || coalesce(d ->> 'expected', d ->> 'what') end detail) x
  where (d ->> 'ok')::boolean is false and x.detail is not null
    -- Once per detail: a finding the expert already decided on (accepted, or resolved) is not raised again.
    and not exists (select 1 from public.findings f where f.version_id = v.id and f.detail = x.detail);
  get diagnostics n = row_count;
  if n > 0 then
    perform app.record(v.workspace_id, 'product.faults', 'creative_version', v.id, jsonb_build_object('findings', n));
  end if;
  return n;
end $$;
revoke execute on function app.detail_findings(uuid) from public, anon, authenticated;

-- A version made from a picture already read gets its findings when it is made ...
create or replace function app.on_version_detail_findings() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.detail_findings(new.id);
  return new;
end $$;
revoke execute on function app.on_version_detail_findings() from public, anon, authenticated;
create trigger detail_findings_on_new_version
after insert on public.creative_versions
for each row when (new.candidate_id is not null)
execute function app.on_version_detail_findings();

-- ... and a version made before the read finished gets them when it does.
create or replace function public.details_finish(p_candidate_id uuid, p_details jsonb, p_llm_usd numeric) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.candidates;
  wrong jsonb;
  kept jsonb;
  v uuid;
begin
  if jsonb_typeof(coalesce(p_details, '[]')) <> 'array' then perform app.fail('invalid', 'The details are a list.'); end if;
  select * into c from public.candidates where id = p_candidate_id for update;
  if not found then return; end if;
  select coalesce(jsonb_agg(d ->> 'note'), '[]') into wrong
  from jsonb_array_elements(coalesce(p_details, '[]')) d
  where (d ->> 'ok')::boolean is false and coalesce(d ->> 'note', '') <> '';
  -- The evaluation's own notes, without the ones the last read added.
  select coalesce(jsonb_agg(n), '[]') into kept
  from jsonb_array_elements(coalesce(c.evaluation -> 'notes', '[]')) n
  where not exists (select 1 from jsonb_array_elements(coalesce(c.details, '[]')) d where d ->> 'note' = n #>> '{}');
  update public.candidates set
    details = coalesce(p_details, '[]'),
    details_usd = details_usd + greatest(coalesce(p_llm_usd, 0), 0),
    evaluation = case
      when evaluation is null then evaluation
      when jsonb_array_length(wrong) = 0 then evaluation || jsonb_build_object('notes', kept)
      else evaluation || jsonb_build_object('productTruth', 'flag', 'notes', kept || wrong)
    end
  where id = c.id;
  for v in
    select cv.id from public.creative_versions cv join public.candidates x on x.id = cv.candidate_id
    where x.id = c.id or (x.designed_from = c.id and x.details is null)
  loop
    perform app.detail_findings(v);
  end loop;
end $$;
revoke execute on function public.details_finish(uuid, jsonb, numeric) from public, anon, authenticated;
grant execute on function public.details_finish(uuid, jsonb, numeric) to service_role;

-- The Engine's own findings still come once per version: the picture check's findings are not its own.
create or replace function app.engine_findings(p_version_id uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v public.creative_versions;
  e jsonb;
  n int;
begin
  select * into v from public.creative_versions where id = p_version_id;
  if not found or v.candidate_id is null then return 0; end if;
  select evaluation into e from public.candidates where id = v.candidate_id and origin = 'engine';
  if e is null or not coalesce((e ->> 'evaluated')::boolean, false) then return 0; end if;
  -- Once per version.
  if exists (select 1 from public.findings where version_id = v.id and method = 'automated' and dimension <> 'file_spec'
             and detail is null) then
    return 0;
  end if;

  insert into public.findings (workspace_id, version_id, method, dimension, severity, finding, expected, observed)
  select v.workspace_id, v.id, 'automated', x.dimension, x.severity, left(x.finding, 500), left(x.expected, 500), left(x.observed, 500)
  from (
    -- The product first: off is major; a product the picture does not let one judge is minor.
    select 'product' dimension, case when i ->> 'verdict' = 'off' then 'major' else 'minor' end severity,
      coalesce(i ->> 'note', case when i ->> 'verdict' = 'off' then 'The product is not as in its photographs.'
                                 else 'The picture does not show the product well enough to tell.' end) finding,
      i ->> 'item' expected, i ->> 'note' observed, 1 rank, o ord
    from jsonb_array_elements(coalesce(e -> 'items', '[]')) with ordinality t(i, o)
    where i ->> 'area' = 'product' and i ->> 'verdict' in ('off', 'unclear')
    union all
    -- The brand's rules and the planned scene: a hard rule off is major, the rest minor.
    select 'brand_brief', case when coalesce((i ->> 'hard')::boolean, false) then 'major' else 'minor' end,
      coalesce(i ->> 'note', 'Off: ' || (i ->> 'item')), i ->> 'item', i ->> 'note', 2, o
    from jsonb_array_elements(coalesce(e -> 'items', '[]')) with ordinality t(i, o)
    where i ->> 'area' in ('brand', 'scene') and i ->> 'verdict' = 'off'
    union all
    select 'artefacts', case when e ->> 'artefacts' = 'major' then 'major' else 'minor' end, a #>> '{}', null, a #>> '{}', 3, o
    from jsonb_array_elements(coalesce(e -> 'artefactNotes', '[]')) with ordinality t(a, o)
    where e ->> 'artefacts' in ('minor', 'major') and nullif(trim(a #>> '{}'), '') is not null
    union all
    select 'text_claims', 'major', 'The picture has printed words that were not asked for.', 'No words outside the product and what was asked for.',
      null, 4, 1
    where coalesce((e ->> 'printedText')::boolean, false)
  ) x
  order by x.rank, x.ord;
  get diagnostics n = row_count;
  if n > 0 then
    perform app.record(v.workspace_id, 'engine.findings', 'creative_version', v.id, jsonb_build_object('findings', n));
  end if;
  return n;
end $$;
revoke execute on function app.engine_findings(uuid) from public, anon, authenticated;
