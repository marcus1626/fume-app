// Studio view models: one brand's studio workspace, the Studio session's kit, and the staff Campaigns table.

import type { Id, Instant } from "../entities/common";
import type { Board, Campaign, Format, ServiceClock } from "../entities/campaigns";
import type { User, Workspace } from "../entities/identity";
import type { Product } from "../entities/products";
import type { EngineRun } from "../entities/production";
import type { CastMember, CreativeType, Generation, Scene, StudioKind, StudioSession } from "../entities/studio";
import type { QueueItem } from "./quality";

/** One brand's studio workspace for Fume's people. */
export interface BrandWorkspaceView {
  workspace: Workspace;
  campaigns: StudioCampaignRow[];
  /** What the Engine made since you last looked, newest first. */
  engineOutput: { run: EngineRun; campaign: Campaign; generations: Generation[] }[];
  queue: QueueItem[];
  sessions: StudioSession[];
  boards: Board[];
}

export interface StudioKit {
  creativeTypes: CreativeType[];
  cast: CastMember[];
  scenes: Scene[];
  products: Product[];
  references: string[];
}

/** A campaign in the staff Campaigns table. */
export interface StudioCampaignRow {
  campaign: Campaign;
  workspace: Workspace;
  clock?: ServiceClock;
  expert?: User;
  operator?: User;
  readyToRelease: number;
  /** The person who approves the campaign, so a row can say "The plan waits on Maja" and "6 creatives with Maja". */
  approver?: User;
}

/** Where a creative stands in the Library (FLOWS §37, DECIDED 13 Nov 2026), in the order it moves: a draft in the
 *  Studio, being made by the Engine, waiting for a check (or back with the Engine or a designer), checked, changes the
 *  customer asked for, approved by the customer, delivered. */
export type LibraryState = "studio" | "making" | "to_check" | "checked" | "changes" | "approved" | "delivered";

/** One creative in the Library: everything made for a brand in one place, whatever stage it is at. A creative that
 *  went to check is its current version; a draft that never left the Studio is its document's picked version. */
export interface LibraryItem {
  /** The creative's id, or the document's for a draft. */
  id: Id;
  workspaceId: Id;
  campaignId?: Id;
  campaignName?: string;
  creativeId?: Id;
  documentId?: Id;
  /** Its row in Check, while it waits for a check. */
  checkItemId?: Id;
  /** "Master 1", "Feed 03". */
  title: string;
  /** The delivery name, once it has one. */
  name?: string;
  format: Format;
  studio: StudioKind;
  /** A master, a variant or format made from one, or a draft that has not gone to check. */
  kind: "master" | "variant" | "draft";
  image?: string;
  state: LibraryState;
  /** The version shown. */
  version: number;
  /** When it last moved. */
  at: Instant;
  madeBy?: Id;
  checkedBy?: Id;
  checkedAt?: Instant;
  approvedBy?: Id;
  approvedAt?: Instant;
  productName?: string;
}
