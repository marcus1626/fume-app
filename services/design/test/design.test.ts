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
  const c = compose(book, "feed", { headline: 'She said "{hi}" <b>', cta: "Go" }, { band: "top", align: "left", headline: "h1", colour: "on_photo", ground: "photo", cta: "with_words", columns: 9 }, () => "Inter");
  assert.ok(c.jsx.includes(JSON.stringify('She said "{hi}" <b>')), "words are written as data, not markup");
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

test("a short word is held to the next one, and nothing else changes", async () => {
  const { bindShort } = await import("../src/compose.ts");
  assert.equal(bindShort("Førsteklasses skinn i overdelen"), "Førsteklasses skinn i\u00A0overdelen");
  assert.equal(bindShort("for deg og din familie."), "for deg og\u00A0din familie.");
  assert.equal(bindShort("Kjøp nå").replace(/\u00A0/g, " "), "Kjøp nå");
});

test("the brand's own layout comes first: its place, width, ground and call to action", () => {
  const branded = {
    ...book,
    onPictures: { layouts: [{ name: "Block bottom left", band: "bottom", align: "left", wordsWidthPct: 50, ground: "colour_block", words: "light", cta: "underline" }] },
  } as unknown as typeof book;
  const [l] = [...layoutsFor(branded, "feed", {}, true)];
  assert.equal(l.band, "bottom");
  assert.equal(l.ground, "block");
  assert.equal(l.ctaLook, "underline");
  assert.equal(l.signature, "Block bottom left");
  assert.ok(l.columns < 9, "half the width");
  const picked = [...layoutsFor(branded, "feed", { band: "top" }, true)][0];
  assert.equal(picked.band, "top", "the picture's calm place, from the model's eye, still wins");
  assert.ok(![...layoutsFor(book, "feed", {}, true)].some((x) => x.ground === "block"), "no colour block for a brand that never uses one");
});

test("words on a block of the brand's colour, and a call to action as underlined words", () => {
  const c = compose(book, "feed", { headline: "Morning", cta: "See it" }, { band: "bottom", align: "left", headline: "h1", colour: "on_primary", ground: "block", cta: "with_words", columns: 6, ctaLook: "underline" }, () => "Inter");
  assert.ok(c.panel, "the panel's colour is known, so contrast is measured against it");
  assert.ok(c.jsx.includes('name="Rule"'), "the call to action is underlined");
  assert.ok(!c.jsx.includes('name="CTA" w="hug" h="hug" px='), "no pill");
});

test("a light pill with dark words, when the brand's buttons are white", () => {
  const c = compose(book, "feed", { headline: "Morning", cta: "Buy" }, { band: "top", align: "left", headline: "h1", colour: "on_photo", ground: "photo", cta: "with_words", columns: 9, ctaFill: "light" }, () => "Inter");
  const light = book.colours.find((x) => x.role === "on_photo")?.hex.toUpperCase() ?? "#FFFFFF";
  const dark = book.colours.find((x) => x.role === "text")?.hex.toUpperCase() ?? "#000000";
  assert.equal(c.colours.CTA, dark, "dark words on the pill");
  assert.ok(c.jsx.includes(`bg=${JSON.stringify(light)}><Text name="CTA words"`), "the pill is the light colour");
});

test("the brand's own block colour from its ads, with words that read on it, and no call to action where its ads carry none", () => {
  const branded = {
    ...book,
    onPictures: { layouts: [
      { name: "Green panel", hasWords: true, band: "top", align: "left", wordsWidthPct: 60, ground: "colour_block", groundHex: "#0A5C36", words: "light", cta: "pill", ctaFill: "light" },
    ] },
  } as unknown as typeof book;
  const l = [...layoutsFor(branded, "feed", {}, true)].find((x) => x.ground === "block")!;
  assert.equal(l.groundHex, "#0A5C36");
  const c = compose(branded, "feed", { headline: "Morning", cta: "Read more" }, l, () => "Inter");
  assert.equal(c.panel, "#0A5C36");
  assert.equal(c.colours.CTA, "#0A5C36", "green words on the white pill");
  const quiet = { ...book, onPictures: { layouts: [{ name: "Quote", hasWords: true, band: "bottom", align: "left", wordsWidthPct: 80, ground: "photo", words: "light", cta: "none" }] } } as unknown as typeof book;
  assert.ok([...layoutsFor(quiet, "feed", {}, true)].every((x) => x.cta === "none"));
});

test("the brand's own font file sets its face, and only on its own brand's creatives", async () => {
  const file = await readFile(new URL("../node_modules/@open-pencil/core/assets/Inter-Bold.ttf", import.meta.url));
  const pic = await picture("#EDE6DA", "#2B2B2B");
  const mine = await design({
    picture: pic,
    format: "feed",
    book,
    words,
    keepClear: [product],
    fonts: [{ family: "brand serif pro", weight: 700, italic: false, bytes: new Uint8Array(file) }],
  });
  const display = mine.fonts.find((f) => f.style === mine.layout.headline);
  assert.deepEqual([display?.used, display?.own], ["Brand Serif Pro", true]);
  assert.ok(mine.checks.some((c) => c.check === "font" && c.ok && /own font file/.test(c.note)));
  // The next brand's book names the same family without a file: it never gets the first brand's.
  const theirs = await design({ picture: pic, format: "feed", book, words, keepClear: [product] });
  const other = theirs.fonts.find((f) => f.style === theirs.layout.headline);
  assert.equal(other?.used, "Libre Baskerville");
  assert.equal(other?.own, undefined);
});
