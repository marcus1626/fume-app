import { test } from "node:test";
import assert from "node:assert/strict";
import { plainEdges, inset } from "../src/room.ts";
import { pixelsOf } from "../src/render.ts";
import { startWithTestFonts } from "./fonts.ts";

startWithTestFonts();

function backdrop(w: number, h: number, edge: (x: number, y: number) => number): Uint8Array {
  const px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = edge(x, y);
      px.set([v, v, v, 255], (y * w + x) * 4);
    }
  return px;
}

test("a soft fall of light at the edges is a plain backdrop; a scene is not", () => {
  const soft = backdrop(200, 250, (x, y) => 150 + Math.round((x + y) / 10));
  assert.equal(plainEdges(soft, 200, 250), true);
  const scene = backdrop(200, 250, (x) => (Math.floor(x / 9) % 2 ? 40 : 220));
  assert.equal(plainEdges(scene, 200, 250), false);
  // A night street: dark, with a few dim lit windows along its edge. In linear light it looked smooth.
  const night = backdrop(200, 250, (x, y) => ((x > 60 && x < 70) || (y > 100 && y < 112) ? 50 : 22));
  assert.equal(plainEdges(night, 200, 250), false, "a dark scene with lights at its edge is not a backdrop");
});

test("a packshot is set smaller in the corner and the boxes move with it", async () => {
  const { start } = await import("../src/render.ts");
  const { ck } = await start();
  const surface = ck.MakeSurface(400, 500)!;
  const c = surface.getCanvas();
  c.clear(ck.Color(200, 200, 205, 1));
  const p = new ck.Paint();
  p.setColor(ck.Color(20, 30, 60, 1));
  c.drawRect(ck.XYWHRect(60, 60, 340, 440), p);
  const bytes = surface.makeImageSnapshot().encodeToBytes()!;
  const room = await inset(bytes, { w: 400, h: 500 }, 0.8);
  assert.ok(room);
  assert.deepEqual(room.move({ x: 0, y: 0, w: 400, h: 500 }), { x: 80, y: 100, w: 320, h: 400 });
  const out = await pixelsOf(room.picture, 1);
  const at = (x: number, y: number) => out.data[(y * out.width + x) * 4];
  assert.ok(Math.abs(at(20, 20) - 200) < 6, "the free corner carries the backdrop on");
  assert.ok(at(300, 400) < 40, "the product is still there");
});
