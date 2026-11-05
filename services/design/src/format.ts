// A format made from the master's own picture (docs/mvp/formats.md). A crop keeps the master's pixels exactly. An
// expansion puts the master on a canvas of the new shape, lets the image model draw only the new edges, and then sets
// every pixel of the master back as it was, with a narrow soft seam where the new edges meet it.
import { crop, type Img, type Rect, resize } from "./fix.ts";

/** The share of the picture's width over its height for each format. */
export const RATIO: Record<string, number> = { feed: 4 / 5, square: 1, story: 9 / 16, banner: 16 / 9 };
export const MODEL_RATIO: Record<string, string> = { feed: "4:5", square: "1:1", story: "9:16", banner: "16:9" };

/**
 * The largest window of the given ratio inside the picture, centred on `around` (shares) as far as the picture allows.
 * In the picture's pixels.
 */
export function windowFor(width: number, height: number, ratio: number, around?: Rect): Rect {
  let w = width, h = Math.round(width / ratio);
  if (h > height) {
    h = height;
    w = Math.round(height * ratio);
  }
  const cx = around ? (around.x + around.w / 2) * width : width / 2;
  const cy = around ? (around.y + around.h / 2) * height : height / 2;
  const x = Math.round(Math.min(Math.max(0, cx - w / 2), width - w));
  const y = Math.round(Math.min(Math.max(0, cy - h / 2), height - h));
  return { x, y, w, h };
}

/** Whether the box (shares of the picture) lies inside the window (pixels) with `air` of the window on each side. */
export function fits(box: Rect, win: Rect, width: number, height: number, air = 0.04): boolean {
  const bx0 = box.x * width, by0 = box.y * height, bx1 = (box.x + box.w) * width, by1 = (box.y + box.h) * height;
  const ax = win.w * air, ay = win.h * air;
  return bx0 >= win.x + ax - 0.5 && by0 >= win.y + ay - 0.5 && bx1 <= win.x + win.w - ax + 0.5 && by1 <= win.y + win.h - ay + 0.5;
}

/** The share of the master a crop to the ratio keeps. */
export const kept = (width: number, height: number, ratio: number) => {
  const w = windowFor(width, height, ratio);
  return (w.w * w.h) / (width * height);
};

/**
 * Where the master sits on the expanded canvas: the canvas keeps the master's own scale and grows only the side the
 * new shape needs, with the master in its middle.
 */
export function canvasFor(width: number, height: number, ratio: number): { width: number; height: number; at: Rect } {
  if (width / height > ratio) {
    const H = Math.round(width / ratio);
    return { width, height: H, at: { x: 0, y: Math.round((H - height) / 2), w: width, h: height } };
  }
  const W = Math.round(height * ratio);
  return { width: W, height, at: { x: Math.round((W - width) / 2), y: 0, w: width, h: height } };
}

/** The master on its canvas, the new parts a plain neutral grey the image model is told to fill. */
export function pad(master: Img, canvas: { width: number; height: number; at: Rect }, most = 2048): Img {
  const data = new Uint8Array(canvas.width * canvas.height * 4);
  for (let i = 0; i < data.length; i += 4) data.set([128, 128, 128, 255], i);
  for (let y = 0; y < master.height; y++) {
    const from = y * master.width * 4;
    data.set(master.data.subarray(from, from + master.width * 4), ((canvas.at.y + y) * canvas.width + canvas.at.x) * 4);
  }
  const out: Img = { width: canvas.width, height: canvas.height, data };
  const k = most / Math.max(canvas.width, canvas.height);
  return k < 1 ? resize(out, Math.round(canvas.width * k), Math.round(canvas.height * k)) : out;
}

/**
 * The image model's drawing brought to the canvas, moved to the master's colour (measured where both show the
 * master), and the master set back on it. Inside the master every pixel is the master's, except a seam of `seam`
 * pixels along the edges that meet a new part, where the drawing fades into the master.
 */
export function setMaster(master: Img, drawn: Img, canvas: { width: number; height: number; at: Rect }, seam = 48): { picture: Img; drift: number } {
  const out = resize(drawn, canvas.width, canvas.height);
  const at = canvas.at;
  // The median difference, so a part the model drew differently (the product, often) does not move the colour.
  const counts = [new Uint32Array(511), new Uint32Array(511), new Uint32Array(511)];
  let n = 0;
  for (let y = 0; y < master.height; y += 4) {
    for (let x = 0; x < master.width; x += 4) {
      const i = (y * master.width + x) * 4;
      const j = ((at.y + y) * canvas.width + at.x + x) * 4;
      for (let c = 0; c < 3; c++) counts[c][master.data[i + c] - out.data[j + c] + 255]++;
      n++;
    }
  }
  const median = (h: Uint32Array) => {
    let seen = 0;
    for (let v = 0; v < h.length; v++) if ((seen += h[v]) * 2 >= n) return v - 255;
    return 0;
  };
  const shift = n ? counts.map(median) : [0, 0, 0];
  // The new parts take the master's colour.
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (x >= at.x && x < at.x + at.w && y >= at.y && y < at.y + at.h) continue;
      const j = (y * canvas.width + x) * 4;
      for (let c = 0; c < 3; c++) out.data[j + c] = Math.min(255, Math.max(0, Math.round(out.data[j + c] + shift[c])));
      out.data[j + 3] = 255;
    }
  }
  // Which edges of the master meet a new part.
  const open = { left: at.x > 0, right: at.x + at.w < canvas.width, top: at.y > 0, bottom: at.y + at.h < canvas.height };
  for (let y = 0; y < master.height; y++) {
    for (let x = 0; x < master.width; x++) {
      const d = Math.min(
        open.left ? x : Infinity, open.right ? master.width - 1 - x : Infinity,
        open.top ? y : Infinity, open.bottom ? master.height - 1 - y : Infinity,
      );
      const i = (y * master.width + x) * 4;
      const j = ((at.y + y) * canvas.width + at.x + x) * 4;
      if (d >= seam) {
        out.data.set(master.data.subarray(i, i + 4), j);
        out.data[j + 3] = 255;
        continue;
      }
      const t = d / seam;
      const a = t * t * (3 - 2 * t);
      for (let c = 0; c < 3; c++) {
        const v = Math.min(255, Math.max(0, out.data[j + c] + shift[c]));
        out.data[j + c] = Math.round(v * (1 - a) + master.data[i + c] * a);
      }
      out.data[j + 3] = 255;
    }
  }
  return { picture: out, drift: Math.round(Math.hypot(shift[0], shift[1], shift[2]) * 10) / 10 };
}

/** A crop of the master: its own pixels, nothing drawn. */
export const cut = (master: Img, win: Rect): Img => crop(master, win);
