-- A message's time is the moment it was written, not the start of its transaction, so messages written in one
-- transaction (a rehearsal, a batch) keep their order.
alter table public.conversation_messages alter column at set default clock_timestamp();
