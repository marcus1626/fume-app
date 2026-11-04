-- Product Truth from the product's page and pictures (20261105010000_product_truth.sql): Fume proposes, the brand
-- confirms, and a claim is kept only with a page behind it.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;
insert into public.products (id, workspace_id, name) values ('0e000000-0000-4000-8000-0000000000a7', test.id('lysne'), 'Night Balm');
select test.keep('balm', '0e000000-0000-4000-8000-0000000000a7');
insert into public.sources (id, workspace_id, kind, name, url, product_id)
values ('0d000000-0000-4000-8000-0000000000a1', test.id('lysne'), 'website', 'lysne.example/balm', 'https://lysne.example/balm', test.id('balm')),
       ('0d000000-0000-4000-8000-0000000000a2', test.id('lysne'), 'packshot', 'balm.jpg', 'https://lysne.example/balm.jpg', test.id('balm'));
set role authenticated;

select test.ok(not has_function_privilege('authenticated', 'public.product_truth_take(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.product_truth_finish(uuid, jsonb, jsonb, jsonb)', 'execute'),
  'only the reader takes and hands back a reading');
select test.act('user+solv@fumecreatives.com');
select test.refuses($$ select public.ask_product_truth(test.id('balm')) $$, 'not_found', 'someone off the brand asks for nothing');
select test.act('marcus+lysne@fumecreatives.com');
select test.ok(public.ask_product_truth(test.id('balm')) ->> 'reading' = 'false', 'the brand asks Fume to read its product');

reset role;
do $$
declare t jsonb := public.product_truth_take(test.id('balm'));
begin
  perform test.keep('trun', (t ->> 'run_id')::uuid);
  perform test.ok(t #>> '{pages,0,url}' = 'https://lysne.example/balm' and t #>> '{pictures,0,url}' = 'https://lysne.example/balm.jpg'
    and t #>> '{product,name}' = 'Night Balm', 'the reader gets the product, its page and its pictures');
  perform test.ok(public.product_truth_take(test.id('balm')) is null, 'and a reading under way is not taken twice');
end $$;
set role authenticated;
select test.act('marcus+lysne@fumecreatives.com');
select test.ok(public.ask_product_truth(test.id('balm')) ->> 'reading' = 'true', 'the brand sees that Fume is reading');
reset role;
select test.ok((public.product_truth_finish(test.id('trun'), jsonb_build_array(
    jsonb_build_object('area', 'shape', 'label', 'Jar shape', 'statement', 'A low round glass jar.', 'source_id', '0d000000-0000-4000-8000-0000000000a2', 'where', 'Picture 1'),
    jsonb_build_object('area', 'claim', 'label', 'Evening', 'statement', 'For the hour before sleep.', 'source_id', '0d000000-0000-4000-8000-0000000000a1', 'where', 'Page: https://lysne.example/balm'),
    jsonb_build_object('area', 'claim', 'label', 'No page', 'statement', 'Clinically proven.'),
    jsonb_build_object('area', 'poster', 'label', 'x', 'statement', 'x'),
    jsonb_build_object('area', 'shape', 'label', 'Jar shape', 'statement', 'a low round glass jar.')),
  '{"dropped":[],"unclear":["The lid"]}', '{"model":"claude-haiku-5-5","cost_usd":0.0009}') ->> 'added')::int = 2,
  'a claim without its page, an unknown area and the same fact twice are left out');
select test.ok((select status = 'unverified' and origin = 'inferred' and required and source_location = 'Picture 1'
    from public.product_facts where product_id = test.id('balm') and area = 'shape')
  and (select not required from public.product_facts where product_id = test.id('balm') and area = 'claim'),
  'every proposal waits for the brand; what a picture must get right is required');
select test.ok((select cost_usd = 0.0009 and output -> 'unclear' ->> 0 = 'The lid' from public.task_runs where id = test.id('trun')),
  'the reading keeps what it cost and what it could not tell');
select test.refuses($$ select public.product_truth_finish(test.id('trun'), '[]', '{}', '{}') $$, 'conflict', 'a reading is handed back once');

set role authenticated;
select test.act('marcus+lysne@fumecreatives.com');
select public.verify_product(test.id('balm'));
select test.ok(not exists (select 1 from public.product_facts where product_id = test.id('balm') and status <> 'verified'),
  'the brand confirms the product, and with it what Fume read');

select test.ok(true, 'all of the product truth tests passed');
