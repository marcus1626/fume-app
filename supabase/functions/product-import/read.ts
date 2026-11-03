// What the shop says about its products, read without a model: Shopify's product feed, WooCommerce's Store API, else
// the structured data (schema.org Product) on the product pages found from the front page and the sitemap.
import { publicUrl } from "../_shared/net.ts";

export interface Found {
  name: string;
  variant: string;
  images: string[];
  fields: { fieldId: string; label: string; value: string; source?: string }[];
  files: { name: string; kind: "page" }[];
  source: string;
  confidence: "high" | "medium" | "low";
}

const MAX_IMAGES = 4;

/** The shop's address, or undefined for one Fume does not open (no dot, or a private address). */
export function siteUrl(raw: string): string | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    return publicUrl(u.href)?.href;
  } catch {
    return undefined;
  }
}
const text = (html: string) =>
  html
    .replace(/<\/?(b|i|em|strong|span|a|u|small)\b[^>]*>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "’")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
const short = (s: string, n = 280) => (s.length > n ? `${s.slice(0, n - 1).replace(/\s+\S*$/, "")}…` : s);
const label = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

export function picture(src: unknown, base: string): string | undefined {
  if (typeof src !== "string" || !src.trim()) return undefined;
  try {
    const u = new URL(src.trim().startsWith("//") ? `https:${src.trim()}` : src.trim(), base);
    if (u.protocol === "http:") u.protocol = "https:";
    if (u.protocol !== "https:" || /\.svg$/i.test(u.pathname)) return undefined;
    return u.href;
  } catch {
    return undefined;
  }
}

function field(fieldId: string, labelText: string, value: unknown, source?: string) {
  const v = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  return v ? [{ fieldId, label: labelText, value: short(v), ...(source ? { source } : {}) }] : [];
}

// ─── Shopify ───────────────────────────────────────────────────────────────────

interface ShopifyProduct {
  title?: string;
  handle?: string;
  body_html?: string;
  product_type?: string;
  variants?: { title?: string; sku?: string; price?: string }[];
  images?: { src?: string }[];
}

export function fromShopify(json: unknown, origin: string): Found[] | null {
  const list = (json as { products?: ShopifyProduct[] } | null)?.products;
  if (!Array.isArray(list)) return null;
  return list.flatMap((p) => {
    const name = (p.title ?? "").trim();
    if (!name) return [];
    const page = p.handle ? `${origin}/products/${p.handle}` : origin;
    const variants = (p.variants ?? []).filter((v) => v.title && !/^default title$/i.test(v.title));
    const images = (p.images ?? []).flatMap((i) => picture(i.src?.replace(/\?v=\d+$/, ""), origin) ?? []);
    return [
      {
        name,
        variant: variants.length === 1 ? variants[0]!.title!.trim() : "",
        images: images.slice(0, MAX_IMAGES),
        fields: [
          ...field("sku", "SKU", p.variants?.[0]?.sku),
          ...field("price", "Price", p.variants?.[0]?.price),
          ...(variants.length > 1 ? field("variants", "Variants", variants.map((v) => v.title).join(", ")) : []),
          ...field("type", "Type", p.product_type),
          ...field("description", "On the website", text(p.body_html ?? "")),
        ],
        files: [{ name: label(page), kind: "page" as const }],
        source: page,
        confidence: "high" as const,
      },
    ];
  });
}

// ─── WooCommerce (Store API) ───────────────────────────────────────────────────

interface WooProduct {
  name?: string;
  permalink?: string;
  sku?: string;
  short_description?: string;
  prices?: { price?: string; currency_minor_unit?: number; currency_code?: string };
  images?: { src?: string }[];
}

export function fromWoo(json: unknown, origin: string): Found[] | null {
  if (!Array.isArray(json)) return null;
  return (json as WooProduct[]).flatMap((p) => {
    const name = text(p.name ?? "");
    if (!name) return [];
    const page = p.permalink ?? origin;
    const minor = p.prices?.currency_minor_unit ?? 0;
    const price = p.prices?.price ? (Number(p.prices.price) / 10 ** minor).toString() : "";
    return [
      {
        name,
        variant: "",
        images: (p.images ?? []).flatMap((i) => picture(i.src, origin) ?? []).slice(0, MAX_IMAGES),
        fields: [
          ...field("sku", "SKU", p.sku),
          ...field("price", "Price", price && `${price} ${p.prices?.currency_code ?? ""}`.trim()),
          ...field("description", "On the website", text(p.short_description ?? "")),
        ],
        files: [{ name: label(page), kind: "page" as const }],
        source: page,
        confidence: "high" as const,
      },
    ];
  });
}

// ─── Product pages ─────────────────────────────────────────────────────────────

type Json = Record<string, unknown>;
const isProduct = (x: Json) => {
  const t = x["@type"];
  return t === "Product" || (Array.isArray(t) && t.includes("Product"));
};

function productsIn(node: unknown): Json[] {
  if (Array.isArray(node)) return node.flatMap(productsIn);
  if (!node || typeof node !== "object") return [];
  const x = node as Json;
  if (isProduct(x)) return [x];
  return productsIn(x["@graph"]);
}

/** The schema.org Product on a product page, if it has one. */
export function fromPage(html: string, url: string): Found | null {
  const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    let data: unknown;
    try {
      data = JSON.parse(b[1]!.trim());
    } catch {
      continue;
    }
    const p = productsIn(data)[0];
    if (!p) continue;
    const name = text(String(p.name ?? ""));
    if (!name) continue;
    const raw = p.image;
    const imgs = (Array.isArray(raw) ? raw : [raw]).map((i) =>
      typeof i === "object" && i ? ((i as Json).url ?? (i as Json).contentUrl) : i,
    );
    const offers = Array.isArray(p.offers) ? (p.offers as Json[])[0] : (p.offers as Json | undefined);
    const price = offers?.price ?? offers?.lowPrice;
    return {
      name,
      variant: "",
      images: [...new Set(imgs.flatMap((i) => picture(i, url) ?? []))].slice(0, MAX_IMAGES),
      fields: [
        ...field("sku", "SKU", p.sku),
        ...field("price", "Price", price !== undefined ? `${price} ${offers?.priceCurrency ?? ""}`.trim() : ""),
        ...field("description", "On the website", text(String(p.description ?? ""))),
      ],
      files: [{ name: label(url), kind: "page" }],
      source: url,
      confidence: "medium",
    };
  }
  return null;
}

/** Links on the front page that look like product pages, on the same site. */
export function productLinks(html: string, base: string): string[] {
  const host = new URL(base).hostname.replace(/^www\./, "");
  const out = new Set<string>();
  for (const m of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(m[1]!, base);
      if (u.hostname.replace(/^www\./, "") !== host) continue;
      if (!/\/(products?|produkt(er)?|p|shop|item)\/[^/]+/i.test(u.pathname)) continue;
      if (/\.(jpe?g|png|webp|gif|svg|css|js)$/i.test(u.pathname)) continue;
      u.search = "";
      out.add(u.href.replace(/\/$/, ""));
    } catch {
      /* not an address */
    }
  }
  return [...out];
}

/** Sitemaps that list products, and the product pages they list. */
export function sitemapLinks(xml: string): { maps: string[]; pages: string[] } {
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]!.replace(/&amp;/g, "&"));
  return {
    maps: locs.filter((l) => /\.xml(\?|$)/i.test(l) && /product/i.test(l)),
    pages: locs.filter((l) => !/\.xml(\?|$)/i.test(l) && /\/(products?|produkt(er)?|p|item)\/[^/]+/i.test(l)),
  };
}
