-- The Engine reads the design system the customer approved (docs/mvp/brand-books.md): its colours are confirmed
-- brand colours in the brain, before the Brand DNA's, which may still be only proposed.

create or replace function app.engine_brain(ws uuid, p_campaign_id uuid, p_title text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform app.brain_fresh(ws);
  return jsonb_build_object(
    'market', (select jsonb_strip_nulls(jsonb_build_object('market', nullif(w.market, ''), 'language', nullif(w.language, '')))
               from public.workspaces w where w.id = ws),
    -- The colours of the design system the customer approved are hers (confirmed); the Brand DNA's colours come
    -- after, each hex once.
    'palette', coalesce((
      select jsonb_agg(c - 'rank' order by c ->> 'rank', c ->> 'name') from (
        select distinct on (upper(x ->> 'hex')) x c from (
          select jsonb_strip_nulls(jsonb_build_object('id', 'design-' || (col ->> 'role'), 'name', col ->> 'name',
              'hex', upper(col ->> 'hex'), 'role', col ->> 'role', 'use', col ->> 'use', 'confidence', 'high',
              'confirmed', true, 'source', 'design_system', 'rank', '0')) x
          from public.brand_books b, jsonb_array_elements(coalesce(b.body -> 'colours', '[]')) col
          where b.workspace_id = ws and b.kind = 'design' and b.state = 'approved' and col ->> 'hex' ~* '^#[0-9a-f]{6}$'
          union all
          select jsonb_strip_nulls(jsonb_build_object('id', n.id, 'name', n.label, 'hex', upper(n.body ->> 'hex'),
              'role', n.body ->> 'role', 'use', coalesce(n.body ->> 'usage', n.body ->> 'use'), 'confidence', n.confidence,
              'confirmed', n.state in ('approved', 'changed'), 'rank', '1'))
          from public.brain_nodes n
          where n.workspace_id = ws and n.layer = 'identity' and n.kind = 'colour' and n.state not in ('removed', 'contradicted')
            and n.body ->> 'hex' ~* '^#[0-9a-f]{6}$'
        ) y order by upper(x ->> 'hex'), x ->> 'rank'
      ) z), '[]'),
    'imagery', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'what', n.label, 'confirmed', n.state in ('approved', 'changed')) order by n.created_at)
      from public.brain_nodes n
      where n.workspace_id = ws and n.layer = 'identity' and n.kind = 'image' and n.state not in ('removed', 'contradicted')), '[]'),
    -- Knowledge with no table of its own: what people told Fume about the brand, its market and its pictures.
    'notes', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'layer', n.layer, 'kind', n.kind, 'what', n.label,
          'confirmed', n.state = 'approved') order by n.created_at desc)
      from (select * from public.brain_nodes where workspace_id = ws and ref_table is null
              and layer in ('identity', 'rules', 'market', 'memory', 'products') and state not in ('removed', 'contradicted')
            order by created_at desc limit 20) n), '[]'),
    -- What people asked to change in the brand's other creatives, newest first: this creative's own is the job's change.
    'changes', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', n.id, 'what', n.label, 'cause', n.body ->> 'cause',
          'from', n.body ->> 'from', 'creative', n.body ->> 'creative', 'must_change', n.body -> 'must_change',
          'this_campaign', n.body ->> 'campaign_id' = p_campaign_id::text)) order by n.at desc)
      from (select *, coalesce(body ->> 'at', created_at::text) at from public.brain_nodes
            where workspace_id = ws and layer = 'memory' and kind = 'change'
              and not (body ->> 'campaign_id' = p_campaign_id::text and body ->> 'creative' = p_title)
            order by coalesce(body ->> 'at', created_at::text) desc limit 12) n), '[]'),
    'checks', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'what', n.label, 'state', n.body ->> 'state', 'creative', n.body ->> 'creative') order by n.at desc)
      from (select *, coalesce(body ->> 'at', created_at::text) at from public.brain_nodes
            where workspace_id = ws and layer = 'memory' and kind = 'check'
              and not (body ->> 'campaign_id' = p_campaign_id::text and body ->> 'creative' = p_title)
            order by coalesce(body ->> 'at', created_at::text) desc limit 8) n), '[]')
  );
end $$;
revoke execute on function app.engine_brain(uuid, uuid, text) from public, anon, authenticated;
