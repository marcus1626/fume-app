-- The Tone of Voice edited in place (20261110000000_book_edits.sql): Fume's people write into a draft, an edit on any
-- other version makes the next draft, and the customer's lines go with her ask and stay in the version Fume writes.

\set ON_ERROR_STOP 1
set client_min_messages = notice;

-- The rule itself, as app/test/bookEdits.test.ts holds it for the page.
select test.ok((app.book_edit('{"a":{"b":["x","y"]}}', '[]', '{"path":"a.b.1","to":"z"}',
  '00000000-0000-0000-0000-000000000001', now()) -> 'body') = '{"a":{"b":["x","z"]}}', 'a line in a list is changed');
select test.ok((app.book_edit('{"a":{"b":["x","y"]}}', '[]', '{"path":"a.b.2","to":"z"}',
  '00000000-0000-0000-0000-000000000001', now()) -> 'body') = '{"a":{"b":["x","y","z"]}}', 'one past the end adds a line');
select test.ok((app.book_edit('{"a":{"b":["x","y"]}}', '[]', '{"path":"a.b.0","to":"w","insert":true}',
  '00000000-0000-0000-0000-000000000001', now()) -> 'body') = '{"a":{"b":["w","x","y"]}}', 'insert puts a line in before');
select test.ok((select r -> 'body' = '{"a":{"b":["y"]}}' and r -> 'marks' = '[{"path":"a.b.0","from":"y"}]'
  from app.book_edit('{"a":{"b":["x","y"]}}', '[{"path":"a.b.0","from":"x"},{"path":"a.b.1","from":"y"}]', '{"path":"a.b.0","to":null}',
  '00000000-0000-0000-0000-000000000001', now()) r), 'taking a line out moves the marks after it');
select test.ok((select r -> 'marks' = '[]' from app.book_edit('{"s":"new"}', '[{"path":"s","from":"old"}]', '{"path":"s","to":"old"}',
  '00000000-0000-0000-0000-000000000001', now()) r), 'back to what it said is no longer an edit');
select test.ok((select r -> 'marks' -> 0 ->> 'from' = 'old' and r -> 'marks' -> 0 ->> 'by' = '00000000-0000-0000-0000-000000000001'
  from app.book_edit('{"s":"old"}', '[]', '{"path":"s","to":"new"}', '00000000-0000-0000-0000-000000000001', now()) r),
  'every line changed keeps who changed it and what it said');
select test.refuses($$select app.book_edit('{"s":{"t":1}}', '[]', '{"path":"s.t","to":"x"}', null, now())$$, 'invalid', 'a number is not a line');
select test.refuses($$select app.book_edit('{"s":"a"}', '[]', '{"path":"s","to":null}', null, now())$$, 'invalid', 'only an item of a list is taken out');
select test.refuses($$select app.book_edit('{"s":["a"]}', '[]', '{"path":"s.3","to":"x"}', null, now())$$, 'invalid', 'no line past the end');
select test.refuses($$select app.book_edit('{"s":"a"}', '[]', '{"path":"__proto__.s","to":"x"}', null, now())$$, 'invalid', 'no path outside the body');

-- A Tone of Voice written and checked for LYSNE.
set role authenticated;
select test.act('william@fumecreatives.com');
select test.keep('tv', (public.write_brand_book(test.id('lysne'), 'voice') ->> 'id')::uuid);
reset role;
select public.brand_book_finish(test.id('tv'),
  '{"identity":{"believe":["We make light"]},"speak":{"traits":[{"name":"Calm","do":"Short lines"}],"avoid":["amazing"]},"examples":[]}',
  '{}', 'test', 0);
set role authenticated;

select test.act('marcus+lysne@fumecreatives.com');
select test.refuses(format('select public.edit_brand_book(%L, %L)', test.id('tv'), '[{"path":"speak.avoid.0","to":"x"}]'), 'not_found',
  'the customer never edits a draft she cannot read');

select test.act('william@fumecreatives.com');
select test.ok((select b ->> 'version' = (select version from public.brand_books where id = test.id('tv'))::text
    and b -> 'body' -> 'speak' -> 'traits' -> 0 ->> 'do' = 'Short lines, one idea each'
    and jsonb_array_length(b -> 'edits') = 1
  from public.edit_brand_book(test.id('tv'), '[{"path":"speak.traits.0.do","to":"Short lines, one idea each"}]') b),
  'Fume''s people write straight into a draft, with a mark');
select test.refuses(format('select public.edit_brand_book(%L, %L)', test.id('tv'), '[{"path":"examples","to":"x"}]'), 'invalid',
  'a part that is not a line is refused');

select test.act('kristian@fumecreatives.com');
select public.check_brand_book(test.id('tv'));
select test.act('marcus+lysne@fumecreatives.com');
select public.approve_brand_book(test.id('tv'));

-- An edit on the approved version makes the next draft; the approved one stays in use.
select test.act('william@fumecreatives.com');
select test.keep('tv2', (public.edit_brand_book(test.id('tv'), '[{"path":"speak.avoid.1","to":"incredible"}]') ->> 'id')::uuid);
select test.ok((select state = 'draft' and version = (select version + 1 from public.brand_books where id = test.id('tv'))
    and body -> 'speak' -> 'avoid' = '["amazing","incredible"]' and edits -> 0 ->> 'from' is null and sources ->> 'by_hand' = 'true'
  from public.brand_books where id = test.id('tv2')), 'an edit on the approved version is the next draft, the added line marked');
select test.ok((select state from public.brand_books where id = test.id('tv')) = 'approved', 'the approved one stays in use');
select test.refuses(format('select public.edit_brand_book(%L, %L)', test.id('tv'), '[{"path":"speak.avoid.0","to":"x"}]'), 'conflict',
  'with a newer draft on its way, that one is edited');
reset role;
delete from public.brand_books where id = test.id('tv2');
set role authenticated;

-- The customer's own lines go with her ask, and the next version keeps them.
select test.act('marcus+lysne@fumecreatives.com');
select test.refuses(format('select public.ask_brand_book_change(%L, null, %L)', test.id('tv'), '[{"path":"nothing.here","to":"x"}]'), 'invalid',
  'a line that is not there is refused at once');
select test.keep('tv3', (public.ask_brand_book_change(test.id('tv'), null,
  '[{"path":"identity.believe.0","to":"We make light for long evenings"}]') ->> 'id')::uuid);
select test.ok((select count(*) from public.brand_books where id = test.id('tv3')) = 0, 'she does not read the version being written');
reset role;
select test.ok((select ask like '%keep them exactly as she wrote them%identity.believe.0: We make light for long evenings%'
  and jsonb_array_length(asked_edits) = 1 from public.brand_books where id = test.id('tv3')), 'the writer reads her lines in the ask');
select public.brand_book_finish(test.id('tv3'),
  '{"identity":{"believe":["Light is for people"]},"speak":{"traits":[],"avoid":[]},"examples":[]}', '{}', 'test', 0);
select test.ok((select body -> 'identity' -> 'believe' ->> 0 = 'We make light for long evenings'
    and edits -> 0 ->> 'path' = 'identity.believe.0' and edits -> 0 ->> 'by' = (select id::text from public.profiles where email = 'marcus+lysne@fumecreatives.com')
  from public.brand_books where id = test.id('tv3')), 'the version Fume writes keeps her line as she wrote it, with her mark');

delete from public.brand_books where id in (test.id('tv'), test.id('tv3'));
select test.ok(true, 'all of the book edit tests passed');
