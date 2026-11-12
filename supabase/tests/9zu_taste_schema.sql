-- The taste schema, kept (20261110070000_taste_schema.sql): a reading per picture, the brand's profile, and the
-- direction the Engine and the plan writer are handed. Fume's people read them; a customer never does.

reset role;
select test.keep('tr1', public.taste_reading_save(test.id('lysne'),
  '{"source": "brand", "ref": "ad-1", "campaign": "winter", "schema_version": 1, "reader": "gpt-terra", "shows": {"people": true},
    "measured": {"finish.grain_overall": 0.4}, "read": {"camera.height": "eye"}, "cost_usd": 0.0156}'));
select test.ok((select reader = 'gpt-terra' and read ->> 'camera.height' = 'eye' and cost_usd = 0.0156 and campaign = 'winter'
  from public.taste_readings where id = test.id('tr1')), 'a reading keeps what was measured and what was read');
select test.ok(public.taste_reading_save(test.id('lysne'),
  '{"source": "brand", "ref": "ad-1", "schema_version": 1, "measured": {"finish.grain_overall": 0.5}}') = test.id('tr1'),
  'the same picture read again is the same reading');
select test.ok((select measured ->> 'finish.grain_overall' = '0.5' and read ->> 'camera.height' = 'eye' and reader = 'gpt-terra'
  and shows ->> 'people' = 'true' and campaign = 'winter' from public.taste_readings where id = test.id('tr1')),
  'a half that is not sent keeps what was there');
select test.ok(public.taste_reading_save(test.id('lysne'),
  '{"source": "engine", "ref": "ad-1", "schema_version": 1, "read": {"camera.height": "knee"}}') <> test.id('tr1'),
  'the Engine''s picture of the same name is another reading');
select test.ok((select jsonb_array_length(c -> 'brand') = 1 and jsonb_array_length(c -> 'engine') = 1
  and c -> 'brand' -> 0 ->> 'id' = 'ad-1' and c -> 'brand' -> 0 ->> 'campaign' = 'winter'
  and c -> 'brand' -> 0 -> 'measured' ->> 'finish.grain_overall' = '0.5'
  and c -> 'engine' -> 0 -> 'read' ->> 'camera.height' = 'knee' and not (c -> 'engine' -> 0) ? 'campaign'
  from public.taste_cards(test.id('lysne'), 1) c), 'the cards come back, the brand''s and the Engine''s apart');
select test.ok((select c = '{"brand": [], "engine": []}' from public.taste_cards(test.id('lysne'), 2) c),
  'a reading against another version of the schema is not counted');
select test.refuses($$ select public.taste_reading_save(test.id('lysne'), '{"source": "web", "ref": "x", "schema_version": 1}') $$,
  'invalid', 'a reading says whose picture it is');
select test.refuses($$ select public.taste_reading_save(test.id('lysne'), '{"source": "brand", "ref": "x"}') $$,
  'invalid', 'and which schema it was read against');

-- A picture of another brand is never kept under this one.
do $$
declare s uuid;
begin
  insert into public.taste_signals (workspace_id, verdict, origin, image_url)
  values (test.id('solv'), 'liked', 'upload', 'https://example.com/solv.jpg') returning id into s;
  perform test.keep('ts_solv', s);
end $$;
select test.refuses(format($$ select public.taste_reading_save(test.id('lysne'),
  '{"source": "brand", "ref": "theirs", "schema_version": 1, "signal_id": "%s"}') $$, test.id('ts_solv')),
  'not_found', 'a picture of another brand is refused');

-- The profile and the direction.
select public.taste_profile_save(test.id('lysne'), '{"schema_version": 1, "profile": {"version": 1, "pictures": 12, "campaigns": 2, "fields": {}},
  "engine": {"version": 1, "pictures": 6, "campaigns": 0, "fields": {}}, "score": {"score": 41, "parts": [], "next": []},
  "direction": {"schema": 1, "pictures": 12, "lines": [{"key": "camera.height", "says": "Camera, height: eye"}], "targets": [], "choices": [], "never": []}}');
select test.ok((select score = 41 and pictures = 12 and campaigns = 2 and engine_pictures = 6 from public.taste_profiles
  where workspace_id = test.id('lysne')), 'the profile is kept with its score');
select public.taste_profile_save(test.id('lysne'), '{"schema_version": 1, "profile": {"version": 1, "pictures": 13, "campaigns": 2, "fields": {}},
  "score": {"score": 43, "parts": [], "next": []},
  "direction": {"schema": 1, "pictures": 13, "lines": [{"key": "camera.height", "says": "Camera, height: eye"}], "targets": [], "choices": [], "never": []}}');
select test.ok((select score = 43 and pictures = 13 and engine is null and engine_pictures = 0 and count(*) over () = 1
  from public.taste_profiles where workspace_id = test.id('lysne')), 'counted again, it replaces the one before');
select test.refuses($$ select public.taste_profile_save(test.id('lysne'), '{"schema_version": 1, "profile": {}}') $$,
  'invalid', 'a profile without its score and direction is refused');
select test.ok(public.taste_direction_of_campaign(test.id('campaign')) -> 'lines' -> 0 ->> 'says' = 'Camera, height: eye',
  'the plan writer is handed the brand''s direction');
select test.ok((select public.engine_taste(j.id) ->> 'pictures' = '13' from public.production_jobs j
  where j.workspace_id = test.id('lysne') limit 1) is not false, 'and so is the Engine, for a job of the brand');
select test.ok(public.taste_direction_of_campaign(gen_random_uuid()) is null, 'a brand without a profile gives none');

-- Fume's people on the brand read the Engine's workings; a customer never does.
set role authenticated;
select test.act('kristian@fumecreatives.com');
select test.ok((select count(*) = 2 from public.taste_readings where workspace_id = test.id('lysne'))
  and (select count(*) = 1 from public.taste_profiles where workspace_id = test.id('lysne')), 'Fume''s people on the brand read its readings and its profile');
select test.act('marcus+lysne@fumecreatives.com');
select test.ok((select count(*) = 0 from public.taste_readings) and (select count(*) = 0 from public.taste_profiles),
  'a customer reads neither');
select test.ok(not has_function_privilege('authenticated', 'public.taste_reading_save(uuid, jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.taste_profile_save(uuid, jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.taste_cards(uuid, int)', 'execute')
  and not has_function_privilege('authenticated', 'public.engine_taste(uuid)', 'execute'), 'only the Engine writes them');

reset role;
delete from public.taste_readings where workspace_id = test.id('lysne');
delete from public.taste_profiles where workspace_id = test.id('lysne');
delete from public.taste_signals where id = test.id('ts_solv');
set role authenticated;
select test.ok(true, 'all of the taste schema tests passed');
