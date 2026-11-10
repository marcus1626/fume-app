-- The taste model (20261103200000_taste_model.sql): pictures with a verdict are measured, and per variable Fume learns
-- what the brand likes and what it does not, with a confidence; the dos and don'ts land in the graph and the bundle.
-- On the agency's client from 97_agency.sql.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
set role authenticated;

select test.act('sara@halm.test');
select public.add_identity_item(test.id('client'), 'image', '{"image": "https://halm.test/look.jpg", "caption": "Oak at dusk", "group": "look"}');
select test.act('jon@halm.test');
select public.add_taste_signal(test.id('client'), 'https://halm.test/dusk-' || n || '.jpg', true, null) from generate_series(1, 4) n;
select public.add_taste_signal(test.id('client'), 'https://halm.test/studio-' || n || '.jpg', false, 'Too bright and cold') from generate_series(1, 3) n;
select test.refuses($$ select public.add_taste_signal(test.id('client'), 'not a picture', true) $$, 'invalid', 'a signal needs a picture');
create temp table pend as select public.taste_pending(test.id('client')) as p;
select test.ok((select jsonb_array_length(p) >= 7 from pend), 'the pictures wait to be measured, the brand''s own imagery with them');
select test.ok(exists (select 1 from public.taste_signals where workspace_id = test.id('client') and origin = 'brand_imagery'),
  'its Brand DNA pictures are evidence too');

-- The service saves what it measured: dusk pictures dark, warm and orange; studio pictures bright and cold.
reset role;
select public.save_taste_measures(test.id('client'), (
  select jsonb_agg(jsonb_build_object('id', s.id, 'v', case when s.verdict = 'liked'
      then jsonb_build_object('light.key', 30 + (abs(hashtext(s.id::text)) % 5), 'colour.warmth', 20, 'colour.hue_main', 40,
        'colour.coloured_share', 0.6, 'composition.space', 0.6)
      else jsonb_build_object('light.key', 80, 'colour.warmth', -8, 'colour.hue_main', 230, 'colour.coloured_share', 0.3, 'composition.space', 0.6) end,
    'palette', case when s.verdict = 'liked' then '[{"hex": "#3A2A1E", "share": 0.6}, {"hex": "#C8A27A", "share": 0.4}]'::jsonb
      else '[{"hex": "#F2F4F7", "share": 1}]'::jsonb end))
  from public.taste_signals s where s.workspace_id = test.id('client')));
set role authenticated;
select test.act('jon@halm.test');
select test.ok((select do_confidence > 0.5 and words = 'dark and moody' and avoid_confidence > 0.5 and avoid_words = 'high key'
  from public.taste_variables where workspace_id = test.id('client') and key = 'light.key'), 'she likes it dark, and Fume is sure she does not like it bright');
select test.ok((select words = 'orange, terracotta and brown' and do_confidence > 0.5 from public.taste_variables
  where workspace_id = test.id('client') and key = 'colour.hue_main'), 'her colour family');
select test.ok((select avoid_confidence = 0 from public.taste_variables where workspace_id = test.id('client') and key = 'composition.space'),
  'no don''t where what she liked and did not are the same');
select test.ok(exists (select 1 from public.brain_nodes where workspace_id = test.id('client') and kind = 'do' and label = 'Brightness: dark and moody' and score > 0.5)
  and exists (select 1 from public.brain_nodes where workspace_id = test.id('client') and kind = 'dont' and label = 'Avoid high key'),
  'the dos and don''ts are in the graph with their confidence');

create temp table prof as select public.brain_context(test.id('client')) -> 'taste_profile' as t;
select test.ok((select t -> 'do' @> '[{"what": "Brightness: dark and moody"}]' and t -> 'dont' @> '[{"what": "Avoid high key"}]'
    and t -> 'reasons' @> '["Too bright and cold"]' and (t #>> '{palette,0,hex}') = '#3A2A1E' from prof),
  'the bundle carries the taste profile, her reasons and her palette');
select public.add_product(test.id('client'), 'Lamp', 'Brass');
select test.ok(exists (select 1 from public.brain_nodes where workspace_id = test.id('client') and kind = 'do')
  and (public.brain_context(test.id('client')) -> 'products') @> '[{"product": "Lamp Brass"}]', 'a sync of the graph keeps the taste');

select test.act('user+solv@fumecreatives.com');
select test.refuses($$ select public.taste_pending(test.id('client')) $$, 'not_found', 'another brand cannot read this one''s taste');
select test.ok(not exists (select 1 from public.taste_variables where workspace_id = test.id('client')), 'nor see it');
reset role;
select test.ok(true, 'all of the taste model''s tests passed');
