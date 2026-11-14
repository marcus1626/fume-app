-- A crop redo applies to own_area too; the old room-only RPC and all its limits stay in place.
\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;
select test.ok(not has_function_privilege('anon', 'public.engine_again(uuid, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.engine_again(uuid, text)', 'execute')
  and has_function_privilege('service_role', 'public.engine_again(uuid, text)', 'execute'),
  'the unchanged again signature remains service-only');

begin;
-- The completed job and newest attempt are kept by 9p_engine.sql and 9zs_engine_room_again.sql.
update public.creatives set words = 'own_area' where id = test.id('em');
savepoint own_area;
select test.ok(not public.engine_again(test.id('ra'), 'The sled fills the words room.'),
  'own_area still blocks a room-only redo through the old signature');
select test.ok(public.engine_again(test.id('ra'), 'product-completeness: Show the whole product with clear space at every frame edge.'),
  'a Studio own_area override permits a crop redo');
select test.ok((select state = 'queued' from public.production_jobs where id = test.id('ej'))
  and public.engine_again_note(test.id('ej')) = 'product-completeness: Show the whole product with clear space at every frame edge.',
  'the job is queued and its crop lesson is kept for the next prompt');
update public.production_jobs set state = 'succeeded' where id = test.id('ej');
select test.ok(not public.engine_again(test.id('ra'), 'product-completeness: Again.'),
  'crop redos retain the once-per-job limit');
rollback to own_area;

-- With no Studio override, the frozen planned creative can also have words in their own area.
update public.creatives set words = null where id = test.id('em');
update public.plan_versions pv set body = jsonb_set(pv.body, '{planned_creatives}', (
  select jsonb_agg(case when pc ->> 'id' = cr.slot then pc || '{"words":"own_area"}'::jsonb else pc end)
  from jsonb_array_elements(pv.body -> 'planned_creatives') pc))
from public.production_jobs j join public.context_snapshots s on s.id = j.snapshot_id
join public.creatives cr on cr.id = j.creative_id
where j.id = test.id('ej') and pv.id = s.plan_version_id;
select test.ok(not public.engine_again(test.id('ra'), 'The sled fills the words room.'),
  'frozen-plan own_area still blocks room-only redos');
select test.ok(public.engine_again(test.id('ra'), 'product-completeness: Show the whole product.'),
  'frozen-plan own_area permits a crop redo');
rollback;
set role authenticated;
select test.ok(true, 'all of the crop again tests passed');
