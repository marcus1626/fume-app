// The Library's Uploaded half (FLOWS §38): a shoot as a list shows it.
import type { Id, Instant } from "../entities/common";
import type { ShootRights, ShootState } from "../entities/library";

export interface ShootSummary {
  id: Id;
  workspaceId: Id;
  name: string;
  shotOn?: string;
  by: Id;
  at: Instant;
  rights: ShootRights;
  state: ShootState;
  checkedBy?: Id;
  checkedAt?: Instant;
  /** Up to four pictures: the picks first once there are picks. */
  cover: string[];
  counts: {
    photos: number;
    clips: number;
    /** Zero until the Engine has read the shoot, and for a customer until an expert checked it. */
    picks: number;
    rest: number;
    out: number;
    /** Pictures that went into a campaign. */
    used: number;
  };
}
