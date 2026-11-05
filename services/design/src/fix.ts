// A surgical fix's pixel work (docs/mvp/picture-fix.md), done here because the edge functions have too little CPU
// time for a four megapixel picture. The `fix` edge function asks twice: for the crop the image model redraws, and
// to set the redrawn crop back into the picture with a soft edge. Only the part the designer marked changes; the
// rest of the picture keeps every pixel it had.
import { start } from "./render.ts";

export type Img = { width: number; height: number; data: Uint8Array };
export type Rect = { x: number; y: number; w: number; h: number };

/** The ratios the image model makes, as width over height. */
const RATIOS: [string, number][] = [["21:9", 21 / 9], ["16:9", 16 / 9], ["3:2", 1.5], ["4:3", 4 / 3], ["5:4", 1.25], ["1:1", 1],
  ["4:5", 0.8], ["3:4", 0.75], ["2:3", 2 / 3], ["9:16", 9 / 16]];

/**
 * The part of the picture the model is shown: the marked box with room around it (the model needs to see the light
 * and the surface the part sits in), at least 384 px a side, in one of the model's own ratios so nothing is
 * stretched, and inside the picture.
 */
export function cropFor(box: Rect, width: number, height: number, least = 384): { rect: Rect; ratio: string } {
  const bx = box.x * width, by = box.y * height, bw = box.w * width, bh = box.h * height;
  const pad = Math.max(bw, bh) * 0.4;
  let w = Math.max(least, bw + 2 * pad), h = Math.max(least, bh + 2 * pad);
  const [ratio, r] = RATIOS.reduce((a, b) => (Math.abs(Math.log(b[1] / (w / h))) < Math.abs(Math.log(a[1] / (w / h))) ? b : a));
  // Grow the short side to the ratio, then shrink both if the picture is smaller than that.
  if (w / h < r) w = h * r;
  else h = w / r;
  const k = Math.min(1, width / w, height / h);
  w = Math.round(w * k);
  h = Math.round(h * k);
  const x = Math.round(Math.min(Math.max(0, bx + bw / 2 - w / 2), width - w));
  const y = Math.round(Math.min(Math.max(0, by + bh / 2 - h / 2), height - h));
  return { rect: { x, y, w, h }, ratio };
}

export function crop(img: Img, r: Rect): Img {
  const out = new Uint8Array(r.w * r.h * 4);
  for (let y = 0; y < r.h; y++) {
    const from = ((r.y + y) * img.width + r.x) * 4;
    out.set(img.data.subarray(from, from + r.w * 4), y * r.w * 4);
  }
  return { width: r.w, height: r.h, data: out };
}

/**
 * Blanks the marked part of a crop to its own plain colour (the median of its pixels), so the image model draws it anew
 * instead of keeping the wrong letters it sees. `part` is in the crop's own pixels.
 */
export function blank(img: Img, part: Rect): Img {
  const x0 = Math.max(0, Math.floor(part.x)), y0 = Math.max(0, Math.floor(part.y));
  const x1 = Math.min(img.width, Math.ceil(part.x + part.w)), y1 = Math.min(img.height, Math.ceil(part.y + part.h));
  if (x1 <= x0 || y1 <= y0) return img;
  const chans: number[][] = [[], [], []];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) for (let c = 0; c < 3; c++) chans[c].push(img.data[(y * img.width + x) * 4 + c]);
  }
  const median = chans.map((v) => v.sort((a, b) => a - b)[v.length >> 1]);
  const data = new Uint8Array(img.data);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data.set([...median, 255], (y * img.width + x) * 4);
  return { width: img.width, height: img.height, data };
}

/** Bilinear resize, enough to bring the model's crop back to the crop's own size. */
export function resize(img: Img, w: number, h: number): Img {
  if (img.width === w && img.height === h) return img;
  const out = new Uint8Array(w * h * 4);
  const sx = img.width / w, sy = img.height / h;
  for (let y = 0; y < h; y++) {
    const fy = Math.min(img.height - 1, Math.max(0, (y + 0.5) * sy - 0.5));
    const y0 = Math.floor(fy), y1 = Math.min(img.height - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(img.width - 1, Math.max(0, (x + 0.5) * sx - 0.5));
      const x0 = Math.floor(fx), x1 = Math.min(img.width - 1, x0 + 1), tx = fx - x0;
      for (let c = 0; c < 4; c++) {
        const p = (yy: number, xx: number) => img.data[(yy * img.width + xx) * 4 + c];
        const top = p(y0, x0) * (1 - tx) + p(y0, x1) * tx;
        const bottom = p(y1, x0) * (1 - tx) + p(y1, x1) * tx;
        out[(y * w + x) * 4 + c] = Math.round(top * (1 - ty) + bottom * ty);
      }
    }
  }
  return { width: w, height: h, data: out };
}

/**
 * The redrawn crop set back into the picture. Inside the marked box (and a little beyond it) the new pixels are
 * used; from there they fade into the picture's own pixels by the crop's edge, so there is no seam. The model's
 * light and colour drift a little: the new crop is first moved to the picture's own colour, measured on the ring
 * outside the box where both should be the same.
 */
export function setBack(picture: Img, redrawn: Img, rect: Rect, box: Rect): { picture: Img; drift: number } {
  const patch = resize(redrawn, rect.w, rect.h);
  const inner = {
    x0: box.x * picture.width - rect.x, y0: box.y * picture.height - rect.y,
    x1: (box.x + box.w) * picture.width - rect.x, y1: (box.y + box.h) * picture.height - rect.y,
  };
  // How far a pixel is outside the marked box, as a share of the room between the box and the crop's edge.
  const room = Math.max(1, Math.min(inner.x0, inner.y0, rect.w - inner.x1, rect.h - inner.y1));
  const hold = room * 0.25;
  const outside = (x: number, y: number) => Math.hypot(Math.max(0, inner.x0 - x, x - inner.x1), Math.max(0, inner.y0 - y, y - inner.y1));
  const mean = [0, 0, 0];
  let n = 0;
  for (let y = 0; y < rect.h; y += 2) {
    for (let x = 0; x < rect.w; x += 2) {
      const d = outside(x, y);
      if (d < hold || d > room) continue;
      const i = (y * rect.w + x) * 4;
      const j = ((rect.y + y) * picture.width + rect.x + x) * 4;
      for (let c = 0; c < 3; c++) mean[c] += picture.data[j + c] - patch.data[i + c];
      n++;
    }
  }
  const shift = n ? mean.map((m) => m / n) : [0, 0, 0];
  const out = new Uint8Array(picture.data);
  for (let y = 0; y < rect.h; y++) {
    for (let x = 0; x < rect.w; x++) {
      const d = outside(x, y);
      const t = d <= hold ? 1 : d >= room ? 0 : 1 - (d - hold) / (room - hold);
      if (t <= 0) continue;
      const a = t * t * (3 - 2 * t);
      const i = (y * rect.w + x) * 4;
      const j = ((rect.y + y) * picture.width + rect.x + x) * 4;
      for (let c = 0; c < 3; c++) {
        const v = Math.min(255, Math.max(0, patch.data[i + c] + shift[c]));
        out[j + c] = Math.round(picture.data[j + c] * (1 - a) + v * a);
      }
    }
  }
  return { picture: { ...picture, data: out }, drift: Math.round(Math.hypot(shift[0], shift[1], shift[2]) * 10) / 10 };
}

/** A PNG or JPEG as RGBA pixels. */
export async function decode(bytes: Uint8Array): Promise<Img> {
  const { ck } = await start();
  const img = ck.MakeImageFromEncoded(bytes);
  if (!img) throw new Error("The picture could not be read.");
  const width = img.width(), height = img.height();
  const data = img.readPixels(0, 0, {
    width, height, colorType: ck.ColorType.RGBA_8888, alphaType: ck.AlphaType.Unpremul, colorSpace: ck.ColorSpace.SRGB,
  }) as Uint8Array;
  img.delete();
  if (!data) throw new Error("The picture could not be read.");
  return { width, height, data: new Uint8Array(data) };
}

export async function encode(img: Img): Promise<Uint8Array> {
  const { ck } = await start();
  const made = ck.MakeImage(
    { width: img.width, height: img.height, colorType: ck.ColorType.RGBA_8888, alphaType: ck.AlphaType.Unpremul, colorSpace: ck.ColorSpace.SRGB },
    img.data,
    img.width * 4,
  );
  if (!made) throw new Error("The picture could not be written.");
  const bytes = made.encodeToBytes(ck.ImageFormat.PNG, 100);
  made.delete();
  if (!bytes) throw new Error("The picture could not be written.");
  return bytes;
}
