-- FLOWS §38 use. Isolated from the shared Engine fixtures; no provider or storage network calls.
reset role;
begin;
insert into public.invitations(email,workspace_id,staff_role,can_check)
values('shoot-expert@fumecreatives.com',test.id('lysne'),'designer',true);
select test.signup('shoot-expert@fumecreatives.com');
select test.act('marcus+lysne@fumecreatives.com');
insert into public.files(workspace_id,path,name,content_type,bytes,purpose,uploaded_by,width,height)
values(test.id('lysne'),test.id('lysne') || '/use-photo.jpg','use-photo.jpg','image/jpeg',120,'source',auth.uid(),800,1000)
returning test.keep('use_original',id);
insert into public.files(workspace_id,path,name,content_type,bytes,purpose,uploaded_by)
values(test.id('lysne'),test.id('lysne') || '/use-clip.mov','use-clip.mov','video/quicktime',120,'source',auth.uid())
returning test.keep('use_clip_file',id);
set role authenticated;
select test.keep('use_campaign',(public.create_campaign(test.id('lysne'),'Photo masters',array[test.id('oil')])->>'id')::uuid);
select public.send_brief(test.id('use_campaign'),'{"objective":"Real photographs","audience":"Women 30-50","message":"Real product, warm light","formats":"feed","count":"2"}');
select public.approve_plan(test.id('use_campaign'),1);
select test.keep('use_shoot',(public.add_shoot(test.id('lysne'),'Portrait day',null,'{"people":"unsure"}',
  jsonb_build_array(jsonb_build_object('fileId',test.id('use_original'),'kind','photo'),
    jsonb_build_object('fileId',test.id('use_clip_file'),'kind','clip','seconds',6)))->>'id')::uuid);
reset role;
select test.keep('use_picture',id) from public.shoot_pictures where shoot_id=test.id('use_shoot') and kind='photo';
select test.keep('use_clip',id) from public.shoot_pictures where shoot_id=test.id('use_shoot') and kind='clip';
set role authenticated;
select test.refuses($$select public.move_shoot_picture(test.id('use_picture'),'pick')$$,'forbidden','customer cannot move picks');
select test.refuses($$select public.check_shoot_picks(test.id('use_shoot'))$$,'forbidden','customer cannot check picks');
select test.refuses($$select public.use_shoot_in_campaign(test.id('use_shoot'),test.id('use_campaign'))$$,'forbidden','customer cannot make a photo creative');
select test.act('marcus@fumecreatives.com');
select test.refuses($$select public.check_shoot_picks(test.id('use_shoot'))$$,'forbidden','admin only reads shoots');
select test.refuses($$select public.use_shoot_in_campaign(test.id('use_shoot'),test.id('use_campaign'))$$,'forbidden','admin does not make photo creatives');
select test.act('shoot-expert@fumecreatives.com');
select test.refuses($$select public.move_shoot_picture(test.id('use_picture'),'pick')$$,'invalid','assessment must finish before moves');
reset role;
update public.shoots set state='read' where id=test.id('use_shoot');
update public.shoot_pictures set engine_read='{"sort":"rest","why":"Kept for later","sharp":true}' where shoot_id=test.id('use_shoot');
set role authenticated;
select test.refuses($$select public.check_shoot_picks(test.id('use_shoot'))$$,'invalid','at least one pick is required');
select test.refuses($$select public.move_shoot_picture(test.id('use_clip'),'pick')$$,'invalid','clips never become photo picks');
select test.refuses($$select public.move_shoot_picture(test.id('use_picture'),'other')$$,'invalid','sort is validated');
select test.ok(public.move_shoot_picture(test.id('use_picture'),'pick')#>>'{pictures,0,moved,sort}'='pick','expert move wins over the read');
select test.ok(public.check_shoot_picks(test.id('use_shoot'))->>'checkedBy'=auth.uid()::text,'check records the real expert');
select test.act('marcus+lysne@fumecreatives.com');
select test.ok(public.get_shoot(test.id('use_shoot'))#>>'{pictures,0,moved,sort}'='pick','customer sees picks after their check');
select test.act('shoot-expert@fumecreatives.com');
select public.move_shoot_picture(test.id('use_picture'),'rest');
select test.ok(not(public.get_shoot(test.id('use_shoot')) ? 'checkedBy'),'a move reopens the check');
select test.act('marcus+lysne@fumecreatives.com');
select test.ok(not(public.get_shoot(test.id('use_shoot'))#>'{pictures,0}' ? 'read'),'reopened assessment is private again');
select test.act('shoot-expert@fumecreatives.com');
select public.move_shoot_picture(test.id('use_picture'),'pick');
select test.refuses($$select public.use_shoot_in_campaign(test.id('use_shoot'),test.id('use_campaign'))$$,'invalid','unchecked picks cannot be used');
select public.check_shoot_picks(test.id('use_shoot'));
select test.refuses($$select public.use_shoot_in_campaign(test.id('use_shoot'),test.id('use_campaign'))$$,'invalid','unsure people block a checked shoot');
select public.update_shoot_rights(test.id('use_shoot'),'{"people":"released","until":"2000-01-01"}');
select test.refuses($$select public.use_shoot_in_campaign(test.id('use_shoot'),test.id('use_campaign'))$$,'invalid','expired rights block a checked shoot');
select public.update_shoot_rights(test.id('use_shoot'),jsonb_build_object('people','released','until',current_date));
select test.refuses($$select public.use_shoot_in_campaign(test.id('use_shoot'),test.id('use_campaign'),array[test.id('use_clip')])$$,'invalid','explicit clip selection is refused atomically');
select test.refuses($$select public.use_shoot_in_campaign(test.id('use_shoot'),test.id('use_campaign'),'{}'::uuid[])$$,'invalid','empty selection makes nothing');
select test.keep('photo_master',(public.use_shoot_in_campaign(test.id('use_shoot'),test.id('use_campaign'),array[test.id('use_picture')])#>>'{documentIds,0}')::uuid);
select test.ok((select kind='master' and protected_photo and format='feed' from public.creatives where id=test.id('photo_master')),'photo becomes a protected master of its own shape');
select test.ok((select number=1 and state='making' and protected_photo and file_id=test.id('use_original') and sent_at is null
  from public.creative_versions where creative_id=test.id('photo_master')),'the original is private V1, with protection');
select test.ok((select state='succeeded' and mode='manual' and cost_cents=0 from public.production_jobs where creative_id=test.id('photo_master')),'no generation and no charge');
select test.ok((select state='in_production' and stage='masters' from public.campaigns where id=test.id('use_campaign')),'live use opens the Masters step');
select test.ok(public.get_shoot(test.id('use_shoot'))#>>'{pictures,0,usedIn,0,documentId}'=test.id('photo_master')::text,'used-in records the new creative');
reset role;
select test.keep('photo_candidate',id) from public.candidates where job_id=(select id from public.production_jobs where creative_id=test.id('photo_master'));
set role authenticated;
select test.ok((public.send_to_check(test.id('photo_candidate'))->>'number')::int=1,'sending the original to Check keeps V1');
reset role;
select test.ok((select count(*)=1 from public.findings f join public.creative_versions v on v.id=f.version_id
  where v.creative_id=test.id('photo_master') and f.dimension='file_spec'
    and f.finding='The picture is smaller than the channel shows it.'),'submitting private V1 runs the file check');
set role authenticated;
select test.act('marcus+lysne@fumecreatives.com');
select test.ok((select count(*)=0 from public.creative_versions where creative_id=test.id('photo_master')),'customer never sees an unchecked photo master');
select test.act('shoot-expert@fumecreatives.com');
reset role;
-- Bypass the app and existing commands: the database still refuses direct Engine jobs.
select test.refuses($$insert into public.production_jobs(workspace_id,campaign_id,kind,creative_id,snapshot_id,requested_by)
  select workspace_id,campaign_id,'correction',creative_id,snapshot_id,requested_by from public.production_jobs
  where creative_id=test.id('photo_master')$$,'invalid','direct correction jobs on a person photo are refused');
select test.refuses($$select public.engine_take(id) from public.production_jobs where creative_id=test.id('photo_master')$$,'invalid','engine_take refuses a protected photo before collecting or rendering');
select test.refuses($$insert into public.picture_fixes(workspace_id,candidate_id,job_id,creative_id,box,ask,requested_by)
  select workspace_id,test.id('photo_candidate'),id,creative_id,'{"x":0,"y":0,"w":0.5,"h":0.5}','Change her face',auth.uid()
  from public.production_jobs where creative_id=test.id('photo_master')$$,'invalid','brushed image-model fixes cannot bypass protection');
update public.creatives set protected_photo=false where id=test.id('photo_master');
update public.creative_versions set protected_photo=false where creative_id=test.id('photo_master');
select test.ok((select protected_photo from public.creatives where id=test.id('photo_master'))
  and (select protected_photo from public.creative_versions where creative_id=test.id('photo_master')),'protection cannot be cleared');
-- A descendant inherits protection even when it has no shoot-original file of its own.
insert into public.creatives(workspace_id,campaign_id,master_id,kind,format,name,title)
values(test.id('lysne'),test.id('use_campaign'),test.id('photo_master'),'variant','square','photo-child','Photo child')
returning test.keep('photo_child',id);
select test.ok((select protected_photo from public.creatives where id=test.id('photo_child')),'variants inherit protection');
select test.refuses($$insert into public.production_jobs(workspace_id,campaign_id,kind,creative_id,snapshot_id,requested_by)
  select workspace_id,campaign_id,'variant',test.id('photo_child'),snapshot_id,requested_by from public.production_jobs
  where creative_id=test.id('photo_master')$$,'invalid','variants cannot bypass protection');
-- A changed rights label cannot strip known-person protection from the original on its next use.
set role authenticated;
select public.update_shoot_rights(test.id('use_shoot'),'{"people":"none"}');
select test.keep('photo_reused',(public.use_shoot_in_campaign(test.id('use_shoot'),test.id('use_campaign'))#>>'{documentIds,0}')::uuid);
select test.ok((select protected_photo from public.creatives where id=test.id('photo_reused')),'known people remain protected on reuse after the rights label changes');
reset role;
-- Rights are evaluated again on use of descendants, not only on V1 creation.
set role authenticated;
select public.update_shoot_rights(test.id('use_shoot'),'{"people":"unsure"}');
reset role;
select test.refuses($$select app.require_photo_job(test.id('photo_child'),null,false)$$,'invalid','tightened rights block even pixel-preserving descendant jobs');
-- Composition references are optional, but must never expose a blocked shoot original.
insert into public.boards(workspace_id,campaign_id,kind,name)
values(test.id('lysne'),test.id('use_campaign'),'campaign_moodboard','Shoot composition')
returning test.keep('use_board',id);
insert into public.board_items(workspace_id,board_id,kind,file_id,verdict)
values(test.id('lysne'),test.id('use_board'),'image',test.id('use_original'),'liked');
insert into public.production_jobs(workspace_id,campaign_id,kind,snapshot_id,requested_by)
select workspace_id,campaign_id,'master',snapshot_id,requested_by from public.production_jobs
where creative_id=test.id('photo_master') returning test.keep('composition_job',id);
create function pg_temp.check_shoot_composition(p_allowed boolean) returns void language plpgsql as $$
declare task jsonb;
begin
  task := public.engine_take(test.id('composition_job'));
  perform test.ok(task #>> '{run,attempt_id}' is not null,'composition test takes a real Engine task');
  perform test.ok((task #>> '{composition,path}' = test.id('lysne') || '/use-photo.jpg') is not distinct from
    case when p_allowed then true else null end,'Engine leaves blocked originals out of composition');
end $$;
savepoint composition_take;
select pg_temp.check_shoot_composition(false);
rollback to composition_take;
-- The table normally enforces the release answer. Also exercise the defensive reader for legacy missing consent.
savepoint missing_consent;
alter table public.shoots drop constraint shoots_check;
update public.shoots set people='released',consent_yes=false where id=test.id('use_shoot');
savepoint composition_take;
select pg_temp.check_shoot_composition(false);
rollback to composition_take;
rollback to missing_consent;
update public.shoots set people='none',usable_until=current_date-1 where id=test.id('use_shoot');
savepoint composition_take;
select pg_temp.check_shoot_composition(false);
rollback to composition_take;
update public.shoots set usable_until=current_date where id=test.id('use_shoot');
savepoint composition_take;
select pg_temp.check_shoot_composition(true);
rollback to composition_take;

-- A no-people shoot may be rendered or given a manual candidate while its original remains private V1.
insert into public.files(workspace_id,path,name,content_type,bytes,purpose,uploaded_by,width,height)
values(test.id('lysne'),test.id('lysne') || '/worker-original.jpg','worker-original.jpg','image/jpeg',120,'source',auth.uid(),1080,1350)
returning test.keep('worker_file',id);
set role authenticated;
select test.keep('worker_shoot',(public.add_shoot(test.id('lysne'),'Product day',null,'{"people":"none"}',
  jsonb_build_array(jsonb_build_object('fileId',test.id('worker_file'),'kind','photo')))->>'id')::uuid);
reset role;
update public.shoots set state='read' where id=test.id('worker_shoot');
update public.shoot_pictures set engine_read='{"sort":"pick"}' where shoot_id=test.id('worker_shoot');
set role authenticated;
select public.check_shoot_picks(test.id('worker_shoot'));
select test.keep('worker_master',(public.use_shoot_in_campaign(test.id('worker_shoot'),test.id('use_campaign'))#>>'{documentIds,0}')::uuid);
select test.keep('worker_render',(public.render_creative(test.id('worker_master'))->>'id')::uuid);
select test.ok((select kind='master' and mode='engine' from public.production_jobs where id=test.id('worker_render')),
  'render builds on the private shoot draft');
reset role;
insert into public.files(workspace_id,path,name,content_type,bytes,purpose,uploaded_by,width,height)
values(test.id('lysne'),test.id('lysne') || '/worker-manual.jpg','worker-manual.jpg','image/jpeg',120,'candidate',auth.uid(),1080,1350)
returning test.keep('worker_manual_file',id);
set role authenticated;
select test.keep('worker_manual',(public.add_manual_version(test.id('worker_master'),test.id('worker_manual_file'),'Manual replacement')->>'id')::uuid);
select test.ok((select number=1 and state='making' and file_id=test.id('worker_file') from public.creative_versions
  where creative_id=test.id('worker_master')),'render and manual candidate keep the original private V1');
select test.ok((public.send_to_check(test.id('worker_manual'))->>'number')::int=2,'manual replacement becomes V2');
reset role;
select test.keep('worker_candidate',candidate_id) from public.creative_versions where creative_id=test.id('worker_master') and number=1;
select test.keep('worker_version',id) from public.creative_versions where creative_id=test.id('worker_master') and number=1;
insert into public.picture_fixes(workspace_id,candidate_id,job_id,creative_id,box,ask,requested_by)
select workspace_id,id,job_id,test.id('worker_master'),'{"x":0,"y":0,"w":0.2,"h":0.2}','Fix label',auth.uid()
from public.candidates where id=test.id('worker_candidate') returning test.keep('worker_fix',id);
insert into public.format_makes(workspace_id,creative_id,job_id,master_version_id,asked,requested_by)
select workspace_id,creative_id,job_id,id,'crop',auth.uid() from public.creative_versions where id=test.id('worker_version')
returning test.keep('worker_format',id);
-- Isolate the reference selection without deleting source evidence used by earlier fixtures.
update public.sources set product_id=null where product_id=test.id('oil') and kind='packshot';
insert into public.sources(workspace_id,kind,name,file_id,product_id,slot)
values(test.id('lysne'),'packshot','Worker reference',test.id('worker_file'),test.id('oil'),'detail');
create function pg_temp.check_shoot_workers(p_allowed boolean) returns void language plpgsql as $$
declare task jsonb; call text;
begin
  foreach call in array array[
    'select public.details_take(test.id(''worker_candidate''))',
    'select public.format_take(test.id(''worker_format''))',
    'select public.fix_take(test.id(''worker_fix''))'] loop
    if p_allowed then
      execute call into task;
      perform test.ok(task #>> '{picture,path}' = test.id('lysne') || '/worker-original.jpg'
        and task #>> '{products,0,pictures,0,path}' = test.id('lysne') || '/worker-original.jpg','worker returns a real task before rights tighten');
    else
      perform test.refuses(call,'invalid','worker rechecks current rights for its picture and product references');
    end if;
  end loop;
end $$;
savepoint worker_take;
select pg_temp.check_shoot_workers(true);
rollback to worker_take;
update public.shoots set people='unsure' where id=test.id('worker_shoot');
select pg_temp.check_shoot_workers(false);
-- Remove the shoot from the main-picture lineage, leaving it only as a product reference.
update public.shoots set people='none' where id=test.id('worker_shoot');
update public.candidates set file_id=test.id('worker_manual_file') where id=test.id('worker_candidate');
update public.creative_versions set file_id=test.id('worker_manual_file') where id=test.id('worker_version');
delete from public.shoot_uses where creative_id=test.id('worker_master');
update public.shoots set usable_until=current_date-1 where id=test.id('worker_shoot');
select pg_temp.check_shoot_workers(false);
select test.ok(not has_function_privilege('anon','public.use_shoot_in_campaign(uuid,uuid,uuid[])','execute')
  and not has_function_privilege('service_role','public.use_shoot_in_campaign(uuid,uuid,uuid[])','execute')
  and not has_function_privilege('authenticated','public.engine_take_before_shoot_use(uuid)','execute')
  and not has_function_privilege('service_role','public.details_take_before_shoot_use(uuid)','execute')
  and not has_function_privilege('service_role','public.format_take_before_shoot_use(uuid)','execute')
  and not has_function_privilege('service_role','public.fix_take_before_shoot_use(uuid)','execute'),
  'no anonymous, service or legacy Engine API bypass');
select test.ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc
  where oid='public.use_shoot_in_campaign(uuid,uuid,uuid[])'::regprocedure),'use is security definer with empty search path');
rollback;
set role authenticated;
