// The parts of a brand's design system (docs/mvp/brand-books.md) the layout is made from. Every colour, type style,
// radius and margin in a layout is read from here by name: a layout cannot use anything the brand's book does not have.

export type Format = "feed" | "square" | "story" | "banner";

export const SIZES: Record<Format, { w: number; h: number }> = {
  feed: { w: 1080, h: 1350 },
  square: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
  banner: { w: 1920, h: 1080 },
};

export interface Colour {
  hex: string;
  role: string;
  name?: string;
}
export interface Typeface {
  role: string;
  family: string;
  weights?: number[];
  fallback?: string;
  /** "stand_in" when the family is the closest Google Font to the brand's own face, not the face itself. */
  source?: string;
}
export interface Style {
  name: string;
  font: string;
  sizePx: number;
  weight: number;
  lineHeight: number;
  trackingEm: number;
  case: "none" | "upper" | "lower" | "title";
}
export interface FormatSpec {
  format: Format;
  columns: number;
  gutterPx: number;
  marginPx: number;
  safeTopPx: number;
  safeBottomPx: number;
}
export interface Component {
  name: string;
  style: string;
  colour: string;
  background: string | null;
  radius: string;
  paddingPx: number;
  rules?: string[];
}
/** A layout the brand repeats on its pictures, read from its own creatives (brand-book creatives.ts). */
export interface Signature {
  name: string;
  /** False for a layout with no words (a plain product photo, the logo alone): never used to set words. */
  hasWords?: boolean;
  band: "top" | "middle" | "bottom";
  align: "left" | "center" | "right";
  wordsWidthPct: number;
  /** How many lines the brand's headline runs in this layout, read from its ads (9 Nov); absent in older books. */
  headlineLines?: number;
  /** The block of words in the brand's ads, as shares of the frame from its top left (9 Nov); absent in older books. */
  box?: { x: number; y: number; w: number; h: number } | null;
  /** How big the price is set against the headline in the brand's ads, when they show one. */
  priceVsHeadline?: "larger" | "same" | "smaller" | "none";
  ground: "photo" | "gradient" | "flat" | "colour_block";
  words: "light" | "dark" | "brand_colour";
  /** The block's or panel's own colour, read from the brand's ads (Møllers' green), when the words stand on one. */
  groundHex?: string;
  cta: "pill" | "box" | "outline" | "slant" | "slant_double" | "underline" | "text" | "none";
  ctaFill?: "light" | "dark" | "brand_colour" | "none";
  /** Where the call to action sits: under the words, or apart in a bottom corner as Anthem's tiles set SHOP NOW. */
  ctaAt?: "with_words" | "bottom_left" | "bottom_right";
  logo?: string;
  logoWidthPct?: number;
  /** Where it was read: the brand's own ads and pictures, its site, or Fume's proposal. */
  source?: string;
}
export interface DesignBook {
  colours: Colour[];
  typefaces: Typeface[];
  styles: Style[];
  formats: FormatSpec[];
  components: Component[];
  radiusPx: Record<string, number>;
  photoText: { rules: string[]; scrim: "none" | "gradient" | "flat"; scrimOpacity: number };
  spacing?: { unitPx: number; scale: number[] };
  /** How the brand sets words on its pictures; the first layout is the most typical. */
  onPictures?: { layouts?: Signature[] } | null;
}

/** The brand's layout by name, else its most typical one. */
export function signatureOf(book: DesignBook, name?: string, hasCta?: boolean): Signature | null {
  const all = (book.onPictures?.layouts ?? []).filter((l) => carriesWords(l));
  const named = all.find((l) => l.name === name);
  if (named) return named;
  // Without a name, the brand's most typical layout from its own ads first (Nike's ads carry no button; its shop
  // does), and among those one with a button when the plan has one.
  const rank = (l: Signature) => (l.source === "pictures" ? 0 : l.source === "site" ? 1 : 2);
  const best = [...all].sort((a, b) => rank(a) - rank(b));
  const first = best[0];
  const fits = hasCta && first ? best.find((l) => rank(l) === rank(first) && l.cta !== "none") : undefined;
  return fits ?? first ?? null;
}

/** Books written before hasWords say it in the name. */
export function carriesWords(l: Signature): boolean {
  return l.hasWords ?? !/\b(no|without) (words|text|copy)\b|\b(logo|swoosh|mark) alone\b/i.test(l.name);
}

/** The format's grid, with the platform's safe areas (a story's top and bottom stay free whatever the book says). */
export function gridOf(book: DesignBook, format: Format) {
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
    bottom: Math.max(margin, f?.safeBottomPx ?? 0, platform.bottom),
  };
}
export type Grid = ReturnType<typeof gridOf>;

/** The width of n of the grid's columns. */
export function columnsWidth(g: Grid, n: number): number {
  const col = (g.w - 2 * g.margin - (g.columns - 1) * g.gutter) / g.columns;
  return Math.round(n * col + (n - 1) * g.gutter);
}

export function colourOf(book: DesignBook, role: string): string | null {
  const c = book.colours.find((x) => x.role === role);
  return c && /^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex.toUpperCase() : null;
}

export function styleOf(book: DesignBook, name: string): Style | null {
  return book.styles.find((s) => s.name === name) ?? null;
}

export function componentOf(book: DesignBook, name: string): Component | null {
  return book.components.find((c) => c.name === name) ?? null;
}

/** The family a style is set in: the brand's own when the renderer has it, else the book's fallback. */
export function familyOf(book: DesignBook, style: Style, has: (family: string) => boolean): { family: string; fallback: boolean } {
  const t = book.typefaces.find((x) => x.role === style.font) ?? book.typefaces[0];
  if (!t) return { family: "Inter", fallback: true };
  if (has(t.family)) return { family: t.family, fallback: false };
  return { family: t.fallback && has(t.fallback) ? t.fallback : "Inter", fallback: true };
}

/** The headline styles from the largest down, as a layout steps down when the words do not fit. */
export function headlineSteps(book: DesignBook, first: string): Style[] {
  const order = ["display", "h1", "h2", "subline"];
  const start = Math.max(0, order.indexOf(first));
  return order
    .slice(start)
    .map((n) => styleOf(book, n))
    .filter((s): s is Style => s !== null);
}

export function radiusOf(book: DesignBook, name: string): number {
  const r = book.radiusPx?.[name];
  return typeof r === "number" ? r : 0;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}
