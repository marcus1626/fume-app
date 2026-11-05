// The edge function `fix` (docs/mvp/picture-fix.md): the app calls it after fix_candidate. The caller's own token
// decides whether they may see the fix (picture_fixes is staff-only); the service role takes the work. The answer
// comes at once (202); the work goes on in the background:
//   1. the design service crops the marked part with room around it (fix-crop),
//   2. the image model redraws only that crop, with the product's own photographs as reference,
//   3. the design service sets the redrawn crop back with a soft edge (fix-set), so the rest keeps every pixel,
//   4. fix_finish adds the fixed picture as a candidate.
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

export type ImageAsk = { imageModel: string; text: string; referenceUrls: string[]; aspectRatio: string; resolution: string | null; seed: number | null };
export type Collected =
  | { state: "waiting" }
  | { state: "done"; urls: string[]; response: unknown }
  | { state: "failed"; error: string; final: boolean; response: unknown };

export interface Deps {
  canRead(fixId: string): Promise<boolean>;
  service: {
    take(fixId: string): Promise<{ data: Take | null; error: Failure }>;
    finish(fixId: string, result: Record<string, unknown>): Promise<{ error: Failure }>;
    fail(fixId: string, error: string, cents: number): Promise<{ error: Failure }>;
    /** A signed link to read a stored file. */
    readLink(bucket: string, path: string): Promise<string | null>;
    /** A signed link to upload to a path. */
    uploadLink(bucket: string, path: string): Promise<string | null>;
    /** Stores bytes the image model made, at a path. */
    store(bucket: string, path: string, bytes: Uint8Array): Promise<boolean>;
  };
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

/** What the image model is asked: the crop is image 1; the product's own photographs follow. */
export function promptOf(t: Take, references: number): string {
  const products = t.products.map((p) => (p.variant ? `${p.name} (${p.variant})` : p.name)).join("; ");
  const refs = references > 0
    ? `Images 2 to ${references + 1} are the product's own photographs. Every printed label, wordmark, logo, letter, stitch and detail of the product must match them exactly, letter for letter.`
    : "Every printed label, wordmark and letter must be crisp, correctly spelled and true to the brand.";
  return [
    `Image 1 is a close crop of a product photograph${t.brand.name ? ` made for ${t.brand.name}` : ""}${products ? `, showing ${products}` : ""}.`,
    `Redraw only what is wrong in it: ${t.ask}`,
    refs,
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
    const cut = await d.step({ op: "fix-crop", picture, box: t.box, upload: { crop: cropUp } });
    if (!cut.ok) return await fail(errorOf(cut.body, cut.status));
    const rect = cut.body.rect as Rect;
    const ratio = String(cut.body.ratio ?? "1:1");
    const cropRead = await d.service.readLink(t.store.bucket, t.store.crop);
    if (!cropRead) return await fail("Fume could not read the crop back.");
    // The product's own photographs, at most three, so the label is drawn from the real thing.
    const refs = (await Promise.all(t.products.flatMap((p) => p.pictures).slice(0, 3).map((p) => d.service.readLink(p.bucket, p.path))))
      .filter((u): u is string => Boolean(u));
    const text = promptOf(t, refs.length);
    const sent = await d.image.submit({ imageModel: MODEL, text, referenceUrls: [cropRead, ...refs], aspectRatio: ratio, resolution: "2K", seed: null });
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
    const { error } = await d.service.finish(t.fix_id, {
      png: { path: t.store.png, bytes: png.bytes, sha256: png.sha256 },
      width: set.body.width, height: set.body.height, drift: set.body.drift,
      prompt: text, model: MODEL, cost_cents: cents, ms: d.now() - started,
    });
    if (error) return await fail(error.message);
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
