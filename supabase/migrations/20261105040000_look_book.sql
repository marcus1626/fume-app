-- The Look Book (docs/mvp/look-book.md). Marcus, 4 Nov 2026: the pictures had no taste; "smak fra brands handler om
-- alle detaljene, kamera, grain, lys, komposisjon, alt." Beside its Tone of Voice and design system, every brand gets a
-- third book: its photography, read from its own pictures. Camera and lens, aperture, camera height and distance,
-- light (sources, quality, direction, colour temperature, contrast), colour grade, grain and texture, composition,
-- styling, retouching, and what its pictures never do, with recipes per kind of scene. The Engine writes every prompt
-- from it, and checks that the prompt says it.

alter table public.brand_books drop constraint if exists brand_books_kind_check;
alter table public.brand_books add constraint brand_books_kind_check check (kind in ('voice', 'design', 'look'));

create or replace function public.write_brand_book(p_workspace_id uuid, p_kind text, p_ask text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  b public.brand_books;
begin
  perform app.require_user();
  if not app.can_read(p_workspace_id) then perform app.fail('not_found', 'No such brand.'); end if;
  if not app.brand_writer(p_workspace_id) then
    perform app.fail('forbidden', 'Only the people who run the brand, or its owner or approver, ask for this.');
  end if;
  if p_kind not in ('voice', 'design', 'look') then
    perform app.fail('invalid', 'A Tone of Voice, a design system or a Look Book.');
  end if;
  if length(coalesce(p_ask, '')) > 2000 then perform app.fail('invalid', 'Say it in fewer words.'); end if;
  -- One at a time: the one being written is the answer.
  select * into b from public.brand_books where workspace_id = p_workspace_id and kind = p_kind and state = 'writing';
  if found then return to_jsonb(b); end if;
  insert into public.brand_books (workspace_id, kind, version, ask, created_by)
  values (p_workspace_id, p_kind,
    coalesce((select max(version) from public.brand_books where workspace_id = p_workspace_id and kind = p_kind), 0) + 1,
    nullif(btrim(coalesce(p_ask, '')), ''), auth.uid())
  returning * into b;
  perform app.record(p_workspace_id, 'brand_book.writing', 'brand_book', b.id, jsonb_build_object('kind', p_kind, 'version', b.version));
  return to_jsonb(b);
end $$;

-- The pictures a Look Book is read from: the brand's own (as Brand DNA keeps them) and the ones its people said are
-- them or are not, newest first. The writer reads at most twelve.
create or replace function public.brand_look_pictures(p_workspace_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x order by x ->> 'rank', x ->> 'at' desc), '[]') from (
    select jsonb_build_object('rank', '0', 'at', '', 'url', i ->> 'image', 'kind', 'brand', 'note', nullif(i ->> 'caption', '')) x
    from public.brand_dna_versions d, jsonb_array_elements(coalesce(d.identity -> 'imagery', '[]')) i
    where d.workspace_id = p_workspace_id and d.state <> 'superseded' and (i ->> 'image') like 'https://%'
    union all
    select jsonb_strip_nulls(jsonb_build_object('rank', case when s.verdict = 'liked' then '1' else '2' end, 'at', s.created_at::text,
      'url', s.image_url, 'bucket', f.bucket, 'path', f.path,
      'kind', case when s.verdict = 'liked' then 'liked' else 'not_us' end, 'note', s.reason))
    from public.taste_signals s left join public.files f on f.id = s.file_id
    where s.workspace_id = p_workspace_id and s.origin in ('brand_imagery', 'reference', 'upload', 'approval')
      and (s.image_url like 'https://%' or f.content_type like 'image/%')
  ) y
$$;
revoke execute on function public.brand_look_pictures(uuid) from public, anon, authenticated;
grant execute on function public.brand_look_pictures(uuid) to service_role;

-- A Look Book must carry its camera, light, colour and texture, and what the brand never does.
create or replace function public.brand_book_finish(p_book_id uuid, p_body jsonb, p_sources jsonb, p_model text, p_llm_usd numeric)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  b public.brand_books;
begin
  select * into b from public.brand_books where id = p_book_id for update;
  if not found or b.state <> 'writing' then return null; end if;
  if jsonb_typeof(p_body) <> 'object' or (b.kind = 'voice' and not (p_body ? 'identity' and p_body ? 'speak' and p_body ? 'examples'))
     or (b.kind = 'design' and not (p_body ? 'tokens' and p_body ? 'css' and p_body ? 'examples'))
     or (b.kind = 'look' and not (p_body ? 'camera' and p_body ? 'light' and p_body ? 'colour' and p_body ? 'texture' and p_body ? 'never')) then
    perform app.fail('invalid', 'The book is missing a part it must have.');
  end if;
  update public.brand_books set state = 'draft', body = p_body, sources = coalesce(p_sources, '{}'), model = p_model,
    llm_usd = llm_usd + greatest(coalesce(p_llm_usd, 0), 0), error = null, written_at = now()
  where id = b.id returning * into b;
  perform app.record(b.workspace_id, 'brand_book.written', 'brand_book', b.id, jsonb_build_object('kind', b.kind, 'version', b.version));
  return to_jsonb(b);
end $$;

-- The Engine's prompt writer reads the brand's Look Book for a job: the approved one, else the newest an expert
-- checked, else the newest draft (so a first picture already has a look), without its sources and open questions.
create or replace function public.engine_look(p_job_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when v is null then null
    else jsonb_build_object('id', v -> 'id', 'version', v -> 'version', 'state', v -> 'state',
      'body', (v -> 'body') - 'sources' - 'gaps' - 'parts' - 'evidence')
  end
  from public.production_jobs j, lateral (select app.brand_book_in_use(j.workspace_id, 'look') v) x
  where j.id = p_job_id
$$;
revoke execute on function public.engine_look(uuid) from public, anon, authenticated;
grant execute on function public.engine_look(uuid) to service_role;
