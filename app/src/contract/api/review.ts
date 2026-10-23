// Review calls: the creatives, and the customer's decisions on them. Review acts at once: Approve takes effect the
// moment it is pressed and its Undo takes it back while nothing has moved on, and a set's change requests travel
// together as one.

import type { Id } from "../entities/common";
import type { Campaign, Format } from "../entities/campaigns";
import type {
  ChangeTag,
  Creative,
  CreativeVersion,
  Pin,
  Rating,
  ReviewComment,
  VersionState,
} from "../entities/review";
import type { ReviewItem } from "../views/review";

export interface CreativeFilter {
  state?: VersionState[];
  format?: Format[];
  directionId?: Id;
  kind?: "master" | "variant";
}

/** One creative's change request in a review set. */
export interface ChangeRoundItem {
  versionId: Id;
  /** What should change, in her words. */
  text: string;
  /** The spots she marked, each with its words. */
  pins: Pin[];
  tags: ChangeTag[];
}

export interface ReviewApi {
  // Creatives
  creatives(campaignId: Id, filter?: CreativeFilter): Promise<Creative[]>;
  creative(creativeId: Id): Promise<{ creative: Creative; campaign: Campaign; siblings: Id[] }>;

  // Decisions
  reviewQueue(): Promise<ReviewItem[]>;
  approve(versionIds: Id[]): Promise<CreativeVersion[]>;
  /** Undo approvals just made: the versions are checked and waiting again. Owner and approver only. */
  unapprove(versionIds: Id[]): Promise<CreativeVersion[]>;
  requestChanges(input: { versionId: Id; pins: Pin[]; tags: ChangeTag[]; text: string }): Promise<{
    version: CreativeVersion;
    usesRound: boolean;
    roundsLeft: number;
  }>;
  /** Send a review set's collected change requests as one. It uses one of the campaign's change requests, or none
   *  when every item is Fume's own mistake (tag "product"). */
  requestChangeRound(input: {
    campaignId: Id;
    items: ChangeRoundItem[];
  }): Promise<{ versions: CreativeVersion[]; usesRound: boolean; roundsLeft: number }>;
  /** Take back a change request just sent, while Fume has not started on it: pass the new versions
   *  requestChangeRound returned and whether it used one of the package's change requests. The creatives wait on you
   *  again at the version you asked changes on. */
  withdrawChangeRound(input: { campaignId: Id; versionIds: Id[]; usedRound: boolean }): Promise<CreativeVersion[]>;

  // Review comments and ratings (FLOWS §11)
  reviewComments(creativeId: Id): Promise<ReviewComment[]>;
  addReviewComment(input: {
    creativeId: Id;
    versionId: Id;
    text: string;
    pin?: { x: number; y: number };
    replyTo?: Id;
  }): Promise<ReviewComment>;
  resolveReviewComment(commentId: Id): Promise<ReviewComment>;
  rate(input: { creativeId: Id; versionId: Id; stars: Rating["stars"] }): Promise<Rating>;
  ratings(campaignId: Id): Promise<Rating[]>;
}
