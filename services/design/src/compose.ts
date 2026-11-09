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
import { type Shade } from "./pixels.ts";

export interface Words {
  headline: string;
  subline?: string | null;
  cta?: string | null;
  /** The price as the plan wrote it from a verified fact ("NÅ 199,-"); the brand's price style sets it. */
  price?: string | null;
}

export type Band = "top" | "middle" | "bottom";
export type Align = "left" | "center" | "right";
export type Ground = "photo" | "gradient" | "flat" | "block";
export type CtaLook = "pill" | "box" | "outline" | "slant" | "slant_double" | "underline" | "text";

/** One way to lay the words out. */
export interface Layout {
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
  /** How many of the grid's columns the words span. */
  columns: number;
  /** Where the block of words starts down the frame, as a share of its height: the brand's own place, from its ads. */
  at?: number;
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
  const ownGround = onPanel && l.groundHex && /^#[0-9a-f]{6}$/i.test(l.groundHex) ? l.groundHex.toUpperCase() : null;
  const wordsHex = ownGround
    ? readableOn(ownGround, colourOf(book, "on_photo") ?? "#FFFFFF", colourOf(book, "text") ?? "#000000")
    : isBlock
      ? (colourOf(book, "on_primary") ?? "#FFFFFF")
    : onPanel
      ? (colourOf(book, "text") ?? "#000000")
      : (colourOf(book, l.colour) ?? "#FFFFFF");
  const subHex = isBlock || ownGround ? wordsHex : onPanel ? (colourOf(book, "text_muted") ?? wordsHex) : wordsHex;
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
      const stroke = Math.max(2, Math.round(s.sizePx / 14));
      const lean = Math.round(line * 0.45);
      return `<Frame name="CTA" w="hug" h="hug" px={${Math.round(s.sizePx * 1.3) + lean}} py={${Math.round(s.sizePx * 0.7)}}><Text name="CTA words" font=${q(fam)} weight={${s.weight}} size={${s.sizePx}} lineHeight={${line}} letterSpacing={${round(
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
  const ctaWithWords = words.cta && (l.cta === "with_words" || (l.cta === "bottom" && l.band === "bottom"));
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
      ? `<Frame name="Action" position="absolute" x={${l.align === "left" ? g.margin : 0}} y={${g.h - g.bottom - 80}} w={${
          l.align === "left" ? "\"hug\"" : l.align === "right" ? g.w - g.margin : g.w
        }} h="hug" flex="col" items=${q(items)}>${cta()}</Frame>`
      : "";
  const shade =
    l.ground === "gradient"
      ? `<Rectangle name="Shade" position="absolute" x={0} y={0} w={${g.w}} h={${Math.round(g.h / 2)}} fills={[]} />`
      : "";
  const logoNode = logo && !logo.inside
    ? `<Rectangle name="Logo" position="absolute" x={${g.margin}} y={${g.top}} w={${Math.round(logo.w)}} h={${Math.round(
        logo.h,
      )}} fills={[{ type: "IMAGE", imageHash: "LOGO", imageScaleMode: "FIT", color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]} />`
    : "";
  const jsx = `<Frame name=${q(`${format} ${g.w}x${g.h}`)} w={${g.w}} h={${g.h}} overflow="hidden" bg="#000000"><Rectangle name="Picture" position="absolute" x={0} y={0} w={${g.w}} h={${g.h}} fills={[{ type: "IMAGE", imageHash: "PHOTO", imageScaleMode: "FILL", color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]} />${shade}${block}${alone}${logoNode}</Frame>`;
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

/** The shade under the words once they are placed: dark from the nearer edge, full behind the words. */
export function shadeFor(book: DesignBook, l: Layout, g: Grid, words: { y: number; h: number }): Shade | null {
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

/** The shade as an OpenPencil fill on a rectangle from y to y + h. */
export function shadeFill(s: Shade, h: number, y: number) {
  const { r, g, b } = rgb01(s.hex);
  const at = (pos: number, a: number) => ({ position: clamp01(pos), color: { r, g, b, a } });
  const stops =
    s.edge === "top"
      ? [at(0, s.from), at((s.full - y) / h, s.from), at(1, 0)]
      : [at(0, 0), at((s.full - y) / h, s.from), at(1, s.from)];
  // Top to bottom: the gradient's axis runs down the rectangle.
  return [
    {
      type: "GRADIENT_LINEAR",
      color: { r, g, b, a: 1 },
      opacity: 1,
      visible: true,
      gradientStops: stops,
      gradientTransform: { m00: 0, m01: 1, m02: 0, m10: -1, m11: 0, m12: 1 },
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
