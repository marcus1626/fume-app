// Delivery: what reaches the customer (ARCHITECTURE §4.8), and the package that says how much she may have and how
// much of it is used (ARCHITECTURE §4.3). The Usage page and an agency's licence are view models (views/delivery.ts).

import type { Id, Instant } from "./common";
import type { Format } from "./campaigns";

// ─── Deliveries ─────────────────────────────────────────────────────────────

export interface Delivery {
  id: Id;
  campaignId: Id;
  name: string;
  creativeIds: Id[];
  state: "preparing" | "ready" | "downloaded" | "confirmed_live";
  rightsNote: string;
  bytes: number;
  createdAt: Instant;
  formats: Format[];
  /** A delivery covers the whole campaign or one collection in it (FLOWS §3.2). */
  scope?: "campaign" | "collection";
  collectionId?: Id;
}

// ─── The package and its usage ──────────────────────────────────────────────

export type PackageKind = "launch" | "core" | "growth";

export interface Package {
  id: Id;
  kind: PackageKind;
  /** Creatives per cycle: 18, 27, 54 (Offer v0.1). */
  creativeCap: number;
  directionRounds: number;
  productionRounds: number;
  period: "one_off" | "monthly";
}

export interface Usage {
  creativesUsed: number;
  creativeCap: number;
  campaignsActive: number;
  periodEndsAt?: Instant;
}
