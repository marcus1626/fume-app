// Agency: an agency runs client brands on Fume (FLOWS §24). An agency is an Organisation of kind "agency" and each
// client brand is a Workspace it runs (entities/identity.ts holds both, and the agency roles). Here: sending work to
// a client and the client link, and what the agency asks of Fume. The agency checks; only its client approves, the
// plan included (FLOWS §26.8).

import type { Id, Instant } from "./common";

// ─── Sending to a client and the client link (FLOWS §24.5, §26.8) ───────────

/** A client link: opens only what was sent, with Approve and Ask for changes (FLOWS §24.5). A campaign has one. */
export interface ClientLink {
  token: string;
  url: string;
  expiresAt: Instant;
}

/** What the agency sent to the client to approve: checked creatives, the plan, or both. */
export interface ClientSend {
  id: Id;
  campaignId: Id;
  workspaceId: Id;
  /** The creatives sent (none when the send carries only the plan). */
  versionIds: Id[];
  /** The plan the agency checked and sent to the client to approve, by its version. The client approves it in Fume or
   *  in the client link, the same link she approves the creatives in (FLOWS §26.8). */
  plan?: { version: number };
  /** Client people notified in Fume. */
  to: Id[];
  link?: ClientLink;
  note?: string;
  sentBy: Id;
  sentAt: Instant;
}

// ─── What the agency asks of Fume ───────────────────────────────────────────
// An agency is like Fume's own studio, but Fume decides which features and updates it gets, it has no Fume people
// unless it borrows them, and it sees no API costs.

/** One feature in an agency's Fume plan: in the plan now, coming (Fume decides when), or on request. */
export interface AgencyFeature {
  id: Id;
  name: string;
  /** One line on what it does. */
  detail: string;
  state: "included" | "coming" | "on_request";
  /** For a coming feature: when Fume plans it ("November", "Later this year"). */
  when?: string;
}

/** Borrow Fume's people for a client's work, or ask Fume's customer service. */
export type FumeRequestKind = "manpower" | "support";
/** What Fume's people do when an agency borrows them. */
export type BorrowedWork = "checks" | "design" | "renders";

export interface FumeRequest {
  id: Id;
  kind: FumeRequestKind;
  /** The client (and campaign) the work is for. */
  clientId?: Id;
  campaignId?: Id;
  work?: BorrowedWork[];
  /** How much: "About 20 creatives". */
  amount?: string;
  /** When: "This week", "By Fri 30 Oct". */
  when?: string;
  /** Customer service: what it is about. */
  topic?: string;
  text?: string;
  by: Id;
  at: Instant;
  state: "sent";
}
