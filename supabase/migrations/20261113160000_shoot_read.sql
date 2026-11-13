-- FLOWS §38: resumable vision assessment. Originals and expert moves are never overwritten.
-- Private checkpoints must not leak through authenticated SELECT on shoots.
create table public.shoot_read_jobs (
  shoot_id uuid primary key references public.shoots(id) on delete cascade,
  token uuid,
  leased_until timestamptz,
  entries jsonb not null default '[]',
  status text not null default 'reading' check (status in ('reading', 'read', 'partly_read')),
  calls int not null default 0 check (calls between 0 and 200),
  reserved_usd numeric not null default 0 check (reserved_usd between 0 and 2)
);
alter table public.shoot_read_jobs enable row level security;
revoke all on public.shoot_read_jobs from public, anon, authenticated, service_role;

-- Assessment now obeys the same rights boundary as production. A blocked shoot exposes no originals to this reader.
create or replace function public.shoot_read_input(p_shoot_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.shoots; book jsonb;
begin
  select * into s from public.shoots where id = p_shoot_id;
  if not found then return null; end if;
  if s.people = 'unsure' or (s.people = 'released' and not s.consent_yes) or s.usable_until < current_date then
    return jsonb_build_object('id', s.id, 'workspaceId', s.workspace_id, 'state', s.state,
      'rights', jsonb_build_object('photographer', s.photographer, 'people', s.people, 'consentYes', s.consent_yes, 'until', s.usable_until),
      'pictures', '[]'::jsonb, 'products', '[]'::jsonb);
  end if;
  book := app.brand_book_in_use(s.workspace_id, 'look');
  return jsonb_build_object('id', s.id, 'workspaceId', s.workspace_id, 'state', s.state,
    'rights', jsonb_build_object('photographer', s.photographer, 'people', s.people, 'consentYes', s.consent_yes, 'until', s.usable_until),
    'look', (book -> 'body') - 'sources' - 'gaps' - 'parts' - 'evidence',
    'pictures', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'number', p.number, 'kind', p.kind,
      'bucket', f.bucket, 'path', f.path, 'contentType', f.content_type, 'sha256', f.sha256) order by p.number)
      from public.shoot_pictures p join public.files f on f.id = p.file_id where p.shoot_id = s.id), '[]'),
    -- A shoot has no campaign_id in the contract. Read this brand's campaign products; retain their campaign ids.
    'products', coalesce((select jsonb_agg(jsonb_build_object('id', pr.id, 'name', pr.name,
      'campaignIds', (select jsonb_agg(cp.campaign_id) from public.campaign_products cp
        join public.campaigns c on c.id = cp.campaign_id where cp.product_id = pr.id and c.workspace_id = s.workspace_id),
      'facts', coalesce((select jsonb_agg(jsonb_build_object('area', f.area, 'statement', f.statement, 'status', f.status))
        from public.product_facts f where f.product_id = pr.id and f.superseded_by is null), '[]'),
      'pictures', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('bucket', x.bucket, 'path', x.path, 'url', x.url))) from (
        select fi.bucket, fi.path, case when fi.id is null then so.url end as url
        from public.sources so left join public.files fi on fi.id = so.file_id
        where so.product_id = pr.id and so.workspace_id = s.workspace_id and so.kind = 'packshot'
          and ((fi.workspace_id = s.workspace_id and fi.content_type in ('image/jpeg','image/png','image/webp','image/gif'))
            or (fi.id is null and so.url like 'https://%'))
          and not exists (select 1 from public.shoot_pictures sp join public.shoots sh on sh.id = sp.shoot_id
            where sp.file_id = fi.id and (sh.people = 'unsure' or (sh.people = 'released' and not sh.consent_yes)
              or sh.usable_until < current_date))
        order by so.created_at desc limit 2) x), '[]')) order by pr.name)
      from public.products pr where pr.workspace_id = s.workspace_id and exists (
        select 1 from public.campaign_products cp join public.campaigns c on c.id = cp.campaign_id
        where cp.product_id = pr.id and c.workspace_id = s.workspace_id)), '[]'));
end $$;

create function public.shoot_read_take(p_shoot_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.shoots; j public.shoot_read_jobs;
begin
  select * into s from public.shoots where id = p_shoot_id for update;
  if not found or s.state <> 'reading' then return null; end if;
  perform app.require_shoot_use(s.id);
  if not (public.fume_llm_budget() ->> 'allowed')::boolean then return null; end if;
  insert into public.shoot_read_jobs(shoot_id) values(s.id) on conflict do nothing;
  select * into j from public.shoot_read_jobs where shoot_id = s.id for update;
  if j.leased_until > now() or j.status <> 'reading' then return null; end if;
  update public.shoot_read_jobs set token = gen_random_uuid(), leased_until = now() + interval '3 minutes'
    where shoot_id = s.id returning * into j;
  return jsonb_build_object('token', j.token, 'entries', j.entries);
end $$;

-- Keep every incurred call, even if rights changed or the lease expired while the model answered.
-- task_runs is already counted by fume_llm_budget; do not fork or replace the shared budget function.
create function public.shoot_read_cost(p_shoot_id uuid, p_token uuid, p_call jsonb, p_error text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare ws uuid;
begin
  select workspace_id into ws from public.shoots where id = p_shoot_id;
  if ws is null then return; end if;
  insert into public.task_runs(workspace_id, kind, subject_id, attempt, state, model, input, output, error,
    input_tokens, output_tokens, cost_usd, finished_at)
  values(ws, 'facts', gen_random_uuid(), 1, case when p_error is null then 'succeeded' else 'failed' end,
    p_call ->> 'model', jsonb_build_object('task', p_call ->> 'task', 'shootId', p_shoot_id, 'lease', p_token), '{}', p_error,
    coalesce((p_call ->> 'inputTokens')::int, 0), coalesce((p_call ->> 'outputTokens')::int, 0),
    ceil(greatest(coalesce((p_call ->> 'costUsd')::numeric, 0), 0) * 10000) / 10000, now());
  update public.shoot_read_jobs set leased_until = now() + interval '3 minutes'
    where shoot_id = p_shoot_id and token = p_token;
end $$;

create function public.shoot_read_save(p_shoot_id uuid, p_token uuid, p_entries jsonb, p_done boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare s public.shoots; e jsonb; r jsonb;
begin
  select * into s from public.shoots where id = p_shoot_id for update;
  if not found or s.state <> 'reading' then return false; end if;
  perform app.require_shoot_use(s.id);
  perform 1 from public.shoot_read_jobs where shoot_id = s.id and token = p_token and leased_until > now() for update;
  if not found then return false; end if;
  if jsonb_typeof(p_entries) is distinct from 'array' then perform app.fail('invalid', 'Expected picture reads.'); end if;
  if (select count(*) from jsonb_array_elements(p_entries)) <>
     (select count(distinct x ->> 'id') from jsonb_array_elements(p_entries) x) then
    perform app.fail('invalid', 'Each picture needs one read.');
  end if;
  for e in select value from jsonb_array_elements(p_entries) loop
    r := e -> 'read';
    if not exists (select 1 from public.shoot_pictures where shoot_id = s.id and id = (e ->> 'id')::uuid)
      or jsonb_typeof(r) is distinct from 'object' or coalesce(r ->> 'sort', '') not in ('pick','rest','out')
      or jsonb_typeof(r -> 'sharp') is distinct from 'boolean' or coalesce(length(btrim(r ->> 'why')), 0) not between 1 and 1000
      or (r ? 'look' and (jsonb_typeof(r -> 'look') <> 'number' or (r ->> 'look')::numeric not between 0 and 100))
      or (r ? 'productId' and not exists (select 1 from public.products where id = (r ->> 'productId')::uuid and workspace_id = s.workspace_id))
      or (r ->> 'sort' = 'pick' and exists (select 1 from public.shoot_pictures where id = (e ->> 'id')::uuid and kind = 'clip')) then
      perform app.fail('invalid', 'Invalid picture read.');
    end if;
    if r ? 'like' and (r ->> 'sort' <> 'out' or not exists (
      select 1 from jsonb_array_elements(p_entries) winner join public.shoot_pictures p on p.id = (winner ->> 'id')::uuid
      where p.shoot_id = s.id and p.kind = 'photo' and winner ->> 'id' = r ->> 'like'
        and winner ->> 'id' <> e ->> 'id' and not (winner -> 'read' ? 'like'))) then
      perform app.fail('invalid', 'A near copy must name its group representative.');
    end if;
  end loop;
  update public.shoot_read_jobs set entries = p_entries, leased_until = now() + interval '3 minutes' where shoot_id = s.id;
  if p_done then
    if exists (select 1 from jsonb_array_elements(p_entries) x
      where x ? 'comparison' and not coalesce((x #>> '{comparison,done}')::boolean, false)) then
      perform app.fail('invalid', 'Finish comparisons before completing the shoot.');
    end if;
    if jsonb_array_length(p_entries) <> (select count(*) from public.shoot_pictures where shoot_id = s.id) then
      perform app.fail('invalid', 'Read every picture first.');
    end if;
    update public.shoot_pictures p set engine_read = x -> 'read' from jsonb_array_elements(p_entries) x
      where p.shoot_id = s.id and p.id = (x ->> 'id')::uuid;
    update public.shoots set state = 'read' where id = s.id;
    update public.shoot_read_jobs set status = 'read' where shoot_id = s.id;
    perform app.record(s.workspace_id, 'shoot.read', 'shoot', s.id);
  end if;
  return true;
end $$;

-- Reserve a conservative upper bound BEFORE payment, atomically under the lease.
-- 9 previews at <=1024px, <=40K context characters and <=2500 output tokens on the
-- fixed cheap model cost less than $0.02. Reservations are never refunded, even on
-- provider failure/timeout: restarts cannot evade either lifetime shoot limit.
create function public.shoot_read_reserve(p_shoot_id uuid, p_token uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_shoot_use(p_shoot_id);
  update public.shoot_read_jobs set calls = calls + 1, reserved_usd = reserved_usd + 0.02
    where shoot_id = p_shoot_id and token = p_token and leased_until > now()
      and status = 'reading' and calls < 200 and reserved_usd + 0.02 <= 2;
  return found;
end $$;

-- A bounded read is reviewable: keep assessed work, leave all remaining originals
-- explicitly for an expert, and stop automatic polling. No contract state is added:
-- 'read' means every picture has a place; the private job records 'partly_read'.
create function public.shoot_read_stop(p_shoot_id uuid, p_token uuid, p_entries jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare all_entries jsonb;
begin
  -- Match take/save lock ordering (shoot, then job).
  perform 1 from public.shoots where id = p_shoot_id for update;
  perform 1 from public.shoot_read_jobs where shoot_id = p_shoot_id and token = p_token
    and leased_until > now() and status = 'reading' and (calls >= 200 or reserved_usd + 0.02 > 2) for update;
  if not found then return false; end if;
  select jsonb_agg(case when x.value is null then jsonb_build_object('id', p.id, 'quality', 0,
      'read', jsonb_build_object('sort', 'rest', 'sharp', false,
        'why', 'Partly read: the shoot reached its reading limit. Kept for an expert.'))
    when x.value ? 'comparison' and not coalesce((x.value #>> '{comparison,done}')::boolean, false) then
      jsonb_set(jsonb_set(x.value, '{comparison,done}', 'true'), '{read,why}',
        to_jsonb(left('Partly read: near-copy checks stopped at the reading limit. ' || (x.value #>> '{read,why}'), 1000)))
    else x.value end order by p.number) into all_entries
  from public.shoot_pictures p left join jsonb_array_elements(p_entries) x on x.value ->> 'id' = p.id::text
  where p.shoot_id = p_shoot_id;
  if not public.shoot_read_save(p_shoot_id, p_token, coalesce(all_entries, '[]'), true) then return false; end if;
  update public.shoot_read_jobs set status = 'partly_read' where shoot_id = p_shoot_id;
  return true;
end $$;

create function public.shoot_read_release(p_shoot_id uuid, p_token uuid) returns void
language sql security definer set search_path = '' as $$
  update public.shoot_read_jobs set token = null, leased_until = null where shoot_id = p_shoot_id and token = p_token
$$;
revoke all on function public.shoot_read_take(uuid), public.shoot_read_cost(uuid,uuid,jsonb,text),
  public.shoot_read_save(uuid,uuid,jsonb,boolean), public.shoot_read_release(uuid,uuid), public.shoot_read_reserve(uuid,uuid), public.shoot_read_stop(uuid,uuid,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.shoot_read_take(uuid), public.shoot_read_cost(uuid,uuid,jsonb,text),
  public.shoot_read_save(uuid,uuid,jsonb,boolean), public.shoot_read_release(uuid,uuid), public.shoot_read_reserve(uuid,uuid), public.shoot_read_stop(uuid,uuid,jsonb) to service_role;
-- CREATE OR REPLACE preserves shoot_read_input's existing service_role-only grant.
