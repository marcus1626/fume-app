-- The prompt graph (docs/mvp/engine.md, step 11): every prompt the Engine wrote, what it was built from, and what
-- happened to its pictures, so Fume can count which kinds of prompt work for which model and which do not. Read on
-- demand from what is already kept: the prompt and its compile package and ledger, the picture check, and people's
-- verdicts (the designer's pick, the Yes or No, the expert's check, the customer's approval or change).
--
-- A prompt's score is its best picture's. People's verdicts outrank the machine's check:
--   1.0 the customer approved it        0.8 an expert checked it        0.7 a person said Yes
--   0.6 a designer took it as a version 0.2 a correction or change was asked     0.0 a person said No
--   machine only: 0.5 the check passed, 0.25 a brand rule flagged or major artefacts, 0.1 the product flagged.

create or replace function app.engine_prompt_rows(p_workspace_id uuid) returns table (
  prompt_id uuid, workspace_id uuid, created_at timestamptz, image_model text, image_type text, grammar_version int,
  dialect_version int, rewrites int, llm_usd numeric, features text[], score numeric, signal text, pictures int
)
language sql stable security definer set search_path = '' as $$
  with p as (
    select ep.* from public.engine_prompts ep
    where ep.status = 'validated' and (p_workspace_id is null or ep.workspace_id = p_workspace_id)
  ),
  c as (
    select p.id prompt_id, cd.id candidate_id,
      (select case
         when exists (select 1 from public.creative_versions v join public.approvals a on a.version_id = v.id and a.revoked_at is null
                      where v.candidate_id = cd.id) then 1.0
         when exists (select 1 from public.creative_versions v join public.expert_checks e on e.version_id = v.id and e.state = 'checked'
                      where v.candidate_id = cd.id) then 0.8
         when exists (select 1 from public.engine_lessons l where l.source_candidate_id = cd.id and l.verdict = 'no') then 0.0
         when exists (select 1 from public.creative_versions v where v.candidate_id = cd.id
                      and (exists (select 1 from public.change_requests x where x.version_id = v.id and x.withdrawn_at is null)
                        or exists (select 1 from public.expert_checks e where e.version_id = v.id and e.state = 'correction'))) then 0.2
         when exists (select 1 from public.engine_lessons l where l.source_candidate_id = cd.id and l.verdict = 'yes') then 0.7
         when exists (select 1 from public.creative_versions v where v.candidate_id = cd.id) then 0.6
         when cd.evaluation ->> 'productTruth' = 'flag' then 0.1
         when cd.evaluation ->> 'brandRules' = 'flag' or cd.evaluation ->> 'artefacts' = 'major' then 0.25
         when cd.evaluation is not null then 0.5
       end) score
    from p join public.candidates cd on cd.attempt_id = p.attempt_id
  ),
  best as (
    select prompt_id, max(score) score, count(*) pictures from c group by prompt_id
  )
  select p.id, p.workspace_id, p.created_at, p.image_model,
    coalesce(p.compile_package #>> '{target,imageType}', 'campaign_still'),
    (p.compile_package #>> '{grammar,version}')::int, (p.compile_package #>> '{dialect,version}')::int,
    greatest(jsonb_array_length(p.attempts) - 1, 0), p.llm_usd,
    -- What the prompt was built from, as features to count: the model's rules, the brand's kinds of rule and lesson,
    -- and the kinds of data its ledger says went in.
    array(select distinct f from (
      select 'dialect:' || (r ->> 'id') f from jsonb_array_elements(coalesce(p.compile_package #> '{dialect,rules}', '[]')) r
      union all select 'rule:' || case
          when r ->> 'id' like 'taste-%' then 'taste'
          when r ->> 'id' like 'brain-%' then regexp_replace(r ->> 'id', '^(brain-[a-z]+).*$', '\1')
          when r ->> 'id' like 'look-%' then 'look'
          when r ->> 'id' like 'people%' then 'people'
          else 'brand_dna_' || (r ->> 'binding') end
        from jsonb_array_elements(coalesce(p.compile_package -> 'brandRules', '[]')) r
      union all select 'lesson:' || case when l ->> 'id' like 'brain-%' then 'brand_history' else 'verdict' end
        from jsonb_array_elements(coalesce(p.compile_package #> '{knowledge,lessons}', '[]')) l
      union all select 'exemplar' from jsonb_array_elements(coalesce(p.compile_package #> '{knowledge,exemplars}', '[]')) e
      union all select 'used:' || (e ->> 'source') from jsonb_array_elements(p.ledger) e where (e ->> 'used')::boolean
      union all select 'references:' || jsonb_array_length(coalesce(p.compile_package -> 'references', '[]'))
      union all select 'rewritten' where jsonb_array_length(p.attempts) > 1
    ) x order by f),
    b.score, case
      when b.score = 1.0 then 'approved' when b.score = 0.8 then 'checked' when b.score = 0.7 then 'yes'
      when b.score = 0.6 then 'picked' when b.score = 0.2 then 'changed' when b.score = 0.0 then 'no'
      when b.score is not null then 'machine' end,
    coalesce(b.pictures, 0)::int
  from p left join best b on b.prompt_id = p.id
$$;
revoke execute on function app.engine_prompt_rows(uuid) from public, anon, authenticated;

-- What works: per model and kind of picture, and per feature with and without it. A brand's own numbers for Fume's
-- people on it; every brand's (only how models behave, never a brand's data) for Fume's admins. Few prompts make
-- noisy numbers, so each line says how many it rests on.
create or replace function public.engine_learning(p_workspace_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not (
    (p_workspace_id is not null and app.is_fume_staff(p_workspace_id)) or (p_workspace_id is null and app.is_admin())
  ) then
    perform app.fail('forbidden', 'Only Fume''s own people read what the Engine learned.');
  end if;
  return (
    with r as (select * from app.engine_prompt_rows(p_workspace_id)),
    s as (select * from r where score is not null),
    f as (select distinct unnest(features) feature from s)
    select jsonb_build_object(
      'prompts', (select count(*) from r),
      'scored', (select count(*) from s),
      'by_type', coalesce((select jsonb_agg(jsonb_build_object('image_model', image_model, 'image_type', image_type,
          'prompts', n, 'scored', k, 'mean', m, 'approved', a, 'product_flagged', pf, 'rewritten', rw) order by n desc)
        from (select image_model, image_type, count(*) n, count(score) k, round(avg(score), 2) m,
                count(*) filter (where signal = 'approved') a, count(*) filter (where score = 0.1) pf,
                count(*) filter (where rewrites > 0) rw
              from r group by 1, 2) t), '[]'),
      'features', coalesce((select jsonb_agg(jsonb_build_object('feature', feature, 'with', nw, 'mean_with', mw,
          'without', no, 'mean_without', mo, 'lift', case when mw is not null and mo is not null then round(mw - mo, 2) end)
          order by feature)
        from (select f.feature,
                count(*) filter (where f.feature = any (s.features)) nw,
                round(avg(s.score) filter (where f.feature = any (s.features)), 2) mw,
                count(*) filter (where not f.feature = any (s.features)) no,
                round(avg(s.score) filter (where not f.feature = any (s.features)), 2) mo
              from f cross join s group by f.feature) t), '[]'),
      'recent', coalesce((select jsonb_agg(jsonb_build_object('prompt_id', prompt_id, 'at', created_at, 'image_model', image_model,
          'image_type', image_type, 'score', score, 'signal', signal, 'pictures', pictures, 'rewrites', rewrites) order by created_at desc)
        from (select * from r order by created_at desc limit 20) t), '[]')
    )
  );
end $$;
revoke execute on function public.engine_learning(uuid) from public, anon;
grant execute on function public.engine_learning(uuid) to authenticated, service_role;
