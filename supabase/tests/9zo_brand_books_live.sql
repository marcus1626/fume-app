-- The brand's books on the live app (20261109230000_brand_books_live.sql): a customer sees that a newer version is on
-- its way, as its number and state only; Fume's people read those versions themselves.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
set role authenticated;

select test.act('william@fumecreatives.com');
select test.keep('pd', (public.write_brand_book(test.id('lysne'), 'design') ->> 'id')::uuid);
select test.ok(public.brand_book_progress(test.id('lysne')) = '[]'::jsonb, 'Fume''s own people get no progress: they read the book');
select test.act('marcus+lysne@fumecreatives.com');
select test.ok((select count(*) from public.brand_books where id = test.id('pd')) = 0, 'the customer does not read the book being written');
select test.ok((select bool_or(p ->> 'kind' = 'design' and p ->> 'state' = 'writing' and p ? 'version' and p ? 'updatedAt' and not p ? 'body')
  from jsonb_array_elements(public.brand_book_progress(test.id('lysne'))) p), 'but sees that it is on its way, without its words');
select test.act('user+solv@fumecreatives.com');
select test.ok(public.brand_book_progress(test.id('lysne')) = '[]'::jsonb, 'someone off the brand sees nothing');
reset role;
select test.ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'brand_books')
  or not exists (select 1 from pg_publication where pubname = 'supabase_realtime'), 'a change to a book reaches the open screens');
delete from public.brand_books where id = test.id('pd');
select test.ok(true, 'all of the brand book progress tests passed');
