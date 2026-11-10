// The picture as numbers: what lies under a box of words, measured the way WCAG measures contrast.

export interface Pixels {
  /** RGBA, unpremultiplied, row by row. */
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
  /** Pixels per layout pixel (0.25 means one pixel here is four in the layout). */
  scale: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * A shade laid over the picture from one edge: the colour at `from` opacity from the edge to `full`, fading to
 * nothing at `zero`. Or a flat panel: the colour at full opacity inside `box`.
 */
export interface Shade {
  hex: string;
  from: number;
  /** The edge the shade is darkest at. Left and right shade the words set in the middle, beside what the picture shows. */
  edge: "top" | "bottom" | "left" | "right";
  full: number;
  zero: number;
  box?: Box;
}

/** The shade's opacity at a place in the layout: its height, or for a shade from the side, its distance across. */
export function shadeAt(s: Shade, y: number, x = 0): number {
  if (s.edge === "left" || s.edge === "right") return shadeAt({ ...s, edge: s.edge === "left" ? "top" : "bottom" }, x);
  if (s.edge === "top") {
    if (y <= s.full) return s.from;
    if (y >= s.zero) return 0;
    return s.from * (1 - (y - s.full) / (s.zero - s.full));
  }
  if (y >= s.full) return s.from;
  if (y <= s.zero) return 0;
  return s.from * ((y - s.zero) / (s.full - s.zero));
}

const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const LIN = Array.from({ length: 256 }, (_, i) => lin(i));

export function rgbOf(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function luminance(r: number, g: number, b: number): number {
  return 0.2126 * LIN[r] + 0.7152 * LIN[g] + 0.0722 * LIN[b];
}

export function contrast(l1: number, l2: number): number {
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** The colour of one picture pixel once the shades are laid over it. */
function shaded(r: number, g: number, b: number, y: number, x: number, shades: Shade[]): [number, number, number] {
  for (const s of shades) {
    let a = 0;
    if (s.box) {
      if (x >= s.box.x && x < s.box.x + s.box.w && y >= s.box.y && y < s.box.y + s.box.h) a = 1;
    } else {
      a = shadeAt(s, y, x);
    }
    if (a <= 0) continue;
    const [sr, sg, sb] = rgbOf(s.hex);
    r = Math.round(r * (1 - a) + sr * a);
    g = Math.round(g * (1 - a) + sg * a);
    b = Math.round(b * (1 - a) + sb * a);
  }
  return [r, g, b];
}

export interface Under {
  /** The contrast nine in ten of the pixels under the words reach. */
  contrast: number;
  /** The contrast of the words against the mean of what lies under them. */
  meanContrast: number;
  /** How busy it is: the spread of luminance (0 calm to about 0.5 very busy). */
  busy: number;
  /** The mean luminance under the words. */
  luminance: number;
  /** The share of pixels where the words all but vanish (under 2:1), such as a lamp or a highlight. */
  poor: number;
  /** The contrast against the worst patch under the words, a patch about half a letter high. */
  worst: number;
}

/** What lies under a box of words in a colour, with the shades laid over the picture. */
export function under(p: Pixels, box: Box, textHex: string, shades: Shade[] = [], patch = 24): Under {
  const [tr, tg, tb] = rgbOf(textHex);
  const lt = luminance(tr, tg, tb);
  const x0 = Math.max(0, Math.floor(box.x * p.scale));
  const y0 = Math.max(0, Math.floor(box.y * p.scale));
  const x1 = Math.min(p.width, Math.ceil((box.x + box.w) * p.scale));
  const y1 = Math.min(p.height, Math.ceil((box.y + box.h) * p.scale));
  const ratios: number[] = [];
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
    if (cells[c + 1] >= (cell * cell) / 2) worst = Math.min(worst, contrast(lt, cells[c] / cells[c + 1]));
  }
  ratios.sort((a, b) => a - b);
  const mean = sum / n;
  let poor = 0;
  while (poor < n && ratios[poor] < 2) poor++;
  return {
    contrast: round(ratios[Math.floor(n * 0.1)]),
    meanContrast: round(contrast(lt, mean)),
    busy: round(Math.sqrt(Math.max(0, sum2 / n - mean * mean))),
    luminance: round(mean),
    poor: round(poor / n),
    worst: round(worst),
  };
}

/** How much of box a lies inside box b, from 0 to 1. */
export function overlap(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / Math.max(1, a.w * a.h);
}

const round = (n: number) => Math.round(n * 100) / 100;
