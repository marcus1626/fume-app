-- Fume designs at most three creatives at a time (20261109120000_design_three_at_a_time.sql).

\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;

insert into public.brand_books (workspace_id, kind, version, state, body)
values (test.id('lysne'), 'design', 22, 'approved', '{"summary":"Calm","styles":[{"name":"h1"}],"colours":[{"hex":"#111111","role":"text"}]}');
insert into public.design_layers (workspace_id, candidate_id, job_id, creative_id, requested_by, ask, started_at)
select workspace_id, candidate_id, job_id, creative_id, requested_by, 'busy ' || n, now()
from public.design_layers, generate_series(1, 3) n where id = test.id('dl');
insert into public.design_layers (workspace_id, candidate_id, job_id, creative_id, requested_by, ask)
select workspace_id, candidate_id, job_id, creative_id, requested_by, 'fourth' from public.design_layers where id = test.id('dl');
select test.keep('dl4', (select id from public.design_layers where ask = 'fourth'));

select test.refuses($$ select public.design_take(test.id('dl4')) $$, 'unavailable', 'a fourth layer waits while three are being designed');
select test.ok((select state = 'designing' and started_at is null from public.design_layers where id = test.id('dl4')),
  'and stays waiting, untaken');

-- The others are done: the fourth is taken.
update public.design_layers set state = 'failed', error = 'test', finished_at = now()
where state = 'designing' and id <> test.id('dl4') and started_at > now() - interval '2 minutes';
select test.ok(public.design_take(test.id('dl4')) is not null, 'once fewer than three are at work, the next is taken');

-- Three long since started and never finished do not hold the rest back.
update public.design_layers set started_at = now() - interval '5 minutes' where ask like 'busy %';
update public.design_layers set state = 'failed', error = 'test', finished_at = now() where id = test.id('dl4');

delete from public.design_layers where ask like 'busy %' or ask = 'fourth';
delete from public.brand_books where workspace_id = test.id('lysne') and kind = 'design' and version = 22;
set role authenticated;
select test.ok(true, 'all of the three-at-a-time tests passed');
