// The graphic design layer: the plan's words laid on a picture from the brand's design system. The model only chooses
// by name (where the words go, which headline style, which colour role); code tries the layouts in that order, measures
// each one in the picture (contrast under every line of words, how busy it is, what it covers, whether it fits the
// safe area), and keeps the best that passes. What did not pass is said, for the expert.
import { type DesignBook, type Format, type Style, componentOf, gridOf, headlineSteps, styleOf } from "./book.ts";
import { type Band, type Composed, type Ground, type Layout, type Words, compose, shadeFill, shadeFor } from "./compose.ts";
import { type Box, type Pixels, type Shade, overlap, under } from "./pixels.ts";
import { type Doc, boxOf, build, fig, hasFont, pixelsOf, place, png } from "./render.ts";

export interface Ask {
  picture: Uint8Array;
  format: Format;
  book: DesignBook;
  words: Words;
  /** The model's choice, tried first. */
  prefer?: Partial<Layout>;
  /** What the words must never cover (the product, a face, a logo), in layout pixels. */
  keepClear?: (Box & { what: string })[];
}

export interface Check {
  check: "fits" | "lines" | "contrast" | "busy" | "covers" | "font";
  node: string;
  ok: boolean;
  /** Hard checks fail the layout; soft ones are said to the expert. */
  hard: boolean;
  value?: number;
  need?: number;
  note: string;
}

export interface Tried {
  layout: Layout;
  ok: boolean;
  score: number;
  checks: Check[];
  boxes: Record<string, Box>;
  shades: Shade[];
}

export interface Designed {
  png: Uint8Array;
  fig: Uint8Array;
  width: number;
  height: number;
  layout: Layout;
  ok: boolean;
  checks: Check[];
  boxes: Record<string, Box>;
  tried: number;
  /** What the first layouts tried failed on, for the expert. */
  attempts: { layout: Layout; failed: string[] }[];
  fonts: { style: string; asked: string; used: string }[];
  ms: number;
}

const SCALE = 0.25;

export async function design(ask: Ask): Promise<Designed> {
  const t0 = Date.now();
  const { book, format, words } = ask;
  const g = gridOf(book, format);
  const pixels = await pictureAt(ask.picture, format, SCALE);
  const { familyFor, fonts } = await familiesOf(book);
  const keep = ask.keepClear ?? [];

  let best: { t: Tried; doc: Doc } | null = null;
  let tried = 0;
  const attempts: Designed["attempts"] = [];
  for (const l of layoutsFor(book, format, ask.prefer ?? {}, Boolean(words.cta))) {
    const c = compose(book, format, words, l, familyFor);
    const doc = await build(c.jsx, ask.picture);
    const t = measure(doc, c, l, book, pixels, keep);
    tried++;
    if (attempts.length < 30) {
      attempts.push({ layout: l, failed: t.checks.filter((x) => !x.ok && x.hard).map((x) => `${x.node}: ${x.note}`) });
    }
    if (!best || better(t, best.t)) best = { t, doc };
    if (best.t.ok && tried >= 6) break;
    if (tried >= 120) break;
  }
  if (!best) throw new Error("No layout could be made.");
  const used = new Set([best.t.layout.headline, "subline", componentOf(book, "cta")?.style ?? "cta"]);
  const seen = new Set<string>();
  const fontChecks: Check[] = fonts
    .filter((f) => used.has(f.style) && f.asked !== f.used && !seen.has(f.asked) && seen.add(f.asked))
    .map((f) => ({
      check: "font",
      node: f.style,
      ok: false,
      hard: false,
      note: `${f.asked} is not on file; set in ${f.used} until the brand gives Fume its font.`,
    }));
  const out = best.doc;
  return {
    png: await png(out, 1),
    fig: await fig(out),
    width: g.w,
    height: g.h,
    layout: best.t.layout,
    ok: best.t.ok,
    checks: [...best.t.checks, ...fontChecks],
    boxes: best.t.boxes,
    tried,
    attempts,
    fonts,
    ms: Date.now() - t0,
  };
}

/** The layouts to try, the model's choice first, then the rest of what the book allows. */
export function* layoutsFor(book: DesignBook, format: Format, prefer: Partial<Layout>, hasCta: boolean): Generator<Layout> {
  const comp = componentOf(book, "headline");
  const first = prefer.headline && styleOf(book, prefer.headline) ? prefer.headline : (comp?.style ?? "h1");
  const steps = headlineSteps(book, first).map((s) => s.name);
  const bands: Band[] = uniq([prefer.band ?? "top", "top", "bottom", "middle"]) as Band[];
  const aligns = uniq([prefer.align ?? "left", "left", "center"]) as ("left" | "center")[];
  const photoColour = prefer.colour && book.colours.some((c) => c.role === prefer.colour) ? prefer.colour : "on_photo";
  const colours = uniq([photoColour, "on_photo", comp?.colour ?? "text", "text"]).filter((r) =>
    book.colours.some((c) => c.role === r),
  );
  const scrim = book.photoText?.scrim ?? "gradient";
  const grounds: Ground[] = uniq([
    prefer.ground ?? "photo",
    "photo",
    ...(scrim === "gradient" ? ["gradient"] : []),
    "flat",
  ]) as Ground[];
  const widths = prefer.columns ? [prefer.columns] : format === "banner" ? [6, 8] : [9, 12];
  const cta = hasCta ? (prefer.cta ?? "with_words") : "none";
  // The model's place for the words first; there, the picture as it is, then a shade, then a panel; then the
  // other places. The headline steps down a size before the words move.
  for (const band of bands) {
    for (const ground of grounds) {
      if (ground === "gradient" && band === "middle") continue;
      for (const align of aligns) {
        for (const columns of widths) {
          for (const headline of steps.slice(0, 3)) {
            for (const colour of ground === "flat" ? ["text"] : colours) {
              yield { band, align, headline, colour, ground, cta, columns };
            }
          }
        }
      }
    }
  }
}

/** Places the words, then measures the layout in the picture. */
export function measure(doc: Doc, c: Composed, l: Layout, book: DesignBook, p: Pixels, keep: (Box & { what: string })[]): Tried {
  const g = c.grid;
  const words0 = boxOf(doc, "Words")!;
  const action0 = boxOf(doc, "Action");
  const room = g.h - g.top - g.bottom - (action0 ? action0.h + 32 : 0);
  const y =
    l.band === "top"
      ? g.top
      : l.band === "bottom"
        ? g.h - g.bottom - words0.h - (action0 ? action0.h + 32 : 0)
        : Math.round(g.top + (room - words0.h) / 2);
  place(doc, "Words", { y });
  if (action0) place(doc, "Action", { y: g.h - g.bottom - action0.h });
  const words = boxOf(doc, "Words")!;
  const shades: Shade[] = [];
  const shade = shadeFor(book, l, g, words);
  if (shade) {
    const top = shade.edge === "top" ? 0 : shade.zero;
    const h = shade.edge === "top" ? shade.zero : g.h - shade.zero;
    const id = doc.ids.get("Shade");
    if (id) doc.graph.updateNode(id, { y: top, height: h, fills: shadeFill(shade, h, top) as never });
    shades.push(shade);
  }
  const boxes: Record<string, Box> = { Words: words };
  for (const n of ["Headline", "Subline", "CTA", "Action"]) {
    const b = boxOf(doc, n);
    if (b) boxes[n] = b;
  }
  const checks: Check[] = [];
  const safe = { x: g.margin - 1, y: g.top - 1, w: g.w - 2 * g.margin + 2, h: g.h - g.top - g.bottom + 2 };
  for (const n of ["Words", "CTA"]) {
    const b = boxes[n];
    if (!b) continue;
    const inside = overlap(b, safe) > 0.999;
    checks.push({ check: "fits", node: n, ok: inside, hard: true, note: inside ? "Inside the safe area." : "Runs out of the safe area." });
  }
  if (boxes.Action && overlap(boxes.Action, words) > 0) {
    checks.push({ check: "fits", node: "CTA", ok: false, hard: true, note: "The call to action runs into the words." });
  }
  const tall = c.grid.h > c.grid.w * 1.5;
  for (const [n, style, most] of [
    ["Headline", l.headline, tall ? 3 : 2],
    ["Subline", "subline", tall ? 4 : 3],
  ] as const) {
    const s = styleOf(book, style) ?? styleOf(book, "body");
    if (!boxes[n] || !s) continue;
    const lines = Math.round(boxes[n].h / (s.sizePx * s.lineHeight));
    checks.push({
      check: "lines",
      node: n,
      ok: lines <= most,
      hard: true,
      value: lines,
      need: most,
      note: `${lines} line${lines === 1 ? "" : "s"} (at most ${most}).`,
    });
  }
  const onPhoto = l.ground !== "flat";
  for (const n of ["Headline", "Subline"]) {
    const b = boxes[n];
    if (!b) continue;
    const u = under(p, b, c.colours[n], shades, Math.max(16, c.sizes[n] * 0.5));
    const need = n === "Headline" ? 3 : 4.5;
    checks.push({
      check: "contrast",
      node: n,
      ok: u.contrast >= need,
      hard: true,
      value: u.contrast,
      need,
      note: `${u.contrast}:1 against nine in ten of the pixels under the words (needs ${need}:1).`,
    });
    if (onPhoto && (u.poor > 0.02 || u.worst < 2)) {
      checks.push({
        check: "contrast",
        node: n,
        ok: false,
        hard: true,
        value: u.worst,
        need: 2,
        note: `A bright or dark spot under the words: ${u.worst}:1 at the worst patch.`,
      });
    }
    if (onPhoto) {
      checks.push({
        check: "busy",
        node: n,
        ok: u.busy <= 0.12,
        hard: false,
        value: u.busy,
        need: 0.12,
        note: u.busy <= 0.12 ? "Calm under the words." : "The picture is busy under the words.",
      });
    }
  }
  for (const k of keep) {
    for (const n of ["Words", "CTA", "Action"]) {
      const b = boxes[n];
      if (!b) continue;
      const o = overlap(b, k);
      if (o > 0.01) {
        checks.push({ check: "covers", node: n, ok: false, hard: true, value: Math.round(o * 100) / 100, note: `Covers ${k.what}.` });
      }
    }
  }
  const ok = checks.every((x) => x.ok || !x.hard);
  return { layout: l, ok, score: scoreOf(l, checks), checks, boxes, shades };
}

function scoreOf(l: Layout, checks: Check[]): number {
  let s = 0;
  for (const c of checks) {
    if (!c.ok) s -= c.hard ? 10 : 2;
    if (c.check === "contrast" && c.value) s += Math.min(c.value, 7) / 7;
    if (c.check === "busy" && c.value !== undefined) s -= c.value * 10;
  }
  if (l.ground === "photo") s += 2;
  if (l.ground === "gradient") s += 1;
  return s;
}

/** The first passing layout in the model's order wins; among failing ones, the one that fails least. */
function better(a: Tried, b: Tried): boolean {
  if (a.ok !== b.ok) return a.ok;
  if (a.ok) return false;
  return a.score > b.score;
}

/** The picture as the layout crops it (filling the frame), at a small scale, as pixels. */
export async function pictureAt(picture: Uint8Array, format: Format, scale: number): Promise<Pixels> {
  const { w, h } = { w: gridSize(format).w, h: gridSize(format).h };
  const doc = await build(
    `<Frame name="Picture only" w={${w}} h={${h}} overflow="hidden" bg="#000000"><Rectangle name="Picture" position="absolute" x={0} y={0} w={${w}} h={${h}} fills={[{ type: "IMAGE", imageHash: "PHOTO", imageScaleMode: "FILL", color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]} /></Frame>`,
    picture,
  );
  return pixelsOf(await png(doc, scale), scale);
}

function gridSize(format: Format) {
  return { feed: { w: 1080, h: 1350 }, square: { w: 1080, h: 1080 }, story: { w: 1080, h: 1920 }, banner: { w: 1920, h: 1080 } }[format];
}

/** The family each of the book's styles is set in: the brand's own when Fume has it, else the book's fallback. */
async function familiesOf(book: DesignBook) {
  const fonts: { style: string; asked: string; used: string }[] = [];
  const chosen = new Map<string, string>();
  for (const s of book.styles) {
    const t = book.typefaces.find((x) => x.role === s.font) ?? book.typefaces[0];
    const asked = t?.family ?? "Inter";
    let used = "Inter";
    for (const f of [asked, t?.fallback, "Inter"]) {
      if (f && (await hasFont(f, s.weight))) {
        used = f;
        break;
      }
    }
    chosen.set(s.name, used);
    fonts.push({ style: s.name, asked, used });
  }
  return { familyFor: (s: Style) => chosen.get(s.name) ?? "Inter", fonts };
}

function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}
