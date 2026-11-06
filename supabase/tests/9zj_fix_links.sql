-- «Fix with the real product» for every product (20261106140000_fix_links_and_parts.sql): a packshot kept only as a
-- link reaches the fix, and two parts of one picture are two fixes.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;
-- A packshot kept only as a link to the brand's site, of a product in the candidate's campaign.
create temp table t9zj (k text primary key, v jsonb);
with s as (
  insert into public.sources (workspace_id, kind, name, url, product_id, slot)
  select pr.workspace_id, 'packshot', 'site-front', 'https://example.com/front.jpg', pr.id, 'detail'
  from public.candidates c join public.production_jobs j on j.id = c.job_id
  join public.campaign_products cp on cp.campaign_id = j.campaign_id join public.products pr on pr.id = cp.product_id
  where c.id = test.id('ecand') order by pr.name limit 1
  returning *)
insert into t9zj select 'src', to_jsonb(s) from s;
select test.ok(exists (select 1 from t9zj where k = 'src'), 'the candidate''s campaign has a product');

set role authenticated;
select test.act('marcus@fumecreatives.com');
select test.keep('fx3', (public.fix_candidate(test.id('ecand'), '{"x":0.5,"y":0.3,"w":0.1,"h":0.06}', 'The cap is red') ->> 'id')::uuid);
select test.keep('fx4', (public.fix_candidate(test.id('ecand'), '{"x":0.2,"y":0.6,"w":0.1,"h":0.1}', 'The pocket is missing') ->> 'id')::uuid);
select test.ok(test.id('fx3') <> test.id('fx4'), 'two parts of one picture are two fixes');
select test.ok((public.fix_candidate(test.id('ecand'), '{"x":0.2,"y":0.6,"w":0.1,"h":0.1}', 'The pocket is missing') ->> 'id')::uuid
  = test.id('fx4'), 'the same part asked again with the same words is the same fix');

reset role;
insert into t9zj values ('take', public.fix_take(test.id('fx3')));
select test.ok((select bool_or(x ->> 'url' = 'https://example.com/front.jpg'
    and x ->> 'path' = (s.v ->> 'workspace_id') || '/check/source-' || (s.v ->> 'id') || '.img'
    and x ->> 'bucket' = 'workspace-files')
  from t9zj t, t9zj s, jsonb_array_elements(t.v -> 'products') p, jsonb_array_elements(p -> 'pictures') x
  where t.k = 'take' and s.k = 'src'),
  'a packshot kept only as a link reaches the fix, with the place the picture check keeps it');
select test.ok((select bool_and(not (x ? 'url') or x ->> 'path' like '%/check/source-%.img')
  from t9zj t, jsonb_array_elements(t.v -> 'products') p, jsonb_array_elements(p -> 'pictures') x where t.k = 'take'),
  'a photograph in Fume''s storage comes without a link');

select public.fix_fail(x.id, 'test', 0) from public.picture_fixes x where x.id in (test.id('fx3'), test.id('fx4'));
delete from public.sources where id = (select (v ->> 'id')::uuid from t9zj where k = 'src');
set role authenticated;
select test.ok(true, 'all of the fix link tests passed');
