-- An agency of one (20261104090000_solo_agency_checks.sql): its only person makes and checks the same creative; the
-- check is marked as their own. Once a second person joins, two pairs of eyes hold again.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;
set role authenticated;

select test.act('marcus@fumecreatives.com');
select test.keep('solo', (public.create_agency('Solo Studio') ->> 'id')::uuid);
select public.invite_agency_person(test.id('solo'), 'ola@solo.test', 'Ola Solo', 'Founder', 'lead');

select test.act('ola@solo.test');
select test.keep('ola', auth.uid());
select test.keep('sclient', (public.add_client('Fjord Te', 'Norway', 'no', null, 'add-fjord') ->> 'id')::uuid);

reset role;
insert into public.products (workspace_id, name, variant, sku) values (test.id('sclient'), 'Winter tea', 'Loose', 'WT-1');
select test.keep('tea', (select id from public.products where sku = 'WT-1'));
insert into storage.objects (bucket_id, name, owner_id)
select 'workspace-files', test.id('sclient') || '/' || n || '.jpg', test.id('ola')::text from unnest(array['s1', 's2']) n;
set role authenticated;
select test.act('ola@solo.test');
select test.keep('scamp', (public.create_campaign(test.id('sclient'), 'Winter tea', array[test.id('tea')]) ->> 'id')::uuid);
select public.send_brief(test.id('scamp'), '{"objective":"Sell the tea","audience":"Tea lovers","message":"Warm cup","formats":"feed","count":"2"}');
-- The client's approval of the plan is the agency tests' part (97_agency.sql); here it is simply approved.
reset role;
update public.plan_versions set state = 'approved' where campaign_id = test.id('scamp');
set role authenticated;
select test.act('ola@solo.test');

select test.keep('sj1', (public.start_job(test.id('scamp'), 'master', '{"provider":"manual"}', '[]', null, null, 'manual') ->> 'id')::uuid);
select test.keep('sf1', (public.register_file(test.id('sclient'), test.id('sclient') || '/s1.jpg', 's1.jpg', 'image/jpeg', 500000, 'sha-solo-1', 1080, 1350, 'candidate') ->> 'id')::uuid);
select test.keep('sv1', (public.send_to_check((public.add_candidate(test.id('sj1'), test.id('sf1'), 'manual', 'Tea at dusk') ->> 'id')::uuid, 'feed', 'Feed 1') ->> 'id')::uuid);
select test.ok((public.mark_checked(test.id('sv1')) ->> 'state') = 'checked', 'the only person in the agency checks what they made');
reset role;
select test.ok(exists (select 1 from public.record_events where subject_id = test.id('sv1') and action = 'version.checked'
                       and detail ->> 'own_work' = 'true'), 'the check is marked as their own');
set role authenticated;

-- A second person joins: Ola's next creative needs someone else's eyes.
select test.act('ola@solo.test');
select public.invite_agency_person(test.id('solo'), 'kari@solo.test', 'Kari Solo', 'Designer', 'creative');
select test.keep('kari', test.signup('kari@solo.test'));
select test.act('ola@solo.test');
select test.keep('sj2', (public.start_job(test.id('scamp'), 'master', '{"provider":"manual"}', '[]', null, null, 'manual') ->> 'id')::uuid);
select test.keep('sf2', (public.register_file(test.id('sclient'), test.id('sclient') || '/s2.jpg', 's2.jpg', 'image/jpeg', 500000, 'sha-solo-2', 1080, 1350, 'candidate') ->> 'id')::uuid);
select test.keep('sv2', (public.send_to_check((public.add_candidate(test.id('sj2'), test.id('sf2'), 'manual', 'Tea at dawn') ->> 'id')::uuid, 'feed', 'Feed 2') ->> 'id')::uuid);
select test.refuses($$ select public.mark_checked(test.id('sv2')) $$, 'forbidden', 'with two people, the maker does not check it');
select test.act('kari@solo.test');
select test.ok((public.mark_checked(test.id('sv2')) ->> 'state') = 'checked', 'the other person does');
reset role;
select test.ok((select detail = '{}'::jsonb from public.record_events where subject_id = test.id('sv2') and action = 'version.checked'),
  'and that check is not marked as one''s own');
set role authenticated;

select test.ok(true, 'all of the solo agency tests passed');
