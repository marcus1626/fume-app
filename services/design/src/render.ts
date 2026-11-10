// OpenPencil, the open design tool (MIT), run on the server: a layout written as design JSX becomes a real design
// document (frames, auto layout, text, an image fill) that a designer can open and change, and a PNG of it.
import { createHash } from "node:crypto";
import { SceneGraph } from "@open-pencil/scene-graph";
import { renderJSX } from "@open-pencil/core/design-jsx";
import { IORegistry, BUILTIN_IO_FORMATS, initCanvasKit } from "@open-pencil/core/io";
import { computeAllLayouts, installTextMeasurer } from "@open-pencil/core/layout";
import { SkiaRenderer } from "@open-pencil/core/canvas";
import { prepareGraphFonts, fontManager, weightToStyle } from "@open-pencil/core/text";
import type { Box, Pixels } from "./pixels.ts";

/** Where a font comes from that the renderer does not have: the brand's own files first. */
export type FontSource = (family: string, weight: number, italic: boolean) => Promise<ArrayBuffer | null>;

type CK = Awaited<ReturnType<typeof initCanvasKit>>;
let engine: Promise<{ ck: CK; renderer: SkiaRenderer; io: IORegistry }> | null = null;
let source: FontSource | null = null;

/** Starts CanvasKit once per process. Online fonts are off unless asked for: the brand's files come first. */
export function start(opts: { fonts?: FontSource; online?: boolean } = {}) {
  source = opts.fonts ?? source;
  fontManager.setOnlineFontProviders({ google: opts.online ?? false, fontsource: false, bunny: false });
  fontManager.setHostFontLoader(async (family: string, style: string) => {
    const weight = weightOf(style);
    const italic = /italic/i.test(style);
    const own = brandFaces.get(family);
    if (own) return nearestFace(own, weight, italic);
    if (!source) return null;
    return source(family, weight, italic);
  });
  engine ??= (async () => {
    const ck = await initCanvasKit();
    const renderer = new SkiaRenderer(ck, ck.MakeSurface(1, 1)!);
    await renderer.loadFonts();
    measurer = renderer;
    installTextMeasurer((node, maxWidth) => renderer.measureTextNode(node, maxWidth));
    return { ck, renderer, io: new IORegistry(BUILTIN_IO_FORMATS) };
  })();
  return engine;
}

let measurer: SkiaRenderer | null = null;

/** One of the brand's own font files: the face it holds and its bytes. */
export interface BrandFace {
  family: string;
  weight: number;
  italic: boolean;
  bytes: Uint8Array;
}

// The brand's own faces, by a family name made from the files themselves. The renderer keeps every face it has
// loaded for the life of the process, so a brand's file is never registered under its plain family name: another
// brand's book that names the same family would be set in it.
const brandFaces = new Map<string, BrandFace[]>();

function nearestFace(faces: BrandFace[], weight: number, italic: boolean): ArrayBuffer {
  const best = [...faces].sort((a, b) => Number(a.italic !== italic) - Number(b.italic !== italic) || Math.abs(a.weight - weight) - Math.abs(b.weight - weight))[0];
  return best.bytes.slice().buffer as ArrayBuffer;
}

/** Makes the brand's own files the renderer's to use; answers the family each one is set under, by its own name. */
export function useBrandFaces(faces: BrandFace[]): Map<string, string> {
  const names = new Map<string, string>();
  const byFamily = new Map<string, BrandFace[]>();
  for (const f of faces) byFamily.set(f.family, [...(byFamily.get(f.family) ?? []), f]);
  for (const [family, list] of byFamily) {
    const h = createHash("sha1");
    for (const f of list) h.update(f.bytes);
    const name = `${family} ${h.digest("hex").slice(0, 8)}`;
    brandFaces.set(name, list);
    names.set(family, name);
  }
  return names;
}

/** Each word of a text node set on one line, with its width: a word wider than its box runs out of it. */
export function wordWidths(doc: Doc, name: string): { word: string; width: number; box: number }[] {
  const id = doc.ids.get(name);
  const node = id ? doc.graph.getNode(id) : null;
  if (!measurer || !node || node.type !== "TEXT" || !node.text || !node.width) return [];
  const out: { word: string; width: number; box: number }[] = [];
  // A short word held to the next by a no-break space ("to\u00A0Grow.") is one unit the renderer cannot break between,
  // so it is measured as one (Anthem, 9 Nov: "to Gr / ow." passed as two words that each fit).
  for (const word of new Set(node.text.split(/[^\S\u00A0]+/).filter(Boolean))) {
    // Its own id, so the measure cache never answers with the whole text's width.
    const m = measurer.measureTextNode({ ...node, id: `${node.id}:word:${word}`, text: word } as typeof node, 1e6);
    if (m) out.push({ word, width: m.width, box: node.width });
  }
  return out;
}

/** A text node's whole text set on one line, with its width, for words that must stay on one line (a price). */
export function lineWidth(doc: Doc, name: string): { width: number; box: number } | null {
  const id = doc.ids.get(name);
  const node = id ? doc.graph.getNode(id) : null;
  if (!measurer || !node || node.type !== "TEXT" || !node.text || !node.width) return null;
  const m = measurer.measureTextNode({ ...node, id: `${node.id}:line`, text: node.text.replace(/\s+/g, " ").trim() } as typeof node, 1e6);
  return m ? { width: m.width, box: node.width } : null;
}

/**
 * The words in a laid-out text that are wider than its box, so the renderer broke them inside the word
 * ("FLANELLS / KJORTER"). A brand never splits a word; a layout that does is not one to use.
 */
export function splitWords(doc: Doc, name: string): string[] {
  return wordWidths(doc, name).filter((w) => w.width > w.box + 1).map((w) => w.word);
}

const loaded = new Map<string, Promise<boolean>>();
/** Whether the renderer can set words in this family and weight. */
export function hasFont(family: string, weight: number): Promise<boolean> {
  const key = `${family}|${weight}`;
  if (!loaded.has(key)) {
    loaded.set(
      key,
      fontManager
        .loadFont(family, weightToStyle(weight))
        .then((b) => b !== null && b.byteLength > 0)
        .catch(() => false),
    );
  }
  return loaded.get(key)!;
}

/** The face's capital height as a share of its size, from its OS/2 table; null when the file does not say. */
export async function capHeightOf(family: string, weight: number): Promise<number | null> {
  const file = source ? await source(family, weight, false).catch(() => null) : null;
  return file ? capOf(new DataView(file)) : null;
}

export function capOf(v: DataView): number | null {
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

export function imageHash(bytes: Uint8Array): string {
  return createHash("sha1").update(bytes).digest("hex");
}

export interface Doc {
  graph: SceneGraph;
  root: string;
  /** Node ids by name. */
  ids: Map<string, string>;
  /** Whether every font was the one asked for. */
  faithful: boolean;
  fontIssues: string[];
  warnings: string[];
}

/** Builds and lays out a design document from design JSX; PHOTO in it stands for the picture's hash. */
export async function build(jsx: string, picture: Uint8Array, logo?: { hash: string; png: Uint8Array }[]): Promise<Doc> {
  await start();
  const graph = new SceneGraph();
  const hash = imageHash(picture);
  graph.images.set(hash, picture);
  // Every version of the logo is in the document; the layout shows the one that reads best where it sits.
  for (const v of logo ?? []) graph.images.set(v.hash, v.png);
  const results = await renderJSX(graph, jsx.replaceAll("PHOTO", hash).replaceAll('"LOGO"', JSON.stringify(logo?.[0]?.hash ?? hash)));
  const root = results[0].id;
  graph.applyDerivedLayoutDuring?.(() => computeAllLayouts(graph));
  const fonts = await prepareGraphFonts(graph, [root]);
  graph.applyDerivedLayoutDuring?.(() => computeAllLayouts(graph));
  if (await slants(graph, root)) graph.applyDerivedLayoutDuring?.(() => computeAllLayouts(graph));
  const ids = new Map<string, string>();
  const walk = (id: string) => {
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
    fontIssues: ((fonts.issues ?? []) as { family: string; style: string }[]).map((f) => `${f.family} ${f.style}`),
    warnings: results.flatMap((r) => (r.warnings ?? []).map(String)).slice(0, 10),
  };
}

/**
 * A slanted button's outline, drawn once its frame has its size: one thin parallelogram, or two that cross as
 * Anthem's SHOP NOW does. The frame marks it with a "Slant <colour> <stroke> <lines>" placeholder.
 */
async function slants(graph: SceneGraph, root: string): Promise<boolean> {
  const marks: { id: string; parent: string; hex: string; stroke: number; lines: number }[] = [];
  const walk = (id: string) => {
    const n = graph.getNode(id);
    if (!n) return;
    const m = /^Slant (#[0-9A-Fa-f]{6}) (\d+(?:\.\d+)?) ([12])$/.exec(n.name ?? "");
    if (m && n.parentId) marks.push({ id, parent: n.parentId, hex: m[1], stroke: Number(m[2]), lines: Number(m[3]) });
    for (const c of graph.getChildren(id)) walk(c.id);
  };
  walk(root);
  for (const mark of marks) {
    const frame = graph.getNode(mark.parent);
    graph.deleteNode(mark.id);
    if (!frame?.width || !frame.height) continue;
    const jsx = slantJSX(frame.width, frame.height, mark.hex, mark.stroke, mark.lines);
    await renderJSX(graph, jsx, { parentId: mark.parent });
  }
  return marks.length > 0;
}

/** The outline as inline SVG over a w x h button. Its viewBox is square, as the renderer sizes inline artwork. */
export function slantJSX(w: number, h: number, hex: string, stroke: number, lines: number): string {
  const W = Math.round(w);
  const H = Math.round(h);
  const side = Math.max(W, H);
  const i = stroke / 2;
  // Two lines sit a stroke and a half apart, the second leaning less, so they cross as the brand's do.
  const off = lines === 2 ? Math.round(stroke * 1.5) : 0;
  // Measured on anthem-sports.com: the outer line leans about an eighth of the button's height.
  const lean = Math.round(H * 0.125);
  const shape = (top: number, bottom: number, k: number, shift: number) => {
    const a = (lean - k) / 2;
    return `M${r(k + a + shift + i)} ${r(top + i)} L${r(W - a + shift - i)} ${r(top + i)} L${r(W - k - a + shift - i)} ${r(bottom - i)} L${r(a + shift + i)} ${r(bottom - i)} Z`;
  };
  const paths = [shape(0, H - off, lean, 0)];
  if (lines === 2) paths.push(shape(off, H, Math.round(lean * 0.4), 0));
  const body = paths.map((d) => `<path d="${d}" fill="none" stroke="${hex}" stroke-width="${stroke}" stroke-linejoin="miter" />`).join("");
  return `<svg name="Outline" viewBox="0 0 ${side} ${side}" w={${W}} h={${H}} position="absolute" x={0} y={0} color=${JSON.stringify(hex)} body={${JSON.stringify(body)}} />`;
}

const r = (n: number) => Math.round(n * 10) / 10;

export function boxOf(doc: Doc, name: string): Box | null {
  const id = doc.ids.get(name);
  if (!id) return null;
  const r = doc.graph.getAbsoluteBounds(id);
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}

/** Moves or resizes a node, then lays the document out again. */
export function place(doc: Doc, name: string, changes: { x?: number; y?: number; width?: number; height?: number }) {
  const id = doc.ids.get(name);
  if (!id) return;
  doc.graph.updateNode(id, changes);
  doc.graph.applyDerivedLayoutDuring?.(() => computeAllLayouts(doc.graph));
}

export async function png(doc: Doc, scale = 1): Promise<Uint8Array> {
  const { io } = await start();
  const res = await io.exportContent(
    "png",
    { graph: doc.graph, target: { scope: "node", nodeId: doc.root } },
    { format: "PNG", scale },
  );
  return res.data as Uint8Array;
}

/** The design document as a .fig file a designer opens in OpenPencil (or Figma). */
export async function fig(doc: Doc): Promise<Uint8Array> {
  const { io } = await start();
  const res = await io.writeDocument("fig", doc.graph);
  return res.data as Uint8Array;
}

/** A PNG decoded to pixels. */
export async function pixelsOf(bytes: Uint8Array, scale: number): Promise<Pixels> {
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
    colorSpace: ck.ColorSpace.SRGB,
  }) as Uint8Array;
  img.delete();
  return { data, width, height, scale };
}

function weightOf(style: string): number {
  const s = style.toLowerCase();
  const table: [RegExp, number][] = [
    [/thin|hairline/, 100],
    [/extra ?light|ultra ?light/, 200],
    [/light/, 300],
    [/medium/, 500],
    [/semi ?bold|demi ?bold/, 600],
    [/extra ?bold|ultra ?bold/, 800],
    [/black|heavy/, 900],
    [/bold/, 700],
  ];
  for (const [re, w] of table) if (re.test(s)) return w;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 400;
}
