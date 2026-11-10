import { describe, expect, it } from "vitest";
import { evaluationOf } from "../src/api/live/production";

const engine = { origin: "engine" as const, note: null };

describe("a picture's evaluation", () => {
  it("is what the Engine saw, once it has looked", () => {
    const e = evaluationOf({
      ...engine,
      evaluation: {
        productTruth: "pass",
        brandRules: "flag",
        artefacts: "minor",
        notes: ["Small letters look garbled."],
        evaluated: true,
      },
    });
    expect(e).toEqual({
      productTruth: "pass",
      brandRules: "flag",
      artefacts: "minor",
      notes: ["Small letters look garbled."],
      evaluated: true,
    });
  });

  it("says nothing holds before the Engine has looked, or for a picture made by hand", () => {
    expect(evaluationOf({ ...engine, evaluation: null })).toMatchObject({
      evaluated: false,
      notes: ["Made by the Engine."],
    });
    const byHand = evaluationOf({
      origin: "manual",
      note: "Retouched",
      evaluation: { productTruth: "pass", brandRules: "pass", artefacts: "none", notes: [], evaluated: true },
    });
    expect(evaluationOf({ ...engine, note: "Made by the Engine with nano-banana-pro" }).notes).toEqual([
      "Made by the Engine with nano-banana-pro.",
    ]);
    expect(byHand).toMatchObject({ evaluated: false, productTruth: "flag", notes: ["Made by hand: Retouched."] });
  });
});
