-- Manual production in the Studio (docs/mvp/code-map.md §3 rows 7, 8, 11, 12; until the Engine runs on Wednesday).
-- The Studio holds one document per creative. A designer opens the document for a planned creative before anything
-- is made, so the creative exists (with no version, which nobody outside Fume can see) and every picture she adds
-- becomes a candidate of that creative's job. Three commands and one change:
--   open_creative       the creative for a planned slot of the approved plan (or a format or variant of an approved
--                       master version); the same slot opens the same creative.
--   add_manual_version  a picture made by hand, with how it was made, as a candidate of the creative's open manual
--                       job (started here when there is none): no separate start_job from the Studio.
--   uncheck_version     the expert's Undo of a check, while the version has not been sent to the customer.
--   send_to_check       a candidate of a job that names its creative becomes that creative's first version, instead of
--                       a new creative.

alter table public.creatives add column if not exists slot text;
comment on column public.creatives.slot is 'The planned creative it fills, by its id in the plan''s planned_creatives (pc1).';
create unique index if not exists creatives_campaign_slot on public.creatives (campaign_id, slot) where slot is not null;

-- ─── Opening a creative ──────────────────────────────────────────────────────

-- What kind of creative a planned one is: a master, or, made from its master, a variant in the master's format or a
-- format in another.
create or replace function app.planned_kind(p_planned jsonb, p_master_format text) returns text
language sql immutable set search_path = '' as $$
  select case
    when coalesce(p_planned ->> 'kind', 'master') = 'master' then 'master'
    when p_planned ->> 'kind' = 'format' or p_planned ->> 'format' is distinct from p_master_format then 'format'
    else 'variant'
  end
$$;

-- The approved version of a master creative that its variants and formats are made from, or null.
create or replace function app.approved_master_version(p_master uuid) returns public.creative_versions
language sql stable security definer set search_path = '' as $$
  select * from public.creative_versions
  where creative_id = p_master and state in ('approved', 'delivered')
    and number = (select max(number) from public.creative_versions where creative_id = p_master)
$$;

-- Opens the creative a designer makes in the Studio. With p_slot: that planned creative. With p_master_version_id: a
-- format (p_format) or a variant of that approved master version, the planned one when the plan has it. With neither:
-- the next planned creative that can be made now (masters first; a variant or format once its master is approved),
-- else one opened before and not made yet, else a new variant of the campaign's approved master.
create or replace function public.open_creative(
  p_campaign_id uuid, p_slot text default null, p_kind text default null, p_format text default null,
  p_master_version_id uuid default null, p_title text default null, p_key text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('campaign_id', p_campaign_id, 'slot', p_slot, 'kind', p_kind, 'format', p_format,
                                  'master_version_id', p_master_version_id, 'title', p_title);
  prior jsonb;
  c public.campaigns;
  p public.plan_versions;
  planned jsonb;
  pc jsonb;
  x jsonb;
  master public.creatives;
  mv public.creative_versions;
  cr public.creatives;
  v_kind text;
  v_format text;
  v_title text;
  ws_slug text;
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'open_creative', req);
  if prior is not null then return prior; end if;

  -- One open at a time per campaign, so two presses never make two creatives for one slot.
  select * into c from public.campaigns where id = p_campaign_id for update;
  if not found or not app.can_read(c.workspace_id) then
    perform app.fail('not_found', 'No such campaign.');
  end if;
  if not app.is_staff(c.workspace_id, array['designer']) then
    perform app.fail('forbidden', 'Only a designer opens a creative in the Studio.');
  end if;
  select * into p from public.plan_versions where campaign_id = c.id and state = 'approved' order by version desc limit 1;
  if not found then
    perform app.fail('invalid', 'The plan is not approved yet.');
  end if;
  planned := case when jsonb_typeof(p.body -> 'planned_creatives') = 'array' then p.body -> 'planned_creatives' else '[]' end;

  if p_master_version_id is not null then
    -- A format or a variant of a named master version.
    select * into mv from public.creative_versions where id = p_master_version_id;
    if not found or mv.workspace_id <> c.workspace_id then
      perform app.fail('invalid', 'Name the master version this derives from.');
    end if;
    select * into master from public.creatives where id = mv.creative_id;
    if master.kind <> 'master' or master.campaign_id <> c.id or mv.state not in ('approved', 'delivered')
       or mv.number <> (app.latest_version(master.id)).number then
      perform app.fail('invalid', 'Variants and formats need an approved master.');
    end if;
    v_kind := coalesce(p_kind, 'format');
    v_format := coalesce(p_format, master.format);
    if v_kind not in ('variant', 'format') then
      perform app.fail('invalid', 'A creative made from a master is a variant or a format.');
    end if;
    if v_kind = 'format' then
      select y into pc from jsonb_array_elements(planned) y
      where y ->> 'of' = master.slot and y ->> 'format' = v_format and app.planned_kind(y, master.format) = 'format'
      limit 1;
      select * into cr from public.creatives
      where campaign_id = c.id and master_id = master.id and kind = 'format' and format = v_format
      order by created_at limit 1;
      if found then
        return app.idem_end(p_key, 'open_creative', req, to_jsonb(cr));
      end if;
    end if;
  elsif p_slot is not null then
    -- A named planned creative.
    select * into cr from public.creatives where campaign_id = c.id and slot = p_slot;
    if found then
      return app.idem_end(p_key, 'open_creative', req, to_jsonb(cr));
    end if;
    select y into pc from jsonb_array_elements(planned) y where y ->> 'id' = p_slot or y ->> 'name' = p_slot limit 1;
    if pc is null then
      perform app.fail('invalid', format('The approved plan has no creative %s.', p_slot));
    end if;
    select * into cr from public.creatives where campaign_id = c.id and slot = pc ->> 'id';
    if found then
      return app.idem_end(p_key, 'open_creative', req, to_jsonb(cr));
    end if;
  else
    -- The next planned creative that can be made now.
    for x in select y from jsonb_array_elements(planned) y loop
      continue when exists (select 1 from public.creatives where campaign_id = c.id and slot = x ->> 'id');
      if coalesce(x ->> 'kind', 'master') = 'master' then
        pc := x;
        exit;
      end if;
      select * into master from public.creatives where campaign_id = c.id and slot = x ->> 'of' and kind = 'master';
      if found and (app.approved_master_version(master.id)).id is not null then
        pc := x;
        exit;
      end if;
    end loop;
    if pc is null then
      -- One opened before and not made yet.
      select * into cr from public.creatives cr0
      where cr0.campaign_id = c.id and not exists (select 1 from public.creative_versions v where v.creative_id = cr0.id)
      order by cr0.created_at limit 1;
      if found then
        return app.idem_end(p_key, 'open_creative', req, to_jsonb(cr));
      end if;
      -- Else a new variant of the approved master.
      select m.* into master from public.creatives m
      where m.campaign_id = c.id and m.kind = 'master' and (app.approved_master_version(m.id)).id is not null
      order by m.created_at limit 1;
      if not found then
        perform app.fail('conflict', 'Every planned creative that can be made now is open in the Studio. The rest wait for the customer to approve the master.');
      end if;
      mv := app.approved_master_version(master.id);
      v_kind := 'variant';
      v_format := master.format;
    end if;
  end if;

  -- A planned creative: its kind and format, and for a variant or format its approved master.
  if pc is not null then
    if coalesce(pc ->> 'kind', 'master') = 'master' then
      v_kind := 'master';
      master := null;
    else
      if master.id is null or master.slot is distinct from pc ->> 'of' then
        select * into master from public.creatives where campaign_id = c.id and slot = pc ->> 'of' and kind = 'master';
      end if;
      if master.id is null or (app.approved_master_version(master.id)).id is null then
        perform app.fail('invalid', 'Variants and formats need an approved master.');
      end if;
      v_kind := app.planned_kind(pc, master.format);
    end if;
    v_format := coalesce(pc ->> 'format', v_format, 'feed');
  end if;
  v_format := coalesce(v_format, p_format, 'feed');
  if v_format not in ('feed', 'square', 'story', 'banner') then
    perform app.fail('invalid', format('%s is not a format.', v_format));
  end if;

  v_title := coalesce(nullif(trim(p_title), ''), pc ->> 'name', case
    when v_kind = 'master' then 'Master ' || ((select count(*) from public.creatives where campaign_id = c.id and kind = 'master') + 1)
    when v_kind = 'format' then initcap(v_format) || ' from ' || master.title
    else 'Variant ' || ((select count(*) from public.creatives where master_id = master.id and kind = 'variant') + 1) || ' from ' || master.title
  end);
  select slug into ws_slug from public.workspaces where id = c.workspace_id;
  insert into public.creatives (workspace_id, campaign_id, master_id, kind, format, name, title, slot)
  values (
    c.workspace_id, c.id, case when v_kind <> 'master' then master.id end, v_kind, v_format,
    ws_slug || '_' || v_kind || '_' || v_format || '_' || left(replace(gen_random_uuid()::text, '-', ''), 6),
    v_title, pc ->> 'id'
  ) returning * into cr;
  perform app.record(c.workspace_id, 'creative.opened', 'creative', cr.id,
    jsonb_build_object('title', cr.title, 'kind', cr.kind, 'slot', cr.slot));
  return app.idem_end(p_key, 'open_creative', req, to_jsonb(cr));
end $$;

-- ─── A picture made by hand ──────────────────────────────────────────────────

-- The picture (registered as a candidate file) becomes a candidate of the creative's manual job: its first version's
-- job (master, variant or format, from the approved master version), or a correction once a version waits for one.
-- The job starts here with its context snapshot when none is open, under the same rules as start_job.
create or replace function public.add_manual_version(
  p_creative_id uuid, p_file_id uuid, p_note text, p_key text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('creative_id', p_creative_id, 'file_id', p_file_id, 'note', p_note);
  prior jsonb;
  cr public.creatives;
  v public.creative_versions;
  mv public.creative_versions;
  j public.production_jobs;
  v_kind text;
  cand jsonb;
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'add_manual_version', req);
  if prior is not null then return prior; end if;

  select * into cr from public.creatives where id = p_creative_id for update;
  if not found or not app.can_read(cr.workspace_id) then
    perform app.fail('not_found', 'No such creative.');
  end if;
  if not app.is_staff(cr.workspace_id, array['designer']) then
    perform app.fail('forbidden', 'Only a designer adds a candidate.');
  end if;
  if coalesce(trim(p_note), '') = '' then
    perform app.fail('invalid', 'Say how a manual candidate was made.');
  end if;
  v := app.latest_version(cr.id);
  if v.id is null then
    v_kind := cr.kind;
    if v_kind in ('variant', 'format') then
      mv := app.approved_master_version(cr.master_id);
      if mv.id is null then
        perform app.fail('invalid', 'Variants and formats need an approved master.');
      end if;
    end if;
  elsif v.state in ('changes_requested', 'correcting', 'held') then
    v_kind := 'correction';
  else
    perform app.fail('conflict', format(
      'Version %s is %s. A new version follows the expert''s correction or the customer''s changes.',
      v.number, replace(v.state, '_', ' ')));
  end if;

  -- The open job: this creative's, of this kind, that no version has come from yet.
  select * into j from public.production_jobs pj
  where pj.creative_id = cr.id and pj.kind = v_kind and pj.state <> 'cancelled'
    and not exists (select 1 from public.creative_versions x where x.job_id = pj.id)
  order by pj.created_at desc limit 1;
  if not found then
    select * into j from jsonb_populate_record(null::public.production_jobs, public.start_job(
      cr.campaign_id, v_kind,
      jsonb_build_object('provider', 'manual', 'creative', cr.title, 'slot', cr.slot, 'format', cr.format),
      '[]', cr.id, mv.id, 'manual', null));
    update public.production_jobs set creative_id = cr.id where id = j.id;
  end if;
  cand := public.add_candidate(j.id, p_file_id, 'manual', p_note, null);
  return app.idem_end(p_key, 'add_manual_version', req, cand);
end $$;

-- ─── To check: a candidate of a job that names its creative ──────────────────

-- As in 20261026140200_commands.sql, with one change: a master, variant or format job whose creative was opened in
-- the Studio (production_jobs.creative_id) makes that creative's first version instead of a new creative.
create or replace function public.send_to_check(
  p_candidate_id uuid, p_format text default 'feed', p_title text default null, p_key text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  req jsonb := jsonb_build_object('candidate_id', p_candidate_id, 'format', p_format, 'title', p_title);
  prior jsonb;
  cand public.candidates;
  j public.production_jobs;
  cr public.creatives;
  mv public.creative_versions;
  prev public.creative_versions;
  v public.creative_versions;
  ws_slug text;
begin
  perform app.require_user();
  prior := app.idem_begin(p_key, 'send_to_check', req);
  if prior is not null then return prior; end if;

  select * into cand from public.candidates where id = p_candidate_id;
  if not found or not app.can_read(cand.workspace_id) then
    perform app.fail('not_found', 'No such candidate.');
  end if;
  if not app.is_staff(cand.workspace_id, array['designer']) then
    perform app.fail('forbidden', 'Only a designer sends work to check.');
  end if;
  if exists (select 1 from public.creative_versions where candidate_id = cand.id) then
    perform app.fail('conflict', 'This candidate is already a version.');
  end if;
  select * into j from public.production_jobs where id = cand.job_id for update;
  select slug into ws_slug from public.workspaces where id = cand.workspace_id;

  if j.kind = 'correction' then
    select * into cr from public.creatives where id = j.creative_id;
    prev := app.latest_version(cr.id);
    if prev.state not in ('changes_requested', 'correcting', 'held') then
      perform app.fail('conflict', 'This creative is not waiting for a new version.');
    end if;
  elsif j.creative_id is not null then
    select * into cr from public.creatives where id = j.creative_id for update;
    if (app.latest_version(cr.id)).id is not null then
      perform app.fail('conflict', 'This creative has its first version already. A new one follows a correction or the customer''s changes.');
    end if;
  else
    if j.kind in ('variant', 'format') then
      select * into mv from public.creative_versions where id = j.master_version_id;
    end if;
    insert into public.creatives (workspace_id, campaign_id, master_id, kind, format, name, title)
    values (
      cand.workspace_id, j.campaign_id,
      case when j.kind in ('variant', 'format') then mv.creative_id end,
      j.kind, p_format,
      ws_slug || '_' || j.kind || '_' || p_format || '_' || left(replace(gen_random_uuid()::text, '-', ''), 6),
      coalesce(p_title, initcap(j.kind) || ' · ' || p_format)
    ) returning * into cr;
  end if;

  insert into public.creative_versions (workspace_id, creative_id, number, state, file_id, candidate_id, job_id, master_version_id)
  values (
    cand.workspace_id, cr.id, coalesce(prev.number, 0) + 1, 'in_check', cand.file_id, cand.id, j.id,
    coalesce(j.master_version_id, prev.master_version_id)
  ) returning * into v;
  insert into public.expert_checks (workspace_id, version_id, snapshot_id) values (v.workspace_id, v.id, j.snapshot_id);
  update public.change_requests set new_version_id = v.id
  where prev.id is not null and version_id = prev.id and new_version_id is null;
  perform app.record(v.workspace_id, 'version.in_check', 'creative_version', v.id,
    jsonb_build_object('creative', cr.title, 'number', v.number));
  return app.idem_end(p_key, 'send_to_check', req, to_jsonb(v));
end $$;

-- ─── The expert's Undo ───────────────────────────────────────────────────────

-- The check just made, undone by the one who made it: the version waits for a check again. Only while it has not been
-- sent: once the customer can see it, it stays checked.
create or replace function public.uncheck_version(p_version_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.creative_versions;
begin
  perform app.require_user();
  v := app.checkable_version(p_version_id);
  if v.state <> 'checked' then
    perform app.fail('conflict', 'This version is not checked.');
  end if;
  if not exists (select 1 from public.expert_checks where version_id = v.id and expert_id = auth.uid()) then
    perform app.fail('forbidden', 'Only the one who checked it can undo the check.');
  end if;
  if v.sent_at is not null then
    perform app.fail('conflict', 'It was sent to the customer, so it stays checked. Ask for changes on it instead.');
  end if;
  update public.creative_versions set state = 'in_check' where id = v.id returning * into v;
  update public.expert_checks set state = 'waiting', expert_id = null, decided_at = null, items = '[]', note = null
  where version_id = v.id;
  perform app.record(v.workspace_id, 'version.check_undone', 'creative_version', v.id);
  return to_jsonb(v);
end $$;

-- ─── Grants ──────────────────────────────────────────────────────────────────

revoke execute on function app.planned_kind(jsonb, text) from public, anon;
revoke execute on function app.approved_master_version(uuid) from public, anon;
grant execute on function app.planned_kind(jsonb, text), app.approved_master_version(uuid) to authenticated;
revoke execute on function public.open_creative(uuid, text, text, text, uuid, text, text) from public, anon;
revoke execute on function public.add_manual_version(uuid, uuid, text, text) from public, anon;
revoke execute on function public.uncheck_version(uuid) from public, anon;
grant execute on function public.open_creative(uuid, text, text, text, uuid, text, text),
  public.add_manual_version(uuid, uuid, text, text), public.uncheck_version(uuid) to authenticated;
