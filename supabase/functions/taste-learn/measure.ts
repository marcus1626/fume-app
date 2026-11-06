// What Fume measures in one picture, without a model: about thirty numbers on its light, colour, detail and
// composition, finer than the eye reads them. The picture is made small (256 px on its long side) and read as CIELAB.
// The numbers are the evidence the taste model (public.taste_compute) learns the brand's taste from.

export interface Pixels {
  width: number;
  height: number;
  /** RGBA, 8 bits each, row by row. */
  data: Uint8ClampedArray | Uint8Array;
}

export interface Measured {
  /** One number per variable; the keys are app.taste_features. */
  v: Record<string, number>;
  /** The picture's five main colours, most used first. */
  palette: { hex: string; share: number }[];
}

/** The picture made small: at most `max` px on its long side, each new pixel the mean of the ones it covers. */
export function shrink(px: Pixels, max: number): Pixels {
  const k = Math.max(1, Math.ceil(Math.max(px.width, px.height) / max));
  if (k === 1) return px;
  const w = Math.floor(px.width / k),
    h = Math.floor(px.height / k),
    out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let r = 0,
        g = 0,
        b = 0;
      for (let dy = 0; dy < k; dy++)
        for (let dx = 0; dx < k; dx++) {
          const i = ((y * k + dy) * px.width + (x * k + dx)) * 4;
          r += px.data[i]!;
          g += px.data[i + 1]!;
          b += px.data[i + 2]!;
        }
      const o = (y * w + x) * 4,
        kk = k * k;
      out[o] = r / kk;
      out[o + 1] = g / kk;
      out[o + 2] = b / kk;
      out[o + 3] = 255;
    }
  return { width: w, height: h, data: out };
}

const srgb = (c: number) => {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
export function lab(r: number, g: number, b: number): [number, number, number] {
  const R = srgb(r),
    G = srgb(g),
    B = srgb(b);
  const x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const fy = f(y);
  return [116 * fy - 16, 500 * (f(x) - fy), 200 * (fy - f(z))];
}
const hex = (r: number, g: number, b: number) =>
  "#" +
  [r, g, b]
    .map((c) =>
      Math.round(Math.max(0, Math.min(255, c)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")
    .toUpperCase();
const quantile = (sorted: Float32Array, q: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))]!;
const round = (x: number, d = 3) => Math.round(x * 10 ** d) / 10 ** d;

export function measure(px: Pixels): Measured {
  const { width: w, height: h, data } = px;
  const n = w * h;
  const L = new Float32Array(n),
    A = new Float32Array(n),
    Bv = new Float32Array(n),
    C = new Float32Array(n);
  const rg: number[] = [],
    yb: number[] = [];
  for (let i = 0; i < n; i++) {
    const r = data[i * 4]!,
      g = data[i * 4 + 1]!,
      b = data[i * 4 + 2]!;
    const [l, a, bb] = lab(r, g, b);
    L[i] = l;
    A[i] = a;
    Bv[i] = bb;
    C[i] = Math.hypot(a, bb);
    rg.push(r - g);
    yb.push(0.5 * (r + g) - b);
  }
  const mean = (x: ArrayLike<number>) => {
    let s = 0;
    for (let i = 0; i < x.length; i++) s += x[i]!;
    return s / x.length;
  };
  const sd = (x: ArrayLike<number>, m = mean(x)) => {
    let s = 0;
    for (let i = 0; i < x.length; i++) s += (x[i]! - m) ** 2;
    return Math.sqrt(s / x.length);
  };
  const Ls = Float32Array.from(L).sort();
  const p05 = quantile(Ls, 0.05),
    p50 = quantile(Ls, 0.5),
    p95 = quantile(Ls, 0.95);
  const Lm = mean(L);

  // Colour: warmth, tint, saturation, colourfulness (Hasler–Süsstrunk), hues weighted by chroma.
  const colourful = Math.sqrt(sd(rg) ** 2 + sd(yb) ** 2) + 0.3 * Math.sqrt(mean(rg) ** 2 + mean(yb) ** 2);
  let hx = 0,
    hy = 0,
    hw = 0,
    warm = 0,
    coloured = 0,
    na = 0,
    nb = 0,
    nn = 0;
  for (let i = 0; i < n; i++) {
    const c = C[i]!;
    if (c > 12) {
      const hue = Math.atan2(Bv[i]!, A[i]!);
      hx += c * Math.cos(hue);
      hy += c * Math.sin(hue);
      hw += c;
      const deg = ((hue * 180) / Math.PI + 360) % 360;
      coloured++;
      if (deg < 100 || deg > 340) warm++;
    } else if (L[i]! > 15 && L[i]! < 95) {
      na += A[i]!;
      nb += Bv[i]!;
      nn++;
    }
  }
  const resultant = hw ? Math.hypot(hx, hy) / hw : 1;
  const hueMain = hw ? ((Math.atan2(hy, hx) * 180) / Math.PI + 360) % 360 : 0;

  // Detail: Sobel edges, the Laplacian's variance (sharpness), grain in the flat parts.
  const at = (x: number, y: number) => L[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))]!;
  const E = new Float32Array(n);
  let lapS = 0,
    lapS2 = 0,
    edges = 0;
  const flatNoise: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const gx =
        at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
      const gy =
        at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
      const e = Math.hypot(gx, gy) / 8;
      E[y * w + x] = e;
      if (e > 6) edges++;
      const lap = at(x + 1, y) + at(x - 1, y) + at(x, y + 1) + at(x, y - 1) - 4 * at(x, y);
      lapS += lap;
      lapS2 += lap * lap;
      if (e < 1.5) {
        const blur = (at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1) + at(x, y)) / 5;
        flatNoise.push(Math.abs(at(x, y) - blur));
      }
    }
  const lapVar = lapS2 / n - (lapS / n) ** 2;
  flatNoise.sort((a, b) => a - b);
  const grain = flatNoise.length > 50 ? flatNoise[Math.floor(flatNoise.length / 2)]! * 1.4826 * 4 : 0;

  // Composition: where the energy (edges and colour) sits, how much is empty, balance, subject size, headroom.
  let ex = 0,
    ey = 0,
    et = 0;
  const energy = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = (E[i]! > 2 ? E[i]! : 0) + 0.3 * Math.max(0, C[i]! - 12);
    energy[i] = v;
    et += v;
    ex += v * (i % w);
    ey += v * Math.floor(i / w);
  }
  const cx = et ? ex / et / w : 0.5,
    cy = et ? ey / et / h : 0.5;
  const thirds = Math.min(...[1 / 3, 2 / 3].flatMap((tx) => [1 / 3, 2 / 3].map((ty) => Math.hypot(cx - tx, cy - ty))));
  const G = 16,
    cells: number[] = [];
  for (let gy = 0; gy < G; gy++)
    for (let gx = 0; gx < G; gx++) {
      let s = 0,
        c = 0;
      for (let y = Math.floor((gy * h) / G); y < Math.floor(((gy + 1) * h) / G); y++)
        for (let x = Math.floor((gx * w) / G); x < Math.floor(((gx + 1) * w) / G); x++) {
          s += E[y * w + x]!;
          c++;
        }
      cells.push(c ? s / c : 0);
    }
  const quiet = cells.filter((c) => c < 2.5).length / cells.length;
  let sym = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w / 2; x++) sym += Math.abs(L[y * w + x]! - L[y * w + (w - 1 - x)]!);
  const symmetry = 1 - sym / (h * Math.floor(w / 2) || 1) / 100;
  // The box that holds 80% of the energy, by trimming 10% from each side.
  const span = (axis: "x" | "y") => {
    const len = axis === "x" ? w : h,
      prof = new Float64Array(len);
    for (let i = 0; i < n; i++) prof[axis === "x" ? i % w : Math.floor(i / w)] += energy[i]!;
    let acc = 0,
      lo = 0,
      hi = len - 1;
    for (let i = 0; i < len; i++) {
      acc += prof[i]!;
      if (acc >= 0.1 * et) {
        lo = i;
        break;
      }
    }
    acc = 0;
    for (let i = len - 1; i >= 0; i--) {
      acc += prof[i]!;
      if (acc >= 0.1 * et) {
        hi = i;
        break;
      }
    }
    return { lo: lo / len, hi: (hi + 1) / len };
  };
  const sx = span("x"),
    sy = span("y");
  const rowEdges = (y: number) => {
    let c = 0;
    for (let x = 0; x < w; x++) if (E[y * w + x]! > 6) c++;
    return c / w;
  };
  let head = 0;
  while (head < h && rowEdges(head) < 0.01) head++;

  // Light: vignette, which side is brighter, how much sits in the mid-tones, clipping.
  const region = (x0: number, y0: number, x1: number, y1: number) => {
    let s = 0,
      c = 0;
    for (let y = Math.floor(y0 * h); y < Math.floor(y1 * h); y++)
      for (let x = Math.floor(x0 * w); x < Math.floor(x1 * w); x++) {
        s += L[y * w + x]!;
        c++;
      }
    return c ? s / c : 0;
  };
  const corners =
    (region(0, 0, 0.2, 0.2) + region(0.8, 0, 1, 0.2) + region(0, 0.8, 0.2, 1) + region(0.8, 0.8, 1, 1)) / 4;
  const centre = region(0.35, 0.35, 0.65, 0.65) || 1;
  const left = region(0, 0, 0.5, 1),
    right = region(0.5, 0, 1, 1),
    top = region(0, 0, 1, 0.5),
    bottom = region(0, 0.5, 1, 1);
  let mid = 0,
    cs = 0,
    ch = 0;
  for (let i = 0; i < n; i++) {
    const l = L[i]!;
    if (l >= 30 && l <= 70) mid++;
    if (l < 3) cs++;
    if (l > 97) ch++;
  }

  // Palette: k-means on Lab, five colours, from a fixed start so the same picture gives the same palette.
  const K = 5,
    step = Math.max(1, Math.floor(n / 4000)),
    pts: number[] = [];
  for (let i = 0; i < n; i += step) pts.push(i);
  let cent = Array.from({ length: K }, (_, k) => {
    const i = pts[Math.floor(((k + 0.5) * pts.length) / K)]!;
    return [L[i]!, A[i]!, Bv[i]!];
  });
  const own = new Int32Array(pts.length);
  for (let it = 0; it < 8; it++) {
    const sum = Array.from({ length: K }, () => [0, 0, 0, 0]);
    pts.forEach((i, j) => {
      let best = 0,
        bd = Infinity;
      cent.forEach((c, k) => {
        const d = (L[i]! - c[0]!) ** 2 + (A[i]! - c[1]!) ** 2 + (Bv[i]! - c[2]!) ** 2;
        if (d < bd) {
          bd = d;
          best = k;
        }
      });
      own[j] = best;
      const s = sum[best]!;
      s[0] = s[0]! + L[i]!;
      s[1] = s[1]! + A[i]!;
      s[2] = s[2]! + Bv[i]!;
      s[3] = s[3]! + 1;
    });
    cent = cent.map((c, k) =>
      sum[k]![3]! ? [sum[k]![0]! / sum[k]![3]!, sum[k]![1]! / sum[k]![3]!, sum[k]![2]! / sum[k]![3]!] : c,
    );
  }
  const counts = new Array(K).fill(0),
    rgbSum = Array.from({ length: K }, () => [0, 0, 0]);
  pts.forEach((i, j) => {
    const k = own[j]!;
    counts[k]++;
    rgbSum[k]![0] = rgbSum[k]![0]! + data[i * 4]!;
    rgbSum[k]![1] = rgbSum[k]![1]! + data[i * 4 + 1]!;
    rgbSum[k]![2] = rgbSum[k]![2]! + data[i * 4 + 2]!;
  });
  const palette = counts
    .map((c, k) => ({
      hex: c ? hex(rgbSum[k]![0]! / c, rgbSum[k]![1]! / c, rgbSum[k]![2]! / c) : "#000000",
      share: round(c / pts.length, 3),
    }))
    .filter((p) => p.share > 0)
    .sort((a, b) => b.share - a.share);

  return {
    v: {
      "light.key": round(Lm, 2),
      "light.contrast": round(p95 - p05, 2),
      "light.shadows": round(p05, 2),
      "light.midtone": round(p50, 2),
      "light.highlights": round(p95, 2),
      "light.mid_share": round(mid / n),
      "light.clip_shadows": round((100 * cs) / n, 2),
      "light.clip_highlights": round((100 * ch) / n, 2),
      "light.vignette": round(corners / centre),
      "light.from_side": round((right - left) / 50),
      "light.from_above": round((top - bottom) / 50),
      "colour.warmth": round(mean(Bv), 2),
      "colour.tint": round(mean(A), 2),
      "colour.white_balance": round(nn ? nb / nn : 0, 2),
      "colour.white_tint": round(nn ? na / nn : 0, 2),
      "colour.saturation": round(mean(C), 2),
      "colour.saturation_peak": round(quantile(Float32Array.from(C).sort(), 0.9), 2),
      "colour.colourfulness": round(colourful, 2),
      "colour.hue_main": round(hueMain, 1),
      "colour.hue_spread": round(1 - resultant),
      "colour.warm_share": round(coloured ? warm / coloured : 0.5),
      "colour.coloured_share": round(coloured / n),
      "detail.sharpness": round(Math.log10(1 + lapVar), 3),
      "detail.edges": round(edges / n),
      "detail.grain": round(grain, 3),
      "composition.space": round(quiet),
      "composition.across": round(cx),
      "composition.down": round(cy),
      "composition.thirds": round(thirds),
      "composition.symmetry": round(symmetry),
      "composition.subject_size": round((sx.hi - sx.lo) * (sy.hi - sy.lo)),
      "composition.headroom": round(head / h),
      "format.aspect": round(w / h),
    },
    palette,
  };
}
