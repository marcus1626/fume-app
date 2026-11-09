-- A picture designed again keeps the layout people saw (9 Nov): the design that went into a creative (a version the
-- expert checks) or a designer's latest ask, whichever is newer. Only when neither exists, the first design in the
-- picture's line. Dressmann's hytta showed why: its first design was a test made before a fix, and the one in the
-- deck was the second.
create or replace function public.design_layout_before(p_layer_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  cand uuid;
  line uuid[] := '{}';
  i int := 0;
  pick jsonb;
begin
  select candidate_id into cand from public.design_layers where id = p_layer_id;
  while cand is not null and i < 5 loop
    line := line || cand;
    i := i + 1;
    select fixed_from into cand from public.candidates where id = cand;
  end loop;
  select d.choice into pick from public.design_layers d
  where d.candidate_id = any(line) and d.state = 'made' and d.id <> p_layer_id and d.choice is not null
    and (d.ask is not null
      or exists (select 1 from public.creative_versions v where v.candidate_id = d.result_candidate_id))
  order by d.created_at desc limit 1;
  if pick is null then
    select d.choice into pick from public.design_layers d
    where d.candidate_id = any(line) and d.state = 'made' and d.id <> p_layer_id and d.choice is not null
    order by d.created_at asc limit 1;
  end if;
  return pick;
end $$;
revoke execute on function public.design_layout_before(uuid) from public, anon, authenticated;
grant execute on function public.design_layout_before(uuid) to service_role;
