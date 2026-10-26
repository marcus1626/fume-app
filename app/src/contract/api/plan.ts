// Plan calls: the campaign plan from the sent brief to her approval (FLOWS §22, §26.2, §26.8).

import type { Id, Instant } from "../entities/common";
import type { CampaignPlan, CreativeLook, PlannedCreative } from "../entities/plan";

/** One change she makes to the plan in place. */
export interface PlanChange {
  /** A look line (in the chosen direction) or a content line, by key; or a planned creative, by id. */
  line?: string;
  creativeId?: Id;
  /** The new words for a line, or the creative's changed fields. */
  value?: string;
  creative?: Partial<Pick<PlannedCreative, "scene" | "text" | "people" | "format">>;
  /** A planned creative's own look; null takes it back to the plan's look. */
  look?: CreativeLook | null;
  /** A planned creative's go-live day. */
  liveAt?: Instant;
  /** A step of the timeline by its label ("Goes live"), and its new day. */
  step?: string;
  stepAt?: Instant;
}

export interface PlanApi {
  /** The campaign's plan, or null before the brief is sent. */
  plan(campaignId: Id): Promise<CampaignPlan | null>;
  /** She approves the plan (only while it is ready): the Engine starts on the masters. In a brand an agency runs only
   *  the client approves it, once the agency has checked it and sent it to her (FLOWS §26.8). */
  approvePlan(campaignId: Id): Promise<CampaignPlan>;
  /** Undo an approval just made, while the Engine has not delivered anything: the plan waits on her again. */
  undoApprovePlan(campaignId: Id): Promise<CampaignPlan>;
  /** She changes one line or one planned creative in place (while ready). */
  changePlan(campaignId: Id, change: PlanChange): Promise<CampaignPlan>;
  /** She takes another of the plan's directions; the look and the creatives follow it. */
  choosePlanDirection(campaignId: Id, directionId: Id, reason?: string): Promise<CampaignPlan>;
  /** She asks Fume for changes in words: Fume answers with the next version and what it changed. */
  askPlanChanges(campaignId: Id, note: string): Promise<CampaignPlan>;
  /** She changes the plan with Fume in the chat, before the Engine starts ("12 creatives, 3 of them videos",
   *  "masters by Friday"): Fume writes the next version at once and says in one line what changed. Only while the
   *  plan is ready for her. */
  changePlanWithFume(campaignId: Id, text: string): Promise<CampaignPlan>;
  /** She asks the expert to check the plan before she approves it (optional). */
  askPlanCheck(campaignId: Id): Promise<CampaignPlan>;
  /** Staff: the expert marks the plan checked, which sends it to the customer. In a brand an agency runs the agency
   *  checks it (sendToClient with `plan` does it and tells the client). */
  checkPlan(campaignId: Id): Promise<CampaignPlan>;
}
