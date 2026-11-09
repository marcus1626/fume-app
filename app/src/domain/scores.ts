// The Engine's scores of a picture (FLOWS §34.1, PROPOSED). A score under the bar is a warning, never a stop: the
// designer always sees the picture and has the last word. The bar is the Engine's own pass line for a check (0.8).
import type { Evaluation, RenderVersion } from "../contract";

/** Under this, a score carries a warning. */
export const SCORE_BAR = 80;

/** The scores under the bar, worst first; none when the Engine has not scored the picture. */
export function underBar(evaluation: Evaluation | undefined): ("product" | "engine")[] {
  const s = evaluation?.scores;
  if (!s) return [];
  return (["product", "engine"] as const).filter((k) => s[k] < SCORE_BAR).sort((a, b) => s[a] - s[b]);
}

/** A rendered version with a score under the bar. */
export function isUnderBar(v: Pick<RenderVersion, "state" | "evaluation"> | undefined): boolean {
  return Boolean(v && v.state === "done" && underBar(v.evaluation).length);
}
