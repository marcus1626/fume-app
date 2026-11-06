import { test } from "node:test";
import assert from "node:assert/strict";
import { googleFonts } from "../src/fonts.ts";

const css = (url: string) => `@font-face { font-family: 'X'; src: url(${url}) format('truetype'); }`;

test("a family with one weight is set in that weight, and each file is fetched once", async () => {
  const asked: string[] = [];
  const get = (async (u: string | URL) => {
    const s = String(u);
    asked.push(s);
    if (s.includes("fonts.gstatic.com")) return new Response(new Uint8Array([1, 2, 3]));
    if (s.includes("family=Anton&")) return new Response(css("https://fonts.gstatic.com/s/anton/a.ttf"));
    return new Response("no", { status: 400 });
  }) as typeof fetch;
  const font = googleFonts(get);
  const a = await font("Anton", 800, false);
  assert.equal(a?.byteLength, 3);
  await font("Anton", 800, false);
  assert.equal(asked.filter((u) => u.includes("gstatic")).length, 1);
  assert.ok(asked[0].includes("Anton:ital,wght@0,800"), "the weight asked for is tried first");
});

test("a name that is not a family name is never sent", async () => {
  let called = false;
  const font = googleFonts((async () => ((called = true), new Response(""))) as unknown as typeof fetch);
  assert.equal(await font("x&family=y", 400, false), null);
  assert.equal(called, false);
});

test("capitals set in a taller stand-in keep the gap between lines the brand's own face leaves", async () => {
  const { standInLeading } = await import("../src/design.ts");
  const { capOf } = await import("../src/render.ts");
  const { readFile } = await import("node:fs/promises");
  const anton = await readFile(new URL("./fixtures/anton.ttf", import.meta.url));
  const cap = capOf(new DataView(anton.buffer, anton.byteOffset, anton.byteLength))!;
  assert.ok(cap > 0.8 && cap < 0.9, `Anton's capitals are tall (${cap})`);
  assert.equal(standInLeading(0.9, cap), 1.04);
  assert.equal(standInLeading(0.9, 0.7), 0.9, "a face no taller than the brand's keeps the read line height");
  assert.equal(standInLeading(0.9, null), 0.9);
});
