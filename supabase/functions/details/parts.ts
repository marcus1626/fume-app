// The validation machine (docs/mvp/product-parts.md): every part of the product checked on the picture against the real
// product, not only its print. Once per product, the language model maps the product's parts from its own photographs
// (the collar, the buttons and how many, the cuffs, the pockets, a zip, the label, the pattern, the fabric, the finish,
// the shape). Each picture's check then
//   1. finds each part on the picture: shown, hidden (this view does not show it, no fault) or missing,
//   2. crops each part shown, on the picture and on the photograph, and compares the two,
//   3. lets code decide: a different count, a missing part (said twice), a difference (said twice), or a colour far
//      from the product's (measured by the design service, not by a model).
// It helps the expert; it never checks a picture in their place.
import type { Rect } from "../fix/handler.ts";
import type { Deps, Detail, Take } from "./handler.ts";

export type PartKind = "count" | "present" | "look";
/** One part of the product, as mapped from its photographs. `photo` is the file id of the photograph it shows best on. */
export type Part = { key: string; kind: PartKind; what: string; count: number | null; looks: string; photo: string | null; box: Rect | null };
/** A part as the map model answers it: `photo` is the photograph's number, 1 the first. */
export type MappedPart = Omit<Part, "photo"> & { photo: number };
export type Located = { key: string; shown: "yes" | "hidden" | "missing"; box: Rect | null };
export type Compared = { shows: string; whole: boolean; count: number | null; same: boolean; note: string };
export type Tone = { l: number; a: number; b: number };

/** At most this many parts are compared on one picture. */
export const MOST_PARTS = 8;
/** The parts' details are numbered from here, after the print's, so their crops have their own names. */
const FIRST_N = 11;

const round = (n: number) => Math.round(n * 10_000) / 10_000;

/** A part's box with room around it, kept inside the picture; unlike print, a part can be most of the product. */
export function roomy(b: Rect | null | undefined): Rect | null {
  if (!b || ![b.x, b.y, b.w, b.h].every((n) => Number.isFinite(n)) || b.w <= 0 || b.h <= 0) return null;
  const pad = 0.15;
  const x = Math.max(0, b.x - b.w * pad), y = Math.max(0, b.y - b.h * pad);
  const w = Math.min(1 - x, b.w * (1 + 2 * pad)), h = Math.min(1 - y, b.h * (1 + 2 * pad));
  return w >= 0.02 && h >= 0.02 ? { x: round(x), y: round(y), w: round(w), h: round(h) } : null;
}

const clean = (b: Rect | null | undefined): Rect | null =>
  b && [b.x, b.y, b.w, b.h].every((n) => Number.isFinite(n)) && b.w > 0 && b.h > 0
    ? { x: round(Math.max(0, b.x)), y: round(Math.max(0, b.y)), w: round(Math.min(1, b.w)), h: round(Math.min(1, b.h)) }
    : null;

/** The map, kept as the function stores it: photographs by file id, keys unique, at most twelve parts. */
export function keepMap(mapped: MappedPart[], photoIds: string[]): Part[] {
  const seen = new Set<string>();
  const out: Part[] = [];
  for (const p of mapped) {
    const key = p.key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      key, kind: p.kind, what: p.what.slice(0, 80), count: p.kind === "count" && Number.isInteger(p.count) && p.count! > 0 ? p.count : null,
      looks: p.looks.slice(0, 240), photo: photoIds[p.photo - 1] ?? null, box: clean(p.box),
    });
  }
  return out.slice(0, 12);
}

const HUES: [number, string][] = [[20, "red"], [55, "orange"], [100, "yellow"], [160, "green"], [215, "teal"], [290, "blue"], [330, "purple"], [360, "pink"]];
/** A plain colour word for a Lab colour, for the designer's note. */
export function colourWord(t: Tone): string {
  const c = Math.hypot(t.a, t.b);
  if (c < 12) return t.l > 80 ? "white" : t.l < 25 ? "black" : "grey";
  const h = (Math.atan2(t.b, t.a) * 180) / Math.PI;
  const hue = HUES.find(([to]) => (h < 0 ? h + 360 : h) < to)?.[1] ?? "red";
  return t.l < 35 ? `dark ${hue}` : t.l > 75 ? `light ${hue}` : hue;
}

/**
 * Whether the part's colour on the picture is far from the product's, measured by code. The light of a scene moves a
 * colour; a different colour moves its hue or its chroma a long way, so only that is called wrong.
 */
export function colourOff(on: Tone | null, real: Tone | null): boolean {
  if (!on || !real) return false;
  const c1 = Math.hypot(on.a, on.b), c2 = Math.hypot(real.a, real.b);
  if (c1 >= 20 && c2 >= 20) {
    let dh = Math.abs(Math.atan2(on.b, on.a) - Math.atan2(real.b, real.a)) * 180 / Math.PI;
    if (dh > 180) dh = 360 - dh;
    return dh > 50;
  }
  // One of them grey: a coloured part drawn grey, or a grey one drawn coloured.
  return Math.abs(c1 - c2) > 30;
}

type Crop = { link: string; tone: Tone | null };

async function cut(t: Take, d: Deps, picture: string, box: Rect, path: string): Promise<Crop | null> {
  const up = await d.service.uploadLink(t.store.bucket, path);
  const r = up ? await d.step({ op: "fix-crop", picture, box, upload: { crop: up } }) : null;
  const link = r?.ok ? await d.service.readLink(t.store.bucket, path) : null;
  return link ? { link, tone: (r!.body.tone as Tone | null) ?? null } : null;
}

/** Maps each product that has no map for its photographs yet, and keeps it. What it cost counts on the map. */
async function mapParts(t: Take, d: Deps, links: Map<string, string>): Promise<{ product: Take["products"][number]; parts: Part[] }[]> {
  return await Promise.all(t.products.map(async (p) => {
    if (p.parts) return { product: p, parts: p.parts };
    const pictures = (p.pictures ?? []).filter((x) => x.file_id && links.has(x.file_id));
    if (pictures.length === 0) return { product: p, parts: [] };
    const name = p.variant ? `${p.name} (${p.variant})` : p.name;
    const made = await d.map({ photoUrls: pictures.map((x) => links.get(x.file_id!)!), product: name });
    const parts = keepMap(made.parts, pictures.map((x) => x.file_id!));
    if (p.id) await d.service.setParts(p.id, parts, pictures.map((x) => x.file_id!), made.model, made.usd);
    return { product: p, parts };
  }));
}

/** Checks every part of the product on the picture. Answers the details found and what the checks cost. */
export async function checkParts(t: Take, d: Deps, picture: string): Promise<{ details: Detail[]; usd: number }> {
  const links = new Map<string, string>();
  for (const x of t.products.flatMap((p) => p.pictures ?? [])) {
    if (x.file_id && !links.has(x.file_id)) {
      const link = await d.service.readLink(x.bucket, x.path);
      if (link) links.set(x.file_id, link);
    }
  }
  if (links.size === 0) return { details: [], usd: 0 };
  const maps = await mapParts(t, d, links);
  const parts = maps.flatMap((m) => m.parts.map((part) => ({ ...part, id: `${m.product.id ?? m.product.name}:${part.key}`, product: m.product.name })));
  if (parts.length === 0) return { details: [], usd: 0 };
  let usd = 0;
  const photoUrls = [...links.values()].slice(0, 3);
  const ask = parts.map((p) => ({ key: p.id, what: `${p.what} of the ${p.product}`, looks: p.looks }));
  const first = await d.locate({ pictureUrl: picture, photoUrls, parts: ask });
  usd += first.usd;
  let found = new Map(first.parts.map((l) => [l.key, l]));
  // A part said to be missing is looked for once more; only a part missing twice is called missing.
  if ([...found.values()].some((l) => l.shown === "missing")) {
    const again = await d.locate({ pictureUrl: picture, photoUrls, parts: ask });
    usd += again.usd;
    const second = new Map(again.parts.map((l) => [l.key, l]));
    found = new Map([...found].map(([k, l]) => [k, l.shown === "missing" && second.get(k)?.shown !== "missing" ? { ...l, shown: second.get(k)?.shown ?? "hidden", box: second.get(k)?.box ?? l.box } : l]));
  }
  const out: Detail[] = [];
  let n = FIRST_N - 1;
  const work: Promise<void>[] = [];
  for (const p of parts) {
    const l = found.get(p.id);
    if (!l || l.shown === "hidden") continue;
    const box = clean(l.box);
    if (!box) continue;
    if (l.shown === "missing") {
      n += 1;
      out.push({ n, kind: "part", part: p.key, what: p.what, box, reads: "Not on the picture.", expected: p.looks, ok: false,
        note: `The ${p.what} is missing; on the product: ${p.looks}`.slice(0, 300) });
      continue;
    }
    if (out.length + work.length >= MOST_PARTS) continue;
    const at = (n += 1);
    work.push((async () => {
      const onPicture = await cut(t, d, picture, roomy(box)!, `${t.store.prefix}-${at}.png`);
      const photo = p.photo ? links.get(p.photo) : null;
      const photoBox = roomy(p.box);
      const real = photo && photoBox ? await cut(t, d, photo, photoBox, `${t.store.prefix}-${at}-ref.png`) : null;
      if (!onPicture) return;
      // Without the real one to compare against, nothing is called wrong.
      if (!real) {
        out.push({ n: at, kind: "part", part: p.key, what: p.what, box, reads: "", expected: p.looks, ok: true });
        return;
      }
      const part = { what: p.what, looks: p.looks, count: p.count };
      let r = await d.compare({ cropUrl: onPicture.link, refUrl: real.link, part });
      usd += r.usd;
      const counted = (c: Compared) => p.count != null && c.whole && c.count != null && c.count !== p.count;
      // The model is asked twice before a part is called different, so a doubt of its own does not flag the picture.
      if (!r.same || counted(r)) {
        const again = await d.compare({ cropUrl: onPicture.link, refUrl: real.link, part });
        usd += again.usd;
        if (again.same && !counted(again)) r = again;
      }
      const tone = colourOff(onPicture.tone, real.tone);
      const wrongCount = counted(r);
      const ok = r.same && !wrongCount && !tone;
      const note = wrongCount
        ? `The picture shows ${r.count} ${p.what}; the product has ${p.count}.`
        : !r.same
        ? (r.note || `The ${p.what} looks different from the product: ${p.looks}`)
        : tone
        ? `The ${p.what} is ${colourWord(onPicture.tone!)} on the picture; on the product it is ${colourWord(real.tone!)}.`
        : "";
      out.push({ n: at, kind: "part", part: p.key, what: p.what, box, reads: r.shows.slice(0, 200), expected: p.looks.slice(0, 200), ok,
        ...(ok ? {} : { note: note.slice(0, 300) }) });
    })());
  }
  await Promise.all(work);
  return { details: out.sort((a, b) => a.n - b.n), usd };
}
