// A live version is scored by the studio that made it, from what Fume already measured (api/live/scores.ts, FLOWS §35.3).
// Run: npm test.
/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "vitest";
import { designScores, pictureScores } from "../src/api/live/scores";
import { measuresOf, underBar } from "../src/domain/scores";
import type { VersionDesign } from "../src/contract";

test("a picture is scored on Product, Brand and Craft, the product as its weakest part", () => {
  const s = pictureScores(
    {
      artefacts: "minor",
      artefactNotes: ["Skin looks waxy."],
      items: [
        { item: "The product is the product in the photographs.", area: "product", verdict: "holds", hard: true },
        { item: "No people.", area: "brand", verdict: "holds", hard: true },
        {
          item: "The left 40% is bare.",
          area: "brand",
          verdict: "off",
          hard: true,
          note: "The sled fills the left side.",
        },
      ],
    },
    [
      { kind: "part", part: "Cap", what: "the cap", ok: true },
      { kind: "part", part: "Label", what: "the label", ok: false, note: "The label reads ANTHEN." },
      { kind: "print", what: "print", ok: true },
    ],
  )!;
  assert.deepEqual(
    measuresOf({
      productTruth: "pass",
      brandRules: "pass",
      artefacts: "none",
      notes: [],
      evaluated: true,
      scores: s,
    }).map((m) => [m.id, m.value]),
    [
      ["product", 30],
      ["brand", 55],
      ["craft", 70],
    ],
  );
  assert.deepEqual(s.measures![0].parts, [
    { label: "Cap", value: 100 },
    { label: "Label", value: 30 },
  ]);
  assert.equal(s.measures![0].why, "The label reads ANTHEN.");
  assert.equal(s.measures![1].why, "The sled fills the left side.");
  assert.equal(pictureScores({ items: [] }), undefined, "a picture the Engine has not looked at is not scored");
});

test("a design is scored as a design: words over the product cost Placement", () => {
  const d: VersionDesign = {
    id: "d1",
    state: "made",
    fromVersionId: "c1",
    fromNumber: 1,
    requestedBy: "u",
    at: "2026-11-10T10:00:00Z",
    checks: [
      { check: "contrast", node: "Headline", ok: true, hard: true, note: "6.2:1." },
      { check: "covers", node: "Headline", ok: false, hard: true, note: "Covers the sled." },
      { check: "fits", node: "Headline", ok: true, hard: true, note: "Inside the safe area." },
      { check: "fits", node: "Headline", ok: false, hard: true, note: "Breaks inside a word: LEAGUE." },
    ],
    findings: [],
  };
  const s = designScores(d, { onBrand: 4 })!;
  assert.deepEqual(
    s.measures!.map((m) => [m.id, m.value]),
    [
      ["readability", 100],
      ["system", 80],
      ["placement", 50],
      ["words", 65],
    ],
  );
  const under = underBar({
    productTruth: "pass",
    brandRules: "pass",
    artefacts: "none",
    notes: [],
    evaluated: true,
    scores: s,
  });
  assert.deepEqual(
    under.map((m) => m.why),
    ["Headline: Covers the sled.", "Headline: Breaks inside a word: LEAGUE."],
  );
  assert.equal(designScores({ ...d, state: "designing" }), undefined);
});
