-- Shoot reader: service boundary, fresh rights, paid checkpoints and lifetime limits.
reset role;
begin;
select test.act('marcus+lysne@fumecreatives.com');
insert into public.files(workspace_id, path, name, content_type, bytes, sha256, purpose, uploaded_by)
values(test.id('lysne'), test.id('lysne') || '/read-main.jpg', 'read-main.jpg', 'image/jpeg', 20, 'main-hash', 'source', auth.uid())
returning test.keep('read_file', id);
insert into public.files(workspace_id, path, name, content_type, bytes, purpose, uploaded_by)
values(test.id('lysne'), test.id('lysne') || '/read-reference.jpg', 'read-reference.jpg', 'image/jpeg', 20, 'source', auth.uid())
returning test.keep('read_ref_file', id);
set role authenticated;
select test.keep('read_shoot', (public.add_shoot(test.id('lysne'), 'Read main', null, '{"people":"none"}',
  jsonb_build_array(jsonb_build_object('fileId', test.id('read_file'), 'kind', 'photo'))) ->> 'id')::uuid);
select test.keep('read_ref_shoot', (public.add_shoot(test.id('lysne'), 'Read reference', null, '{"people":"none"}',
  jsonb_build_array(jsonb_build_object('fileId', test.id('read_ref_file'), 'kind', 'photo'))) ->> 'id')::uuid);
reset role;
select test.keep('read_picture', id) from public.shoot_pictures where shoot_id = test.id('read_shoot');
-- Isolate this campaign product's references from older fixtures.
update public.sources set product_id = null where product_id = test.id('oil') and kind = 'packshot';
insert into public.sources(workspace_id, kind, name, file_id, product_id, slot)
values(test.id('lysne'), 'packshot', 'Read reference', test.id('read_ref_file'), test.id('oil'), 'read-test');
select test.ok(exists (select 1 from jsonb_array_elements(public.shoot_read_input(test.id('read_shoot')) -> 'products') p,
  jsonb_array_elements(p -> 'pictures') r where r ->> 'path' = test.id('lysne') || '/read-reference.jpg'),
  'fresh read input includes a usable reference shoot');
select test.ok(public.shoot_read_input(test.id('read_shoot')) #>> '{pictures,0,sha256}' = 'main-hash',
  'cheap exact-hash grouping receives the stored hash');
select test.keep('read_token', (public.shoot_read_take(test.id('read_shoot')) ->> 'token')::uuid);
select test.ok(public.shoot_read_take(test.id('read_shoot')) is null, 'a live lease cannot be claimed twice');
select test.ok(not public.shoot_read_reserve(test.id('read_shoot'), gen_random_uuid()), 'wrong lease cannot reserve payment');
select test.ok(public.shoot_read_reserve(test.id('read_shoot'), test.id('read_token')), 'valid lease reserves before payment');
select test.ok((select calls = 1 and reserved_usd = 0.02 from public.shoot_read_jobs where shoot_id = test.id('read_shoot')),
  'reservation persists the call and conservative spend');
update public.shoots set people = 'unsure' where id = test.id('read_ref_shoot');
select test.ok(not exists (select 1 from jsonb_array_elements(public.shoot_read_input(test.id('read_shoot')) -> 'products') p,
  jsonb_array_elements(p -> 'pictures') r where r ->> 'path' = test.id('lysne') || '/read-reference.jpg'),
  'next input removes a reference whose rights were withdrawn mid-read');
select test.ok(jsonb_array_length(public.shoot_read_input(test.id('read_shoot')) -> 'pictures') = 1,
  'withdrawing reference rights leaves main shoot usable');

create temporary table read_checkpoint as select jsonb_build_array(jsonb_build_object('id', test.id('read_picture'),
  'read', jsonb_build_object('sort', 'pick', 'sharp', true, 'why', 'Sharp label'), 'quality', 85,
  'comparison', jsonb_build_object('ids', jsonb_build_array(), 'next', 0, 'done', false))) as entries;
select test.ok(not public.shoot_read_save(test.id('read_shoot'), gen_random_uuid(), (select entries from read_checkpoint), false),
  'wrong lease cannot checkpoint');
select test.ok(public.shoot_read_save(test.id('read_shoot'), test.id('read_token'), (select entries from read_checkpoint), false),
  'assessment can be checkpointed before comparisons');
select test.refuses($$select public.shoot_read_save(test.id('read_shoot'), test.id('read_token'),
  (select entries from read_checkpoint), true)$$, 'invalid', 'unfinished comparisons cannot finish a shoot');
select public.shoot_read_cost(test.id('read_shoot'), test.id('read_token'),
  '{"task":"shoot_assess","model":"fake-cheap","costUsd":0.00123,"inputTokens":100,"outputTokens":20}');
select test.ok(exists(select 1 from public.task_runs where input ->> 'shootId' = test.id('read_shoot')::text
  and cost_usd = 0.0013), 'paid usage joins the shared budget and rounds upward');
-- Rights can tighten after payment: usage still counts, but publication and new calls stop.
update public.shoots set people = 'unsure' where id = test.id('read_shoot');
select test.refuses($$select public.shoot_read_save(test.id('read_shoot'), test.id('read_token'),
  (select entries from read_checkpoint), false)$$, 'invalid', 'checkpoint rechecks main shoot rights');
select test.refuses($$select public.shoot_read_reserve(test.id('read_shoot'), test.id('read_token'))$$,
  'invalid', 'new payment rechecks main shoot rights');
select public.shoot_read_cost(test.id('read_shoot'), gen_random_uuid(),
  '{"task":"shoot_group","model":"fake-cheap","costUsd":0.005}', 'Late paid failure');
select test.ok(exists(select 1 from public.task_runs where input ->> 'shootId' = test.id('read_shoot')::text
  and state = 'failed' and error = 'Late paid failure' and cost_usd = 0.005),
  'usage survives withdrawn rights and an old lease token');
update public.shoots set people = 'none' where id = test.id('read_shoot');
select public.shoot_read_release(test.id('read_shoot'), gen_random_uuid());
select test.ok(public.shoot_read_take(test.id('read_shoot')) is null, 'wrong token cannot release a lease');
select public.shoot_read_release(test.id('read_shoot'), test.id('read_token'));
select test.ok(public.shoot_read_take(test.id('read_shoot')) -> 'entries' = (select entries from read_checkpoint),
  'next lease resumes the paid assessment and comparison position');
select test.keep('read_token', token) from public.shoot_read_jobs where shoot_id = test.id('read_shoot');
select test.ok((select calls = 1 and reserved_usd = 0.02 from public.shoot_read_jobs where shoot_id = test.id('read_shoot')),
  'a new lease does not reset lifetime cost');
select test.ok(not public.shoot_read_stop(test.id('read_shoot'), test.id('read_token'), (select entries from read_checkpoint)),
  'partial completion requires an exhausted shoot limit');
update public.shoot_read_jobs set calls = 200 where shoot_id = test.id('read_shoot');
select test.ok(not public.shoot_read_reserve(test.id('read_shoot'), test.id('read_token')), 'call cap refuses payment');
update public.shoot_read_jobs set calls = 1, reserved_usd = 2 where shoot_id = test.id('read_shoot');
select test.ok(not public.shoot_read_reserve(test.id('read_shoot'), test.id('read_token')), 'spend cap independently refuses payment');
select test.ok(public.shoot_read_stop(test.id('read_shoot'), test.id('read_token'), (select entries from read_checkpoint)),
  'budget stop publishes the paid assessment without repeating it');
select test.ok((select status = 'partly_read' and calls = 1 and reserved_usd = 2 from public.shoot_read_jobs
  where shoot_id = test.id('read_shoot')), 'partly read state preserves lifetime limits');
select test.ok((select engine_read ->> 'sort' = 'pick' and engine_read ->> 'why' like 'Partly read:%'
  from public.shoot_pictures where id = test.id('read_picture')), 'partial read keeps assessment and marks unfinished grouping');
select test.ok(public.shoot_read_take(test.id('read_shoot')) is null, 'partial completion stops automatic paid retries');

-- Unassessed originals receive an explicit expert fallback; normal completion remains available.
select test.ok(public.shoot_read_input(test.id('read_ref_shoot')) -> 'pictures' = '[]'::jsonb,
  'blocked main shoot exposes no pictures');
select test.refuses($$select public.shoot_read_take(test.id('read_ref_shoot'))$$, 'invalid', 'blocked rights prevent taking work');
update public.shoots set people = 'none' where id = test.id('read_ref_shoot');
select test.keep('read_ref_token', (public.shoot_read_take(test.id('read_ref_shoot')) ->> 'token')::uuid);
update public.shoot_read_jobs set reserved_usd = 2 where shoot_id = test.id('read_ref_shoot');
select test.ok(public.shoot_read_stop(test.id('read_ref_shoot'), test.id('read_ref_token'), '[]'),
  'an unassessed original is retained when the limit is reached');
select test.ok((select engine_read ->> 'sort' = 'rest' and engine_read ->> 'why' like 'Partly read:%'
  from public.shoot_pictures where shoot_id = test.id('read_ref_shoot')), 'unassessed photograph waits for an expert');

-- A fresh reader finishes ordinary work, but an expired lease cannot pay or save.
update public.shoots set state = 'reading' where id = test.id('read_ref_shoot');
update public.shoot_read_jobs set status = 'reading', calls = 0, reserved_usd = 0, leased_until = now() - interval '1 second'
where shoot_id = test.id('read_ref_shoot');
select test.ok(not public.shoot_read_reserve(test.id('read_ref_shoot'), test.id('read_ref_token')),
  'expired lease cannot reserve payment');
select test.ok(not public.shoot_read_save(test.id('read_ref_shoot'), test.id('read_ref_token'), '[]', false),
  'expired lease cannot checkpoint');
select test.keep('read_ref_token', (public.shoot_read_take(test.id('read_ref_shoot')) ->> 'token')::uuid);
select test.ok(public.shoot_read_save(test.id('read_ref_shoot'), test.id('read_ref_token'),
  (select entries from public.shoot_read_jobs where shoot_id = test.id('read_ref_shoot')), true),
  'completed entries can finish a normal read');
select test.ok((select status = 'read' from public.shoot_read_jobs where shoot_id = test.id('read_ref_shoot')),
  'ordinary completion keeps the lifetime job record');

select test.ok(not has_table_privilege('authenticated', 'public.shoot_read_jobs', 'select')
  and not has_table_privilege('service_role', 'public.shoot_read_jobs', 'select'), 'private checkpoints have no direct table grants');
create function pg_temp.check_read_grants() returns void language plpgsql as $$
declare signature text;
begin
  foreach signature in array array['shoot_read_input(uuid)', 'shoot_read_take(uuid)', 'shoot_read_cost(uuid,uuid,jsonb,text)',
    'shoot_read_save(uuid,uuid,jsonb,boolean)', 'shoot_read_release(uuid,uuid)', 'shoot_read_reserve(uuid,uuid)', 'shoot_read_stop(uuid,uuid,jsonb)'] loop
    perform test.ok(has_function_privilege('service_role', 'public.' || signature, 'execute')
      and not has_function_privilege('anon', 'public.' || signature, 'execute')
      and not has_function_privilege('authenticated', 'public.' || signature, 'execute'), signature || ' is service only');
    perform test.ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc
      where oid = ('public.' || signature)::regprocedure), signature || ' has a fixed empty search path');
  end loop;
end $$;
select pg_temp.check_read_grants();
rollback;
set role authenticated;
