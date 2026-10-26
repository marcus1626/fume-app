// Review: creatives and their versions, and the customer's decisions on them (ARCHITECTURE §4.7, §5.2). Only the
// customer approves; in agency work only the client does. Approvals, change requests, comments and pins, ratings, and
// the record of who did what.

import type { Id, Instant } from "./common";
import type { Channel, Format } from "./campaigns";
import type { MessageAuthor } from "./conversation";

// ─── Creatives and their versions ───────────────────────────────────────────

/** ARCHITECTURE §5.2. The customer never sees making, in_check or correcting as a creative, only as counts. */
export type VersionState =
  "making" | "in_check" | "correcting" | "held" | "checked" | "changes_requested" | "approved" | "delivered";

export interface CreativeVersion {
  id: Id;
  creativeId: Id;
  number: number;
  image: string;
  width: number;
  height: number;
  state: VersionState;
  madeAt: Instant;
  checkId?: Id;
  checkedBy?: Id;
  checkedAt?: Instant;
  approvedBy?: Id;
  approvedAt?: Instant;
  heldReason?: string;
  /** For an approval the client gave outside Fume (FLOWS §24.5): the agency person who recorded it; approvedBy is
   *  still the client. */
  recordedBy?: Id;
  /** How the client approved: "In our meeting on 19 Oct". */
  recordedNote?: string;
}

export interface Creative {
  id: Id;
  campaignId: Id;
  directionId: Id;
  /** Null for a master itself; a variant points at its master. */
  masterId: Id | null;
  kind: "master" | "variant";
  format: Format;
  channel: Channel;
  /** Delivery name, e.g. lysne_autumn_a_m1_v2_feed_v3. */
  name: string;
  title: string;
  current: CreativeVersion;
  versions: CreativeVersion[];
}

// ─── Decisions and change requests ──────────────────────────────────────────

export type ChangeTag = "product" | "colour" | "text" | "composition" | "mood" | "other";

/** A spot on a creative, 0–1 from the top left, with its words. */
export interface Pin {
  x: number;
  y: number;
  text: string;
}

export interface Decision {
  id: Id;
  subject: "brief" | "direction" | "creative" | "brand_dna";
  subjectId: Id;
  versionId?: Id;
  by: Id;
  verdict: "approved" | "changes_requested" | "passed";
  reason?: string;
  at: Instant;
}

export interface ChangeRequest {
  id: Id;
  versionId: Id;
  creativeId: Id;
  by: Id;
  pins: Pin[];
  tags: ChangeTag[];
  text: string;
  state: "open" | "in_progress" | "done";
  /** Fume's own mistake: fixed without using a round. */
  isCorrection: boolean;
  at: Instant;
}

export interface Comment {
  id: Id;
  subjectId: Id;
  by: Id;
  text: string;
  at: Instant;
}

// ─── Review comments and ratings (FLOWS §11) ────────────────────────────────

export interface ReviewComment {
  id: Id;
  creativeId: Id;
  versionId: Id;
  by: Id;
  text: string;
  /** A pin on the creative, 0–1 from the top left; none for a plain comment. */
  pin?: { x: number; y: number };
  at: Instant;
  resolved?: boolean;
  replies: { id: Id; by: Id; text: string; at: Instant }[];
}

export interface Rating {
  creativeId: Id;
  versionId: Id;
  by: Id;
  stars: 1 | 2 | 3 | 4 | 5;
  at: Instant;
}

// ─── The record ─────────────────────────────────────────────────────────────

/** Append-only: who did what to which subject, and when. The record behind who checked and who approved each
 *  creative (ARCHITECTURE §4.8). */
export interface RecordEvent {
  id: Id;
  workspaceId: Id;
  campaignId?: Id;
  subjectId: Id;
  actor: MessageAuthor;
  action:
    | "brief_approved"
    | "direction_chosen"
    | "made"
    | "checked"
    | "correction"
    | "held"
    | "approved"
    | "changes_requested"
    | "delivered"
    | "confirmed_live"
    | "brand_dna_approved";
  detail: string;
  at: Instant;
}
