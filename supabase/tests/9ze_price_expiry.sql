-- A price holds until a date (20261105170000_price_expiry.sql): after it, nothing that relies on it is checked, sent,
-- approved or delivered, and the plan writer is not given it.

\set ON_ERROR_STOP 1
set client_min_messages = notice;

select test.ok(app.is_price('Nå 199,- (før 399,-)') and app.is_price('Save 20%') and app.is_price('$49 this week')
  and app.is_price('Kun 299 kr') and app.is_price('Spar 30 % på alt') and not app.is_price('100% resirkulert papir') and not app.is_price('Made in Norway') and not app.is_price('Cold-pressed, 500 ml'),
  'a price or an offer is told from other claims');

set role authenticated;
select test.act('marcus+lysne@fumecreatives.com');
select test.keep('px1', (public.add_product_fact(test.id('oil'), 'claim', 'Price', 'Nå 249,- (før 399,-)') ->> 'id')::uuid);
select test.ok((select valid_until between now() + interval '13 days' and now() + interval '15 days' from public.product_facts where id = test.id('px1')),
  'a price without a date holds 14 days');
select test.keep('px2', (public.add_product_fact(test.id('oil'), 'claim', 'Price', 'Nå 229,-', null, now() + interval '3 days') ->> 'id')::uuid);
select test.ok((select valid_until < now() + interval '4 days' from public.product_facts where id = test.id('px2')), 'the brand''s own date');
select test.refuses($$ select public.add_product_fact(test.id('oil'), 'claim', 'Price', 'Nå 99,-', null, now() - interval '1 day') $$,
  'invalid', 'a date that has passed is refused');
select test.keep('px3', (public.add_product_fact(test.id('oil'), 'claim', 'Origin', 'Pressed in Lysne') ->> 'id')::uuid);
select test.ok((select valid_until is null from public.product_facts where id = test.id('px3')), 'a claim that is no price does not run out');

select test.act('william@fumecreatives.com');
select test.refuses($$ select public.set_fact_until(test.id('px1'), now() + interval '60 days') $$, 'forbidden', 'only the brand makes a price hold longer');
select test.ok((public.set_fact_until(test.id('px1'), now() + interval '2 days') ->> 'id')::uuid = test.id('px1'), 'Fume''s people may bring the date closer');
select test.act('marcus+lysne@fumecreatives.com');
select test.refuses($$ select public.set_fact_until(test.id('px1'), null) $$, 'invalid', 'a price always holds until a date');
select test.ok((public.set_fact_until(test.id('px1'), now() + interval '30 days') ->> 'id')::uuid = test.id('px1'), 'the brand sets a new date');

-- A creative whose planned words rely on the price.
reset role;
create temp table t9ze as select pv.id, pv.body from public.plan_versions pv
  where pv.campaign_id = test.id('c2') and pv.state = 'approved' order by pv.version desc limit 1;
update public.plan_versions pv set body = jsonb_set(pv.body, '{planned_creatives}', (
  select jsonb_agg(case when pc ->> 'id' = (select slot from public.creatives where id = test.id('m'))
    then pc || jsonb_build_object('claimRefs', jsonb_build_array(test.id('px1'))) else pc end)
  from jsonb_array_elements(pv.body -> 'planned_creatives') pc))
where pv.id = (select id from t9ze);
select test.ok(cardinality(app.expired_claims(test.id('m'))) = 0, 'a price that holds is no problem');
update public.product_facts set valid_until = now() - interval '1 hour' where id = test.id('px1');
select test.ok((app.expired_claims(test.id('m')))[1] like 'Price (Nå 249,- (før 399,-)), ran out on %', 'the master''s words rely on a price that ran out');
select test.ok(cardinality(app.expired_claims(test.id('sq'))) = 1, 'and so does its square format');
select test.refuses($$ update public.creative_versions set state = 'delivered' where id = test.id('mv3') $$, 'invalid',
  'an approved master with a price that ran out is not delivered');
select test.refuses($$ update public.creative_versions set state = 'checked' where creative_id = test.id('sq') and state = 'in_check' $$,
  'invalid', 'nor is its format checked');
select test.ok(not exists (select 1 from public.product_facts f where f.id = test.id('px1') and app.fact_live(f.valid_until)),
  'the plan writer is not given it');

update public.product_facts set valid_until = now() + interval '30 days' where id = test.id('px1');
select test.ok(cardinality(app.expired_claims(test.id('m'))) = 0, 'with the brand''s new date it holds again');
update public.plan_versions set body = (select body from t9ze) where id = (select id from t9ze);

set role authenticated;
select test.ok(true, 'all of the price expiry tests passed');
