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

// src/logo.ts
import { SceneGraph as SceneGraph2 } from "@open-pencil/scene-graph";
import { renderJSX as renderJSX2 } from "@open-pencil/core/design-jsx";
import { createSVGNodes } from "@open-pencil/core/io";

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
  if (r.logo != null && !signedLink(r.logo, deps.storageHost, "upload")) {
    return json(400, { error: "The logo needs a signed upload link to Fume's storage." });
  }
  let shots;
  let found = null;
  try {
    const got = await deps.capture(page.href, VIEWS);
    shots = got.shots;
    found = got.logo ?? null;
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
  let logo = null;
  if (typeof r.logo === "string" && found) {
    try {
      const file = await logoFile(found, deps.fetch);
      if (file) {
        const res = await deps.fetch(r.logo, {
          method: "PUT",
          headers: { "content-type": file.type, "x-upsert": "true" },
          body: new Blob([file.bytes]),
          signal: AbortSignal.timeout(3e4)
        });
        if (res.ok) logo = { type: file.type, bytes: file.bytes.byteLength, from: file.from };
      }
    } catch {
      logo = null;
    }
  }
  return json(200, { url: page.href, shots: out, logo });
}
async function logoFile(found, get) {
  if (found.svg) {
    const svg = safeSvg(found.svg);
    return svg ? { type: "image/svg+xml", bytes: new TextEncoder().encode(svg), from: "svg" } : null;
  }
  const at = found.src ? publicPage(found.src) : null;
  if (!at) return null;
  const res = await get(at.href, { signal: AbortSignal.timeout(1e4), redirect: "error" });
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!res.ok || !/^image\/(png|jpeg|webp|svg\+xml)$/.test(type)) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > 3e6) return null;
  if (type === "image/svg+xml") {
    const svg = safeSvg(new TextDecoder().decode(bytes));
    return svg ? { type, bytes: new TextEncoder().encode(svg), from: "svg" } : null;
  }
  return { type, bytes, from: "picture" };
}
function safeSvg(raw) {
  const svg = raw.trim();
  if (svg.length > 2e5 || !/^<svg[\s>]/i.test(svg) || !/<\/svg>\s*$/i.test(svg)) return null;
  const clean = svg.replace(/<script[\s\S]*?<\/script\s*>/gi, "").replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, "").replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "").replace(/\s+(xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, "");
  return /<script|javascript:|<foreignObject|<iframe/i.test(clean) ? null : clean;
}
var LOGO = `(() => {
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
    const set = (i.getAttribute('srcset') || '').split(',').map((x) => x.trim().split(/s+/)).filter((x) => x[0]);
    const widest = set.sort((a, b) => parseFloat(b[1] || '0') - parseFloat(a[1] || '0'))[0];
    if (widest) src = new URL(widest[0], location.href).href;
    try { const u = new URL(src, location.href); if (u.pathname.startsWith('/_next/image') && u.searchParams.get('url')) src = new URL(u.searchParams.get('url'), location.href).href; } catch (e) {}
    return src;
  };
  for (const i of imgs) if (near(i) && named(i)) return { src: big(i) };
  return null;
})()`;
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
  let logo = null;
  const one = async (v) => {
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: v.width, height: v.height, deviceScaleFactor: v.scale, isMobile: v.name === "mobile" });
      await page.setUserAgent(
        v.name === "mobile" ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
      );
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 2e4 }).catch(() => void 0);
      await Promise.race([page.waitForNetworkIdle({ idleTime: 800, timeout: 8e3 }).catch(() => void 0), wait(8e3)]);
      await page.evaluate(DISMISS).catch(() => false);
      await wait(1e3);
      if (v.name === "desktop") logo = await page.evaluate(LOGO).catch(() => null) ?? null;
      if (v.scrollScreens) {
        await page.evaluate((y) => window.scrollTo(0, y), v.height * v.scrollScreens).catch(() => void 0);
        await wait(1500);
      }
      return new Uint8Array(await page.screenshot({ type: "jpeg", quality: 80 }));
    } finally {
      await page.close().catch(() => void 0);
    }
  };
  try {
    const shots = await Promise.allSettled(views.map(one));
    return { shots: shots.map((s) => s.status === "fulfilled" ? s.value : new Uint8Array()), logo };
  } finally {
    await browser.close();
  }
}
var wait = (ms) => new Promise((r) => setTimeout(r, ms));
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
