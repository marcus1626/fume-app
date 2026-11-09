-- Train the Engine: Fume's own people judge the Engine's pictures and the check's findings (20261106160000_train_the_engine.sql).

\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;
delete from public.engine_lessons where source_candidate_id = test.id('ecand') and created_by = (select id from public.profiles where email = 'kristian@fumecreatives.com');
update public.candidates set details = '[
  {"n":1,"kind":"part","part":"chest-pocket","what":"chest pocket","reads":"no pocket","expected":"A square patch pocket","ok":false,"note":"The picture shows 0 chest pocket; the product has 1."}]'
where id = test.id('ecand');
-- The deck shows a picture in its newest form only: here the picture stands alone (the earlier tests made designs and
-- fixes from it).
create temp table train_kids as select id, designed_from, fixed_from from public.candidates
  where designed_from = test.id('ecand') or fixed_from = test.id('ecand');
update public.candidates set designed_from = null, fixed_from = null where id in (select id from train_kids);
grant select on train_kids to authenticated;
select test.ok((select j.creative_id is not null and j.kind <> 'format' from public.candidates c join public.production_jobs j on j.id = c.job_id
  where c.id = test.id('ecand')), 'the picture belongs to a creative');

set role authenticated;
select test.act('kristian@fumecreatives.com');
do $$
declare d jsonb := public.train_cards();
  c jsonb := (select x from jsonb_array_elements(d -> 'cards') x where x ->> 'id' = test.id('ecand')::text);
begin
  perform test.ok(c is not null and c ->> 'brand_name' is not null and c -> 'picture' ->> 'path' is not null
    and c -> 'details' -> 0 ->> 'part' = 'chest-pocket' and jsonb_array_length(c -> 'labels') = 0,
    'one of Fume''s own people gets the Engine''s picture with what the check found');
  perform test.ok((select bool_and(x ->> 'id' in (select id::text from public.candidates where origin = 'engine')) from jsonb_array_elements(d -> 'cards') x),
    'only the Engine''s own pictures');
end $$;
select test.ok((public.judge_detail(test.id('ecand'), 'chest-pocket', 'right', 'The pocket is gone') ->> 'verdict') = 'right',
  'a word on what the check found is kept');
select public.judge_detail(test.id('ecand'), 'chest-pocket', 'right');
select test.ok((select note = 'The pocket is gone' from public.detail_labels where candidate_id = test.id('ecand') and detail = 'chest-pocket'),
  'the same answer without words keeps the words');
select public.judge_detail(test.id('ecand'), 'chest-pocket', 'wrong');
select test.ok((select verdict = 'wrong' and note is null from public.detail_labels where candidate_id = test.id('ecand') and detail = 'chest-pocket'),
  'a changed answer drops the old words');
select test.ok((select x -> 'labels' -> 0 ->> 'verdict' = 'wrong' from jsonb_array_elements(public.train_cards() -> 'cards') x where x ->> 'id' = test.id('ecand')::text),
  'the card carries the word given');
select test.refuses($$ select public.judge_detail(test.id('ecand'), 'chest-pocket', 'maybe') $$, 'invalid', 'the check is right or wrong');
select test.refuses($$ select public.judge_detail(test.id('ecand'), '', 'right') $$, 'invalid', 'a word names its finding');
select public.teach_engine(test.id('ecand'), 'no', 'The pocket is missing');
select test.ok(not exists (select 1 from jsonb_array_elements(public.train_cards() -> 'cards') x where x ->> 'id' = test.id('ecand')::text)
  and (public.train_cards() ->> 'answered')::int >= 1, 'an answered picture leaves the deck, and is counted');
select public.judge_detail(test.id('ecand'), 'chest-pocket', null);
select test.ok(not exists (select 1 from public.detail_labels where candidate_id = test.id('ecand')), 'a word can be taken back');

select test.act('marcus+lysne@fumecreatives.com');
select test.ok(jsonb_array_length(public.train_cards() -> 'cards') = 0, 'the customer gets no cards');
select test.refuses($$ select public.judge_detail(test.id('ecand'), 'chest-pocket', 'right') $$, 'forbidden', 'and does not judge the check');
select test.ok((select count(*) = 0 from public.detail_labels), 'nor reads the words on it');
reset role;
update public.candidates set details = '[]' where id = test.id('ecand');
update public.candidates c set designed_from = k.designed_from, fixed_from = k.fixed_from from train_kids k where c.id = k.id;
delete from public.engine_lessons where source_candidate_id = test.id('ecand') and created_by = (select id from public.profiles where email = 'kristian@fumecreatives.com');
set role authenticated;
select test.act('kristian@fumecreatives.com');
select test.ok(not exists (select 1 from jsonb_array_elements(public.train_cards(200) -> 'cards') x where x ->> 'id' = test.id('ecand')::text)
    and exists (select 1 from jsonb_array_elements(public.train_cards(200) -> 'cards') x
      where x ->> 'id' in (select id::text from train_kids)),
  'a picture made into a design or fixed is not shown again, only its newest form');
reset role;
-- A design made again from the same picture: the old one leaves the deck.
create temp table train_redo as select (jsonb_populate_record(null::public.candidates, to_jsonb(c)
    || jsonb_build_object('id', gen_random_uuid(), 'created_at', now() + interval '1 minute'))).*
  from public.candidates c where c.id = (select id from train_kids where designed_from is not null limit 1);
insert into public.candidates select * from train_redo;
grant select on train_redo to authenticated;
set role authenticated;
select test.act('kristian@fumecreatives.com');
select test.ok(exists (select 1 from jsonb_array_elements(public.train_cards(200) -> 'cards') x where x ->> 'id' = (select id::text from train_redo))
    and not exists (select 1 from jsonb_array_elements(public.train_cards(200) -> 'cards') x
      where x ->> 'id' in (select id::text from train_kids where designed_from is not null)),
  'a design made again shows once, the newest');
reset role;
delete from public.candidates where id in (select id from train_redo);
select test.ok(true, 'all of the train-the-engine tests passed');
