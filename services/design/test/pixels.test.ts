import { test } from "node:test";
import assert from "node:assert/strict";
import { contrast, luminance, overlap, shadeAt, under } from "../src/pixels.ts";

/** A picture of w × h layout pixels at scale 1, filled by a function of x and y. */
function picture(w: number, h: number, at: (x: number, y: number) => [number, number, number]) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = at(x, y);
      data.set([r, g, b, 255], (y * w + x) * 4);
    }
  return { data, width: w, height: h, scale: 1 };
}

test("contrast is measured the way WCAG measures it", () => {
  assert.equal(Math.round(contrast(luminance(0, 0, 0), luminance(255, 255, 255))), 21);
  assert.equal(contrast(0.5, 0.5), 1);
});

test("white words on a dark ground pass and on a white ground do not", () => {
  const p = picture(100, 100, (_x, y) => (y < 50 ? [20, 20, 30] : [250, 250, 250]));
  assert.ok(under(p, { x: 0, y: 0, w: 100, h: 40 }, "#FFFFFF").contrast > 10);
  assert.ok(under(p, { x: 0, y: 60, w: 100, h: 40 }, "#FFFFFF").contrast < 1.2);
});

test("a small bright spot is found even when nine in ten pixels are dark", () => {
  const p = picture(100, 100, (x, y) => (Math.hypot(x - 50, y - 20) < 7 ? [255, 255, 240] : [15, 15, 20]));
  const u = under(p, { x: 0, y: 0, w: 100, h: 40 }, "#FFFFFF", [], 12);
  assert.ok(u.contrast > 10, "nine in ten are dark");
  assert.ok(u.worst < 2, `the lamp is found (${u.worst})`);
});

test("a shade from the top darkens what lies under it", () => {
  const p = picture(100, 200, () => [240, 240, 240]);
  const shade = { hex: "#000000", from: 0.7, edge: "top" as const, full: 60, zero: 120 };
  assert.equal(shadeAt(shade, 30), 0.7);
  assert.equal(shadeAt(shade, 150), 0);
  assert.ok(Math.abs(shadeAt(shade, 90) - 0.35) < 1e-9);
  assert.ok(under(p, { x: 0, y: 0, w: 100, h: 50 }, "#FFFFFF", [shade]).contrast > 3);
  assert.ok(under(p, { x: 0, y: 0, w: 100, h: 50 }, "#FFFFFF").contrast < 1.2);
});

test("overlap is the share of the first box inside the second", () => {
  assert.equal(overlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 0, w: 10, h: 10 }), 0.5);
  assert.equal(overlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 20, w: 5, h: 5 }), 0);
});
