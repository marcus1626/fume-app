-- The Tone of Voice edited in place (app/FLOWS.md §34.3; Marcus chose "Bøkene nå", 9 Nov 2026). Fume's people write
-- straight into a draft (an edit on any other version makes the next draft from it); the customer's own lines wait on
-- her page and go to Fume with her ask, and the version Fume writes keeps them as she wrote them. Every line changed
-- by hand keeps a mark: who, when, and what it said before. One rule with app/src/domain/bookEdits.ts.

alter table public.brand_books
  add column if not exists edits jsonb not null default '[]',
  add column if not exists asked_edits jsonb;

-- Move the marks of a list's items from `p_from` on by `p_by` (an item taken out or put in).
create or replace function app.book_marks_shift(p_marks jsonb, p_prefix text, p_from int, p_by int) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(case
      when left(m ->> 'path', length(p_prefix)) = p_prefix
        and split_part(substr(m ->> 'path', length(p_prefix) + 1), '.', 1) ~ '^\d+$'
        and split_part(substr(m ->> 'path', length(p_prefix) + 1), '.', 1)::int >= p_from
      then jsonb_set(m, '{path}', to_jsonb(p_prefix
        || (split_part(substr(m ->> 'path', length(p_prefix) + 1), '.', 1)::int + p_by)::text
        || substr(m ->> 'path', length(p_prefix) + 1 + length(split_part(substr(m ->> 'path', length(p_prefix) + 1), '.', 1)))))
      else m end order by o), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_marks, '[]')) with ordinality as x(m, o)
$$;

-- One edit on a body: its new body and marks. An edit names the path of a line ("speak.traits.1.do"); in a list,
-- `to: null` takes the item out, an index one past the end adds one, and `insert` puts one in before that index
-- (with `mark`, an undo: the line comes back with the mark it had). Anything that is not a line is refused.
create or replace function app.book_edit(p_body jsonb, p_marks jsonb, p_edit jsonb, p_by uuid, p_at timestamptz)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  path text := p_edit ->> 'path';
  keys text[];
  k text;
  parent jsonb;
  n int;
  len int;
  ins boolean := coalesce((p_edit ->> 'insert')::boolean, false);
  to_v jsonb := p_edit -> 'to';
  gone boolean;
  before jsonb;
  mark jsonb;
  marks jsonb := coalesce(p_marks, '[]');
  body jsonb := p_body;
  prefix text;
begin
  if jsonb_typeof(p_edit) <> 'object' or path is null or path = '' or length(path) > 200 then
    perform app.fail('invalid', 'No such line.');
  end if;
  gone := to_v is null or jsonb_typeof(to_v) = 'null';
  if not gone and (jsonb_typeof(to_v) <> 'string' or length(to_v #>> '{}') > 2000) then
    perform app.fail('invalid', 'A line is words, at most 2000 characters.');
  end if;
  keys := string_to_array(path, '.');
  foreach k in array keys loop
    if k = '' or k in ('__proto__', 'constructor', 'prototype') then perform app.fail('invalid', 'No such line.'); end if;
  end loop;
  parent := case when cardinality(keys) = 1 then p_body else p_body #> keys[1:cardinality(keys) - 1] end;
  if parent is null or jsonb_typeof(parent) not in ('object', 'array') then perform app.fail('invalid', 'No such line.'); end if;
  k := keys[cardinality(keys)];
  prefix := case when cardinality(keys) = 1 then '' else array_to_string(keys[1:cardinality(keys) - 1], '.') || '.' end;
  select m into mark from jsonb_array_elements(marks) m where m ->> 'path' = path limit 1;

  if jsonb_typeof(parent) = 'array' then
    if k !~ '^\d+$' then perform app.fail('invalid', 'No such line.'); end if;
    n := k::int;
    len := jsonb_array_length(parent);
    if n > len or (n < len and jsonb_typeof(parent -> n) <> 'string') then perform app.fail('invalid', 'No such line.'); end if;
    if ins then
      if gone then perform app.fail('invalid', 'Nothing to put in.'); end if;
      body := jsonb_insert(p_body, keys, to_v);
      marks := app.book_marks_shift(marks, prefix, n, 1);
      if p_edit ? 'mark' then
        if jsonb_typeof(p_edit -> 'mark') = 'object' then
          marks := marks || jsonb_build_array(jsonb_set(p_edit -> 'mark', '{path}', to_jsonb(path)));
        end if;
      else
        marks := marks || jsonb_build_array(jsonb_build_object('path', path, 'by', p_by, 'at', p_at, 'from', null));
      end if;
      return jsonb_build_object('body', body, 'marks', marks);
    end if;
    before := case when n < len then parent -> n else 'null'::jsonb end;
    if gone then
      if n >= len then perform app.fail('invalid', 'No such line.'); end if;
      body := p_body #- keys;
      select coalesce(jsonb_agg(m order by o), '[]') into marks
      from jsonb_array_elements(marks) with ordinality x(m, o) where m ->> 'path' <> path;
      marks := app.book_marks_shift(marks, prefix, n + 1, -1);
      return jsonb_build_object('body', body, 'marks', marks);
    end if;
  else
    if ins or jsonb_typeof(parent -> k) is distinct from 'string' then perform app.fail('invalid', 'No such line.'); end if;
    if gone then perform app.fail('invalid', 'Only an item of a list can be taken out.'); end if;
    before := parent -> k;
  end if;

  body := jsonb_set(p_body, keys, to_v, true);
  if mark is not null then
    -- Back to what it said: no longer an edit.
    select coalesce(jsonb_agg(case when m ->> 'path' = path then m || jsonb_build_object('by', p_by, 'at', p_at) else m end order by o)
        filter (where not (m ->> 'path' = path and to_v = (m -> 'from'))), '[]')
      into marks from jsonb_array_elements(marks) with ordinality x(m, o);
  else
    marks := marks || jsonb_build_array(jsonb_build_object('path', path, 'by', p_by, 'at', p_at, 'from', before));
  end if;
  return jsonb_build_object('body', body, 'marks', marks);
end $$;

-- A list of edits on a body, in order.
create or replace function app.book_edits(p_body jsonb, p_marks jsonb, p_edits jsonb, p_by uuid, p_at timestamptz)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  r jsonb := jsonb_build_object('body', p_body, 'marks', coalesce(p_marks, '[]'));
  e jsonb;
begin
  if jsonb_typeof(p_edits) is distinct from 'array' or jsonb_array_length(p_edits) = 0 or jsonb_array_length(p_edits) > 60 then
    perform app.fail('invalid', 'Between one and sixty edits.');
  end if;
  for e in select x from jsonb_array_elements(p_edits) x loop
    r := app.book_edit(r -> 'body', r -> 'marks', e, p_by, p_at);
  end loop;
  return r;
end $$;
revoke execute on function app.book_marks_shift(jsonb, text, int, int), app.book_edit(jsonb, jsonb, jsonb, uuid, timestamptz),
  app.book_edits(jsonb, jsonb, jsonb, uuid, timestamptz) from public, anon, authenticated;

-- Fume's people edit a Tone of Voice in place: a draft changes; any other version gives the next draft, made from it
-- with the edits. The expert checks it as any draft; only the customer approves it.
create or replace function public.edit_brand_book(p_book_id uuid, p_edits jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  b public.brand_books;
  r jsonb;
begin
  perform app.require_user();
  select * into b from public.brand_books where id = p_book_id for update;
  if not found or not app.is_staff(b.workspace_id) then perform app.fail('not_found', 'No such book.'); end if;
  if not app.is_staff(b.workspace_id, array['designer', 'account_manager']) then
    perform app.fail('forbidden', 'Only Fume''s designers and account managers edit a book.');
  end if;
  if b.kind <> 'voice' then perform app.fail('invalid', 'Only the Tone of Voice is edited in place.'); end if;
  if b.state in ('writing', 'failed') then perform app.fail('invalid', 'This version has no words to edit yet.'); end if;
  if b.state = 'draft' then
    r := app.book_edits(b.body, b.edits, p_edits, auth.uid(), now());
    update public.brand_books set body = r -> 'body', edits = r -> 'marks' where id = b.id returning * into b;
  else
    if exists (select 1 from public.brand_books x where x.workspace_id = b.workspace_id and x.kind = b.kind
               and x.version > b.version and x.state in ('writing', 'draft')) then
      perform app.fail('conflict', 'A newer version is on its way: edit that one.');
    end if;
    r := app.book_edits(b.body, '[]', p_edits, auth.uid(), now());
    insert into public.brand_books (workspace_id, kind, version, state, body, edits, sources, created_by, started_at, written_at)
    values (b.workspace_id, b.kind,
      (select max(version) from public.brand_books where workspace_id = b.workspace_id and kind = b.kind) + 1,
      'draft', r -> 'body', r -> 'marks', jsonb_build_object('from', b.id, 'version', b.version, 'by_hand', true),
      auth.uid(), now(), now())
    returning * into b;
  end if;
  perform app.record(b.workspace_id, 'brand_book.edited', 'brand_book', b.id,
    jsonb_build_object('kind', b.kind, 'version', b.version, 'lines', jsonb_array_length(p_edits)));
  return to_jsonb(b);
end $$;
revoke execute on function public.edit_brand_book(uuid, jsonb) from public, anon;
grant execute on function public.edit_brand_book(uuid, jsonb) to authenticated;

-- The customer asks for a change, in words or with the lines she edited on her page (or both). The edits are tried on
-- the version she read (a line that is not there is refused now, not lost later); the next version keeps them.
drop function if exists public.ask_brand_book_change(uuid, text);
create or replace function public.ask_brand_book_change(p_book_id uuid, p_ask text, p_edits jsonb default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  b public.brand_books;
  nb jsonb;
  lines text;
  ask text;
begin
  perform app.require_user();
  select * into b from public.brand_books where id = p_book_id for update;
  if not found or not app.can_read(b.workspace_id) or b.state not in ('checked', 'approved', 'superseded', 'changes_asked') then
    perform app.fail('not_found', 'No such book.');
  end if;
  if not app.customer_is(b.workspace_id, array['owner', 'approver']) then
    perform app.fail('forbidden', 'Only the brand''s owner or approver asks for a change.');
  end if;
  if p_edits is not null and jsonb_typeof(p_edits) = 'array' and jsonb_array_length(p_edits) = 0 then p_edits := null; end if;
  if p_edits is not null then
    if b.kind <> 'voice' then perform app.fail('invalid', 'Only the Tone of Voice is edited in place.'); end if;
    perform app.book_edits(b.body, '[]', p_edits, auth.uid(), now());
  end if;
  if nullif(btrim(coalesce(p_ask, '')), '') is null and p_edits is null then perform app.fail('invalid', 'Say what should change.'); end if;
  if length(coalesce(p_ask, '')) > 1200 then perform app.fail('invalid', 'Say it in fewer words.'); end if;
  -- The writer reads her lines in the ask too, so the rest of the book is written around them.
  select string_agg(format('%s: %s', e ->> 'path', coalesce(e ->> 'to', '(taken out)')), E'\n') into lines
  from jsonb_array_elements(coalesce(p_edits, '[]')) e;
  ask := left(concat_ws(E'\n\n', nullif(btrim(coalesce(p_ask, '')), ''),
    case when lines is not null then 'She edited these lines herself; keep them exactly as she wrote them:' || E'\n' || lines end), 2000);
  if b.state = 'checked' then update public.brand_books set state = 'changes_asked' where id = b.id; end if;
  nb := public.write_brand_book(b.workspace_id, b.kind, ask);
  if p_edits is not null then
    update public.brand_books set asked_edits = coalesce(asked_edits, '[]') || p_edits,
      sources = sources || jsonb_build_object('asked_on', b.id)
    where id = (nb ->> 'id')::uuid returning to_jsonb(brand_books.*) into nb;
  end if;
  return nb;
end $$;
revoke execute on function public.ask_brand_book_change(uuid, text, jsonb) from public, anon;
grant execute on function public.ask_brand_book_change(uuid, text, jsonb) to authenticated;

-- The version Fume writes after her ask keeps the lines she edited, as she wrote them, with her mark. An edit whose line
-- the new version no longer has is left out; her words still reached the writer in the ask.
create or replace function public.brand_book_finish(p_book_id uuid, p_body jsonb, p_sources jsonb, p_model text, p_llm_usd numeric)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  b public.brand_books;
  r jsonb;
  e jsonb;
begin
  select * into b from public.brand_books where id = p_book_id for update;
  if not found or b.state <> 'writing' then return null; end if;
  if jsonb_typeof(p_body) <> 'object' or (b.kind = 'voice' and not (p_body ? 'identity' and p_body ? 'speak' and p_body ? 'examples'))
     or (b.kind = 'design' and not (p_body ? 'tokens' and p_body ? 'css' and p_body ? 'examples'))
     or (b.kind = 'look' and not (p_body ? 'camera' and p_body ? 'light' and p_body ? 'colour' and p_body ? 'texture' and p_body ? 'never')) then
    perform app.fail('invalid', 'The book is missing a part it must have.');
  end if;
  r := jsonb_build_object('body', p_body, 'marks', '[]'::jsonb);
  for e in select x from jsonb_array_elements(coalesce(b.asked_edits, '[]')) x loop
    begin
      r := app.book_edit(r -> 'body', r -> 'marks', e, b.created_by, now());
    exception when others then
      null;
    end;
  end loop;
  update public.brand_books set state = 'draft', body = r -> 'body', edits = r -> 'marks', sources = coalesce(p_sources, '{}') || jsonb_strip_nulls(jsonb_build_object('asked_on', b.sources -> 'asked_on')),
    model = p_model, llm_usd = llm_usd + greatest(coalesce(p_llm_usd, 0), 0), error = null, written_at = now()
  where id = b.id returning * into b;
  perform app.record(b.workspace_id, 'brand_book.written', 'brand_book', b.id, jsonb_build_object('kind', b.kind, 'version', b.version));
  return to_jsonb(b);
end $$;
