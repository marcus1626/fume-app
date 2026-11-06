-- A fact the brand states itself (20261105080000_add_product_fact.sql), such as this week's price.

\set ON_ERROR_STOP 1
set client_min_messages = notice;

select test.act('marcus+lysne@fumecreatives.com');
select test.keep('pf1', (public.add_product_fact(test.id('oil'), 'claim', 'Price', 'Nå 199,- (før 399,-), kun online') ->> 'id')::uuid);
select test.ok((select status = 'verified' from public.product_facts where id = test.id('pf1')), 'the brand''s owner states a fact as true');
select test.refuses($$ select public.add_product_fact(test.id('oil'), 'price', 'Price', '199,-') $$, 'invalid', 'an unknown area is refused');
select test.refuses($$ select public.add_product_fact(test.id('oil'), 'claim', '', '199,-') $$, 'invalid', 'a fact needs a label');

select test.act('member+lysne@fumecreatives.com');
select test.keep('pf2', (public.add_product_fact(test.id('oil'), 'claim', 'Price', 'Nå 149,-') ->> 'id')::uuid);
select test.ok((select status = 'unverified' from public.product_facts where id = test.id('pf2')), 'a member''s fact waits for the brand to verify it');

select test.act('user+solv@fumecreatives.com');
select test.refuses($$ select public.add_product_fact(test.id('oil'), 'claim', 'Price', '1,-') $$, 'not_found', 'another brand cannot add to this product');

reset role;
delete from public.product_facts where id in (test.id('pf1'), test.id('pf2'));
set role authenticated;
select test.ok(true, 'all of the add product fact tests passed');
