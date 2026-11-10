// Screenshots of a brand's own website (docs/mvp/design-layer.md, "On brand"): how the brand itself sets words on its
// pictures, its headlines, buttons and type, as a visitor sees it. The pictures on a site carry no words (the words
// are the page's), so Fume looks at the page. Like the design service it holds no keys: it takes a request only with
// signed links to store the screenshots in Fume's own storage, which only Fume's backend can make.
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { signedLink } from "./handler.ts";

export type View = { name: "desktop" | "desktop_second" | "mobile"; width: number; height: number; scale: number; scrollScreens: number };
export const VIEWS: View[] = [
  { name: "desktop", width: 1440, height: 900, scale: 1, scrollScreens: 0 },
  { name: "desktop_second", width: 1440, height: 900, scale: 1, scrollScreens: 1 },
  { name: "mobile", width: 430, height: 932, scale: 2, scrollScreens: 0 },
];

export interface ShotDeps {
  storageHost: string;
  fetch: typeof fetch;
  /** The page as each view shows it, as JPEG, and the logo in its header (see LOGO). */
  capture(url: string, views: View[]): Promise<{ shots: Uint8Array[]; logo?: HeaderLogo | null }>;
}

/** The logo in the site's header: its SVG as drawn, or the address of its picture. */
export type HeaderLogo = { svg?: string; src?: string };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** A public web page: http or https, a name (not an address), not this machine or a private network's. */
export function publicPage(raw: unknown): URL | null {
  if (typeof raw !== "string" || raw.length > 2000) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password || (u.port && u.port !== "80" && u.port !== "443")) return null;
    const host = u.hostname.toLowerCase();
    if (isIP(host.replace(/^\[|\]$/g, "")) || !host.includes(".")) return null;
    if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp)$/.test(host)) return null;
    return u;
  } catch {
    return null;
  }
}

export async function handleShot(req: Request, deps: ShotDeps): Promise<Response> {
  if (req.method !== "POST") return json(405, { error: "POST only." });
  let r: { url?: unknown; upload?: unknown; logo?: unknown };
  try {
    r = (await req.json()) as typeof r;
  } catch {
    return json(400, { error: "The request is not JSON." });
  }
  const page = publicPage(r.url);
  if (!page) return json(400, { error: "The page must be a public web page." });
  const links = Array.isArray(r.upload) ? (r.upload as unknown[]) : [];
  if (links.length !== VIEWS.length || !links.every((l) => signedLink(l, deps.storageHost, "upload"))) {
    return json(400, { error: `The screenshots need ${VIEWS.length} signed upload links to Fume's storage.` });
  }
  if (r.logo != null && !signedLink(r.logo, deps.storageHost, "upload")) {
    return json(400, { error: "The logo needs a signed upload link to Fume's storage." });
  }
  let shots: Uint8Array[];
  let found: HeaderLogo | null = null;
  try {
    const got = await deps.capture(page.href, VIEWS);
    shots = got.shots;
    found = got.logo ?? null;
  } catch (e) {
    return json(502, { error: `The page could not be opened: ${(e as Error).message}`.slice(0, 300) });
  }
  const out: { view: string; bytes: number; sha256: string }[] = [];
  for (let i = 0; i < VIEWS.length; i++) {
    const bytes = shots[i];
    if (!bytes?.byteLength) continue;
    const res = await deps.fetch(links[i] as string, {
      method: "PUT",
      headers: { "content-type": "image/jpeg", "x-upsert": "true" },
      body: new Blob([bytes as Uint8Array<ArrayBuffer>]),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return json(502, { error: `Storing a screenshot failed (${res.status}).` });
    out.push({ view: VIEWS[i].name, bytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  // The logo is a help, not a gate: the screenshots stand without it.
  let logo: { type: string; bytes: number; from: "svg" | "picture" } | null = null;
  if (typeof r.logo === "string" && found) {
    try {
      const file = await logoFile(found, deps.fetch);
      if (file) {
        const res = await deps.fetch(r.logo, {
          method: "PUT",
          headers: { "content-type": file.type, "x-upsert": "true" },
          body: new Blob([file.bytes as Uint8Array<ArrayBuffer>]),
          signal: AbortSignal.timeout(30_000),
        });
        if (res.ok) logo = { type: file.type, bytes: file.bytes.byteLength, from: file.from };
      }
    } catch {
      logo = null;
    }
  }
  return json(200, { url: page.href, shots: out, logo });
}

/** The header's logo as a file: the SVG made safe to keep, or the picture fetched from a public address. */
export async function logoFile(found: HeaderLogo, get: typeof fetch): Promise<{ type: string; bytes: Uint8Array; from: "svg" | "picture" } | null> {
  if (found.svg) {
    const svg = safeSvg(found.svg);
    return svg ? { type: "image/svg+xml", bytes: new TextEncoder().encode(svg), from: "svg" } : null;
  }
  const at = found.src ? publicPage(found.src) : null;
  if (!at) return null;
  const res = await get(at.href, { signal: AbortSignal.timeout(10_000), redirect: "error" });
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!res.ok || !/^image\/(png|jpeg|webp|svg\+xml)$/.test(type)) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > 3_000_000) return null;
  if (type === "image/svg+xml") {
    const svg = safeSvg(new TextDecoder().decode(bytes));
    return svg ? { type, bytes: new TextEncoder().encode(svg), from: "svg" } : null;
  }
  return { type, bytes, from: "picture" };
}

/** An SVG with nothing in it that runs: no scripts, no event handlers, no links out, no embedded pages. */
export function safeSvg(raw: string): string | null {
  const svg = raw.trim();
  if (svg.length > 200_000 || !/^<svg[\s>]/i.test(svg) || !/<\/svg>\s*$/i.test(svg)) return null;
  const clean = svg
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, "");
  return /<script|javascript:|<foreignObject|<iframe/i.test(clean) ? null : clean;
}

/**
 * The logo in the page's header, as a visitor sees it: an SVG with its colours written in (so it draws the same away
 * from the page), or the address of its picture. Found by what the page calls it (logo, brand, home) near the top.
 */
export const LOGO = `(() => {
  const near = (el) => { const r = el.getBoundingClientRect(); return r.width >= 16 && r.height >= 10 && r.width <= 600 && r.top >= -5 && r.top < 240; };
  const named = (el) => {
    const a = el.closest('a');
    const words = [el.getAttribute('class'), el.getAttribute('aria-label'), el.getAttribute('alt'), el.getAttribute('src'), a && a.getAttribute('aria-label'), a && a.getAttribute('title')].join(' ');
    return /logo|brand|home|forside|hjem/i.test(words) || Boolean(el.closest('[class*="logo" i],[id*="logo" i]')) || (a && ['/', '', location.origin + '/'].includes(a.getAttribute('href') || 'x'));
  };
  const svgs = Array.from(document.querySelectorAll('header svg, nav svg, [class*="logo" i] svg, svg[class*="logo" i], a[href="/"] svg'));
  for (const s of svgs) {
    if (!near(s) || !named(s) || s.closest('button')) continue;
    const c = s.cloneNode(true);
    const from = [s, ...s.querySelectorAll('*')];
    const to = [c, ...c.querySelectorAll('*')];
    from.forEach((el, i) => {
      const st = getComputedStyle(el);
      if (st.fill && st.fill !== 'none') to[i].setAttribute('fill', st.fill); else if (st.fill === 'none') to[i].setAttribute('fill', 'none');
      if (st.stroke && st.stroke !== 'none') to[i].setAttribute('stroke', st.stroke);
      to[i].removeAttribute('class'); to[i].removeAttribute('style');
    });
    for (const u of Array.from(c.querySelectorAll('use'))) {
      const id = (u.getAttribute('href') || u.getAttribute('xlink:href') || '').replace(/^#/, '');
      const t = id && document.getElementById(id);
      if (!t) continue;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.innerHTML = t.innerHTML;
      g.setAttribute('fill', u.getAttribute('fill') || '');
      u.replaceWith(g);
      if (!c.getAttribute('viewBox') && t.getAttribute('viewBox')) c.setAttribute('viewBox', t.getAttribute('viewBox'));
    }
    const r = s.getBoundingClientRect();
    if (!c.getAttribute('viewBox')) c.setAttribute('viewBox', '0 0 ' + Math.round(r.width) + ' ' + Math.round(r.height));
    c.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    c.setAttribute('width', String(Math.round(r.width)));
    c.setAttribute('height', String(Math.round(r.height)));
    const col = getComputedStyle(s).color;
    return { svg: c.outerHTML.replace(/currentColor/g, col).slice(0, 200000) };
  }
  const imgs = Array.from(document.querySelectorAll('header img, nav img, [class*="logo" i] img, img[alt*="logo" i], img[src*="logo" i], a[href="/"] img'));
  // The largest picture the page offers, and the original behind an image optimiser (Next.js serves /logo.png small).
  const big = (i) => {
    let src = i.currentSrc || i.src;
    const set = (i.getAttribute('srcset') || '').split(',').map((x) => x.trim().split(/\s+/)).filter((x) => x[0]);
    const widest = set.sort((a, b) => parseFloat(b[1] || '0') - parseFloat(a[1] || '0'))[0];
    if (widest) src = new URL(widest[0], location.href).href;
    try { const u = new URL(src, location.href); if (u.pathname.startsWith('/_next/image') && u.searchParams.get('url')) src = new URL(u.searchParams.get('url'), location.href).href; } catch (e) {}
    return src;
  };
  for (const i of imgs) if (near(i) && named(i)) return { src: big(i) };
  return null;
})()`;

/** Clicks away a cookie or consent banner, if the page shows one, so the page itself is seen. */
export const DISMISS = `(() => {
  const words = /^(accept|accept all|allow all|agree|i agree|ok|got it|godta|godta alle|aksepter|aksepter alle|tillat alle|jeg forstår|alle akzeptieren|tout accepter|acceptera|accepter)$/i;
  for (const el of Array.from(document.querySelectorAll('button, [role="button"], a'))) {
    const t = (el.textContent || '').trim().replace(/\\s+/g, ' ');
    if (t.length < 40 && words.test(t)) { el.click(); return true; }
  }
  return false;
})()`;
