// The Design studio's layers (round 15, PROPOSED 9 Nov 2026; app/FLOWS-r15-design.md). What each layer is, how it
// looks in the brand's design system, where the words sit, and the layers of Fume's design read from what Fume laid
// out. Pure functions: the panels and the board share them, so a control always says what the canvas shows.
import type { StudioPlaceValue } from "@fume/ui";
import type {
  CreativeDocument,
  DesignBook,
  DesignComponentName,
  DesignStyleName,
  Format,
  Layer,
  RenderVersion,
  Variables,
} from "../../../contract";

/** What a layer is in the design. */
export type LayerRole = "logo" | "headline" | "subline" | "cta" | "text" | "picture" | "shade";

export function roleOf(l: Layer): LayerRole {
  if (l.kind === "image") return "picture";
  if (l.kind === "logo") return "logo";
  if (l.kind === "shape") return "shade";
  if (l.component === "cta") return "cta";
  if (l.component === "headline" || (!l.component && l.style === "headline")) return "headline";
  if (l.component === "subline" || (!l.component && l.style === "small")) return "subline";
  return "text";
}

/** A layer's name in the list, by what it is (a layer of the brand's components is named by the component). */
export const roleNames: Record<LayerRole, string> = {
  logo: "Logo",
  headline: "Headline",
  subline: "Line",
  cta: "Call to action",
  text: "Text",
  picture: "Picture",
  shade: "Shade",
};
export const layerName = (l: Layer) => (roleOf(l) === "text" ? l.name : roleNames[roleOf(l)]);

/** The frame in pixels: 1080 wide, as the design system measures. */
export const FRAME: Record<Format, [number, number]> = {
  feed: [1080, 1350],
  square: [1080, 1080],
  story: [1080, 1920],
};

/** The design system's text styles, in words. */
export const styleNames: Record<DesignStyleName, string> = {
  display: "Display",
  h1: "Heading 1",
  h2: "Heading 2",
  subline: "Subline",
  body: "Body",
  caption: "Caption",
  label: "Label",
  cta: "Call to action",
  price: "Price",
  legal: "Small print",
};

const legacyStyle: Record<NonNullable<Layer["style"]>, DesignStyleName> = {
  headline: "h1",
  body: "body",
  small: "subline",
};
const componentOf: Partial<Record<LayerRole, DesignComponentName>> = {
  headline: "headline",
  subline: "subline",
  cta: "cta",
  logo: "logo",
};

type Style = DesignBook["styles"][number];
type Typeface = DesignBook["typefaces"][number];

/** The text style a layer of words is set in: its own, else its component's, else Body. */
export function styleOf(l: Layer, book: DesignBook): Style {
  const comp = componentOf[roleOf(l)];
  const name =
    l.textStyle ??
    (l.style && !l.component ? legacyStyle[l.style] : undefined) ??
    book.components.find((c) => c.name === comp)?.style ??
    "body";
  return book.styles.find((s) => s.name === name) ?? book.styles[0]!;
}

export function typefaceOf(l: Layer, book: DesignBook): Typeface {
  const role = l.font ?? styleOf(l, book).font;
  return book.typefaces.find((t) => t.role === role) ?? book.typefaces[0]!;
}

/** A typeface as CSS: the brand's own face, its stand-in on Google Fonts, then a generic family. */
export const familyOf = (t: Typeface) =>
  `"${t.family}", "${t.fallback}", ${t.role === "display" ? "Georgia, serif" : "system-ui, sans-serif"}`;

/** How a layer of words is set: what its properties say, else its style's. */
export function typeOf(l: Layer, book: DesignBook) {
  const s = styleOf(l, book);
  const t = typefaceOf(l, book);
  return {
    style: s.name,
    typeface: t,
    family: familyOf(t),
    sizePx: l.sizePx ?? s.sizePx,
    weight: l.weight ?? s.weight,
    lineHeight: s.lineHeight,
    trackingEm: s.trackingEm,
    upper: s.case === "upper",
  };
}

const hexOf = (book: DesignBook, role: string) => book.colours.find((c) => c.role === role)?.hex;

/** The design system's colours words may take, once each (never its accent, rules or hairlines). */
export function wordColours(book: DesignBook): { name: string; hex: string }[] {
  const roles = ["text", "primary", "secondary", "text_muted", "on_photo", "on_primary", "background", "cta_text"];
  const out: { name: string; hex: string }[] = [];
  for (const role of roles)
    for (const c of book.colours.filter((x) => x.role === role))
      if (!out.some((o) => o.hex.toLowerCase() === c.hex.toLowerCase())) out.push({ name: c.name, hex: c.hex });
  return out;
}

/** The colour a layer of words is drawn in: its own, else the frame's words colour, else the design system's. */
export function inkOf(l: Layer, book: DesignBook | undefined, variables: Variables): string | undefined {
  if (roleOf(l) === "cta") return book ? hexOf(book, componentColour(book, "cta")) : undefined;
  if (l.colour) return l.colour;
  if (typeof variables.textColour === "string") return variables.textColour;
  return book ? hexOf(book, "text") : undefined;
}
const componentColour = (book: DesignBook, name: DesignComponentName) =>
  book.components.find((c) => c.name === name)?.colour ?? "text";

/** The call to action as the design system draws it: its pill, its corners and its padding. */
export function ctaOf(book: DesignBook) {
  const c = book.components.find((x) => x.name === "cta");
  return {
    component: c,
    fill: c?.background ? hexOf(book, c.background) : undefined,
    ink: c ? hexOf(book, c.colour) : undefined,
    radiusPx: c ? book.radiusPx[c.radius] : 0,
    paddingPx: c?.paddingPx ?? 0,
  };
}

/** The logo's versions; the reversed one is drawn in the light colour, the others in the brand's dark. */
export const logoVersions = (book: DesignBook) => book.logo.versions;
export function logoInk(l: Layer, book: DesignBook | undefined): string | undefined {
  if (!book) return undefined;
  const v = l.variant ?? book.logo.versions[0]?.name ?? "";
  return /revers/i.test(v) ? hexOf(book, "on_primary") : hexOf(book, componentColour(book, "logo"));
}

// ─── Where the words sit ─────────────────────────────────────────────────────

/** About as many lines as the words take in their width (as the design service measures them). */
function linesOf(text: string, widthPx: number, sizePx: number, serif: boolean) {
  return Math.max(1, Math.ceil(text.length / (widthPx / (sizePx * (serif ? 0.46 : 0.52)))));
}

/** A layer's height, 0–1 of the frame: words by their lines, the call to action by its pill, the logo by its mark. */
export function heightOf(l: Layer, book: DesignBook | undefined, format: Format): number {
  const [W, H] = FRAME[format];
  const role = roleOf(l);
  if (!book || role === "picture" || role === "shade") return l.h;
  if (role === "logo") return (l.w * W * 0.24) / H;
  const t = typeOf(l, book);
  if (role === "cta") return (t.sizePx * t.lineHeight + 2 * ctaOf(book).paddingPx) / H;
  const lines = linesOf(l.text ?? "", l.w * W, t.sizePx, t.typeface.role === "display");
  return (lines * t.sizePx * t.lineHeight) / H;
}

const isWords = (l: Layer) => ["headline", "subline", "text"].includes(roleOf(l));

/** The block of words (the headline and the lines with it; the call to action and the logo sit on their own). */
export function wordBlock(layers: Layer[], book: DesignBook | undefined, format: Format) {
  const words = layers.filter((l) => l.visible && isWords(l));
  if (!words.length) return undefined;
  const top = Math.min(...words.map((l) => l.y));
  const bottom = Math.max(...words.map((l) => l.y + heightOf(l, book, format)));
  return { words, top, bottom };
}

export type Band = "top" | "centre" | "bottom";

/** Where the block of words sits, read from the canvas: the top, the middle or the foot of the frame. */
export function bandOf(layers: Layer[], book: DesignBook | undefined, format: Format): Band | undefined {
  const b = wordBlock(layers, book, format);
  if (!b) return undefined;
  const middle = (b.top + b.bottom) / 2;
  return middle < 0.4 ? "top" : middle > 0.6 ? "bottom" : "centre";
}

/** The block of words moved to the top, the middle or the foot, inside the design system's safe area. It keeps clear
 *  of a shown logo or call to action in that band, and the shade turns to come from the side the words are on. */
export function moveBlock(layers: Layer[], to: Band, book: DesignBook | undefined, format: Format): Layer[] {
  const b = wordBlock(layers, book, format);
  if (!b) return layers;
  const [, H] = FRAME[format];
  const grid = book?.formats.find((f) => f.format === format);
  const safeTop = grid ? grid.safeTopPx / H : 0.07;
  const safeBottom = grid ? grid.safeBottomPx / H : 0.07;
  const gap = 24 / H;
  const height = b.bottom - b.top;
  // A logo or a call to action already in the band the words go to: the words sit above (or below) it
  const marks = layers
    .filter((l) => l.visible && ["logo", "cta"].includes(roleOf(l)))
    .map((l) => ({ top: l.y, bottom: l.y + heightOf(l, book, format) }));
  const floor = Math.min(1 - safeBottom, ...marks.filter((m) => m.top > 0.5).map((m) => m.top - gap));
  const ceiling = Math.max(safeTop, ...marks.filter((m) => m.bottom < 0.5).map((m) => m.bottom + gap));
  const top = to === "top" ? ceiling : to === "bottom" ? floor - height : (1 - height) / 2;
  const by = top - b.top;
  return layers.map((l) =>
    b.words.includes(l)
      ? { ...l, y: round(l.y + by) }
      : roleOf(l) === "shade" && l.shade && to !== "centre"
        ? { ...l, shade: { ...l.shade, from: to } }
        : l,
  );
}

const round = (n: number) => Math.round(n * 10000) / 10000;

// ─── Fume's design as layers ─────────────────────────────────────────────────

const LOGO_AT: Record<string, { x: number; y: number }> = {
  top_left: { x: 0, y: 0 },
  top_centre: { x: 0.5, y: 0 },
  top_right: { x: 1, y: 0 },
  bottom_left: { x: 0, y: 1 },
  bottom_centre: { x: 0.5, y: 1 },
  bottom_right: { x: 1, y: 1 },
};

/** The layers of a version Fume designed, top of the stack last: the picture under it, the shade, the call to
 *  action, the line, the headline and the logo. What Fume left out is there, hidden: the call to action where the
 *  design system keeps it off the format, the logo where the label shows the name. */
export function designedLayers(v: RenderVersion, book: DesignBook | undefined, format: Format): Layer[] {
  const d = v.design!;
  const [W, H] = FRAME[format];
  const id = (part: string) => `${v.id}-${part}`;
  const drawn = v.drawn;
  const at = (role: "headline" | "subline" | "cta") => drawn?.layers.find((l) => l.role === role);
  const grid = book?.formats.find((f) => f.format === format);
  const margin = (grid?.marginPx ?? 72) / W;
  const out: Layer[] = [
    {
      id: id("picture"),
      kind: "image",
      name: "Picture",
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      visible: true,
      locked: true,
      fit: "fill",
    },
  ];
  if (drawn?.shade)
    out.push({
      id: id("shade"),
      kind: "shape",
      name: "Shade",
      x: 0,
      y: drawn.shade.from === "top" ? 0 : 0.55,
      w: 1,
      h: 0.45,
      visible: true,
      locked: true,
      shade: drawn.shade,
    });
  const words = (
    role: "headline" | "subline" | "cta",
    text: string | undefined,
    fallbackY: number,
  ): Layer | undefined => {
    if (!text) return undefined;
    const l = at(role);
    const layer: Layer = {
      id: id(role),
      kind: "text",
      name: roleNames[role],
      component: role,
      // The plain style too, for where the words are drawn without the design system (Check's edit).
      style: role === "headline" ? "headline" : role === "subline" ? "small" : "body",
      text: l?.text ?? text,
      x: l ? l.x / 100 : margin,
      y: l ? l.y / 100 : fallbackY,
      w: l ? l.w / 100 : 1 - 2 * margin,
      h: 0,
      align: l?.align ?? d.layout?.align ?? "left",
      ...(l && role !== "cta" ? { colour: l.colour } : {}),
      visible: Boolean(l) || !drawn,
    };
    return { ...layer, h: heightOf(layer, book, format) };
  };
  const foot = 1 - (grid?.safeBottomPx ?? 96) / H;
  const cta = words("cta", d.words?.cta, foot - 0.06);
  if (cta) out.push(cta);
  const top = d.layout?.band === "bottom" ? 0.62 : (grid?.safeTopPx ?? 72) / H;
  const sub = words("subline", d.words?.subline, top + 0.14);
  if (sub) out.push(sub);
  const head = words("headline", d.words?.headline, top);
  if (head) out.push(head);
  // The logo: where the design system places it on this format, as wide as it says; hidden, since Fume adds it only
  // where the label does not show the name.
  const place = book?.logo.placements.find((p) => p.format === format);
  const w = (place?.widthPct ?? 20) / 100;
  const spot = LOGO_AT[place?.where ?? "top_left"]!;
  const h = (w * W * 0.24) / H;
  out.push({
    id: id("logo"),
    kind: "logo",
    name: "Logo",
    component: "logo",
    x: round(spot.x === 0 ? margin : spot.x === 1 ? 1 - margin - w : (1 - w) / 2),
    y: round(spot.y === 0 ? (grid?.safeTopPx ?? 72) / H : foot - h),
    w,
    h,
    variant:
      d.layout?.colour === "on_photo" ? book?.logo.versions.find((x) => /revers/i.test(x.name))?.name : undefined,
    visible: false,
  });
  return out;
}

/** The layers the Design studio shows for the version on the board, and how a change to them is kept: Fume's design
 *  is read from what Fume laid out until the first change, then kept with the version it belongs to; a layout made
 *  by hand is the document's own layers. */
export function layersOn(
  doc: Pick<CreativeDocument, "studio">,
  all: Layer[],
  shown: RenderVersion | undefined,
  book: DesignBook | undefined,
  format: Format,
): { layers: Layer[]; design?: RenderVersion; write: (next: Layer[]) => Layer[] } {
  const design = doc.studio === "design" && shown?.design ? shown : undefined;
  if (design) {
    const own = all.filter((l) => l.belongsTo === design.id);
    const layers = own.length ? own : design.state === "done" ? designedLayers(design, book, format) : [];
    return {
      layers,
      design,
      write: (next) => [
        ...all.filter((l) => l.belongsTo !== design.id),
        ...next.map((l) => ({ ...l, belongsTo: design.id })),
      ],
    };
  }
  return {
    layers: all.filter((l) => !l.belongsTo),
    write: (next) => [...all.filter((l) => l.belongsTo), ...next],
  };
}

/** A position in pixels of the frame, and back. */
export const toPx = (n: number, of: number) => Math.round(n * of);
export const fromPx = (px: number, of: number) => round(px / of);

// ─── Places, the layout grid and snapping (round 16, PROPOSED 9 Nov 2026) ─────
// Marcus: "Align as a box grid with different places" and "a grid to align things, on and off, with templates for
// each aspect ratio or custom values". The safe area is the design system's: its margin on the sides, its safe
// zones at the top and the foot.

export type Place = StudioPlaceValue;
type Side = "left" | "centre" | "right";
type Row = "top" | "middle" | "bottom";

/** The design system's safe area for a format, 0–1 of the frame. */
export function safeArea(book: DesignBook | undefined, format: Format) {
  const [W, H] = FRAME[format];
  const g = book?.formats.find((f) => f.format === format);
  return {
    left: (g?.marginPx ?? 72) / W,
    right: 1 - (g?.marginPx ?? 72) / W,
    top: (g?.safeTopPx ?? 72) / H,
    bottom: 1 - (g?.safeBottomPx ?? 96) / H,
  };
}

/** Where a box sits among the nine places of the safe area; none when it is between them. */
function placeOfBox(box: { x: number; y: number; w: number; h: number }, book: DesignBook | undefined, format: Format) {
  const [W, H] = FRAME[format];
  const s = safeArea(book, format);
  const tx = 12 / W;
  const ty = 12 / H;
  const side: Side | undefined =
    Math.abs(box.x - s.left) < tx
      ? "left"
      : Math.abs(box.x + box.w - s.right) < tx
        ? "right"
        : Math.abs(box.x + box.w / 2 - 0.5) < tx
          ? "centre"
          : undefined;
  const row: Row | undefined =
    Math.abs(box.y - s.top) < ty
      ? "top"
      : Math.abs(box.y + box.h - s.bottom) < ty
        ? "bottom"
        : Math.abs(box.y + box.h / 2 - 0.5) < ty
          ? "middle"
          : undefined;
  return side && row ? (`${row}-${side}` as Place) : undefined;
}

/** A layer's place in the frame, read from where it is drawn. */
export function placeOf(l: Layer, book: DesignBook | undefined, format: Format): Place | undefined {
  return placeOfBox({ x: l.x, y: l.y, w: l.w, h: heightOf(l, book, format) }, book, format);
}

/** The box moved to a place in the safe area. */
function boxAt(place: Place, w: number, h: number, book: DesignBook | undefined, format: Format) {
  const s = safeArea(book, format);
  const [row, side] = place.split("-") as [Row, Side];
  const x = side === "left" ? s.left : side === "right" ? s.right - w : (1 - w) / 2;
  const y = row === "top" ? s.top : row === "bottom" ? s.bottom - h : (1 - h) / 2;
  return { x: round(x), y: round(y), side };
}

/** One layer to a place. Words take the alignment of their side, as a designer sets a headline in a corner. */
export function placeLayer(layers: Layer[], id: string, place: Place, book: DesignBook | undefined, format: Format) {
  return layers.map((l) => {
    if (l.id !== id) return l;
    const { x, y, side } = boxAt(place, l.w, heightOf(l, book, format), book, format);
    return { ...l, x, y, ...(isWords(l) ? { align: side } : {}) };
  });
}

/** Where the block of words sits among the nine places. */
export function blockPlaceOf(layers: Layer[], book: DesignBook | undefined, format: Format): Place | undefined {
  const b = wordBlock(layers, book, format);
  if (!b) return undefined;
  const x = Math.min(...b.words.map((l) => l.x));
  const right = Math.max(...b.words.map((l) => l.x + l.w));
  return placeOfBox({ x, y: b.top, w: right - x, h: b.bottom - b.top }, book, format);
}

/** The block of words to a place: up and down as moveBlock (clear of the logo and the call to action, the shade
 *  following), across to its side, each line set to that side. */
export function placeBlock(layers: Layer[], place: Place, book: DesignBook | undefined, format: Format): Layer[] {
  const [row, side] = place.split("-") as [Row, Side];
  const moved = moveBlock(layers, row === "middle" ? "centre" : row, book, format);
  const s = safeArea(book, format);
  return moved.map((l) => {
    if (!l.visible || !isWords(l)) return l;
    const x = side === "left" ? s.left : side === "right" ? s.right - l.w : (1 - l.w) / 2;
    return { ...l, x: round(x), align: side };
  });
}

/** A layout grid: columns and rows inside a margin, in pixels of the frame. Rows 0 is columns only. */
export interface LayoutGrid {
  columns: number;
  rows: number;
  gutterPx: number;
  marginPx: number;
}

export interface GridTemplate {
  id: string;
  name: string;
  /** What it is, in a few words ("6 columns · 24 gutter"). */
  meta: string;
  grid: LayoutGrid;
}

const gridWords = (g: LayoutGrid) =>
  [
    g.columns && `${g.columns} columns`,
    g.rows && `${g.rows} rows`,
    g.gutterPx && `${g.gutterPx} gutter`,
    g.marginPx && `${g.marginPx} margin`,
  ]
    .filter(Boolean)
    .join(" · ");

/** The grids that fit this format: the brand's own first (its design system's columns for the ratio), then the
 *  thirds, and the common column grids at the brand's margin. */
export function gridTemplates(book: DesignBook | undefined, format: Format, brandName: string): GridTemplate[] {
  const g = book?.formats.find((f) => f.format === format);
  const margin = g?.marginPx ?? 72;
  const gutter = g?.gutterPx ?? 24;
  const ratio = { feed: "4:5", square: "1:1", story: "9:16" }[format];
  const list: GridTemplate[] = [];
  if (g) {
    const grid = { columns: g.columns, rows: 0, gutterPx: g.gutterPx, marginPx: g.marginPx };
    list.push({ id: "brand", name: `${brandName}’s grid · ${ratio}`, meta: gridWords(grid), grid });
  }
  const thirds = { columns: 3, rows: 3, gutterPx: 0, marginPx: 0 };
  list.push({ id: "thirds", name: "Thirds", meta: "3 × 3, the whole frame", grid: thirds });
  for (const columns of format === "story" ? [4, 6] : [4, 12]) {
    const grid = { columns, rows: 0, gutterPx: gutter, marginPx: margin };
    list.push({ id: `cols-${columns}`, name: `${columns} columns · ${ratio}`, meta: gridWords(grid), grid });
  }
  return list;
}

/** The creative's grid: a template's, or the values set by hand ("custom"), kept in its variables. */
export function gridOf(variables: Variables, book: DesignBook | undefined, format: Format, brandName: string) {
  const templates = gridTemplates(book, format, brandName);
  const id = typeof variables.grid === "string" ? variables.grid : (templates[0]?.id ?? "thirds");
  if (id === "custom" && typeof variables.gridCustom === "string") {
    const [columns = 6, rows = 0, gutterPx = 24, marginPx = 72] = variables.gridCustom.split(",").map(Number);
    return { id, name: "Custom", grid: { columns, rows, gutterPx, marginPx }, templates };
  }
  const t = templates.find((x) => x.id === id) ?? templates[0]!;
  return { id: t.id, name: t.name, grid: t.grid, templates };
}

export const gridValue = (g: LayoutGrid) => [g.columns, g.rows, g.gutterPx, g.marginPx].join(",");

/** The grid's tracks, 0–1 of the frame: each column's left and right, each row's top and bottom. */
export function gridTracks(g: LayoutGrid, format: Format) {
  const [W, H] = FRAME[format];
  const track = (n: number, size: number) => {
    if (!n) return [];
    const inner = size - 2 * g.marginPx - (n - 1) * g.gutterPx;
    const each = inner / n;
    return Array.from({ length: n }, (_, i) => {
      const start = g.marginPx + i * (each + g.gutterPx);
      return { start: start / size, end: (start + each) / size };
    });
  };
  return { columns: track(g.columns, W), rows: track(g.rows, H) };
}

/** Lines a dragged box snaps to, 0–1 of the frame: the grid's edges, the safe area and the frame's middle. */
export function snapLines(g: LayoutGrid | undefined, book: DesignBook | undefined, format: Format) {
  const s = safeArea(book, format);
  const xs = new Set<number>([0.5, s.left, s.right]);
  const ys = new Set<number>([0.5, s.top, s.bottom]);
  if (g) {
    const t = gridTracks(g, format);
    for (const c of t.columns) {
      xs.add(c.start);
      xs.add(c.end);
    }
    for (const r of t.rows) {
      ys.add(r.start);
      ys.add(r.end);
    }
  }
  return { xs: [...xs], ys: [...ys] };
}

/** A box's start snapped to the nearest line by its start, middle or end, within 8 px of the frame. */
export function snapAxis(start: number, size: number, lines: number[], px: number) {
  const reach = 8 / px;
  let best: { by: number; line: number } | undefined;
  for (const line of lines)
    for (const at of [start, start + size / 2, start + size]) {
      const by = line - at;
      if (Math.abs(by) <= reach && (!best || Math.abs(by) < Math.abs(best.by))) best = { by, line };
    }
  return best ? { at: round(start + best.by), line: best.line } : { at: round(start), line: undefined };
}
