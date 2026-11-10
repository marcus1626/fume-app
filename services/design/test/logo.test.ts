import { test } from "node:test";
import assert from "node:assert/strict";
import { reversed } from "../src/logo.ts";

test("a colour logo reversed keeps the drawing inside its mark: dark parts solid, light parts cut out", () => {
  // Two pixels: a dark green mark and the white drawing inside it.
  const px = new Uint8Array([11, 91, 53, 255, 255, 255, 255, 255]);
  const out = reversed(px, "#FFFFFF");
  assert.deepEqual([...out.subarray(0, 4)], [255, 255, 255, 255]);
  assert.equal(out[7], 0, "the light drawing is see-through, so the ground shows through it");
});

test("a logo in one tone is only tinted", () => {
  const px = new Uint8Array([20, 20, 20, 255, 22, 22, 22, 255]);
  const out = reversed(px, "#FFFFFF");
  assert.equal(out[3], 255);
  assert.equal(out[7], 255);
});
