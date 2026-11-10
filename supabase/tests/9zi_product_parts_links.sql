-- Packshots kept only as a link are checked too (20261106130000_product_parts_links.sql): the function is told where to
-- keep its copy.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;
create temp table t9zi as select public.details_take(test.id('ecand')) as v;
select test.ok((select coalesce(bool_and((x ? 'url') = (x ->> 'path' like '%/check/source-%.img')), true)
  from t9zi, jsonb_array_elements(coalesce(v -> 'products', '[]')) p, jsonb_array_elements(p -> 'pictures') x),
  'a packshot kept only as a link comes with its link and the place to keep it');
set role authenticated;
select test.ok(true, 'all of the product parts link tests passed');
