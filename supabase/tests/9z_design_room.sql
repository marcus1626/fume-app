-- Where the Engine left room for the words (20261105090000_design_room.sql): the design layer is told, so the layout
-- looks there first.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;

create temp table t9z (k text primary key, v jsonb);
insert into public.brand_books (workspace_id, kind, version, state, body)
values (test.id('lysne'), 'design', 21, 'approved', '{"summary":"Calm","styles":[{"name":"h1"}],"colours":[{"hex":"#111111","role":"text"}]}');
-- A picture made under the hard rule "room-for-words".
insert into public.engine_prompts (workspace_id, job_id, attempt_id, hash, status, image_model, compile_package)
select c.workspace_id, c.job_id, c.attempt_id, 'h-room', 'validated', 'nano-banana-pro',
  '{"requirements":[{"id":"room-for-words","binding":"hard","statement":"Compose the frame so the product sits whole in the top 68% of the frame''s height; the bottom 32% of the height is bare."}]}'
from public.candidates c where c.id = test.id('ecand');
insert into public.design_layers (workspace_id, candidate_id, job_id, creative_id, requested_by, ask)
select workspace_id, candidate_id, job_id, creative_id, requested_by, 'room test' from public.design_layers where id = test.id('dl');
select test.keep('dlr', (select id from public.design_layers where ask = 'room test'));
insert into t9z values ('take', public.design_take(test.id('dlr')));
select test.ok((select v ->> 'room' like '%the bottom 32% of the height%' from t9z where k = 'take'),
  'the layer is told where the Engine left room for the words');

-- A picture made without the rule has no room to look at first.
delete from public.engine_prompts where hash = 'h-room';
update public.design_layers set started_at = null where id = test.id('dlr');
insert into t9z values ('none', public.design_take(test.id('dlr')));
select test.ok((select v -> 'room' = 'null'::jsonb or v -> 'room' is null from t9z where k = 'none'), 'no rule, no room');

delete from public.brand_books where workspace_id = test.id('lysne') and kind = 'design' and version = 21;
set role authenticated;
select test.ok(true, 'all of the design room tests passed');
