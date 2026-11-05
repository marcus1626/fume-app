-- The font files the brand's people added (sources of kind font with a file): the design system sets the brand's own
-- face on every creative before a stand-in from Google Fonts (docs/mvp/design-layer.md, "On brand"). Only Fume's
-- functions read them this way; people see them as the brand's sources, as before. TrueType and OpenType only:
-- the renderer reads no web font formats.
create or replace function public.brand_font_files(p_workspace_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x order by x ->> 'at' desc), '[]'::jsonb)
  from (
    select jsonb_build_object('bucket', f.bucket, 'path', f.path, 'type', f.content_type, 'name', coalesce(s.name, f.name),
      'file', f.name, 'bytes', f.bytes, 'at', s.created_at) as x
    from public.sources s join public.files f on f.id = s.file_id
    where s.workspace_id = p_workspace_id and s.kind = 'font'
      and (f.content_type in ('font/ttf', 'font/otf', 'font/sfnt', 'application/x-font-ttf', 'application/x-font-otf',
             'application/font-sfnt', 'application/vnd.ms-opentype')
           or lower(f.name) ~ '\.(ttf|otf)$')
    order by s.created_at desc
    limit 12
  ) t
$$;
revoke execute on function public.brand_font_files(uuid) from public, anon, authenticated;
grant execute on function public.brand_font_files(uuid) to service_role;
