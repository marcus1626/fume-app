-- Moodboards (20261103216000_boards.sql): the brand's moodboard is made once; the owner places pictures and notes,
-- likes one and not another, and that teaches Fume her taste; a campaign's moodboard starts with pictures; skipping
-- it is the approver's; someone off the brand changes nothing.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;
set role authenticated;

select test.act('sara@halm.test');
select test.keep('board', (public.brand_moodboard(test.id('client')) ->> 'id')::uuid);
select test.ok((public.brand_moodboard(test.id('client')) ->> 'id')::uuid = test.id('board'), 'the brand has one moodboard');
select test.keep('pic', public.add_board_item(test.id('board'), '{"kind":"image","image":"https://halm.test/oak.jpg","x":40,"y":1200,"w":320,"h":400}'));
select test.ok((select height >= 1640 from public.boards where id = test.id('board')), 'the board grows to hold it');
select public.add_board_item(test.id('board'), '{"kind":"note","text":"Late sun, never flash"}');
select test.refuses($$ select public.add_board_item(test.id('board'), '{"kind":"image"}') $$, 'invalid', 'a picture item needs the picture');
select public.update_board_item(test.id('pic'), '{"verdict":"disliked","note":"Too glossy"}');
select test.ok((select verdict = 'disliked' and note = 'Too glossy' from public.board_items where id = test.id('pic')), 'she says why not');
reset role;
select app.taste_sync(test.id('client'));
set role authenticated;
select test.ok((select verdict = 'disliked' and reason = 'Too glossy' and origin = 'board' from public.taste_signals
                where ref_table = 'board_items' and ref_key = test.id('pic')::text), 'and it teaches Fume her taste');

select test.keep('cboard', (public.start_moodboard(test.id('hc'), '["https://halm.test/a.jpg","https://halm.test/b.jpg"]') ->> 'id')::uuid);
select test.ok((select board_id = test.id('cboard') from public.campaigns where id = test.id('hc')), 'the campaign gets its moodboard');
select test.ok((select count(*) = 2 and bool_and(verdict = 'liked') from public.board_items where board_id = test.id('cboard')), 'with her pictures, liked');
select public.skip_moodboard(test.id('hc'));
select test.ok((select moodboard_skipped from public.campaigns where id = test.id('hc')), 'the owner may go on without it');
select public.remove_board_item(test.id('pic'));
reset role;
select app.taste_sync(test.id('client'));
set role authenticated;
select test.ok(not exists (select 1 from public.taste_signals where ref_table = 'board_items' and ref_key = test.id('pic')::text), 'a picture taken off is forgotten');

select test.act('jon@halm.test');
select test.refuses(format('select public.add_board_item(%L, %L)', test.id('board'), '{"kind":"note","text":"x"}'), 'not_found', 'off the brand, he changes nothing');

select test.ok(true, 'all of the board tests passed');
