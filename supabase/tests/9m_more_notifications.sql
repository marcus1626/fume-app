-- More of the bell (20261103221000_more_notifications.sql): when the owner sends a brief, the agency's people hear
-- of it; she never hears of her own send.

\set ON_ERROR_STOP 1
set client_min_messages = notice;
reset role;
set role authenticated;

select test.act('sara@halm.test');
select public.send_brief(test.id('sc'), '{"objective":"Winter in the shop","audience":"Home makers","message":"Warm wood","formats":"feed","count":"2"}');
reset role;
select test.ok(exists (select 1 from public.notifications n join public.profiles p on p.id = n.user_id
                       where p.email = 'nora@brygga.test' and n.kind = 'waiting_on_you' and n.text = 'Sara sent the brief for Winter'),
  'the agency lead hears that the brief was sent');
select test.ok(not exists (select 1 from public.notifications n join public.profiles p on p.id = n.user_id
                           where p.email = 'sara@halm.test' and n.text like '%sent the brief%'),
  'she does not hear of her own send');
set role authenticated;

select test.ok(true, 'all of the more notification tests passed');
