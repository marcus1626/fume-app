-- Inviting someone to a brand (20261027180000_invite_member.sql): who may invite, the three kinds of address (new,
-- invited but never signed in, already using Fume), asking again, and what is refused.

\set ON_ERROR_STOP 1
set client_min_messages = warning;

-- An owner for LYSNE, test only, and Maja, who already uses Fume on SOLV.
insert into public.invitations (email, workspace_id, role, name, title)
values ('owner+lysne@fumecreatives.com', '0b000000-0000-4000-8000-000000000001', 'owner', 'Test Owner', 'CEO'),
       ('maja@solv.test', '0b000000-0000-4000-8000-000000000002', 'member', 'Maja Lind', 'Marketer');
insert into public.invitations (email, workspace_id, staff_role, can_check, name, title)
values ('designer+test@fumecreatives.com', '0b000000-0000-4000-8000-000000000001', 'designer', true, 'Test Designer', 'Designer');
select test.signup('owner+lysne@fumecreatives.com');
select test.signup('maja@solv.test');
update auth.users set last_sign_in_at = now() where email = 'maja@solv.test';
set client_min_messages = notice;

set role authenticated;

-- The owner invites a new address: the invitation waits for the email.
select test.act('owner+lysne@fumecreatives.com');
select test.ok(
  (public.invite_member('0b000000-0000-4000-8000-000000000001', ' Ane.Berg@Lysne.test ', 'member') ->> 'account') = 'new',
  'a new address gets an invitation that waits'
);
select test.ok(
  (select state from public.invitations where email = 'ane.berg@lysne.test') = 'sent',
  'the address is kept in lower case, and the invitation is sent'
);
select test.ok(
  (public.invite_member('0b000000-0000-4000-8000-000000000001', 'ane.berg@lysne.test', 'approver')
    -> 'invitation' ->> 'role') = 'approver',
  'asking again sends it again, with the latest role'
);
select test.ok(
  (select count(*) from public.invitations where email = 'ane.berg@lysne.test') = 1,
  'asking again keeps one invitation'
);
select test.ok(
  (public.invite_member('0b000000-0000-4000-8000-000000000001', 'ane.berg@lysne.test', 'member') ->> 'brand_name') = 'LYSNE',
  'the email can name the brand'
);

-- Someone who already uses Fume joins the brand at once.
select test.ok(
  (public.invite_member('0b000000-0000-4000-8000-000000000001', 'maja@solv.test', 'viewer') ->> 'account') = 'active',
  'a person who already uses Fume is active'
);
select test.ok(
  exists (
    select 1 from public.memberships m join public.profiles p on p.id = m.user_id
    where p.email = 'maja@solv.test' and m.workspace_id = '0b000000-0000-4000-8000-000000000001' and m.role = 'viewer'
  ),
  'and is on the brand''s team at once'
);
select test.refuses(
  $$ select public.invite_member('0b000000-0000-4000-8000-000000000001', 'maja@solv.test', 'member') $$,
  'conflict', 'someone already on the team is not invited again'
);

-- The account exists but has never been used (an earlier invitation): the membership is added and the email goes again.
reset role;
insert into public.invitations (email, workspace_id, role) values ('jon@solv.test', '0b000000-0000-4000-8000-000000000002', 'member');
insert into auth.users (email) values ('jon@solv.test');
set role authenticated;
select test.act('owner+lysne@fumecreatives.com');
select test.ok(
  (public.invite_member('0b000000-0000-4000-8000-000000000001', 'jon@solv.test', 'member') ->> 'account') = 'invited',
  'an account that has never signed in is invited again'
);

-- What is refused.
select test.refuses(
  $$ select public.invite_member('0b000000-0000-4000-8000-000000000001', 'not-an-address', 'member') $$,
  'invalid', 'an address must look like one'
);
select test.refuses(
  $$ select public.invite_member('0b000000-0000-4000-8000-000000000001', 'x@lysne.test', 'admin') $$,
  'invalid', 'only the brand''s roles'
);
select test.refuses(
  $$ select public.invite_member('0b000000-0000-4000-8000-000000000001', 'x@lysne.test', 'owner') $$,
  'forbidden', 'an owner does not name another owner'
);
select test.refuses(
  $$ select public.invite_member('0b000000-0000-4000-8000-000000000002', 'x@solv.test', 'member') $$,
  'not_found', 'nobody invites to a brand they cannot see'
);
select test.act('marcus+lysne@fumecreatives.com');
select test.refuses(
  $$ select public.invite_member('0b000000-0000-4000-8000-000000000001', 'x@lysne.test', 'member') $$,
  'forbidden', 'an approver does not invite'
);
select test.act('designer+test@fumecreatives.com');
select test.refuses(
  $$ select public.invite_member('0b000000-0000-4000-8000-000000000001', 'x@lysne.test', 'member') $$,
  'forbidden', 'a designer does not invite'
);

-- Fume's account manager invites, and names owners.
select test.act('william@fumecreatives.com');
select test.ok(
  (public.invite_member('0b000000-0000-4000-8000-000000000001', 'eier@lysne.test', 'owner') -> 'invitation' ->> 'role') = 'owner',
  'Fume''s account manager names an owner'
);
select test.ok(
  (public.invite_member('0b000000-0000-4000-8000-000000000001', 'eier@lysne.test', 'owner') ->> 'inviter_name') = 'William Henriksson',
  'the email can name who invited'
);

-- The new person's first sign-in turns the invitation into the membership.
reset role;
select test.signup('ane.berg@lysne.test');
select test.ok(
  exists (
    select 1 from public.memberships m join public.profiles p on p.id = m.user_id
    where p.email = 'ane.berg@lysne.test' and m.workspace_id = '0b000000-0000-4000-8000-000000000001' and m.role = 'member'
  ),
  'the invitation becomes the membership when the account is made'
);
select test.ok(true, 'all invitation tests passed');
