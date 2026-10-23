// Shared by every domain: ids, times, and where a fact or a proposal came from.

export type Id = string;
/** ISO 8601 date-time, UTC. */
export type Instant = string;

/** Where a fact came from. The UI shows it on every fact (Product Vision §4.2). */
export type FactSource = "supplied" | "verified" | "inferred" | "learned" | "campaign" | "unknown";
export type Confidence = "high" | "medium" | "low";

// ─── Proposal and approval (FLOWS §2) ───────────────────────────────────────

/** Who put an item in: the Engine (read it from the website, an upload or learning), the customer, or Fume's people. */
export type Origin = "engine" | "customer" | "fume";
/** One rule across the app (FLOWS §2): the Engine proposes, only the customer approves. */
export type ProposalState = "proposed" | "approved" | "changed" | "removed";

/** Who put an item in and what the customer decided on it. Every item that shapes the work carries one. */
export interface Provenance {
  origin: Origin;
  state: ProposalState;
  /** Where the Engine found it, in words: "lysne.no/about", "LYSNE brand guide 2026.pdf, page 4". */
  evidence?: string;
  /** How sure the Engine is; low-confidence proposals become questions. */
  confidence?: Confidence;
  /** Who approved or changed it, and when. */
  by?: Id;
  at?: Instant;
  /** The Engine's value before the customer changed it. */
  was?: string;
}
