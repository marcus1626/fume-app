-- The campaign's stage follows its work: once a format or variant is made from an approved master, the campaign is at
-- Creatives ('variants'), not still at Masters. Found in the walk-through of 29 Oct ("Stage 4 of 6, Masters" with every
-- creative approved). Delivery still moves it on from there.

create or replace function app.on_creative_from_master() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.campaigns set stage = 'variants' where id = new.campaign_id and stage = 'masters';
  return new;
end $$;
revoke execute on function app.on_creative_from_master() from public, anon, authenticated;

create trigger stage_follows_formats
after insert on public.creatives
for each row when (new.master_id is not null)
execute function app.on_creative_from_master();
