// Studio view models: one brand's studio workspace, the Studio session's kit, and the staff Campaigns table.

import type { Board, Campaign, ServiceClock } from "../entities/campaigns";
import type { User, Workspace } from "../entities/identity";
import type { Product } from "../entities/products";
import type { EngineRun } from "../entities/production";
import type { CastMember, CreativeType, Generation, Scene, StudioSession } from "../entities/studio";
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
