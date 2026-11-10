// The brand's logo for the design layer (docs/mvp/design-layer.md, "On brand"): the file its design system names, so
// every creative carries the brand's own mark. From the site's header, as the screenshots find it, else from the
// Brand DNA's logo. Kept in the brand's own workspace; a site's favicon is never taken for its logo.

export interface BookLogo {
  bucket: string;
  path: string;
  type: string;
  from: string;
}

export interface DnaLogo {
  image?: string;
  use?: string;
  name?: string;
}

/** The Brand DNA's logo worth fetching: a picture of the logo, not the site's icon. */
export function dnaLogoUrl(identity: Record<string, unknown>): string | null {
  const logos = (Array.isArray(identity.logos) ? identity.logos : []) as DnaLogo[];
  for (const l of logos) {
    const u = typeof l.image === "string" ? l.image : "";
    if (!/^https:\/\//.test(u)) continue;
    if (/favicon|apple-touch-icon|\.ico(\?|$)/i.test(u) || /icon/i.test(l.use ?? "")) continue;
    return u;
  }
  return null;
}

/** An SVG with nothing in it that runs: no scripts, no event handlers, no links out, no embedded pages. */
export function safeSvg(raw: string): string | null {
  const svg = raw.replace(/^<\?xml[^>]*>\s*/i, "").replace(/<!DOCTYPE[^>]*>\s*/i, "").trim();
  if (svg.length > 200_000 || !/^<svg[\s>]/i.test(svg) || !/<\/svg>\s*$/i.test(svg)) return null;
  const clean = svg
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, "");
  return /<script|javascript:|<foreignObject|<iframe/i.test(clean) ? null : clean;
}

export const LOGO_TYPES = /^image\/(png|jpeg|webp|svg\+xml)$/;

/**
 * A logo file as Fume keeps it. An SVG that only wraps a picture of the logo (Anthem's: one <image> with a PNG inside,
 * 9 Nov) is kept as that picture, since the safe SVG would lose it and keep an empty frame; any other SVG is kept
 * without anything that runs. Null when there is no logo in it.
 */
export function logoFile(bytes: Uint8Array, type: string): { bytes: Uint8Array; type: string } | null {
  if (type !== "image/svg+xml") return { bytes, type };
  const raw = new TextDecoder().decode(bytes);
  const drawn = /<(path|rect|circle|ellipse|polygon|polyline|line|text)\b/i.test(raw);
  const images = [...raw.matchAll(/<image\b[^>]*?(?:xlink:)?href\s*=\s*["']data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)["']/gi)];
  if (!drawn && images.length === 1) {
    try {
      const bin = atob(images[0][2].replace(/\s+/g, ""));
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out.length > 100 ? { bytes: out, type: images[0][1].toLowerCase() } : null;
    } catch {
      return null;
    }
  }
  const svg = safeSvg(raw);
  return svg ? { bytes: new TextEncoder().encode(svg), type } : null;
}
