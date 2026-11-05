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
function signatureOf(book, name, hasCta) {
  const all = (book.onPictures?.layouts ?? []).filter((l) => carriesWords(l));
  const named = all.find((l) => l.name === name);
  if (named) return named;
  const rank = (l) => l.source === "pictures" ? 0 : l.source === "site" ? 1 : 2;
  const best = [...all].sort((a, b) => rank(a) - rank(b));
  const first = best[0];
  const fits = hasCta && first ? best.find((l) => rank(l) === rank(first) && l.cta !== "none") : void 0;
  return fits ?? first ?? null;
}
function carriesWords(l) {
  return l.hasWords ?? !/\b(no|without) (words|text|copy)\b|\b(logo|swoosh|mark) alone\b/i.test(l.name);
}
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
function compose(book, format, words, l, family, widths = {}, logo) {
  const g = gridOf(book, format);
  const unit = book.spacing?.unitPx ?? 8;
  const hl = fitted(styleOf(book, l.headline) ?? styleOf(book, "h1") ?? book.styles[0], l.fit?.headline);
  const sub = styleOf(book, l.subline ?? "subline") ?? styleOf(book, "subline") ?? styleOf(book, "body") ?? hl;
  const panel = componentOf(book, "body");
  const isBlock = l.ground === "block";
  const onPanel = l.ground === "flat" || isBlock;
  const ownGround = onPanel && l.groundHex && /^#[0-9a-f]{6}$/i.test(l.groundHex) ? l.groundHex.toUpperCase() : null;
  const wordsHex = ownGround ? readableOn(ownGround, colourOf(book, "on_photo") ?? "#FFFFFF", colourOf(book, "text") ?? "#000000") : isBlock ? colourOf(book, "on_primary") ?? "#FFFFFF" : onPanel ? colourOf(book, "text") ?? "#000000" : colourOf(book, l.colour) ?? "#FFFFFF";
  const subHex = isBlock || ownGround ? wordsHex : onPanel ? colourOf(book, "text_muted") ?? wordsHex : wordsHex;
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
    const w = (name === "Headline" || name === "Subline") && widths[name] ? `{${Math.round(widths[name])}}` : `"fill"`;
    return `<Text name=${q(name)} w=${w} font=${q(fam)} weight={${s.weight}} size={${s.sizePx}} lineHeight={${Math.round(
      s.sizePx * s.lineHeight
    )}} letterSpacing={${round(s.trackingEm * s.sizePx)}} color=${q(hex)}${caseOf(s)} textAlign=${q(textAlign)} text={${JSON.stringify(
      bindShort(value)
    )}} />`;
  };
  const cta = () => {
    const c = componentOf(book, "cta");
    const s = fitted(styleOf(book, c?.style ?? "cta") ?? sub, l.fit?.cta);
    const fam = family(s);
    fonts.push({ family: fam, weight: s.weight });
    const look = l.ctaLook ?? "pill";
    const light = colourOf(book, "on_photo") ?? "#FFFFFF";
    const dark = colourOf(book, "text") ?? "#000000";
    const bg = l.ctaFill === "light" ? light : l.ctaFill === "dark" ? dark : colourOf(book, c?.background ?? "cta") ?? colourOf(book, "primary") ?? "#000000";
    const fg = l.ctaFill === "light" ? ownGround && !isLight(ownGround) ? ownGround : dark : l.ctaFill === "dark" ? light : colourOf(book, c?.colour ?? "cta_text") ?? "#FFFFFF";
    sizes.CTA = s.sizePx;
    const pad2 = c?.paddingPx ?? 24;
    const line = Math.round(s.sizePx * s.lineHeight);
    if (look === "underline" || look === "text") {
      colours.CTA = wordsHex;
      const rule = look === "underline" ? `<Rectangle name="Rule" w="fill" h={${Math.max(2, Math.round(s.sizePx / 14))}} bg=${q(wordsHex)} />` : "";
      return `<Frame name="CTA" w="hug" h="hug" flex="col" gap={${Math.round(s.sizePx / 4)}}><Text name="CTA words" font=${q(fam)} weight={${s.weight}} size={${s.sizePx}} lineHeight={${line}} letterSpacing={${round(
        s.trackingEm * s.sizePx
      )}} color=${q(wordsHex)}${caseOf(s)} text={${JSON.stringify(words.cta ?? "")}} />${rule}</Frame>`;
    }
    colours.CTA = fg;
    const py = Math.max(Math.round(pad2 * 0.6), Math.ceil((56 - line) / 2));
    return `<Frame name="CTA" w="hug" h="hug" px={${Math.round(pad2 * 1.5)}} py={${py}} rounded={${radiusOf(
      book,
      look === "box" ? "small" : c?.radius ?? "pill"
    )}} bg=${q(bg)}><Text name="CTA words" font=${q(fam)} weight={${s.weight}} size={${s.sizePx}} lineHeight={${line}} letterSpacing={${round(
      s.trackingEm * s.sizePx
    )}} color=${q(fg)}${caseOf(s)} text={${JSON.stringify(words.cta ?? "")}} /></Frame>`;
  };
  const inner = [text("Headline", hl, words.headline, wordsHex)];
  if (words.price) {
    const { now, was } = splitPrice(words.price);
    const ps = fitted(styleOf(book, "price") ?? { ...hl, name: "price", sizePx: Math.round(hl.sizePx * 1.6), case: "none" }, l.fit?.price);
    inner.push(text("Price", ps, now, wordsHex));
    colours.Price = wordsHex;
    sizes.Price = ps.sizePx;
    if (was) {
      const ws = styleOf(book, "label") ?? sub;
      inner.push(text("Was", ws, was, wordsHex));
      colours.Was = wordsHex;
      sizes.Was = ws.sizePx;
    }
  }
  if (words.subline) {
    inner.push(text("Subline", sub, words.subline, subHex));
    colours.Subline = subHex;
    sizes.Subline = sub.sizePx;
  }
  const ctaWithWords = words.cta && (l.cta === "with_words" || l.cta === "bottom" && l.band === "bottom");
  const pad = onPanel ? panel?.paddingPx ?? 32 : 0;
  const panelHex = ownGround ? ownGround : isBlock ? colourOf(book, "primary") ?? "#000000" : colourOf(book, panel?.background ?? "surface") ?? colourOf(book, "background") ?? "#FFFFFF";
  const panelBg = onPanel ? ` bg=${q(panelHex)}` : "";
  const insideLogo = logo?.inside ? `<Rectangle name="Logo" w={${Math.round(logo.w)}} h={${Math.round(logo.h)}} fills={[{ type: "IMAGE", imageHash: "LOGO", imageScaleMode: "FIT", color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]} />` : "";
  const panelRadius = onPanel ? ` rounded={${radiusOf(book, panel?.radius ?? "none")}}` : "";
  const block = `<Frame name="Words" position="absolute" x={${x}} y={${g.top}} w={${width}} h="hug" flex="col" items=${q(
    items
  )} gap={${unit * 5}}${panelBg}${panelRadius} p={${pad}}><Frame name="Lines" w="fill" h="hug" flex="col" items=${q(items)} gap={${unit * 3}}>${inner.join("")}</Frame>${ctaWithWords ? cta() : ""}</Frame>`.replace(
    '<Frame name="Lines"',
    `${insideLogo}<Frame name="Lines"`
  );
  const alone = words.cta && !ctaWithWords && l.cta !== "none" ? `<Frame name="Action" position="absolute" x={${l.align === "left" ? g.margin : 0}} y={${g.h - g.bottom - 80}} w={${l.align === "left" ? '"hug"' : l.align === "right" ? g.w - g.margin : g.w}} h="hug" flex="col" items=${q(items)}>${cta()}</Frame>` : "";
  const shade = l.ground === "gradient" ? `<Rectangle name="Shade" position="absolute" x={0} y={0} w={${g.w}} h={${Math.round(g.h / 2)}} fills={[]} />` : "";
  const logoNode = logo && !logo.inside ? `<Rectangle name="Logo" position="absolute" x={${g.margin}} y={${g.top}} w={${Math.round(logo.w)}} h={${Math.round(
    logo.h
  )}} fills={[{ type: "IMAGE", imageHash: "LOGO", imageScaleMode: "FIT", color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]} />` : "";
  const jsx = `<Frame name=${q(`${format} ${g.w}x${g.h}`)} w={${g.w}} h={${g.h}} overflow="hidden" bg="#000000"><Rectangle name="Picture" position="absolute" x={0} y={0} w={${g.w}} h={${g.h}} fills={[{ type: "IMAGE", imageHash: "PHOTO", imageScaleMode: "FILL", color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]} />${shade}${block}${alone}${logoNode}</Frame>`;
  return { jsx, grid: g, fonts, colours, sizes, ...onPanel ? { panel: panelHex } : {} };
}
function splitPrice(line) {
  const m = line.match(/^(.*?)\s+((?:tidligere|før|ord(?:inær|\.)?\s*pris|was|before)\b.*)$/i);
  return m && m[1].trim() ? { now: m[1].trim(), was: m[2].trim() } : { now: line.trim(), was: null };
}
function fitted(s, k) {
  return k && k < 1 ? { ...s, sizePx: Math.round(s.sizePx * k) } : s;
}
function bindShort(text) {
  return text.replace(new RegExp("(?<=^|\\s)(\\p{L}{1,2}) (?=\\S)", "gu"), "$1\xA0");
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
function isLight(hex) {
  const { r, g, b } = rgb01(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5;
}
function readableOn(ground, light, dark) {
  const lum = (h) => {
    const { r, g, b } = rgb01(h);
    const lin2 = (c) => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    return 0.2126 * lin2(r) + 0.7152 * lin2(g) + 0.0722 * lin2(b);
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  return ratio(light, ground) >= ratio(dark, ground) ? light : dark;
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
    const weight = weightOf(style);
    const italic = /italic/i.test(style);
    const own = brandFaces.get(family);
    if (own) return nearestFace(own, weight, italic);
    if (!source) return null;
    return source(family, weight, italic);
  });
  engine ??= (async () => {
    const ck = await initCanvasKit();
    const renderer = new SkiaRenderer(ck, ck.MakeSurface(1, 1));
    await renderer.loadFonts();
    measurer = renderer;
    installTextMeasurer((node, maxWidth) => renderer.measureTextNode(node, maxWidth));
    return { ck, renderer, io: new IORegistry(BUILTIN_IO_FORMATS) };
  })();
  return engine;
}
var measurer = null;
var brandFaces = /* @__PURE__ */ new Map();
function nearestFace(faces, weight, italic) {
  const best = [...faces].sort((a, b) => Number(a.italic !== italic) - Number(b.italic !== italic) || Math.abs(a.weight - weight) - Math.abs(b.weight - weight))[0];
  return best.bytes.slice().buffer;
}
function useBrandFaces(faces) {
  const names = /* @__PURE__ */ new Map();
  const byFamily = /* @__PURE__ */ new Map();
  for (const f of faces) byFamily.set(f.family, [...byFamily.get(f.family) ?? [], f]);
  for (const [family, list] of byFamily) {
    const h = createHash("sha1");
    for (const f of list) h.update(f.bytes);
    const name = `${family} ${h.digest("hex").slice(0, 8)}`;
    brandFaces.set(name, list);
    names.set(family, name);
  }
  return names;
}
function wordWidths(doc, name) {
  const id = doc.ids.get(name);
  const node = id ? doc.graph.getNode(id) : null;
  if (!measurer || !node || node.type !== "TEXT" || !node.text || !node.width) return [];
  const out = [];
  for (const word of new Set(node.text.split(/\s+/).filter(Boolean))) {
    const m = measurer.measureTextNode({ ...node, id: `${node.id}:word:${word}`, text: word }, 1e6);
    if (m) out.push({ word, width: m.width, box: node.width });
  }
  return out;
}
function lineWidth(doc, name) {
  const id = doc.ids.get(name);
  const node = id ? doc.graph.getNode(id) : null;
  if (!measurer || !node || node.type !== "TEXT" || !node.text || !node.width) return null;
  const m = measurer.measureTextNode({ ...node, id: `${node.id}:line`, text: node.text.replace(/\s+/g, " ").trim() }, 1e6);
  return m ? { width: m.width, box: node.width } : null;
}
function splitWords(doc, name) {
  return wordWidths(doc, name).filter((w) => w.width > w.box + 1).map((w) => w.word);
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
async function capHeightOf(family, weight) {
  const file = source ? await source(family, weight, false).catch(() => null) : null;
  return file ? capOf(new DataView(file)) : null;
}
function capOf(v) {
  try {
    const n = v.getUint16(4);
    let os2 = -1;
    let head = -1;
    for (let i = 0; i < n; i++) {
      const r = 12 + i * 16;
      const tag = String.fromCharCode(v.getUint8(r), v.getUint8(r + 1), v.getUint8(r + 2), v.getUint8(r + 3));
      if (tag === "OS/2") os2 = v.getUint32(r + 8);
      if (tag === "head") head = v.getUint32(r + 8);
    }
    if (os2 < 0 || head < 0 || v.getUint16(os2) < 2) return null;
    const upm = v.getUint16(head + 18);
    const cap = v.getInt16(os2 + 88);
    return upm > 0 && cap > 0 ? cap / upm : null;
  } catch {
    return null;
  }
}
function imageHash(bytes) {
  return createHash("sha1").update(bytes).digest("hex");
}
async function build(jsx, picture, logo) {
  await start();
  const graph = new SceneGraph();
  const hash = imageHash(picture);
  graph.images.set(hash, picture);
  for (const v of logo ?? []) graph.images.set(v.hash, v.png);
  const results = await renderJSX(graph, jsx.replaceAll("PHOTO", hash).replaceAll('"LOGO"', JSON.stringify(logo?.[0]?.hash ?? hash)));
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

// src/logo.ts
import { SceneGraph as SceneGraph2 } from "@open-pencil/scene-graph";
import { renderJSX as renderJSX2 } from "@open-pencil/core/design-jsx";
import { createSVGNodes } from "@open-pencil/core/io";
var CORNERS = ["top_left", "top_right", "bottom_left", "bottom_right", "top_centre", "bottom_centre"];
var MAX = 1200;
async function logoOf(bytes, light, dark) {
  const { ck } = await start();
  const raster = isSvg(bytes) ? await rasterise(new TextDecoder().decode(bytes)) : bytes;
  if (!raster) return null;
  const img = ck.MakeImageFromEncoded(raster);
  if (!img) return null;
  const width = img.width();
  const height = img.height();
  const info = { width, height, colorType: ck.ColorType.RGBA_8888, alphaType: ck.AlphaType.Unpremul, colorSpace: ck.ColorSpace.SRGB };
  const data = img.readPixels(0, 0, info);
  img.delete();
  if (!data || width < 8 || height < 8) return null;
  const t = tone(data);
  if (!t) return null;
  const encode2 = (px) => {
    const im = ck.MakeImage(info, px, width * 4);
    const out = im?.encodeToBytes() ?? null;
    im?.delete();
    return out;
  };
  const asIs = encode2(data) ?? raster;
  const variants = [{ name: "as_is", png: asIs, hash: imageHash(asIs), hex: t.hex }];
  for (const [name, hex] of [["light", light], ["dark", dark]]) {
    const png2 = encode2(t.mono ? tint(data, hex) : reversed(data, hex));
    if (png2) variants.push({ name, png: png2, hash: imageHash(png2), hex });
  }
  return { width, height, mono: t.mono, variants };
}
function isSvg(bytes) {
  const head = new TextDecoder().decode(bytes.subarray(0, 512)).trimStart().toLowerCase();
  return head.startsWith("<svg") || head.startsWith("<?xml") && head.includes("<svg");
}
async function rasterise(svg) {
  if (svg.length > 4e5) return null;
  const graph = new SceneGraph2();
  const [root] = await renderJSX2(graph, `<Frame name="Logo" w={10} h={10} />`);
  const node = createSVGNodes(graph, root.id, svg, { name: "Logo", x: 0, y: 0 });
  if (!node || !node.width || !node.height) return null;
  graph.updateNode(node.id, { fills: [] });
  const scale = Math.min(8, MAX / Math.max(node.width, node.height));
  return png({ graph, root: node.id, ids: /* @__PURE__ */ new Map(), faithful: true, fontIssues: [], warnings: [] }, scale);
}
function tone(px) {
  let n = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  const lums = [];
  for (let i = 0; i < px.length; i += 16) {
    if (px[i + 3] < 160) continue;
    n++;
    r += px[i];
    g += px[i + 1];
    b += px[i + 2];
    lums.push(luminance(px[i], px[i + 1], px[i + 2]));
  }
  if (n < 20) return null;
  const mean = lums.reduce((a, x) => a + x, 0) / n;
  const spread = Math.sqrt(lums.reduce((a, x) => a + (x - mean) ** 2, 0) / n);
  const hex = `#${[r, g, b].map((c) => Math.round(c / n).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
  const covered = n / (px.length / 16);
  return { hex, mono: spread < 0.06 && covered < 0.9 };
}
function tint(px, hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  const out = new Uint8Array(px.length);
  for (let i = 0; i < px.length; i += 4) {
    out[i] = n >> 16 & 255;
    out[i + 1] = n >> 8 & 255;
    out[i + 2] = n & 255;
    out[i + 3] = px[i + 3];
  }
  return out;
}
function reversed(px, hex) {
  let lo = 1;
  let hi = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 160) continue;
    const l = luminance(px[i], px[i + 1], px[i + 2]);
    if (l < lo) lo = l;
    if (l > hi) hi = l;
  }
  const out = tint(px, hex);
  if (hi - lo < 0.15) return out;
  for (let i = 0; i < px.length; i += 4) {
    const t = Math.min(1, Math.max(0, (hi - luminance(px[i], px[i + 1], px[i + 2])) / (hi - lo)));
    const k = t < 0.25 ? 0 : t > 0.55 ? 1 : (t - 0.25) / 0.3;
    out[i + 3] = Math.round(px[i + 3] * k);
  }
  return out;
}
function cornersFor(first, band, align) {
  const side = align === "center" ? "centre" : align;
  const away = band === "top" ? "bottom" : "top";
  const near = band === "top" ? "top" : "bottom";
  const order = [
    ...first ? [first] : [],
    `${away}_${side}`,
    `${away}_left`,
    `${away}_right`,
    ...align !== "left" ? [`${near}_left`] : [],
    ...align !== "right" ? [`${near}_right`] : [],
    `${away}_centre`
  ];
  return [...new Set(order)];
}

// src/room.ts
function plainEdges(data, width, height) {
  const lumAt = (x, y) => {
    const i = (y * width + x) * 4;
    return (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
  };
  const steps = [];
  const walk = (n, at) => {
    let prev = at(0);
    for (let k = 3; k < n; k += 3) {
      const l = at(k);
      steps.push(Math.abs(l - prev));
      prev = l;
    }
  };
  for (const d of [0, 2]) {
    walk(width, (x) => lumAt(x, d));
    walk(height, (y) => lumAt(d, y));
  }
  const mean = steps.reduce((a, x) => a + x, 0) / steps.length;
  const worst = [...steps].sort((a, b) => a - b)[Math.floor(steps.length * 0.99)] ?? 0;
  return mean < 0.015 && worst < 0.04;
}
async function inset(picture, frame, scale) {
  const { ck } = await start();
  const img = ck.MakeImageFromEncoded(picture);
  if (!img) return null;
  const iw = img.width();
  const ih = img.height();
  const data = img.readPixels(0, 0, {
    width: iw,
    height: ih,
    colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Unpremul,
    colorSpace: ck.ColorSpace.SRGB
  });
  if (!data || !plainEdges(data, iw, ih)) {
    img.delete();
    return null;
  }
  const fit = Math.max(frame.w / iw, frame.h / ih);
  const sw = frame.w / fit;
  const sh = frame.h / fit;
  const sx = (iw - sw) / 2;
  const sy = (ih - sh) / 2;
  const w = Math.round(frame.w * scale);
  const h = Math.round(frame.h * scale);
  const ox = frame.w - w;
  const oy = frame.h - h;
  const surface = ck.MakeSurface(frame.w, frame.h);
  if (!surface) {
    img.delete();
    return null;
  }
  const canvas = surface.getCanvas();
  const paint = new ck.Paint();
  const softSurface = ck.MakeSurface(iw, ih);
  if (!softSurface) {
    paint.delete();
    surface.delete();
    img.delete();
    return null;
  }
  const soft = new ck.Paint();
  soft.setImageFilter(ck.ImageFilter.MakeBlur(12, 12, ck.TileMode.Clamp, null));
  softSurface.getCanvas().drawImage(img, 0, 0, soft);
  const blurred = softSurface.makeImageSnapshot();
  const ground = ck.MakeSurface(frame.w, frame.h);
  if (!ground) {
    paint.delete();
    soft.delete();
    blurred.delete();
    softSurface.delete();
    surface.delete();
    img.delete();
    return null;
  }
  const gc = ground.getCanvas();
  const drawOn = (to, from, src, dst) => to.drawImageRectOptions(from, ck.XYWHRect(src[0], src[1], src[2], src[3]), ck.XYWHRect(dst[0], dst[1], dst[2], dst[3]), ck.FilterMode.Linear, ck.MipmapMode.None, paint);
  const e = 6;
  drawOn(gc, blurred, [sx + e, sy + e, 2, 2], [0, 0, ox + 1, oy + 1]);
  drawOn(gc, blurred, [sx, sy + e, sw, 2], [ox, 0, w, oy + 1]);
  drawOn(gc, blurred, [sx + e, sy, 2, sh], [0, oy, ox + 1, h]);
  drawOn(gc, blurred, [sx, sy, sw, sh], [ox, oy, w, h]);
  const groundImg = ground.makeImageSnapshot();
  const wide = new ck.Paint();
  wide.setImageFilter(ck.ImageFilter.MakeBlur(Math.round(frame.w / 24), Math.round(frame.w / 24), ck.TileMode.Clamp, null));
  canvas.drawImage(groundImg, 0, 0, wide);
  const f = Math.round(frame.w / 14);
  canvas.saveLayer();
  drawOn(canvas, img, [sx, sy, sw, sh], [ox, oy, w, h]);
  const fade = new ck.Paint();
  fade.setBlendMode(ck.BlendMode.DstIn);
  const clear = ck.Color(0, 0, 0, 0);
  const solid = ck.Color(0, 0, 0, 1);
  fade.setShader(ck.Shader.MakeLinearGradient([ox, 0], [ox + f, 0], [clear, solid], null, ck.TileMode.Clamp));
  canvas.drawRect(ck.XYWHRect(ox, oy, f, h), fade);
  fade.setShader(ck.Shader.MakeLinearGradient([0, oy], [0, oy + f], [clear, solid], null, ck.TileMode.Clamp));
  canvas.drawRect(ck.XYWHRect(ox + f, oy, w - f, f), fade);
  canvas.restore();
  fade.delete();
  wide.delete();
  groundImg.delete();
  ground.delete();
  const snap = surface.makeImageSnapshot();
  const bytes = snap.encodeToBytes();
  snap.delete();
  paint.delete();
  soft.delete();
  blurred.delete();
  softSurface.delete();
  surface.delete();
  img.delete();
  if (!bytes) return null;
  return {
    picture: bytes,
    move: (b) => ({ x: Math.round(ox + b.x * scale), y: Math.round(oy + b.y * scale), w: Math.round(b.w * scale), h: Math.round(b.h * scale) })
  };
}

// src/design.ts
var SCALE = 0.25;
var INSETS = [0.82, 0.72];
var BUDGET_MS = { first: 22e3, all: 4e4 };
async function design(asked) {
  const t0 = Date.now();
  const first = await designOn(asked, t0 + BUDGET_MS.first);
  if (first.ok) return first;
  const g = gridOf(asked.book, asked.format);
  let best = first;
  let tried = first.tried;
  for (const scale of INSETS) {
    const room = await inset(asked.picture, g, scale).catch(() => null);
    if (!room) break;
    const keepClear = (asked.keepClear ?? []).map((k) => ({ ...room.move(k), what: k.what }));
    if (Date.now() > t0 + BUDGET_MS.all - 6e3) break;
    const next = await designOn({ ...asked, picture: room.picture, keepClear, prefer: { ...asked.prefer ?? {}, band: "top" } }, t0 + BUDGET_MS.all);
    tried += next.tried;
    if (next.ok || hardFails(next) < hardFails(best)) {
      best = {
        ...next,
        checks: [
          ...next.checks,
          { check: "covers", node: "Picture", ok: true, hard: false, note: `The picture is set at ${Math.round(scale * 100)}% on its own backdrop, carried on to the edges, so the words have room.` }
        ]
      };
    }
    if (next.ok) break;
  }
  return { ...best, tried, ms: Date.now() - t0 };
}
function hardFails(d) {
  return d.checks.filter((c) => !c.ok && c.hard).length;
}
async function designOn(asked, until = Infinity) {
  const t0 = Date.now();
  const { familyFor, fonts, book: set } = await familiesOf(asked.book, asked.fonts ?? []);
  const ask = { ...asked, book: set };
  const { book, format, words } = ask;
  const g = gridOf(book, format);
  const pixels = await pictureAt(ask.picture, format, SCALE);
  const keep = ask.keepClear ?? [];
  const logo = ask.logo ? await logoOf(ask.logo, colourOf(book, "on_photo") ?? "#FFFFFF", colourOf(book, "text") ?? "#000000").catch(() => null) : null;
  let best = null;
  let tried = 0;
  const attempts = [];
  const perBand = /* @__PURE__ */ new Map();
  for (const l of layoutsFor(book, format, ask.prefer ?? {}, Boolean(words.cta))) {
    if ((perBand.get(l.band) ?? 0) >= 70) continue;
    if (best && Date.now() > until) break;
    perBand.set(l.band, (perBand.get(l.band) ?? 0) + 1);
    const plan = logo ? logoPlan(book, g, l, logo) : null;
    const c = compose(book, format, words, l, familyFor, {}, plan ?? void 0);
    const doc = await build(c.jsx, ask.picture, plan?.logo.variants);
    let t = measure(doc, c, l, book, pixels, keep, plan);
    let made = doc;
    tried++;
    const fit = fitFor(doc, c.sizes);
    if (fit) {
      const lf = { ...l, fit };
      const cf = compose(book, format, words, lf, familyFor, {}, plan ?? void 0);
      const df = await build(cf.jsx, ask.picture, plan?.logo.variants);
      const tf = measure(df, cf, lf, book, pixels, keep, plan);
      tried++;
      if (better(tf, t) || tf.ok === t.ok && tf.score >= t.score) {
        t = tf;
        made = df;
      }
    }
    if (attempts.length < 30) {
      attempts.push({ layout: l, failed: t.checks.filter((x) => !x.ok && x.hard).map((x) => `${x.node}: ${x.note}`) });
    }
    if (!best || better(t, best.t)) best = { t, doc: made };
    if (best.t.ok && tried >= 6) break;
    if (tried >= 200) break;
  }
  if (!best) throw new Error("No layout could be made.");
  const even = await balance(ask, best.t, familyFor, pixels, keep, logo);
  if (even) best = even;
  const fitted2 = best.t.layout.fit;
  if (fitted2) {
    for (const [node, k] of [["Headline", fitted2.headline], ["CTA", fitted2.cta]]) {
      if (k) best.t.checks.push({ check: "fits", node, ok: true, hard: false, note: `Set at ${Math.round(k * 100)}% of its style's size, so its longest word fits the column whole.` });
    }
  }
  const used = /* @__PURE__ */ new Set([best.t.layout.headline, best.t.layout.subline ?? "subline", componentOf(book, "cta")?.style ?? "cta"]);
  const seen = /* @__PURE__ */ new Set();
  if (ask.logo && !logo) {
    best.t.checks.push({ check: "logo", node: "Logo", ok: false, hard: false, note: "The logo file could not be read; set it by hand." });
  }
  const fontChecks = fonts.filter((f) => used.has(f.style) && f.asked !== f.used && !seen.has(f.asked) && seen.add(f.asked)).map((f) => ({
    check: "font",
    node: f.style,
    ok: false,
    hard: false,
    note: `${f.asked} is not on file; set in ${f.used} until the brand gives Fume its font.`
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
    ms: Date.now() - t0
  };
}
async function balance(ask, base, familyFor, pixels, keep, logo = null) {
  const { book, format, words } = ask;
  const l = base.layout;
  const plan = logo ? logoPlan(book, gridOf(book, format), l, logo) : null;
  const widths = {};
  let longest = 0;
  const heightOf = async (w, name) => {
    const c2 = compose(book, format, words, l, familyFor, w);
    const doc2 = await build(c2.jsx, ask.picture);
    longest = Math.max(0, ...wordWidths(doc2, name).map((x) => x.width));
    return boxOf(doc2, name)?.h ?? Infinity;
  };
  for (const name of ["Headline", "Subline"]) {
    const box = base.boxes[name];
    if (!box) continue;
    const full = box.w;
    const one = await heightOf({ ...widths, [name]: full * 4 }, name);
    if (box.h <= one + 1) continue;
    let lo = Math.max(Math.round(full * 0.5), Math.ceil(longest) + 2);
    let hi = Math.round(full);
    while (hi - lo > 12) {
      const mid = Math.round((lo + hi) / 2);
      if (await heightOf({ ...widths, [name]: mid }, name) <= box.h + 1) hi = mid;
      else lo = mid;
    }
    if (hi < full - 12) widths[name] = Math.min(full, hi + 4);
  }
  if (!Object.keys(widths).length) return null;
  const c = compose(book, format, words, l, familyFor, widths, plan ?? void 0);
  const doc = await build(c.jsx, ask.picture, plan?.logo.variants);
  const t = measure(doc, c, l, book, pixels, keep, plan);
  return t.ok || !base.ok ? { t, doc } : null;
}
function* layoutsFor(book, format, prefer, hasCta) {
  const comp = componentOf(book, "headline");
  const first = prefer.headline && styleOf(book, prefer.headline) ? prefer.headline : comp?.style ?? "h1";
  const steps = headlineSteps(book, first).map((s) => s.name);
  const sig = signatureOf(book, prefer.signature, hasCta);
  const g = gridOf(book, format);
  const sigColumns = sig ? Math.min(g.columns, Math.max(4, Math.round(sig.wordsWidthPct / 100 * g.columns))) : null;
  const sigGround = sig ? sig.ground === "colour_block" ? "block" : sig.ground : null;
  const sigColour = sig ? { light: "on_photo", dark: "text", brand_colour: "accent" }[sig.words] : null;
  const ctaLook = sig && sig.cta !== "none" ? sig.cta : void 0;
  const noCta = sig?.cta === "none";
  const groundHex = sig?.groundHex && /^#[0-9a-f]{6}$/i.test(sig.groundHex) ? sig.groundHex : void 0;
  const ctaFill = sig?.ctaFill && sig.ctaFill !== "none" ? sig.ctaFill : void 0;
  const bands = uniq([prefer.band ?? sig?.band ?? "top", sig?.band ?? "top", "top", "bottom", "middle"]);
  const aligns = uniq([prefer.align ?? sig?.align ?? "left", sig?.align ?? "left", "left", "right", "center"]);
  const colours = uniq([...sigColour ? [sigColour] : [], prefer.colour ?? "on_photo", "on_photo", comp?.colour ?? "text", "text"]).filter(
    (r) => book.colours.some((c) => c.role === r)
  );
  const scrim = book.photoText?.scrim ?? "gradient";
  const grounds = uniq([
    prefer.ground ?? sigGround ?? "photo",
    sigGround ?? "photo",
    "photo",
    ...scrim === "gradient" ? ["gradient"] : [],
    "flat"
  ]).filter((x) => x !== "block" || sigGround === "block");
  const widths = prefer.columns ? [prefer.columns] : uniq([...sigColumns ? [sigColumns] : [], ...format === "banner" ? [6, 8] : [9, 7, 12]]);
  const cta = hasCta && !noCta ? prefer.cta ?? "with_words" : "none";
  const sublines = uniq(["subline", "body"].filter((n) => styleOf(book, n)));
  if (!sublines.length) sublines.push("subline");
  for (const band of bands) {
    for (const ground of grounds) {
      if (ground === "gradient" && band === "middle") continue;
      for (const align of aligns) {
        for (const columns of widths) {
          for (const headline of steps.slice(0, 3)) {
            for (const subline of sublines) {
              for (const colour of ground === "flat" ? ["text"] : ground === "block" ? ["on_primary"] : colours) {
                yield {
                  band,
                  align,
                  headline,
                  colour,
                  ground,
                  cta,
                  columns,
                  ...subline === "subline" ? {} : { subline },
                  ...ctaLook ? { ctaLook } : {},
                  ...ctaFill ? { ctaFill } : {},
                  ...groundHex && (ground === "block" || ground === "flat") ? { groundHex } : {},
                  ...sig ? { signature: sig.name } : {}
                };
              }
            }
          }
        }
      }
    }
  }
}
function measure(doc, c, l, book, p, keep, logo = null) {
  const g = c.grid;
  const words0 = boxOf(doc, "Words");
  const action0 = boxOf(doc, "Action");
  const room = g.h - g.top - g.bottom - (action0 ? action0.h + 32 : 0);
  const shareBand = !logo?.inside && logo?.first?.startsWith(l.band === "middle" ? "-" : l.band) ? logo.h + 40 : 0;
  const y = l.band === "top" ? g.top + shareBand : l.band === "bottom" ? g.h - g.bottom - words0.h - (action0 ? action0.h + 32 : 0) - shareBand : Math.round(g.top + (room - words0.h) / 2);
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
  for (const n of ["Headline", "Price", "Was", "Subline", "CTA", "Action"]) {
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
  for (const n of ["Headline", "Price", "Was", "Subline", "CTA words"]) {
    const split = splitWords(doc, n);
    if (split.length)
      checks.push({ check: "fits", node: n === "CTA words" ? "CTA" : n, ok: false, hard: true, note: `Breaks inside a word: ${split.join(", ")}.` });
  }
  const tall = c.grid.h > c.grid.w * 1.5;
  for (const [n, style, most] of [
    ["Headline", l.headline, tall ? 3 : 2],
    ["Price", "price", 1],
    ["Subline", "subline", tall ? 4 : 3]
  ]) {
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
      note: `${lines} line${lines === 1 ? "" : "s"} (at most ${most}).`
    });
  }
  const onPhoto = l.ground === "photo" || l.ground === "gradient";
  for (const n of ["Headline", "Price", "Was", "Subline"]) {
    const b = boxes[n];
    if (!b) continue;
    const u = !onPhoto && c.panel ? { contrast: contrastOf(c.colours[n], c.panel), poor: 0, worst: 21, busy: 0 } : under(p, b, c.colours[n], shades, Math.max(16, c.sizes[n] * 0.5));
    const need = n === "Subline" || n === "Was" ? 4.5 : 3;
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
  let placed = null;
  if (logo?.inside && c.panel) {
    const id = doc.ids.get("Logo");
    const { v, contrast: value } = preferDrawn(logo.logo, logo.logo.variants.map((x) => ({ v: x, contrast: contrastOf(x.hex, c.panel) })));
    if (id) {
      doc.graph.updateNode(id, {
        fills: [{ type: "IMAGE", imageHash: v.hash, imageScaleMode: "FIT", color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
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
      note: value < 3 ? `The logo is hard to see on the panel (${value}:1).` : `In the panel over the headline, ${v.name === "as_is" ? "as drawn" : `the ${v.name} version`}, ${value}:1.${v.name !== "as_is" && !logo.logo.mono ? " Made in one colour from the brand's logo; ask the brand for its reversed logo." : ""}`
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
function logoPlan(book, g, l, logo) {
  const sig = signatureOf(book, l.signature);
  if (sig && sig.logo === "none") return null;
  const first = sig && CORNERS.includes(sig.logo) ? sig.logo : null;
  const pct = sig?.logoWidthPct && sig.logoWidthPct > 0 ? Math.min(30, Math.max(4, sig.logoWidthPct)) : 12;
  let w = g.w * pct / 100;
  let h = w * logo.height / logo.width;
  const most = g.h * 0.08;
  if (h > most) {
    w = w * most / h;
    h = most;
  }
  const inside = Boolean(first?.startsWith(l.band)) && (l.ground === "flat" || l.ground === "block");
  return { logo, w: Math.round(w), h: Math.round(h), first, ...inside ? { inside } : {} };
}
function preferDrawn(logo, read2) {
  const drawn = read2.find((r) => r.v.name === "as_is");
  if (drawn && (drawn.contrast >= 3 || logo.mono && drawn.contrast >= 3)) return drawn;
  return [...read2].sort((a, b) => b.contrast - a.contrast)[0];
}
function boxAt(where, g, w, h) {
  const [v, side] = where.split("_");
  const x = side === "left" ? g.margin : side === "right" ? g.w - g.margin - w : Math.round((g.w - w) / 2);
  const y = v === "top" ? g.top : g.h - g.bottom - h;
  return { x, y, w, h };
}
function placeLogo(doc, g, plan, boxes, keep, p, shades, l) {
  const id = doc.ids.get("Logo");
  const avoid = [...["Words", "CTA", "Action"].map((n) => boxes[n]).filter(Boolean), ...keep];
  let best = null;
  for (const where of cornersFor(plan.first, l.band, l.align)) {
    const box = boxAt(where, g, plan.w, plan.h);
    const pad = { x: box.x - 16, y: box.y - 16, w: box.w + 32, h: box.h + 32 };
    if (avoid.some((a) => overlap(pad, a) > 0)) continue;
    const read2 = plan.logo.variants.map((v) => ({ v, contrast: under(p, box, v.hex, shades, Math.max(8, Math.round(plan.h * 0.5))).contrast }));
    const pick = preferDrawn(plan.logo, read2);
    if (!best || pick.contrast > best.contrast + 0.01) best = { where, box, v: pick.v, contrast: pick.contrast };
    if (best && best.where === where && best.contrast >= 3) break;
  }
  if (!id || !best || best.contrast < 3) {
    if (id) doc.graph.updateNode(id, { visible: false });
    return {
      check: { check: "logo", node: "Logo", ok: false, hard: false, value: best?.contrast, need: 3, note: "No calm corner reads for the logo; it is left off for the designer to place." },
      box: null,
      placed: null
    };
  }
  place(doc, "Logo", { x: best.box.x, y: best.box.y });
  doc.graph.updateNode(id, {
    fills: [{ type: "IMAGE", imageHash: best.v.hash, imageScaleMode: "FIT", color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
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
      note: `${own ? "In the brand's own corner" : "In a calm corner"} (${best.where.replace("_", " ")}), ${best.v.name === "as_is" ? "as drawn" : `the ${best.v.name} version`}, ${best.contrast}:1.`
    },
    box: best.box,
    placed: { where: best.where, variant: best.v.name, contrast: best.contrast }
  };
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
var FIT_FLOOR = 0.6;
function fitFor(doc, sizes = {}) {
  const need = (name, floor = FIT_FLOOR) => {
    const ws = wordWidths(doc, name);
    const worst = Math.min(1, ...ws.map((w) => (w.box - 2) / w.width));
    return worst < 1 && worst >= floor ? Math.floor(worst * 100) / 100 : void 0;
  };
  const over = sizes.Headline && sizes.Subline ? sizes.Subline * 1.25 / sizes.Headline : 0;
  const headline = need("Headline", Math.max(FIT_FLOOR, over));
  const cta = need("CTA words");
  const line = lineWidth(doc, "Price");
  const whole = line ? Math.min(1, (line.box - 2) / line.width) : 1;
  const price = whole < 1 && whole >= FIT_FLOOR ? Math.floor(whole * 100) / 100 : need("Price");
  return headline || cta || price ? { ...headline ? { headline } : {}, ...cta ? { cta } : {}, ...price ? { price } : {} } : null;
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
var sameFamily = (a, b) => a.toLowerCase().replace(/[\s_-]+/g, "") === b.toLowerCase().replace(/[\s_-]+/g, "");
async function familiesOf(book, files = []) {
  const fonts = [];
  const chosen = /* @__PURE__ */ new Map();
  const styles = [];
  const own = useBrandFaces(files);
  const ownFor = (family) => family ? [...own].find(([f]) => sameFamily(f, family))?.[1] : void 0;
  for (const s of book.styles) {
    const t = book.typefaces.find((x) => x.role === s.font) ?? book.typefaces[0];
    const asked = t?.family ?? "Inter";
    const file = ownFor(asked);
    let used = "Inter";
    for (const f of [file, asked, t?.fallback, "Inter"]) {
      if (f && await hasFont(f, s.weight)) {
        used = f;
        break;
      }
    }
    chosen.set(s.name, used);
    const isOwn = Boolean(file) && used === file;
    fonts.push({ style: s.name, asked, used: isOwn ? asked : used, ...isOwn ? { own: true } : t?.source === "stand_in" ? { standIn: true } : {} });
    styles.push(!isOwn && (used !== asked || t?.source === "stand_in") && s.case === "upper" ? { ...s, lineHeight: standInLeading(s.lineHeight, await capHeightOf(used, s.weight)) } : s);
  }
  return { familyFor: (s) => chosen.get(s.name) ?? "Inter", fonts, book: { ...book, styles } };
}
var BRAND_CAP = 0.72;
function standInLeading(lineHeight, cap) {
  if (!cap || cap <= BRAND_CAP) return lineHeight;
  return Math.round((lineHeight + cap - BRAND_CAP) * 100) / 100;
}
function contrastOf(a, b) {
  return Math.round(contrast(luminance(...rgbOf(a)), luminance(...rgbOf(b))) * 100) / 100;
}
function uniq(xs) {
  return [...new Set(xs)];
}

// src/fix.ts
var RATIOS = [
  ["21:9", 21 / 9],
  ["16:9", 16 / 9],
  ["3:2", 1.5],
  ["4:3", 4 / 3],
  ["5:4", 1.25],
  ["1:1", 1],
  ["4:5", 0.8],
  ["3:4", 0.75],
  ["2:3", 2 / 3],
  ["9:16", 9 / 16]
];
function cropFor(box, width, height, least = 384) {
  const bx = box.x * width, by = box.y * height, bw = box.w * width, bh = box.h * height;
  const pad = Math.max(bw, bh) * 0.4;
  let w = Math.max(least, bw + 2 * pad), h = Math.max(least, bh + 2 * pad);
  const [ratio, r] = RATIOS.reduce((a, b) => Math.abs(Math.log(b[1] / (w / h))) < Math.abs(Math.log(a[1] / (w / h))) ? b : a);
  if (w / h < r) w = h * r;
  else h = w / r;
  const k = Math.min(1, width / w, height / h);
  w = Math.round(w * k);
  h = Math.round(h * k);
  const x = Math.round(Math.min(Math.max(0, bx + bw / 2 - w / 2), width - w));
  const y = Math.round(Math.min(Math.max(0, by + bh / 2 - h / 2), height - h));
  return { rect: { x, y, w, h }, ratio };
}
function crop(img, r) {
  const out = new Uint8Array(r.w * r.h * 4);
  for (let y = 0; y < r.h; y++) {
    const from = ((r.y + y) * img.width + r.x) * 4;
    out.set(img.data.subarray(from, from + r.w * 4), y * r.w * 4);
  }
  return { width: r.w, height: r.h, data: out };
}
function blank(img, part) {
  const x0 = Math.max(0, Math.floor(part.x)), y0 = Math.max(0, Math.floor(part.y));
  const x1 = Math.min(img.width, Math.ceil(part.x + part.w)), y1 = Math.min(img.height, Math.ceil(part.y + part.h));
  if (x1 <= x0 || y1 <= y0) return img;
  const chans = [[], [], []];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) for (let c = 0; c < 3; c++) chans[c].push(img.data[(y * img.width + x) * 4 + c]);
  }
  const median = chans.map((v) => v.sort((a, b) => a - b)[v.length >> 1]);
  const data = new Uint8Array(img.data);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data.set([...median, 255], (y * img.width + x) * 4);
  return { width: img.width, height: img.height, data };
}
function resize(img, w, h) {
  if (img.width === w && img.height === h) return img;
  const out = new Uint8Array(w * h * 4);
  const sx = img.width / w, sy = img.height / h;
  for (let y = 0; y < h; y++) {
    const fy = Math.min(img.height - 1, Math.max(0, (y + 0.5) * sy - 0.5));
    const y0 = Math.floor(fy), y1 = Math.min(img.height - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(img.width - 1, Math.max(0, (x + 0.5) * sx - 0.5));
      const x0 = Math.floor(fx), x1 = Math.min(img.width - 1, x0 + 1), tx = fx - x0;
      for (let c = 0; c < 4; c++) {
        const p = (yy, xx) => img.data[(yy * img.width + xx) * 4 + c];
        const top = p(y0, x0) * (1 - tx) + p(y0, x1) * tx;
        const bottom = p(y1, x0) * (1 - tx) + p(y1, x1) * tx;
        out[(y * w + x) * 4 + c] = Math.round(top * (1 - ty) + bottom * ty);
      }
    }
  }
  return { width: w, height: h, data: out };
}
function setBack(picture, redrawn, rect, box) {
  const patch = resize(redrawn, rect.w, rect.h);
  const inner = {
    x0: box.x * picture.width - rect.x,
    y0: box.y * picture.height - rect.y,
    x1: (box.x + box.w) * picture.width - rect.x,
    y1: (box.y + box.h) * picture.height - rect.y
  };
  const room = Math.max(1, Math.min(inner.x0, inner.y0, rect.w - inner.x1, rect.h - inner.y1));
  const hold = room * 0.25;
  const outside = (x, y) => Math.hypot(Math.max(0, inner.x0 - x, x - inner.x1), Math.max(0, inner.y0 - y, y - inner.y1));
  const mean = [0, 0, 0];
  let n = 0;
  for (let y = 0; y < rect.h; y += 2) {
    for (let x = 0; x < rect.w; x += 2) {
      const d = outside(x, y);
      if (d < hold || d > room) continue;
      const i = (y * rect.w + x) * 4;
      const j = ((rect.y + y) * picture.width + rect.x + x) * 4;
      for (let c = 0; c < 3; c++) mean[c] += picture.data[j + c] - patch.data[i + c];
      n++;
    }
  }
  const shift = n ? mean.map((m) => m / n) : [0, 0, 0];
  const out = new Uint8Array(picture.data);
  for (let y = 0; y < rect.h; y++) {
    for (let x = 0; x < rect.w; x++) {
      const d = outside(x, y);
      const t = d <= hold ? 1 : d >= room ? 0 : 1 - (d - hold) / (room - hold);
      if (t <= 0) continue;
      const a = t * t * (3 - 2 * t);
      const i = (y * rect.w + x) * 4;
      const j = ((rect.y + y) * picture.width + rect.x + x) * 4;
      for (let c = 0; c < 3; c++) {
        const v = Math.min(255, Math.max(0, patch.data[i + c] + shift[c]));
        out[j + c] = Math.round(picture.data[j + c] * (1 - a) + v * a);
      }
    }
  }
  return { picture: { ...picture, data: out }, drift: Math.round(Math.hypot(shift[0], shift[1], shift[2]) * 10) / 10 };
}
async function decode(bytes) {
  const { ck } = await start();
  const img = ck.MakeImageFromEncoded(bytes);
  if (!img) throw new Error("The picture could not be read.");
  const width = img.width(), height = img.height();
  const data = img.readPixels(0, 0, {
    width,
    height,
    colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Unpremul,
    colorSpace: ck.ColorSpace.SRGB
  });
  img.delete();
  if (!data) throw new Error("The picture could not be read.");
  return { width, height, data: new Uint8Array(data) };
}
async function encode(img) {
  const { ck } = await start();
  const made = ck.MakeImage(
    { width: img.width, height: img.height, colorType: ck.ColorType.RGBA_8888, alphaType: ck.AlphaType.Unpremul, colorSpace: ck.ColorSpace.SRGB },
    img.data,
    img.width * 4
  );
  if (!made) throw new Error("The picture could not be written.");
  const bytes = made.encodeToBytes(ck.ImageFormat.PNG, 100);
  made.delete();
  if (!bytes) throw new Error("The picture could not be written.");
  return bytes;
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
  if (r.logo != null && !signedLink(r.logo, host, "read")) return "The logo must be a signed link to Fume's storage.";
  if (r.fonts != null) {
    if (!Array.isArray(r.fonts) || r.fonts.length > 12) return "Too many font files.";
    for (const f of r.fonts) {
      if (!signedLink(f?.url, host, "read")) return "A font file must be a signed link to Fume's storage.";
      if (typeof f.family !== "string" || !/^[\p{L}\p{N} ._'&-]{1,60}$/u.test(f.family)) return "A font file's family is not one Fume reads.";
      if (!Number.isInteger(f.weight) || f.weight < 100 || f.weight > 900 || typeof f.italic !== "boolean") return "A font file's face is not one Fume reads.";
    }
  }
  if (!r.format || !(r.format in SIZES)) return "Unknown format.";
  if (!r.book || !Array.isArray(r.book.styles) || !Array.isArray(r.book.colours) || !Array.isArray(r.book.typefaces)) {
    return "The brand's design system is missing.";
  }
  if (!r.words || typeof r.words.headline !== "string" || !r.words.headline.trim()) return "A layout needs a headline.";
  for (const w of [r.words.headline, r.words.subline, r.words.cta, r.words.price]) {
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
  const op = r.op;
  if (op === "fix-crop" || op === "fix-set") return fixStep(r, deps);
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
  let logo;
  if (r.logo) {
    try {
      const got = await deps.fetch(r.logo, { signal: AbortSignal.timeout(15e3) });
      const type = got.headers.get("content-type") ?? "";
      const bytes = got.ok && type.startsWith("image/") ? new Uint8Array(await got.arrayBuffer()) : null;
      if (bytes && bytes.byteLength <= 3e6) logo = bytes;
    } catch {
      logo = void 0;
    }
  }
  const fonts = [];
  for (const f of r.fonts ?? []) {
    try {
      const got = await deps.fetch(f.url, { signal: AbortSignal.timeout(15e3) });
      const bytes = got.ok ? new Uint8Array(await got.arrayBuffer()) : null;
      if (bytes && bytes.byteLength <= 8e6 && isSfnt(bytes)) fonts.push({ family: f.family, weight: f.weight, italic: f.italic, bytes });
    } catch {
    }
  }
  const out = await (deps.design ?? design)({
    picture,
    format: r.format,
    book: r.book,
    words: r.words,
    prefer: r.prefer ?? {},
    keepClear: (r.keepClear ?? []).filter(isBox).slice(0, 8),
    ...logo ? { logo } : {},
    ...fonts.length ? { fonts } : {}
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
function isSfnt(b) {
  if (b.length < 12) return false;
  const tag = String.fromCharCode(b[0], b[1], b[2], b[3]);
  return tag === "OTTO" || tag === "true" || b[0] === 0 && b[1] === 1 && b[2] === 0 && b[3] === 0;
}
function isBox(b) {
  const x = b;
  return Boolean(x) && [x.x, x.y, x.w, x.h].every((n) => typeof n === "number" && Number.isFinite(n)) && typeof x.what === "string";
}
var isShare = (b) => Boolean(b) && [b.x, b.y, b.w, b.h].every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1) && b.w > 0 && b.h > 0 && b.x + b.w <= 1.0001 && b.y + b.h <= 1.0001;
function invalidFix(r, host) {
  if (!signedLink(r.picture, host, "read")) return "The picture must be a signed link to Fume's storage.";
  if (!isShare(r.box)) return "Mark the part to fix inside the picture.";
  if (r.op === "fix-crop" && !signedLink(r.upload?.crop, host, "upload")) return "The crop needs a signed upload link to Fume's storage.";
  if (r.op === "fix-set") {
    if (!signedLink(r.redrawn, host, "read")) return "The redrawn part must be a signed link to Fume's storage.";
    const c = r.rect;
    if (!c || ![c.x, c.y, c.w, c.h].every((n) => Number.isInteger(n) && n >= 0) || c.w < 16 || c.h < 16) return "The crop is not one Fume made.";
    if (!signedLink(r.upload?.png, host, "upload")) return "The result needs a signed upload link to Fume's storage.";
  }
  return null;
}
async function read(link, deps, limit = 25e6) {
  try {
    const got = await deps.fetch(link, { signal: AbortSignal.timeout(45e3) });
    const type = got.headers.get("content-type") ?? "";
    if (!got.ok || !type.startsWith("image/")) return json(403, { error: "The picture link is not live." });
    const bytes = new Uint8Array(await got.arrayBuffer());
    return bytes.byteLength > limit ? json(413, { error: "The picture is too large." }) : bytes;
  } catch {
    return json(504, { error: "Reading the picture from storage took too long." });
  }
}
async function store(link, bytes, deps) {
  const res = await deps.fetch(link, {
    method: "PUT",
    headers: { "content-type": "image/png", "x-upsert": "true" },
    body: new Blob([bytes]),
    signal: AbortSignal.timeout(3e4)
  });
  if (!res.ok) throw new Error(`Storing the result failed (${res.status}).`);
  return { bytes: bytes.byteLength, sha256: createHash2("sha256").update(bytes).digest("hex") };
}
async function fixStep(r, deps) {
  const why = invalidFix(r, deps.storageHost);
  if (why) return json(400, { error: why });
  const got = await read(r.picture, deps);
  if (got instanceof Response) return got;
  try {
    const picture = await decode(got);
    if (r.op === "fix-crop") {
      const { rect: rect2, ratio } = cropFor(r.box, picture.width, picture.height, r.read ? 128 : 384);
      let cut = crop(picture, rect2);
      if (r.read) {
        const k = 1024 / Math.max(cut.width, cut.height);
        if (k > 1) cut = resize(cut, Math.round(cut.width * k), Math.round(cut.height * k));
      }
      if (r.blank) {
        cut = blank(cut, { x: r.box.x * picture.width - rect2.x, y: r.box.y * picture.height - rect2.y, w: r.box.w * picture.width, h: r.box.h * picture.height });
      }
      const part = await encode(cut);
      return json(200, { rect: rect2, ratio, width: picture.width, height: picture.height, crop: await store(r.upload.crop, part, deps) });
    }
    const rect = r.rect;
    if (rect.x + rect.w > picture.width || rect.y + rect.h > picture.height) return json(400, { error: "The crop is not one Fume made." });
    const redrawnBytes = await read(r.redrawn, deps);
    if (redrawnBytes instanceof Response) return redrawnBytes;
    const out = setBack(picture, await decode(redrawnBytes), rect, r.box);
    const png2 = await store(r.upload.png, await encode(out.picture), deps);
    return json(200, { width: picture.width, height: picture.height, drift: out.drift, png: png2 });
  } catch (e) {
    return json(502, { error: e.message });
  }
}

// src/fonts.ts
var UA = "Mozilla/4.0";
var WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
function googleFonts(get = fetch) {
  const files = /* @__PURE__ */ new Map();
  const cssOf = async (query) => {
    const res = await get(`https://fonts.googleapis.com/css2?family=${query}&display=swap`, {
      headers: { "user-agent": UA },
      signal: AbortSignal.timeout(8e3)
    }).catch(() => null);
    return res?.ok ? res.text() : null;
  };
  const fileOf = (css) => css?.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)\s]+\.ttf)\)/)?.[1] ?? null;
  const load = async (family, weight, italic) => {
    if (!/^[\p{L}\p{N} ]{1,60}$/u.test(family)) return null;
    const name = encodeURIComponent(family.trim()).replace(/%20/g, "+");
    const order = [...WEIGHTS].sort((a, b) => Math.abs(a - weight) - Math.abs(b - weight) || b - a);
    let url = null;
    for (const w of order.slice(0, 9)) {
      url = fileOf(await cssOf(`${name}:ital,wght@${italic ? 1 : 0},${w}`));
      if (url) break;
      if (w === order[0]) {
        url = fileOf(await cssOf(name));
        if (url) break;
      }
    }
    if (!url) return null;
    const res = await get(url, { signal: AbortSignal.timeout(1e4) }).catch(() => null);
    return res?.ok ? res.arrayBuffer() : null;
  };
  return (family, weight, italic) => {
    const key = `${family}|${weight}|${italic}`;
    if (!files.has(key)) files.set(key, load(family, weight, italic).catch(() => null));
    return files.get(key);
  };
}

// api-src/design.ts
start({ fonts: googleFonts(fetch), online: false });
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
