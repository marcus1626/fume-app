// The brand's logo on the creative (docs/mvp/design-layer.md, "On brand"): the file the brand's design system names,
// an SVG from the brand's own site header or a picture from its Brand DNA. A one-colour logo can be set light or
// dark, as brands do with a positive and a reversed version; a logo in several colours is set as it is. Where it
// goes is the brand's own layout's corner when its creatives show one, else a calm corner away from the words.
import { SceneGraph } from "@open-pencil/scene-graph";
import { renderJSX } from "@open-pencil/core/design-jsx";
import { createSVGNodes } from "@open-pencil/core/io";
import { imageHash, png as pngOf, start } from "./render.ts";
import { luminance } from "./pixels.ts";

export type Where = "top_left" | "top_centre" | "top_right" | "bottom_left" | "bottom_centre" | "bottom_right";
export const CORNERS: Where[] = ["top_left", "top_right", "bottom_left", "bottom_right", "top_centre", "bottom_centre"];

export interface LogoVariant {
  /** As the brand drew it, or set in one colour. */
  name: "as_is" | "light" | "dark";
  png: Uint8Array;
  hash: string;
  /** The colour the eye reads, for contrast. */
  hex: string;
}

export interface Logo {
  width: number;
  height: number;
  mono: boolean;
  variants: LogoVariant[];
}

const MAX = 1200;

/** The logo as pictures the renderer can set: rasterised when it is an SVG, with light and dark versions when it is one colour. */
export async function logoOf(bytes: Uint8Array, light: string, dark: string): Promise<Logo | null> {
  const { ck } = await start();
  const raster = isSvg(bytes) ? await rasterise(new TextDecoder().decode(bytes)) : bytes;
  if (!raster) return null;
  const img = ck.MakeImageFromEncoded(raster);
  if (!img) return null;
  const width = img.width();
  const height = img.height();
  const info = { width, height, colorType: ck.ColorType.RGBA_8888, alphaType: ck.AlphaType.Unpremul, colorSpace: ck.ColorSpace.SRGB };
  const data = img.readPixels(0, 0, info) as Uint8Array;
  img.delete();
  if (!data || width < 8 || height < 8) return null;
  const t = tone(data);
  if (!t) return null;
  const encode = (px: Uint8Array) => {
    const im = ck.MakeImage(info, px, width * 4);
    const out = im?.encodeToBytes() ?? null;
    im?.delete();
    return out;
  };
  const asIs = encode(data) ?? raster;
  const variants: LogoVariant[] = [{ name: "as_is", png: asIs, hash: imageHash(asIs), hex: t.hex }];
  // A one-colour logo is set light or dark as brands do; a logo in colours gets a one-colour version too, for a
  // ground it cannot be read on as drawn (the brand's own reversed logo is better, and the expert is told).
  {
    for (const [name, hex] of [["light", light], ["dark", dark]] as const) {
      const png = encode(tint(data, hex));
      if (png) variants.push({ name, png, hash: imageHash(png), hex });
    }
  }
  return { width, height, mono: t.mono, variants };
}

export function isSvg(bytes: Uint8Array): boolean {
  const head = new TextDecoder().decode(bytes.subarray(0, 512)).trimStart().toLowerCase();
  return head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"));
}

/** An SVG drawn by OpenPencil at a size a creative needs. */
async function rasterise(svg: string): Promise<Uint8Array | null> {
  if (svg.length > 400_000) return null;
  const graph = new SceneGraph();
  const [root] = await renderJSX(graph, `<Frame name="Logo" w={10} h={10} />`);
  const node = createSVGNodes(graph, root.id, svg, { name: "Logo", x: 0, y: 0 });
  if (!node || !node.width || !node.height) return null;
  // The import gives the SVG's frame a white fill; a logo has no ground of its own.
  graph.updateNode(node.id, { fills: [] as never });
  const scale = Math.min(8, MAX / Math.max(node.width, node.height));
  return pngOf({ graph, root: node.id, ids: new Map(), faithful: true, fontIssues: [], warnings: [] }, scale);
}

/** The colour of the logo's drawn pixels, and whether it is one colour. */
export function tone(px: Uint8Array): { hex: string; mono: boolean } | null {
  let n = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  const lums: number[] = [];
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
  // A logo with a background of its own (a filled box) is not one colour: it is set as it is.
  const covered = n / (px.length / 16);
  return { hex, mono: spread < 0.06 && covered < 0.9 };
}

function tint(px: Uint8Array, hex: string): Uint8Array {
  const n = parseInt(hex.replace("#", ""), 16);
  const out = new Uint8Array(px.length);
  for (let i = 0; i < px.length; i += 4) {
    out[i] = (n >> 16) & 255;
    out[i + 1] = (n >> 8) & 255;
    out[i + 2] = n & 255;
    out[i + 3] = px[i + 3];
  }
  return out;
}

/** The corners to try: the brand's own first, then the ones away from the words. */
export function cornersFor(first: Where | null, band: "top" | "middle" | "bottom", align: "left" | "center" | "right"): Where[] {
  const side = align === "center" ? "centre" : align;
  const away = band === "top" ? "bottom" : "top";
  const near = band === "top" ? "top" : "bottom";
  const order: Where[] = [
    ...(first ? [first] : []),
    `${away}_${side}` as Where,
    `${away}_left`,
    `${away}_right`,
    ...(align !== "left" ? [`${near}_left` as Where] : []),
    ...(align !== "right" ? [`${near}_right` as Where] : []),
    `${away}_centre`,
  ];
  return [...new Set(order)];
}
