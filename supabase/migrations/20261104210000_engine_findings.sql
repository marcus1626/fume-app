-- The Engine's picture check as findings (docs/mvp/engine.md, step 12). What the vision model saw on a picture becomes
-- automated findings on the version made from it, by dimension and weight, with what was expected and what was seen:
-- evidence the expert works through, in the same place as the file check's. Like the file check's, none is critical:
-- a machine's reading never blocks a check on its own; the expert decides, and adds a critical finding when it is one.
-- Customers never read automated findings (findings_read).

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
  if exists (select 1 from public.findings where version_id = v.id and method = 'automated' and dimension <> 'file_spec') then
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

-- A version made from a picture the Engine already looked at gets its findings when it is made ...
create or replace function app.on_version_engine_findings() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.engine_findings(new.id);
  return new;
end $$;
revoke execute on function app.on_version_engine_findings() from public, anon, authenticated;
create trigger engine_findings_on_new_version
after insert on public.creative_versions
for each row when (new.candidate_id is not null)
execute function app.on_version_engine_findings();

-- ... and a version made before the Engine finished looking gets them when it does.
create or replace function public.engine_evaluated(p_candidate_id uuid, p_evaluation jsonb, p_llm_usd numeric) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v uuid;
begin
  if jsonb_typeof(p_evaluation) <> 'object'
    or p_evaluation ->> 'productTruth' not in ('pass', 'flag')
    or p_evaluation ->> 'brandRules' not in ('pass', 'flag')
    or p_evaluation ->> 'artefacts' not in ('none', 'minor', 'major')
    or jsonb_typeof(p_evaluation -> 'notes') <> 'array' then
    perform app.fail('invalid', 'An evaluation says product truth, brand rules, artefacts and notes.');
  end if;
  update public.candidates set evaluation = p_evaluation, evaluation_usd = greatest(coalesce(p_llm_usd, 0), 0)
  where id = p_candidate_id and origin = 'engine';
  if not found then perform app.fail('not_found', 'No such picture of the Engine.'); end if;
  for v in select id from public.creative_versions where candidate_id = p_candidate_id loop
    perform app.engine_findings(v);
  end loop;
end $$;
revoke execute on function public.engine_evaluated(uuid, jsonb, numeric) from public, anon, authenticated;
grant execute on function public.engine_evaluated(uuid, jsonb, numeric) to service_role;
