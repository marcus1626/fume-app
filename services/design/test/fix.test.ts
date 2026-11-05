import { test } from "node:test";
import assert from "node:assert/strict";
import { blank, crop, cropFor, decode, encode, type Img, setBack } from "../src/fix.ts";
import { invalidFix } from "../src/handler.ts";
import { startWithTestFonts } from "./fonts.ts";

startWithTestFonts();

const flat = (width: number, height: number, rgb: [number, number, number]): Img => {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([...rgb, 255], i * 4);
  return { width, height, data };
};
const at = (img: Img, x: number, y: number) => [...img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 3)];

test("the crop holds the marked part with room around it, in one of the model's ratios, inside the picture", () => {
  const { rect, ratio } = cropFor({ x: 0.5, y: 0.25, w: 0.08, h: 0.04 }, 1856, 2304);
  assert.ok(rect.x <= 0.5 * 1856 && rect.x + rect.w >= 0.58 * 1856, "the part is inside the crop across");
  assert.ok(rect.y <= 0.25 * 2304 && rect.y + rect.h >= 0.29 * 2304, "and down");
  assert.ok(rect.w >= 384 && rect.h >= 384, "at least 384 px a side");
  const [a, b] = ratio.split(":").map(Number);
  assert.ok(Math.abs(rect.w / rect.h - a / b) < 0.01, `the crop is ${ratio}, so nothing is stretched`);
  const edge = cropFor({ x: 0.95, y: 0.95, w: 0.05, h: 0.05 }, 1000, 1000).rect;
  assert.ok(edge.x + edge.w <= 1000 && edge.y + edge.h <= 1000 && edge.x >= 0 && edge.y >= 0, "a part in the corner stays inside");
});

test("only the marked part changes: the redrawn crop is set back with a soft edge and the picture's own colour", () => {
  const picture = flat(400, 400, [100, 100, 100]);
  const box = { x: 0.4, y: 0.4, w: 0.2, h: 0.2 };
  const rect = { x: 100, y: 100, w: 200, h: 200 };
  // The model drew the part in white and drifted the whole crop 20 levels lighter.
  const redrawn = flat(400, 400, [120, 120, 120]);
  for (let y = 150; y < 250; y++) for (let x = 150; x < 250; x++) redrawn.data.set([255, 255, 255, 255], (y * 400 + x) * 4);
  const { picture: out, drift } = setBack(picture, redrawn, rect, box);
  assert.deepEqual(at(out, 10, 10), [100, 100, 100], "outside the crop nothing changes");
  assert.deepEqual(at(out, 101, 101), [100, 100, 100], "at the crop's edge the picture's own pixels");
  assert.ok(at(out, 200, 200)[0] > 220, "inside the part, the redrawn pixels");
  assert.ok(Math.abs(at(out, 165, 120)[0] - 100) <= 2, "the drift in light is taken out on the ring around the part");
  assert.ok(drift > 30, "and reported");
});

test("a crop for reading small print is close", () => {
  const { rect } = cropFor({ x: 0.5, y: 0.25, w: 0.05, h: 0.02 }, 1856, 2304, 128);
  assert.ok(rect.w < 384 && rect.w >= 128, "closer than a crop to redraw");
});

test("the marked part is blanked to its own plain colour, so the model draws the letters anew", () => {
  const label = flat(100, 60, [20, 20, 25]);
  for (let y = 25; y < 32; y++) for (let x = 20; x < 80; x++) label.data.set([240, 240, 240, 255], (y * 100 + x) * 4);
  const out = blank(label, { x: 10, y: 15, w: 80, h: 30 });
  assert.deepEqual(at(out, 50, 28), [20, 20, 25], "the wrong letters are gone, in the label's own colour");
  assert.deepEqual(at(label, 50, 28), [240, 240, 240], "the crop itself is not changed");
  assert.deepEqual(at(out, 5, 5), [20, 20, 25]);
});

test("pictures are read and written as PNG", async () => {
  const img = flat(40, 30, [10, 200, 30]);
  const back = await decode(await encode(img));
  assert.equal(back.width, 40);
  assert.deepEqual(at(back, 5, 5), [10, 200, 30]);
  assert.deepEqual(at(crop(back, { x: 10, y: 10, w: 5, h: 5 }), 0, 0), [10, 200, 30]);
});

test("a fix step is taken only with signed links to Fume's storage and a part inside the picture", () => {
  const host = "abc.supabase.co";
  const read = `https://${host}/storage/v1/object/sign/workspace-files/a.png?token=t`;
  const up = `https://${host}/storage/v1/object/upload/sign/workspace-files/b.png?token=t`;
  const box = { x: 0.1, y: 0.1, w: 0.2, h: 0.2 };
  assert.equal(invalidFix({ op: "fix-crop", picture: read, box, upload: { crop: up } }, host), null);
  assert.match(invalidFix({ op: "fix-crop", picture: "https://evil.example/a.png", box, upload: { crop: up } }, host)!, /signed link/);
  assert.match(invalidFix({ op: "fix-crop", picture: read, box: { x: 0.9, y: 0, w: 0.2, h: 0.1 }, upload: { crop: up } }, host)!, /inside/);
  assert.match(invalidFix({ op: "fix-set", picture: read, box, redrawn: "https://fal.media/x.png", rect: { x: 0, y: 0, w: 99, h: 99 }, upload: { png: up } }, host)!, /redrawn/);
  assert.equal(invalidFix({ op: "fix-set", picture: read, box, redrawn: read, rect: { x: 0, y: 0, w: 99, h: 99 }, upload: { png: up } }, host), null);
});
