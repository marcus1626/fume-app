// Reads a JPEG or PNG file into pixels, for the taste tools run on a developer's machine.
import jpeg from "npm:jpeg-js@0.4.4";
import { decode as decodePng } from "npm:fast-png@6.2.0";
import type { Pixels } from "../../supabase/functions/taste-learn/measure.ts";

export function decode(bytes: Uint8Array): Pixels {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    const img = jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 1024, formatAsRGBA: true });
    return { width: img.width, height: img.height, data: img.data };
  }
  const img = decodePng(bytes);
  const ch = img.channels, n = img.width * img.height, data = new Uint8ClampedArray(n * 4);
  const scale = img.depth === 16 ? 1 / 257 : 1;
  for (let i = 0; i < n; i++) {
    const g = img.data[i * ch]! * scale;
    data[i * 4] = g;
    data[i * 4 + 1] = ch >= 3 ? img.data[i * ch + 1]! * scale : g;
    data[i * 4 + 2] = ch >= 3 ? img.data[i * ch + 2]! * scale : g;
    data[i * 4 + 3] = 255;
  }
  return { width: img.width, height: img.height, data };
}
