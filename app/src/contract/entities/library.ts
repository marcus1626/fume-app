// The brand's own pictures (FLOWS §38, DECIDED 13 Nov 2026): a shoot the customer or Fume's people upload, kept as it
// is, what the Engine read in it, and what an expert checked. The Library's second half, beside what Fume made (§37).

import type { Id, Instant } from "./common";

/** A photograph, or a clip kept for the video editor. */
export type OwnKind = "photo" | "clip";

/** Where a picture stands in its shoot: one of the best for creatives, a good one kept for later, or left out (never
 *  deleted: it stays in the shoot). */
export type OwnSort = "pick" | "rest" | "out";

/** What the Engine read in one picture. */
export interface OwnRead {
  sort: OwnSort;
  /** One line: why it is where it is. "The sharpest of the bottle shots; the label reads; low warm side light." */
  why: string;
  /** For a near copy left out: the picture kept in its place. */
  like?: Id;
  /** Sharp where it matters. */
  sharp: boolean;
  /** How close it is to the brand's Look Book, 0 to 100, when the brand has one. */
  look?: number;
  /** The product it shows, when the Engine knows it. */
  productId?: Id;
  productName?: string;
}

/** A campaign a picture went into. */
export interface OwnUse {
  campaignId: Id;
  campaignName: string;
  /** The creative made from it (a Studio document until it is a creative). */
  documentId?: Id;
  at: Instant;
}

export interface OwnPicture {
  id: Id;
  shootId: Id;
  workspaceId: Id;
  /** Its place in the shoot as uploaded, from 1. */
  number: number;
  kind: OwnKind;
  /** The file's own name. */
  name: string;
  /** The picture, or a clip's video. */
  src: string;
  /** A clip's first frame. */
  poster?: string;
  width?: number;
  height?: number;
  /** A clip's length. */
  seconds?: number;
  bytes?: number;
  /** Set once the Engine has read it. A customer sees it only once an expert has checked the shoot's picks. */
  read?: OwnRead;
  /** An expert's move: wins over the Engine's place. */
  moved?: { sort: OwnSort; by: Id; at: Instant };
  usedIn: OwnUse[];
}

/** Who is in the pictures: nobody, people who signed a release, or not known yet (nothing is used until it is). */
export type ShootPeople = "none" | "released" | "unsure";

export interface ShootRights {
  /** Who took them; "Our own" when the brand did. */
  photographer?: string;
  /** May be used until this day ("YYYY-MM-DD"); for good when not set. */
  until?: string;
  people: ShootPeople;
}

/** reading: the Engine is going through it. read: every picture has a place; an expert has not checked the picks.
 *  checked: an expert checked the picks; the customer sees them and they can go into a campaign. */
export type ShootState = "reading" | "read" | "checked";

export interface Shoot {
  id: Id;
  workspaceId: Id;
  name: string;
  /** The day it was shot ("YYYY-MM-DD"). */
  shotOn?: string;
  /** Who uploaded it. */
  by: Id;
  at: Instant;
  rights: ShootRights;
  state: ShootState;
  checkedBy?: Id;
  checkedAt?: Instant;
  pictures: OwnPicture[];
}
