import { test } from "node:test";
import assert from "node:assert/strict";
import { type Img } from "../src/fix.ts";
import { canvasFor, fits, kept, pad, RATIO, setMaster, windowFor } from "../src/format.ts";
import { chooseFormat, invalidFormat } from "../src/handler.ts";

const flat = (width: number, height: number, rgb: [number, number, number]): Img => {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([...rgb, 255], i * 4);
  return { width, height, data };
};
const at = (img: Img, x: number, y: number) => [...img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 3)];

test("a crop window is the largest of the new shape, around the product, inside the master", () => {
  const w = windowFor(1856, 2304, RATIO.square, { x: 0.3, y: 0.6, w: 0.3, h: 0.2 });
  assert.deepEqual([w.w, w.h], [1856, 1856]);
  assert.ok(w.y > 0 && w.y + w.h <= 2304, "moved down toward the product, and inside");
  const s = windowFor(1856, 2304, RATIO.story);
  assert.deepEqual([s.w, s.h], [1296, 2304]);
  assert.ok(Math.abs(kept(1856, 2304, RATIO.banner) - 0.45) < 0.01, "a banner from a feed master keeps less than half");
});

test("the Engine crops when the product fits with air, and expands when a crop would cut it", () => {
  const centred = { x: 0.3, y: 0.3, w: 0.4, h: 0.4 };
  assert.equal(chooseFormat(1856, 2304, "square", { around: centred }).method, "crop");
  assert.equal(chooseFormat(1856, 2304, "story", { around: { x: 0.05, y: 0.3, w: 0.9, h: 0.4 } }).reason, "cuts");
  assert.equal(chooseFormat(1856, 2304, "banner", { around: centred }).reason, "little");
  const tall = { x: 0.3, y: 0.08, w: 0.4, h: 0.85 };
  assert.equal(chooseFormat(1856, 2304, "story", { around: tall }).reason, "safe", "a story's top and bottom are the platform's");
  assert.equal(chooseFormat(1856, 2304, "story", { around: { x: 0.3, y: 0.2, w: 0.4, h: 0.55 } }).method, "crop");
  assert.equal(chooseFormat(1856, 2304, "square", {}).method, "expand", "without the product's place, nothing is cut");
  assert.equal(chooseFormat(1856, 2304, "square", { method: "expand", around: centred }).reason, "asked");
  const own = chooseFormat(1000, 1250, "square", { method: "crop", window: { x: 0, y: 0.1, w: 1, h: 0.8 } });
  assert.deepEqual(own.window, { x: 0, y: 125, w: 1000, h: 1000 }, "the designer's own window, kept to the shape");
  assert.ok(!fits({ x: 0.01, y: 0.3, w: 0.5, h: 0.3 }, { x: 0, y: 0, w: 1000, h: 1000 }, 1000, 1000), "no air at the edge is no fit");
});

test("an expansion keeps the master's scale and grows only the side the new shape needs", () => {
  const c = canvasFor(1856, 2304, RATIO.story);
  assert.deepEqual([c.width, c.at.x, c.at.w, c.at.h], [1856, 0, 1856, 2304]);
  assert.equal(c.height, 3300);
  assert.equal(c.at.y, 498);
  const b = canvasFor(1856, 2304, RATIO.banner);
  assert.equal(b.height, 2304);
  assert.equal(b.width, 4096);
});

test("the padded canvas holds the master and plain grey, at most 2048 px on its long side", () => {
  const master = flat(100, 125, [200, 10, 10]);
  const canvas = canvasFor(100, 125, RATIO.story);
  const p = pad(master, canvas);
  assert.equal(p.width, canvas.width);
  assert.deepEqual(at(p, 50, 2), [128, 128, 128]);
  assert.deepEqual(at(p, 50, canvas.at.y + 60), [200, 10, 10]);
  const big = pad(flat(2000, 2500, [0, 0, 0]), canvasFor(2000, 2500, RATIO.story));
  assert.equal(Math.max(big.width, big.height), 2048);
});

test("set back, every pixel of the master is the master's, but a narrow seam where the new edges meet it", () => {
  const master = flat(200, 250, [90, 90, 90]);
  for (let y = 100; y < 150; y++) for (let x = 80; x < 120; x++) master.data.set([250, 20, 20, 255], (y * 200 + x) * 4);
  const canvas = canvasFor(200, 250, RATIO.story);
  // The model drew the whole canvas 15 levels lighter and changed the product in the middle.
  const drawn = flat(canvas.width, canvas.height, [105, 105, 105]);
  const { picture, drift } = setMaster(master, drawn, canvas, 20);
  assert.deepEqual([picture.width, picture.height], [canvas.width, canvas.height]);
  assert.deepEqual(at(picture, 100, canvas.at.y + 120), [250, 20, 20], "the master's product, exactly");
  assert.deepEqual(at(picture, 100, canvas.at.y + 30), [90, 90, 90], "past the seam, the master's own pixels");
  assert.ok(Math.abs(at(picture, 100, 5)[0] - 90) <= 3, "the new edges take the master's colour");
  assert.ok(drift > 10, "and the drift is reported");
});

test("a format request needs Fume's own links and a known shape", () => {
  const host = "x.supabase.co";
  const read = `https://${host}/storage/v1/object/sign/a.png?token=t`;
  const up = `https://${host}/storage/v1/object/upload/sign/b.png?token=t`;
  assert.equal(invalidFormat({ op: "format", picture: read, format: "square", upload: { png: up, padded: up } }, host), null);
  assert.match(invalidFormat({ op: "format", picture: read, format: "poster", upload: { png: up, padded: up } }, host)!, /format/);
  assert.match(invalidFormat({ op: "format", picture: "https://evil.example/a.png", format: "square", upload: { png: up, padded: up } }, host)!, /signed/);
  assert.match(invalidFormat({ op: "format", picture: read, format: "square", window: { x: 0, y: 0, w: 1, h: 1 }, upload: { png: up, padded: up } }, host)!, /window/);
  assert.match(invalidFormat({ op: "format-set", picture: read, format: "story", upload: { png: up } }, host)!, /drawing/);
  assert.equal(invalidFormat({ op: "format-drawn", picture: read, format: "story", upload: { png: up } }, host), null);
  assert.match(invalidFormat({ op: "format-drawn", picture: read, format: "story", upload: {} }, host)!, /upload/);
});
