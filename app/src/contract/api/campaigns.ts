// Campaigns calls: campaigns and their scope, the brief, directions, moodboards and boards, placements and formats, and
// the calendar.

import type { Id, Instant } from "../entities/common";
import type {
  Board,
  BoardItem,
  Brief,
  BriefOrder,
  BriefTemplate,
  CalendarEntry,
  Campaign,
  CampaignState,
  Direction,
  FormatTile,
  Placement,
} from "../entities/campaigns";
import type { CreativeDocument } from "../entities/studio";
import type { CampaignView } from "../views/campaigns";

export interface CampaignFilter {
  state?: CampaignState[];
  search?: string;
}

export interface CampaignsApi {
  // Campaigns
  campaigns(filter?: CampaignFilter): Promise<Campaign[]>;
  campaign(campaignId: Id): Promise<CampaignView>;
  startCampaign(input: { text: string; productIds?: Id[] }): Promise<{ campaign: Campaign; threadId: Id }>;
  setApprover(campaignId: Id, userId: Id): Promise<Campaign>;
  /** Products and whole collections in the campaign (FLOWS §3.2). */
  setCampaignScope(campaignId: Id, scope: { productIds: Id[]; collectionIds: Id[] }): Promise<Campaign>;

  // The brief
  /** A brief written by hand, without the chat. */
  orderBrief(order: BriefOrder): Promise<Campaign>;
  /** She sends her brief to Fume: the brief is fixed at this version and Fume starts writing the plan. Nothing is
   *  generated. (approveBrief does the same for older callers.) */
  sendBrief(campaignId: Id): Promise<Brief>;
  approveBrief(campaignId: Id): Promise<Brief>;
  changeBrief(campaignId: Id, change: Partial<Brief>): Promise<Brief>;
  /** The briefs she can start from: Fume's templates, and hers the Engine made from her past campaigns. */
  briefTemplates(): Promise<BriefTemplate[]>;
  /** Three alternatives for the brief's message (or its idea, or the whole brief), with what she wants changed
   *  ("warmer", "shorter"). `round` asks for a new set. */
  briefAlternatives(input: {
    part: "message" | "brief";
    goal: string;
    audience?: string;
    message?: string;
    productIds?: Id[];
    feedback?: string;
    round?: number;
  }): Promise<{ goal: string; audience: string; message: string }[]>;

  // Directions (campaigns made before the plan)
  chooseDirection(directionId: Id, reason?: string): Promise<Direction>;
  passDirections(campaignId: Id, reason: string): Promise<Direction[]>;

  // Moodboards and boards
  /** She skips the moodboard stage; Fume plans from the brief and the Brand DNA alone. */
  skipMoodboard(campaignId: Id): Promise<Campaign>;
  /** Start a campaign's moodboard on the spot with these pictures; the campaign gets its boardId. */
  startMoodboard(campaignId: Id, images: string[]): Promise<Board>;
  boards(): Promise<Board[]>;
  board(boardId: Id): Promise<Board>;
  addBoardItem(boardId: Id, item: Omit<BoardItem, "id" | "boardId" | "provenance">): Promise<Board>;
  updateBoardItem(
    boardId: Id,
    itemId: Id,
    change: Partial<Pick<BoardItem, "x" | "y" | "w" | "h" | "verdict" | "note" | "text">>,
  ): Promise<Board>;
  removeBoardItem(boardId: Id, itemId: Id): Promise<Board>;

  // Placements and formats (FLOWS §15, §16)
  placements(): Promise<Placement[]>;
  /** Make formats: every target placement as a tile, each with the method the Engine chose. */
  makeFormats(documentId: Id, placementIds: Id[]): Promise<CreativeDocument>;
  /** The designer switches a tile's method or moves its crop. */
  setFormatTile(
    documentId: Id,
    placementId: Id,
    change: { method?: FormatTile["method"]; crop?: FormatTile["crop"] },
  ): Promise<CreativeDocument>;

  // The calendar (FLOWS §21)
  calendar(input: { from: Instant; to: Instant }): Promise<CalendarEntry[]>;
  schedule(input: { creativeId: Id; placementId: Id; at: Instant }): Promise<CalendarEntry>;
  moveEntry(entryId: Id, at: Instant): Promise<CalendarEntry>;
  removeEntry(entryId: Id): Promise<void>;
}
