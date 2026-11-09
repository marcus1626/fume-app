// The graphic design layer: the plan's words laid on a picture from the brand's design system. The model only chooses
// by name (where the words go, which headline style, which colour role); code tries the layouts in that order, measures
// each one in the picture (contrast under every line of words, how busy it is, what it covers, whether it fits the
// safe area), and keeps the best that passes. What did not pass is said, for the expert.
import { type DesignBook, type Format, type Grid, type Style, brandLayouts, seesBrand, colourOf, componentOf, gridOf, headlineSteps, signatureOf, styleOf } from "./book.ts";
import { type Band, type Composed, type FamilyFor, type Ground, type Layout, type Words, compose, shadeFill, shadeFor } from "./compose.ts";
import { type Box, type Pixels, type Shade, contrast, luminance, overlap, rgbOf, under } from "./pixels.ts";
import { type BrandFace, type Doc, boxOf, build, fig, capHeightOf, hasFont, pixelsOf, place, png, lineWidth, splitWords, useBrandFaces, wordWidths } from "./render.ts";
import { type Logo, type Where, CORNERS, cornersFor, logoOf } from "./logo.ts";
import { inset } from "./room.ts";

export interface Ask {
  picture: Uint8Array;
  format: Format;
  book: DesignBook;
  words: Words;
  /** The model's choice, tried first. */
  prefer?: Partial<Layout>;
  /** What the words must never cover (the product, a face, a logo), in layout pixels. */
  keepClear?: (Box & { what: string })[];
  /** The brand's logo file (SVG, PNG, JPEG or WebP), when its design system names one. */
  logo?: Uint8Array;
  /** The brand's own font files its design system names (TrueType or OpenType). */
  fonts?: BrandFace[];
}

/** The logo on one layout: its size, and the brand's own corner for it when its creatives show one. */
export interface LogoPlan {
  logo: Logo;
  w: number;
  h: number;
  first: Where | null;
  /** In the words' own panel, over the headline, when the brand's corner is in the words' band. */
  inside?: boolean;
}

export interface Check {
  check: "fits" | "lines" | "contrast" | "busy" | "covers" | "font" | "logo";
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
  logo?: { where: Where; variant: string; contrast: number } | null;
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
  fonts: { style: string; asked: string; used: string; own?: boolean; standIn?: boolean }[];
  /** Where the logo sits and which version of it, or null when it is left off. */
  logo: { where: Where; variant: string; contrast: number } | null;
  ms: number;
}

const SCALE = 0.25;

/** Picture sizes tried, largest first, when the product fills a studio picture and the words have no room. */
const INSETS = [0.82, 0.72];

// The search stops in time for the function's own limit (60 s on the server): the best layout so far is kept.
const BUDGET_MS = { first: 22_000, all: 40_000 };

export async function design(asked: Ask): Promise<Designed> {
  const t0 = Date.now();
  const first = await designOn(asked, t0 + BUDGET_MS.first);
  if (first.ok) return first;
  // A packshot the product fills: set the picture smaller on its own backdrop, so the words get room.
  const g = gridOf(asked.book, asked.format);
  let best = first;
  let tried = first.tried;
  for (const scale of INSETS) {
    const room = await inset(asked.picture, g, scale).catch(() => null);
    if (!room) break;
    const keepClear = (asked.keepClear ?? []).map((k) => ({ ...room.move(k), what: k.what }));
    if (Date.now() > t0 + BUDGET_MS.all - 6_000) break;
    // The picture moves to the bottom right corner, so the room it leaves is at the top: those places are tried first.
    const next = await designOn({ ...asked, picture: room.picture, keepClear, prefer: { ...(asked.prefer ?? {}), band: "top" } }, t0 + BUDGET_MS.all);
    tried += next.tried;
    if (next.ok || hardFails(next) < hardFails(best)) {
      best = {
        ...next,
        checks: [
          ...next.checks,
          { check: "covers", node: "Picture", ok: true, hard: false, note: `The picture is set at ${Math.round(scale * 100)}% on its own backdrop, carried on to the edges, so the words have room.` },
        ],
      };
    }
    if (next.ok) break;
  }
  return { ...best, tried, ms: Date.now() - t0 };
}

function hardFails(d: Designed): number {
  return d.checks.filter((c) => !c.ok && c.hard).length;
}

async function designOn(asked: Ask, until = Infinity): Promise<Designed> {
  const t0 = Date.now();
  const { familyFor, fonts, book: set } = await familiesOf(asked.book, asked.fonts ?? []);
  const ask = { ...asked, book: set };
  const { book, format, words } = ask;
  const g = gridOf(book, format);
  const pixels = await pictureAt(ask.picture, format, SCALE);
  const keep = ask.keepClear ?? [];
  const logo = ask.logo
    ? await logoOf(ask.logo, colourOf(book, "on_photo") ?? "#FFFFFF", colourOf(book, "text") ?? "#000000").catch(() => null)
    : null;

  let best: { t: Tried; doc: Doc } | null = null;
  let tried = 0;
  let passed = 0;
  const taste = (t: Tried) => tasteOf(t, book, ask.prefer ?? {});
  const attempts: Designed["attempts"] = [];
  // Each place for the words, and each ground there, gets its share of the tries, so a place or a ground that cannot
  // work never uses them all up (Anthem, 9 Nov: the photo used every try and the brand's navy block got none).
  const perBand = new Map<string, number>();
  for (const l of layoutsFor(book, format, ask.prefer ?? {}, Boolean(words.cta))) {
    const share = `${l.band}|${l.ground}`;
    if ((perBand.get(share) ?? 0) >= 36) continue;
    if (best && Date.now() > until) break;
    perBand.set(share, (perBand.get(share) ?? 0) + 1);
    const plan = logo ? logoPlan(book, g, l, logo) : null;
    const c = compose(book, format, words, l, familyFor, {}, plan ?? undefined);
    const doc = await build(c.jsx, ask.picture, plan?.logo.variants);
    let t = measure(doc, c, l, book, pixels, keep, plan);
    let made = doc;
    tried++;
    // A word too long for the column: the headline or the button is sized down to fit it whole, once.
    const fit = fitFor(doc, c.sizes);
    if (fit) {
      const lf = { ...l, fit };
      const cf = compose(book, format, words, lf, familyFor, {}, plan ?? undefined);
      const df = await build(cf.jsx, ask.picture, plan?.logo.variants);
      const tf = measure(df, cf, lf, book, pixels, keep, plan);
      tried++;
      if (better(tf, t, taste) || (tf.ok === t.ok && !tf.ok && tf.score >= t.score)) {
        t = tf;
        made = df;
      }
    }
    if (attempts.length < 30) {
      attempts.push({ layout: l, failed: t.checks.filter((x) => !x.ok && x.hard).map((x) => `${x.node}: ${x.note}`) });
    }
    if (t.ok) passed++;
    if (!best || better(t, best.t, taste)) best = { t, doc: made };
    // Several layouts that pass are compared as a designer would (9 Nov, Marcus: the first that passed was not the
    // best); the search stops after a few, or when the time is up.
    if (best.t.ok && passed >= 4 && tried >= 6) break;
    if (tried >= 200) break;
  }
  if (!best) throw new Error("No layout could be made.");
  const even = await balance(ask, best.t, familyFor, pixels, keep, logo);
  if (even) best = even;
  const fitted = best.t.layout.fit;
  if (fitted) {
    for (const [node, k] of [["Headline", fitted.headline], ["CTA", fitted.cta]] as const) {
      if (k) best.t.checks.push({ check: "fits", node, ok: true, hard: false, note: `Set at ${Math.round(k * 100)}% of its style's size, so ${node === "CTA" ? "its words fit the button on one line" : "its longest word fits the column whole"}.` });
    }
  }
  const used = new Set([best.t.layout.headline, best.t.layout.subline ?? "subline", componentOf(book, "cta")?.style ?? "cta"]);
  const seen = new Set<string>();
  if (ask.logo && !logo) {
    best.t.checks.push({ check: "logo", node: "Logo", ok: false, hard: false, note: "The logo file could not be read; set it by hand." });
  }
  const fontChecks: Check[] = fonts
    .filter((f) => used.has(f.style) && f.asked !== f.used && !seen.has(f.asked) && seen.add(f.asked))
    .map((f) => ({
      check: "font",
      node: f.style,
      ok: false,
      hard: false,
      note: `${f.asked} is not on file; set in ${f.used} until the brand gives Fume its font.`,
    }));
  const standIns = [...new Set(fonts.filter((f) => f.standIn && f.asked === f.used && used.has(f.style)).map((f) => f.used))];
  if (standIns.length) {
    fontChecks.push({ check: "font", node: "Words", ok: false, hard: false, note: `Set in ${standIns.join(", ")}, the closest Google Font to the brand's own face, until the brand gives Fume its font file.` });
  }
  const ownFaces = [...new Set(fonts.filter((f) => f.own && used.has(f.style)).map((f) => f.asked))];
  if (ownFaces.length) {
    fontChecks.push({ check: "font", node: "Words", ok: true, hard: false, note: `Set in the brand's own font file: ${ownFaces.join(", ")}.` });
  }
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
    logo: best.t.logo ?? null,
    ms: Date.now() - t0,
  };
}

/**
 * Even lines, as a designer sets them: no lone word on the last line, no small word left hanging. For the headline and
 * the subline, the narrowest width that keeps the same number of lines is found, so each line carries a fair share.
 * The even version is kept only when it passes as well as the one it replaces.
 */
export async function balance(
  ask: Ask,
  base: Tried,
  familyFor: FamilyFor,
  pixels: Pixels,
  keep: (Box & { what: string })[],
  logo: Logo | null = null,
): Promise<{ t: Tried; doc: Doc } | null> {
  const { book, format, words } = ask;
  const l = base.layout;
  const plan = logo ? logoPlan(book, gridOf(book, format), l, logo) : null;
  const widths: Partial<Record<"Headline" | "Subline", number>> = {};
  let longest = 0;
  const heightOf = async (w: typeof widths, name: "Headline" | "Subline") => {
    const c = compose(book, format, words, l, familyFor, w);
    const doc = await build(c.jsx, ask.picture);
    longest = Math.max(0, ...wordWidths(doc, name).map((x) => x.width));
    return boxOf(doc, name)?.h ?? Infinity;
  };
  for (const name of ["Headline", "Subline"] as const) {
    const box = base.boxes[name];
    if (!box) continue;
    const full = box.w;
    const one = await heightOf({ ...widths, [name]: full * 4 }, name);
    if (box.h <= one + 1) continue; // one line already
    // Never narrower than its longest word: a word runs out of its box rather than onto a new line.
    let lo = Math.max(Math.round(full * 0.5), Math.ceil(longest) + 2);
    let hi = Math.round(full);
    while (hi - lo > 12) {
      const mid = Math.round((lo + hi) / 2);
      if ((await heightOf({ ...widths, [name]: mid }, name)) <= box.h + 1) hi = mid;
      else lo = mid;
    }
    if (hi < full - 12) widths[name] = Math.min(full, hi + 4);
  }
  if (!Object.keys(widths).length) return null;
  const c = compose(book, format, words, l, familyFor, widths, plan ?? undefined);
  const doc = await build(c.jsx, ask.picture, plan?.logo.variants);
  const t = measure(doc, c, l, book, pixels, keep, plan);
  return t.ok || !base.ok ? { t, doc } : null;
}

/** The layouts to try, the model's choice first, then the rest of what the book allows. */
export function* layoutsFor(book: DesignBook, format: Format, prefer: Partial<Layout>, hasCta: boolean): Generator<Layout> {
  const comp = componentOf(book, "headline");
  const first = prefer.headline && styleOf(book, prefer.headline) ? prefer.headline : (comp?.style ?? "h1");
  const steps = headlineSteps(book, first).map((s) => s.name);
  // The brand's own way of setting words on pictures comes before Fume's defaults; the picture's calm place, from the
  // model's eye, comes before both.
  const sig = signatureOf(book, prefer.signature, hasCta);
  const g = gridOf(book, format);
  const sigWidth = sig?.box?.w ? sig.box.w * 100 : sig?.wordsWidthPct;
  const sigColumns = sig && sigWidth ? Math.min(g.columns, Math.max(4, Math.round((sigWidth / 100) * g.columns))) : null;
  // The brand's own place down the frame for its words, in its own band (9 Nov: measured from its ads).
  const sigAt = sig?.box && sig.box.y > 0 ? sig.box.y : undefined;
  const sigGround: Ground | null = sig ? (sig.ground === "colour_block" ? "block" : sig.ground) : null;
  // The brand's own block of colour is a ground for words wherever the picture gives them no calm place, even when the
  // model chose another of its layouts (Anthem's navy block behind a short line).
  const blockSig = sigGround === "block"
    ? sig
    : brandLayouts(book).find((x) => x.ground === "colour_block" && /^#[0-9a-f]{6}$/i.test(x.groundHex ?? "")) ?? null;
  const sigColour = sig ? ({ light: "on_photo", dark: "text", brand_colour: "accent" } as const)[sig.words] : null;
  const ctaLook = sig && sig.cta !== "none" ? sig.cta : undefined;
  // A brand whose ads carry no call to action on the picture (Nike: it sits in the ad's own button) gets none.
  const noCta = sig?.cta === "none";
  const groundHex = sig?.groundHex && /^#[0-9a-f]{6}$/i.test(sig.groundHex) ? sig.groundHex : undefined;
  const ctaFill = sig?.ctaFill && sig.ctaFill !== "none" ? sig.ctaFill : undefined;
  const bands: Band[] = uniq([prefer.band ?? sig?.band ?? "top", sig?.band ?? "top", "top", "bottom", "middle"]) as Band[];
  const aligns = uniq([prefer.align ?? sig?.align ?? "left", sig?.align ?? "left", "left", "right", "center"]) as Layout["align"][];
  // The colour the brand's own layout sets its words in comes first (Dressmann's green stack), then the model's;
  // the contrast checks still turn it down where it cannot be read.
  const colours = uniq([...(sigColour ? [sigColour] : []), prefer.colour ?? "on_photo", "on_photo", comp?.colour ?? "text", "text"]).filter((r) =>
    book.colours.some((c) => c.role === r),
  );
  const scrim = book.photoText?.scrim ?? "gradient";
  const grounds: Ground[] = uniq([
    prefer.ground ?? sigGround ?? "photo",
    sigGround ?? "photo",
    "photo",
    ...(scrim === "gradient" ? ["gradient"] : []),
    ...(blockSig ? ["block"] : []),
    // A panel behind the words only where the brand sets one: a box is not a designer's answer to a busy picture
    // (Marcus, 9 Nov). Without one, a picture with no calm room is one to make again, not one to cover. The book's
    // own scrim is the writer's proposal; where Fume saw how the brand sets its words, that wins (Anthem: words
    // straight on the photo, yet the writer kept a navy panel for busy pictures).
    ...(brandLayouts(book).some((x) => x.ground === "flat") || (scrim === "flat" && !seesBrand(book)) ? ["flat"] : []),
  ]).filter((x) => x !== "block" || blockSig) as Ground[];
  const widths = prefer.columns
    ? [prefer.columns]
    : uniq([...(sigColumns ? [sigColumns] : []), ...(format === "banner" ? [6, 8] : [9, 7, 5, 12])]);
  // A brand that sets its button apart from the words, in a bottom corner (Anthem's SHOP NOW), gets it there.
  const ctaSide: Layout["align"] | undefined = sig?.ctaAt === "bottom_right" ? "right" : sig?.ctaAt === "bottom_left" ? "left" : undefined;
  const cta = hasCta && !noCta ? (prefer.cta === "none" ? "none" : ctaSide ? "bottom" : (prefer.cta ?? "with_words")) : "none";
  // A long line from the plan may step down to the book's body size before the words move.
  const sublines = uniq(["subline", "body"].filter((n) => styleOf(book, n)));
  if (!sublines.length) sublines.push("subline");
  // The model's place for the words first; there, the picture as it is, then a shade, then a panel; then the
  // other places. A big headline stacks in a narrower column before it steps down a size, as a designer sets it
  // beside the product (Anthem, 9 Nov: "teksten er litt lite"); the words move last.
  for (const band of bands) {
    for (const ground of grounds) {
      if (ground === "gradient" && band === "middle") continue;
      for (const align of aligns) {
        for (const headline of steps.slice(0, 3)) {
          for (const columns of widths) {
            for (const subline of sublines) {
              for (const colour of ground === "flat" ? ["text"] : ground === "block" ? ["on_primary"] : colours) {
                const own = ground === "block" && blockSig && blockSig !== sig ? blockSig : null;
                const hex = own ? own.groundHex : groundHex;
                yield {
                  band, align, headline, colour, ground, cta, columns,
                  ...(subline === "subline" ? {} : { subline }),
                  ...(ctaLook ? { ctaLook } : {}),
                  ...(ctaFill ? { ctaFill } : {}),
                  ...(ctaSide && cta === "bottom" ? { ctaSide } : {}),
                  ...(hex && (ground === "block" || ground === "flat") ? { groundHex: hex } : {}),
                  ...(own ? { signature: own.name } : sig ? { signature: sig.name } : {}),
                  ...(own
                    ? own.box && own.box.y > 0 && band === own.band ? { at: own.box.y } : {}
                    : sigAt !== undefined && band === sig?.band ? { at: sigAt } : {}),
                };
              }
            }
          }
        }
      }
    }
  }
}

/** Places the words, then measures the layout in the picture. */
export function measure(
  doc: Doc,
  c: Composed,
  l: Layout,
  book: DesignBook,
  p: Pixels,
  keep: (Box & { what: string })[],
  logo: LogoPlan | null = null,
): Tried {
  const g = c.grid;
  const words0 = boxOf(doc, "Words")!;
  const action0 = boxOf(doc, "Action");
  // A button set apart in the other corner (Anthem's SHOP NOW) shares the bottom with the words instead of sitting under them.
  const beside = Boolean(action0 && l.cta === "bottom" && l.ctaSide && l.ctaSide !== l.align);
  const below = action0 && !beside ? action0.h + 32 : 0;
  const room = g.h - g.top - g.bottom - below;
  // The brand's logo in the words' own band sits beside them as the brand sets it: the Swoosh below the quote,
  // Møllers' logo over the headline. The words make room for it.
  const shareBand = !logo?.inside && logo?.first?.startsWith(l.band === "middle" ? "-" : l.band) ? logo.h + 40 : 0;
  const low = l.band === "top" ? g.top + shareBand : g.top;
  const high = g.h - g.bottom - words0.h - below - (l.band === "bottom" ? shareBand : 0);
  const y = l.at !== undefined && high >= low
    ? Math.round(Math.min(high, Math.max(low, l.at * g.h)))
    : l.band === "top"
      ? g.top + shareBand
      : l.band === "bottom"
        ? g.h - g.bottom - words0.h - below - shareBand
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
  for (const n of ["Headline", "Price", "Was", "Subline", "CTA", "Action"]) {
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
  const ctaLine = lineWidth(doc, "CTA words");
  if (ctaLine && ctaLine.width > ctaLine.box + 2) {
    checks.push({ check: "fits", node: "CTA", ok: false, hard: true, note: "The button's words do not fit on one line." });
  }
  for (const n of ["Headline", "Price", "Was", "Subline", "CTA words"]) {
    const split = splitWords(doc, n);
    if (split.length)
      checks.push({ check: "fits", node: n === "CTA words" ? "CTA" : n, ok: false, hard: true, note: `Breaks inside a word: ${split.join(", ")}.` });
  }
  const tall = c.grid.h > c.grid.w * 1.5;
  // A portrait feed ad carries a three-line stack as well as a story does (Anthem, 9 Nov: big titles beside the hoop).
  for (const [n, style, most] of [
    ["Headline", l.headline, c.grid.h > c.grid.w ? 3 : 2],
    ["Price", "price", 1],
    ["Subline", "subline", tall ? 4 : 3],
  ] as const) {
    const s = n === "Price" && c.sizes.Price ? { sizePx: c.sizes.Price, lineHeight: styleOf(book, "price")?.lineHeight ?? 1 } : styleOf(book, style) ?? styleOf(book, "body");
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
  const onPhoto = l.ground === "photo" || l.ground === "gradient";
  for (const n of ["Headline", "Price", "Was", "Subline"]) {
    const b = boxes[n];
    if (!b) continue;
    // On a panel the words are read against the panel's own colour, not the picture under it.
    const u = !onPhoto && c.panel
      ? { contrast: contrastOf(c.colours[n], c.panel), poor: 0, worst: 21, busy: 0 }
      : under(p, b, c.colours[n], shades, Math.max(16, c.sizes[n] * 0.5));
    const need = n === "Subline" || n === "Was" ? 4.5 : 3;
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
  let placed: Tried["logo"] = null;
  if (logo?.inside && c.panel) {
    // In the panel: the version that reads best on the panel's own colour.
    const id = doc.ids.get("Logo");
    const { v, contrast: value } = preferDrawn(logo.logo, logo.logo.variants.map((x) => ({ v: x, contrast: contrastOf(x.hex, c.panel!) })));
    if (id) {
      doc.graph.updateNode(id, {
        fills: [{ type: "IMAGE", imageHash: v.hash, imageScaleMode: "FIT", color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }] as never,
      });
    }
    const box = boxOf(doc, "Logo");
    if (box) boxes.Logo = box;
    checks.push({
      check: "logo",
      node: "Logo",
      ok: value >= 3,
      hard: false,
      value,
      need: 3,
      note:
        value < 3
          ? `The logo is hard to see on the panel (${value}:1).`
          : `In the panel over the headline, ${v.name === "as_is" ? "as drawn" : `the ${v.name} version`}, ${value}:1.${
              v.name !== "as_is" && !logo.logo.mono ? " Made in one colour from the brand's logo; ask the brand for its reversed logo." : ""
            }`,
    });
    placed = { where: logo.first ?? "top_left", variant: v.name, contrast: value };
  } else if (logo) {
    const at = placeLogo(doc, g, logo, boxes, keep, p, shades, l);
    checks.push(at.check);
    if (at.box) boxes.Logo = at.box;
    placed = at.placed;
  }
  const ok = checks.every((x) => x.ok || !x.hard);
  return { layout: l, ok, score: scoreOf(l, checks), checks, boxes, shades, logo: placed };
}

/**
 * The logo's size and the brand's corner for it on this layout, or null when the brand's own layout carries none
 * (Nike never shrinks the Swoosh into a corner of an ad). Without a layout of the brand's, a calm corner is found.
 */
export function logoPlan(book: DesignBook, g: Grid, l: Layout, logo: Logo): LogoPlan | null {
  const sig = signatureOf(book, l.signature);
  if (sig && sig.logo === "none") return null;
  const first = sig && CORNERS.includes(sig.logo as Where) ? (sig.logo as Where) : null;
  const pct = sig?.logoWidthPct && sig.logoWidthPct > 0 ? Math.min(30, Math.max(4, sig.logoWidthPct)) : 12;
  let w = (g.w * pct) / 100;
  let h = (w * logo.height) / logo.width;
  const most = g.h * 0.08;
  if (h > most) {
    w = (w * most) / h;
    h = most;
  }
  const inside = Boolean(first?.startsWith(l.band)) && (l.ground === "flat" || l.ground === "block");
  return { logo, w: Math.round(w), h: Math.round(h), first, ...(inside ? { inside } : {}) };
}

/**
 * The logo as the brand drew it when it reads there; else the one-colour version that reads best. A logo in colours
 * is only set in one colour when its own colours cannot be read on that ground.
 */
function preferDrawn(logo: Logo, read: { v: Logo["variants"][number]; contrast: number }[]) {
  const drawn = read.find((r) => r.v.name === "as_is");
  if (drawn && (drawn.contrast >= 3 || (logo.mono && drawn.contrast >= 3))) return drawn;
  return [...read].sort((a, b) => b.contrast - a.contrast)[0];
}

function boxAt(where: Where, g: Grid, w: number, h: number): Box {
  const [v, side] = where.split("_") as ["top" | "bottom", "left" | "centre" | "right"];
  const x = side === "left" ? g.margin : side === "right" ? g.w - g.margin - w : Math.round((g.w - w) / 2);
  const y = v === "top" ? g.top : g.h - g.bottom - h;
  return { x, y, w, h };
}

/** The logo in the first corner that keeps clear of the words and reads, in the version that reads best there. */
function placeLogo(
  doc: Doc,
  g: Grid,
  plan: LogoPlan,
  boxes: Record<string, Box>,
  keep: (Box & { what: string })[],
  p: Pixels,
  shades: Shade[],
  l: Layout,
): { check: Check; box: Box | null; placed: Tried["logo"] } {
  const id = doc.ids.get("Logo");
  const avoid = [...["Words", "CTA", "Action"].map((n) => boxes[n]).filter(Boolean), ...keep];
  let best: { where: Where; box: Box; v: Logo["variants"][number]; contrast: number } | null = null;
  for (const where of cornersFor(plan.first, l.band, l.align)) {
    const box = boxAt(where, g, plan.w, plan.h);
    const pad = { x: box.x - 16, y: box.y - 16, w: box.w + 32, h: box.h + 32 };
    if (avoid.some((a) => overlap(pad, a) > 0)) continue;
    const read = plan.logo.variants.map((v) => ({ v, contrast: under(p, box, v.hex, shades, Math.max(8, Math.round(plan.h * 0.5))).contrast }));
    const pick = preferDrawn(plan.logo, read);
    if (!best || pick.contrast > best.contrast + 0.01) best = { where, box, v: pick.v, contrast: pick.contrast };
    if (best && best.where === where && best.contrast >= 3) break;
  }
  if (!id || !best || best.contrast < 3) {
    if (id) doc.graph.updateNode(id, { visible: false } as never);
    return {
      check: { check: "logo", node: "Logo", ok: false, hard: false, value: best?.contrast, need: 3, note: "No calm corner reads for the logo; it is left off for the designer to place." },
      box: null,
      placed: null,
    };
  }
  place(doc, "Logo", { x: best.box.x, y: best.box.y });
  doc.graph.updateNode(id, {
    fills: [{ type: "IMAGE", imageHash: best.v.hash, imageScaleMode: "FIT", color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }] as never,
  });
  const own = plan.first === best.where;
  return {
    check: {
      check: "logo",
      node: "Logo",
      ok: true,
      hard: false,
      value: best.contrast,
      need: 3,
      note: `${own ? "In the brand's own corner" : "In a calm corner"} (${best.where.replace("_", " ")}), ${best.v.name === "as_is" ? "as drawn" : `the ${best.v.name} version`}, ${best.contrast}:1.`,
    },
    box: best.box,
    placed: { where: best.where, variant: best.v.name, contrast: best.contrast },
  };
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

/** The smallest share of a style's size a long word may be set at to fit its column. */
const FIT_FLOOR = 0.6;
/** The smallest share of the price style's size the price may be set at to stay on one line. */
const PRICE_FLOOR = 0.35;

/**
 * How much smaller the headline and the button must be set so their longest word fits on a line, or null when
 * every word fits (or would need to be set smaller than the floor, which reads as a different style).
 */
export function fitFor(doc: Doc, sizes: Record<string, number> = {}): Layout["fit"] | null {
  const need = (name: string, floor = FIT_FLOOR) => {
    const ws = wordWidths(doc, name);
    const worst = Math.min(1, ...ws.map((w) => (w.box - 2) / w.width));
    return worst < 1 && worst >= floor ? Math.floor(worst * 100) / 100 : undefined;
  };
  // The headline stays clearly bigger than the line under it, or the order of reading is lost.
  const over = sizes.Headline && sizes.Subline ? (sizes.Subline * 1.25) / sizes.Headline : 0;
  const headline = need("Headline", Math.max(FIT_FLOOR, over));
  // A button's words stay on one line: the renderer draws them on one line even where the layout broke them, so the
  // button would be sized for two lines and its words would run out of it (Anthem, 9 Nov: "SHOP BASKETBALL HOOPS").
  let cta = need("CTA words");
  const ctaLine = lineWidth(doc, "CTA words");
  if (ctaLine && ctaLine.width > ctaLine.box + 2) {
    const frame = boxOf(doc, "CTA");
    const words = boxOf(doc, "Words");
    const pad = frame ? frame.w - ctaLine.box : 0;
    // Set at the left of the words' column, the button may grow to the column's width; elsewhere to its own box.
    const inside = frame && words && frame.x >= words.x - 1 && frame.x + frame.w <= words.x + words.w + 1;
    const room = inside ? words.w - pad - 2 * (frame.x - words.x) : ctaLine.box;
    const k = Math.min(1, (Math.max(room, ctaLine.box) - 2) / ctaLine.width);
    if (k < 1 && k >= FIT_FLOOR) cta = Math.min(cta ?? 1, Math.floor(k * 100) / 100);
  }
  // The price is one figure: the whole line fits its column, not only its longest word ("NÅ / 199,-" fails).
  const line = lineWidth(doc, "Price");
  const whole = line ? Math.min(1, (line.box - 2) / line.width) : 1;
  // A price set smaller is still the price; a price broken over two lines is a wrong price ("NÅ 1 / 99,-"), so it
  // may go down further than a headline before it gives up.
  const price = whole < 1 && whole >= PRICE_FLOOR ? Math.floor(whole * 100) / 100 : need("Price");
  return headline || cta || price ? { ...(headline ? { headline } : {}), ...(cta ? { cta } : {}), ...(price ? { price } : {}) } : null;
}

/** The first passing layout in the model's order wins; among failing ones, the one that fails least. */
function better(a: Tried, b: Tried, taste?: (t: Tried) => number): boolean {
  if (a.ok !== b.ok) return a.ok;
  if (a.ok) return taste ? taste(a) > taste(b) + 0.05 : false;
  return a.score > b.score;
}

/**
 * Which of the layouts that pass a designer would pick: the headline in as few lines as the brand's own ads set it,
 * and big; the brand's own place for the words; then the measured score (contrast, a calm ground). 9 Nov, Dressmann's
 * "HELG PÅ HYTTA": the layout that passed first broke it in two in a narrow column, where one wide line read better.
 */
export function tasteOf(t: Tried, book: DesignBook, prefer: Partial<Layout>): number {
  const sig = signatureOf(book, t.layout.signature ?? prefer.signature);
  const lines = t.checks.find((c) => c.check === "lines" && c.node === "Headline")?.value ?? 1;
  const want = Math.max(1, Math.min(3, Math.round(sig?.headlineLines ?? 2)));
  const head = t.boxes.Headline;
  // The headline's size, as its line's height against the frame's width.
  const size = head && lines > 0 ? head.h / lines / 1080 : 0;
  // A line more than the brand's own costs less than a headline half the size: two or three big lines beat one
  // small one (Anthem, 9 Nov), four do not.
  let s = t.score / 4;
  s -= Math.max(0, lines - want);
  s += Math.min(size, 0.2) * 50;
  if (t.layout.fit?.headline) s -= (1 - t.layout.fit.headline) * 4;
  // A button shrunk to fit a narrow column reads as small print (Anthem, 9 Nov): a wider column that keeps it whole wins.
  if (t.layout.fit?.cta) s -= (1 - t.layout.fit.cta) * 8;
  // The layout the model chose for this picture over another of the brand's, when both pass and read as big.
  if (prefer.signature && t.layout.signature && t.layout.signature !== prefer.signature) s -= 1;
  if (prefer.band && t.layout.band === prefer.band) s += 1;
  if (prefer.align && t.layout.align === prefer.align) s += 0.5;
  return Math.round(s * 100) / 100;
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

/** Family names compared as a designer would: case, spaces and hyphens do not count. */
const sameFamily = (a: string, b: string) => a.toLowerCase().replace(/[\s_-]+/g, "") === b.toLowerCase().replace(/[\s_-]+/g, "");

/** The family each of the book's styles is set in: the brand's own when Fume has it, else the book's fallback. */
async function familiesOf(book: DesignBook, files: BrandFace[] = []) {
  const fonts: { style: string; asked: string; used: string; own?: boolean; standIn?: boolean }[] = [];
  const chosen = new Map<string, string>();
  const styles: Style[] = [];
  const own = useBrandFaces(files);
  const ownFor = (family: string | undefined) =>
    family ? [...own].find(([f]) => sameFamily(f, family))?.[1] : undefined;
  for (const s of book.styles) {
    const t = book.typefaces.find((x) => x.role === s.font) ?? book.typefaces[0];
    const asked = t?.family ?? "Inter";
    const file = ownFor(asked);
    let used = "Inter";
    for (const f of [file, asked, t?.fallback, "Inter"]) {
      if (f && (await hasFont(f, s.weight))) {
        used = f;
        break;
      }
    }
    chosen.set(s.name, used);
    const isOwn = Boolean(file) && used === file;
    // The brand's own file is reported by the family it holds.
    fonts.push({ style: s.name, asked, used: isOwn ? asked : used, ...(isOwn ? { own: true } : t?.source === "stand_in" ? { standIn: true } : {}) });
    styles.push(!isOwn && (used !== asked || t?.source === "stand_in") && s.case === "upper" ? { ...s, lineHeight: standInLeading(s.lineHeight, await capHeightOf(used, s.weight)) } : s);
  }
  return { familyFor: (s: Style) => chosen.get(s.name) ?? "Inter", fonts, book: { ...book, styles } };
}

// The cap height the brands' condensed display faces share (Futura Condensed, Trade Gothic, Helvetica Condensed).
const BRAND_CAP = 0.72;
/**
 * Line height for capitals set in a stand-in face: the brand's read line height keeps the gap between lines its own
 * face leaves, so a taller stand-in (Anton's capitals are 0.86 of its size) does not set the lines touching.
 */
export function standInLeading(lineHeight: number, cap: number | null): number {
  if (!cap || cap <= BRAND_CAP) return lineHeight;
  return Math.round((lineHeight + cap - BRAND_CAP) * 100) / 100;
}

function contrastOf(a: string, b: string): number {
  return Math.round(contrast(luminance(...rgbOf(a)), luminance(...rgbOf(b))) * 100) / 100;
}

function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}
