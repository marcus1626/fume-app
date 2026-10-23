// The campaign plan (FLOWS §22, §26.2). Fume writes it from the brief she sent; she approves it, and only then does the
// Engine make anything. The expert checks it only when she asks (checkAsked). In a brand an agency runs, the agency
// checks it and sends it to the client, and only the client approves it (FLOWS §26.8). One document: the brief in
// words, the direction (with the ones Fume also considered), the variables, every creative the Engine will make, the
// rules it keeps, and when.

import type { Id, Instant } from "./common";
import type { Format } from "./campaigns";

/** FLOWS §22.3. */
export type PlanState = "writing" | "in_check" | "ready" | "changes_asked" | "approved";

/** Where a line of the plan comes from: her brief, her Brand DNA, her taste, her moodboard, an approved campaign
 *  (Creative Memory), a product's Product Truth, Fume's own proposal, or her change. */
export type PlanSource = "brief" | "brand_dna" | "taste" | "moodboard" | "memory" | "product" | "fume" | "you";

/** One line of the plan: "Light · Low, warm side light from a window at dusk". */
export interface PlanLine {
  key: string;
  label: string;
  value: string;
  source: PlanSource;
  /** Why, in one line, when the source alone does not say it: "You chose warm light three times". */
  why?: string;
  /** Set when she changed it in place. */
  changedBy?: Id;
  changedAt?: Instant;
}

export interface PlanReference {
  image: string;
  /** What it shows or why it is here, one line. */
  caption: string;
  source: PlanSource;
  /** The campaign it comes from, for source "memory". */
  campaignId?: Id;
}

/** A creative's own light, light direction and camera, over the plan's look. */
export interface CreativeLook {
  light?: string;
  direction?: string;
  camera?: string;
}

/** A creative before it exists: what the Engine will make. */
export interface PlannedCreative {
  id: Id;
  /** "Master 1", "Feed A1" */
  name: string;
  kind: "master" | "variant";
  /** For a variant: the master it comes from. */
  of?: Id;
  format: Format;
  productIds: Id[];
  /** The scene in one line: "The oil in its gift sleeve on linen, the candle lit behind". */
  scene: string;
  /** The words on the creative, in the market's language; none for a picture without words. */
  text?: string;
  /** "No people", "Hands only", "Ane (AI person)" */
  people: string;
  changedBy?: Id;
  changedAt?: Instant;
  /** This creative's own look, when it differs from "The look". */
  look?: CreativeLook;
  /** The day it goes live; left out, the plan's go-live (with the masters first). */
  liveAt?: Instant;
  /** A still image (the default), a video or a carousel. She sets how many of each with Fume in the chat before the
   *  Engine starts. */
  medium?: "image" | "video" | "carousel";
}

export interface PlanDirection {
  id: Id;
  letter: "A" | "B" | "C";
  name: string;
  /** Two or three sentences. */
  idea: string;
  hook: string;
  /** Each reason names its source. */
  why: { text: string; source: PlanSource }[];
  references: PlanReference[];
  /** The look for this direction: light, camera, set, props, colour, people. */
  look: PlanLine[];
  /** What the Engine makes in this direction. */
  creatives: PlannedCreative[];
  /** Fume's pick. */
  recommended?: boolean;
}

export interface PlanStep {
  /** "Masters, checked", "Variants and formats", "Delivery", "Goes live" */
  label: string;
  at: Instant;
}

/** One version of the plan, and what changed in it ("Master 1's scene: the gift box closed"). */
export interface PlanVersionNote {
  version: number;
  at: Instant;
  by: Id | "fume";
  /** What she asked, in her words (for a version Fume wrote after "Change it with Fume"). */
  asked?: string;
  /** What changed, one line each. */
  changes: string[];
}

export interface CampaignPlan {
  campaignId: Id;
  version: number;
  state: PlanState;
  /** The brief in words: Fume's paragraph. */
  summary: string;
  /** The brief version the plan was written from. */
  briefVersion: number;
  directions: PlanDirection[];
  chosenDirectionId: Id;
  /** Why she took another direction than Fume's pick, if she said. */
  chosenReason?: string;
  /** What the Engine holds to on every creative besides the look: products, formats, text, call to action, logo, language. */
  content: PlanLine[];
  /** Must show and never (from her brief) and the Brand DNA rules that apply. */
  rules: { text: string; kind: "must" | "never"; source: PlanSource; ruleId?: Id }[];
  timeline: PlanStep[];
  changeRequestsIncluded: number;
  /** The latest version's note: what Fume changed, or what she asked for while it is being changed. */
  note?: { by: Id | "fume"; text: string; at: Instant };
  writtenAt?: Instant;
  /** Expected while it is being written or checked. */
  readyBy?: Instant;
  checkedBy?: Id;
  checkedAt?: Instant;
  approvedBy?: Id;
  approvedAt?: Instant;
  /** How the client approved it when not in Fume ("Through the client link, by Maja Lind"). */
  approvedNote?: string;
  /** She asked the expert to check it (optional); the expert's check is otherwise skipped. */
  checkAsked?: { by: Id; at: Instant };
  /** Every version after the first, with what changed. */
  versions?: PlanVersionNote[];
}
