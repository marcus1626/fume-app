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
  /** The page as each view shows it, as JPEG. */
  capture(url: string, views: View[]): Promise<Uint8Array[]>;
}

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
  let r: { url?: unknown; upload?: unknown };
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
  let shots: Uint8Array[];
  try {
    shots = await deps.capture(page.href, VIEWS);
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
  return json(200, { url: page.href, shots: out });
}

/** Clicks away a cookie or consent banner, if the page shows one, so the page itself is seen. */
export const DISMISS = `(() => {
  const words = /^(accept|accept all|allow all|agree|i agree|ok|got it|godta|godta alle|aksepter|aksepter alle|tillat alle|jeg forstår|alle akzeptieren|tout accepter|acceptera|accepter)$/i;
  for (const el of Array.from(document.querySelectorAll('button, [role="button"], a'))) {
    const t = (el.textContent || '').trim().replace(/\\s+/g, ' ');
    if (t.length < 40 && words.test(t)) { el.click(); return true; }
  }
  return false;
})()`;
