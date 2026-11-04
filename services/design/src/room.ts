// Room for the words on a studio picture (docs/mvp/design-layer.md, "On brand"). A packshot on a plain backdrop
// that the product fills leaves the words nowhere to go. A designer then sets the picture a little smaller in its
// frame and carries the backdrop on to the edges, as a retoucher extends a seamless. Only a plain backdrop is
// carried on: a scene with things at its edges is never stretched.
import { start } from "./render.ts";
import { luminance } from "./pixels.ts";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Whether the picture's top and left edges are a smooth backdrop (one colour, or a soft fall of light), so they can
 * be carried on without a seam: neighbouring pixels along the edge barely differ.
 */
export function plainEdges(data: Uint8Array, width: number, height: number): boolean {
  const lumAt = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return luminance(data[i], data[i + 1], data[i + 2]);
  };
  const steps: number[] = [];
  const walk = (n: number, at: (k: number) => number) => {
    let prev = at(0);
    for (let k = 3; k < n; k += 3) {
      const l = at(k);
      steps.push(Math.abs(l - prev));
      prev = l;
    }
  };
  for (const d of [0, 2]) {
    walk(width, (x) => lumAt(x, d));
    walk(height, (y) => lumAt(d, y));
  }
  const mean = steps.reduce((a, x) => a + x, 0) / steps.length;
  const worst = [...steps].sort((a, b) => a - b)[Math.floor(steps.length * 0.99)] ?? 0;
  // Grain in a photographed backdrop is fine; an edge of a thing in the scene is not.
  return mean < 0.015 && worst < 0.04;
}

/**
 * The picture at `scale` of the frame, in its bottom right corner, with its top row and left column carried on to
 * fill the frame; and where a box in the frame lands. Null when the picture's edges are not plain.
 */
export async function inset(
  picture: Uint8Array,
  frame: { w: number; h: number },
  scale: number,
): Promise<{ picture: Uint8Array; move: (b: Box) => Box } | null> {
  const { ck } = await start();
  const img = ck.MakeImageFromEncoded(picture);
  if (!img) return null;
  const iw = img.width();
  const ih = img.height();
  const data = img.readPixels(0, 0, {
    width: iw,
    height: ih,
    colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Unpremul,
    colorSpace: ck.ColorSpace.SRGB,
  }) as Uint8Array;
  if (!data || !plainEdges(data, iw, ih)) {
    img.delete();
    return null;
  }
  // The part of the picture the frame shows when it fills it, as the renderer crops it.
  const fit = Math.max(frame.w / iw, frame.h / ih);
  const sw = frame.w / fit;
  const sh = frame.h / fit;
  const sx = (iw - sw) / 2;
  const sy = (ih - sh) / 2;
  const w = Math.round(frame.w * scale);
  const h = Math.round(frame.h * scale);
  const ox = frame.w - w;
  const oy = frame.h - h;
  const surface = ck.MakeSurface(frame.w, frame.h);
  if (!surface) {
    img.delete();
    return null;
  }
  const canvas = surface.getCanvas();
  const paint = new ck.Paint();
  // The backdrop is carried on from a softened copy, so the grain of one row never shows as streaks.
  const softSurface = ck.MakeSurface(iw, ih);
  if (!softSurface) {
    paint.delete();
    surface.delete();
    img.delete();
    return null;
  }
  const soft = new ck.Paint();
  soft.setImageFilter(ck.ImageFilter.MakeBlur(12, 12, ck.TileMode.Clamp, null));
  softSurface.getCanvas().drawImage(img, 0, 0, soft);
  const blurred = softSurface.makeImageSnapshot();
  const draw = (from: typeof img, src: number[], dst: number[]) =>
    canvas.drawImageRectOptions(from, ck.XYWHRect(src[0], src[1], src[2], src[3]), ck.XYWHRect(dst[0], dst[1], dst[2], dst[3]), ck.FilterMode.Linear, ck.MipmapMode.None, paint);
  // The corner, the top row and the left column, carried on; then the picture itself over them.
  const e = 6;
  draw(blurred, [sx + e, sy + e, 2, 2], [0, 0, ox + 1, oy + 1]);
  draw(blurred, [sx, sy + e, sw, 2], [ox, 0, w, oy + 1]);
  draw(blurred, [sx + e, sy, 2, sh], [0, oy, ox + 1, h]);
  draw(img, [sx, sy, sw, sh], [ox, oy, w, h]);
  const snap = surface.makeImageSnapshot();
  const bytes = snap.encodeToBytes();
  snap.delete();
  paint.delete();
  soft.delete();
  blurred.delete();
  softSurface.delete();
  surface.delete();
  img.delete();
  if (!bytes) return null;
  return {
    picture: bytes,
    move: (b) => ({ x: Math.round(ox + b.x * scale), y: Math.round(oy + b.y * scale), w: Math.round(b.w * scale), h: Math.round(b.h * scale) }),
  };
}
