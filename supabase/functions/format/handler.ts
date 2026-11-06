// The edge function `format` (docs/mvp/formats.md): the app calls it after make_format. The caller's own token decides
// whether they may see the make (format_makes is staff-only); the service role takes the work. The answer comes at
// once (202); the work goes on in the background:
//   1. unless the designer chose, the language model finds what must stay whole on the master (the product),
//   2. the design service chooses (op format): a crop when the product fits the new shape with air around it, and
//      makes it from the master's own pixels; else it pads the master onto the new shape,
//   3. for an expansion, the image model draws only the new edges, and the design service sets every pixel of the
//      master back on its drawing (format-set),
//   4. format_finish adds the format as a candidate of the format's job, saying how it was made and why.
// A redraw (only when the designer asks): the image model draws the picture again in the new shape, from the master
// and the product's own photographs; the design service cuts it to the exact shape (format-drawn), and the Engine looks
// at the product against its photographs, as for any new picture (engine_evaluated).
// handler.test.ts runs it without Supabase, fal, the model or the design service.

export type Rect = { x: number; y: number; w: number; h: number };

export type Take = {
  make_id: string;
  workspace_id: string;
  asked: "crop" | "expand" | "regenerate" | null;
  window: Rect | null;
  format: string;
  brand: { name: string | null };
  products?: { name: string; variant: string | null; pictures: { bucket: string; path: string }[] }[];
  picture: { bucket: string; path: string; width: number | null; height: number | null };
  store: { bucket: string; prefix: string };
};

type Failure = { message: string } | null;

export type ImageAsk = {
  imageModel: string; text: string; referenceUrls: string[]; aspectRatio: string; resolution: string | null; seed: number | null;
  expand?: { canvas: [number, number]; size: [number, number]; at: [number, number] };
};

/** Models that only extend a picture: they take the master itself and its place on the canvas, not the padded one. */
export const OUTPAINTERS = new Set(["bria-expand"]);
export type Collected =
  | { state: "waiting" }
  | { state: "done"; urls: string[]; response: unknown }
  | { state: "failed"; error: string; final: boolean; response: unknown };

export interface Deps {
  canRead(makeId: string): Promise<boolean>;
  service: {
    take(makeId: string): Promise<{ data: Take | null; error: Failure }>;
    finish(makeId: string, result: Record<string, unknown>): Promise<{ data?: { candidate_id?: string } | null; error: Failure }>;
    fail(makeId: string, error: string, cents: number, usd: number): Promise<{ error: Failure }>;
    readLink(bucket: string, path: string): Promise<string | null>;
    uploadLink(bucket: string, path: string): Promise<string | null>;
    store(bucket: string, path: string, bytes: Uint8Array): Promise<boolean>;
    /** The image model named for a task (task_model), when one is. */
    model?(task: "expand" | "regenerate"): Promise<string | null>;
    /** The Engine's look at a new picture, kept on its candidate (engine_evaluated). */
    evaluated?(candidateId: string, evaluation: Record<string, unknown>, usd: number): Promise<{ error: Failure }>;
  };
  /** The Engine looks at a redrawn format: is the product the product in its photographs? */
  look?(r: { pictureUrl: string; productUrls: string[]; size: { width: number; height: number } }): Promise<{ evaluation: Record<string, unknown>; usd: number }>;
  /** The language model finds what must stay whole on the picture: the product, as a box of shares. */
  locate(r: { pictureUrl: string; format: string }): Promise<{ box: Rect | null; what: string; usd: number }>;
  /** The design service (services/design, POST /api/design with op). */
  step(request: Record<string, unknown>): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }>;
  image: {
    priceCents(model: string): number;
    submit(r: ImageAsk): Promise<{ ok: true; providerJobId: string } | { ok: false; error: string }>;
    collect(id: string): Promise<Collected>;
  };
  download(url: string): Promise<Uint8Array | null>;
  wait(ms: number): Promise<void>;
  later(work: Promise<unknown>): void;
  now(): number;
}

export const MODEL = "nano-banana-pro";

const NAMES: Record<string, string> = { feed: "feed post", square: "square", story: "story", banner: "banner" };
const MODEL_RATIO: Record<string, string> = { feed: "4:5", square: "1:1", story: "9:16", banner: "16:9" };
/** Width over height of each format, and the air the product keeps in it (services/design/src/format.ts). */
const SHAPE: Record<string, number> = { feed: 4 / 5, square: 1, story: 9 / 16, banner: 16 / 9 };
const AIR: Record<string, { side: number; top: number; bottom: number }> = {
  feed: { side: 0.04, top: 0.04, bottom: 0.04 },
  square: { side: 0.04, top: 0.04, bottom: 0.04 },
  banner: { side: 0.04, top: 0.04, bottom: 0.04 },
  story: { side: 0.04, top: 250 / 1920, bottom: 340 / 1920 },
};

export const REDRAWN_WHY = "Drawn again in the new shape, as the designer chose. The picture is new, so the Engine looked at the product against its photographs; check it as closely as a new picture.";

/** The why, with whether the product stands where the master has it. */
export function redrawnWhy(place: Rect | null, off: number | null): string {
  if (!place || off === null) return `${REDRAWN_WHY} Check that the product stands where the master has it.`;
  const where = side(place.x + place.w / 2);
  return off <= PLACE_TOLERANCE
    ? `${REDRAWN_WHY} The product stands where the master has it, ${where}.`
    : `${REDRAWN_WHY} The product is not quite where the master has it (${where}); check its place.`;
}

/** Where the product goes in the new shape: where it stands on the master (its centre, as shares of the frame), at the
 *  same share of the frame's height, made smaller only to keep air around it and clear of the platform's areas. */
export function placeFor(box: Rect, format: string, masterRatio: number): Rect {
  const ratio = SHAPE[format] ?? 1;
  let w = box.w * (masterRatio / ratio), h = box.h;
  const air = AIR[format] ?? AIR.square;
  const k = Math.min(1, (1 - 2 * air.side) / w, (1 - air.top - air.bottom) / h);
  w *= k;
  h *= k;
  const cx = Math.min(Math.max(box.x + box.w / 2, air.side + w / 2), 1 - air.side - w / 2);
  const cy = Math.min(Math.max(box.y + box.h / 2, air.top + h / 2), 1 - air.bottom - h / 2);
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** How far the product's centre is from where it should be, as a share of the frame. */
export const offBy = (a: Rect, b: Rect) => Math.hypot(a.x + a.w / 2 - (b.x + b.w / 2), a.y + a.h / 2 - (b.y + b.h / 2));
/** Further than this, the product is not where the master has it. */
export const PLACE_TOLERANCE = 0.05;

const pct = (v: number) => `${Math.round(v * 100)} %`;
const side = (cx: number) => (cx < 0.45 ? "left of centre" : cx > 0.55 ? "right of centre" : "in the centre");
export function placeWords(place: Rect): string {
  const cx = place.x + place.w / 2, cy = place.y + place.h / 2;
  return `Place the product where it stands in image 1, ${side(cx)}: its middle ${pct(cx)} of the frame's width from the left edge and ${pct(cy)} of its height from the top, the product about ${pct(place.w)} of the frame wide and ${pct(place.h)} high. Keep this placement; do not centre the product unless it is centred in image 1.`;
}

export function redrawPromptOf(t: Take, photos: number, place?: Rect | null, missed?: Rect | null): string {
  const name = NAMES[t.format] ?? t.format;
  return [
    `Image 1 is a finished campaign photograph${t.brand.name ? ` for ${t.brand.name}` : ""} that the customer approved.${photos ? ` The next ${photos === 1 ? "image is a photograph" : `${photos} images are photographs`} of the product itself.` : ""}`,
    `Make the same photograph again as a ${MODEL_RATIO[t.format] ?? ""} ${name}: the same product, scene, light, colours, styling and mood, laid out again for the new shape so nothing important is cut or crowded.`,
    "The product must be exactly the product in the photographs: the same shape, proportions, colours, pattern, label and materials.",
    t.format === "story" ? "Keep the product clear of the top eighth and the bottom fifth of the frame, where the platform shows its own controls." : "Keep air around the product.",
    "Add nothing new: no other products, no people, no hands, no text, no logos, no frames or borders.",
    ...(place ? [placeWords(place)] : []),
    ...(place && missed ? [`An earlier drawing put the product's middle at ${pct(missed.x + missed.w / 2)} from the left and ${pct(missed.y + missed.h / 2)} from the top, which is wrong. Move it to the place above.`] : []),
  ].join("\n");
}

/** What the designer is told about the Engine's choice. */
export function whyOf(method: "crop" | "expand", reason: string, format: string, what: string, at?: Rect): string {
  const name = NAMES[format] ?? format;
  const sides = at && at.x > 0 ? "at the sides" : "above and below";
  const thing = what || "the product";
  if (reason === "asked") {
    return method === "crop"
      ? "Cropped from the master, as the designer chose. Every pixel is the master's."
      : `Extended ${sides}, as the designer chose. The master's own pixels are kept; only the new edges are drawn.`;
  }
  if (method === "crop") return `${cap(thing)} fits the ${name} with air around it, so the master is cropped. Every pixel is the master's.`;
  if (reason === "little") return `A ${name} crop would keep less than 60 % of the master, so the scene is extended ${sides}. The master's own pixels are kept.`;
  if (reason === "safe") return `In a ${name} the platform covers the top and bottom, and a crop would put ${thing} there, so the scene is extended ${sides}. The master's own pixels are kept.`;
  if (reason === "cuts") return `A ${name} crop would cut ${thing}, so the scene is extended ${sides}. The master's own pixels are kept.`;
  return `Fume could not tell where the product is, so nothing is cut: the scene is extended ${sides}. The master's own pixels are kept.`;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function promptOf(t: Take): string {
  return [
    `Image 1 is a finished product photograph${t.brand.name ? ` for ${t.brand.name}` : ""}, placed on a larger canvas; the plain grey areas around it are empty.`,
    "Extend the photograph into the grey areas so the whole frame is one photograph: continue the scene, the surfaces, the background, the light and the shadows naturally, with the same camera, lens, depth of field, grain and colour.",
    "Leave the photograph itself exactly as it is: the same product, position, size, framing, light and every detail.",
    "Add nothing new: no products, no people, no hands, no text, no logos, no frames, borders or seams. The grey must be gone entirely.",
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

export async function makeFormat(t: Take, d: Deps): Promise<"made" | "failed"> {
  if (t.asked === "regenerate") return await redraw(t, d);
  const started = d.now();
  let cents = 0;
  let usd = 0;
  const fail = async (why: string) => {
    await d.service.fail(t.make_id, why, cents, usd);
    return "failed" as const;
  };
  const path = (end: string) => `${t.store.prefix}${end}`;
  try {
    const picture = await d.service.readLink(t.picture.bucket, t.picture.path);
    const pngUp = await d.service.uploadLink(t.store.bucket, path(".png"));
    const paddedUp = await d.service.uploadLink(t.store.bucket, path("-padded.png"));
    if (!picture || !pngUp || !paddedUp) return await fail("Fume could not make the storage links.");
    // What must stay whole: only needed when the Engine chooses.
    let around: Rect | null = null;
    let what = "";
    if (!t.asked && !t.window) {
      try {
        const found = await d.locate({ pictureUrl: picture, format: t.format });
        usd += found.usd;
        around = found.box;
        what = found.what;
      } catch {
        // without the product's place, nothing is cut
      }
    }
    const chose = await d.step({
      op: "format", picture, format: t.format, method: t.asked, around, window: t.window, upload: { png: pngUp, padded: paddedUp },
    });
    if (!chose.ok) return await fail(errorOf(chose.body, chose.status));
    const method = chose.body.method as "crop" | "expand";
    console.log(JSON.stringify({ make: t.make_id, format: t.format, around, what, chose: { method: chose.body.method, reason: chose.body.reason, window: chose.body.window } }));
    const reason = String(chose.body.reason ?? "asked");
    const at = chose.body.at as Rect | undefined;
    const why = whyOf(method, reason, t.format, what, at);
    if (method === "crop") {
      const png = chose.body.png as { bytes: number; sha256: string };
      const { error } = await d.service.finish(t.make_id, {
        png: { path: path(".png"), bytes: png.bytes, sha256: png.sha256 }, width: chose.body.width, height: chose.body.height,
        method, why, window: chose.body.window, model: null, cost_cents: 0, llm_usd: usd, ms: d.now() - started,
      });
      return error ? await fail(error.message) : "made";
    }
    const padded = await d.service.readLink(t.store.bucket, path("-padded.png"));
    if (!padded) return await fail("Fume could not read the padded picture back.");
    const text = promptOf(t);
    const model = (await d.service.model?.("expand").catch(() => null)) || MODEL;
    const canvasW = Number(chose.body.width), canvasH = Number(chose.body.height);
    const outpaint = OUTPAINTERS.has(model) && at && canvasW > 0 && canvasH > 0;
    const sent = await d.image.submit({
      imageModel: model, text, referenceUrls: [outpaint ? picture : padded], aspectRatio: String(chose.body.ratio ?? "1:1"),
      resolution: "2K", seed: null,
      ...(outpaint ? { expand: { canvas: [canvasW, canvasH] as [number, number], size: [at!.w, at!.h] as [number, number], at: [at!.x, at!.y] as [number, number] } } : {}),
    });
    if (!sent.ok) return await fail(sent.error);
    cents = d.image.priceCents(model);
    let got: Collected = { state: "waiting" };
    for (let i = 0; i < 40 && got.state === "waiting"; i++) {
      await d.wait(i < 5 ? 3_000 : 5_000);
      got = await d.image.collect(sent.providerJobId);
    }
    if (got.state === "waiting") return await fail("The image model took too long.");
    if (got.state === "failed") return await fail(got.error);
    const bytes = await d.download(got.urls[0]);
    if (!bytes) return await fail("Fume could not read what the image model drew.");
    if (!(await d.service.store(t.store.bucket, path("-drawn.png"), bytes))) return await fail("Fume could not store what the image model drew.");
    const drawn = await d.service.readLink(t.store.bucket, path("-drawn.png"));
    const up = await d.service.uploadLink(t.store.bucket, path(".png"));
    if (!drawn || !up) return await fail("Fume could not make the storage links.");
    const set = await d.step({ op: "format-set", picture, drawn, format: t.format, upload: { png: up } });
    if (!set.ok) return await fail(errorOf(set.body, set.status));
    const png = set.body.png as { bytes: number; sha256: string };
    const { error } = await d.service.finish(t.make_id, {
      png: { path: path(".png"), bytes: png.bytes, sha256: png.sha256 }, width: set.body.width, height: set.body.height,
      method, why, window: set.body.at, prompt: text, model, cost_cents: cents, llm_usd: usd, drift: set.body.drift,
      ms: d.now() - started,
    });
    return error ? await fail(error.message) : "made";
  } catch (e) {
    return await fail(e instanceof Error ? e.message : String(e));
  }
}

/** The image model's picture, collected. */
async function drawIt(d: Deps, ask: ImageAsk): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; error: string; sent: boolean }> {
  const sent = await d.image.submit(ask);
  if (!sent.ok) return { ok: false, error: sent.error, sent: false };
  let got: Collected = { state: "waiting" };
  for (let i = 0; i < 40 && got.state === "waiting"; i++) {
    await d.wait(i < 5 ? 3_000 : 5_000);
    got = await d.image.collect(sent.providerJobId);
  }
  if (got.state === "waiting") return { ok: false, error: "The image model took too long.", sent: true };
  if (got.state === "failed") return { ok: false, error: got.error, sent: true };
  const bytes = await d.download(got.urls[0]);
  return bytes ? { ok: true, bytes } : { ok: false, error: "Fume could not read what the image model drew.", sent: true };
}

/** A redrawn format: a new picture in the new shape, from the master and the product's photographs. */
async function redraw(t: Take, d: Deps): Promise<"made" | "failed"> {
  const started = d.now();
  let cents = 0;
  let usd = 0;
  const fail = async (why: string) => {
    await d.service.fail(t.make_id, why, cents, usd);
    return "failed" as const;
  };
  const path = (end: string) => `${t.store.prefix}${end}`;
  try {
    const picture = await d.service.readLink(t.picture.bucket, t.picture.path);
    if (!picture) return await fail("Fume could not make the storage links.");
    const photos: string[] = [];
    for (const p of t.products ?? []) {
      for (const f of p.pictures.slice(0, 2)) {
        const link = await d.service.readLink(f.bucket, f.path);
        if (link && photos.length < 3) photos.push(link);
      }
    }
    const model = (await d.service.model?.("regenerate").catch(() => null)) || MODEL;
    // Where the product stands on the master, so the new picture keeps the composition the customer approved.
    const find = async (pictureUrl: string) => {
      try {
        const found = await d.locate({ pictureUrl, format: t.format });
        usd += found.usd;
        return found;
      } catch {
        return null;
      }
    };
    const onMaster = await find(picture);
    const masterRatio = t.picture.width && t.picture.height ? t.picture.width / t.picture.height : SHAPE.feed;
    const place = onMaster?.box ? placeFor(onMaster.box, t.format, masterRatio) : null;
    // One drawing, and one more when the product is not where it should be; the closer one is kept.
    let best: { link: string; text: string; off: number | null; at: Rect | null } | null = null;
    for (let n = 1; n <= (place ? 2 : 1); n++) {
      const text = redrawPromptOf(t, photos.length, place, best?.at ?? null);
      const drawn = await drawIt(d, {
        imageModel: model, text, referenceUrls: [picture, ...photos], aspectRatio: MODEL_RATIO[t.format] ?? "1:1", resolution: "2K", seed: null,
      });
      if (drawn.ok || drawn.sent) cents += d.image.priceCents(model);
      if (!drawn.ok) {
        if (best) break;
        return await fail(drawn.error);
      }
      const at = path(n === 1 ? "-drawn.png" : `-drawn-${n}.png`);
      if (!(await d.service.store(t.store.bucket, at, drawn.bytes))) return await fail("Fume could not store what the image model drew.");
      const link = await d.service.readLink(t.store.bucket, at);
      if (!link) return await fail("Fume could not make the storage links.");
      const seen = place ? (await find(link))?.box ?? null : null;
      const off = place && seen ? offBy(seen, place) : null;
      console.log(JSON.stringify({ make: t.make_id, redraw: n, place, seen, off }));
      if (!best || (off !== null && (best.off === null || off < best.off))) best = { link, text, off, at: seen };
      if (off === null || off <= PLACE_TOLERANCE) break;
    }
    if (!best) return await fail("The image model drew nothing.");
    const { link, text } = best;
    const up = await d.service.uploadLink(t.store.bucket, path(".png"));
    if (!link || !up) return await fail("Fume could not make the storage links.");
    const cut = await d.step({ op: "format-drawn", picture: link, format: t.format, upload: { png: up } });
    if (!cut.ok) return await fail(errorOf(cut.body, cut.status));
    const png = cut.body.png as { bytes: number; sha256: string };
    const width = Number(cut.body.width), height = Number(cut.body.height);
    const { data, error } = await d.service.finish(t.make_id, {
      png: { path: path(".png"), bytes: png.bytes, sha256: png.sha256 }, width, height,
      method: "regenerate", why: redrawnWhy(place, best.off), window: place, prompt: text, model, cost_cents: cents, llm_usd: usd, ms: d.now() - started,
    });
    if (error) return await fail(error.message);
    // The Engine looks at the new picture. A failure here never undoes it: the expert checks it by eye.
    const candidateId = data?.candidate_id;
    if (candidateId && d.look && d.service.evaluated) {
      try {
        const made = await d.service.readLink(t.store.bucket, path(".png"));
        if (made) {
          const looked = await d.look({ pictureUrl: made, productUrls: photos.length ? photos : [picture], size: { width, height } });
          await d.service.evaluated(candidateId, looked.evaluation, looked.usd);
        }
      } catch {
        // not evaluated
      }
    }
    return "made";
  } catch (e) {
    return await fail(e instanceof Error ? e.message : String(e));
  }
}

export async function handleFormat(req: Request, deps: (authorization: string) => Deps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return answer(400, { code: "invalid", message: "Use POST." });
  const authorization = req.headers.get("Authorization");
  if (!authorization) return answer(403, { code: "forbidden", message: "Sign in first." });
  let makeId: unknown;
  try {
    makeId = (await req.json()).makeId;
  } catch {
    // handled below
  }
  if (typeof makeId !== "string" || !/^[0-9a-f-]{36}$/i.test(makeId)) return answer(400, { code: "invalid", message: "Name the format." });
  const d = deps(authorization);
  if (!(await d.canRead(makeId))) return answer(404, { code: "not_found", message: "No such format." });
  const { data: take, error } = await d.service.take(makeId);
  if (error) return answer(503, { code: "unavailable", message: error.message });
  if (!take) return answer(200, { making: false });
  d.later(makeFormat(take, d));
  return answer(202, { making: true });
}
