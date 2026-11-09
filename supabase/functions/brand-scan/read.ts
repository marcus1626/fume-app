// Reads a brand from its website's pages and stylesheets, without a language model: the colours the site uses most,
// its typefaces, its logo, its pictures and the words it opens with. Everything comes back as proposals with the
// page it was found on; the customer keeps, changes or removes each (20261103150000_brand_identity.sql).

export interface Page {
  url: string;
  html: string;
  css: string;
}

type Role = "primary" | "accent" | "ground" | "text" | "support";
export interface Read {
  colours: { name: string; hex: string; role: Role; usage: string; provenance: Prov }[];
  typefaces: {
    name: string;
    role: "display" | "body";
    cssFamily: string;
    weights: string[];
    sample: string;
    usage: string;
    provenance: Prov;
  }[];
  logos: { name: string; wordmark: string; image?: string; use: string; ground: "light" | "dark"; provenance: Prov }[];
  voice: { statement: string; example: string; provenance: Prov }[];
  imagery: { image: string; caption: string; group: "look" | "product"; provenance: Prov }[];
}
interface Prov {
  origin: "engine";
  state: "proposed";
  evidence: string;
  confidence: "high" | "medium" | "low";
}

const prov = (evidence: string, confidence: Prov["confidence"]): Prov => ({
  origin: "engine",
  state: "proposed",
  evidence,
  confidence,
});
const where = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

export function absolute(href: string, base: string): string | undefined {
  try {
    const u = new URL(decode(href), base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : undefined;
  } catch {
    return undefined;
  }
}

const attr = (tag: string, name: string) =>
  new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i")
    .exec(tag)
    ?.slice(2)
    .find((x) => x !== undefined);
const meta = (html: string, key: string) => {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const t = m[0];
    if ((attr(t, "name") ?? attr(t, "property") ?? "").toLowerCase() === key) return decode(attr(t, "content") ?? "");
  }
  return "";
};

// ─── Colours ─────────────────────────────────────────────────────────────────

function hexOf(raw: string): string | undefined {
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw);
  if (m) {
    const h = m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join("") : m[1]!;
    return `#${h.toUpperCase()}`;
  }
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i.exec(raw);
  if (m) {
    if (m[4] !== undefined && parseFloat(m[4]) < (m[4].endsWith("%") ? 60 : 0.6)) return undefined;
    return `#${[m[1], m[2], m[3]]
      .map((x) => Math.min(255, Number(x)).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()}`;
  }
  return undefined;
}

function hsl(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

/** A plain name for a colour, from its hue and lightness ("Deep brown", "Pale sand"). */
export function colourName(hex: string): string {
  const { h, s, l } = hsl(hex);
  if (s < 0.15) return l > 0.94 ? "White" : l < 0.1 ? "Black" : l > 0.7 ? "Light grey" : l < 0.3 ? "Charcoal" : "Grey";
  const hue =
    h < 15 || h >= 345
      ? "red"
      : h < 40
        ? l < 0.45
          ? "brown"
          : l > 0.75
            ? "sand"
            : "orange"
        : h < 55
          ? l > 0.75
            ? "sand"
            : "amber"
          : h < 70
            ? "yellow"
            : h < 160
              ? "green"
              : h < 200
                ? "teal"
                : h < 255
                  ? "blue"
                  : h < 290
                    ? "violet"
                    : "pink";
  const tone = l < 0.25 ? "Deep " : l < 0.4 ? "Dark " : l > 0.85 ? "Pale " : l > 0.7 ? "Light " : "";
  return tone ? tone + hue : hue[0]!.toUpperCase() + hue.slice(1);
}

function readColours(pages: Page[]): Read["colours"] {
  const count = new Map<string, number>();
  for (const p of pages) {
    const text = p.css + " " + [...p.html.matchAll(/\sstyle\s*=\s*"([^"]*)"/gi)].map((m) => m[1]).join(" ");
    for (const m of text.matchAll(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b|rgba?\([^)]*\)/gi)) {
      const hex = hexOf(m[0]);
      if (hex) count.set(hex, (count.get(hex) ?? 0) + 1);
    }
    const theme = meta(p.html, "theme-color");
    const t = theme && hexOf(theme);
    if (t) count.set(t, (count.get(t) ?? 0) + 25);
  }
  const ranked = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([hex]) => hex);
  const site = where(pages[0]?.url ?? "");
  const out: Read["colours"] = [];
  const near = (a: string, b: string) => {
    const x = hsl(a);
    const y = hsl(b);
    return (
      Math.abs(x.l - y.l) < 0.06 &&
      (Math.min(Math.abs(x.h - y.h), 360 - Math.abs(x.h - y.h)) < 12 || (x.s < 0.12 && y.s < 0.12))
    );
  };
  const take = (hex: string | undefined, role: Role, usage: string) => {
    if (!hex || out.some((c) => c.hex === hex || near(c.hex, hex))) return;
    const n = count.get(hex) ?? 0;
    out.push({
      name: colourName(hex),
      hex,
      role,
      usage,
      provenance: prov(`${site}, used ${n} times in its styles`, n > 20 ? "high" : n > 5 ? "medium" : "low"),
    });
  };
  const coloured = ranked.filter((x) => hsl(x).s >= 0.2 && hsl(x).l > 0.08 && hsl(x).l < 0.92);
  take(
    ranked.find((x) => hsl(x).l < 0.25),
    "text",
    "Text and dark grounds",
  );
  take(
    ranked.find((x) => hsl(x).l > 0.9),
    "ground",
    "Backgrounds",
  );
  take(coloured[0], "primary", "The site's own colour, used most");
  take(
    coloured.find((x) => !out.some((c) => near(c.hex, x))),
    "accent",
    "Accents and buttons",
  );
  for (const x of coloured) if (out.length < 6) take(x, "support", "Also on the site");
  return out;
}

// ─── Typefaces ───────────────────────────────────────────────────────────────

const GENERIC = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-sans-serif",
  "ui-serif",
  "ui-monospace",
  "-apple-system",
  "blinkmacsystemfont",
  "segoe ui",
  "roboto",
  "helvetica neue",
  "helvetica",
  "arial",
  "inherit",
  "initial",
  "unset",
  "apple color emoji",
  "segoe ui emoji",
  "segoe ui symbol",
  "noto color emoji",
  "var",
  "sans",
  "times new roman",
  "times",
  "georgia",
  "courier new",
  "courier",
  "verdana",
  "tahoma",
]);

function readTypefaces(pages: Page[], brand: string): Read["typefaces"] {
  const count = new Map<string, { n: number; display: number; serif: boolean; weights: Set<string> }>();
  // A face the site loads itself (@font-face) is the brand's choice, however common the face: Anthem sets its headlines
  // and buttons in Roboto from its own files, and the reader took Roboto for a system face (9 Nov).
  const hosted = new Set<string>();
  for (const p of pages)
    for (const m of p.css.matchAll(/@font-face\s*\{[^}]*?font-family\s*:\s*["']?([^;"'}]+)/gi)) hosted.add(m[1]!.trim().toLowerCase());
  const add = (raw: string, display: boolean, block = "") => {
    const families = raw.split(",").map((f) =>
      nextFont(
        f
          .trim()
          .replace(/^["']|["']$/g, "")
          .trim(),
      ),
    );
    const name = families.find(
      (f) =>
        f &&
        f.length <= 40 &&
        !/[:;(){}]/.test(f) &&
        (!GENERIC.has(f.toLowerCase()) || hosted.has(f.toLowerCase())) &&
        !NOT_TEXT_FACE.test(f),
    );
    if (!name) return;
    const c = count.get(name) ?? {
      n: 0,
      display: 0,
      serif: families.some((f) => f.toLowerCase() === "serif"),
      weights: new Set(),
    };
    c.n++;
    if (display) c.display++;
    for (const w of block.matchAll(/font-weight\s*:\s*(\d{3})/g)) c.weights.add(w[1]!);
    count.set(name, c);
  };
  for (const p of pages) {
    for (const m of p.css.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
      const sel = m[1]!;
      const block = m[2]!;
      if (/@font-face/i.test(sel)) continue;
      // A video player, a carousel or a widget brings its own face for its own controls, not the brand's.
      if (/vjs|video-js|player|plyr|slick|swiper|flickity|fancybox|lightbox|cookie|consent|chat-?widget/i.test(sel)) continue;
      const fam = /font-family\s*:\s*([^;}]+)/i.exec(block)?.[1];
      if (fam) add(fam, /\bh[1-3]\b|title|heading|display|hero/i.test(sel), block);
      // Themes name their faces in custom properties: --font-heading-family: "Canela", serif.
      for (const v of block.matchAll(/--[\w-]*font[\w-]*\s*:\s*([^;}]+)/gi))
        if (/["']/.test(v[1]!)) add(v[1]!, /head|display|title/i.test(v[0]), block);
    }
    for (const m of p.html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'\s>]+)/gi))
      for (const f of decode(m[1]!).matchAll(/family=([^&:]+)/g))
        add(decodeURIComponent(f[1]!.replace(/\+/g, " ")), false);
  }
  const ranked = [...count.entries()].sort((a, b) => b[1].n - a[1].n);
  if (!ranked.length) return [];
  const display = [...ranked].sort((a, b) => b[1].display - a[1].display)[0]!;
  const body = ranked.find(([n]) => n !== display[0]);
  const site = where(pages[0]?.url ?? "");
  const face = (
    [name, c]: [string, { n: number; display: number; serif: boolean; weights: Set<string> }],
    role: "display" | "body",
  ) => ({
    name,
    role,
    cssFamily: `"${name}", ${c.serif ? "serif" : "sans-serif"}`,
    weights: [...c.weights].sort().slice(0, 4).length ? [...c.weights].sort().slice(0, 4) : ["400"],
    sample: role === "display" ? brand : "The quick brown fox jumps over the lazy dog",
    usage: role === "display" ? "Headlines" : "Body text",
    provenance: prov(`${site}, in its styles`, c.n > 5 ? "high" : "medium"),
  });
  return [face(display, "display"), ...(body ? [face(body, "body")] : [])];
}

// ─── Logo, pictures, words ───────────────────────────────────────────────────

function readLogos(pages: Page[], brand: string): Read["logos"] {
  const home = pages[0];
  if (!home) return [];
  const site = where(home.url);
  for (const m of home.html.matchAll(/<img\b[^>]*>/gi)) {
    const t = m[0];
    const hint = [attr(t, "src"), attr(t, "alt"), attr(t, "class"), attr(t, "id")].join(" ");
    if (!/logo/i.test(hint)) continue;
    const src = absolute(attr(t, "src") ?? "", home.url);
    if (!src) continue;
    return [
      {
        name: `${brand} logo`,
        wordmark: brand,
        image: src,
        use: "The logo on the site",
        ground: "light",
        provenance: prov(`${site}, the site's header`, "high"),
      },
    ];
  }
  for (const m of home.html.matchAll(/<link\b[^>]*>/gi)) {
    const t = m[0];
    if (!/apple-touch-icon|icon/i.test(attr(t, "rel") ?? "")) continue;
    const src = absolute(attr(t, "href") ?? "", home.url);
    if (src)
      return [
        {
          name: `${brand} mark`,
          wordmark: brand,
          image: src,
          use: "The site's icon",
          ground: "light",
          provenance: prov(`${site}, the site's icon`, "low"),
        },
      ];
  }
  return [
    {
      name: `${brand} wordmark`,
      wordmark: brand,
      use: "The name, set in the display face",
      ground: "light",
      provenance: prov(`${site}, no logo file found`, "low"),
    },
  ];
}

function readImagery(pages: Page[]): Read["imagery"] {
  const seen = new Set<string>();
  const out: Read["imagery"] = [];
  for (const p of pages) {
    const site = where(p.url);
    const og = meta(p.html, "og:image");
    const candidates: { src?: string; alt: string; size: number }[] = og
      ? [{ src: og, alt: meta(p.html, "og:title"), size: 9999 }]
      : [];
    for (const m of p.html.matchAll(/<img\b[^>]*>/gi)) {
      const t = m[0];
      const set = attr(t, "srcset") ?? attr(t, "data-srcset");
      const best = set
        ?.split(",")
        .map((s) => s.trim().split(/\s+/))
        .sort((a, b) => parseInt(b[1] ?? "0") - parseInt(a[1] ?? "0"))[0]?.[0];
      const src = best ?? attr(t, "src") ?? attr(t, "data-src");
      const width = parseInt(attr(t, "width") ?? "0") || (set ? 1000 : 0);
      candidates.push({ src, alt: decode(attr(t, "alt") ?? ""), size: width });
    }
    for (const c of candidates) {
      // Shopify's {width} placeholder and size suffixes name the same picture several times.
      const src = c.src && absolute(c.src.replace(/\{width\}|%7Bwidth%7D/gi, "1200"), p.url);
      const same = src?.replace(/\?.*$/, "").replace(/_(\d+x\d*|\d*x\d+)(?=\.\w+$)/, "");
      if (
        !src ||
        !same ||
        seen.has(same) ||
        seen.has(src) ||
        /logo|icon|sprite|pixel|badge|payment|\.svg(\?|$)|\.gif(\?|$)/i.test(src)
      )
        continue;
      if (c.size && c.size < 400) continue;
      seen.add(same);
      out.push({
        image: src,
        caption: c.alt || "A picture from the site",
        group: /product|packshot|shop/i.test(src + c.alt) ? "product" : "look",
        provenance: prov(site, c.size >= 800 ? "medium" : "low"),
      });
      if (out.length >= 8) return out;
    }
  }
  return out;
}

function readVoice(pages: Page[]): Read["voice"] {
  const home = pages[0];
  if (!home) return [];
  const site = where(home.url);
  const description = meta(home.html, "description") || meta(home.html, "og:description");
  const heads = [...home.html.matchAll(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/gi)]
    .map((m) => decode(m[1]!))
    .filter((h) => h.length > 3 && h.length < 140);
  const out: Read["voice"] = [];
  if (description)
    out.push({
      statement: "How the brand describes itself",
      example: description.slice(0, 240),
      provenance: prov(`${site}, its description`, "medium"),
    });
  if (heads[0])
    out.push({
      statement: "How the site opens",
      example: heads[0],
      provenance: prov(`${site}, the first headline`, "medium"),
    });
  if (heads[1])
    out.push({
      statement: "A headline on the site",
      example: heads[1],
      provenance: prov(`${site}, a headline`, "low"),
    });
  return out;
}

/** The brand's name as the site gives it. */
export function brandName(home: Page, fallback: string): string {
  const name =
    meta(home.html, "og:site_name") ||
    decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(home.html)?.[1] ?? "").split(/\s[|–—-]\s/)[0] ||
    "";
  return name.trim().slice(0, 60) || fallback;
}

export function readBrand(pages: Page[], brand: string): Read {
  return {
    colours: readColours(pages),
    typefaces: readTypefaces(pages, brand),
    logos: readLogos(pages, brand),
    voice: readVoice(pages),
    imagery: readImagery(pages),
  };
}

/** The links on the home page worth reading too: about, the story, products. */
export function morePages(home: Page, max = 2): string[] {
  const host = new URL(home.url).host;
  const out: string[] = [];
  for (const m of home.html.matchAll(/<a\b[^>]*>/gi)) {
    const href = absolute(attr(m[0], "href") ?? "", home.url);
    if (!href || new URL(href).host !== host || out.includes(href) || href === home.url) continue;
    if (
      /\/(about|om-oss|om|story|our-story|historie|products?|produkter|shop|collections?)(\/|$|\?)/i.test(
        new URL(href).pathname,
      )
    )
      out.push(href);
    if (out.length >= max) break;
  }
  return out;
}

/** The stylesheets a page links to (the first few, on the same site or a CDN). */
export function stylesheets(page: Page, max = 4): string[] {
  const out: string[] = [];
  for (const m of page.html.matchAll(/<link\b[^>]*>/gi)) {
    if (!/stylesheet/i.test(attr(m[0], "rel") ?? "")) continue;
    const href = absolute(attr(m[0], "href") ?? "", page.url);
    if (href && !/fonts\.googleapis/.test(href) && !out.includes(href)) out.push(href);
    if (out.length >= max) break;
  }
  return out;
}

export const inlineCss = (html: string) =>
  [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");

/**
 * A face as Next.js names it in its stylesheets ("__Open_Sans_227a9f", "__Inter_Fallback_e8ce0c") is the face it
 * loads: "Open Sans". Its fallback copy is a local system face, not the brand's.
 */
/** A face a widget, a player or an icon set brings to the page, never the brand's own type. */
export const NOT_TEXT_FACE = /icon|awesome|glyph|star|slick|swiper|judgeme|emoji|symbol|video\s?js|vjs|player|plyr|flickity|fancybox|lightbox|katex|mathjax/i;

export function nextFont(family: string): string {
  const m = /^__(.+?)_[0-9a-f]{6}$/i.exec(family);
  if (!m) return family;
  const name = m[1].replace(/_/g, " ").trim();
  return /\bFallback$/i.test(name) ? "" : name;
}
