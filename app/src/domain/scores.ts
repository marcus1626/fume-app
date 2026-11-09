// The Engine's scores of a version (FLOWS §34.1, §35.3, PROPOSED). A score under the bar is a warning, never a stop:
// the designer always sees the version and has the last word. The bar is the Engine's own pass line for a check (0.8).
// Round 15: a version is scored on what matters for the studio that made it (a picture, a design, a video), and the
// product part by part. Versions scored before that carry two scores, read here as Product and Brand.
import type { Evaluation, RenderVersion, ScoreMeasure } from "../contract";

/** Under this, a score carries a warning. */
export const SCORE_BAR = 80;

/** What a version is scored on: its measures, else its two scores as Product and Brand; none when not scored. */
export function measuresOf(evaluation: Evaluation | undefined): ScoreMeasure[] {
  const s = evaluation?.scores;
  if (!s) return [];
  if (s.measures?.length) return s.measures;
  const why = (k: "product" | "engine") => s.why?.find((w) => w.score === k)?.text;
  return [
    { id: "product", label: "Product", value: s.product, why: why("product") },
    { id: "brand", label: "Brand", value: s.engine, why: why("engine") },
  ];
}

/** The measures under the bar, worst first; none when the version is not scored. */
export function underBar(evaluation: Evaluation | undefined): ScoreMeasure[] {
  return measuresOf(evaluation)
    .filter((m) => m.value < SCORE_BAR)
    .sort((a, b) => a.value - b.value);
}

/** The lowest score, the one a version's warning leads with; undefined when not scored. */
export function lowest(evaluation: Evaluation | undefined): ScoreMeasure | undefined {
  return [...measuresOf(evaluation)].sort((a, b) => a.value - b.value)[0];
}

/** A rendered version with a score under the bar. */
export function isUnderBar(v: Pick<RenderVersion, "state" | "evaluation"> | undefined): boolean {
  return Boolean(v && v.state === "done" && underBar(v.evaluation).length);
}
