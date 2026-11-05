-- One image model per task (docs/mvp/task-models.md): the picture's render keeps the Engine's own choice
-- (engine_image_model and its arms); a surgical fix and an expanded format each name theirs here, so a cheaper model
-- can take a task it does as well, without a deploy. Every fix and format records the model it used.
insert into app.settings (key, value) values ('task_models', '{"fix": "nano-banana-pro", "expand": "nano-banana-pro"}')
on conflict (key) do nothing;

create or replace function public.task_model(p_task text) returns text
language sql stable security definer set search_path = '' as $$
  select nullif((select value ->> p_task from app.settings where key = 'task_models'), '')
$$;
revoke execute on function public.task_model(text) from public, anon, authenticated;
grant execute on function public.task_model(text) to service_role;
