// Quality view models: the Quality Gate's queue and review screen, and a creative in Check.

import type { Id } from "../entities/common";
import type { Campaign } from "../entities/campaigns";
import type { Workspace } from "../entities/identity";
import type { Product } from "../entities/products";
import type { Check, CheckArea, QaItem } from "../entities/quality";
import type { Creative, CreativeVersion } from "../entities/review";

/** The Quality Gate review screen in one call. */
export interface CheckView {
  check: Check;
  creative: Creative;
  version: CreativeVersion;
  campaign: Campaign;
  workspace: Workspace;
  product?: Product;
  /** Position in the expert's queue, for "3 of 12" and the arrows. */
  index: number;
  total: number;
  prevId?: Id;
  nextId?: Id;
}

export interface QueueItem {
  check: Check;
  creative: Creative;
  campaign: Campaign;
  workspace: Workspace;
}

/** A creative in Check, with what it is checked against. Check is one workspace for Fume and an agency. */
export interface QaView {
  item: QaItem;
  campaign: Campaign;
  workspace: Workspace;
  /** What it is checked against, by area: the Product Truth lines and the Brand DNA rules (read-only). */
  against?: { area: CheckArea; label: string; against: string }[];
  /** The product it shows, when it shows one, for its one name (copy.creativeName: "Night Body Oil · Feed 6"). */
  productName?: string;
}
