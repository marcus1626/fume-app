-- The MVP week's dataset (docs/mvp/acceptance-script.md): the LYSNE brand, Night Body Oil and its facts, and who may
-- sign in to do what. LYSNE is a fictional brand for internal use only. People get their access by invitation: the
-- first time they sign in with that email, the invitation becomes their membership or staff role.
-- Fixed ids so the tests and the app's configuration can name them.

insert into public.organisations (id, name, kind) values
  ('0a000000-0000-4000-8000-000000000001', 'LYSNE', 'brand'),
  ('0a000000-0000-4000-8000-000000000002', 'SOLV', 'brand')
on conflict (id) do nothing;

insert into public.workspaces (id, organisation_id, slug, brand_name, market, language) values
  ('0b000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-000000000001', 'lysne', 'LYSNE', 'Norway', 'en'),
  ('0b000000-0000-4000-8000-000000000002', '0a000000-0000-4000-8000-000000000002', 'solv', 'SOLV', 'Sweden', 'en')
on conflict (id) do nothing;

-- Who signs in (Marcus, 26 Oct). One person may hold several roles. Only a designer with can_check may check; nobody
-- checks their own work; William talks with customers and never checks.
insert into public.invitations (email, workspace_id, role, staff_role, can_check, name, title) values
  ('marcus@fumecreatives.com', null, null, 'admin', false, 'Marcus Blom', 'Founder & CEO'),
  ('marcus@fumecreatives.com', '0b000000-0000-4000-8000-000000000001', null, 'designer', false, null, null),
  ('kristian@fumecreatives.com', null, null, 'admin', false, 'Kristian Eek', 'Founder & COO'),
  ('kristian@fumecreatives.com', '0b000000-0000-4000-8000-000000000001', null, 'designer', true, null, null),
  ('william@fumecreatives.com', '0b000000-0000-4000-8000-000000000001', null, 'account_manager', false, 'William Henriksson', 'Founder & CSO'),
  -- LYSNE's approver for the rehearsal (a fictional brand; the address reaches Marcus's inbox)
  ('marcus+lysne@fumecreatives.com', '0b000000-0000-4000-8000-000000000001', 'approver', null, false, 'LYSNE Approver', 'Brand Manager'),
  -- test-only people for the access checks
  ('member+lysne@fumecreatives.com', '0b000000-0000-4000-8000-000000000001', 'member', null, false, 'Test Member', 'Marketer'),
  ('user+solv@fumecreatives.com', '0b000000-0000-4000-8000-000000000002', 'approver', null, false, 'Test SOLV', 'Brand Manager');

-- Brand DNA v1 (approved), from the demo brand's rules.
insert into public.brand_dna_versions (id, workspace_id, version, state, approved_at) values
  ('0c000000-0000-4000-8000-000000000001', '0b000000-0000-4000-8000-000000000001', 1, 'approved', now())
on conflict (id) do nothing;

insert into public.sources (id, workspace_id, kind, name, retrieved_at, usage_rights) values
  ('0d000000-0000-4000-8000-000000000001', '0b000000-0000-4000-8000-000000000001', 'guideline', 'LYSNE brand guide 2026.pdf', now(), 'Internal use'),
  ('0d000000-0000-4000-8000-000000000002', '0b000000-0000-4000-8000-000000000001', 'packshot', 'Night Body Oil packshot', now(), 'Internal use')
on conflict (id) do nothing;

insert into public.brand_rules (workspace_id, brand_dna_version_id, area, statement, kind, source_id) values
  ('0b000000-0000-4000-8000-000000000001', '0c000000-0000-4000-8000-000000000001', 'logo', 'The wordmark stands alone on the label; never redrawn, never on a busy area.', 'hard_constraint', '0d000000-0000-4000-8000-000000000001'),
  ('0b000000-0000-4000-8000-000000000001', '0c000000-0000-4000-8000-000000000001', 'colour', 'Warm neutrals and amber light. No cold blue light, no saturated colour.', 'rule', '0d000000-0000-4000-8000-000000000001'),
  ('0b000000-0000-4000-8000-000000000001', '0c000000-0000-4000-8000-000000000001', 'type', 'Serif for the name, small caps for the line under it.', 'rule', '0d000000-0000-4000-8000-000000000001'),
  ('0b000000-0000-4000-8000-000000000001', '0c000000-0000-4000-8000-000000000001', 'voice', 'Short, quiet sentences. Speaks of the evening, never of results.', 'rule', '0d000000-0000-4000-8000-000000000001'),
  ('0b000000-0000-4000-8000-000000000001', '0c000000-0000-4000-8000-000000000001', 'imagery', 'Stone, linen and glass. Skin is shown in crops, never a face.', 'rule', '0d000000-0000-4000-8000-000000000001'),
  ('0b000000-0000-4000-8000-000000000001', '0c000000-0000-4000-8000-000000000001', 'layout', 'The product sits low in the frame with air above it.', 'preference', '0d000000-0000-4000-8000-000000000001'),
  ('0b000000-0000-4000-8000-000000000001', '0c000000-0000-4000-8000-000000000001', 'claims', 'No skin-result claims. Only lines on the approved claims list.', 'hard_constraint', '0d000000-0000-4000-8000-000000000001');

insert into public.products (id, workspace_id, name, variant, sku) values
  ('0e000000-0000-4000-8000-000000000001', '0b000000-0000-4000-8000-000000000001', 'Night Body Oil', '100 ml', 'LYS-NBO-100')
on conflict (id) do nothing;

-- Four facts are required for production and wait for the approver's verification (acceptance script, line 2).
insert into public.product_facts (workspace_id, product_id, area, label, statement, origin, status, required, source_id, source_location) values
  ('0b000000-0000-4000-8000-000000000001', '0e000000-0000-4000-8000-000000000001', 'shape', 'Bottle', 'Amber glass, 100 ml, tall and round-shouldered, as in the packshot.', 'supplied', 'unverified', true, '0d000000-0000-4000-8000-000000000002', 'packshot'),
  ('0b000000-0000-4000-8000-000000000001', '0e000000-0000-4000-8000-000000000001', 'colour', 'Cap', 'Burgundy, matte. Never glossy, never black.', 'supplied', 'unverified', true, '0d000000-0000-4000-8000-000000000002', 'packshot'),
  ('0b000000-0000-4000-8000-000000000001', '0e000000-0000-4000-8000-000000000001', 'label', 'Label', 'Cream paper, front and centred, never cropped. LYSNE, then Night Body Oil · 100 ml.', 'supplied', 'unverified', true, '0d000000-0000-4000-8000-000000000002', 'packshot'),
  ('0b000000-0000-4000-8000-000000000001', '0e000000-0000-4000-8000-000000000001', 'colour', 'Oil', 'Reads golden, never orange.', 'supplied', 'unverified', true, '0d000000-0000-4000-8000-000000000002', 'packshot'),
  ('0b000000-0000-4000-8000-000000000001', '0e000000-0000-4000-8000-000000000001', 'never', 'Never', 'Other sizes, a dropper, hands that cover the label.', 'supplied', 'unverified', false, '0d000000-0000-4000-8000-000000000001', 'page 12'),
  ('0b000000-0000-4000-8000-000000000001', '0e000000-0000-4000-8000-000000000001', 'claim', 'Claims', 'Only the lines on the approved list: "For the hour before sleep."', 'supplied', 'unverified', false, '0d000000-0000-4000-8000-000000000001', 'page 14');
