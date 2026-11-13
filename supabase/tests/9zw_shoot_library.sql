-- Storage/rights only: no vision worker or campaign production is needed to enforce these boundaries.
reset role;
select test.act('marcus+lysne@fumecreatives.com');
insert into public.files(id, workspace_id, path, name, content_type, bytes, purpose, uploaded_by)
values(gen_random_uuid(), test.id('lysne'), test.id('lysne') || '/shoot-test.jpg', 'shoot-test.jpg', 'image/jpeg', 20,
  'source', auth.uid()) returning test.keep('shoot_original', id);
set role authenticated;
select test.keep('own_shoot', (public.add_shoot(test.id('lysne'), ' Studio day ', null,
  '{"people":"unsure", "photographer":" Ola "}',
  jsonb_build_array(jsonb_build_object('fileId', test.id('shoot_original'), 'kind', 'photo'))) ->> 'id')::uuid);
select test.ok((public.get_shoot(test.id('own_shoot')) ->> 'name') = 'Studio day', 'customer creates a named shoot');
select test.ok((select people = 'unsure' and not consent_yes and photographer = 'Ola' from public.shoots where id = test.id('own_shoot')),
  'unknown people are recorded without consent');
select test.ok((public.get_shoot(test.id('own_shoot')) -> 'pictures' -> 0 ->> 'fileId') = test.id('shoot_original')::text,
  'customer reads their original through the library');
select test.ok(not has_table_privilege('service_role', 'public.shoots', 'select')
  and not has_table_privilege('service_role', 'public.shoot_pictures', 'select')
  and has_function_privilege('service_role', 'public.shoot_read_input(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.shoot_read_input(uuid)', 'execute'),
  'edge reads use service-only security definer functions, with no table grants');

reset role;
-- Classification is internal until the expert's check, including direct PostgREST reads.
update public.shoot_pictures set engine_read = '{"sort":"pick","why":"Sharp, even light.","sharp":true}'
where shoot_id = test.id('own_shoot');
set role authenticated;
select test.ok(not (public.get_shoot(test.id('own_shoot')) -> 'pictures' -> 0 ? 'read'), 'unchecked Engine read stays hidden');
select test.ok((select count(*) = 0 from public.shoot_pictures where shoot_id = test.id('own_shoot')),
  'customer cannot bypass redaction through the picture table');
select public.update_shoot_rights(test.id('own_shoot'), '{"people":"released", "until":"2099-01-01"}');
select test.ok((select people = 'released' and consent_yes and rights_by = auth.uid() and rights_at is not null
  from public.shoots where id = test.id('own_shoot')), 'a recorded release yes is enough, with who and when');
select public.update_shoot_rights(test.id('own_shoot'), '{"people":"unsure"}');

reset role;
select test.refuses($$select public.shoot_use_input(test.id('own_shoot'))$$, 'invalid', 'unknown people block production input');
select test.ok(public.shoot_read_input(test.id('own_shoot')) -> 'pictures' -> 0 ->> 'path' is not null,
  'assessment still reads originals through its service function');
set role authenticated;
select test.act('kristian@fumecreatives.com');
select test.ok(public.get_shoot(test.id('own_shoot')) -> 'pictures' -> 0 ? 'read', 'Fume sees the pending assessment');
-- Even an existing production command cannot turn an unsure original into a version.
reset role;
select test.refuses($$insert into public.creative_versions(workspace_id, creative_id, number, state, file_id)
  select test.id('lysne'), id, 99999, 'making', test.id('shoot_original') from public.creatives
  where workspace_id = test.id('lysne') limit 1$$, 'invalid', 'direct production inserts also obey shoot rights');
set role authenticated;
select public.update_shoot_rights(test.id('own_shoot'), '{"people":"none", "until":"2000-01-01"}');
reset role;
select test.refuses($$select public.shoot_use_input(test.id('own_shoot'))$$, 'invalid', 'an expired licence blocks production too');
set role authenticated;
select public.update_shoot_rights(test.id('own_shoot'), '{"people":"none"}');
reset role;
create temporary table shoot_saved_role as
  select user_id, workspace_id, role from public.memberships
  where user_id = (select id from public.profiles where email = 'marcus+lysne@fumecreatives.com')
    and workspace_id = test.id('lysne');
update public.memberships set role = 'viewer' where (user_id, workspace_id) in (select user_id, workspace_id from shoot_saved_role);
set role authenticated;
select test.act('marcus+lysne@fumecreatives.com');
select test.refuses($$select public.update_shoot_rights(test.id('own_shoot'), '{"people":"released"}')$$, 'forbidden',
  'a viewer cannot change a release answer');
select test.act('marcus@fumecreatives.com');
select test.ok(public.get_shoot(test.id('own_shoot')) ->> 'id' is not null, 'admin reads the Library');
select test.refuses($$select public.update_shoot_rights(test.id('own_shoot'), '{"people":"released"}')$$, 'forbidden',
  'admin reads but does not edit rights');
reset role;
update public.memberships m set role = s.role from shoot_saved_role s where m.user_id = s.user_id and m.workspace_id = s.workspace_id;
drop table shoot_saved_role;
set role authenticated;
select test.act('user+solv@fumecreatives.com');
select test.refuses($$select public.get_shoot(test.id('own_shoot'))$$, 'not_found', 'other workspaces cannot open a shoot');
select test.refuses($$select public.update_shoot_rights(test.id('own_shoot'), '{"people":"released"}')$$, 'not_found',
  'other workspaces cannot edit rights');
reset role;
delete from public.shoot_pictures where shoot_id = test.id('own_shoot');
delete from public.shoots where id = test.id('own_shoot');
delete from public.files where id = test.id('shoot_original');
set role authenticated;

-- A source can be linked before it becomes a shoot original. Production must use current rights,
-- not the rights (or lack of a shoot) at add_source time. Roll back each take so retries/budgets
-- and the shared Engine fixtures stay unchanged.
reset role;
begin;
select test.act('marcus+lysne@fumecreatives.com');
insert into public.files(workspace_id, path, name, content_type, bytes, purpose, uploaded_by)
values(test.id('lysne'), test.id('lysne') || '/shoot-packshot.jpg', 'shoot-packshot.jpg', 'image/jpeg', 20,
  'source', auth.uid()) returning test.keep('shoot_packshot_file', id);
insert into public.files(workspace_id, path, name, content_type, bytes, purpose, uploaded_by)
values(test.id('lysne'), test.id('lysne') || '/ordinary-packshot.jpg', 'ordinary-packshot.jpg', 'image/jpeg', 20,
  'source', auth.uid()) returning test.keep('ordinary_packshot_file', id);
set role authenticated;
select public.add_source(test.id('lysne'), 'packshot', 'Shoot packshot', test.id('shoot_packshot_file'), test.id('oil'), 'shoot-test');
select public.add_source(test.id('lysne'), 'packshot', 'Ordinary packshot', test.id('ordinary_packshot_file'), test.id('oil'), 'ordinary-test');
reset role;
insert into public.sources(workspace_id, kind, name, url, product_id, slot)
values(test.id('lysne'), 'packshot', 'Website packshot', 'https://lysne.example/shoot-rights-control.jpg', test.id('oil'), 'website-test');
update public.production_jobs set state = 'queued', tries_from = (
  select coalesce(max(number), 0) from public.job_attempts where job_id = test.id('ej'))
where id = test.id('ej');

create function pg_temp.check_shoot_packshot(p_expected boolean, p_what text) returns void
language plpgsql as $$
declare t jsonb; pictures jsonb;
begin
  t := public.engine_take(test.id('ej'));
  perform test.ok(t #>> '{run,attempt_id}' is not null, 'rights test takes a real production task');
  select jsonb_agg(pic) into pictures from jsonb_array_elements(t -> 'products') pr,
    jsonb_array_elements(pr -> 'pictures') pic where pr ->> 'id' = test.id('oil')::text;
  perform test.ok(exists (select 1 from jsonb_array_elements(pictures) pic
    where pic ->> 'path' = test.id('lysne') || '/shoot-packshot.jpg') = p_expected, p_what);
  perform test.ok(exists (select 1 from jsonb_array_elements(pictures) pic
    where pic ->> 'path' = test.id('lysne') || '/ordinary-packshot.jpg')
    and exists (select 1 from jsonb_array_elements(pictures) pic
      where pic ->> 'url' = 'https://lysne.example/shoot-rights-control.jpg'),
    'ordinary uploaded and website packshots remain available');
end $$;
savepoint before_take;
select pg_temp.check_shoot_packshot(true, 'an ordinary source is usable before it belongs to a shoot');
rollback to before_take;
set role authenticated;
select test.keep('packshot_shoot', (public.add_shoot(test.id('lysne'), 'Product shoot', null,
  '{"people":"unsure"}', jsonb_build_array(jsonb_build_object('fileId', test.id('shoot_packshot_file'), 'kind', 'photo'))) ->> 'id')::uuid);
reset role;
savepoint before_take;
select pg_temp.check_shoot_packshot(false, 'add_source then add_shoot cannot bypass unsure people in engine_take');
rollback to before_take;
set role authenticated;
select public.update_shoot_rights(test.id('packshot_shoot'), '{"people":"none", "until":"2000-01-01"}');
reset role;
savepoint before_take;
select pg_temp.check_shoot_packshot(false, 'a linked original with an expired usage period is omitted');
rollback to before_take;
set role authenticated;
select public.update_shoot_rights(test.id('packshot_shoot'), jsonb_build_object('people', 'released', 'until', current_date));
reset role;
savepoint before_take;
select pg_temp.check_shoot_packshot(true, 'recorded consent permits a linked original through its last usable day');
rollback to before_take;
set role authenticated;
select public.update_shoot_rights(test.id('packshot_shoot'), '{"people":"unsure"}');
reset role;
savepoint before_take;
select pg_temp.check_shoot_packshot(false, 'tightening people rights after linking removes the original from production');
rollback to before_take;
set role authenticated;
select public.update_shoot_rights(test.id('packshot_shoot'), '{"people":"none"}');
reset role;
savepoint before_take;
select pg_temp.check_shoot_packshot(true, 'no people and no expiry permits the linked original again');
rollback to before_take;
set role authenticated;
select public.update_shoot_rights(test.id('packshot_shoot'), '{"people":"none", "until":"2000-01-01"}');
reset role;
savepoint before_take;
select pg_temp.check_shoot_packshot(false, 'tightening the usage period after linking removes the original from production');
rollback to before_take;
rollback;
set role authenticated;

-- The only design-layer information a customer gets is the kind of a sent version.
-- Keep these fixtures isolated from the rest of the shared rule-test session.
reset role;
begin;
select test.act('marcus+lysne@fumecreatives.com');
insert into public.candidates(workspace_id, job_id, file_id, origin)
select workspace_id, job_id, file_id, 'manual' from public.candidates where id = test.id('ecand')
returning test.keep('library_candidate', id);
insert into public.creatives(workspace_id, campaign_id, kind, format, name, title)
select test.id('lysne'), id, 'master', 'feed', 'library-kind-test', 'Library kind test'
from public.campaigns where workspace_id = test.id('lysne') limit 1
returning test.keep('library_kind_creative', id);
insert into public.creatives(workspace_id, campaign_id, kind, format, name, title)
select workspace_id, id, 'master', 'feed', 'library-other-test', 'Other workspace'
from public.campaigns where workspace_id <> test.id('lysne') limit 1
returning test.keep('library_other_creative', id);
insert into public.creative_versions(workspace_id, creative_id, number, state, candidate_id, sent_at)
values (test.id('lysne'), test.id('library_kind_creative'), 1, 'approved', test.id('library_candidate'), now())
returning test.keep('library_design', id);
insert into public.creative_versions(workspace_id, creative_id, number, state, sent_at)
values (test.id('lysne'), test.id('library_kind_creative'), 2, 'delivered', now())
returning test.keep('library_picture', id);
insert into public.creative_versions(workspace_id, creative_id, number, state, candidate_id)
values (test.id('lysne'), test.id('library_kind_creative'), 3, 'approved', test.id('library_candidate'))
returning test.keep('library_unsent', id);
insert into public.creative_versions(workspace_id, creative_id, number, state, sent_at)
select workspace_id, id, 1, 'approved', now() from public.creatives where id = test.id('library_other_creative')
returning test.keep('library_other', id);
insert into public.design_layers(workspace_id, candidate_id, job_id, creative_id, state, result_candidate_id,
  choice, words, layout)
select workspace_id, id, job_id, test.id('library_kind_creative'), 'made', id,
  '{"private":"choice"}', '{"private":"words"}', '{"private":"layout"}'
from public.candidates where id = test.id('library_candidate');
set role authenticated;
select test.ok((select kind = 'design' from public.library_version_kinds(array[test.id('library_design')])),
  'a sent design is classified as design');
select test.ok((select kind = 'picture' from public.library_version_kinds(array[test.id('library_picture')])),
  'a sent picture is classified as picture');
select test.ok((select count(*) = 0 from public.library_version_kinds(array[test.id('library_unsent'), test.id('library_other')])),
  'unsent versions and another workspace are not returned');
select test.ok((select to_jsonb(k) = jsonb_build_object('version_id', test.id('library_design'), 'kind', 'design')
  from public.library_version_kinds(array[test.id('library_design')]) k),
  'the customer gets only version id and kind, no design-layer details');
select test.ok((select count(*) = 0 from public.design_layers where creative_id = test.id('library_kind_creative')),
  'the kind lookup does not open direct design-layer reads');
select test.ok(has_function_privilege('authenticated', 'public.library_version_kinds(uuid[])', 'execute')
  and not has_function_privilege('anon', 'public.library_version_kinds(uuid[])', 'execute'),
  'only authenticated callers may use the kind lookup');
reset role;
select test.ok((select prosecdef and proconfig @> array['search_path=""']
  from pg_proc where oid = 'public.library_version_kinds(uuid[])'::regprocedure),
  'the kind lookup uses security definer with an empty search path');
update public.design_layers set state = 'designing' where creative_id = test.id('library_kind_creative');
set role authenticated;
select test.ok((select kind = 'picture' from public.library_version_kinds(array[test.id('library_design')])),
  'an unfinished design layer does not make a version a design');
reset role;
rollback;
set role authenticated;
