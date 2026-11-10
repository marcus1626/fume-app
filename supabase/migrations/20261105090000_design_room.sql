-- The design layer is told where the Engine left room for the words (the hard rule "room-for-words" in the picture's
-- prompt), so the layout search looks there before anywhere else.
create or replace function public.design_take(p_layer_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  l public.design_layers;
  c public.candidates;
  f public.files;
  j public.production_jobs;
  cr public.creatives;
  s public.context_snapshots;
  w public.workspaces;
  plan jsonb;
  planned jsonb;
  book jsonb;
begin
  select * into l from public.design_layers where id = p_layer_id for update;
  if not found or l.state <> 'designing' then return null; end if;
  if l.started_at is not null and l.started_at > now() - interval '4 minutes' then return null; end if;
  if not (public.fume_llm_budget() ->> 'allowed')::boolean then
    update public.design_layers set state = 'failed', error = 'This week''s budget for Fume''s language model is used up.',
      finished_at = now() where id = l.id;
    return null;
  end if;
  book := app.brand_book_in_use(l.workspace_id, 'design');
  if book is null then
    update public.design_layers set state = 'failed', error = 'The brand has no design system.', finished_at = now() where id = l.id;
    return null;
  end if;
  select * into c from public.candidates where id = l.candidate_id;
  select * into f from public.files where id = c.file_id;
  select * into j from public.production_jobs where id = l.job_id;
  select * into cr from public.creatives where id = l.creative_id;
  select * into s from public.context_snapshots where id = j.snapshot_id;
  select * into w from public.workspaces where id = l.workspace_id;
  select body into plan from public.plan_versions where id = s.plan_version_id;
  select x into planned
  from jsonb_array_elements(coalesce(plan -> 'directions', '[]')) d, jsonb_array_elements(coalesce(d -> 'creatives', '[]')) x
  where d ->> 'id' = coalesce(plan ->> 'chosen_direction_id', d ->> 'id') and x ->> 'id' = cr.slot
  limit 1;
  update public.design_layers set started_at = now(), book_id = (book ->> 'id')::uuid, book_version = (book ->> 'version')::int
  where id = l.id;
  return jsonb_build_object(
    'layer_id', l.id, 'workspace_id', l.workspace_id, 'ask', l.ask,
    'brand', jsonb_build_object('name', w.brand_name, 'language', w.language, 'market', w.market),
    'picture', jsonb_build_object('bucket', f.bucket, 'path', f.path, 'width', f.width, 'height', f.height),
    'creative', jsonb_build_object('id', cr.id, 'title', cr.title, 'format', coalesce(cr.format, 'feed'), 'slot', cr.slot),
    'planned', coalesce(planned, '{}'),
    -- Where the Engine was told to leave room for the words, so the layout looks there first.
    'room', (
      select r -> 'statement'
      from public.engine_prompts p, jsonb_path_query(p.compile_package, 'strict $.**? (@.id == "room-for-words")') r
      where c.attempt_id is not null and p.attempt_id = c.attempt_id
      limit 1),
    'copy', coalesce(plan -> 'content', '[]'),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object('name', pr.name, 'variant', nullif(pr.variant, '')) order by pr.name)
      from public.campaign_products cp join public.products pr on pr.id = cp.product_id
      where cp.campaign_id = j.campaign_id), '[]'),
    'book', jsonb_build_object('id', book -> 'id', 'version', book -> 'version', 'state', book -> 'state',
      'body', (book -> 'body') - 'sources' - 'gaps' - 'parts' - 'css' - 'tokens'),
    'store', jsonb_build_object('bucket', 'workspace-files',
      'png', l.workspace_id || '/design/' || l.id || '.png', 'fig', l.workspace_id || '/design/' || l.id || '.fig')
  );
end $$;

revoke execute on function public.design_take(uuid) from public, anon, authenticated;
grant execute on function public.design_take(uuid) to service_role;
