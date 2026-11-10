-- Private files (docs/mvp/domain-model.md §4). One private bucket; every object lives at <workspace_id>/<name>.
-- Reading an object (and so making a signed URL for it) follows app.can_read_file: a customer never gets the bytes of
-- a version that is not checked and sent, whatever address they try.

insert into storage.buckets (id, name, public)
values ('workspace-files', 'workspace-files', false)
on conflict (id) do update set public = false;

create or replace function app.can_read_object(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.files f where f.path = p_name and app.can_read_file(f.id))
$$;

create or replace function app.can_upload_to(p_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  ws uuid;
begin
  begin
    ws := split_part(p_name, '/', 1)::uuid;
  exception when others then
    return false;
  end;
  return app.customer_is(ws, array['owner', 'approver', 'member']) or app.is_staff(ws);
end $$;

grant execute on function app.can_read_object(text), app.can_upload_to(text) to authenticated;

create policy workspace_files_read on storage.objects for select to authenticated
using (bucket_id = 'workspace-files' and app.can_read_object(name));

-- Upload only into a workspace folder you may add to; never overwrite or delete (versions are new files).
create policy workspace_files_upload on storage.objects for insert to authenticated
with check (bucket_id = 'workspace-files' and app.can_upload_to(name));
