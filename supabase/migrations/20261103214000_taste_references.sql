-- "This is us" and "Not us" on the Taste tab: a picture she adds (uploaded, or from the web) with her note. It is a
-- taste signal (origin reference) like any other, measured by taste-learn and part of the taste model.

create or replace function public.add_taste_reference(
  p_workspace_id uuid, p_liked boolean, p_file_id uuid default null, p_image_url text default null, p_note text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s public.taste_signals;
begin
  perform app.require_user();
  if not app.can_read(p_workspace_id) then perform app.fail('not_found', 'No such brand.'); end if;
  if not app.product_writer(p_workspace_id) then perform app.fail('forbidden', 'Only the people on the brand teach Fume its taste.'); end if;
  if p_file_id is null and coalesce(p_image_url, '') !~ '^https://' then perform app.fail('invalid', 'Add the picture.'); end if;
  if p_file_id is not null and not exists (select 1 from public.files where id = p_file_id and workspace_id = p_workspace_id) then
    perform app.fail('not_found', 'No such picture.');
  end if;
  insert into public.taste_signals (workspace_id, verdict, weight, origin, reason, image_url, file_id, created_by)
  values (p_workspace_id, case when p_liked then 'liked' else 'disliked' end, 1.5, 'reference',
          nullif(trim(coalesce(p_note, '')), ''), case when p_file_id is null then p_image_url end, p_file_id, auth.uid())
  returning * into s;
  return jsonb_build_object('id', s.id, 'verdict', s.verdict, 'note', s.reason, 'fileId', s.file_id, 'image', s.image_url,
    'addedBy', s.created_by);
end $$;

-- Taking one back: the person who added it, or the brand's owner and approvers.
create or replace function public.remove_taste_reference(p_signal_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.taste_signals;
begin
  select * into s from public.taste_signals where id = p_signal_id and origin = 'reference';
  if not found or not app.can_read(s.workspace_id) then perform app.fail('not_found', 'No such reference.'); end if;
  if s.created_by is distinct from auth.uid() and not app.customer_is(s.workspace_id, array['owner', 'approver']) then
    perform app.fail('forbidden', 'Only who added it, or the owner, takes it back.');
  end if;
  delete from public.taste_signals where id = p_signal_id;
  perform app.taste_compute(s.workspace_id);
end $$;

revoke execute on function public.add_taste_reference(uuid, boolean, uuid, text, text), public.remove_taste_reference(uuid) from public, anon;
grant execute on function public.add_taste_reference(uuid, boolean, uuid, text, text), public.remove_taste_reference(uuid) to authenticated;
