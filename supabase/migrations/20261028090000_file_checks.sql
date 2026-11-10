-- Fume checks the file of every version that goes to check (docs/mvp/library.md B11, T06; plan Wednesday 4): the kind of
-- file, its size against the creative's format, and its weight. What it finds is an automated finding on the version,
-- evidence for the expert, who still looks at the picture before the customer can see it. The customer never reads
-- automated findings (findings_read). No finding here is critical: the expert decides, and asks the designer for a
-- fix when the file is wrong.

create or replace function app.check_file(p_version_id uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v public.creative_versions;
  cr public.creatives;
  f public.files;
  want_w int;
  want_h int;
  ratio numeric;
  want numeric;
  n int := 0;
begin
  select * into v from public.creative_versions where id = p_version_id;
  if not found or v.file_id is null then return 0; end if;
  select * into cr from public.creatives where id = v.creative_id;
  select * into f from public.files where id = v.file_id;
  if not found then return 0; end if;

  select w, h into want_w, want_h from (values ('feed', 1080, 1350), ('square', 1080, 1080), ('story', 1080, 1920))
    as sizes (format, w, h) where format = cr.format;

  if f.content_type not in ('image/jpeg', 'image/png', 'image/webp') then
    insert into public.findings (workspace_id, version_id, method, dimension, severity, finding, expected, observed)
    values (v.workspace_id, v.id, 'automated', 'file_spec', 'major',
      'The file is not a picture the ad channels take.', 'JPEG, PNG or WebP', f.content_type);
    n := n + 1;
  end if;

  if f.width is null or f.height is null then
    insert into public.findings (workspace_id, version_id, method, dimension, severity, finding, expected, observed)
    values (v.workspace_id, v.id, 'automated', 'file_spec', 'minor',
      'The size of the file is not known: check it by eye.',
      case when want_w is not null then format('%s × %s', want_w, want_h) end, 'Unknown');
    n := n + 1;
  elsif want_w is not null then
    ratio := f.width::numeric / f.height;
    want := want_w::numeric / want_h;
    if abs(ratio - want) / want > 0.01 then
      insert into public.findings (workspace_id, version_id, method, dimension, severity, finding, expected, observed)
      values (v.workspace_id, v.id, 'automated', 'file_spec', 'major',
        format('The picture is not shaped for %s.', cr.format),
        format('%s × %s (%s)', want_w, want_h, case cr.format when 'feed' then '4:5' when 'square' then '1:1' else '9:16' end),
        format('%s × %s', f.width, f.height));
      n := n + 1;
    elsif least(f.width, f.height) < want_w then
      insert into public.findings (workspace_id, version_id, method, dimension, severity, finding, expected, observed)
      values (v.workspace_id, v.id, 'automated', 'file_spec', 'major',
        'The picture is smaller than the channel shows it.',
        format('At least %s × %s', want_w, want_h), format('%s × %s', f.width, f.height));
      n := n + 1;
    end if;
  end if;

  if f.bytes > 30 * 1024 * 1024 then
    insert into public.findings (workspace_id, version_id, method, dimension, severity, finding, expected, observed)
    values (v.workspace_id, v.id, 'automated', 'file_spec', 'minor',
      'The file is heavier than the ad channels take.', 'Up to 30 MB', format('%s MB', round(f.bytes / 1048576.0, 1)));
    n := n + 1;
  end if;

  return n;
end $$;
revoke execute on function app.check_file(uuid) from public, anon, authenticated;

create or replace function app.on_version_in_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.check_file(new.id);
  return new;
end $$;
revoke execute on function app.on_version_in_check() from public, anon, authenticated;

create trigger check_file_on_new_version
after insert on public.creative_versions
for each row when (new.state = 'in_check')
execute function app.on_version_in_check();
