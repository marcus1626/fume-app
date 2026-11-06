-- Product Truth from the product's own page and pictures (docs/mvp/product-truth.md). Fume reads them and proposes
-- facts: how the product looks (shape, colour, material, label, packaging) from its pictures, and what its page says
-- (claims, word for word). Every proposal is unverified until the brand's owner or approver confirms it
-- (verify_fact, verify_product); the Engine only writes verified facts into a prompt. Each reading is a run, counted
-- in the language model's week.

alter table public.task_runs drop constraint if exists task_runs_kind_check;
alter table public.task_runs add constraint task_runs_kind_check check (kind in ('plan', 'brief', 'chat', 'facts'));

-- Someone on the brand asks Fume to read a product (the caller's own rights; the writer takes it as the service).
create or replace function public.ask_product_truth(p_product_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.products;
begin
  perform app.require_user();
  select * into p from public.products where id = p_product_id;
  if not found or not app.can_read(p.workspace_id) then perform app.fail('not_found', 'No such product.'); end if;
  if not app.product_writer(p.workspace_id) then
    perform app.fail('forbidden', 'Only the people on the brand ask Fume to read its products.');
  end if;
  return jsonb_build_object('product_id', p.id, 'reading', exists (
    select 1 from public.task_runs where kind = 'facts' and subject_id = p.id and state = 'running'
      and started_at > now() - interval '4 minutes'));
end $$;
revoke execute on function public.ask_product_truth(uuid) from public, anon;
grant execute on function public.ask_product_truth(uuid) to authenticated;

-- What the reader gets: the product, its page, its pictures and the facts it already has. Null while one is reading.
create or replace function public.product_truth_take(p_product_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.products;
  w public.workspaces;
  run public.task_runs;
  input jsonb;
begin
  select * into p from public.products where id = p_product_id for update;
  if not found then return null; end if;
  if exists (select 1 from public.task_runs where kind = 'facts' and subject_id = p.id and state = 'running'
             and started_at > now() - interval '4 minutes') then
    return null;
  end if;
  update public.task_runs set state = 'failed', error = 'Timed out', finished_at = now()
  where kind = 'facts' and subject_id = p.id and state = 'running';
  if not (public.fume_llm_budget() ->> 'allowed')::boolean then
    perform app.fail('budget', 'This week''s budget for Fume''s language model is used up.');
  end if;
  select * into w from public.workspaces where id = p.workspace_id;
  input := jsonb_build_object(
    'product', jsonb_build_object('id', p.id, 'name', p.name, 'variant', nullif(p.variant, ''), 'sku', p.sku,
      'kind', p.kind_id, 'specs', p.specs),
    'brand', jsonb_build_object('name', w.brand_name, 'market', w.market, 'language', w.language),
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object('source_id', s.id, 'url', s.url) order by s.created_at desc)
      from public.sources s where s.product_id = p.id and s.kind = 'website' and s.url like 'http%'), '[]'),
    'pictures', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('source_id', x.id, 'slot', x.slot, 'bucket', x.bucket,
        'path', x.path, 'url', x.url, 'name', x.name)))
      from (
        select so.id, so.slot, fi.bucket, fi.path, case when fi.id is null then so.url end as url, coalesce(fi.name, so.name) as name
        from public.sources so left join public.files fi on fi.id = so.file_id
        where so.product_id = p.id and so.kind = 'packshot'
          and (fi.content_type like 'image/%' or (fi.id is null and so.url like 'https://%'))
        order by so.created_at desc limit 4
      ) x), '[]'),
    'facts', coalesce((
      select jsonb_agg(jsonb_build_object('area', f.area, 'label', f.label, 'statement', f.statement, 'status', f.status))
      from public.product_facts f where f.product_id = p.id and f.superseded_by is null), '[]')
  );
  insert into public.task_runs (workspace_id, kind, subject_id, attempt, input)
  values (p.workspace_id, 'facts', p.id,
    (select coalesce(max(attempt), 0) + 1 from public.task_runs where kind = 'facts' and subject_id = p.id), input)
  returning * into run;
  return input || jsonb_build_object('run_id', run.id);
end $$;

-- The reading, checked: known areas, words in each, a claim only with words from a page, nothing the product already
-- has. Proposals are unverified and inferred; what a picture must get right is required, so production waits on her.
create or replace function public.product_truth_finish(p_run_id uuid, p_facts jsonb, p_output jsonb, p_usage jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  run public.task_runs;
  f jsonb;
  added int := 0;
  src uuid;
begin
  select * into run from public.task_runs where id = p_run_id and kind = 'facts' for update;
  if not found or run.state <> 'running' then perform app.fail('conflict', 'This product is no longer being read.'); end if;
  if jsonb_typeof(p_facts) is distinct from 'array' then perform app.fail('invalid', 'The reading is a list of facts.'); end if;
  for f in select * from jsonb_array_elements(p_facts) limit 24 loop
    continue when coalesce(f ->> 'area', '') not in ('shape', 'colour', 'material', 'label', 'packaging', 'claim', 'never')
      or nullif(trim(coalesce(f ->> 'label', '')), '') is null or nullif(trim(coalesce(f ->> 'statement', '')), '') is null
      or (f ->> 'area' = 'claim' and nullif(f ->> 'source_id', '') is null);
    continue when exists (select 1 from public.product_facts x where x.product_id = run.subject_id and x.superseded_by is null
      and x.area = f ->> 'area' and lower(trim(x.statement)) = lower(trim(f ->> 'statement')));
    src := (select s.id from public.sources s where s.id::text = f ->> 'source_id' and s.product_id = run.subject_id);
    insert into public.product_facts (workspace_id, product_id, area, label, statement, origin, status, required,
      source_id, source_location)
    values (run.workspace_id, run.subject_id, f ->> 'area', left(trim(f ->> 'label'), 120), left(trim(f ->> 'statement'), 500),
      'inferred', 'unverified', f ->> 'area' in ('shape', 'colour', 'label', 'packaging'), src, left(f ->> 'where', 300));
    added := added + 1;
  end loop;
  update public.task_runs set state = 'succeeded', output = coalesce(p_output, '{}') || jsonb_build_object('facts', p_facts, 'added', added),
    finished_at = now(), model = p_usage ->> 'model',
    input_tokens = coalesce((p_usage ->> 'input_tokens')::int, 0), output_tokens = coalesce((p_usage ->> 'output_tokens')::int, 0),
    cost_usd = coalesce((p_usage ->> 'cost_usd')::numeric, 0)
  where id = run.id;
  if added > 0 then
    perform app.record(run.workspace_id, 'facts.proposed', 'product', run.subject_id, jsonb_build_object('facts', added));
  end if;
  return jsonb_build_object('added', added);
end $$;

create or replace function public.product_truth_fail(p_run_id uuid, p_error text, p_usage jsonb default '{}') returns void
language sql security definer set search_path = '' as $$
  update public.task_runs set state = 'failed', error = left(p_error, 2000), finished_at = now(),
    model = coalesce(p_usage ->> 'model', model),
    input_tokens = coalesce((p_usage ->> 'input_tokens')::int, 0), output_tokens = coalesce((p_usage ->> 'output_tokens')::int, 0),
    cost_usd = coalesce((p_usage ->> 'cost_usd')::numeric, 0)
  where id = p_run_id and kind = 'facts' and state = 'running'
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.product_truth_take(uuid)', 'public.product_truth_finish(uuid, jsonb, jsonb, jsonb)', 'public.product_truth_fail(uuid, text, jsonb)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
