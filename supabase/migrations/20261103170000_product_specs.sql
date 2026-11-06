-- A product's kind and specs (contract SpecEntry[]): the kind decides what Fume asks for (a serum needs other measures
-- than a shirt). Anyone on the brand fills them in; what they give is approved as theirs. add_product takes the kind.

alter table public.products
  add column kind_id text,
  add column specs jsonb not null default '[]';

drop function public.add_product(uuid, text, text, text, text);
create or replace function public.add_product(
  p_workspace_id uuid, p_name text, p_variant text default '', p_url text default null, p_key text default null,
  p_kind_id text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('ws', p_workspace_id, 'name', p_name, 'variant', p_variant, 'url', p_url, 'kind', p_kind_id);
  prior jsonb;
  p public.products;
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'add_product', req);
  if prior is not null then return prior; end if;
  if not app.can_read(p_workspace_id) then perform app.fail('not_found', 'No such brand.'); end if;
  if not app.product_writer(p_workspace_id) then perform app.fail('forbidden', 'Only the people on the brand add its products.'); end if;
  if nullif(trim(coalesce(p_name, '')), '') is null then perform app.fail('invalid', 'A product needs a name.'); end if;
  insert into public.products (workspace_id, name, variant, kind_id)
  values (p_workspace_id, left(trim(p_name), 200), left(trim(coalesce(p_variant, '')), 120), nullif(p_kind_id, ''))
  returning * into p;
  if nullif(trim(coalesce(p_url, '')), '') ~ '^https?://' then
    insert into public.sources (workspace_id, kind, name, url, retrieved_at, product_id, created_by)
    values (p_workspace_id, 'website', regexp_replace(trim(p_url), '^https?://', ''), trim(p_url), now(), p.id, auth.uid());
  end if;
  perform app.record(p_workspace_id, 'product.added', 'product', p.id, jsonb_build_object('name', p.name));
  return app.idem_end(p_key, 'add_product', req, to_jsonb(p));
end $$;

-- Her values (approved as hers; one that replaces Fume's reading is 'changed' and keeps what it was), the proposals
-- she keeps, and the ones she removes.
create or replace function public.save_product_specs(
  p_product_id uuid, p_kind_id text default null, p_values jsonb default '[]', p_keep text[] default '{}',
  p_remove text[] default '{}'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.products;
  v jsonb;
  old jsonb;
  next_specs jsonb;
  mine jsonb := jsonb_build_object('origin', 'customer', 'state', 'approved', 'by', auth.uid(), 'at', now());
begin
  perform app.require_user();
  select * into p from public.products where id = p_product_id for update;
  if not found or not app.can_read(p.workspace_id) then perform app.fail('not_found', 'No such product.'); end if;
  if not app.product_writer(p.workspace_id) then perform app.fail('forbidden', 'Only the people on the brand change its products.'); end if;
  if jsonb_typeof(coalesce(p_values, '[]')) <> 'array' then perform app.fail('invalid', 'Say what to save.'); end if;
  next_specs := p.specs;
  for v in select * from jsonb_array_elements(coalesce(p_values, '[]')) loop
    if nullif(v ->> 'fieldId', '') is null or not v ? 'value' then perform app.fail('invalid', 'Each value needs its field.'); end if;
    select x into old from jsonb_array_elements(next_specs) x where x ->> 'fieldId' = v ->> 'fieldId';
    next_specs := (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(next_specs) x where x ->> 'fieldId' <> v ->> 'fieldId')
      || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('fieldId', v ->> 'fieldId', 'value', v -> 'value', 'unit', v ->> 'unit',
        'provenance', case when old #>> '{provenance,origin}' = 'engine'
          then mine || jsonb_build_object('state', 'changed') || case when jsonb_typeof(old -> 'value') = 'string'
            then jsonb_build_object('was', old ->> 'value') else '{}' end
          else mine end)));
  end loop;
  next_specs := (select coalesce(jsonb_agg(case when x ->> 'fieldId' = any (p_keep) and x #>> '{provenance,state}' = 'proposed'
      then jsonb_set(x, '{provenance}', (x -> 'provenance') || jsonb_build_object('state', 'approved', 'by', auth.uid(), 'at', now()))
      else x end), '[]')
    from jsonb_array_elements(next_specs) x where not (x ->> 'fieldId' = any (coalesce(p_remove, '{}'))));
  update public.products set specs = next_specs, kind_id = coalesce(nullif(p_kind_id, ''), kind_id) where id = p.id returning * into p;
  perform app.record(p.workspace_id, 'product.specs', 'product', p.id, jsonb_build_object('values', jsonb_array_length(coalesce(p_values, '[]'))));
  return to_jsonb(p);
end $$;

revoke execute on function public.add_product(uuid, text, text, text, text, text),
  public.save_product_specs(uuid, text, jsonb, text[], text[]) from public, anon;
grant execute on function public.add_product(uuid, text, text, text, text, text),
  public.save_product_specs(uuid, text, jsonb, text[], text[]) to authenticated;
