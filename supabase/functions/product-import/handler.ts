// Fume imports a brand's products from its website (FLOWS §3.1): the shop's product feed when it has one (Shopify,
// WooCommerce), else the product pages it finds from the front page and the sitemap. What it found is saved as an
// import waiting for review, by the caller's own token (save_product_import decides who may). handler.test.ts runs
// it without the web.
import { type Found, fromPage, fromShopify, fromWoo, productLinks, siteUrl, sitemapLinks } from "./read.ts";

export interface Deps {
  /** A page, feed or sitemap, or null when it cannot be fetched. */
  fetchText(url: string): Promise<{ url: string; text: string } | null>;
  /** save_product_import as the caller. */
  save(input: Record<string, unknown>): Promise<{ data?: unknown; error?: { code: string; message: string } }>;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const STATUS: Record<string, number> = { not_found: 404, forbidden: 403, invalid: 400, conflict: 409 };
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const label = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
const MAX_PAGES = 24;
const MAX_FOUND = 120;

const json = (t: { text: string } | null) => {
  if (!t) return null;
  try {
    return JSON.parse(t.text) as unknown;
  } catch {
    return null;
  }
};

/** What the shop says, and where Fume read it. Exported for the tests. */
export async function readShop(url: string, deps: Deps): Promise<{ found: Found[]; log: string[] } | null> {
  const origin = new URL(url).origin;
  const log: string[] = [];
  const shopify = fromShopify(json(await deps.fetchText(`${origin}/products.json?limit=250`)), origin);
  if (shopify?.length) {
    log.push(`Read the shop’s product feed (${shopify.length} products)`);
    // A big shop: the second page of the feed too.
    if (shopify.length === 250) {
      const more = fromShopify(json(await deps.fetchText(`${origin}/products.json?limit=250&page=2`)), origin) ?? [];
      shopify.push(...more);
    }
    return { found: shopify.slice(0, MAX_FOUND), log };
  }
  const woo = fromWoo(json(await deps.fetchText(`${origin}/wp-json/wc/store/v1/products?per_page=100`)), origin);
  if (woo?.length) {
    log.push(`Read the shop’s product feed (${woo.length} products)`);
    return { found: woo.slice(0, MAX_FOUND), log };
  }
  const home = await deps.fetchText(url);
  if (!home || !/<html|<body|<head/i.test(home.text)) return null;
  const pages = new Set(productLinks(home.text, home.url));
  const map = await deps.fetchText(`${origin}/sitemap.xml`);
  if (map) {
    const { maps, pages: listed } = sitemapLinks(map.text);
    for (const p of listed) pages.add(p);
    for (const m of maps.slice(0, 2)) {
      const sub = await deps.fetchText(m);
      if (sub) for (const p of sitemapLinks(sub.text).pages) pages.add(p);
    }
  }
  const list = [...pages].slice(0, MAX_PAGES);
  log.push(`Read ${label(home.url)} and ${list.length} product pages`);
  const found: Found[] = [];
  for (let i = 0; i < list.length; i += 6) {
    const batch = await Promise.all(list.slice(i, i + 6).map((p) => deps.fetchText(p)));
    for (const page of batch) {
      const f = page && fromPage(page.text, page.url);
      if (f) found.push(f);
    }
  }
  // The front page itself may be the one product (a single-product brand).
  if (found.length === 0) {
    const f = fromPage(home.text, home.url);
    if (f) found.push(f);
  }
  return { found, log };
}

export async function handleImport(req: Request, authorized: boolean, deps: Deps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply(400, { code: "invalid", message: "Use POST." });
  if (!authorized) return reply(403, { code: "forbidden", message: "Sign in first." });
  let body: { workspaceId?: string; url?: string };
  try {
    body = await req.json();
  } catch {
    return reply(400, { code: "invalid", message: "The request could not be read." });
  }
  const url = siteUrl(body.url ?? "");
  if (!body.workspaceId) return reply(400, { code: "invalid", message: "Name the brand." });
  if (!url) return reply(400, { code: "invalid", message: "Write the shop’s address, like halm.no." });

  const read = await readShop(url, deps);
  if (!read) return reply(400, { code: "invalid", message: `Fume could not open ${label(url)}. Check the address.` });
  if (read.found.length === 0)
    return reply(400, {
      code: "invalid",
      message: `Fume found no products on ${label(url)}. Add them by hand, or try the shop’s own address.`,
    });
  const r = await deps.save({
    p_workspace_id: body.workspaceId,
    p_source: "website",
    p_url: url,
    p_found: read.found,
    p_log: read.log,
  });
  return r.error ? reply(STATUS[r.error.code] ?? 503, r.error) : reply(200, { import: r.data });
}
