// The edge function `details` (docs/mvp/detail-read.md): the picture check reads the product's small print. After the
// Engine looks at a picture, it asks this function to read it closer:
//   1. the language model finds where the product shows printed letters, a wordmark or a logo, and the same place on the
//      product's own photographs,
//   2. the design service crops each close, on the picture and on the photograph (fix-crop),
//   3. the language model reads each close crop against the real one, letter for letter,
//   4. details_finish keeps what it read; a label that reads wrong flags the picture's product truth with a note, and
//      its place is where the designer fixes it with the real product.
// It helps the expert; it never checks a picture in their place. handler.test.ts runs it without Supabase or a model.
import { generous, type Rect } from "../fix/handler.ts";

export type Take = {
  candidate_id: string;
  workspace_id: string;
  brand: { name: string | null; language: string | null };
  picture: { bucket: string; path: string; width: number | null; height: number | null };
  products: { name: string; variant: string | null; pictures: { bucket: string; path: string }[] }[];
  store: { bucket: string; prefix: string };
};

/** A place on the picture where the product shows print, and the same place on one of its photographs. */
export type Place = { what: string; box: Rect; photo: number; photoBox: Rect | null };
export type Read = { reads: string; expected: string; ok: boolean; note: string };
export type Detail = { n: number; what: string; box: Rect; reads: string; expected: string; ok: boolean; note?: string };

type Failure = { message: string } | null;

export interface Deps {
  /** The caller may read the candidate: Fume's staff, or the Engine itself. */
  canRead(candidateId: string): Promise<boolean>;
  service: {
    take(candidateId: string): Promise<{ data: Take | null; error: Failure }>;
    finish(candidateId: string, details: Detail[], usd: number): Promise<{ error: Failure }>;
    readLink(bucket: string, path: string): Promise<string | null>;
    uploadLink(bucket: string, path: string): Promise<string | null>;
  };
  step(request: Record<string, unknown>): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }>;
  find(r: { pictureUrl: string; photoUrls: string[]; products: string }): Promise<{ places: Place[]; usd: number }>;
  read(r: { cropUrl: string; refUrl: string | null; what: string }): Promise<Read & { usd: number }>;
  /** Finds the part again on a wider crop, for a tight box there (shares of the crop), or null. */
  refine(r: { cropUrl: string; what: string }): Promise<{ box: Rect | null; usd: number }>;
  later(work: Promise<unknown>): void;
}

/** At most this many places are read on one picture. */
export const MOST = 3;

/** The letters alone, for comparing what two crops read: case, spacing and marks aside. */
export const letters = (s: string) => s.normalize("NFKD").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();

/**
 * Whether a detail reads right. Code compares the letters the model read on both crops: the same letters are right,
 * whatever the model said; different letters are wrong. When one of them could not be read, the model's word stands.
 */
export function readsRight(r: Read): boolean {
  const a = letters(r.reads), b = letters(r.expected);
  if (a && b) return a === b;
  return r.ok;
}

/**
 * A close crop to read, in Fume's storage: first a wider crop around the model's box, where the model finds the part
 * again (its first box can be off by a label's height), then a close crop of that, enlarged. Answers a link to it.
 */
async function closeIn(t: Take, d: Deps, picture: string, box: Rect, what: string, path: string, spent: { usd: number }): Promise<string | null> {
  const cut = async (b: Rect, read: boolean) => {
    const up = await d.service.uploadLink(t.store.bucket, path);
    const r = up ? await d.step({ op: "fix-crop", picture, box: b, ...(read ? { read: true } : {}), upload: { crop: up } }) : null;
    const link = r?.ok ? await d.service.readLink(t.store.bucket, path) : null;
    return r && link ? { link, rect: r.body.rect as Rect, width: Number(r.body.width), height: Number(r.body.height) } : null;
  };
  const wide = await cut(box, false);
  if (!wide) return null;
  const again = await d.refine({ cropUrl: wide.link, what });
  spent.usd += again.usd;
  const g = again.box;
  const { rect: r, width: W, height: H } = wide;
  const tight = g && W > 0 && H > 0
    ? generous({ x: (r.x + g.x * r.w) / W, y: (r.y + g.y * r.h) / H, w: (g.w * r.w) / W, h: (g.h * r.h) / H })
    : null;
  return (await cut(tight ?? box, true))?.link ?? null;
}

export async function readDetails(t: Take, d: Deps): Promise<Detail[] | null> {
  let usd = 0;
  const out: Detail[] = [];
  try {
    const picture = await d.service.readLink(t.picture.bucket, t.picture.path);
    const photos = (await Promise.all(t.products.flatMap((p) => p.pictures).slice(0, 3).map((p) => d.service.readLink(p.bucket, p.path))))
      .filter((u): u is string => Boolean(u));
    if (!picture || photos.length === 0) {
      await d.service.finish(t.candidate_id, [], 0);
      return [];
    }
    const products = t.products.map((p) => (p.variant ? `${p.name} (${p.variant})` : p.name)).join("; ");
    const found = await d.find({ pictureUrl: picture, photoUrls: photos, products });
    usd += found.usd;
    let n = 0;
    for (const place of found.places.slice(0, MOST)) {
      const box = generous(place.box);
      if (!box) continue;
      n += 1;
      const spent = { usd: 0 };
      const cropUrl = await closeIn(t, d, picture, box, place.what, `${t.store.prefix}-${n}.png`, spent);
      if (!cropUrl) {
        usd += spent.usd;
        continue;
      }
      // The same place on the product's own photograph, when the model found it there.
      const photoBox = place.photoBox ? generous(place.photoBox) : null;
      const photo = place.photo >= 1 && place.photo <= photos.length ? photos[place.photo - 1] : null;
      const refUrl = photo && photoBox ? await closeIn(t, d, photo, photoBox, place.what, `${t.store.prefix}-${n}-ref.png`, spent) : null;
      usd += spent.usd;
      // The model tends to read a garbled word as the word it should be, never the other way: a read that finds the
      // letters right is read once more, and a mismatch in either is what stands.
      let r = await d.read({ cropUrl, refUrl, what: place.what });
      usd += r.usd;
      if (refUrl && readsRight(r)) {
        const again = await d.read({ cropUrl, refUrl, what: place.what });
        usd += again.usd;
        if (!readsRight(again)) r = again;
      }
      out.push({
        n, what: place.what.slice(0, 120), box: place.box, reads: r.reads.slice(0, 200), expected: r.expected.slice(0, 200),
        // Without the real one to read against, nothing is called wrong.
        ok: refUrl ? readsRight(r) : true,
        ...(refUrl && !readsRight(r) ? { note: (r.note || `The ${place.what} reads ${r.reads}; on the product it reads ${r.expected}.`).slice(0, 300) } : {}),
      });
    }
    await d.service.finish(t.candidate_id, out, usd);
    return out;
  } catch {
    // Not read: the expert checks the print by eye. What was read so far is kept.
    await d.service.finish(t.candidate_id, out, usd).catch(() => undefined);
    return null;
  }
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const answer = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

export async function handleDetails(req: Request, deps: (authorization: string) => Deps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return answer(400, { code: "invalid", message: "Use POST." });
  const authorization = req.headers.get("Authorization");
  if (!authorization) return answer(403, { code: "forbidden", message: "Sign in first." });
  let candidateId: unknown;
  try {
    candidateId = (await req.json()).candidateId;
  } catch {
    // handled below
  }
  if (typeof candidateId !== "string" || !/^[0-9a-f-]{36}$/i.test(candidateId)) return answer(400, { code: "invalid", message: "Name the picture." });
  const d = deps(authorization);
  if (!(await d.canRead(candidateId))) return answer(404, { code: "not_found", message: "No such picture." });
  const { data: take, error } = await d.service.take(candidateId);
  if (error) return answer(503, { code: "unavailable", message: error.message });
  if (!take) return answer(200, { reading: false });
  d.later(readDetails(take, d));
  return answer(202, { reading: true });
}
