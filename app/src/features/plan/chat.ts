// Where "Change it with Fume" goes (round 13, Marcus's video comments #20, #25; PROPOSED 22 Oct 2026): the Fume chat with
// the plan in its side panel, so she iterates the plan with Fume (the number of creatives, videos, carousels, timing)
// before anything is made. The chat side (features/fume, builder A's notes) reads ?plan=<campaignId>. Under a brand's
// prefix (an agency's client, the studio's Customer view) it is that brand's chat.
import { useLocation } from "react-router-dom";
import { addressBrand, brandBase } from "../../shell/scope";

/** The Fume chat, open on this campaign's plan. */
export const planChatPath = (campaignId: string, base = "") => `${base}/fume?plan=${encodeURIComponent(campaignId)}`;

/** The same, under the brand's prefix when the address names one. */
export function usePlanChatPath(campaignId: string) {
  const here = addressBrand(useLocation().pathname);
  return planChatPath(campaignId, here ? brandBase(here.frame, here.workspaceId) : "");
}
