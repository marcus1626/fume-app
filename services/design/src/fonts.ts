// Fonts the brand has not given Fume, from Google Fonts. OpenPencil's own web-font providers come back empty on the
// server, so every creative was set in Inter (4 Nov 2026); this asks Google's CSS API for a TrueType file, which
// CanvasKit reads, and takes the nearest weight the family has when it lacks the one asked for (Anton has one).
import type { FontSource } from "./render.ts";

const UA = "Mozilla/4.0"; // An old browser is served TrueType, not WOFF2.
const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

export function googleFonts(get: typeof fetch = fetch): FontSource {
  const files = new Map<string, Promise<ArrayBuffer | null>>();
  const cssOf = async (query: string): Promise<string | null> => {
    const res = await get(`https://fonts.googleapis.com/css2?family=${query}&display=swap`, {
      headers: { "user-agent": UA },
      signal: AbortSignal.timeout(8_000),
    }).catch(() => null);
    return res?.ok ? res.text() : null;
  };
  const fileOf = (css: string | null) => css?.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)\s]+\.ttf)\)/)?.[1] ?? null;
  const load = async (family: string, weight: number, italic: boolean): Promise<ArrayBuffer | null> => {
    if (!/^[\p{L}\p{N} ]{1,60}$/u.test(family)) return null;
    const name = encodeURIComponent(family.trim()).replace(/%20/g, "+");
    const order = [...WEIGHTS].sort((a, b) => Math.abs(a - weight) - Math.abs(b - weight) || b - a);
    let url: string | null = null;
    for (const w of order.slice(0, 9)) {
      url = fileOf(await cssOf(`${name}:ital,wght@${italic ? 1 : 0},${w}`));
      if (url) break;
      // A family with one style answers only without a weight.
      if (w === order[0]) {
        url = fileOf(await cssOf(name));
        if (url) break;
      }
    }
    if (!url) return null;
    const res = await get(url, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
    return res?.ok ? res.arrayBuffer() : null;
  };
  return (family, weight, italic) => {
    const key = `${family}|${weight}|${italic}`;
    if (!files.has(key)) files.set(key, load(family, weight, italic).catch(() => null));
    return files.get(key)!;
  };
}
