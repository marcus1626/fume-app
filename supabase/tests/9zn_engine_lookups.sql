-- What the Engine's edge functions look up beside their task (20261109150000_engine_lookups.sql).

\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;

select test.ok(not has_function_privilege('authenticated', 'public.fume_plan_extras(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.design_layout_before(uuid)', 'execute')
  and has_function_privilege('service_role', 'public.fume_plan_extras(uuid)', 'execute')
  and has_function_privilege('service_role', 'public.design_layout_before(uuid)', 'execute'),
  'only the Engine''s functions read these');

-- The plan writer reads the layouts of the brand's design system in use.
insert into public.brand_books (workspace_id, kind, version, state, body)
values (test.id('lysne'), 'design', 23, 'approved',
  '{"summary":"Calm","onPictures":{"layouts":[{"name":"Narrow stack","wordsWidthPct":25,"hasWords":true}]}}');
select test.ok((select x -> 'layouts' -> 0 ->> 'name' = 'Narrow stack' and jsonb_typeof(x -> 'recent') = 'array'
  from (select public.fume_plan_extras(test.id('campaign')) x) y), 'the plan writer gets the brand''s column of words');
select test.ok(public.fume_plan_extras(gen_random_uuid()) is null, 'and nothing for a campaign that is not there');

-- A picture designed again keeps the layout of its first design; a designer's ask sets it anew.
insert into public.design_layers (workspace_id, candidate_id, job_id, creative_id, requested_by, ask, state, choice, created_at, finished_at)
select workspace_id, candidate_id, job_id, creative_id, requested_by, null, 'made', jsonb_build_object('layout', 'First ' || n, 'band', 'bottom'),
  now() - interval '1 hour' + n * interval '1 minute', now()
from public.design_layers, generate_series(1, 2) n where id = test.id('dl');
insert into public.design_layers (workspace_id, candidate_id, job_id, creative_id, requested_by, ask)
select workspace_id, candidate_id, job_id, creative_id, requested_by, null from public.design_layers where id = test.id('dl');
select test.keep('dlnew', (select id from public.design_layers where candidate_id = (select candidate_id from public.design_layers where id = test.id('dl'))
  and state = 'designing' order by created_at desc limit 1));
select test.ok((select public.design_layout_before(test.id('dlnew')) ->> 'layout') like 'First%'
    and (select public.design_layout_before(test.id('dlnew')) ->> 'layout') = (select choice ->> 'layout' from public.design_layers
      where candidate_id = (select candidate_id from public.design_layers where id = test.id('dl')) and state = 'made'
        and choice is not null order by created_at limit 1),
  'a picture designed again keeps the layout of its first design');
-- The design that went into a creative is the one people saw: it is kept before the first.
update public.design_layers set result_candidate_id = (select candidate_id from public.creative_versions where candidate_id is not null limit 1)
where candidate_id = (select candidate_id from public.design_layers where id = test.id('dl')) and choice ->> 'layout' = 'First 2';
select test.ok(public.design_layout_before(test.id('dlnew')) ->> 'layout' = 'First 2', 'the design in a creative is kept before the first');
insert into public.design_layers (workspace_id, candidate_id, job_id, creative_id, requested_by, ask, state, choice, created_at, finished_at)
select workspace_id, candidate_id, job_id, creative_id, requested_by, 'Words on the right', 'made', '{"layout":"Asked"}', now() - interval '5 minutes', now()
from public.design_layers where id = test.id('dl');
select test.ok(public.design_layout_before(test.id('dlnew')) ->> 'layout' = 'Asked', 'a designer''s ask sets the layout kept after it');

delete from public.design_layers where (choice ->> 'layout' like 'First %' or choice ->> 'layout' = 'Asked' or id = test.id('dlnew'))
  and id <> test.id('dl');
delete from public.brand_books where workspace_id = test.id('lysne') and kind = 'design' and version = 23;
set role authenticated;
select test.ok(true, 'all of the engine lookup tests passed');
