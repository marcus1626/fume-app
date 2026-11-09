// Train the Engine (Marcus, 6 Nov 2026): Fume's own people go through the Engine's pictures one at a time and say yes
// or no, with why, because they have the eye and the experience; the Engine learns from it. Each card also shows what
// Fume's check found on the product, and they say whether the check was right. Fume's own people only.

import type { Id, Instant } from "./common";

/** A person's answer on one of the Engine's pictures. */
export type TrainVerdict = "yes" | "no";
/** A person's word on what the check found: right, or wrong (a false alarm, or a fault it missed). */
export type CheckVerdict = "right" | "wrong";

/** One fault Fume's check found on the product in the picture. */
export interface TrainFinding {
  /** The part's key ("front-buttons"), or "print:" and the words it should read. */
  key: Id;
  /** The part's name ("front buttons", "collar label"). */
  label: string;
  /** What the check says is wrong ("The picture shows 5 front buttons; the product has 7."). */
  note: string;
  /** How it looks on the product, and on the picture. */
  expected?: string;
  seen?: string;
  /** The check's close-ups: the part on the picture, and the same part on the product's photograph. */
  seenImage?: string;
  expectedImage?: string;
  /** The person's word on it, when given. */
  judged?: CheckVerdict;
  judgedNote?: string;
}

export interface TrainCard {
  /** The Engine's picture (candidates.id). */
  id: Id;
  workspaceId: Id;
  brandName: string;
  image: string;
  madeAt: Instant;
  /** The product in the picture, with its own photograph. */
  product?: { name: string; image?: string };
  /** Whether Fume's check has read the picture; `findings` are the faults it found. */
  checked: boolean;
  findings: TrainFinding[];
  /** The person's word on a check that found nothing ("right": nothing is wrong; "wrong": it missed something). */
  clean?: { judged: CheckVerdict; note?: string };
}

export interface TrainDeck {
  /** The pictures the person has not answered yet, the ones the check has read first, then the newest. */
  cards: TrainCard[];
  /** How many pictures and findings the person has answered before. */
  answered: number;
  judged: number;
}
