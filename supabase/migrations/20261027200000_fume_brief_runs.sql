-- Fume's suggestions for the brief (the brief form's "Alternatives", docs/mvp/library.md B05) are runs too: the edge
-- function `fume-brief` keeps each one in public.task_runs, with the brand as its subject. A plan's runs stay one per
-- attempt; a brief's runs are many per brand.
alter table public.task_runs drop constraint if exists task_runs_kind_check;
alter table public.task_runs add constraint task_runs_kind_check check (kind in ('plan', 'brief'));
alter table public.task_runs drop constraint if exists task_runs_subject_id_attempt_key;
create unique index if not exists task_runs_plan_attempt on public.task_runs (subject_id, attempt) where kind = 'plan';

-- What the model may read for a brand's brief: the brand, the named products with their current facts.
create or replace function public.fume_brief_context(p_workspace_id uuid, p_product_ids uuid[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'brand', (select jsonb_build_object('name', w.brand_name, 'market', w.market, 'language', w.language)
              from public.workspaces w where w.id = p_workspace_id),
    'products', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', pr.id, 'name', pr.name, 'variant', pr.variant,
        'facts', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'area', f.area, 'label', f.label,
                    'statement', f.statement, 'status', f.status) order by f.area, f.label), '[]')
                  from public.product_facts f where f.product_id = pr.id and f.superseded_by is null)
      ) order by pr.name), '[]')
      from public.products pr where pr.workspace_id = p_workspace_id and pr.id = any (coalesce(p_product_ids, '{}'))
    ),
    'rules', (
      select coalesce(jsonb_agg(jsonb_build_object('text', r.statement, 'kind', r.kind, 'area', r.area)), '[]')
      from public.brand_rules r join public.brand_dna_versions d on d.id = r.brand_dna_version_id and d.state = 'approved'
      where r.workspace_id = p_workspace_id
    )
  )
$$;
revoke execute on function public.fume_brief_context(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.fume_brief_context(uuid, uuid[]) to service_role;
grant select, insert on public.task_runs to service_role;
