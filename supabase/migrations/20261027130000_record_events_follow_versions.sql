-- The record follows what the reader may see: a customer reads an event about a creative version or a comment only
-- when they may read that version or comment, and never an event about Fume's production (candidates, jobs,
-- findings, files). Before this, a customer could read events about versions that were not checked or sent.
drop policy if exists record_events_read on public.record_events;
create policy record_events_read on public.record_events for select to authenticated using (
  app.is_staff(workspace_id)
  or (
    app.can_read(workspace_id)
    and case subject_type
      when 'creative_version' then app.can_read_version(subject_id)
      when 'comment' then exists (select 1 from public.comments c where c.id = subject_id)
      when 'candidate' then false
      when 'production_job' then false
      when 'finding' then false
      when 'file' then false
      else true
    end
  )
);
