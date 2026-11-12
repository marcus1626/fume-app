// A quick look at one photograph in the browser (FLOWS §38.3): how sharp it is where it is in focus, how light, how
// much of its middle is burnt out, and a small fingerprint that near copies share. The mock reads a shoot dropped in the preview with it; live, the Engine
// reads the shoot. Answers null where there is no canvas (tests) or the picture does not load.
import type { PictureProbe } from "../domain/shoot";

const load = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No picture at ${src}`));
    img.src = src;
  });

/** The picture in grey at the given size, 0 to 1 per pixel. */
function grey(img: HTMLImageElement, w: number, h: number): Float32Array | null {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i += 1)
    out[i] = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255;
  return out;
}

export async function probePicture(src: string): Promise<PictureProbe | null> {
  if (typeof document === "undefined") return null;
  try {
    const img = await load(src);
    const ratio = img.naturalHeight / Math.max(1, img.naturalWidth);
    const w = 256;
    const h = Math.max(32, Math.round(w * ratio));
    const g = grey(img, w, h);
    const small = grey(img, 9, 8);
    if (!g || !small) return null;

    // Sharpness: the variance of a Laplacian in each of 6 × 6 tiles; the four sharpest tiles are where the picture is
    // in focus, so a shallow depth of field still reads as sharp and a missed focus does not.
    const T = 6;
    const tiles: number[] = [];
    for (let ty = 0; ty < T; ty += 1)
      for (let tx = 0; tx < T; tx += 1) {
        let sum = 0;
        let sq = 0;
        let n = 0;
        for (let y = Math.max(1, Math.floor((ty * h) / T)); y < Math.min(h - 1, Math.floor(((ty + 1) * h) / T)); y += 1)
          for (
            let x = Math.max(1, Math.floor((tx * w) / T));
            x < Math.min(w - 1, Math.floor(((tx + 1) * w) / T));
            x += 1
          ) {
            const i = y * w + x;
            const lap = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w];
            sum += lap;
            sq += lap * lap;
            n += 1;
          }
        if (n) tiles.push((sq / n - (sum / n) ** 2) * 1000);
      }
    tiles.sort((a, b) => b - a);
    const top = tiles.slice(0, 4);
    const sharpness = top.reduce((a, v) => a + v, 0) / Math.max(1, top.length);

    let light = 0;
    for (const v of g) light += v;
    light /= g.length;
    let spread = 0;
    for (const v of g) spread += (v - light) ** 2;
    const contrast = Math.sqrt(spread / g.length);

    // Burnt out: pure white in the middle of the picture. A frame edge that is mostly pure white is a packshot on a
    // white backdrop, and its white is the backdrop, not lost detail.
    const white = (v: number) => v >= 0.985;
    let edge = 0;
    let edgeN = 0;
    let middle = 0;
    let middleN = 0;
    for (let y = 0; y < h; y += 1)
      for (let x = 0; x < w; x += 1) {
        const v = g[y * w + x];
        if (y < 4 || y >= h - 4 || x < 4 || x >= w - 4) {
          edgeN += 1;
          if (white(v)) edge += 1;
        } else if (y >= h / 4 && y < (3 * h) / 4 && x >= w / 4 && x < (3 * w) / 4) {
          middleN += 1;
          if (white(v)) middle += 1;
        }
      }
    const blown = edge / Math.max(1, edgeN) < 0.3 ? middle / Math.max(1, middleN) : 0;

    // The fingerprint: is each of 8 × 8 cells lighter than the one to its right?
    let hash = "";
    for (let y = 0; y < 8; y += 1) {
      let bits = 0;
      for (let x = 0; x < 8; x += 1) bits = (bits << 1) | (small[y * 9 + x] > small[y * 9 + x + 1] ? 1 : 0);
      hash += bits.toString(16).padStart(2, "0");
    }
    return { sharpness, light, contrast, blown, hash };
  } catch {
    return null;
  }
}

/** A picture's own size, once it has loaded; a clip's size and length. */
export async function measure(src: string, kind: "photo" | "clip") {
  if (typeof document === "undefined") return {};
  if (kind === "photo")
    return load(src).then(
      (img) => ({ width: img.naturalWidth, height: img.naturalHeight }),
      () => ({}),
    );
  return new Promise<{ width?: number; height?: number; seconds?: number }>((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () =>
      resolve({ width: v.videoWidth, height: v.videoHeight, seconds: Math.round(v.duration || 0) || undefined });
    v.onerror = () => resolve({});
    v.src = src;
  });
}
