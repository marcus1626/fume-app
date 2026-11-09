-- The brand's books on the live app (app/FLOWS.md §30–32): a change to a book reaches the open screens over Realtime
-- (the same row-level security as a read), and a customer sees that a newer version is on its way without its words.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'
                   and tablename = 'brand_books') then
      alter publication supabase_realtime add table public.brand_books;
    end if;
  end if;
end $$;

-- The newest version of each book that the reader may not read yet (being written, a draft, or failed), as its
-- number and state only. Fume's own people read those versions themselves, so they get nothing here.
create or replace function public.brand_book_progress(p_workspace_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('kind', x.kind, 'version', x.version, 'state', x.state,
    'updatedAt', x.updated_at) order by x.kind), '[]'::jsonb)
  from (
    select distinct on (b.kind) b.kind, b.version, b.state, coalesce(b.written_at, b.started_at, b.created_at) as updated_at
    from public.brand_books b
    where b.workspace_id = p_workspace_id and app.can_read(p_workspace_id) and not app.is_staff(p_workspace_id)
      and b.state in ('writing', 'draft', 'failed')
      and b.version > coalesce((select max(r.version) from public.brand_books r where r.workspace_id = b.workspace_id
        and r.kind = b.kind and r.state in ('checked', 'approved', 'superseded')), 0)
    order by b.kind, b.version desc
  ) x
$$;
revoke execute on function public.brand_book_progress(uuid) from public, anon;
grant execute on function public.brand_book_progress(uuid) to authenticated;
