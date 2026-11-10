-- The Engine makes a picture once more when it left no room for the words (20261110050000_engine_room_again.sql).

\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;
select test.ok(not has_function_privilege('authenticated', 'public.engine_again(uuid, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.engine_again_note(uuid)', 'execute')
  and has_function_privilege('service_role', 'public.engine_again(uuid, text)', 'execute'),
  'only the Engine itself queues a job once more');

-- The job of 9p_engine.sql is done, its newest attempt with a picture.
select test.keep('ra', (select a.id from public.job_attempts a where a.job_id = test.id('ej') order by a.number desc limit 1));
select test.ok((select state = 'succeeded' from public.job_attempts where id = test.id('ra')), 'the newest attempt made its picture');
select test.ok(public.engine_again_note(test.id('ej')) is null, 'a job made once has nothing to tell the next prompt');

select test.ok(public.engine_again(test.id('ra'), 'The sled fills the left side where the words go.'),
  'a picture with no room for the words is made once more');
select test.ok((select state = 'queued' from public.production_jobs where id = test.id('ej')), 'the job waits for the Engine again');
select test.ok(public.engine_again_note(test.id('ej')) = 'The sled fills the left side where the words go.',
  'the next prompt is told what stood in the room');
select test.ok(exists (select 1 from public.record_events where action = 'job.again' and subject_id = test.id('ej')), 'it is on the record');
select test.ok((select count(*) = 1 from public.candidates where job_id = test.id('ej') and attempt_id = test.id('ra')),
  'the picture already made stays for the expert');

-- Once per job: the next attempt's picture is the Engine's last try for the room.
update public.production_jobs set state = 'succeeded' where id = test.id('ej');
select test.ok(not public.engine_again(test.id('ra'), 'Again.'), 'never twice for the same job');
update public.job_attempts set again = null where id = test.id('ra');
update public.production_jobs set state = 'running' where id = test.id('ej');
select test.ok(not public.engine_again(test.id('ra'), 'Again.'), 'only a job that is done');
update public.production_jobs set state = 'succeeded' where id = test.id('ej');

delete from public.record_events where action = 'job.again';
set role authenticated;
select test.ok(true, 'all of the room again tests passed');
