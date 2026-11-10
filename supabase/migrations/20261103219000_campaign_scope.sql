-- What a campaign is about, live: single products and whole collections. A collection brings all its products, and a
-- product added to the collection later joins the campaigns that hold it while they are still at the brief or the
-- plan. Once production starts, the products stay as they are.

create table public.campaign_collections (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  collection_id uuid not null references public.collections (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  primary key (campaign_id, collection_id)
);
create index campaign_collections_collection_id_idx on public.campaign_collections (collection_id);
create index campaign_collections_workspace_id_idx on public.campaign_collections (workspace_id);
alter table public.campaign_collections enable row level security;
create policy campaign_collections_read on public.campaign_collections for select to authenticated
  using (app.can_read(workspace_id));
grant select on public.campaign_collections to authenticated;

-- The products and collections of a campaign, set whole. The products are the ones picked plus every product of the
-- collections picked.
create or replace function public.set_campaign_scope(p_campaign_id uuid, p_product_ids uuid[], p_collection_ids uuid[])
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c public.campaigns;
  wanted uuid[];
begin
  perform app.require_user();
  select * into c from public.campaigns where id = p_campaign_id for update;
  if not found or not app.can_read(c.workspace_id) then perform app.fail('not_found', 'No such campaign.'); end if;
  if not app.can_plan(c.workspace_id) then perform app.fail('forbidden', 'Viewers cannot change a campaign.'); end if;
  if c.stage not in ('brief', 'plan') or c.state in ('delivered', 'closed') then
    perform app.fail('invalid', 'The products stay as they are once production starts.');
  end if;
  if exists (select 1 from unnest(coalesce(p_collection_ids, '{}')) x (id)
             where not exists (select 1 from public.collections k where k.id = x.id and k.workspace_id = c.workspace_id)) then
    perform app.fail('invalid', 'A collection is not in this brand.');
  end if;
  if exists (select 1 from unnest(coalesce(p_product_ids, '{}')) x (id)
             where not exists (select 1 from public.products p where p.id = x.id and p.workspace_id = c.workspace_id)) then
    perform app.fail('invalid', 'A product is not in this brand.');
  end if;
  select coalesce(array_agg(distinct id), '{}') into wanted from (
    select unnest(coalesce(p_product_ids, '{}')) id
    union select cp.product_id from public.collection_products cp where cp.collection_id = any (coalesce(p_collection_ids, '{}'))
  ) x;
  if cardinality(wanted) = 0 then perform app.fail('invalid', 'A campaign needs at least one product.'); end if;

  delete from public.campaign_products where campaign_id = c.id and product_id <> all (wanted);
  insert into public.campaign_products (campaign_id, product_id, workspace_id)
  select c.id, id, c.workspace_id from unnest(wanted) id on conflict do nothing;
  delete from public.campaign_collections where campaign_id = c.id and collection_id <> all (coalesce(p_collection_ids, '{}'));
  insert into public.campaign_collections (campaign_id, collection_id, workspace_id)
  select c.id, id, c.workspace_id from unnest(coalesce(p_collection_ids, '{}')) id on conflict do nothing;
  perform app.record(c.workspace_id, 'campaign.scope_changed', 'campaign', c.id,
    jsonb_build_object('products', cardinality(wanted), 'collections', coalesce(cardinality(p_collection_ids), 0)));
  return jsonb_build_object('campaignId', c.id, 'productIds', to_jsonb(wanted),
    'collectionIds', to_jsonb(coalesce(p_collection_ids, '{}')));
end $$;

-- A product that joins a collection joins the open campaigns that hold the collection.
create or replace function app.collection_product_joins() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.campaign_products (campaign_id, product_id, workspace_id)
  select cc.campaign_id, new.product_id, cc.workspace_id
  from public.campaign_collections cc join public.campaigns c on c.id = cc.campaign_id
  where cc.collection_id = new.collection_id and c.stage in ('brief', 'plan') and c.state not in ('delivered', 'closed')
  on conflict do nothing;
  return null;
end $$;
create trigger collection_product_joins after insert on public.collection_products
  for each row execute function app.collection_product_joins();

revoke execute on function app.collection_product_joins() from public, anon, authenticated;
revoke execute on function public.set_campaign_scope(uuid, uuid[], uuid[]) from public, anon;
grant execute on function public.set_campaign_scope(uuid, uuid[], uuid[]) to authenticated;
