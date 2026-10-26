// Review view models: what waits for the customer's decision.

import type { Instant } from "../entities/common";
import type { Campaign, Direction } from "../entities/campaigns";
import type { Creative } from "../entities/review";

export interface ReviewItem {
  campaign: Campaign;
  kind: "brief" | "directions" | "creatives";
  creatives: Creative[];
  directions: Direction[];
  dueAt?: Instant;
}
