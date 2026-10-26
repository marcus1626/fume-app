-- A person's picture follows their Google account, and they change their own name and title.
select test.act('marcus@fumecreatives.com');
update auth.users set raw_user_meta_data = '{"avatar_url":"https://example.test/m.jpg"}' where email = 'marcus@fumecreatives.com';
select test.ok((select avatar_url from public.profiles where email = 'marcus@fumecreatives.com') = 'https://example.test/m.jpg', 'the Google picture follows the person');
select test.ok((public.update_profile('Marcus Blom', 'CEO')).title = 'CEO', 'a person changes their own title');
select test.refuses($$ select public.update_profile('', 'CEO') $$, 'invalid', 'a name is needed');
select test.ok((select title from public.profiles where email = 'kristian@fumecreatives.com') <> 'CEO', 'only their own profile changes');
do $$ begin raise notice 'ok   all profile tests passed'; end $$;
