-- One image model per task (20261105180000_task_models.sql).

\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;

select test.ok(public.task_model('fix') = 'nano-banana-pro' and public.task_model('expand') = 'nano-banana-pro'
  and public.task_model('dance') is null, 'a fix and an expansion name their model; an unknown task none');
select test.ok(not has_function_privilege('authenticated', 'public.task_model(text)', 'execute'), 'only the functions read it');
set role authenticated;
select test.ok(true, 'all of the task model tests passed');
