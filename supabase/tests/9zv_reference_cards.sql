-- Reference cards (20261110080000_reference_cards.sql): each product picture is looked at once, its card is kept, and
-- the Engine is handed the cards of the pictures a job could send. Fume's people read them; a customer never does.

reset role;
-- The pictures waiting are each slot's newest: the oil's first front picture is history and is not read.
select test.ok((select (w ->> 'waiting')::int >= 1 and jsonb_array_length(w -> 'pictures') >= 1
  and not exists (select 1 from jsonb_array_elements(w -> 'pictures') p where p ->> 'source_id' = test.id('ps1')::text)
  and exists (select 1 from jsonb_array_elements(w -> 'pictures') p where p ->> 'product' is not null and (p ? 'path' or p ? 'url'))
  from public.reference_pictures(test.id('lysne'), 40) w), 'the brand''s current product pictures wait for a card, with where to fetch them');
select test.ok((select jsonb_array_length(public.reference_pictures(test.id('lysne'), 1) -> 'pictures') = 1), 'only as many as asked for');

do $$
declare before int; s uuid; other uuid;
begin
  select (w ->> 'waiting')::int, (w -> 'pictures' -> 0 ->> 'source_id')::uuid into before, s from public.reference_pictures(test.id('lysne'), 40) w;
  perform test.keep('rc_source', s);
  perform test.keep('rc_before', ('00000000-0000-0000-0000-' || lpad(before::text, 12, '0'))::uuid);
  perform public.reference_card_save(test.id('lysne'), s, '{"of": "product_on_person", "view": "front", "crop": "whole"}', 'jev');
end $$;
select test.ok((select card ->> 'of' = 'product_on_person' and reader = 'jev' and workspace_id = test.id('lysne')
  from public.reference_cards where source_id = test.id('rc_source')), 'a card is kept on its picture with who read it');
select test.ok((select (w ->> 'waiting')::int = right(test.id('rc_before')::text, 12)::int - 1
  and not exists (select 1 from jsonb_array_elements(w -> 'pictures') p where p ->> 'source_id' = test.id('rc_source')::text)
  from public.reference_pictures(test.id('lysne'), 40) w), 'and the picture waits no more');
select public.reference_card_save(test.id('lysne'), test.id('rc_source'), '{"of": "product", "view": "back", "crop": "whole"}', 'gpt-luna');
select test.ok((select card ->> 'view' = 'back' and reader = 'gpt-luna' and count(*) over () = 1
  from public.reference_cards where source_id = test.id('rc_source')), 'looked at again, the new card replaces the old');

select test.refuses(format($$ select public.reference_card_save(test.id('solv'), '%s', '{"of": "product"}') $$, test.id('rc_source')),
  'not_found', 'a picture of another brand is refused');
select test.refuses(format($$ select public.reference_card_save(test.id('lysne'), '%s', '{"view": "front"}') $$, test.id('rc_source')),
  'invalid', 'a card says what the picture is of');
select test.refuses(format($$ select public.reference_card_save(test.id('lysne'), '%s', '[]') $$, test.id('rc_source')),
  'invalid', 'and is an object');

-- The Engine is handed the cards by the picture's address, for a job whose campaign shows the product.
select test.ok((select bool_or((public.engine_reference_cards(j.id) -> coalesce(fi.path, so.url)) ->> 'view' = 'back')
  from public.sources so left join public.files fi on fi.id = so.file_id
  join public.campaign_products cp on cp.product_id = so.product_id
  join public.production_jobs j on j.campaign_id = cp.campaign_id
  where so.id = test.id('rc_source')) is not false, 'the Engine reads the card by the picture''s address');
select test.ok(public.engine_reference_cards(gen_random_uuid()) = '{}', 'a job that is not there has none');
-- A picture nobody could fetch is marked, waits no more, and is not handed to the Engine as a card.
select public.reference_card_save(test.id('lysne'), test.id('rc_source'), '{"unread": "The picture could not be fetched."}', 'jev');
select test.ok((select not exists (select 1 from jsonb_array_elements(w -> 'pictures') p where p ->> 'source_id' = test.id('rc_source')::text)
  from public.reference_pictures(test.id('lysne'), 40) w), 'a picture that could not be fetched is not fetched again each time');
select test.ok(not exists (select 1 from public.production_jobs j, jsonb_each(public.engine_reference_cards(j.id)) c where c.value ? 'unread'),
  'and the Engine is not handed it');

-- Fume's people on the brand read the Engine's workings; a customer never does.
set role authenticated;
select test.act('kristian@fumecreatives.com');
select test.ok((select count(*) = 1 from public.reference_cards where workspace_id = test.id('lysne')), 'Fume''s people on the brand read its cards');
select test.act('marcus+lysne@fumecreatives.com');
select test.ok((select count(*) = 0 from public.reference_cards), 'a customer does not');
select test.ok(not has_function_privilege('authenticated', 'public.reference_card_save(uuid, uuid, jsonb, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.reference_pictures(uuid, int)', 'execute')
  and not has_function_privilege('authenticated', 'public.engine_reference_cards(uuid)', 'execute'), 'only the Engine reads and writes them');

reset role;
delete from public.reference_cards where workspace_id = test.id('lysne');
set role authenticated;
select test.ok(true, 'all of the reference card tests passed');
