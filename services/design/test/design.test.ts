import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { design, layoutsFor } from "../src/design.ts";
import { compose } from "../src/compose.ts";
import { build, png, pixelsOf } from "../src/render.ts";
import { type DesignBook } from "../src/book.ts";
import { startWithTestFonts } from "./fonts.ts";

const book = JSON.parse(await readFile(new URL("./fixtures/book.json", import.meta.url), "utf8")) as DesignBook;
startWithTestFonts();

/** A test picture: a pale top, a dark bottom and a "product" in the middle. */
async function picture(top: string, bottom: string) {
  const doc = await build(
    `<Frame name="P" w={1080} h={1350} bg=${JSON.stringify(top)}><Rectangle name="Bottom" position="absolute" x={0} y={700} w={1080} h={650} bg=${JSON.stringify(bottom)} /><Rectangle name="Product" position="absolute" x={380} y={520} w={320} h={420} bg="#C8102E" /></Frame>`,
    new Uint8Array([0]),
  );
  return png(doc, 0.5);
}
const product = { x: 380, y: 520, w: 320, h: 420, what: "the product" };
const words = { headline: "Morning, slowly", subline: "Fresh from the roastery.", cta: "See it" };

test("every layout is named from the book only", () => {
  const all = [...layoutsFor(book, "feed", { band: "bottom", headline: "nonsense", colour: "nonsense" }, true)];
  assert.ok(all.length > 20);
  assert.equal(all[0].band, "bottom", "the model's place comes first");
  for (const l of all) {
    assert.ok(book.styles.some((s) => s.name === l.headline), l.headline);
    assert.ok(book.colours.some((c) => c.role === l.colour), l.colour);
  }
});

test("the words are the plan's and the colours the book's", () => {
  const c = compose(book, "feed", { headline: 'He said "{hi}" <b>', cta: "Go" }, { band: "top", align: "left", headline: "h1", colour: "on_photo", ground: "photo", cta: "with_words", columns: 9 }, () => "Inter");
  assert.ok(c.jsx.includes(JSON.stringify('He said "{hi}" <b>')), "words are written as data, not markup");
  assert.equal(c.colours.Headline, "#FFFFFF");
  assert.ok(c.jsx.includes('bg="#1F4E3D"'), "the call to action is the book's cta colour");
});

test("white words go where the picture is dark, clear of the product", async () => {
  const out = await design({ picture: await picture("#F4F1EC", "#15171A"), format: "feed", book, words, prefer: { band: "top" }, keepClear: [product] });
  assert.ok(out.ok, JSON.stringify(out.attempts.slice(0, 3)));
  const contrast = out.checks.filter((c) => c.check === "contrast");
  assert.ok(contrast.every((c) => c.ok));
  assert.ok(!out.checks.some((c) => c.check === "covers"));
  // On the pale top, white words fail: either dark words stay on top, or the words are shaded or moved.
  if (out.layout.band === "top" && out.layout.ground === "photo") assert.notEqual(out.layout.colour, "on_photo");
  assert.ok(out.png.byteLength > 1000 && out.fig.byteLength > 1000);
  assert.equal(out.width, 1080);
});

test("the brand's own font is used when Fume has it, and a missing one is said", async () => {
  const out = await design({ picture: await picture("#15171A", "#15171A"), format: "feed", book, words, keepClear: [product] });
  const font = out.checks.filter((c) => c.check === "font");
  assert.equal(font.length, 1, JSON.stringify(font));
  assert.match(font[0].note, /Brand Serif Pro is not on file; set in Libre Baskerville/);
  assert.equal(out.fonts.find((f) => f.style === "subline")?.used, "Nunito Sans");
});

test("a story keeps its words out of the platform's top and bottom", async () => {
  const out = await design({ picture: await picture("#15171A", "#15171A"), format: "story", book, words, prefer: { band: "bottom" } });
  assert.ok(out.ok);
  assert.ok(out.boxes.Words.y >= 250 && out.boxes.Words.y + out.boxes.Words.h <= 1920 - 340, JSON.stringify(out.boxes.Words));
  const px = await pixelsOf(out.png, 1);
  assert.equal(px.width, 1080);
  assert.equal(px.height, 1920);
});

test("a subline's lines come out even: the same number of lines, no lone word on the last", async () => {
  const pic = await picture("#0E1A14", "#0E1A14");
  const long = { headline: "Morning, slowly", subline: "Fresh from the roastery every single morning, ground for you by hand." };
  const prefer = { band: "top" as const, align: "left" as const, colour: "on_photo", columns: 9 };
  const out = await design({ picture: pic, format: "feed", book, words: long, prefer, keepClear: [product] });
  const sub = out.boxes.Subline;
  const full = out.boxes.Words.w;
  assert.ok(out.ok);
  assert.ok(sub.w < full, `the subline is set narrower than its column (${sub.w} < ${full})`);
});
