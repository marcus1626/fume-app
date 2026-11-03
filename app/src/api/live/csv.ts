// A product CSV, read in the browser: any shop's export (Shopify, WooCommerce, a spreadsheet saved as CSV). The
// columns are matched to Fume's fields by their headings, in English and Norwegian; a row with a name is a product.
// Shopify writes one row per variant and picture under the same handle: those rows become one product.

/** Rows of cells. Quotes, doubled quotes and line breaks inside quotes are read; the separator is guessed. */
export function parseCsv(text: string): string[][] {
  const body = text.replace(/^﻿/, "");
  const first = body.split(/\r?\n/, 1)[0] ?? "";
  const sep = [",", ";", "\t"].sort((a, b) => count(first, b) - count(first, a))[0]!;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!;
    if (quoted) {
      if (c === '"' && body[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && body[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim()));
}

function count(line: string, sep: string): number {
  return line.split(sep).length - 1;
}

/** The Fume field a heading names, or null. */
const ALIASES: [field: string, words: RegExp][] = [
  ["handle", /^(handle|slug|url ?handle)$/],
  ["name", /^(title|name|product ?name|product ?title|produkt|produktnavn|navn|tittel)$/],
  ["variant", /^(variant|variant ?title|option1 ?value|size|størrelse|farge|colou?r)$/],
  ["sku", /^(sku|variant ?sku|item ?number|art(ikkel)?\.? ?nr\.?|varenummer|varenr\.?)$/],
  ["price", /^(price|variant ?price|regular ?price|pris|veil\.? ?pris)$/],
  ["type", /^(type|product ?type|category|categories|kategori|produkttype)$/],
  ["image", /^(image|image ?src|images|picture|bilde|bilder|image ?url|variant ?image)$/],
  ["description", /^(description|body( ?\(html\))?|short ?description|beskrivelse)$/],
  ["vendor", /^(vendor|brand|merke|leverandør)$/],
];

export function fieldOf(heading: string): string | null {
  const h = heading.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  return ALIASES.find(([, words]) => words.test(h))?.[0] ?? null;
}

const LABEL: Record<string, string> = {
  sku: "SKU",
  price: "Price",
  type: "Type",
  description: "In the CSV",
  vendor: "Brand",
};

const plain = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

export interface CsvFound {
  name: string;
  variant: string;
  confidence: "high" | "medium";
  images: string[];
  files: { name: string; kind: "spec" }[];
  fields: { fieldId: string; label: string; value: string; source: string }[];
  source: string;
}

/** The products in a CSV, one per product (Shopify's variant and picture rows folded in). */
export function productsFromCsv(text: string, fileName: string): { found: CsvFound[]; columns: string[] } {
  const [head, ...rest] = parseCsv(text);
  if (!head) return { found: [], columns: [] };
  const fields = head.map(fieldOf);
  const at = (row: string[], field: string) => {
    const i = fields.indexOf(field);
    return i < 0 ? "" : (row[i] ?? "").trim();
  };
  if (!fields.includes("name") && !fields.includes("handle")) return { found: [], columns: head };

  const byKey = new Map<string, CsvFound>();
  const order: string[] = [];
  let last: CsvFound | undefined;
  rest.forEach((row, n) => {
    const handle = at(row, "handle");
    const name = at(row, "name");
    // A Shopify row with only the handle (a picture or another variant) belongs to the product above.
    const key = handle || name;
    if (!key) return;
    let p = byKey.get(key);
    if (!p) {
      if (!name) {
        if (!last) return;
        p = last;
      } else {
        p = {
          name,
          variant: at(row, "variant").replace(/^default title$/i, ""),
          confidence: "high",
          images: [],
          files: [{ name: fileName, kind: "spec" }],
          fields: [],
          source: `${fileName}, row ${n + 2}`,
        };
        byKey.set(key, p);
        order.push(key);
      }
    }
    last = p;
    const image = at(row, "image");
    for (const src of image.split(/[\s,|]+/))
      if (/^https:\/\//.test(src) && !p.images.includes(src) && p.images.length < 8) p.images.push(src);
    for (const f of ["sku", "price", "type", "description", "vendor"]) {
      const value = f === "description" ? plain(at(row, f)).slice(0, 400) : at(row, f);
      if (value && !p.fields.some((x) => x.fieldId === f))
        p.fields.push({ fieldId: f, label: LABEL[f]!, value, source: `${fileName}, row ${n + 2}` });
    }
  });
  const found = order.map((k) => byKey.get(k)!).filter((p) => p.name);
  for (const p of found) if (!p.images.length && !p.fields.length) p.confidence = "medium";
  return { found, columns: head };
}
