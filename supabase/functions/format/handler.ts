// The edge function `format` (docs/mvp/formats.md): the app calls it after make_format. The caller's own token decides
// whether they may see the make (format_makes is staff-only); the service role takes the work. The answer comes at
// once (202); the work goes on in the background:
//   1. unless the designer chose, the language model finds what must stay whole on the master (the product),
//   2. the design service chooses (op format): a crop when the product fits the new shape with air around it, and
//      makes it from the master's own pixels; else it pads the master onto the new shape,
//   3. for an expansion, the image model draws only the new edges, and the design service sets every pixel of the
//      master back on its drawing (format-set),
//   4. format_finish adds the format as a candidate of the format's job, saying how it was made and why.
// handler.test.ts runs it without Supabase, fal, the model or the design service.

export type Rect = { x: number; y: number; w: number; h: number };

export type Take = {
  make_id: string;
  workspace_id: string;
  asked: "crop" | "expand" | null;
  window: Rect | null;
  format: string;
  brand: { name: string | null };
  picture: { bucket: string; path: string; width: number | null; height: number | null };
  store: { bucket: string; prefix: string };
};

type Failure = { message: string } | null;

export type ImageAsk = { imageModel: string; text: string; referenceUrls: string[]; aspectRatio: string; resolution: string | null; seed: number | null };
export type Collected =
  | { state: "waiting" }
  | { state: "done"; urls: string[]; response: unknown }
  | { state: "failed"; error: string; final: boolean; response: unknown };

export interface Deps {
  canRead(makeId: string): Promise<boolean>;
  service: {
    take(makeId: string): Promise<{ data: Take | null; error: Failure }>;
    finish(makeId: string, result: Record<string, unknown>): Promise<{ data?: unknown; error: Failure }>;
    fail(makeId: string, error: string, cents: number, usd: number): Promise<{ error: Failure }>;
    readLink(bucket: string, path: string): Promise<string | null>;
    uploadLink(bucket: string, path: string): Promise<string | null>;
    store(bucket: string, path: string, bytes: Uint8Array): Promise<boolean>;
  };
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
    const sent = await d.image.submit({
      imageModel: MODEL, text, referenceUrls: [padded], aspectRatio: String(chose.body.ratio ?? "1:1"), resolution: "2K", seed: null,
    });
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
      method, why, window: set.body.at, prompt: text, model: MODEL, cost_cents: cents, llm_usd: usd, drift: set.body.drift,
      ms: d.now() - started,
    });
    return error ? await fail(error.message) : "made";
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
