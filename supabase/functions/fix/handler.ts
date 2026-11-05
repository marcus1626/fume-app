// The edge function `fix` (docs/mvp/picture-fix.md): the app calls it after fix_candidate. The caller's own token
// decides whether they may see the fix (picture_fixes is staff-only); the service role takes the work. The answer
// comes at once (202); the work goes on in the background:
//   1. the design service crops the marked part with room around it (fix-crop),
//   2. the language model finds where the same part shows best on the product's own photographs, and the design
//      service crops it close (fix-crop again), so the image model reads the real label letter for letter,
//   3. the image model redraws only the crop, with that close part and the product's own photographs as reference,
//   4. the design service sets the redrawn crop back with a soft edge (fix-set), so the rest keeps every pixel,
//   5. fix_finish adds the fixed picture as a candidate.
// handler.test.ts runs it without Supabase, fal or the design service.

export type Rect = { x: number; y: number; w: number; h: number };

export type Take = {
  fix_id: string;
  workspace_id: string;
  box: Rect;
  ask: string;
  brand: { name: string | null; language: string | null };
  picture: { bucket: string; path: string; width: number | null; height: number | null };
  products: { name: string; variant: string | null; pictures: { bucket: string; path: string }[] }[];
  store: { bucket: string; png: string; crop: string };
};

type Failure = { message: string } | null;

/** Where the marked part shows on the product's own photographs: photo counts from 1 in the order given. */
export type Found = { photo: number; box: Rect; why: string };

export type ImageAsk = { imageModel: string; text: string; referenceUrls: string[]; aspectRatio: string; resolution: string | null; seed: number | null };
export type Collected =
  | { state: "waiting" }
  | { state: "done"; urls: string[]; response: unknown }
  | { state: "failed"; error: string; final: boolean; response: unknown };

export interface Deps {
  canRead(fixId: string): Promise<boolean>;
  service: {
    take(fixId: string): Promise<{ data: Take | null; error: Failure }>;
    finish(fixId: string, result: Record<string, unknown>): Promise<{ data?: unknown; error: Failure }>;
    fail(fixId: string, error: string, cents: number): Promise<{ error: Failure }>;
    /** A signed link to read a stored file. */
    readLink(bucket: string, path: string): Promise<string | null>;
    /** A signed link to upload to a path. */
    uploadLink(bucket: string, path: string): Promise<string | null>;
    /** Stores bytes the image model made, at a path. */
    store(bucket: string, path: string, bytes: Uint8Array): Promise<boolean>;
    /** Records what finding the part cost, and where it was found. */
    spent(fixId: string, usd: number, reference: Found | null): Promise<{ error: Failure }>;
  };
  /** The language model looks at the crop (image 1) and the product's photographs, and finds the same part. */
  locate(r: { ask: string; cropUrl: string; photoUrls: string[] }): Promise<{ found: Found | null; usd: number }>;
  /** Asks the picture check to read the fixed picture's small print (docs/mvp/detail-read.md). */
  askDetails?(candidateId: string): Promise<void>;
  /** The design service's fix steps (services/design, POST /api/design with op). */
  step(request: Record<string, unknown>): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }>;
  image: {
    priceCents(model: string): number;
    submit(r: ImageAsk): Promise<{ ok: true; providerJobId: string } | { ok: false; error: string }>;
    collect(id: string): Promise<Collected>;
  };
  /** Reads the picture the image model made (its own address). */
  download(url: string): Promise<Uint8Array | null>;
  wait(ms: number): Promise<void>;
  later(work: Promise<unknown>): void;
  now(): number;
}

export const MODEL = "nano-banana-pro";

/**
 * What the image model is asked: the crop is image 1; the close part from the product's own photograph is image 2
 * when the language model found it; the product's own photographs follow.
 */
export function promptOf(t: Take, references: number, close: Found | null = null): string {
  const products = t.products.map((p) => (p.variant ? `${p.name} (${p.variant})` : p.name)).join("; ");
  const first = close ? 3 : 2;
  const lines: string[] = [];
  if (close) {
    lines.push(`Image 2 is a close crop of the same part on the product's own photograph (${close.why}). It is the truth: copy its letters, wordmark, logo, weight, spacing, colours and layout exactly, letter for letter, onto the part in image 1, in image 1's angle, light and focus.`);
  }
  if (references > 0) {
    lines.push(`${references === 1 ? `Image ${first} is` : `Images ${first} to ${first + references - 1} are`} the product's own photographs. Every printed label, wordmark, logo, letter, stitch and detail of the product must match them exactly, letter for letter.`);
  } else if (!close) {
    lines.push("Every printed label, wordmark and letter must be crisp, correctly spelled and true to the brand.");
  }
  return [
    `Image 1 is a close crop of a product photograph${t.brand.name ? ` made for ${t.brand.name}` : ""}${products ? `, showing ${products}` : ""}.`,
    `A part of it was wrong, and Fume has blanked that part to a plain patch of its own colour: ${t.ask}`,
    "Draw that part anew on the patch, so it looks as it does on the real product and sits in the photograph as if it was always there.",
    ...lines,
    "Keep everything else in image 1 exactly as it is: the same framing and crop, the same position, size and angle of the product, the same light, shadows, colours, materials, folds and grain.",
    "Output the same crop at the same aspect ratio. No new objects, no people, and no words that are not on the product itself.",
  ].join("\n");
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const answer = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const errorOf = (body: Record<string, unknown>, status: number) =>
  typeof body.error === "string" ? body.error : `The design service answered ${status}.`;

/** A box the language model gave, made a little more generous and kept inside the photograph. */
export function generous(b: Rect): Rect | null {
  if (![b.x, b.y, b.w, b.h].every((n) => Number.isFinite(n)) || b.w <= 0 || b.h <= 0) return null;
  const pad = 0.25;
  const x = Math.max(0, b.x - b.w * pad), y = Math.max(0, b.y - b.h * pad);
  const w = Math.min(1 - x, b.w * (1 + 2 * pad)), h = Math.min(1 - y, b.h * (1 + 2 * pad));
  const r = (n: number) => Math.round(n * 10_000) / 10_000;
  return w >= 0.02 && h >= 0.02 && w * h <= 0.5 ? { x: r(x), y: r(y), w: r(w), h: r(h) } : null;
}

const refPathOf = (t: Take) => t.store.crop.replace(/-crop\.png$/, "-ref.png");

type Close = { link: string; rect: Rect; width: number; height: number };

/** Crops the part close from the product's photograph into Fume's storage: a link to read it, and where it was cut. */
async function closeCrop(t: Take, d: Deps, photo: string, box: Rect): Promise<Close | null> {
  const up = await d.service.uploadLink(t.store.bucket, refPathOf(t));
  const cut = up ? await d.step({ op: "fix-crop", picture: photo, box, upload: { crop: up } }) : null;
  const link = cut?.ok ? await d.service.readLink(t.store.bucket, refPathOf(t)) : null;
  return cut && link ? { link, rect: cut.body.rect as Rect, width: Number(cut.body.width), height: Number(cut.body.height) } : null;
}

export async function fixPicture(t: Take, d: Deps): Promise<"made" | "failed"> {
  const started = d.now();
  let cents = 0;
  const fail = async (why: string) => {
    await d.service.fail(t.fix_id, why, cents);
    return "failed" as const;
  };
  try {
    const picture = await d.service.readLink(t.picture.bucket, t.picture.path);
    const cropUp = await d.service.uploadLink(t.store.bucket, t.store.crop);
    if (!picture || !cropUp) return await fail("Fume could not make the storage links.");
    // The marked part is blanked in the crop, so the image model draws it anew instead of keeping the wrong letters.
    const cut = await d.step({ op: "fix-crop", picture, box: t.box, blank: true, upload: { crop: cropUp } });
    if (!cut.ok) return await fail(errorOf(cut.body, cut.status));
    const rect = cut.body.rect as Rect;
    const ratio = String(cut.body.ratio ?? "1:1");
    const cropRead = await d.service.readLink(t.store.bucket, t.store.crop);
    if (!cropRead) return await fail("Fume could not read the crop back.");
    // The product's own photographs, at most three, so the label is drawn from the real thing.
    const refs = (await Promise.all(t.products.flatMap((p) => p.pictures).slice(0, 3).map((p) => d.service.readLink(p.bucket, p.path))))
      .filter((u): u is string => Boolean(u));
    // The same part, close, from the product's own photograph: a label is a few dozen pixels on a whole packshot.
    // The language model finds it, and then finds it again on its own close crop, for a tight box.
    let close: Found | null = null;
    let closeRead: string | null = null;
    if (refs.length > 0) {
      let usd = 0;
      try {
        const first = await d.locate({ ask: t.ask, cropUrl: cropRead, photoUrls: refs });
        usd += first.usd;
        const box = first.found && first.found.photo >= 1 && first.found.photo <= refs.length ? generous(first.found.box) : null;
        const photo = first.found && box ? refs[first.found.photo - 1] : null;
        if (first.found && box && photo) {
          const cut = await closeCrop(t, d, photo, box);
          if (cut) {
            close = { ...first.found, box };
            closeRead = cut.link;
            const again = await d.locate({ ask: t.ask, cropUrl: cropRead, photoUrls: [cut.link] });
            usd += again.usd;
            const g = again.found?.photo === 1 ? again.found.box : null;
            const { rect: r, width: W, height: H } = cut;
            const tight = g && W > 0 && H > 0
              ? generous({ x: (r.x + g.x * r.w) / W, y: (r.y + g.y * r.h) / H, w: (g.w * r.w) / W, h: (g.h * r.h) / H })
              : null;
            const tighter = tight ? await closeCrop(t, d, photo, tight) : null;
            if (tight && tighter) {
              close = { ...close, box: tight, why: again.found?.why || close.why };
              closeRead = tighter.link;
            }
          }
        }
      } catch {
        // the fix goes on with what was found, or with the whole photographs
      }
      await d.service.spent(t.fix_id, usd, close);
    }
    const text = promptOf(t, refs.length, close);
    const referenceUrls = [cropRead, ...(closeRead ? [closeRead] : []), ...refs];
    const sent = await d.image.submit({ imageModel: MODEL, text, referenceUrls, aspectRatio: ratio, resolution: "2K", seed: null });
    if (!sent.ok) return await fail(sent.error);
    cents = d.image.priceCents(MODEL);
    let got: Collected = { state: "waiting" };
    for (let i = 0; i < 40 && got.state === "waiting"; i++) {
      await d.wait(i < 5 ? 3_000 : 5_000);
      got = await d.image.collect(sent.providerJobId);
    }
    if (got.state === "waiting") return await fail("The image model took too long.");
    if (got.state === "failed") return await fail(got.error);
    const bytes = await d.download(got.urls[0]);
    if (!bytes) return await fail("Fume could not read the redrawn part.");
    const redrawnPath = t.store.crop.replace(/-crop\.png$/, "-redrawn.png");
    if (!(await d.service.store(t.store.bucket, redrawnPath, bytes))) return await fail("Fume could not store the redrawn part.");
    const redrawn = await d.service.readLink(t.store.bucket, redrawnPath);
    const pngUp = await d.service.uploadLink(t.store.bucket, t.store.png);
    if (!redrawn || !pngUp) return await fail("Fume could not make the storage links.");
    const set = await d.step({ op: "fix-set", picture, redrawn, rect, box: t.box, upload: { png: pngUp } });
    if (!set.ok) return await fail(errorOf(set.body, set.status));
    const png = set.body.png as { bytes: number; sha256: string };
    const { data, error } = await d.service.finish(t.fix_id, {
      png: { path: t.store.png, bytes: png.bytes, sha256: png.sha256 },
      width: set.body.width, height: set.body.height, drift: set.body.drift,
      prompt: text, model: MODEL, cost_cents: cents, ms: d.now() - started,
    });
    if (error) return await fail(error.message);
    // The fixed picture's small print is read again, so the designer sees whether the fix holds.
    const made = (data as { candidate_id?: string } | null)?.candidate_id;
    if (made) await d.askDetails?.(made).catch(() => undefined);
    return "made";
  } catch (e) {
    return await fail(e instanceof Error ? e.message : String(e));
  }
}

export async function handleFix(req: Request, deps: (authorization: string) => Deps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return answer(400, { code: "invalid", message: "Use POST." });
  const authorization = req.headers.get("Authorization");
  if (!authorization) return answer(403, { code: "forbidden", message: "Sign in first." });
  let fixId: unknown;
  try {
    fixId = (await req.json()).fixId;
  } catch {
    // handled below
  }
  if (typeof fixId !== "string" || !/^[0-9a-f-]{36}$/i.test(fixId)) return answer(400, { code: "invalid", message: "Name the fix." });
  const d = deps(authorization);
  if (!(await d.canRead(fixId))) return answer(404, { code: "not_found", message: "No such fix." });
  const { data: take, error } = await d.service.take(fixId);
  if (error) return answer(503, { code: "unavailable", message: error.message });
  if (!take) return answer(200, { fixing: false });
  d.later(fixPicture(take, d));
  return answer(202, { fixing: true });
}
