// The studio's Campaigns of one brand, or its calendar (round 13, robot note 08-studio-brand; PROPOSED 22 Oct 2026):
// ⌘K's "Campaigns · Calendar" opens /studio/b/:workspaceId/campaigns?show=calendar, which showed the studio's table. With
// ?show=calendar the address is the calendar view of the brand's campaigns, as the customer's /campaigns?show=calendar.
import { useSearchParams } from "react-router-dom";
import { CampaignsPage } from "../campaigns/CampaignsPage";
import { StudioCampaignsPage } from "../studio/StudioCampaignsPage";

export function StudioCampaignsOrCalendar() {
  const [params] = useSearchParams();
  return params.get("show") === "calendar" ? <CampaignsPage /> : <StudioCampaignsPage />;
}
