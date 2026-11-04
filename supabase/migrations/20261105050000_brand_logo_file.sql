-- The logo file the brand's people added (a source of kind logo with a file): the design system's writer sets it on
-- every creative before a logo read from the website or the Brand DNA (docs/mvp/design-layer.md, "On brand"). Only
-- Fume's functions read it this way; people see it as one of the brand's sources, as before.
create or replace function public.brand_logo_file(p_workspace_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('bucket', f.bucket, 'path', f.path, 'type', f.content_type, 'name', coalesce(s.name, f.name))
  from public.sources s join public.files f on f.id = s.file_id
  where s.workspace_id = p_workspace_id and s.kind = 'logo'
    and f.content_type in ('image/svg+xml', 'image/png', 'image/jpeg', 'image/webp')
  order by s.created_at desc
  limit 1
$$;
revoke execute on function public.brand_logo_file(uuid) from public, anon, authenticated;
grant execute on function public.brand_logo_file(uuid) to service_role;
