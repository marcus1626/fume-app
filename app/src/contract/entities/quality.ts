// Quality: the Quality Gate (ARCHITECTURE §4.6). An expert checks every creative before the customer sees it; the
// customer never sees a creative before it is checked. Check is the one workspace where Fume's people and an agency
// check the Engine's work (FLOWS §10, §25.2; its code names say Qa). The quality log records what checks caught.

import type { Id, Instant } from "./common";
import type { Format } from "./campaigns";
import type { Layer, StudioKind } from "./studio";

// ─── The Quality Gate check ─────────────────────────────────────────────────

export type CheckState = "waiting" | "in_check" | "checked" | "changes_requested" | "held";
export type CheckArea = "product_truth" | "brand_rules" | "claims" | "channel" | "artifacts" | "naming";

export interface CheckNote {
  id: Id;
  number: number;
  /** Pin position on the creative, 0–1 from the top left. */
  x: number;
  y: number;
  text: string;
  author: Id;
  at: Instant;
  resolved?: boolean;
}

export interface CheckItem {
  id: Id;
  area: CheckArea;
  label: string;
  /** What it is checked against: a Product Truth line or a Brand Rule. */
  against: string;
  result: "pending" | "pass" | "note";
  noteId?: Id;
}

export interface Check {
  id: Id;
  versionId: Id;
  creativeId: Id;
  campaignId: Id;
  workspaceId: Id;
  expertId: Id;
  state: CheckState;
  items: CheckItem[];
  notes: CheckNote[];
  dueAt: Instant;
  risk: "normal" | "high";
  startedAt?: Instant;
  checkedAt?: Instant;
}

// ─── The quality log ────────────────────────────────────────────────────────

export type Severity = "critical" | "major" | "minor";

export interface QualityLogEntry {
  id: Id;
  checkId: Id;
  workspaceId: Id;
  campaignId: Id;
  creativeId: Id;
  severity: Severity;
  what: string;
  fixed: boolean;
  by: Id;
  at: Instant;
}

// ─── Check: the Engine's work, checked (FLOWS §10, §25.2) ───────────────────

/** The Engine's own evaluation of what it made. */
export interface Evaluation {
  productTruth: "pass" | "flag";
  brandRules: "pass" | "flag";
  artefacts: "none" | "minor" | "major";
  notes: string[];
  /** Checks Fume ran on the file itself (its kind, shape, size and weight against the format), each with its result. */
  checks?: { result: "pass" | "flag"; text: string }[];
}

/** A spot on a creative in Check: a numbered pin, 0–1 from the top left, with what is wrong there. It goes to the
 *  Engine with "Tell the Engine" as a located note, the same pin as the customer's review viewer. */
export interface QaPin {
  n: number;
  x: number;
  y: number;
  text: string;
}

/** What a checker told the Engine to fix. */
export interface QaFeedback {
  id: Id;
  text: string;
  by: Id;
  at: Instant;
  /** sent: the Engine is fixing it; fixed: the fix is back in Check. */
  state: "sent" | "fixed";
  /** The spots it is about. */
  pins?: QaPin[];
}

/** A creative in Check. */
export interface QaItem {
  id: Id;
  workspaceId: Id;
  campaignId: Id;
  creativeId: Id;
  documentId?: Id;
  title: string;
  slot: string;
  studio: StudioKind;
  image: string;
  format: Format;
  madeAt: Instant;
  dueAt: Instant;
  risk: "normal" | "high";
  state: "waiting" | "fixing" | "checked" | "in_studio";
  evaluation: Evaluation;
  feedback: QaFeedback[];
  /** Design creatives can be changed directly in Check (FLOWS §10). */
  layers?: Layer[];
  checkedBy?: Id;
  checkedAt?: Instant;
  /** The run (the batch) it came from. A run started in the Engine chat lands its creatives in Check one by one, so
   *  the run card can say "Landing in Check · 2 of 4" and open Check at that run. */
  runId?: Id;
  /** The version shown; 1 until the Studio sends a new one. */
  version?: number;
  /** The version it replaced, when the Studio sent a new one to check (Before | After). */
  previous?: { image: string; version: number };
  /** Who sent the version shown from the Studio, and when. */
  sentBy?: Id;
  sentAt?: Instant;
  /** Who opened it in the Studio, and when (state in_studio). */
  studioBy?: Id;
  studioAt?: Instant;
}
