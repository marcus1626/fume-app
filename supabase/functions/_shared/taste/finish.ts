// What Fume measures in a picture at viewing size, without a model: grain by tone, the black and white points, the
// tint of shadows and highlights, how much of the frame is sharp, glow around highlights, where the calm areas and the
// lines are. measure.ts reads the picture made small (256 px), which erases grain and fine sharpness; these numbers
// need the fine detail. The same picture always gives the same numbers.
//
// Grain and sharpness are read at one size (VIEW px on the long side), because they are numbers per pixel: the same
// photograph delivered at 18 megapixels and at 4 would otherwise measure as two different finishes, and a brand's own
// pictures could not be held against the Engine's. A picture delivered smaller than SMALLEST has no finish to read (a
// screenshot of an ad in a feed): its grain and sharpness are left unmeasured.
import { lab, type Pixels, shrink } from "../../taste-learn/measure.ts";

/** The long side grain and sharpness are read at, and the smallest picture they are read of. */
export const VIEW = 1536;
export const SMALLEST = 1000;

/** The picture at exactly `long` px on its long side, each new pixel the mean of the area it covers. Never made larger. */
export function resizeTo(px: Pixels, long: number): Pixels {
  const scale = Math.max(px.width, px.height) / long;
  if (scale <= 1) return px;
  const w = Math.max(1, Math.round(px.width / scale)), h = Math.max(1, Math.round(px.height / scale));
  // Across, then down: each pass weighs every old pixel by how much of the new one it covers.
  const pass = (src: Float32Array, sw: number, sh: number, dw: number): Float32Array => {
    const out = new Float32Array(dw * sh * 3), k = sw / dw;
    for (let x = 0; x < dw; x++) {
      const from = x * k, to = Math.min(sw, (x + 1) * k);
      for (let y = 0; y < sh; y++) {
        let r = 0, g = 0, b = 0;
        for (let sx = Math.floor(from); sx < to; sx++) {
          const weight = Math.min(sx + 1, to) - Math.max(sx, from), i = (y * sw + sx) * 3;
          r += src[i]! * weight;
          g += src[i + 1]! * weight;
          b += src[i + 2]! * weight;
        }
        const o = (y * dw + x) * 3, all = to - from;
        out[o] = r / all;
        out[o + 1] = g / all;
        out[o + 2] = b / all;
      }
    }
    return out;
  };
  const turn = (src: Float32Array, sw: number, sh: number): Float32Array => {
    const out = new Float32Array(src.length);
    for (let y = 0; y < sh; y++)
      for (let x = 0; x < sw; x++) {
        const i = (y * sw + x) * 3, o = (x * sh + y) * 3;
        out[o] = src[i]!;
        out[o + 1] = src[i + 1]!;
        out[o + 2] = src[i + 2]!;
      }
    return out;
  };
  const rgb = new Float32Array(px.width * px.height * 3);
  for (let i = 0; i < px.width * px.height; i++) {
    rgb[i * 3] = px.data[i * 4]!;
    rgb[i * 3 + 1] = px.data[i * 4 + 1]!;
    rgb[i * 3 + 2] = px.data[i * 4 + 2]!;
  }
  const across = pass(rgb, px.width, px.height, w);
  // Down is across on the picture turned on its side.
  const down = turn(pass(turn(across, w, px.height), px.height, w, h), h, w);
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = Math.round(down[i * 3]!);
    data[i * 4 + 1] = Math.round(down[i * 3 + 1]!);
    data[i * 4 + 2] = Math.round(down[i * 3 + 2]!);
    data[i * 4 + 3] = 255;
  }
  return { width: w, height: h, data };
}

const round = (x: number, d = 3) => (Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : 0);
const quantile = (sorted: Float32Array, q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))] ?? 0;
const mean = (x: ArrayLike<number>) => {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i]!;
  return x.length ? s / x.length : 0;
};

type Planes = { w: number; h: number; L: Float32Array; A: Float32Array; B: Float32Array; C: Float32Array };
function planes(px: Pixels): Planes {
  const n = px.width * px.height;
  const L = new Float32Array(n), A = new Float32Array(n), B = new Float32Array(n), C = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const [l, a, b] = lab(px.data[i * 4]!, px.data[i * 4 + 1]!, px.data[i * 4 + 2]!);
    L[i] = l;
    A[i] = a;
    B[i] = b;
    C[i] = Math.hypot(a, b);
  }
  return { w: px.width, h: px.height, L, A, B, C };
}

/** A square of the picture at its own size. */
function patch(px: Pixels, x0: number, y0: number, size: number): Planes {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    const from = ((y0 + y) * px.width + x0) * 4;
    data.set(px.data.subarray(from, from + size * 4), y * size * 4);
  }
  return planes({ width: size, height: size, data });
}

/** Noise in a plane by Immerkær's estimator: what is left when a smooth picture is taken away. */
function noise(v: Float32Array, w: number, h: number): number {
  let s = 0;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      s += Math.abs(
        v[i - w - 1]! - 2 * v[i - w]! + v[i - w + 1]! - 2 * v[i - 1]! + 4 * v[i]! - 2 * v[i + 1]! + v[i + w - 1]! - 2 * v[i + w]! + v[i + w + 1]!,
      );
    }
  return (Math.sqrt(Math.PI / 2) * s) / (6 * (w - 2) * (h - 2));
}

/** Gradient size and direction per pixel (Sobel). */
function gradients(L: Float32Array, w: number, h: number) {
  const mag = new Float32Array(w * h), gx = new Float32Array(w * h), gy = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const dx = L[i - w + 1]! + 2 * L[i + 1]! + L[i + w + 1]! - L[i - w - 1]! - 2 * L[i - 1]! - L[i + w - 1]!;
      const dy = L[i + w - 1]! + 2 * L[i + w]! + L[i + w + 1]! - L[i - w - 1]! - 2 * L[i - w]! - L[i - w + 1]!;
      gx[i] = dx;
      gy[i] = dy;
      mag[i] = Math.hypot(dx, dy) / 8;
    }
  return { mag, gx, gy };
}

function laplacianVariance(L: Float32Array, w: number, h: number): number {
  let s = 0, s2 = 0, n = 0;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = L[i - w]! + L[i + w]! + L[i - 1]! + L[i + 1]! - 4 * L[i]!;
      s += v;
      s2 += v * v;
      n++;
    }
  return n ? s2 / n - (s / n) ** 2 : 0;
}

/** A mean over squares of side 2r+1, by a summed-area table. */
function boxBlur(v: Float32Array, w: number, h: number, r: number): Float32Array {
  const sat = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += v[y * w + x]!;
      sat[(y + 1) * (w + 1) + x + 1] = sat[y * (w + 1) + x + 1]! + row;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1), y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
      out[y * w + x] = (sat[y1 * (w + 1) + x1]! - sat[y0 * (w + 1) + x1]! - sat[y1 * (w + 1) + x0]! + sat[y0 * (w + 1) + x0]!) / ((x1 - x0) * (y1 - y0));
    }
  return out;
}

const PATCH = 96;
const GRID = 7;

/** The numbers of schema.ts that need the picture's fine detail. Keys are the schema's. */
export function measureFinish(delivered: Pixels, palette: { hex: string; share: number }[] = []): Record<string, number> {
  const v: Record<string, number> = {};
  v["format.megapixels"] = round((delivered.width * delivered.height) / 1e6, 2);
  // Too small to have a finish: grain and sharpness stay unmeasured (-1; profile.ts leaves such a value out).
  const fine = Math.max(delivered.width, delivered.height) >= SMALLEST;
  const px = resizeTo(delivered, VIEW);

  // ── At viewing size: grain and sharpness ──
  const size = Math.min(PATCH, Math.floor(Math.min(px.width, px.height) / 2));
  const cells: { cx: number; cy: number; flat: number; sharp: number; l: number; nL: number; nC: number }[] = [];
  if (size >= 24)
    for (let gy = 0; gy < GRID; gy++)
      for (let gx = 0; gx < GRID; gx++) {
        const x0 = Math.floor(((px.width - size) * gx) / (GRID - 1)), y0 = Math.floor(((px.height - size) * gy) / (GRID - 1));
        const p = patch(px, x0, y0, size);
        const g = gradients(p.L, size, size);
        cells.push({
          cx: gx / (GRID - 1),
          cy: gy / (GRID - 1),
          flat: mean(g.mag),
          sharp: laplacianVariance(p.L, size, size),
          l: mean(p.L),
          nL: noise(p.L, size, size),
          nC: Math.hypot(noise(p.A, size, size), noise(p.B, size, size)),
        });
      }
  // Grain is read where the picture is flat: the calmest third of the squares, by tone.
  const calm = [...cells].sort((a, b) => a.flat - b.flat).slice(0, Math.max(3, Math.floor(cells.length / 3)));
  const band = (lo: number, hi: number) => {
    const own = calm.filter((c) => c.l >= lo && c.l < hi);
    return fine && own.length ? round(mean(own.map((c) => c.nL))) : -1;
  };
  // -1 where the picture has no flat area of that tone, or is too small to say.
  v["finish.grain_shadows"] = band(0, 35);
  v["finish.grain_mids"] = band(35, 70);
  v["finish.grain_highlights"] = band(70, 101);
  v["finish.grain_chroma"] = fine && calm.length ? round(mean(calm.map((c) => c.nC))) : -1;
  const sharps = Float32Array.from(cells.map((c) => Math.log10(1 + c.sharp))).sort();
  const peak = quantile(sharps, 0.95);
  v["finish.sharpness_peak"] = fine ? round(peak) : -1;
  v["finish.sharp_share"] = cells.length ? round(cells.filter((c) => Math.log10(1 + c.sharp) > peak * 0.6).length / cells.length) : 0;
  const centre = cells.filter((c) => Math.abs(c.cx - 0.5) < 0.3 && Math.abs(c.cy - 0.5) < 0.3).map((c) => Math.log10(1 + c.sharp));
  const border = cells.filter((c) => !(Math.abs(c.cx - 0.5) < 0.3 && Math.abs(c.cy - 0.5) < 0.3)).map((c) => Math.log10(1 + c.sharp));
  const mc = mean(centre), mb = mean(border);
  v["finish.sharp_centre"] = mc + mb > 0 ? round((mc - mb) / (mc + mb)) : 0;
  // Compression is in the file as it was delivered.
  v["finish.blockiness"] = round(blockiness(delivered));

  // ── At 512 px: tone, tint, shares, lines, calm areas ──
  const s = shrink(delivered, 512);
  const p = planes(s);
  const { w, h } = p, n = w * h;
  const Ls = Float32Array.from(p.L).sort();
  const p01 = quantile(Ls, 0.01), p20 = quantile(Ls, 0.2), p25 = quantile(Ls, 0.25), p75 = quantile(Ls, 0.75), p80 = quantile(Ls, 0.8), p99 = quantile(Ls, 0.99);
  v["finish.black_point"] = round(p01, 1);
  v["finish.white_point"] = round(p99, 1);
  v["finish.midtone_slope"] = round(p75 - p25, 1);
  let sa = 0, sb = 0, sn = 0, ha = 0, hb = 0, hn = 0;
  const sat = [0, 0, 0], satN = [0, 0, 0];
  let black = 0, white = 0, neutral = 0, skin = 0, blue = 0, green = 0, red = 0;
  const hues = new Float64Array(12);
  for (let i = 0; i < n; i++) {
    const l = p.L[i]!, a = p.A[i]!, b = p.B[i]!, c = p.C[i]!;
    if (l <= p20) (sa += a), (sb += b), sn++;
    if (l >= p80) (ha += a), (hb += b), hn++;
    const k = l < 35 ? 0 : l < 70 ? 1 : 2;
    sat[k]! += c;
    satN[k]!++;
    if (l < 8) black++;
    if (l > 94 && c < 8) white++;
    if (c < 6) neutral++;
    const hue = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
    if (hue >= 20 && hue <= 75 && c >= 10 && c <= 45 && l >= 25 && l <= 88) skin++;
    if (c > 12) {
      if (hue >= 190 && hue < 300) blue++;
      else if (hue >= 110 && hue < 190) green++;
      else if ((hue >= 345 || hue < 75) && c > 30) red++;
      hues[Math.floor(hue / 30) % 12]! += c;
    }
  }
  v["finish.shadow_a"] = round(sn ? sa / sn : 0, 2);
  v["finish.shadow_b"] = round(sn ? sb / sn : 0, 2);
  v["finish.highlight_a"] = round(hn ? ha / hn : 0, 2);
  v["finish.highlight_b"] = round(hn ? hb / hn : 0, 2);
  v["finish.split_tone"] = round((hn ? hb / hn : 0) - (sn ? sb / sn : 0), 2);
  v["finish.sat_shadows"] = satN[0] ? round(sat[0]! / satN[0]!, 1) : -1;
  v["finish.sat_mids"] = satN[1] ? round(sat[1]! / satN[1]!, 1) : -1;
  v["finish.sat_highlights"] = satN[2] ? round(sat[2]! / satN[2]!, 1) : -1;
  v["colour.black_share"] = round(black / n);
  v["colour.white_share"] = round(white / n);
  v["colour.neutral_share"] = round(neutral / n);
  v["colour.skin_share"] = round(skin / n);
  v["colour.blue_share"] = round(blue / n);
  v["colour.green_share"] = round(green / n);
  v["colour.red_share"] = round(red / n);
  const hueSum = hues.reduce((x, y) => x + y, 0);
  let entropy = 0;
  if (hueSum > 0) for (const x of hues) if (x > 0) entropy -= (x / hueSum) * Math.log(x / hueSum);
  v["colour.hue_entropy"] = round(entropy / Math.log(12));
  const main = palette.filter((c) => c.share >= 0.05).map((c) => ({ share: c.share, lab: lab(parseInt(c.hex.slice(1, 3), 16), parseInt(c.hex.slice(3, 5), 16), parseInt(c.hex.slice(5, 7), 16)) }));
  v["colour.dominant_share"] = round(palette[0]?.share ?? 0);
  let far = 0;
  for (const x of main) for (const y of main) far = Math.max(far, Math.hypot(x.lab[0] - y.lab[0], x.lab[1] - y.lab[1], x.lab[2] - y.lab[2]));
  v["colour.palette_contrast"] = round(far, 1);

  const blurred = boxBlur(p.L, w, h, 4);
  let lc = 0;
  for (let i = 0; i < n; i++) lc += (p.L[i]! - blurred[i]!) ** 2;
  v["finish.local_contrast_measured"] = round(Math.sqrt(lc / n), 2);
  v["finish.halation"] = round(halation(p), 2);

  const g = gradients(p.L, w, h);
  let total = 0, top = 0, left = 0, eh = 0, ev = 0, ed = 0, inC = 0, inN = 0, outC = 0, outN = 0, lt = 0, ltN = 0, lb = 0, lbN = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x, m = g.mag[i]!;
      total += m;
      if (y < h / 2) top += m;
      if (x < w / 2) left += m;
      if (m > 6) {
        // A horizontal line changes brightness down the picture: its gradient points up or down.
        const angle = Math.abs((Math.atan2(g.gy[i]!, g.gx[i]!) * 180) / Math.PI);
        const fromVertical = Math.abs(angle - 90);
        if (fromVertical < 20) eh += m;
        else if (fromVertical > 70) ev += m;
        else ed += m;
      }
      const central = x > w * 0.25 && x < w * 0.75 && y > h * 0.25 && y < h * 0.75;
      if (central) (inC += m), inN++;
      else (outC += m), outN++;
      if (y < h / 3) (lt += p.L[i]!), ltN++;
      if (y >= (2 * h) / 3) (lb += p.L[i]!), lbN++;
    }
  v["composition.weight_top"] = total ? round(top / total) : 0.5;
  v["composition.weight_left"] = total ? round(left / total) : 0.5;
  const edges = eh + ev + ed;
  v["composition.lines_horizontal"] = edges ? round(eh / edges) : 0;
  v["composition.lines_vertical"] = edges ? round(ev / edges) : 0;
  v["composition.lines_diagonal"] = edges ? round(ed / edges) : 0;
  v["composition.centre_detail"] = outC > 0 ? round(inC / inN / (outC / outN), 2) : 1;
  v["composition.top_brightness"] = round(ltN ? lt / ltN : 0, 1);
  v["composition.bottom_brightness"] = round(lbN ? lb / lbN : 0, 1);

  // Calm areas: an 8 by 8 board; a square is calm when it holds little detail. Words can stand there.
  const N = 8;
  const calmCell: boolean[] = [];
  for (let cy = 0; cy < N; cy++)
    for (let cx = 0; cx < N; cx++) {
      let m = 0, k = 0;
      for (let y = Math.floor((cy * h) / N); y < Math.floor(((cy + 1) * h) / N); y++)
        for (let x = Math.floor((cx * w) / N); x < Math.floor(((cx + 1) * w) / N); x++) (m += g.mag[y * w + x]!), k++;
      calmCell.push(k > 0 && m / k < 2.2);
    }
  const share = (pick: (cx: number, cy: number) => boolean) => {
    let yes = 0, all = 0;
    for (let cy = 0; cy < N; cy++) for (let cx = 0; cx < N; cx++) if (pick(cx, cy)) (all++, calmCell[cy * N + cx] && yes++);
    return round(yes / all);
  };
  v["composition.calm_top"] = share((_x, y) => y < 3);
  v["composition.calm_bottom"] = share((_x, y) => y >= 5);
  v["composition.calm_left"] = share((x) => x < 3);
  v["composition.calm_right"] = share((x) => x >= 5);
  return v;
}

/** How much brighter the picture is just beside its highlights than a little further out: bloom and halation. */
function halation(p: Planes): number {
  const { w, h, L } = p;
  const INF = 1e9;
  const d = new Float32Array(w * h).fill(INF);
  let any = false;
  for (let i = 0; i < w * h; i++) if (L[i]! > 93) (d[i] = 0), (any = true);
  if (!any) return 0;
  // Distance to the nearest highlight, in two sweeps (city-block).
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x > 0) d[i] = Math.min(d[i]!, d[i - 1]! + 1);
      if (y > 0) d[i] = Math.min(d[i]!, d[i - w]! + 1);
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (x < w - 1) d[i] = Math.min(d[i]!, d[i + 1]! + 1);
      if (y < h - 1) d[i] = Math.min(d[i]!, d[i + w]! + 1);
    }
  let near = 0, nearN = 0, far = 0, farN = 0;
  for (let i = 0; i < w * h; i++) {
    if (d[i]! >= 2 && d[i]! <= 6) (near += L[i]!), nearN++;
    else if (d[i]! >= 14 && d[i]! <= 22) (far += L[i]!), farN++;
  }
  return nearN > 50 && farN > 50 ? Math.max(0, near / nearN - far / farN) : 0;
}

/** JPEG blocks: brightness steps on the 8 px grid against steps elsewhere. Heavy compression hides grain. */
function blockiness(px: Pixels): number {
  const w = Math.min(px.width, 1024), h = Math.min(px.height, 1024);
  let on = 0, onN = 0, off = 0, offN = 0;
  const lum = (x: number, y: number) => {
    const i = (y * px.width + x) * 4;
    return 0.299 * px.data[i]! + 0.587 * px.data[i + 1]! + 0.114 * px.data[i + 2]!;
  };
  for (let y = 0; y < h; y += 3)
    for (let x = 1; x < w; x++) {
      const step = Math.abs(lum(x, y) - lum(x - 1, y));
      if (x % 8 === 0) (on += step), onN++;
      else (off += step), offN++;
    }
  return onN && offN && off > 0 ? Math.max(0, on / onN / (off / offN) - 1) * 5 : 0;
}
