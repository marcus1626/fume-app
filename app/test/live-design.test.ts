// A live design is listed as the layers it has in the made picture (api/live/design.ts, features/studio/doc/layers.ts).
// Run: npm test.
/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "vitest";
import { toVersionDesign, type DesignRow } from "../src/api/live/design";
import { designedLayers } from "../src/features/studio/doc/layers";
import type { RenderVersion } from "../src/contract";

const row = (layout: Record<string, unknown>): DesignRow => ({
  id: "d1",
  state: "made",
  candidate_id: "c1",
  creative_id: "cr1",
  ask: null,
  book_id: null,
  book_version: null,
  words: { headline: "Sand League Season", subline: "Made in the USA.", cta: "SHOP NOW" },
  layout,
  checks: [],
  findings: [],
  choice: { verdict: "needs_work" },
  result_candidate_id: "c2",
  document_file_id: null,
  error: null,
  llm_usd: 0.01,
  requested_by: "u1",
  created_at: "2026-11-10T10:00:00Z",
});
const version = (design: RenderVersion["design"]) => ({ id: "v2", number: 2, design }) as RenderVersion;

test("a design made after 10 Nov lists its words and logo where they are in the picture", () => {
  const d = toVersionDesign(
    row({
      band: "middle",
      align: "left",
      ground: "photo",
      colour: "text",
      boxes: {
        Headline: { x: 0.07, y: 0.5, w: 0.4, h: 0.2 },
        CTA: { x: 0.07, y: 0.82, w: 0.2, h: 0.04 },
        Logo: { x: 0.07, y: 0.05, w: 0.2, h: 0.04 },
        Bad: { x: 3 },
      },
      logo: { where: "top_left", variant: "Primary" },
    }),
    1,
    undefined,
    undefined,
    "Sand league",
  );
  assert.deepEqual(Object.keys(d.layout?.boxes ?? {}), ["Headline", "CTA", "Logo"]);
  const layers = designedLayers(version(d), undefined, "feed");
  const head = layers.find((l) => l.component === "headline")!;
  assert.equal(head.y, 0.5);
  assert.equal(head.h, 0.2);
  const logo = layers.find((l) => l.kind === "logo")!;
  assert.equal(logo.visible, true);
  assert.equal(logo.variant, "Primary");
  assert.equal(logo.y, 0.05);
});

test("a design with the logo left off lists it hidden; an older one without boxes keeps the book's places", () => {
  const off = toVersionDesign(
    row({ band: "top", align: "left", ground: "photo", colour: "text", logo: null }),
    1,
    undefined,
    undefined,
    "x",
  );
  assert.equal(off.layout?.logo, null);
  assert.equal(designedLayers(version(off), undefined, "feed").find((l) => l.kind === "logo")!.visible, false);
  const old = toVersionDesign(
    row({ band: "top", align: "left", ground: "photo", colour: "text" }),
    1,
    undefined,
    undefined,
    "x",
  );
  assert.equal(old.layout?.boxes, undefined);
  assert.ok(designedLayers(version(old), undefined, "feed").find((l) => l.component === "headline"));
});
