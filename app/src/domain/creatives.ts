// What happens to a creative between the Engine and the customer: what she may see, what may be approved, and how a
// campaign counts its creatives.
import type { Campaign, ClientSend, Creative, CreativeVersion, Direction, Workspace } from "../contract";

/** Only a checked version is approved, by the customer or for her (ARCHITECTURE §5.2). */
export function canBeApproved(version: CreativeVersion): boolean {
  return version.state === "checked";
}

/** A checked creative in a brand an agency runs reaches the client only once the agency sends it (FLOWS §24.5). */
export function waitsForAgencySend(
  creative: Creative,
  workspace: Pick<Workspace, "agencyId"> | undefined,
  sends: ClientSend[],
): boolean {
  if (creative.current.state !== "checked" || !workspace?.agencyId) return false;
  return !sends.some((s) => s.versionIds.includes(creative.current.id));
}

/** The customer never sees a creative before it is checked (F-D025), and checked work only once it is sent to her:
 *  while its campaign is in production the checked set waits for the release, and a creative that still waits to be
 *  sent stays out (ARCHITECTURE §5.2, FLOWS §24.5). */
export function customerSees(version: CreativeVersion, campaign: Campaign, waitsToBeSent: boolean): boolean {
  if (["approved", "delivered", "changes_requested"].includes(version.state)) return true;
  return version.state === "checked" && campaign.state !== "in_production" && !waitsToBeSent;
}

/** The customer sees a direction only once the expert has checked it (ARCHITECTURE §5.3). */
export function customerSeesDirection(direction: Direction): boolean {
  return !["making", "in_check"].includes(direction.state);
}

/** A campaign's counts: what is still with the Engine or the expert (the customer sees it only as a number), checked,
 *  approved and delivered (ARCHITECTURE §5.2). */
export function countCreatives(creatives: Creative[]): Campaign["counts"] {
  const n = (...states: CreativeVersion["state"][]) => creatives.filter((c) => states.includes(c.current.state)).length;
  return {
    creatives: creatives.length,
    inCheck: n("making", "in_check", "correcting", "held"),
    checked: n("checked"),
    approved: n("approved", "delivered"),
    delivered: n("delivered"),
  };
}

/** A campaign in review is approved once every creative in it is approved (ARCHITECTURE §5.1). */
export function isFullyApproved(campaign: Pick<Campaign, "state" | "counts">): boolean {
  const { counts } = campaign;
  return counts.creatives > 0 && counts.approved === counts.creatives && campaign.state === "in_review";
}
