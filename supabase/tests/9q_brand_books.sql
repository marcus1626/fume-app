-- The brand's books (20261104233000_brand_books.sql): Fume writes a long Tone of Voice and a design system, an expert
-- checks it, only the customer approves it, and a customer never sees one being written or not yet checked.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
set role authenticated;

select test.ok(not has_function_privilege('authenticated', 'public.brand_book_take(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.brand_book_finish(uuid, jsonb, jsonb, text, numeric)', 'execute')
  and has_function_privilege('service_role', 'public.brand_book_take(uuid)', 'execute'),
  'only the writer takes and hands back a book');

select test.act('william@fumecreatives.com');
select test.keep('bv', (public.write_brand_book(test.id('lysne'), 'voice') ->> 'id')::uuid);
select test.ok((public.write_brand_book(test.id('lysne'), 'voice') ->> 'id')::uuid = test.id('bv'), 'one book of a kind is written at a time');
select test.refuses($$ select public.write_brand_book(test.id('lysne'), 'poster') $$, 'invalid', 'a Tone of Voice or a design system');
select test.act('user+solv@fumecreatives.com');
select test.refuses($$ select public.write_brand_book(test.id('lysne'), 'voice') $$, 'not_found', 'someone off the brand asks for nothing');
select test.act('marcus+lysne@fumecreatives.com');
select test.ok((select count(*) from public.brand_books where id = test.id('bv')) = 0, 'the customer never sees a book being written');

reset role;
do $$
declare t jsonb := public.brand_book_take(test.id('bv'));
begin
  perform test.ok(t #>> '{book,kind}' = 'voice' and (t #>> '{book,attempt}')::int = 1 and t #>> '{brand,brand,name}' is not null
    and jsonb_typeof(t -> 'identity') = 'object' and jsonb_typeof(t -> 'rules') = 'array' and jsonb_typeof(t -> 'claims') = 'array',
    'the writer gets what Fume knows about the brand, its identity, all its rules and its claims');
  perform test.ok(public.brand_book_take(test.id('bv')) is null, 'and a writing under way is not taken twice');
end $$;
select test.refuses($$ select public.brand_book_finish(test.id('bv'), '{"summary":"x"}', '{}', 'test', 0.01) $$, 'invalid',
  'a book missing a part it must have is refused');
select public.brand_book_finish(test.id('bv'),
  '{"summary":"Quiet","identity":{"who":"LYSNE"},"speak":{"traits":[]},"examples":[{"line":"For the hour before sleep.","where":"site","language":"en"}]}',
  '{"pages":["https://lysne.example/"]}', 'claude-haiku-5-5', 0.012);
select test.ok((select state = 'draft' and llm_usd = 0.012 and sources -> 'pages' ->> 0 = 'https://lysne.example/' from public.brand_books where id = test.id('bv')),
  'the book is a draft, with what it cost and what it was written from');
select test.ok((public.fume_llm_budget() ->> 'spent_usd')::numeric >= 0.012, 'the language model''s week counts writing books');

set role authenticated;
select test.act('marcus+lysne@fumecreatives.com');
select test.ok((select count(*) from public.brand_books where id = test.id('bv')) = 0, 'nor a draft no expert has checked');
select test.refuses($$ select public.check_brand_book(test.id('bv')) $$, 'not_found', 'the customer does not check');
select test.act('william@fumecreatives.com');
select test.refuses($$ select public.check_brand_book(test.id('bv')) $$, 'forbidden', 'an account manager does not check');
select test.act('kristian@fumecreatives.com');
select public.check_brand_book(test.id('bv'));
select test.refuses($$ select public.approve_brand_book(test.id('bv')) $$, 'forbidden', 'nor does Fume approve: only the customer');
select test.act('marcus+lysne@fumecreatives.com');
select test.ok((select state = 'checked' from public.brand_books where id = test.id('bv')), 'once checked, the customer reads it');
select public.approve_brand_book(test.id('bv'));
select test.ok((select state = 'approved' and approved_by = auth.uid() from public.brand_books where id = test.id('bv')), 'and approves it');

-- A change: the customer's words go into the next version; the approved one stays in use until that is approved.
select test.keep('bv2', (public.ask_brand_book_change(test.id('bv'), 'More about the evening ritual') ->> 'id')::uuid);
select test.ok((select count(*) from public.brand_books where id = test.id('bv2')) = 0, 'the customer does not see the new one being written');
reset role;
select test.ok((select version = 2 and ask = 'More about the evening ritual' and state = 'writing' from public.brand_books where id = test.id('bv2'))
  and (select state = 'approved' from public.brand_books where id = test.id('bv')), 'a change is a new version; the approved one stays');
do $$
declare t jsonb := public.brand_book_take(test.id('bv2'));
begin
  perform test.ok(t #>> '{previous,version}' = '1' and t #>> '{previous,body,summary}' = 'Quiet' and t #>> '{book,ask}' = 'More about the evening ritual',
    'the next version is written from the last with the ask');
end $$;
select public.brand_book_finish(test.id('bv2'), '{"summary":"Quiet, evening","identity":{},"speak":{},"examples":[]}', '{}', 'claude-haiku-5-5', 0.01);
set role authenticated;
select test.act('kristian@fumecreatives.com');
select public.check_brand_book(test.id('bv2'));
select test.act('marcus+lysne@fumecreatives.com');
select public.approve_brand_book(test.id('bv2'));
select test.ok((select state from public.brand_books where id = test.id('bv')) = 'superseded'
  and (select state from public.brand_books where id = test.id('bv2')) = 'approved', 'the newer approved version replaces the older');

-- The design system is written with the brand's Tone of Voice, and must carry its tokens, its CSS and its examples.
select test.act('william@fumecreatives.com');
select test.keep('bd', (public.write_brand_book(test.id('lysne'), 'design') ->> 'id')::uuid);
reset role;
select test.ok(public.brand_book_take(test.id('bd')) #>> '{voice,summary}' = 'Quiet, evening', 'the design system reads the approved Tone of Voice');
select test.refuses($$ select public.brand_book_finish(test.id('bd'), '{"summary":"x","examples":[]}', '{}', 'test', 0) $$, 'invalid',
  'a design system without tokens and CSS is refused');
-- A writing that fails three times stops, with why.
select public.brand_book_fail(test.id('bd'), 'The book was cut off.', 0.002, false);
update public.brand_books set started_at = null where id = test.id('bd');
select test.ok(public.brand_book_take(test.id('bd')) is not null, 'a failed try is taken again');
select public.brand_book_fail(test.id('bd'), 'The book was cut off.', 0.002, false);
select test.ok(public.brand_book_take(test.id('bd')) is not null, 'the third try');
select public.brand_book_fail(test.id('bd'), 'The book was cut off.', 0.002, false);
select test.ok(public.brand_book_take(test.id('bd')) is null
  and (select state = 'failed' and error = 'The book was cut off.' from public.brand_books where id = test.id('bd')),
  'after three tries it stops, with why');
set role authenticated;

select test.ok(true, 'all of the brand book tests passed');
