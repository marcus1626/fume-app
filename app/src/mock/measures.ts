// What a version is scored on, by the studio that made it (FLOWS §35.3, PROPOSED 9 Nov 2026). The mock turns the two
// scores it already gives (product, engine) into the measures a screen shows: a picture's Product part by part, Brand
// and Craft; a design's Readability, Design system, Placement and Words; a video's Product, Brand, First second, Rhythm
// and Text on screen. The live Engine scores these itself; here they follow from the seed so a demo reads true.
import type { DesignCheck, Evaluation, QaFinding, ScoreMeasure, Scores, StudioKind } from "../contract";

type Override = Partial<Pick<ScoreMeasure, "value" | "why">>;

/** The product's parts the Engine checks against its verified facts and photographs. */
const PARTS = ["Label", "Cap", "Glass", "Size"] as const;

/** A steady number from a seed, so a reload shows the same scores. */
const steady = (seed: number, from: number, span: number) => from + (Math.abs(seed * 7 + 3) % span);

function measure(id: ScoreMeasure["id"], label: string, value: number, extra: Partial<ScoreMeasure> = {}) {
  return { id, label, value, ...extra } satisfies ScoreMeasure;
}

/** The product, part by part: the part a reason names ("the cap") carries the low score, the rest hold. */
function productParts(scores: Scores, seed: number): ScoreMeasure["parts"] {
  const why = scores.why?.find((w) => w.score === "product")?.text.toLowerCase() ?? "";
  return PARTS.map((label, i) => {
    const named = why.includes(label.toLowerCase());
    return { label, value: named ? Math.max(30, scores.product - 8) : steady(seed + i, 88, 10) };
  });
}

/** The measures for a version of this studio, from its two scores; `over` sets one measure where the seed knows it. */
export function measuresFor(
  scores: Scores,
  studio: StudioKind,
  seed: number,
  over: Partial<Record<ScoreMeasure["id"], Override>> = {},
): ScoreMeasure[] {
  const why = (k: "product" | "engine") => scores.why?.find((w) => w.score === k)?.text;
  const list: ScoreMeasure[] =
    studio === "design"
      ? [
          measure("readability", "Readability", steady(seed, 88, 10)),
          measure("system", "Design system", steady(seed + 1, 87, 11)),
          measure("placement", "Placement", steady(seed + 2, 86, 12)),
          measure("words", "Words", steady(seed + 3, 92, 7)),
        ]
      : studio === "video"
        ? [
            measure("product", "Product", scores.product, { why: why("product"), parts: productParts(scores, seed) }),
            measure("brand", "Brand", scores.engine, { why: why("engine") }),
            measure("first_second", "First second", steady(seed, 84, 12)),
            measure("rhythm", "Rhythm", steady(seed + 1, 85, 11)),
            measure("text_on_screen", "Text on screen", steady(seed + 2, 86, 10)),
          ]
        : [
            measure("product", "Product", scores.product, { why: why("product"), parts: productParts(scores, seed) }),
            measure("brand", "Brand", scores.engine, { why: why("engine") }),
            measure("craft", "Craft", steady(seed, 86, 11)),
          ];
  return list.map((m) => (over[m.id] ? { ...m, ...over[m.id] } : m));
}

/** The same evaluation with its measures, for a version of this studio. Unscored stays unscored. */
export function withMeasures(
  evaluation: Evaluation,
  studio: StudioKind,
  seed: number,
  over?: Partial<Record<ScoreMeasure["id"], Override>>,
): Evaluation {
  const s = evaluation.scores;
  if (!s) return evaluation;
  return { ...evaluation, scores: { ...s, measures: measuresFor(s, studio, seed, over) } };
}

/** A design's measures from what code measured on it: contrast is Readability; inside the safe area and keeping the
 *  product clear are Placement; the brand's own face missing costs Design system. */
export function designEvaluation(evaluation: Evaluation, checks: DesignCheck[], seed: number): Evaluation {
  const failed = (c: DesignCheck["check"][]) => checks.find((x) => c.includes(x.check) && !x.ok);
  const contrast = failed(["contrast", "busy"]);
  const place = failed(["covers", "fits", "lines"]);
  const font = failed(["font"]);
  const scores: Scores = evaluation.scores ?? { product: 90, engine: 88 };
  return withMeasures({ ...evaluation, scores }, "design", seed, {
    ...(contrast ? { readability: { value: 64, why: contrast.note } } : {}),
    ...(place ? { placement: { value: 58, why: place.note } } : {}),
    ...(font ? { system: { value: 82 } } : {}),
  });
}

const designWords: Record<DesignCheck["check"], string> = {
  fits: "outside the safe area",
  lines: "runs to too many lines",
  contrast: "has too little contrast",
  busy: "sits on a busy part of the picture",
  covers: "sits over the product",
  font: "is not in the brand’s own face",
};

/** What code measured and failed hard on a design, as the Engine's comments in Check (round 15, FLOWS §35.1): the
 *  words over the product, too little contrast, outside the safe area. A new version's comments replace the last
 *  version's. */
export function designFindings(checks: DesignCheck[], key: string): QaFinding[] {
  return checks
    .filter((c) => c.hard && !c.ok)
    .map((c, i) => ({
      id: `fi-${key}-${c.check}-${i}`,
      dimension: "design" as const,
      severity: "major" as const,
      finding: `The ${c.node.toLowerCase()} ${designWords[c.check]}.`,
      observed: c.note,
      status: "open" as const,
    }));
}
