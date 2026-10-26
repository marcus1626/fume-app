// Campaigns view models: one campaign with everything its page shows.

import type { Id } from "../entities/common";
import type { Brief, Campaign, Direction, ServiceClock } from "../entities/campaigns";
import type { User } from "../entities/identity";
import type { EngineRun } from "../entities/production";
import type { Creative, RecordEvent } from "../entities/review";

export interface CampaignView {
  campaign: Campaign;
  brief: Brief;
  directions: Direction[];
  creatives: Creative[];
  runs: EngineRun[];
  clock?: ServiceClock;
  record: RecordEvent[];
  approver: User;
  people: User[];
  threadId: Id;
}
