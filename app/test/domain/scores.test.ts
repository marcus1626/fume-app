// The Engine's scores of a version, read against the bar (app/src/domain/scores.ts, FLOWS §35.3 PROPOSED).
import { describe, expect, test } from "vitest";
import type { Evaluation, RenderVersion, ScoreMeasure } from "../../src/contract";
import { SCORE_BAR, isUnderBar, lowest, measuresOf, underBar } from "../../src/domain/scores";
import { designEvaluation, measuresFor } from "../../src/mock/measures";

const evaluation = (scores?: Evaluation["scores"]) =>
  ({ productTruth: "pass", brandRules: "pass", artefacts: "none", notes: [], scores }) as Evaluation;
const m = (id: ScoreMeasure["id"], value: number): ScoreMeasure => ({ id, label: id, value });

describe("what a version is scored on", () => {
  test("nothing before it is scored", () => {
    expect(measuresOf(undefined)).toEqual([]);
    expect(measuresOf(evaluation())).toEqual([]);
    expect(lowest(evaluation())).toBeUndefined();
  });

  test("a version scored before round 15 reads as Product and Brand, with the Engine's reasons", () => {
    const e = evaluation({ product: 70, engine: 90, why: [{ score: "product", text: "The cap is wrong" }] });
    expect(measuresOf(e).map((x) => [x.label, x.value, x.why])).toEqual([
      ["Product", 70, "The cap is wrong"],
      ["Brand", 90, undefined],
    ]);
  });

  test("its own measures win over the two old scores", () => {
    const e = evaluation({ product: 70, engine: 90, measures: [m("readability", 88)] });
    expect(measuresOf(e).map((x) => x.id)).toEqual(["readability"]);
  });
});

describe("the bar", () => {
  test("under the bar is below 80, worst first", () => {
    const e = evaluation({ product: 0, engine: 0, measures: [m("craft", 79), m("brand", 80), m("product", 52)] });
    expect(SCORE_BAR).toBe(80);
    expect(underBar(e).map((x) => x.value)).toEqual([52, 79]);
    expect(lowest(e)?.value).toBe(52);
  });

  test("only a made version carries the warning", () => {
    const e = evaluation({ product: 52, engine: 90 });
    expect(isUnderBar({ state: "done", evaluation: e } as RenderVersion)).toBe(true);
    expect(isUnderBar({ state: "rendering", evaluation: e } as RenderVersion)).toBe(false);
    expect(isUnderBar({ state: "done", evaluation: evaluation({ product: 90, engine: 85 }) } as RenderVersion)).toBe(
      false,
    );
    expect(isUnderBar(undefined)).toBe(false);
  });
});

describe("each studio is scored on its own measures", () => {
  const scores = { product: 64, engine: 86, why: [{ score: "product" as const, text: "The cap is too tall" }] };

  test("a picture: Product part by part, Brand, Craft; the part the Engine names carries the low score", () => {
    const list = measuresFor(scores, "render", 3);
    expect(list.map((x) => x.id)).toEqual(["product", "brand", "craft"]);
    const parts = list[0]!.parts!;
    expect(parts.map((p) => p.label)).toEqual(["Label", "Cap", "Glass", "Size"]);
    expect(parts.find((p) => p.label === "Cap")!.value).toBeLessThan(SCORE_BAR);
    expect(parts.filter((p) => p.label !== "Cap").every((p) => p.value >= SCORE_BAR)).toBe(true);
  });

  test("a design never carries a picture's scores", () => {
    expect(measuresFor(scores, "design", 3).map((x) => x.id)).toEqual(["readability", "system", "placement", "words"]);
  });

  test("a video: Product, Brand, First second, Rhythm, Text on screen", () => {
    expect(measuresFor(scores, "video", 3).map((x) => x.id)).toEqual([
      "product",
      "brand",
      "first_second",
      "rhythm",
      "text_on_screen",
    ]);
  });

  test("the same seed gives the same scores", () => {
    expect(measuresFor(scores, "render", 5)).toEqual(measuresFor(scores, "render", 5));
  });

  test("words over the product cost a design its Placement, with the reason", () => {
    const e = designEvaluation(
      evaluation(),
      [{ check: "covers", hard: true, node: "Words", ok: false, note: "The words sit over the bottle." }],
      1,
    );
    const placement = measuresOf(e).find((x) => x.id === "placement")!;
    expect(placement.value).toBeLessThan(SCORE_BAR);
    expect(placement.why).toBe("The words sit over the bottle.");
    expect(underBar(e).map((x) => x.id)).toEqual(["placement"]);
  });
});
