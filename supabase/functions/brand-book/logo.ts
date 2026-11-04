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
