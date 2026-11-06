-- A picture's small print read again replaces the notes the last read added, instead of adding them twice.
create or replace function public.details_finish(p_candidate_id uuid, p_details jsonb, p_llm_usd numeric) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.candidates;
  wrong jsonb;
  kept jsonb;
begin
  if jsonb_typeof(coalesce(p_details, '[]')) <> 'array' then perform app.fail('invalid', 'The details are a list.'); end if;
  select * into c from public.candidates where id = p_candidate_id for update;
  if not found then return; end if;
  select coalesce(jsonb_agg(d ->> 'note'), '[]') into wrong
  from jsonb_array_elements(coalesce(p_details, '[]')) d
  where (d ->> 'ok')::boolean is false and coalesce(d ->> 'note', '') <> '';
  -- The evaluation's own notes, without the ones the last read added.
  select coalesce(jsonb_agg(n), '[]') into kept
  from jsonb_array_elements(coalesce(c.evaluation -> 'notes', '[]')) n
  where not exists (select 1 from jsonb_array_elements(coalesce(c.details, '[]')) d where d ->> 'note' = n #>> '{}');
  update public.candidates set
    details = coalesce(p_details, '[]'),
    details_usd = details_usd + greatest(coalesce(p_llm_usd, 0), 0),
    evaluation = case
      when evaluation is null then evaluation
      when jsonb_array_length(wrong) = 0 then evaluation || jsonb_build_object('notes', kept)
      else evaluation || jsonb_build_object('productTruth', 'flag', 'notes', kept || wrong)
    end
  where id = c.id;
end $$;
