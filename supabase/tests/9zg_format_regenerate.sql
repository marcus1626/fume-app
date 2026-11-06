-- The third way to make a format (20261106100000_format_regenerate.sql): the designer asks for the picture to be drawn
-- again in the new shape, and the function gets the product's own photographs for it.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
set role authenticated;

select test.act('marcus@fumecreatives.com');
select test.refuses($$ select public.make_format(test.id('st'), 'stretch') $$, 'invalid', 'crop, expand or regenerate');
select test.refuses($$ select public.make_format(test.id('st'), 'regenerate', '{"x":0,"y":0,"w":1,"h":0.5}') $$, 'invalid',
  'a window is only for a crop');
select test.keep('fr', (public.make_format(test.id('st'), 'regenerate') ->> 'id')::uuid);
select test.ok((select asked = 'regenerate' from public.format_makes where id = test.id('fr')), 'the designer asks for it');

reset role;
create temp table t9zg (k text primary key, v jsonb);
insert into t9zg values ('take', public.format_take(test.id('fr')));
select test.ok((select v ->> 'asked' = 'regenerate' and jsonb_typeof(v -> 'products') = 'array' from t9zg where k = 'take'),
  'the function is told to draw it again, with the campaign''s products');
select test.ok((select coalesce(bool_and(jsonb_array_length(p -> 'pictures') <= 2), true)
  from t9zg, jsonb_array_elements(v -> 'products') p where k = 'take'), 'at most two photographs of each product');
insert into t9zg values ('res', public.format_finish(test.id('fr'), jsonb_build_object(
  'png', jsonb_build_object('path', test.id('lysne') || '/format/' || test.id('fr') || '.png', 'bytes', 900, 'sha256', 'bb'),
  'width', 1536, 'height', 2731, 'method', 'regenerate', 'why', 'Redrawn in the new shape, as the designer chose.',
  'prompt', 'Draw it again', 'model', 'nano-banana-pro', 'cost_cents', 15, 'llm_usd', 0.003, 'ms', 50000)));
select test.ok((select c.note like 'Redrawn from the master:%' and c.origin = 'engine'
  from public.candidates c where c.id = (select (v ->> 'candidate_id')::uuid from t9zg where k = 'res')),
  'the redrawn format is a candidate that says it was drawn again');
select test.ok((select state = 'made' and method = 'regenerate' from public.format_makes where id = test.id('fr')), 'the make keeps the method');
select test.ok(public.task_model('regenerate') = 'nano-banana-pro', 'the redraw names its image model');

set role authenticated;
select test.ok(true, 'all of the format regenerate tests passed');
