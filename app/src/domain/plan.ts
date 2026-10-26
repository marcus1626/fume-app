// The brief and the plan (FLOWS §22): she sends the brief, Fume writes the plan, she approves it, and only then does
// the Engine make anything.
import type { Brief, Campaign, CampaignPlan, PlannedCreative, Product, User, Workspace } from "../contract";
import { addWorkingDays } from "./dates";

/** What the brief still lacks before it can be sent. */
export type BriefGap =
  | { reason: "questions_open" }
  | { reason: "lines_empty"; lines: ("objective" | "audience" | "message")[] }
  | { reason: "no_product" };

/** A brief is sent once Fume has no question left, its objective, audience and message are written, and the campaign
 *  has a product or a collection (FLOWS §22.1). Returns what it still lacks, or nothing. */
export function briefGap(brief: Brief, campaign: Campaign): BriefGap | undefined {
  if (brief.missing.length) return { reason: "questions_open" };
  const lines = (["objective", "audience", "message"] as const).filter((k) => !(brief[k] ?? "").trim());
  if (lines.length) return { reason: "lines_empty", lines };
  if (!campaign.productIds.length && !campaign.collectionIds?.length) return { reason: "no_product" };
  return undefined;
}

/** What can be done to a plan. */
export type PlanAction = "approve" | "change" | "ask_changes" | "ask_check" | "expert_check" | "agency_check" | "undo";

const ALLOWED: Record<PlanAction, CampaignPlan["state"][]> = {
  approve: ["ready"],
  change: ["ready"],
  ask_changes: ["ready"],
  ask_check: ["ready"],
  expert_check: ["in_check", "writing"],
  agency_check: ["ready"],
  undo: ["approved"],
};

/** A plan is approved, changed, sent for an expert's check or checked by the agency only while it is ready; the expert
 *  checks it while it is in check (or still being written); only an approved plan's approval is undone (FLOWS §22.3). */
export function planAllows(plan: CampaignPlan, action: PlanAction): boolean {
  return ALLOWED[action].includes(plan.state);
}

/** The customer reads the plan once it is ready; while Fume writes it or the expert checks it she sees only where it
 *  is. In a brand an agency runs, the client reads it once the agency has checked it and sent it (FLOWS §22.3,
 *  §26.8). */
export function seesPlan(
  person: User,
  workspace: Pick<Workspace, "agencyId"> | undefined,
  plan: CampaignPlan,
): boolean {
  if (!person.staffRole && (plan.state === "writing" || plan.state === "in_check")) return false;
  if (workspace?.agencyId && !person.agency && plan.state === "ready" && !plan.checkedBy) return false;
  return true;
}

/** The Engine makes nothing for a campaign before its plan is approved (FLOWS §22.1). */
export function engineMayMake(campaign: Pick<Campaign, "stage">): boolean {
  return !["brief", "plan"].includes(campaign.stage);
}

/** A master that shows a product still waiting to be confirmed waits for it; the others start (FLOWS §7 step 5). */
export function mastersOnHold(
  masters: PlannedCreative[],
  waiting: Product[],
): { going: PlannedCreative[]; held: PlannedCreative[] } {
  const held = masters.filter((pc) => pc.productIds.some((id) => waiting.some((p) => p.id === id)));
  return { going: masters.filter((pc) => !held.includes(pc)), held };
}

/** The plan's steps from its start, in working days (masters, variants and formats, delivery), and the go-live; a
 *  go-live the steps would pass pulls them in, so the delivery is a day before it goes live at the latest
 *  (FLOWS §22.2). */
export function planTimeline(start: string, live?: string): CampaignPlan["timeline"] {
  const steps = [
    { label: "Masters, checked", at: addWorkingDays(start, 3) },
    { label: "Variants and formats", at: addWorkingDays(start, 6) },
    { label: "Delivery", at: addWorkingDays(start, 8) },
  ];
  if (live) {
    const last = Date.parse(live) - 86_400_000;
    const from = Date.parse(start);
    if (Date.parse(steps[2].at) > last && last > from)
      [3, 6, 8].forEach((d, i) => (steps[i].at = new Date(from + ((last - from) * d) / 8).toISOString()));
  }
  return [...steps, ...(live ? [{ label: "Goes live", at: live }] : [])];
}
