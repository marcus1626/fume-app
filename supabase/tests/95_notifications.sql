-- The bell (20261103100000_notifications.sql), on the cycle 10_rules ran: each event reaches the people it concerns,
-- never the one who did it; repeats fold while unread; each person reads only their own.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
set role authenticated;

select test.act('marcus+lysne@fumecreatives.com');
select test.ok(exists (select 1 from public.notifications where kind = 'checked' and href = '/campaigns/' || test.id('campaign') || '/review'),
  'the approver hears that checked creatives are ready for her');
select test.ok(exists (select 1 from public.notifications where kind = 'waiting_on_you' and href = '/campaigns/' || test.id('campaign') || '/plan'),
  'the approver hears that the plan is ready');
select test.ok(not exists (select 1 from public.notifications where kind = 'approved'),
  'she is not told about her own approvals');
select test.ok((select bool_and(kind in ('checked', 'waiting_on_you', 'delivered')) from public.notifications),
  'a customer hears only about work sent to her, plans and deliveries');
select test.ok((select bool_and(user_id = auth.uid()) from public.notifications), 'she reads only her own notifications');

select test.act('kristian@fumecreatives.com');
select test.ok(exists (select 1 from public.notifications where kind = 'approved'
  and href = '/studio/b/' || test.id('lysne') || '/campaigns/' || test.id('campaign') || '/plan' and text like '%approved the plan for%'),
  'the designer hears that the plan was approved');
select test.ok(exists (select 1 from public.notifications where kind = 'changes_asked'
  and href like '/studio/b/' || test.id('lysne') || '/qa?campaign=' || test.id('campaign')),
  'and that the customer asked for changes');

select test.act('william@fumecreatives.com');
select test.ok(exists (select 1 from public.notifications where kind = 'approved' and text like '%creative%'),
  'the account manager hears about approved creatives');

-- Folding: one more of the same while unread raises the count; once read, the next one is a new line.
reset role;
select app.notify((select id from public.profiles where email = 'william@fumecreatives.com'), test.id('lysne'), 'approved', null,
  'test-fold', 'One test', '{n} tests', '/x', null);
select app.notify((select id from public.profiles where email = 'william@fumecreatives.com'), test.id('lysne'), 'approved', null,
  'test-fold', 'One test', '{n} tests', '/x', null, 2);
set role authenticated;
select test.act('william@fumecreatives.com');
select test.ok((select count = 3 and text = '3 tests' from public.notifications where group_key = 'test-fold'),
  'the same news folds into one line with its count');
select public.mark_notifications_read(array[(select id from public.notifications where group_key = 'test-fold')]);
select test.ok((select read_at is not null from public.notifications where group_key = 'test-fold'), 'marking it read keeps it, read');
reset role;
select app.notify((select id from public.profiles where email = 'william@fumecreatives.com'), test.id('lysne'), 'approved', null,
  'test-fold', 'One test', '{n} tests', '/x', null);
set role authenticated;
select test.act('william@fumecreatives.com');
select test.ok((select count(*) = 2 and count(*) filter (where read_at is null and text = 'One test') = 1 from public.notifications where group_key = 'test-fold'),
  'news after reading is a new line');
select public.mark_notifications_read();
select test.ok(not exists (select 1 from public.notifications where read_at is null), 'all of them can be marked read at once');

select test.act('marcus+lysne@fumecreatives.com');
select test.ok(exists (select 1 from public.notifications where read_at is null), 'marking his read leaves hers unread');
select test.ok(not exists (select 1 from public.notifications where group_key = 'test-fold'), 'nor can she see his');
select test.ok(true, 'all of the bell''s tests passed');
