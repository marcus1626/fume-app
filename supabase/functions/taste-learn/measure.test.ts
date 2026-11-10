import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import { lab, measure, type Pixels, shrink } from "./measure.ts";

const picture = (w: number, h: number, paint: (x: number, y: number) => [number, number, number]): Pixels => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = paint(x, y);
      data.set([r, g, b, 255], (y * w + x) * 4);
    }
  return { width: w, height: h, data };
};

Deno.test("CIELAB is right for white, black and a known red", () => {
  assertAlmostEquals(lab(255, 255, 255)[0], 100, 0.1);
  assertAlmostEquals(lab(0, 0, 0)[0], 0, 0.1);
  const red = lab(255, 0, 0);
  assertAlmostEquals(red[0], 53.2, 0.3);
  assertAlmostEquals(red[1], 80.1, 0.5);
});

Deno.test("a dark, warm, empty picture reads as low key, warm and spacious", () => {
  const m = measure(picture(120, 160, () => [60, 40, 25]));
  assert(m.v["light.key"]! < 25);
  assert(m.v["colour.warmth"]! > 10);
  assert(m.v["composition.space"]! > 0.9);
  assertEquals(m.v["format.aspect"], 0.75);
  assertEquals(m.palette[0]!.hex, "#3C2819");
});

Deno.test("a bright cool picture with a subject on the left third", () => {
  const m = measure(picture(240, 160, (x, y) => (Math.hypot(x - 80, y - 53) < 18 ? [20, 60, 140] : [225, 232, 240])));
  assert(m.v["light.key"]! > 80);
  assert(m.v["colour.warmth"]! < 0);
  assert(m.v["composition.across"]! < 0.45);
  assert(m.v["composition.thirds"]! < 0.1);
  assert(m.v["composition.subject_size"]! < 0.3);
  assert(m.v["light.from_side"]! > 0, "the right side is brighter");
});

Deno.test("noise reads as grain; a clean picture does not", () => {
  let seed = 1;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const noisy = measure(
    picture(100, 100, () => {
      const v = 128 + (rand() - 0.5) * 30;
      return [v, v, v];
    }),
  );
  const clean = measure(picture(100, 100, () => [128, 128, 128]));
  assert(noisy.v["detail.grain"]! > clean.v["detail.grain"]!);
  assertEquals(Object.keys(clean.v).length, 33);
});

Deno.test("a big picture is made small, keeping its colour", () => {
  const big = picture(1000, 600, () => [200, 100, 50]);
  const small = shrink(big, 256);
  assertEquals([small.width, small.height], [250, 150]);
  assertEquals([...small.data.slice(0, 4)], [200, 100, 50, 255]);
});
