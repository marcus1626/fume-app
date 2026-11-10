-- The picture check reads the product's small print (docs/mvp/detail-read.md): after the Engine looks at a picture, the
-- edge function `details` finds where the product shows printed letters, a wordmark or a logo, crops each close, and
-- reads it against the product's own photographs. A label that reads wrong flags the picture's product truth, with a
-- note and the place, so the designer can fix it with the real product. It helps the expert; it never checks a picture
-- in their place. Candidates stay staff-only.

alter table public.candidates
  add column details jsonb,
  add column details_usd numeric(10, 6) not null default 0 check (details_usd >= 0),
  add column details_at timestamptz;

comment on column public.candidates.details is
  'The product''s small print as read on the picture: [{"n", "what", "box": {x,y,w,h}, "reads", "expected", "ok", "note"}].';

-- What the function needs: the picture (under the words, when designed), the product's own photographs (print first),
-- and where to keep the crops. Null when there is nothing to read against, or a read started in the last 4 minutes.
create or replace function public.details_take(p_candidate_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c public.candidates;
  pic public.candidates;
  f public.files;
  j public.production_jobs;
  w public.workspaces;
  products jsonb;
begin
  select * into c from public.candidates where id = p_candidate_id for update;
  if not found then return null; end if;
  if c.details_at is not null and c.details is null and c.details_at > now() - interval '4 minutes' then return null; end if;
  if not (public.fume_llm_budget() ->> 'allowed')::boolean then return null; end if;
  select * into pic from public.candidates where id = coalesce(c.designed_from, c.id);
  select * into f from public.files where id = pic.file_id;
  select * into j from public.production_jobs where id = c.job_id;
  select * into w from public.workspaces where id = c.workspace_id;
  select coalesce(jsonb_agg(p order by p ->> 'name'), '[]') into products from (
    select jsonb_build_object('name', pr.name, 'variant', nullif(pr.variant, ''),
      'pictures', coalesce((
        select jsonb_agg(jsonb_build_object('bucket', y.bucket, 'path', y.path))
        from (
          select fi.bucket, fi.path from public.sources so join public.files fi on fi.id = so.file_id
          where so.product_id = pr.id and so.kind = 'packshot' and fi.content_type like 'image/%'
          order by case so.slot when 'detail' then 0 when 'front' then 1 when 'back' then 2 else 3 end, so.created_at desc limit 3
        ) y), '[]')) as p
    from public.campaign_products cp join public.products pr on pr.id = cp.product_id
    where cp.campaign_id = j.campaign_id
  ) q where jsonb_array_length(p -> 'pictures') > 0;
  if f.id is null or jsonb_array_length(products) = 0 then return null; end if;
  update public.candidates set details_at = now(), details = null where id = c.id;
  return jsonb_build_object(
    'candidate_id', c.id, 'workspace_id', c.workspace_id,
    'brand', jsonb_build_object('name', w.brand_name, 'language', w.language),
    'picture', jsonb_build_object('bucket', f.bucket, 'path', f.path, 'width', f.width, 'height', f.height),
    'products', products,
    'store', jsonb_build_object('bucket', 'workspace-files', 'prefix', c.workspace_id || '/check/' || c.id));
end $$;

-- What was read. A detail that reads wrong flags the evaluation's product truth and adds its note; the cost counts in
-- the language model's week.
create or replace function public.details_finish(p_candidate_id uuid, p_details jsonb, p_llm_usd numeric) returns void
language plpgsql security definer set search_path = '' as $$
declare
  wrong jsonb;
begin
  if jsonb_typeof(coalesce(p_details, '[]')) <> 'array' then perform app.fail('invalid', 'The details are a list.'); end if;
  select coalesce(jsonb_agg(d ->> 'note'), '[]') into wrong
  from jsonb_array_elements(coalesce(p_details, '[]')) d
  where (d ->> 'ok')::boolean is false and coalesce(d ->> 'note', '') <> '';
  update public.candidates set
    details = coalesce(p_details, '[]'),
    details_usd = details_usd + greatest(coalesce(p_llm_usd, 0), 0),
    evaluation = case
      when evaluation is null or jsonb_array_length(wrong) = 0 then evaluation
      else evaluation || jsonb_build_object('productTruth', 'flag',
        'notes', coalesce(evaluation -> 'notes', '[]') || wrong)
    end
  where id = p_candidate_id;
end $$;

revoke execute on function public.details_take(uuid) from public, anon, authenticated;
revoke execute on function public.details_finish(uuid, jsonb, numeric) from public, anon, authenticated;
grant execute on function public.details_take(uuid), public.details_finish(uuid, jsonb, numeric) to service_role;

create or replace function public.fume_llm_budget() returns jsonb
language sql stable security definer set search_path = '' as $$
  with spent as (
    select (
      coalesce((select sum(cost_usd) from public.task_runs where started_at > now() - interval '7 days'), 0)
      + coalesce((select sum(llm_usd) from public.engine_prompts where created_at > now() - interval '7 days'), 0)
      + coalesce((select sum(llm_usd) from public.engine_lessons where updated_at > now() - interval '7 days'), 0)
      + coalesce((select coalesce(sum(evaluation_usd), 0) + coalesce(sum(details_usd), 0) from public.candidates where created_at > now() - interval '7 days'), 0)
      + coalesce((select sum(llm_usd) from public.brand_books where created_at > now() - interval '7 days'), 0)
      + coalesce((select sum(llm_usd) from public.design_layers where created_at > now() - interval '7 days'), 0)
      + coalesce((select sum(llm_usd) from public.picture_fixes where created_at > now() - interval '7 days'), 0)
    )::numeric as usd
  ), cap as (
    select coalesce((select (value #>> '{}')::numeric from app.settings where key = 'llm_week_usd'), 0) as usd
  )
  select jsonb_build_object('spent_usd', spent.usd, 'cap_usd', cap.usd, 'allowed', spent.usd < cap.usd) from spent, cap
$$;

-- The crops are staff-only reads, like a fix's parts: <ws>/check/<candidate>-<n>.png and -<n>-ref.png.
create or replace function app.can_read_object(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.files f where f.path = p_name and app.can_read_file(f.id))
    or (p_name ~ '^[0-9a-f-]{36}/fix/[0-9a-f-]{36}-(crop|ref|redrawn)\.png$' and exists (
      select 1 from public.picture_fixes x
      where x.workspace_id::text = split_part(p_name, '/', 1)
        and x.id::text = substring(split_part(p_name, '/', 3) from 1 for 36)
        and app.is_staff(x.workspace_id)))
    or (p_name ~ '^[0-9a-f-]{36}/check/[0-9a-f-]{36}-[0-9]+(-ref)?\.png$' and exists (
      select 1 from public.candidates c
      where c.workspace_id::text = split_part(p_name, '/', 1)
        and c.id::text = substring(split_part(p_name, '/', 3) from 1 for 36)
        and app.is_staff(c.workspace_id)))
$$;
