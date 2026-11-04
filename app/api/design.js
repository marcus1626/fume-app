// Built by tools/build.mjs from api-src/design.ts and src/. Do not edit.

// src/handler.ts
import { createHash as createHash2 } from "node:crypto";

// src/book.ts
var SIZES = {
  feed: { w: 1080, h: 1350 },
  square: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
  banner: { w: 1920, h: 1080 }
};
function gridOf(book, format) {
  const size = SIZES[format];
  const f = book.formats.find((x) => x.format === format);
  const margin = clamp(f?.marginPx ?? 64, 32, size.w / 8);
  const platform = format === "story" ? { top: 250, bottom: 340 } : { top: 0, bottom: 0 };
  return {
    ...size,
    columns: f?.columns ?? 12,
    gutter: f?.gutterPx ?? 24,
    margin,
    top: Math.max(margin, f?.safeTopPx ?? 0, platform.top),
    bottom: Math.max(margin, f?.safeBottomPx ?? 0, platform.bottom)
  };
}
function columnsWidth(g, n) {
  const col = (g.w - 2 * g.margin - (g.columns - 1) * g.gutter) / g.columns;
  return Math.round(n * col + (n - 1) * g.gutter);
}
function colourOf(book, role) {
  const c = book.colours.find((x) => x.role === role);
  return c && /^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex.toUpperCase() : null;
}
function styleOf(book, name) {
  return book.styles.find((s) => s.name === name) ?? null;
}
function componentOf(book, name) {
  return book.components.find((c) => c.name === name) ?? null;
}
function headlineSteps(book, first) {
  const order = ["display", "h1", "h2", "subline"];
  const start2 = Math.max(0, order.indexOf(first));
  return order.slice(start2).map((n) => styleOf(book, n)).filter((s) => s !== null);
}
function radiusOf(book, name) {
  const r = book.radiusPx?.[name];
  return typeof r === "number" ? r : 0;
}
function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

// src/compose.ts
function compose(book, format, words, l, family, widths = {}) {
  const g = gridOf(book, format);
  const unit = book.spacing?.unitPx ?? 8;
  const hl = styleOf(book, l.headline) ?? styleOf(book, "h1") ?? book.styles[0];
  const sub = styleOf(book, l.subline ?? "subline") ?? styleOf(book, "subline") ?? styleOf(book, "body") ?? hl;
  const panel = componentOf(book, "body");
  const onPanel = l.ground === "flat";
  const wordsHex = onPanel ? colourOf(book, "text") ?? "#000000" : colourOf(book, l.colour) ?? "#FFFFFF";
  const subHex = onPanel ? colourOf(book, "text_muted") ?? wordsHex : wordsHex;
  const width = columnsWidth(g, Math.min(g.columns, Math.max(4, l.columns)));
  const x = l.align === "left" ? g.margin : l.align === "right" ? g.w - g.margin - width : Math.round((g.w - width) / 2);
  const textAlign = l.align;
  const items = l.align === "left" ? "start" : l.align === "right" ? "end" : "center";
  const fonts = [];
  const colours = { Headline: wordsHex };
  const sizes = { Headline: hl.sizePx };
  const text = (name, s, value, hex) => {
    const fam = family(s);
    fonts.push({ family: fam, weight: s.weight });
    const w = widths[name] ? `{${Math.round(widths[name])}}` : `"fill"`;
    return `<Text name=${q(name)} w=${w} font=${q(fam)} weight={${s.weight}} size={${s.sizePx}} lineHeight={${Math.round(
      s.sizePx * s.lineHeight
    )}} letterSpacing={${round(s.trackingEm * s.sizePx)}} color=${q(hex)}${caseOf(s)} textAlign=${q(textAlign)} text={${JSON.stringify(
      value
    )}} />`;
  };
  const cta = () => {
    const c = componentOf(book, "cta");
    const s = styleOf(book, c?.style ?? "cta") ?? sub;
    const fam = family(s);
    fonts.push({ family: fam, weight: s.weight });
    const bg = colourOf(book, c?.background ?? "cta") ?? colourOf(book, "primary") ?? "#000000";
    const fg = colourOf(book, c?.colour ?? "cta_text") ?? "#FFFFFF";
    colours.CTA = fg;
    sizes.CTA = s.sizePx;
    const pad2 = c?.paddingPx ?? 24;
    const line = Math.round(s.sizePx * s.lineHeight);
    const py = Math.max(Math.round(pad2 * 0.6), Math.ceil((56 - line) / 2));
    return `<Frame name="CTA" w="hug" h="hug" px={${Math.round(pad2 * 1.5)}} py={${py}} rounded={${radiusOf(
      book,
      c?.radius ?? "pill"
    )}} bg=${q(bg)}><Text name="CTA words" font=${q(fam)} weight={${s.weight}} size={${s.sizePx}} lineHeight={${line}} letterSpacing={${round(
      s.trackingEm * s.sizePx
    )}} color=${q(fg)}${caseOf(s)} text={${JSON.stringify(words.cta ?? "")}} /></Frame>`;
  };
  const inner = [text("Headline", hl, words.headline, wordsHex)];
  if (words.subline) {
    inner.push(text("Subline", sub, words.subline, subHex));
    colours.Subline = subHex;
    sizes.Subline = sub.sizePx;
  }
  const ctaWithWords = words.cta && (l.cta === "with_words" || l.cta === "bottom" && l.band === "bottom");
  const pad = onPanel ? panel?.paddingPx ?? 32 : 0;
  const panelBg = onPanel ? ` bg=${q(colourOf(book, panel?.background ?? "surface") ?? colourOf(book, "background") ?? "#FFFFFF")}` : "";
  const panelRadius = onPanel ? ` rounded={${radiusOf(book, panel?.radius ?? "none")}}` : "";
  const block = `<Frame name="Words" position="absolute" x={${x}} y={${g.top}} w={${width}} h="hug" flex="col" items=${q(
    items
  )} gap={${unit * 5}}${panelBg}${panelRadius} p={${pad}}><Frame name="Lines" w="fill" h="hug" flex="col" items=${q(items)} gap={${unit * 3}}>${inner.join("")}</Frame>${ctaWithWords ? cta() : ""}</Frame>`;
  const alone = words.cta && !ctaWithWords && l.cta !== "none" ? `<Frame name="Action" position="absolute" x={${l.align === "left" ? g.margin : 0}} y={${g.h - g.bottom - 80}} w={${l.align === "left" ? '"hug"' : l.align === "right" ? g.w - g.margin : g.w}} h="hug" flex="col" items=${q(items)}>${cta()}</Frame>` : "";
  const shade = l.ground === "gradient" ? `<Rectangle name="Shade" position="absolute" x={0} y={0} w={${g.w}} h={${Math.round(g.h / 2)}} fills={[]} />` : "";
  const jsx = `<Frame name=${q(`${format} ${g.w}x${g.h}`)} w={${g.w}} h={${g.h}} overflow="hidden" bg="#000000"><Rectangle name="Picture" position="absolute" x={0} y={0} w={${g.w}} h={${g.h}} fills={[{ type: "IMAGE", imageHash: "PHOTO", imageScaleMode: "FILL", color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]} />${shade}${block}${alone}</Frame>`;
  return { jsx, grid: g, fonts, colours, sizes };
}
function shadeFor(book, l, g, words) {
  if (l.ground !== "gradient") return null;
  const dark = colourOf(book, "text");
  const hex = dark && isDark(dark) ? dark : "#000000";
  const from = Math.min(0.75, Math.max(0.3, book.photoText?.scrimOpacity ?? 0.5));
  const fade = Math.max(160, Math.round(words.h * 0.8));
  if (l.band === "bottom") {
    return { hex, from, edge: "bottom", full: words.y - 24, zero: Math.max(0, words.y - 24 - fade) };
  }
  return { hex, from, edge: "top", full: words.y + words.h + 24, zero: Math.min(g.h, words.y + words.h + 24 + fade) };
}
function shadeFill(s, h, y) {
  const { r, g, b } = rgb01(s.hex);
  const at = (pos, a) => ({ position: clamp01(pos), color: { r, g, b, a } });
  const stops = s.edge === "top" ? [at(0, s.from), at((s.full - y) / h, s.from), at(1, 0)] : [at(0, 0), at((s.full - y) / h, s.from), at(1, s.from)];
  return [
    {
      type: "GRADIENT_LINEAR",
      color: { r, g, b, a: 1 },
      opacity: 1,
      visible: true,
      gradientStops: stops,
      gradientTransform: { m00: 0, m01: 1, m02: 0, m10: -1, m11: 0, m12: 1 }
    }
  ];
}
function isDark(hex) {
  const { r, g, b } = rgb01(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.2;
}
function rgb01(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16 & 255) / 255, g: (n >> 8 & 255) / 255, b: (n & 255) / 255 };
}
var clamp01 = (n) => Math.min(1, Math.max(0, Math.round(n * 1e3) / 1e3));
var round = (n) => Math.round(n * 100) / 100;
var q = (s) => JSON.stringify(s);
var caseOf = (s) => s.case === "upper" ? ` textCase="upper"` : s.case === "lower" ? ` textCase="lower"` : "";

// src/pixels.ts
function shadeAt(s, y) {
  if (s.edge === "top") {
    if (y <= s.full) return s.from;
    if (y >= s.zero) return 0;
    return s.from * (1 - (y - s.full) / (s.zero - s.full));
  }
  if (y >= s.full) return s.from;
  if (y <= s.zero) return 0;
  return s.from * ((y - s.zero) / (s.full - s.zero));
}
var lin = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
var LIN = Array.from({ length: 256 }, (_, i) => lin(i));
function rgbOf(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
}
function luminance(r, g, b) {
  return 0.2126 * LIN[r] + 0.7152 * LIN[g] + 0.0722 * LIN[b];
}
function contrast(l1, l2) {
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
function shaded(r, g, b, y, x, shades) {
  for (const s of shades) {
    let a = 0;
    if (s.box) {
      if (x >= s.box.x && x < s.box.x + s.box.w && y >= s.box.y && y < s.box.y + s.box.h) a = 1;
    } else {
      a = shadeAt(s, y);
    }
    if (a <= 0) continue;
    const [sr, sg, sb] = rgbOf(s.hex);
    r = Math.round(r * (1 - a) + sr * a);
    g = Math.round(g * (1 - a) + sg * a);
    b = Math.round(b * (1 - a) + sb * a);
  }
  return [r, g, b];
}
function under(p, box, textHex, shades = [], patch = 24) {
  const [tr, tg, tb] = rgbOf(textHex);
  const lt = luminance(tr, tg, tb);
  const x0 = Math.max(0, Math.floor(box.x * p.scale));
  const y0 = Math.max(0, Math.floor(box.y * p.scale));
  const x1 = Math.min(p.width, Math.ceil((box.x + box.w) * p.scale));
  const y1 = Math.min(p.height, Math.ceil((box.y + box.h) * p.scale));
  const ratios = [];
  let sum = 0;
  let sum2 = 0;
  const cell = Math.max(2, Math.round(patch * p.scale));
  const cols = Math.max(1, Math.ceil((x1 - x0) / cell));
  const cells = new Float64Array(cols * Math.max(1, Math.ceil((y1 - y0) / cell)) * 2);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * p.width + x) * 4;
      const [r, g, b] = shaded(p.data[i], p.data[i + 1], p.data[i + 2], y / p.scale, x / p.scale, shades);
      const l = luminance(r, g, b);
      sum += l;
      sum2 += l * l;
      ratios.push(contrast(lt, l));
      const c = Math.floor((y - y0) / cell) * cols + Math.floor((x - x0) / cell);
      cells[c * 2] += l;
      cells[c * 2 + 1] += 1;
    }
  }
  const n = ratios.length;
  if (n === 0) return { contrast: 21, meanContrast: 21, busy: 0, luminance: 0, poor: 0, worst: 21 };
  let worst = 21;
  for (let c = 0; c < cells.length; c += 2) {
    if (cells[c + 1] >= cell * cell / 2) worst = Math.min(worst, contrast(lt, cells[c] / cells[c + 1]));
  }
  ratios.sort((a, b) => a - b);
  const mean = sum / n;
  let poor = 0;
  while (poor < n && ratios[poor] < 2) poor++;
  return {
    contrast: round2(ratios[Math.floor(n * 0.1)]),
    meanContrast: round2(contrast(lt, mean)),
    busy: round2(Math.sqrt(Math.max(0, sum2 / n - mean * mean))),
    luminance: round2(mean),
    poor: round2(poor / n),
    worst: round2(worst)
  };
}
function overlap(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  return w * h / Math.max(1, a.w * a.h);
}
var round2 = (n) => Math.round(n * 100) / 100;

// src/render.ts
import { createHash } from "node:crypto";
import { SceneGraph } from "@open-pencil/scene-graph";
import { renderJSX } from "@open-pencil/core/design-jsx";
import { IORegistry, BUILTIN_IO_FORMATS, initCanvasKit } from "@open-pencil/core/io";
import { computeAllLayouts, installTextMeasurer } from "@open-pencil/core/layout";
import { SkiaRenderer } from "@open-pencil/core/canvas";
import { prepareGraphFonts, fontManager, weightToStyle } from "@open-pencil/core/text";
var engine = null;
var source = null;
function start(opts = {}) {
  source = opts.fonts ?? source;
  fontManager.setOnlineFontProviders({ google: opts.online ?? false, fontsource: false, bunny: false });
  fontManager.setHostFontLoader(async (family, style) => {
    if (!source) return null;
    const weight = weightOf(style);
    return source(family, weight, /italic/i.test(style));
  });
  engine ??= (async () => {
    const ck = await initCanvasKit();
    const renderer = new SkiaRenderer(ck, ck.MakeSurface(1, 1));
    await renderer.loadFonts();
    installTextMeasurer((node, maxWidth) => renderer.measureTextNode(node, maxWidth));
    return { ck, renderer, io: new IORegistry(BUILTIN_IO_FORMATS) };
  })();
  return engine;
}
var loaded = /* @__PURE__ */ new Map();
function hasFont(family, weight) {
  const key = `${family}|${weight}`;
  if (!loaded.has(key)) {
    loaded.set(
      key,
      fontManager.loadFont(family, weightToStyle(weight)).then((b) => b !== null && b.byteLength > 0).catch(() => false)
    );
  }
  return loaded.get(key);
}
function imageHash(bytes) {
  return createHash("sha1").update(bytes).digest("hex");
}
async function build(jsx, picture) {
  await start();
  const graph = new SceneGraph();
  const hash = imageHash(picture);
  graph.images.set(hash, picture);
  const results = await renderJSX(graph, jsx.replaceAll("PHOTO", hash));
  const root = results[0].id;
  graph.applyDerivedLayoutDuring?.(() => computeAllLayouts(graph));
  const fonts = await prepareGraphFonts(graph, [root]);
  graph.applyDerivedLayoutDuring?.(() => computeAllLayouts(graph));
  const ids = /* @__PURE__ */ new Map();
  const walk = (id) => {
    const n = graph.getNode(id);
    if (!n) return;
    if (n.name && !ids.has(n.name)) ids.set(n.name, id);
    for (const c of graph.getChildren(id)) walk(c.id);
  };
  walk(root);
  return {
    graph,
    root,
    ids,
    faithful: Boolean(fonts.faithful),
    fontIssues: (fonts.issues ?? []).map((f) => `${f.family} ${f.style}`),
    warnings: results.flatMap((r) => (r.warnings ?? []).map(String)).slice(0, 10)
  };
}
function boxOf(doc, name) {
  const id = doc.ids.get(name);
  if (!id) return null;
  const r = doc.graph.getAbsoluteBounds(id);
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}
function place(doc, name, changes) {
  const id = doc.ids.get(name);
  if (!id) return;
  doc.graph.updateNode(id, changes);
  doc.graph.applyDerivedLayoutDuring?.(() => computeAllLayouts(doc.graph));
}
async function png(doc, scale = 1) {
  const { io } = await start();
  const res = await io.exportContent(
    "png",
    { graph: doc.graph, target: { scope: "node", nodeId: doc.root } },
    { format: "PNG", scale }
  );
  return res.data;
}
async function fig(doc) {
  const { io } = await start();
  const res = await io.writeDocument("fig", doc.graph);
  return res.data;
}
async function pixelsOf(bytes, scale) {
  const { ck } = await start();
  const img = ck.MakeImageFromEncoded(bytes);
  if (!img) throw new Error("The picture could not be read.");
  const width = img.width();
  const height = img.height();
  const data = img.readPixels(0, 0, {
    width,
    height,
    colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Unpremul,
    colorSpace: ck.ColorSpace.SRGB
  });
  img.delete();
  return { data, width, height, scale };
}
function weightOf(style) {
  const s = style.toLowerCase();
  const table = [
    [/thin|hairline/, 100],
    [/extra ?light|ultra ?light/, 200],
    [/light/, 300],
    [/medium/, 500],
    [/semi ?bold|demi ?bold/, 600],
    [/extra ?bold|ultra ?bold/, 800],
    [/black|heavy/, 900],
    [/bold/, 700]
  ];
  for (const [re, w] of table) if (re.test(s)) return w;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 400;
}

// src/design.ts
var SCALE = 0.25;
async function design(ask) {
  const t0 = Date.now();
  const { book, format, words } = ask;
  const g = gridOf(book, format);
  const pixels = await pictureAt(ask.picture, format, SCALE);
  const { familyFor, fonts } = await familiesOf(book);
  const keep = ask.keepClear ?? [];
  let best = null;
  let tried = 0;
  const attempts = [];
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
    if (tried >= 320) break;
  }
  if (!best) throw new Error("No layout could be made.");
  const even = await balance(ask, best.t, familyFor, pixels, keep);
  if (even) best = even;
  const used = /* @__PURE__ */ new Set([best.t.layout.headline, best.t.layout.subline ?? "subline", componentOf(book, "cta")?.style ?? "cta"]);
  const seen = /* @__PURE__ */ new Set();
  const fontChecks = fonts.filter((f) => used.has(f.style) && f.asked !== f.used && !seen.has(f.asked) && seen.add(f.asked)).map((f) => ({
    check: "font",
    node: f.style,
    ok: false,
    hard: false,
    note: `${f.asked} is not on file; set in ${f.used} until the brand gives Fume its font.`
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
    ms: Date.now() - t0
  };
}
async function balance(ask, base, familyFor, pixels, keep) {
  const { book, format, words } = ask;
  const l = base.layout;
  const widths = {};
  const heightOf = async (w, name) => {
    const c2 = compose(book, format, words, l, familyFor, w);
    const doc2 = await build(c2.jsx, ask.picture);
    return boxOf(doc2, name)?.h ?? Infinity;
  };
  for (const name of ["Headline", "Subline"]) {
    const box = base.boxes[name];
    if (!box) continue;
    const full = box.w;
    const one = await heightOf({ ...widths, [name]: full * 4 }, name);
    if (box.h <= one + 1) continue;
    let lo = Math.round(full * 0.5);
    let hi = Math.round(full);
    while (hi - lo > 12) {
      const mid = Math.round((lo + hi) / 2);
      if (await heightOf({ ...widths, [name]: mid }, name) <= box.h + 1) hi = mid;
      else lo = mid;
    }
    if (hi < full - 12) widths[name] = Math.min(full, hi + 4);
  }
  if (!Object.keys(widths).length) return null;
  const c = compose(book, format, words, l, familyFor, widths);
  const doc = await build(c.jsx, ask.picture);
  const t = measure(doc, c, l, book, pixels, keep);
  return t.ok || !base.ok ? { t, doc } : null;
}
function* layoutsFor(book, format, prefer, hasCta) {
  const comp = componentOf(book, "headline");
  const first = prefer.headline && styleOf(book, prefer.headline) ? prefer.headline : comp?.style ?? "h1";
  const steps = headlineSteps(book, first).map((s) => s.name);
  const bands = uniq([prefer.band ?? "top", "top", "bottom", "middle"]);
  const aligns = uniq([prefer.align ?? "left", "left", "right", "center"]);
  const photoColour = prefer.colour && book.colours.some((c) => c.role === prefer.colour) ? prefer.colour : "on_photo";
  const colours = uniq([photoColour, "on_photo", comp?.colour ?? "text", "text"]).filter(
    (r) => book.colours.some((c) => c.role === r)
  );
  const scrim = book.photoText?.scrim ?? "gradient";
  const grounds = uniq([
    prefer.ground ?? "photo",
    "photo",
    ...scrim === "gradient" ? ["gradient"] : [],
    "flat"
  ]);
  const widths = prefer.columns ? [prefer.columns] : format === "banner" ? [6, 8] : [9, 7, 12];
  const cta = hasCta ? prefer.cta ?? "with_words" : "none";
  const sublines = uniq(["subline", "body"].filter((n) => styleOf(book, n)));
  if (!sublines.length) sublines.push("subline");
  for (const band of bands) {
    for (const ground of grounds) {
      if (ground === "gradient" && band === "middle") continue;
      for (const align of aligns) {
        for (const columns of widths) {
          for (const headline of steps.slice(0, 3)) {
            for (const subline of sublines) {
              for (const colour of ground === "flat" ? ["text"] : colours) {
                yield { band, align, headline, colour, ground, cta, columns, ...subline === "subline" ? {} : { subline } };
              }
            }
          }
        }
      }
    }
  }
}
function measure(doc, c, l, book, p, keep) {
  const g = c.grid;
  const words0 = boxOf(doc, "Words");
  const action0 = boxOf(doc, "Action");
  const room = g.h - g.top - g.bottom - (action0 ? action0.h + 32 : 0);
  const y = l.band === "top" ? g.top : l.band === "bottom" ? g.h - g.bottom - words0.h - (action0 ? action0.h + 32 : 0) : Math.round(g.top + (room - words0.h) / 2);
  place(doc, "Words", { y });
  if (action0) place(doc, "Action", { y: g.h - g.bottom - action0.h });
  const words = boxOf(doc, "Words");
  const shades = [];
  const shade = shadeFor(book, l, g, words);
  if (shade) {
    const top = shade.edge === "top" ? 0 : shade.zero;
    const h = shade.edge === "top" ? shade.zero : g.h - shade.zero;
    const id = doc.ids.get("Shade");
    if (id) doc.graph.updateNode(id, { y: top, height: h, fills: shadeFill(shade, h, top) });
    shades.push(shade);
  }
  const boxes = { Words: words };
  for (const n of ["Headline", "Subline", "CTA", "Action"]) {
    const b = boxOf(doc, n);
    if (b) boxes[n] = b;
  }
  const checks = [];
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
    ["Subline", "subline", tall ? 4 : 3]
  ]) {
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
      note: `${lines} line${lines === 1 ? "" : "s"} (at most ${most}).`
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
      note: `${u.contrast}:1 against nine in ten of the pixels under the words (needs ${need}:1).`
    });
    if (onPhoto && (u.poor > 0.02 || u.worst < 2)) {
      checks.push({
        check: "contrast",
        node: n,
        ok: false,
        hard: true,
        value: u.worst,
        need: 2,
        note: `A bright or dark spot under the words: ${u.worst}:1 at the worst patch.`
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
        note: u.busy <= 0.12 ? "Calm under the words." : "The picture is busy under the words."
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
function scoreOf(l, checks) {
  let s = 0;
  for (const c of checks) {
    if (!c.ok) s -= c.hard ? 10 : 2;
    if (c.check === "contrast" && c.value) s += Math.min(c.value, 7) / 7;
    if (c.check === "busy" && c.value !== void 0) s -= c.value * 10;
  }
  if (l.ground === "photo") s += 2;
  if (l.ground === "gradient") s += 1;
  return s;
}
function better(a, b) {
  if (a.ok !== b.ok) return a.ok;
  if (a.ok) return false;
  return a.score > b.score;
}
async function pictureAt(picture, format, scale) {
  const { w, h } = { w: gridSize(format).w, h: gridSize(format).h };
  const doc = await build(
    `<Frame name="Picture only" w={${w}} h={${h}} overflow="hidden" bg="#000000"><Rectangle name="Picture" position="absolute" x={0} y={0} w={${w}} h={${h}} fills={[{ type: "IMAGE", imageHash: "PHOTO", imageScaleMode: "FILL", color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]} /></Frame>`,
    picture
  );
  return pixelsOf(await png(doc, scale), scale);
}
function gridSize(format) {
  return { feed: { w: 1080, h: 1350 }, square: { w: 1080, h: 1080 }, story: { w: 1080, h: 1920 }, banner: { w: 1920, h: 1080 } }[format];
}
async function familiesOf(book) {
  const fonts = [];
  const chosen = /* @__PURE__ */ new Map();
  for (const s of book.styles) {
    const t = book.typefaces.find((x) => x.role === s.font) ?? book.typefaces[0];
    const asked = t?.family ?? "Inter";
    let used = "Inter";
    for (const f of [asked, t?.fallback, "Inter"]) {
      if (f && await hasFont(f, s.weight)) {
        used = f;
        break;
      }
    }
    chosen.set(s.name, used);
    fonts.push({ style: s.name, asked, used });
  }
  return { familyFor: (s) => chosen.get(s.name) ?? "Inter", fonts };
}
function uniq(xs) {
  return [...new Set(xs)];
}

// src/handler.ts
var json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
function signedLink(link, host, kind) {
  if (typeof link !== "string") return false;
  try {
    const u = new URL(link);
    const path = kind === "read" ? "/storage/v1/object/sign/" : "/storage/v1/object/upload/sign/";
    return u.protocol === "https:" && u.host === host && u.pathname.startsWith(path) && u.searchParams.has("token");
  } catch {
    return false;
  }
}
function invalid(r, host) {
  if (!signedLink(r.picture, host, "read")) return "The picture must be a signed link to Fume's storage.";
  if (!signedLink(r.upload?.png, host, "upload") || !signedLink(r.upload?.fig, host, "upload")) {
    return "The result needs signed upload links to Fume's storage.";
  }
  if (!r.format || !(r.format in SIZES)) return "Unknown format.";
  if (!r.book || !Array.isArray(r.book.styles) || !Array.isArray(r.book.colours) || !Array.isArray(r.book.typefaces)) {
    return "The brand's design system is missing.";
  }
  if (!r.words || typeof r.words.headline !== "string" || !r.words.headline.trim()) return "A layout needs a headline.";
  for (const w of [r.words.headline, r.words.subline, r.words.cta]) {
    if (w != null && (typeof w !== "string" || w.length > 400)) return "The words are too long.";
  }
  return null;
}
async function handle(req, deps) {
  if (req.method !== "POST") return json(405, { error: "POST only." });
  let r;
  try {
    r = await req.json();
  } catch {
    return json(400, { error: "The request is not JSON." });
  }
  const why = invalid(r, deps.storageHost);
  if (why) return json(400, { error: why });
  let picture;
  try {
    const got = await deps.fetch(r.picture, { signal: AbortSignal.timeout(45e3) });
    const type = got.headers.get("content-type") ?? "";
    if (!got.ok || !type.startsWith("image/")) return json(403, { error: "The picture link is not live." });
    picture = new Uint8Array(await got.arrayBuffer());
  } catch {
    return json(504, { error: "Reading the picture from storage took too long." });
  }
  if (picture.byteLength > 25e6) return json(413, { error: "The picture is too large." });
  const out = await (deps.design ?? design)({
    picture,
    format: r.format,
    book: r.book,
    words: r.words,
    prefer: r.prefer ?? {},
    keepClear: (r.keepClear ?? []).filter(isBox).slice(0, 8)
  });
  const put = async (link, bytes, contentType) => {
    const res = await deps.fetch(link, {
      method: "PUT",
      headers: { "content-type": contentType, "x-upsert": "false" },
      body: new Blob([bytes]),
      signal: AbortSignal.timeout(3e4)
    });
    if (!res.ok) throw new Error(`Storing the result failed (${res.status}).`);
    return { bytes: bytes.byteLength, sha256: createHash2("sha256").update(bytes).digest("hex") };
  };
  try {
    const [png2, fig2] = await Promise.all([
      put(r.upload.png, out.png, "image/png"),
      put(r.upload.fig, out.fig, "application/octet-stream")
    ]);
    const { png: _p, fig: _f, ...rest } = out;
    return json(200, { ...rest, png: png2, fig: fig2 });
  } catch (e) {
    return json(502, { error: e.message });
  }
}
function isBox(b) {
  const x = b;
  return Boolean(x) && [x.x, x.y, x.w, x.h].every((n) => typeof n === "number" && Number.isFinite(n)) && typeof x.what === "string";
}

// api-src/design.ts
start({ online: true });
async function POST(req) {
  return handle(req, { storageHost: process.env.FUME_STORAGE_HOST ?? "vkusmctftfzsrxbcxtdz.supabase.co", fetch });
}
async function GET() {
  return new Response(JSON.stringify({ service: "fume-design", ok: true }), { headers: { "content-type": "application/json" } });
}
export {
  GET,
  POST
};
