// Built by tools/build.mjs from api-src/shot.ts and src/. Do not edit.

// api-src/shot.ts
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

// src/shot.ts
import { createHash } from "node:crypto";
import { isIP } from "node:net";

// src/pixels.ts
var lin = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
var LIN = Array.from({ length: 256 }, (_, i) => lin(i));

// src/render.ts
import { SceneGraph } from "@open-pencil/scene-graph";
import { renderJSX } from "@open-pencil/core/design-jsx";
import { IORegistry, BUILTIN_IO_FORMATS, initCanvasKit } from "@open-pencil/core/io";
import { computeAllLayouts, installTextMeasurer } from "@open-pencil/core/layout";
import { SkiaRenderer } from "@open-pencil/core/canvas";
import { prepareGraphFonts, fontManager, weightToStyle } from "@open-pencil/core/text";

// src/handler.ts
function signedLink(link, host, kind) {
  if (typeof link !== "string") return false;
  try {
    const u = new URL(link);
    const path = kind === "read" ? "/storage/v1/object/sign/" : "/storage/v1/object/upload/sign/";
    return u.protocol === "https:" && u.host === host && u.pathname.startsWith(path) && u.searchParams.has("token");
  } catch {
    return false;
  }
}

// src/shot.ts
var VIEWS = [
  { name: "desktop", width: 1440, height: 900, scale: 1, scrollScreens: 0 },
  { name: "desktop_second", width: 1440, height: 900, scale: 1, scrollScreens: 1 },
  { name: "mobile", width: 430, height: 932, scale: 2, scrollScreens: 0 }
];
var json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
function publicPage(raw) {
  if (typeof raw !== "string" || raw.length > 2e3) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password || u.port && u.port !== "80" && u.port !== "443") return null;
    const host = u.hostname.toLowerCase();
    if (isIP(host.replace(/^\[|\]$/g, "")) || !host.includes(".")) return null;
    if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp)$/.test(host)) return null;
    return u;
  } catch {
    return null;
  }
}
async function handleShot(req, deps) {
  if (req.method !== "POST") return json(405, { error: "POST only." });
  let r;
  try {
    r = await req.json();
  } catch {
    return json(400, { error: "The request is not JSON." });
  }
  const page = publicPage(r.url);
  if (!page) return json(400, { error: "The page must be a public web page." });
  const links = Array.isArray(r.upload) ? r.upload : [];
  if (links.length !== VIEWS.length || !links.every((l) => signedLink(l, deps.storageHost, "upload"))) {
    return json(400, { error: `The screenshots need ${VIEWS.length} signed upload links to Fume's storage.` });
  }
  let shots;
  try {
    shots = await deps.capture(page.href, VIEWS);
  } catch (e) {
    return json(502, { error: `The page could not be opened: ${e.message}`.slice(0, 300) });
  }
  const out = [];
  for (let i = 0; i < VIEWS.length; i++) {
    const bytes = shots[i];
    if (!bytes?.byteLength) continue;
    const res = await deps.fetch(links[i], {
      method: "PUT",
      headers: { "content-type": "image/jpeg", "x-upsert": "true" },
      body: new Blob([bytes]),
      signal: AbortSignal.timeout(3e4)
    });
    if (!res.ok) return json(502, { error: `Storing a screenshot failed (${res.status}).` });
    out.push({ view: VIEWS[i].name, bytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  return json(200, { url: page.href, shots: out });
}
var DISMISS = `(() => {
  const words = /^(accept|accept all|allow all|agree|i agree|ok|got it|godta|godta alle|aksepter|aksepter alle|tillat alle|jeg forst\xE5r|alle akzeptieren|tout accepter|acceptera|accepter)$/i;
  for (const el of Array.from(document.querySelectorAll('button, [role="button"], a'))) {
    const t = (el.textContent || '').trim().replace(/\\s+/g, ' ');
    if (t.length < 40 && words.test(t)) { el.click(); return true; }
  }
  return false;
})()`;

// api-src/shot.ts
async function capture(url, views) {
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: process.env.FUME_CHROMIUM ?? await chromium.executablePath(),
    headless: true
  });
  try {
    const out = [];
    for (const v of views) {
      const page = await browser.newPage();
      await page.setViewport({ width: v.width, height: v.height, deviceScaleFactor: v.scale, isMobile: v.name === "mobile" });
      await page.setUserAgent(
        v.name === "mobile" ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
      );
      await page.goto(url, { waitUntil: "networkidle2", timeout: 25e3 }).catch(() => void 0);
      await page.evaluate(DISMISS).catch(() => false);
      await new Promise((r) => setTimeout(r, 1200));
      if (v.scrollScreens) await page.evaluate((y) => window.scrollTo(0, y), v.height * v.scrollScreens);
      await new Promise((r) => setTimeout(r, 800));
      out.push(new Uint8Array(await page.screenshot({ type: "jpeg", quality: 80 })));
      await page.close();
    }
    return out;
  } finally {
    await browser.close();
  }
}
async function POST(req) {
  return handleShot(req, { storageHost: process.env.FUME_STORAGE_HOST ?? "vkusmctftfzsrxbcxtdz.supabase.co", fetch, capture });
}
async function GET() {
  return new Response(JSON.stringify({ service: "fume-shot", ok: true }), { headers: { "content-type": "application/json" } });
}
export {
  GET,
  POST
};
