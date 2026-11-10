-- The Engine keeps the room for the words in the tone they need (Anthem v11, 9 Nov: the room was bright sky, white
-- words could not be read on it, and the design layer fell back to navy, off the brand). Each layout now says whether
-- the brand's words on its pictures are light or dark.
create or replace function public.engine_words_room(p_job_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when v is null then null
    else jsonb_build_object('id', v -> 'id', 'version', v -> 'version',
      'layouts', coalesce((
        select jsonb_agg(jsonb_build_object('name', l ->> 'name', 'band', l ->> 'band', 'align', l ->> 'align',
          'wordsWidthPct', coalesce((l ->> 'wordsWidthPct')::numeric, 40), 'ground', l ->> 'ground', 'why', l ->> 'why')
          || case when jsonb_typeof(l -> 'box') = 'object' then jsonb_build_object('box', l -> 'box') else '{}'::jsonb end
          || case when l ->> 'ctaAt' in ('bottom_left', 'bottom_right') and coalesce(l ->> 'cta', '') <> 'none'
               then jsonb_build_object('ctaAt', l ->> 'ctaAt') else '{}'::jsonb end
          || case when l ->> 'words' in ('light', 'dark', 'brand_colour')
               then jsonb_build_object('words', l ->> 'words') else '{}'::jsonb end)
        from jsonb_array_elements(coalesce(v -> 'body' -> 'onPictures' -> 'layouts', '[]'::jsonb)) l
        where coalesce((l ->> 'hasWords')::boolean, true)), '[]'::jsonb))
  end
  from public.production_jobs j, lateral (select app.brand_book_in_use(j.workspace_id, 'design') v) x
  where j.id = p_job_id
$$;
revoke execute on function public.engine_words_room(uuid) from public, anon, authenticated;
grant execute on function public.engine_words_room(uuid) to service_role;
