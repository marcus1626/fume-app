-- The Brand DNA board (20261103150000_brand_identity.sql): a reading proposes, she keeps, changes or removes, and
-- approves; a reading again keeps what she decided; a change after approval goes into a new draft. On the agency's
-- client from 97_agency.sql.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
set role authenticated;

select test.act('nora@brygga.test');
select test.keep('scan', (public.save_brand_scan(test.id('client'), 'https://halm.test', jsonb_build_object(
  'colours', jsonb_build_array(
    jsonb_build_object('id', 'c-oak', 'name', 'Oak', 'hex', '#A0784B', 'role', 'primary', 'usage', 'Most used on halm.test'),
    jsonb_build_object('id', 'c-ink', 'name', 'Ink', 'hex', '#1A1A1A', 'role', 'text', 'usage', 'Text')),
  'typefaces', jsonb_build_array(jsonb_build_object('id', 't-1', 'name', 'Canela', 'role', 'display', 'cssFamily', 'serif',
    'weights', jsonb_build_array('400'), 'sample', 'Halm', 'usage', 'Headlines')),
  'logos', '[]'::jsonb, 'voice', jsonb_build_array(jsonb_build_object('id', 'v-1', 'statement', 'Calm and plain', 'example', 'One chair, for good')),
  'imagery', jsonb_build_array(jsonb_build_object('id', 'i-1', 'image', 'https://halm.test/a.jpg', 'caption', 'Chair at dusk')),
  'voiceBook', jsonb_build_object('parts', jsonb_build_array(jsonb_build_object('id', 'speak', 'found', 'Calm', 'provenance',
    jsonb_build_object('origin', 'engine', 'state', 'proposed')))))) ->> 'id')::uuid);
select test.ok((select state = 'draft' and jsonb_array_length(identity -> 'colours') = 2
    and identity #>> '{colours,0,provenance,state}' = 'proposed'
  from public.brand_dna_versions where workspace_id = test.id('client')), 'a reading proposes the brand in a draft');
select test.ok(exists (select 1 from public.sources where workspace_id = test.id('client') and kind = 'website'),
  'and keeps the website as a source');
select test.refuses($$ select public.decide_identity(test.id('client'), 'colour', 'c-oak', 'keep') $$, 'forbidden',
  'the agency proposes; only the client decides');
select test.ok((public.add_identity_item(test.id('client'), 'logo', '{"name": "Halm", "wordmark": "HALM", "use": "Wordmark", "ground": "light"}')
  #>> '{provenance,state}') = 'proposed', 'the agency adds a logo by hand, for her to keep');

select test.act('jon@halm.test');
select test.refuses($$ select public.decide_identity(test.id('client'), 'colour', 'c-oak', 'keep') $$, 'forbidden',
  'a member does not decide on the Brand DNA');

select test.act('sara@halm.test');
select test.ok((public.decide_identity(test.id('client'), 'colour', 'c-oak', 'keep') #>> '{provenance,state}') = 'approved', 'she keeps a colour');
create temp table changed as select public.decide_identity(test.id('client'), 'colour', 'c-ink', 'change', '#B08050') as x;
select test.ok((select x ->> 'hex' = '#B08050' and x #>> '{provenance,was}' = '#1A1A1A' and x #>> '{provenance,state}' = 'changed' from changed),
  'she changes one, and it remembers what Fume read');
select test.refuses($$ select public.decide_identity(test.id('client'), 'colour', 'c-ink', 'change', 'brown') $$, 'invalid',
  'a colour is a hex');
select test.ok((public.decide_identity(test.id('client'), 'voice', 'v-1', 'remove') #>> '{provenance,state}') = 'removed', 'she removes a line');
select test.ok((public.set_colour_uses(test.id('client'), 'c-oak', array['buttons', 'accent']) -> 'uses') = '["buttons", "accent"]',
  'she says what a colour is for');
select test.ok((public.move_image(test.id('client'), 'i-1', 'campaign', 'Black Friday') ->> 'campaign') = 'Black Friday',
  'she moves a picture to a campaign look');
select test.ok((select x #>> '{provenance,state}' = 'approved' from jsonb_array_elements(
  public.decide_voice_part(test.id('client'), 'speak', 'keep') -> 'parts') x), 'she confirms how the brand speaks');

select test.act('nora@brygga.test');
select public.save_brand_scan(test.id('client'), 'https://halm.test', jsonb_build_object(
  'colours', jsonb_build_array(jsonb_build_object('name', 'Linen', 'hex', '#EFE6DA', 'role', 'ground', 'usage', 'Backgrounds'))));
select test.ok((select jsonb_array_length(identity -> 'colours') = 3 and jsonb_array_length(identity -> 'voice') = 1
  from public.brand_dna_versions where workspace_id = test.id('client') and state = 'draft'),
  'reading again keeps what she decided and adds what is new');

select test.act('sara@halm.test');
select test.ok((public.approve_brand_dna(test.id('client')) ->> 'state') = 'approved', 'she approves the Brand DNA');
select public.decide_identity(test.id('client'), 'colour', 'c-oak', 'change', '#A07040');
select test.ok((select count(*) = 2 and bool_or(state = 'approved' and identity #>> '{colours,0,hex}' = '#A0784B')
    and bool_or(state = 'draft' and identity #>> '{colours,0,hex}' = '#A07040')
  from public.brand_dna_versions where workspace_id = test.id('client')),
  'a change after approval is a new draft; the approved version stays in use');
select public.approve_brand_dna(test.id('client'));
select test.ok((select count(*) filter (where state = 'superseded') = 1 and count(*) filter (where state = 'approved') = 1
  from public.brand_dna_versions where workspace_id = test.id('client')), 'approving it again replaces the old version');

select test.act('nora@brygga.test');
select public.save_brand_scan(test.id('client'), 'https://halm.test', jsonb_build_object(
  'colours', jsonb_build_array(jsonb_build_object('name', 'Sand', 'hex', '#D8C3A5', 'role', 'support', 'usage', 'Panels'))));
select test.ok((select bool_or(x ->> 'name' = 'Linen') and bool_or(x ->> 'name' = 'Sand')
  from public.brand_dna_versions, jsonb_array_elements(identity -> 'colours') x
  where workspace_id = test.id('client') and state = 'draft'),
  'reading an approved brand again keeps what the approved Brand DNA holds, answered one by one or not');

select test.act('user+solv@fumecreatives.com');
select test.refuses($$ select public.save_brand_scan(test.id('client'), 'x', '{}') $$, 'not_found', 'another brand cannot read this one in');
select test.ok(not exists (select 1 from public.brand_scans where workspace_id = test.id('client')), 'nor see its readings');
reset role;
select test.ok(true, 'all of the Brand DNA board''s tests passed');
