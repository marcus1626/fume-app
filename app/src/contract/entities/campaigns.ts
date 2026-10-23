// Campaigns: the customer's word for the order (ARCHITECTURE §4.4, §5.1). The campaign, its stages and what it waits
// on, the service clock, the brief, directions, moodboards and boards, placements and formats, and the calendar.

import type { Id, Instant, Provenance } from "./common";
import type { PlanState } from "./plan";

// ─── The campaign ───────────────────────────────────────────────────────────

/** Order states (Product Execution Roadmap; ARCHITECTURE §5.1). */
export type CampaignState =
  | "draft"
  | "awaiting_input"
  | "scoped"
  | "in_production"
  | "in_review"
  | "revision"
  | "approved"
  | "delivered"
  | "closed";

/** Where in the cycle a campaign is; a second axis beside the state (ARCHITECTURE §5.1). New campaigns go through
 *  "plan" (the directions are part of the plan); "directions" stays for campaigns that ran before (FLOWS §22.1).
 *  People see six stages (Brief, Moodboard, Plan, Masters, Creatives, Delivery); features/campaigns/stages.ts maps
 *  these onto them. */
export type CampaignStage = "brief" | "plan" | "directions" | "masters" | "variants" | "delivery";

export interface Campaign {
  id: Id;
  workspaceId: Id;
  name: string;
  productIds: Id[];
  state: CampaignState;
  stage: CampaignStage;
  approverId: Id;
  channels: Channel[];
  formats: Format[];
  market: string;
  language: string;
  /** The go-live ("Live from"). */
  dueAt?: Instant;
  createdBy: Id;
  createdAt: Instant;
  updatedAt: Instant;
  /** Counts for lists and headers. */
  counts: { creatives: number; inCheck: number; checked: number; approved: number; delivered: number };
  roundsUsed: number;
  roundsIncluded: number;
  chosenDirectionId?: Id;
  cover?: string;
  /** The Brand DNA version it is made and checked against. */
  brandDnaVersion: number;
  /** Whole collections in the campaign; their products are in productIds too. */
  collectionIds?: Id[];
  /** The campaign's moodboard. */
  boardId?: Id;
  /** The campaign's own look, if it differs from the brand. */
  look?: CampaignLook;
  /** What the one status sentence needs beyond the state and the counts; see CampaignWaits. */
  waits?: CampaignWaits;
  /** She skipped the moodboard stage (it stays optional; she can still start one). */
  moodboardSkipped?: boolean;
}

/** What the one status sentence (copy.campaignStatus) needs beyond the state and the counts. The backend fills it on
 *  every campaign it returns, so Home, the Campaigns list, the campaign header, ⌘K, the collection and the chat all
 *  say the same sentence with the same numbers. */
export interface CampaignWaits {
  /** Questions Fume still has for the brief (its missing lines). */
  questions: number;
  /** Directions ready to choose from. */
  directions: number;
  /** The brief is complete and waits on its approval. */
  briefReady: boolean;
  /** The date Fume works to for the step under way (the service clock), while it runs. Never the go-live. */
  by?: Instant;
  /** The plan's state, so the status sentence can say it. */
  plan?: PlanState;
  /** How many masters the Engine is making, while the masters are the step under way and the count is known (the
   *  approved plan's masters), so the status sentence says "The Engine is making the 3 masters". */
  masters?: number;
  /** How many checked creatives are not sent to the customer yet (in Fume, a checked set waiting for its release; in
   *  an agency, what it has not sent to the client). copy.campaignStatus says "6 creatives to send to Maja" for them,
   *  and "with Maja" only for the rest. */
  toSend?: number;
  /** The plan's delivery date (its timeline's "Delivery" step), never the go-live. */
  delivery?: Instant;
  /** How many creatives the plan holds, before they are made ("Planned: 9 creatives"). */
  planned?: number;
  /** A ready plan someone checked. In a brand an agency runs, the agency checked it and sent it to the client, so it
   *  waits on her ("The plan waits on Maja"); unchecked, it waits on the agency (FLOWS §26.8). */
  planChecked?: boolean;
}

/** A campaign's own look, when its colours differ from the brand's (a Black Friday campaign): it wins over the
 *  brand's presets in every creative made for the campaign, and shows as the source "Campaign" in the Studio. */
export interface CampaignLook {
  colours: { name: string; hex: string; use: string }[];
  backgrounds: { name: string; hex: string }[];
  light?: string;
  /** In words: what makes this campaign look different from the brand. */
  note: string;
  provenance: Provenance;
}

// ─── The service clock (ARCHITECTURE §4.3) ──────────────────────────────────

export type ClockStage = "plan" | "directions" | "masters" | "variants";

/** The date Fume works to for a stage. The clock stops while Fume waits for the customer. */
export interface ServiceClock {
  campaignId: Id;
  stage: ClockStage;
  dueAt: Instant;
  state: "running" | "paused_waiting_on_you" | "met" | "missed";
  pausedReason?: string;
}

// ─── The brief ──────────────────────────────────────────────────────────────

export interface Brief {
  campaignId: Id;
  version: number;
  state: "drafting" | "ready" | "approved";
  objective: string;
  audience: string;
  offer?: string;
  message: string;
  mandatory: string[];
  never: string[];
  channels: Channel[];
  formats: Format[];
  creatives: number;
  references: string[];
  /** What Fume still needs before the brief is complete. */
  missing: string[];
  approvedBy?: Id;
  approvedAt?: Instant;
}

/** A brief written by hand on the form, without the chat (FLOWS §12). It says everything the brief needs, so
 *  "Approve and start" approves the whole brief the customer saw. */
export interface BriefOrder {
  name: string;
  goal: string;
  productIds: Id[];
  collectionIds: Id[];
  channels: Channel[];
  formats: Format[];
  deadline?: Instant;
  notes: string;
  /** The brief's own lines, written by hand on the form, so nothing is left "Not set yet". */
  audience?: string;
  message?: string;
  mandatory?: string[];
  never?: string[];
  references: string[];
  /** A moodboard started on the spot: it becomes the campaign's campaign_moodboard board. */
  moodboard?: { images: string[] };
  /** How many creatives the brief asks for from the package; left out, Fume plans four per format. */
  creatives?: number;
  /** Where it runs and in which language; left out, the workspace's own. */
  market?: string;
  language?: string;
}

/** A brief to start from: Fume's own, or one the Engine made from a past campaign of hers. */
export interface BriefTemplate {
  id: Id;
  kind: "fume" | "yours";
  /** "Product launch", "Like Autumn launch" */
  name: string;
  /** One line on what it is for. */
  description: string;
  goal: string;
  audience: string;
  message: string;
  channels: Channel[];
  formats: Format[];
  creatives?: number;
  mandatory?: string[];
  never?: string[];
  /** The campaign it was made from (kind "yours"). */
  campaignId?: Id;
}

// ─── Directions (ARCHITECTURE §5.3) ─────────────────────────────────────────

export type DirectionState = "making" | "in_check" | "proposed" | "chosen" | "passed";

/** A generated direction. New campaigns carry their directions in the plan instead (PlanDirection, FLOWS §22.1). */
export interface Direction {
  id: Id;
  campaignId: Id;
  letter: "A" | "B" | "C" | "D";
  name: string;
  insight: string;
  hook: string;
  message: string;
  visualIdea: string;
  whyItFits: string;
  risks: string[];
  plannedOutputs: string;
  cover: string;
  images: string[];
  state: DirectionState;
  checkedBy?: Id;
  checkedAt?: Instant;
  decidedBy?: Id;
  decidedAt?: Instant;
  reason?: string;
}

// ─── Moodboards and boards (FLOWS §3.3) ─────────────────────────────────────

export type BoardKind = "brand_moodboard" | "campaign_moodboard" | "ideas" | "layout";

export interface Board {
  id: Id;
  workspaceId: Id;
  kind: BoardKind;
  campaignId?: Id;
  name: string;
  /** The board's size in board units; items are placed in it. */
  width: number;
  height: number;
  updatedAt: Instant;
  items: BoardItem[];
  /** OpenPencil document reference, once the canvas runs on it (FLOWS §6). */
  documentRef?: string;
}

export type BoardItemKind = "image" | "note" | "section" | "creative" | "swatch";

export interface BoardItem {
  id: Id;
  boardId: Id;
  kind: BoardItemKind;
  x: number;
  y: number;
  w: number;
  h: number;
  image?: string;
  text?: string;
  hex?: string;
  /** Liked or disliked, with the reason: this is what feeds the Taste Map. */
  verdict?: "liked" | "disliked";
  note?: string;
  provenance: Provenance;
}

// ─── Placements and formats (FLOWS §15, §16) ────────────────────────────────

/** The short form of a placement's ratio; placements map onto it (FLOWS §15). */
export type Format = "square" | "feed" | "story";
export type Channel = "paid_social" | "organic_social" | "email" | "product_page" | "display";

/** A placement: where a creative runs. Its ratio follows from it (FLOWS §15). */
export interface Placement {
  id: Id;
  name: string;
  /** Grouping in the picker: "Instagram", "Meta ads", "Email", "Web". */
  group: string;
  ratio: string;
  width: number;
  height: number;
  /** The short form the rest of the app uses. */
  format: Format;
  /** Areas the platform covers, 0–1 from each edge. */
  safe: { top: number; bottom: number; left: number; right: number };
  textLimit?: string;
}

/** One target placement in Make formats (FLOWS §16). */
export interface FormatTile {
  placementId: Id;
  /** What the Engine chose and why; the designer can switch. */
  method: "native" | "crop" | "expand";
  engineChose: "native" | "crop" | "expand";
  why: string;
  /** For crop: the window on the source, 0–1. */
  crop?: { x: number; y: number; w: number; h: number };
  image?: string;
  state: "waiting" | "making" | "done";
}

// ─── The calendar (FLOWS §21) ───────────────────────────────────────────────

export interface CalendarEntry {
  id: Id;
  workspaceId: Id;
  kind: "campaign" | "drop" | "delivery" | "post" | "meeting";
  title: string;
  start: Instant;
  end?: Instant;
  placementId?: Id;
  creativeId?: Id;
  campaignId?: Id;
  meetingId?: Id;
  image?: string;
}
