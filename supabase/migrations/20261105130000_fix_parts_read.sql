-- The parts of a surgical fix (docs/mvp/picture-fix.md) are staff-only reads: the crop of the picture, the close part
-- from the product's own photograph, and what the image model drew. A designer sees what Fume copied the label from.
-- Customers never see them: a fix is the Engine's work, like the candidates.

create or replace function app.can_read_object(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.files f where f.path = p_name and app.can_read_file(f.id))
    or (p_name ~ '^[0-9a-f-]{36}/fix/[0-9a-f-]{36}-(crop|ref|redrawn)\.png$' and exists (
      select 1 from public.picture_fixes x
      where x.workspace_id::text = split_part(p_name, '/', 1)
        and x.id::text = substring(split_part(p_name, '/', 3) from 1 for 36)
        and app.is_staff(x.workspace_id)))
$$;
