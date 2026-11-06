-- The Engine's prompt writer reads how the brand sets words on its pictures, so a picture that will carry words is
-- made with room for them (docs/mvp/look-book.md, "Room for the words"): the layouts of the design system in use,
-- only the ones that set words, without the pictures they were read from.
create or replace function public.engine_words_room(p_job_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when v is null then null
    else jsonb_build_object('id', v -> 'id', 'version', v -> 'version',
      'layouts', coalesce((
        select jsonb_agg(jsonb_build_object('name', l ->> 'name', 'band', l ->> 'band', 'align', l ->> 'align',
          'wordsWidthPct', coalesce((l ->> 'wordsWidthPct')::numeric, 40), 'ground', l ->> 'ground', 'why', l ->> 'why'))
        from jsonb_array_elements(coalesce(v -> 'body' -> 'onPictures' -> 'layouts', '[]'::jsonb)) l
        where coalesce((l ->> 'hasWords')::boolean, true)), '[]'::jsonb))
  end
  from public.production_jobs j, lateral (select app.brand_book_in_use(j.workspace_id, 'design') v) x
  where j.id = p_job_id
$$;
revoke execute on function public.engine_words_room(uuid) from public, anon, authenticated;
grant execute on function public.engine_words_room(uuid) to service_role;
