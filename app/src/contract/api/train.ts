// Train the Engine (contract/entities/train.ts): Fume's own people only.

import type { Id } from "../entities/common";
import type { CheckVerdict, TrainDeck, TrainVerdict } from "../entities/train";

export interface TrainApi {
  /** The Engine's pictures the person has not answered, on every brand they work on. */
  trainDeck(): Promise<TrainDeck>;
  /** Yes or no on one picture, and why; a second answer replaces the first. The Engine learns from the why. */
  trainAnswer(input: { cardId: Id; verdict: TrainVerdict; why?: string }): Promise<void>;
  /** A word on one thing the check found (`key`: TrainFinding.key, or "none" for a check that found nothing).
   *  `verdict` null takes the word back. */
  trainJudge(input: { cardId: Id; key: string; verdict: CheckVerdict | null; note?: string }): Promise<void>;
}
