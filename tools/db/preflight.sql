-- Friday's preflight (docs/mvp/acceptance-script.md): is the live database ready for the rehearsal? Read only.
-- Run it with the Supabase SQL editor or the Management API. Each line says ready or what is missing.
with
  ws as (select id from public.workspaces where slug = 'lysne'),
  oil as (select p.id from public.products p join ws on ws.id = p.workspace_id where p.name = 'Night Body Oil'),
  person as (
    select p.email, p.staff_role, u.last_sign_in_at
    from public.profiles p left join auth.users u on u.id = p.id
  ),
  lines (n, what, ready, detail) as (
    values
    (1, 'LYSNE and Night Body Oil exist', exists (select 1 from oil), null::text),
    (2, 'Night Body Oil has its six facts',
      (select count(*) from public.product_facts f join oil on oil.id = f.product_id where f.superseded_by is null) >= 6,
      (select count(*)::text || ' facts' from public.product_facts f join oil on oil.id = f.product_id where f.superseded_by is null)),
    (3, 'Night Body Oil has a picture of its own',
      exists (select 1 from public.sources s join oil on oil.id = s.product_id where s.file_id is not null),
      'The approver adds the front picture when confirming the product (line 2)'),
    (4, 'Brand DNA is approved', exists (select 1 from public.brand_dna_versions d join ws on ws.id = d.workspace_id where d.state = 'approved'), null),
    (5, 'The approver has signed in', exists (select 1 from person where email = 'marcus+lysne@fumecreatives.com' and last_sign_in_at is not null), null),
    (6, 'Marcus designs on LYSNE',
      exists (select 1 from public.staff_assignments s join public.profiles p on p.id = s.user_id join ws on ws.id = s.workspace_id
              where p.email = 'marcus@fumecreatives.com' and s.staff_role = 'designer'), null),
    (7, 'Kristian may check on LYSNE',
      exists (select 1 from public.staff_assignments s join public.profiles p on p.id = s.user_id join ws on ws.id = s.workspace_id
              where p.email = 'kristian@fumecreatives.com' and s.can_check), null),
    (8, 'William (account manager) has signed in', exists (select 1 from person where email = 'william@fumecreatives.com'),
      'Line 10: William is refused the check. He signs in once with his invitation'),
    (9, 'The test member and the SOLV test user can sign in',
      (select count(*) from public.invitations where email in ('member+lysne@fumecreatives.com', 'user+solv@fumecreatives.com')) = 2,
      'Line 17: both are Marcus''s own plus addresses'),
    (10, 'Fume writes plans with the language model', app.setting_on('llm_plans'),
      'Off until ANTHROPIC_API_KEY is set; with it off the plan is written from the brief'),
    (11, 'No campaign is left from an earlier try', not exists (select 1 from public.campaigns c join ws on ws.id = c.workspace_id), null)
  )
select n, what, case when ready then 'ready' else 'missing' end as state, case when ready then null else detail end as detail
from lines order by n;

-- What Fume's language model did, newest first: failures and cost (plan Wednesday, daily checks).
-- select kind, state, attempt, model, error, input_tokens, output_tokens, cost_usd, started_at from public.task_runs order by started_at desc limit 20;
