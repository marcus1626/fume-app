-- The Usage page (20261103220000_usage.sql): Fume's admin sees Fume's customers with their package, not an agency's
-- client; the agency's lead sees the agency's client with no package and no cost; a customer sees no Usage page.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;
set role authenticated;

select test.act('marcus@fumecreatives.com');
select test.ok(exists (select 1 from jsonb_array_elements(public.usage_overview()) r
                       where (r ->> 'workspaceId')::uuid = test.id('lysne') and r -> 'package' ->> 'included' is not null),
  'the admin sees LYSNE with its package');
select test.ok(not exists (select 1 from jsonb_array_elements(public.usage_overview()) r where (r ->> 'workspaceId')::uuid = test.id('client')),
  'not the agency''s client');

select test.act('nora@brygga.test');
select test.ok((select count(*) = 1 and bool_and(jsonb_typeof(r -> 'package') = 'null' and (r ->> 'cost')::numeric = 0)
                from jsonb_array_elements(public.usage_overview()) r),
  'the agency lead sees the client, with no package and no cost');
select test.ok((select (r -> 'periods' -> 'weeks' ->> 'creatives')::int >= 1 from jsonb_array_elements(public.usage_overview()) r),
  'counted from the client''s creatives');

select test.act('sara@halm.test');
select test.refuses('select public.usage_overview()', 'forbidden', 'a customer sees no Usage page');

select test.ok(true, 'all of the usage tests passed');
