// The studio's Campaigns of one brand, or with ?show=calendar its calendar, as the customer's /campaigns?show=calendar
// (⌘K's "Campaigns · Calendar" links there).
import { useSearchParams } from "react-router-dom";
import { CampaignsPage } from "../campaigns/CampaignsPage";
import { StudioCampaignsPage } from "../studio/StudioCampaignsPage";

export function StudioCampaignsOrCalendar() {
  const [params] = useSearchParams();
  return params.get("show") === "calendar" ? <CampaignsPage /> : <StudioCampaignsPage />;
}
