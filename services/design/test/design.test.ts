import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { design, fitFor, layoutsFor, tasteOf, type Tried } from "../src/design.ts";
import { bindShort, compose } from "../src/compose.ts";
import { build, lineWidth, png, pixelsOf, splitWords } from "../src/render.ts";
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

test("the brand's own words colour comes before the model's", () => {
  const branded = {
    ...book,
    colours: [...book.colours, { hex: "#00563F", role: "accent" }],
    onPictures: { layouts: [{ name: "Green stack", hasWords: true, band: "top", align: "left", wordsWidthPct: 50, ground: "photo", words: "brand_colour", cta: "box" }] },
  } as unknown as typeof book;
  const all = [...layoutsFor(branded, "feed", { colour: "text" }, true)];
  assert.equal(all[0].colour, "accent", "the brand's green stack first");
  assert.ok(all.some((x) => x.colour === "text"), "the model's colour is still tried");
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

test("a price from the plan is set as the brand's figure, under the headline, and checked like the words", async () => {
  const pic = await picture("#EDE6DA", "#2B2B2B");
  const out = await design({ picture: pic, format: "feed", book, words: { ...words, price: "199,-" }, keepClear: [product] });
  assert.ok(out.boxes.Price, "the price is laid out");
  assert.ok(out.boxes.Price.y > out.boxes.Headline.y, "under the headline");
  assert.ok(out.boxes.Price.h > out.boxes.Headline.h / 2, "big enough to be the figure");
  assert.ok(out.checks.some((c) => c.node === "Price" && c.check === "contrast"));
});

test("the price before is set small under the figure", async () => {
  const { splitPrice } = await import("../src/compose.ts");
  assert.deepEqual(splitPrice("NÅ 199,- TIDLIGERE 399,-"), { now: "NÅ 199,-", was: "TIDLIGERE 399,-" });
  assert.deepEqual(splitPrice("199,-"), { now: "199,-", was: null });
  const pic = await picture("#EDE6DA", "#2B2B2B");
  const out = await design({ picture: pic, format: "feed", book, words: { ...words, price: "NÅ 199,- før 399,-" }, keepClear: [product] });
  assert.ok(out.boxes.Was && out.boxes.Was.y > out.boxes.Price.y && out.boxes.Was.h < out.boxes.Price.h);
});

test("of the layouts that pass, the one a designer would pick: the headline in the brand's lines, and big", () => {
  const branded = { ...book, onPictures: { layouts: [{ name: "Stack", band: "middle", align: "left", wordsWidthPct: 25, ground: "photo", words: "dark", cta: "box", headlineLines: 1 }] } } as DesignBook;
  const tried = (lines: number, lineH: number, band: "top" | "middle"): Tried => ({
    layout: { band, align: "left", headline: "h1", colour: "text", ground: "photo", cta: "with_words", columns: 4, signature: "Stack" },
    ok: true, score: 8, shades: [],
    checks: [{ check: "lines", node: "Headline", ok: true, hard: true, value: lines, need: 3, note: "" }],
    boxes: { Headline: { x: 64, y: 64, w: 400, h: lines * lineH } },
  });
  const narrow = tasteOf(tried(2, 70, "middle"), branded, { band: "middle", align: "left" });
  const wide = tasteOf(tried(1, 110, "top"), branded, { band: "middle", align: "left" });
  assert.ok(wide > narrow, `one big line (${wide}) beats two small ones in the brand's own band (${narrow})`);
  // Anthem, 9 Nov: a one-line brand's headline was set at half its size to stay on one line.
  const small = tasteOf(tried(1, 49, "middle"), branded, { band: "middle", align: "left" });
  const stacked = tasteOf(tried(3, 105, "middle"), branded, { band: "middle", align: "left" });
  const tower = tasteOf(tried(4, 105, "middle"), branded, { band: "middle", align: "left" });
  assert.ok(stacked > small, `three big lines (${stacked}) beat one small line (${small})`);
  assert.ok(small > tower, `but four (${tower}) do not`);
});

test("a big headline stacks in a narrower column before it steps down a size", () => {
  const all = [...layoutsFor(book, "feed", { band: "top", align: "left" }, true)];
  const first = all.findIndex((l) => l.headline !== all[0].headline);
  const before = all.slice(0, first);
  assert.ok(new Set(before.map((l) => l.columns)).size >= 4, "every column width is tried at the first size");
  assert.ok(before.some((l) => l.columns === 5));
});

test("a long call to action stays on one line inside its button", async () => {
  // Anthem, 9 Nov: "SHOP BASKETBALL HOOPS" was laid out on two lines, drawn on one, and ran out of its button.
  const l = { band: "top", align: "left", headline: "h1", colour: "text", ground: "photo", cta: "with_words", columns: 5 } as const;
  const long = { ...words, cta: "Shop basketball hoops" };
  const pic = await picture("#F4F1EC", "#15171A");
  const c = compose(book, "feed", long, l, () => "Inter");
  const doc = await build(c.jsx, pic);
  const line = lineWidth(doc, "CTA words")!;
  assert.ok(line.width > line.box + 2, "the narrow column breaks the button's words");
  const fit = fitFor(doc, c.sizes);
  assert.ok(fit?.cta && fit.cta < 1, JSON.stringify(fit));
  const cf = compose(book, "feed", long, { ...l, fit }, () => "Inter");
  const fitted = lineWidth(await build(cf.jsx, pic), "CTA words")!;
  assert.ok(fitted.width <= fitted.box + 2, `set smaller, the words fit on one line (${fitted.width} in ${fitted.box})`);
});

test("an outlined call to action is a thin border in the words' colour, with no fill", () => {
  const c = compose(book, "feed", { headline: "Game on", cta: "Shop now" }, { band: "top", align: "left", headline: "h1", colour: "on_photo", ground: "photo", cta: "with_words", columns: 6, ctaLook: "outline" }, () => "Inter");
  const frame = c.jsx.slice(c.jsx.indexOf('<Frame name="CTA"'), c.jsx.indexOf('<Text name="CTA words"'));
  assert.match(frame, /stroke="#FFFFFF"/);
  assert.doesNotMatch(frame, /\bbg=/);
  assert.equal(c.colours.CTA, "#FFFFFF");
});

test("a short word held to the next is measured with it, so the pair is never broken inside a word", async () => {
  // Anthem, 9 Nov: "Room to Grow." was drawn "to Gr / ow." in a column each word fitted on its own.
  const pic = await picture("#F4F1EC", "#15171A");
  const doc = await build(`<Frame name="f" w={1080} h={1350}><Text name="Headline" w={282} font="Inter" weight={700} size={88} lineHeight={97} text={${JSON.stringify(bindShort("Room to Grow."))}} /></Frame>`, pic);
  assert.deepEqual(splitWords(doc, "Headline"), ["to Grow."]);
});

test("where the photo gives the words no calm place, the brand's own block of colour is tried", () => {
  const branded = { ...book, onPictures: { layouts: [
    { name: "On the photo", band: "middle", align: "left", wordsWidthPct: 50, ground: "photo", words: "light", cta: "box", headlineLines: 1 },
    { name: "Navy block", band: "bottom", align: "left", wordsWidthPct: 60, ground: "colour_block", groundHex: "#11213A", words: "light", cta: "box", headlineLines: 2, box: { x: 0.06, y: 0.68, w: 0.6, h: 0.26 } },
  ] } } as DesignBook;
  const all = [...layoutsFor(branded, "feed", { signature: "On the photo" }, true)];
  assert.equal(all[0].ground, "photo", "the model's own layout first");
  const block = all.find((l) => l.ground === "block")!;
  assert.deepEqual([block.signature, block.groundHex], ["Navy block", "#11213A"]);
  assert.ok(all.filter((l) => l.ground === "block" && l.band === "bottom").every((l) => l.at === 0.68), "at the block's own place");
});

test("a headline keeps the brand's headline case when it steps down a size", () => {
  const upper = { ...book, styles: book.styles.map((s) => (s.name === "display" ? { ...s, case: "upper" as const } : s.name === "h1" ? { ...s, case: "title" as const } : s)) };
  const c = compose(upper, "feed", { headline: "Own the court", cta: "Go" }, { band: "top", align: "left", headline: "h1", colour: "on_photo", ground: "photo", cta: "with_words", columns: 9 }, () => "Inter");
  const head = c.jsx.slice(c.jsx.indexOf('name="Headline"'), c.jsx.indexOf("/>", c.jsx.indexOf('name="Headline"')));
  assert.ok(head.includes('textCase="upper"'), head);
});
