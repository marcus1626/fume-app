import { assertEquals } from "jsr:@std/assert@1";
import { type CreativesAnswer, withCreatives } from "./creatives.ts";

const body = {
  styles: [
    { name: "display", font: "display", sizePx: 96, lineHeight: 1.1, trackingEm: 0, weight: 400, case: "none" },
    { name: "h1", font: "display", sizePx: 72, lineHeight: 1.1, trackingEm: 0, weight: 400, case: "none" },
    { name: "body", font: "body", sizePx: 28, lineHeight: 1.4, trackingEm: 0, weight: 400, case: "none" },
  ],
  typefaces: [
    { role: "display", family: "Brand Grotesk", fallback: "Inter", weights: [400], source: "brand", note: "" },
    { role: "body", family: "Brand Text", fallback: "Inter", weights: [400], source: "brand", note: "" },
  ],
};
const answer = (source: "pictures" | "site" | "fume"): CreativesAnswer => ({
  read: [{ picture: 1, carries: "words_and_logo", what: "Big stack bottom left" }, { picture: 1, carries: "words", what: "Same" }, { picture: 9, carries: "none", what: "not shown" }],
  headline: { seenAsHeadline: true, looksLike: "condensed grotesque, extra bold", closestGoogleFont: "Anton", weight: 840, case: "upper", condensed: true, trackingEm: -0.01, lineHeight: 0.88, sizePctOfWidth: 12, source },
  body: { looksLike: "neo-grotesque", closestGoogleFont: "Inter Tight", weight: 400, source },
  layouts: [{ name: "Big stack", hasWords: true, pictures: [1, 7], band: "bottom", align: "left", wordsWidthPct: 140, headlineLines: 5, box: { x: 0.06, y: 0.7, w: 1.2, h: 0.2 }, priceVsHeadline: "none", ground: "photo", words: "light", groundHex: "", cta: "pill", ctaFill: "light", logo: "top_left", logoWidthPct: 9, why: "", source }],
  rules: ["Never more than six words in the headline"],
  sources: [],
  gaps: [],
});

Deno.test("what the brand's pictures show sets the headline: case, weight, size, and the closest Google Font", () => {
  const out = withCreatives(body, answer("pictures"), [{ url: "https://x/1.jpg", kind: "site" }]);
  const display = out.styles.find((s) => s.name === "display")!;
  assertEquals([display.case, display.weight, display.lineHeight, display.sizePx], ["upper", 800, 0.88, 130]);
  assertEquals(out.styles.find((s) => s.name === "h1")!.sizePx, 101);
  assertEquals(out.styles.find((s) => s.name === "body")!.case, "none", "the body is not the headline");
  assertEquals(out.typefaces.map((t) => t.fallback), ["Anton", "Inter Tight"]);
  const on = out.onPictures as { read: unknown[]; layouts: { pictures: number[]; wordsWidthPct: number }[]; carrying: number };
  assertEquals(on.read.length, 2, "only pictures that were shown");
  assertEquals(on.layouts[0].pictures, [1]);
  assertEquals(on.layouts[0].wordsWidthPct, 100);
  const first = on.layouts[0] as unknown as { headlineLines: number; box: unknown };
  assertEquals([first.headlineLines, first.box], [3, { x: 0.06, y: 0.7, w: 0.94, h: 0.2 }], "measured, and cut to the frame");
  assertEquals(on.carrying, 2);
});

Deno.test("a proposal where no picture shows it is kept beside the book and changes nothing in it", () => {
  const out = withCreatives(body, answer("fume"), [{ url: "https://x/1.jpg", kind: "site" }]);
  assertEquals(out.styles, body.styles);
  assertEquals(out.typefaces, body.typefaces);
});

Deno.test("a caption or a name tag on a photo is not taken for the brand's headline", () => {
  const a = answer("pictures");
  const out = withCreatives(body, { ...a, headline: { ...a.headline, seenAsHeadline: false, sizePctOfWidth: 3.5 } }, [{ url: "https://x/1.jpg", kind: "site" }]);
  assertEquals(out.styles, body.styles);
  assertEquals(out.typefaces[0].fallback, "Inter");
});

Deno.test("the brand's own site, seen as a visitor sees it, sets the headline too, and a player's font gives way", () => {
  const b = { ...body, typefaces: [{ ...body.typefaces[0], family: "VideoJS" }, body.typefaces[1]] };
  const out = withCreatives(b, answer("site"), [{ url: "https://x/1.jpg", kind: "screenshot" }]);
  assertEquals(out.styles.find((s) => s.name === "display")!.case, "upper");
  assertEquals([out.typefaces[0].family, out.typefaces[0].fallback, out.typefaces[0].source], ["Anton", "Anton", "stand_in"]);
  assertEquals(out.typefaces[1].family, "Brand Text", "a real face is kept");
});

Deno.test("a headline size read from the brand's website is a floor for a feed ad; one read from its own ads is the size", () => {
  const a = answer("site");
  const small = { ...a, headline: { ...a.headline, sizePctOfWidth: 6 } };
  const site = withCreatives(body, small, [{ url: "https://x/1.jpg", kind: "screenshot" }]);
  assertEquals(site.styles.find((s) => s.name === "display")!.sizePx, 96, "the writer's feed size stands over a desktop tile's");
  const ads = withCreatives(body, small, [{ url: "https://x/1.jpg", kind: "liked" }]);
  assertEquals(ads.styles.find((s) => s.name === "display")!.sizePx, 65, "the brand's own ads set it");
});
