// Home view models: every Home and what waits on whom. The customer's Home, the "All brands" overview for Fume's
// people, and the agency's Home. The overviews for Fume and an agency share their "Needs you" rows.

import type { Id, Instant } from "../entities/common";
import type { Campaign, ServiceClock } from "../entities/campaigns";
import type { Delivery, Usage } from "../entities/delivery";
import type { MemoryEntry } from "../entities/brand";
import type { Organisation, Workspace } from "../entities/identity";
import type { EngineRun } from "../entities/production";
import type { Creative } from "../entities/review";
import type { AgencyClient, AgencyTeamMember } from "./agency";
import type { TeamLoadRow } from "./identity";
import type { QueueItem } from "./quality";

// ─── The customer's Home ────────────────────────────────────────────────────

/** Home answers five questions (ICP): what waits for you, what is being made, what Fume needs, what is approved, what Fume learned. */
export interface HomeView {
  waitingOnYou: WaitingItem[];
  inProduction: { campaign: Campaign; run?: EngineRun; clock?: ServiceClock }[];
  fumeNeeds: { id: Id; text: string; href: string }[];
  recentlyApproved: Creative[];
  deliveries: Delivery[];
  learned: MemoryEntry[];
  usage: Usage;
}

export interface WaitingItem {
  id: Id;
  kind: "brief" | "plan" | "directions" | "creatives" | "question" | "brand_dna" | "product";
  campaignId?: Id;
  title: string;
  detail: string;
  count?: number;
  dueAt?: Instant;
  href: string;
}

// ─── Fume's people: All brands ──────────────────────────────────────────────

/** Fume's people: the "All brands" view at the top of the switcher, one overview like the agency's Home. */
export interface AllBrandsView {
  brands: {
    workspace: Workspace;
    inCheck: number;
    readyToRelease: number;
    running: number;
    nextDue?: Instant;
    blocked: number;
    /** The brand's picture for its card. */
    picture?: string;
    /** The brand's most urgent campaign and how far it is, 0 to 1 (approved creatives over planned). */
    current?: { campaignId: Id; name: string; progress: number; detail: string };
  }[];
  /** What needs you across the brands, the same rows as the agency's Home (plans and creatives to check). */
  needsYou?: AgencyNeed[];
  queue: QueueItem[];
  runs: { run: EngineRun; campaign: Campaign; workspace: Workspace }[];
  deliveriesDue: { campaign: Campaign; workspace: Workspace; dueAt?: Instant; approved: number; total: number }[];
  team: TeamLoadRow[];
}

// ─── The agency's Home ──────────────────────────────────────────────────────

/** Something across the agency's clients that waits on the agency (Home's "Needs you"). */
export interface AgencyNeed {
  id: Id;
  clientId: Id;
  kind: "plan" | "check" | "client_changes" | "brief" | "products" | "brand";
  /** "LYSNE · Winter gifting" */
  title: string;
  /** "The plan is ready to approve" */
  detail: string;
  /** The pill: "Open the plan", "Check", "Open". */
  action: string;
  href: string;
  picture?: string;
  at: Instant;
}

export interface AgencyHomeView {
  agency: Organisation;
  /** One line under the greeting: "Four client brands. Two plans wait on you; Maja has 6 creatives to approve." */
  summary: string;
  clients: AgencyClient[];
  needsYou: AgencyNeed[];
  team: AgencyTeamMember[];
}
