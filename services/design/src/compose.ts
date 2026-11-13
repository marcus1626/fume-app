// A layout, as code writes it from the brand's design system. The choice names only what the book has (a type
// style, a colour role, a component); every size, colour, radius and margin comes from the book, so a layout is on
// brand by construction. The words are the plan's, as the expert checked them.
import {
  type DesignBook,
  type Format,
  type Grid,
  type Style,
  colourOf,
  columnsWidth,
  componentOf,
  gridOf,
  radiusOf,
  styleOf,
} from "./book.ts";
import { type Box, type Shade } from "./pixels.ts";

export interface Words {
  headline: string;
  subline?: string | null;
  cta?: string | null;
  /** The price as the plan wrote it from a verified fact ("NÅ 199,-"); the brand's price style sets it. */
  price?: string | null;
}

export type Band = "top" | "middle" | "bottom";
export type Align = "left" | "center" | "right";
/** `tint`: the brand's flat tint over the whole picture, at the book's scrim opacity, for its light words where the
 *  picture is too bright for them (Anthem's book: "a flat navy tint at 35 per cent covers the picture behind the words;
 *  never a gradient, never a solid box"). */
export type Ground = "photo" | "gradient" | "flat" | "block" | "tint";
export type CtaLook = "pill" | "box" | "outline" | "slant" | "slant_double" | "underline" | "text";

/** One way to lay the words out. */
export interface Layout {
  wordsPlacement?: "on_picture" | "own_area";
  band: Band;
  align: Align;
  /** The headline's type style, by name. */
  headline: string;
  /** The colour role of the words on the picture. */
  colour: string;
  /** What the words stand on: the picture itself, a fade of dark from the edge, a flat panel, or a block of the brand's colour. */
  ground: Ground;
  /** How the call to action looks, as the brand's own creatives show it (a pill when the book says nothing). */
  ctaLook?: CtaLook;
  /** The button's own colour, as the brand's creatives show it: a light pill with dark words, a dark one, or the brand's. */
  ctaFill?: "light" | "dark" | "brand_colour";
  /** The block's colour from the brand's own ads, when it is not one of the book's roles. */
  groundHex?: string;
  /** The brand's layout this one follows, by name. */
  signature?: string;
  /** The subline's type style, by name: a smaller one when the plan's line is long for the picture. */
  subline?: string;
  /** The call to action under the words, or alone at the bottom of the frame. */
  cta: "with_words" | "bottom" | "none";
  /** The side of the frame a call to action alone at the bottom sits on, when the brand sets it apart from the words. */
  ctaSide?: Align;
  /** How many of the grid's columns the words span. */
  columns: number;
  /** Where the block of words starts down the frame, as a share of its height: the brand's own place, from its ads. */
  at?: number;
  /** How dark the tint is, 0–1: the book's own first, deeper only where its light words would not read. */
  tint?: number;
  /**
   * The headline or the call to action set smaller than its style, so a long word fits the column whole
   * ("FLANELLSKJORTER"), as a designer sizes a headline to its measure. 1 is the style's own size.
   */
  fit?: { headline?: number; cta?: number; price?: number };
}

export interface Composed {
  jsx: string;
  grid: Grid;
  /** The fonts the words are set in. */
  fonts: { family: string; weight: number }[];
  /** The colours of the words, by node name. */
  colours: Record<string, string>;
  sizes: Record<string, number>;
  /** The panel's colour when the words stand on one. */
  panel?: string;
}

/** A family the renderer can set, by the role it plays in the book. */
export type FamilyFor = (style: Style) => string;

export function compose(
  book: DesignBook,
  format: Format,
  words: Words,
  l: Layout,
  family: FamilyFor,
  /** Narrower widths for single lines of words, so their lines come out even (see balance in design.ts). */
  widths: Partial<Record<"Headline" | "Subline", number>> = {},
  /** The logo's size on this format, when it is set; measure() moves it to its corner. */
  logo?: { w: number; h: number; inside?: boolean },
): Composed {
  const g = gridOf(book, format);
  const unit = book.spacing?.unitPx ?? 8;
  // A headline keeps the brand's headline case at every size: a title that steps down from display to h1 is still the
  // same headline (Anthem, 9 Nov: two creatives in capitals, four in title case).
  const head = styleOf(book, l.headline) ?? styleOf(book, "h1") ?? book.styles[0];
  const display = styleOf(book, "display");
  const hl = fitted(display && ["h1", "h2"].includes(head.name) ? { ...head, case: display.case } : head, l.fit?.headline);
  const sub = styleOf(book, l.subline ?? "subline") ?? styleOf(book, "subline") ?? styleOf(book, "body") ?? hl;
  const panel = componentOf(book, "body");
  const isBlock = l.ground === "block";
  const onPanel = l.ground === "flat" || isBlock;
  // A block or a panel in the brand's own colour from its ads (Møllers' green) carries words that read on it.
  const ownGround = l.wordsPlacement === "own_area" ? (colourOf(book, panel?.background ?? "surface") ?? colourOf(book, "background") ?? book.colours[0]?.hex ?? "#FFFFFF") : onPanel && l.groundHex && /^#[0-9a-f]{6}$/i.test(l.groundHex) ? l.groundHex.toUpperCase() : null;
  const wordsHex = ownGround
    ? readableOn(ownGround, colourOf(book, "on_photo") ?? "#FFFFFF", colourOf(book, "text") ?? "#000000")
    : isBlock
      ? (colourOf(book, "on_primary") ?? "#FFFFFF")
    : onPanel
      ? (colourOf(book, "text") ?? "#000000")
      : (colourOf(book, l.colour) ?? "#FFFFFF");
  const subHex = l.wordsPlacement === "own_area" ? wordsHex : isBlock || ownGround ? wordsHex : onPanel ? (colourOf(book, "text_muted") ?? wordsHex) : wordsHex;
  const width = columnsWidth(g, Math.min(g.columns, Math.max(4, l.columns)));
  const x = l.align === "left" ? g.margin : l.align === "right" ? g.w - g.margin - width : Math.round((g.w - width) / 2);
  const textAlign = l.align;
  const items = l.align === "left" ? "start" : l.align === "right" ? "end" : "center";
  const fonts: { family: string; weight: number }[] = [];
  const colours: Record<string, string> = { Headline: wordsHex };
  const sizes: Record<string, number> = { Headline: hl.sizePx };

  const text = (name: "Headline" | "Subline" | "Price" | "Was", s: Style, value: string, hex: string) => {
    const fam = family(s);
    fonts.push({ family: fam, weight: s.weight });
    const w = (name === "Headline" || name === "Subline") && widths[name] ? `{${Math.round(widths[name]!)}}` : `"fill"`;
    return `<Text name=${q(name)} w=${w} font=${q(fam)} weight={${s.weight}} size={${s.sizePx}} lineHeight={${Math.round(
      s.sizePx * s.lineHeight,
    )}} letterSpacing={${round(s.trackingEm * s.sizePx)}} color=${q(hex)}${caseOf(s)} textAlign=${q(textAlign)} text={${JSON.stringify(
      bindShort(value),
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
    const bg =
      l.ctaFill === "light" ? light : l.ctaFill === "dark" ? dark : (colourOf(book, c?.background ?? "cta") ?? colourOf(book, "primary") ?? "#000000");
    // On the brand's own block, a light pill carries the block's colour in its words (Møllers: green on white).
    const fg =
      l.ctaFill === "light" ? (ownGround && !isLight(ownGround) ? ownGround : dark) : l.ctaFill === "dark" ? light : (colourOf(book, c?.colour ?? "cta_text") ?? "#FFFFFF");
    sizes.CTA = s.sizePx;
    const pad = c?.paddingPx ?? 24;
    const line = Math.round(s.sizePx * s.lineHeight);
    if (look === "underline" || look === "text") {
      // The words alone, in the words' own colour; underlined when the brand does so.
      colours.CTA = wordsHex;
      const rule = look === "underline" ? `<Rectangle name="Rule" w="fill" h={${Math.max(2, Math.round(s.sizePx / 14))}} bg=${q(wordsHex)} />` : "";
      return `<Frame name="CTA" w="hug" h="hug" flex="col" gap={${Math.round(s.sizePx / 4)}}><Text name="CTA words" font=${q(fam)} weight={${s.weight}} size={${s.sizePx}} lineHeight={${line}} letterSpacing={${round(
        s.trackingEm * s.sizePx,
      )}} color=${q(wordsHex)}${caseOf(s)} text={${JSON.stringify(words.cta ?? "")}} />${rule}</Frame>`;
    }
    const py = Math.max(Math.round(pad * 0.6), Math.ceil((56 - line) / 2));
    if (look === "slant" || look === "slant_double") {
      // A slanted outline in the words' own colour, one thin line or two that cross, as sports retailers set their
      // buttons (Anthem's SHOP NOW, 9 Nov). The lines are drawn once the button has its size (see slants in render.ts).
      colours.CTA = wordsHex;
      // Hairlines, as the site draws them: about a 24th of the words' size (SHOP NOW at 28 px: 1.5 px lines).
      const stroke = Math.max(1.5, Math.round((s.sizePx / 24) * 2) / 2);
      const lean = Math.round(line * 0.45);
      return `<Frame name="CTA" w="hug" h="hug" px={${Math.round(s.sizePx * 0.9) + lean}} py={${Math.round(s.sizePx * 0.6)}}><Text name="CTA words" font=${q(fam)} weight={${s.weight}} size={${s.sizePx}} lineHeight={${line}} letterSpacing={${round(
        s.trackingEm * s.sizePx,
      )}} color=${q(wordsHex)}${caseOf(s)} text={${JSON.stringify(words.cta ?? "")}} /><Rectangle name=${q(
        `Slant ${wordsHex} ${stroke} ${look === "slant_double" ? 2 : 1}`,
      )} position="absolute" x={0} y={0} w={1} h={1} fills={[]} /></Frame>`;
    }
    if (look === "outline") {
      // A thin border in the words' own colour and no fill, as the brand's own tiles set it (Anthem's SHOP NOW box).
      colours.CTA = wordsHex;
      return `<Frame name="CTA" w="hug" h="hug" px={${Math.round(pad * 1.5)}} py={${py}} rounded={${radiusOf(book, "small")}} stroke=${q(
        wordsHex,
      )} strokeWidth={${Math.max(2, Math.round(s.sizePx / 12))}} strokeAlign="INSIDE"><Text name="CTA words" font=${q(fam)} weight={${s.weight}} size={${s.sizePx}} lineHeight={${line}} letterSpacing={${round(
        s.trackingEm * s.sizePx,
      )}} color=${q(wordsHex)}${caseOf(s)} text={${JSON.stringify(words.cta ?? "")}} /></Frame>`;
    }
    colours.CTA = fg;
    return `<Frame name="CTA" w="hug" h="hug" px={${Math.round(pad * 1.5)}} py={${py}} rounded={${radiusOf(
      book,
      look === "box" ? "small" : (c?.radius ?? "pill"),
    )}} bg=${q(bg)}><Text name="CTA words" font=${q(fam)} weight={${s.weight}} size={${s.sizePx}} lineHeight={${line}} letterSpacing={${round(
      s.trackingEm * s.sizePx,
    )}} color=${q(fg)}${caseOf(s)} text={${JSON.stringify(words.cta ?? "")}} /></Frame>`;
  };

  const inner: string[] = [text("Headline", hl, words.headline, wordsHex)];
  // The price is the brand's biggest figure where it sets one (Dressmann: caps title, then the price, then the button).
  if (words.price) {
    // The price before ("TIDLIGERE 399,-") is set small under the figure, as the brand sets it.
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
  const apart = l.cta === "bottom" && l.ctaSide !== undefined && l.ctaSide !== l.align;
  const ctaWithWords = words.cta && (l.cta === "with_words" || (l.cta === "bottom" && l.band === "bottom" && !apart));
  const side = l.cta === "bottom" && l.ctaSide ? l.ctaSide : l.align;
  const pad = onPanel ? (panel?.paddingPx ?? 32) : 0;
  const panelHex = ownGround
    ? ownGround
    : isBlock
      ? (colourOf(book, "primary") ?? "#000000")
    : (colourOf(book, panel?.background ?? "surface") ?? colourOf(book, "background") ?? "#FFFFFF");
  const panelBg = onPanel ? ` bg=${q(panelHex)}` : "";
  // On the brand's own panel its logo sits in the panel, over the headline, as Möller's ads set it.
  const insideLogo = logo?.inside
    ? `<Rectangle name="Logo" w={${Math.round(logo.w)}} h={${Math.round(logo.h)}} fills={[{ type: "IMAGE", imageHash: "LOGO", imageScaleMode: "FIT", color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]} />`
    : "";
  const panelRadius = onPanel ? ` rounded={${radiusOf(book, panel?.radius ?? "none")}}` : "";
  const block = `<Frame name="Words" position="absolute" x={${x}} y={${g.top}} w={${width}} h="hug" flex="col" items=${q(
    items,
  )} gap={${unit * 5}}${panelBg}${panelRadius} p={${pad}}><Frame name="Lines" w="fill" h="hug" flex="col" items=${q(items)} gap={${
    unit * 3
  }}>${inner.join("")}</Frame>${ctaWithWords ? cta() : ""}</Frame>`.replace(
    '<Frame name="Lines"',
    `${insideLogo}<Frame name="Lines"`,
  );
  const alone =
    words.cta && !ctaWithWords && l.cta !== "none"
      ? `<Frame name="Action" position="absolute" x={${side === "left" ? g.margin : 0}} y={${g.h - g.bottom - 80}} w={${
          side === "left" ? "\"hug\"" : side === "right" ? g.w - g.margin : g.w
        }} h="hug" flex="col" items=${q(side === "left" ? "start" : side === "right" ? "end" : "center")}>${cta()}</Frame>`
      : "";
  const shade =
    l.ground === "gradient" || l.ground === "tint"
      ? `<Rectangle name="Shade" position="absolute" x={0} y={0} w={${g.w}} h={${Math.round(g.h / 2)}} fills={[]} />`
      : "";
  const logoNode = logo && !logo.inside
    ? `<Rectangle name="Logo" position="absolute" x={${g.margin}} y={${g.top}} w={${Math.round(logo.w)}} h={${Math.round(
        logo.h,
      )}} fills={[{ type: "IMAGE", imageHash: "LOGO", imageScaleMode: "FIT", color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]} />`
    : "";
  const picture = `<Rectangle name="Picture" position="absolute" x={0} y={0} w={${g.w}} h={${g.h}} fills={[{ type: "IMAGE", imageHash: "PHOTO", imageScaleMode: "FILL", color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]} />`;
  const jsx = `<Frame name=${q(`${format} ${g.w}x${g.h}`)} w={${g.w}} h={${g.h}} overflow="hidden" bg=${q(l.wordsPlacement === "own_area" ? panelHex : "#000000")}>${l.wordsPlacement === "own_area" ? `<Frame name="Picture area" position="absolute" x={0} y={0} w={${g.w}} h={${g.h}} overflow="hidden">${picture}</Frame>` : picture}${l.wordsPlacement === "own_area" ? `<Rectangle name="Words area" position="absolute" x={0} y={0} w={${g.w}} h={${g.h}} bg=${q(panelHex)} />` : ""}${shade}${block}${alone}${logoNode}</Frame>`;
  return { jsx, grid: g, fonts, colours, sizes, ...(onPanel ? { panel: panelHex } : {}) };
}

/** A type style at a share of its size; its leading and tracking scale with it. */
/** A price line split into the figure and the price before it, where the line carries one. */
export function splitPrice(line: string): { now: string; was: string | null } {
  const m = line.match(/^(.*?)\s+((?:tidligere|før|ord(?:inær|\.)?\s*pris|was|before)\b.*)$/i);
  return m && m[1].trim() ? { now: m[1].trim(), was: m[2].trim() } : { now: line.trim(), was: null };
}

// Rounded down: a size rounded up can be just too wide again for the column it was fitted to.
function fitted(s: Style, k?: number): Style {
  return k && k < 1 ? { ...s, sizePx: Math.floor(s.sizePx * k) } : s;
}

/**
 * A word of one or two letters ("i", "og", "å") is held to the word after it with a no-break space, as a typesetter
 * does, so it never hangs at the end of a line. Only the spaces change; the words stay the plan's.
 */
export function bindShort(text: string): string {
  return text.replace(/(?<=^|\s)(\p{L}{1,2}) (?=\S)/gu, "$1\u00A0");
}

/**
 * The shade under the words once they are placed: dark from the nearer edge, full behind the words. Words set in the
 * middle get it from their own side, as the brand darkens its photo beside the words (Anthem, 10 Nov: the shade was
 * only ever tried at the top or the bottom, so words in the middle stood on bright sand with nothing under them).
 */
export function shadeFor(book: DesignBook, l: Layout, g: Grid, words: { x?: number; y: number; w?: number; h: number }): Shade | null {
  if (l.ground !== "gradient" && l.ground !== "tint") return null;
  const dark = colourOf(book, "text");
  const hex = dark && isDark(dark) ? dark : "#000000";
  // The tint is even over the whole frame: as dark at every place, with no edge to fade from.
  if (l.ground === "tint") {
    const at = l.tint ?? tintOf(book);
    return { hex, from: at, edge: "top", full: g.h, zero: g.h, even: true };
  }
  const from = Math.min(0.75, Math.max(0.3, book.photoText?.scrimOpacity ?? 0.5));
  if (l.band === "middle") {
    if (l.align === "center" || words.x === undefined || words.w === undefined) return null;
    const fade = Math.max(200, Math.round(words.w * 0.5));
    if (l.align === "left") return { hex, from, edge: "left", full: words.x + words.w + 24, zero: Math.min(g.w, words.x + words.w + 24 + fade) };
    return { hex, from, edge: "right", full: words.x - 24, zero: Math.max(0, words.x - 24 - fade) };
  }
  const fade = Math.max(160, Math.round(words.h * 0.8));
  if (l.band === "bottom") {
    return { hex, from, edge: "bottom", full: words.y - 24, zero: Math.max(0, words.y - 24 - fade) };
  }
  return { hex, from, edge: "top", full: words.y + words.h + 24, zero: Math.min(g.h, words.y + words.h + 24 + fade) };
}

/** The book's own tint for words on a picture. */
export function tintOf(book: DesignBook): number {
  return Math.min(0.6, Math.max(0.2, book.photoText?.scrimOpacity ?? 0.35));
}

/** The shade as an OpenPencil fill on a rectangle from y to y + h, or for a shade from the side, from x = y to y + h. */
export function shadeFill(s: Shade, h: number, y: number) {
  const across = s.edge === "left" || s.edge === "right";
  const { r, g, b } = rgb01(s.hex);
  // A tint is one flat colour, never a gradient: a designer opening the file finds it as the brand set it.
  if (s.even) return [{ type: "SOLID", color: { r, g, b, a: 1 }, opacity: s.from, visible: true }];
  const at = (pos: number, a: number) => ({ position: clamp01(pos), color: { r, g, b, a } });
  const stops =
    s.edge === "top" || s.edge === "left"
      ? [at(0, s.from), at((s.full - y) / h, s.from), at(1, 0)]
      : [at(0, 0), at((s.full - y) / h, s.from), at(1, s.from)];
  // Top to bottom: the gradient's axis runs down the rectangle; across, it runs left to right.
  return [
    {
      type: "GRADIENT_LINEAR",
      color: { r, g, b, a: 1 },
      opacity: 1,
      visible: true,
      gradientStops: stops,
      gradientTransform: across ? { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 } : { m00: 0, m01: 1, m02: 0, m10: -1, m11: 0, m12: 1 },
    },
  ];
}

function isLight(hex: string) {
  const { r, g, b } = rgb01(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5;
}
/** The light or the dark of the book, whichever reads better on a colour. */
function readableOn(ground: string, light: string, dark: string) {
  const lum = (h: string) => {
    const { r, g, b } = rgb01(h);
    const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const ratio = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  return ratio(light, ground) >= ratio(dark, ground) ? light : dark;
}
function isDark(hex: string) {
  const { r, g, b } = rgb01(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.2;
}
function rgb01(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}
const clamp01 = (n: number) => Math.min(1, Math.max(0, Math.round(n * 1000) / 1000));
const round = (n: number) => Math.round(n * 100) / 100;
const q = (s: string) => JSON.stringify(s);
const caseOf = (s: Style) => (s.case === "upper" ? ` textCase="upper"` : s.case === "lower" ? ` textCase="lower"` : "");

/** Cover a separate picture area using the original photo's aspect ratio and the model's subject boxes.
 *  Subject coordinates are normalized against the full format, as sent by keepClearOf in the edge handler. */
export function ownAreaPicture(size: { w: number; h: number }, area: { w: number; h: number }, format: { w: number; h: number }, keep: Box[]): Box {
  const subjects = keep.map((k) => ({ x: k.x * size.w / format.w, y: k.y * size.h / format.h, w: k.w * size.w / format.w, h: k.h * size.h / format.h }));
  const left = subjects.length ? Math.min(...subjects.map((k) => k.x)) : size.w / 2;
  const right = subjects.length ? Math.max(...subjects.map((k) => k.x + k.w)) : size.w / 2;
  const first = subjects.length ? Math.min(...subjects.map((k) => k.y)) : size.h / 2;
  const last = subjects.length ? Math.max(...subjects.map((k) => k.y + k.h)) : size.h / 2;
  const fill = Math.max(area.w / size.w, area.h / size.h);
  // If the protected union cannot fit a cover crop, reduce the image just enough to keep it whole.
  // The frame's background fills exposed edges; one oversized box must not reject every text layout.
  const scale = Math.min(fill, right > left ? area.w / (right - left) : fill, last > first ? area.h / (last - first) : fill);
  const offset = (area: number, image: number, first: number, last: number) => {
    const low = Math.max(Math.min(0, area - image), -first * scale);
    const high = Math.min(Math.max(0, area - image), area - last * scale);
    return Math.max(low, Math.min(high, (area - (first + last) * scale) / 2));
  };
  return { x: offset(area.w, size.w * scale, left, right), y: offset(area.h, size.h * scale, first, last), w: size.w * scale, h: size.h * scale };
}
