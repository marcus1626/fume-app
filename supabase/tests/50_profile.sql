-- A person's picture follows their Google account, and they change their own name and title.
select test.act('marcus@fumecreatives.com');
update auth.users set raw_user_meta_data = '{"avatar_url":"https://example.test/m.jpg"}' where email = 'marcus@fumecreatives.com';
select test.ok((select avatar_url from public.profiles where email = 'marcus@fumecreatives.com') = 'https://example.test/m.jpg', 'the Google picture follows the person');
select test.ok((public.update_profile('Marcus Blom', 'CEO')).title = 'CEO', 'a person changes their own title');
select test.refuses($$ select public.update_profile('', 'CEO') $$, 'invalid', 'a name is needed');
select test.ok((select title from public.profiles where email = 'kristian@fumecreatives.com') <> 'CEO', 'only their own profile changes');
-- On the first sign-in a person says who they are ("About you"); the name starts from the invitation, then Google.
insert into public.invitations (email, workspace_id, role) values ('ane+lysne@fumecreatives.com', '0b000000-0000-4000-8000-000000000001', 'member');
insert into auth.users (email, raw_user_meta_data) values ('ane+lysne@fumecreatives.com', '{"full_name":"Ane Berg"}');
select test.ok((select name from public.profiles where email = 'ane+lysne@fumecreatives.com') = 'Ane Berg', 'with no name on the invitation, the Google name is the first name offered');
select test.ok((select introduced_at from public.profiles where email = 'ane+lysne@fumecreatives.com') is null, 'a new person has not said who they are yet');
select test.ok((select name from public.profiles where email = 'member+lysne@fumecreatives.com') = 'Test Member', 'the invitation''s name comes first');
select test.act('ane+lysne@fumecreatives.com');
select public.update_profile('Ane Berg', 'Brand Manager');
select test.ok((select introduced_at from public.profiles where email = 'ane+lysne@fumecreatives.com') is not null, 'saving name and title is the introduction');
do $$ begin raise notice 'ok   all profile tests passed'; end $$;
