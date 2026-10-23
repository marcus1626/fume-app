// Delivery view models: the Usage page and an agency's licence.
// One Usage page serves Fume's admin and an agency (its Licence and usage). Each row carries the same figures for
// three periods, each with its dates, so no figure stands without its period, and Home, the licence and Usage read one
// number.

import type { Id, Instant } from "../entities/common";
import type { Organisation, Workspace } from "../entities/identity";

export type UsagePeriod = "month" | "last_month" | "weeks";

export interface UsageFigures {
  from: Instant;
  to: Instant;
  /** Creatives the Engine made for the brand in the period. */
  creatives: number;
  /** Creatives the customer (an agency's client) approved in the period. */
  approved: number;
  /** Creatives delivered in the period. */
  delivered: number;
  /** Renders, and what they cost: Fume's people only (0 for an agency, which never sees prices). */
  renders: number;
  cost: number;
}

/** One brand on the Usage page. */
export interface UsageRow {
  workspaceId: Id;
  renders: number;
  cost: number;
  creatives: number;
  delivered: number;
  /** Renders per week, last 8 weeks, oldest first. */
  trend: number[];
  workspace?: Workspace;
  /** The brand's figures per period. */
  periods?: Record<UsagePeriod, UsageFigures>;
  /** A Fume customer's package. An agency's client runs on the agency's licence, so it has none. */
  package?: { used: number; included: number; renewsAt?: Instant };
  /** An agency's example clients other than LYSNE have summary figures only (FLOWS §24.8). */
  example?: "full" | "summary";
}

/** The agency licence (FLOWS §24.6): a fixed platform fee, production by use. No prices in the demo. */
export interface LicenceView {
  agency: Organisation;
  period: { from: Instant; to: Instant };
  /** "Early access: product campaigns for paid social, scoped with Fume on 6 Oct" */
  scope: string;
  usage: { client: Workspace; creativesMade: number; creativesApproved: number }[];
  total: { creativesMade: number; creativesApproved: number };
  seats: { used: number; included: number };
}
