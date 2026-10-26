-- Open screens stay current: the record's new rows reach the app over Supabase Realtime, filtered by the same
-- row-level security as a read (a customer hears only about what they may see).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'record_events'
     ) then
    alter publication supabase_realtime add table public.record_events;
  end if;
end $$;
