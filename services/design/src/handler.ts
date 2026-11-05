// The design service's one request: lay the words on a picture and store the result. It holds no keys. A request
// is taken only with a live signed link to a picture in Fume's own storage and signed links to upload the result
// there, which only Fume's backend can make; anything else is turned away before any work.
import { createHash } from "node:crypto";
import { type DesignBook, type Format, SIZES } from "./book.ts";
import { type Layout, type Words } from "./compose.ts";
import { type Ask, design } from "./design.ts";
import { type Box } from "./pixels.ts";
import { type BrandFace } from "./render.ts";
import { blank, crop, cropFor, decode, encode, type Rect, resize, setBack } from "./fix.ts";
import { AIR, canvasFor, fits, kept, MODEL_RATIO, pad, RATIO, setMaster, windowFor } from "./format.ts";

export interface DesignRequest {
  picture: string;
  format: Format;
  book: DesignBook;
  words: Words;
  prefer?: Partial<Layout>;
  keepClear?: (Box & { what: string })[];
  /** A signed link to the brand's logo file in Fume's storage, when its design system names one. */
  logo?: string;
  /** Signed links to the brand's own font files in Fume's storage, with the face each holds. */
  fonts?: { family: string; weight: number; italic: boolean; url: string }[];
  upload: { png: string; fig: string };
}

export interface Deps {
  /** The storage host every link must point at, e.g. abc.supabase.co. */
  storageHost: string;
  fetch: typeof fetch;
  design?: (ask: Ask) => ReturnType<typeof design>;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export function signedLink(link: unknown, host: string, kind: "read" | "upload"): boolean {
  if (typeof link !== "string") return false;
  try {
    const u = new URL(link);
    const path = kind === "read" ? "/storage/v1/object/sign/" : "/storage/v1/object/upload/sign/";
    return u.protocol === "https:" && u.host === host && u.pathname.startsWith(path) && u.searchParams.has("token");
  } catch {
    return false;
  }
}

export function invalid(r: Partial<DesignRequest>, host: string): string | null {
  if (!signedLink(r.picture, host, "read")) return "The picture must be a signed link to Fume's storage.";
  if (!signedLink(r.upload?.png, host, "upload") || !signedLink(r.upload?.fig, host, "upload")) {
    return "The result needs signed upload links to Fume's storage.";
  }
  if (r.logo != null && !signedLink(r.logo, host, "read")) return "The logo must be a signed link to Fume's storage.";
  if (r.fonts != null) {
    if (!Array.isArray(r.fonts) || r.fonts.length > 12) return "Too many font files.";
    for (const f of r.fonts) {
      if (!signedLink(f?.url, host, "read")) return "A font file must be a signed link to Fume's storage.";
      if (typeof f.family !== "string" || !/^[\p{L}\p{N} ._'&-]{1,60}$/u.test(f.family)) return "A font file's family is not one Fume reads.";
      if (!Number.isInteger(f.weight) || f.weight < 100 || f.weight > 900 || typeof f.italic !== "boolean") return "A font file's face is not one Fume reads.";
    }
  }
  if (!r.format || !(r.format in SIZES)) return "Unknown format.";
  if (!r.book || !Array.isArray(r.book.styles) || !Array.isArray(r.book.colours) || !Array.isArray(r.book.typefaces)) {
    return "The brand's design system is missing.";
  }
  if (!r.words || typeof r.words.headline !== "string" || !r.words.headline.trim()) return "A layout needs a headline.";
  for (const w of [r.words.headline, r.words.subline, r.words.cta, r.words.price]) {
    if (w != null && (typeof w !== "string" || w.length > 400)) return "The words are too long.";
  }
  return null;
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== "POST") return json(405, { error: "POST only." });
  let r: Partial<DesignRequest>;
  try {
    r = (await req.json()) as Partial<DesignRequest>;
  } catch {
    return json(400, { error: "The request is not JSON." });
  }
  // A surgical fix's two steps (fix.ts): the crop the image model redraws, and the redrawn crop set back.
  const op = (r as { op?: unknown }).op;
  if (op === "fix-crop" || op === "fix-set") return fixStep(r as unknown as FixRequest, deps);
  if (op === "format" || op === "format-set") return formatStep(r as unknown as FormatRequest, deps);
  const why = invalid(r, deps.storageHost);
  if (why) return json(400, { error: why });
  // A 2K picture from storage can be slow while other layers are being made; a slow read is answered, never thrown.
  let picture: Uint8Array;
  try {
    const got = await deps.fetch(r.picture!, { signal: AbortSignal.timeout(45_000) });
    const type = got.headers.get("content-type") ?? "";
    if (!got.ok || !type.startsWith("image/")) return json(403, { error: "The picture link is not live." });
    picture = new Uint8Array(await got.arrayBuffer());
  } catch {
    return json(504, { error: "Reading the picture from storage took too long." });
  }
  if (picture.byteLength > 25_000_000) return json(413, { error: "The picture is too large." });
  // The logo is a help, not a gate: without it the layout is made and the expert is told.
  let logo: Uint8Array | undefined;
  if (r.logo) {
    try {
      const got = await deps.fetch(r.logo, { signal: AbortSignal.timeout(15_000) });
      const type = got.headers.get("content-type") ?? "";
      const bytes = got.ok && type.startsWith("image/") ? new Uint8Array(await got.arrayBuffer()) : null;
      if (bytes && bytes.byteLength <= 3_000_000) logo = bytes;
    } catch {
      logo = undefined;
    }
  }

  // The brand's own fonts are a help too: a file that cannot be read is left out, and the stand-in is reported.
  const fonts: BrandFace[] = [];
  for (const f of r.fonts ?? []) {
    try {
      const got = await deps.fetch(f.url, { signal: AbortSignal.timeout(15_000) });
      const bytes = got.ok ? new Uint8Array(await got.arrayBuffer()) : null;
      if (bytes && bytes.byteLength <= 8_000_000 && isSfnt(bytes)) fonts.push({ family: f.family, weight: f.weight, italic: f.italic, bytes });
    } catch {
      // left out
    }
  }

  const out = await (deps.design ?? design)({
    picture,
    format: r.format!,
    book: r.book!,
    words: r.words!,
    prefer: r.prefer ?? {},
    keepClear: (r.keepClear ?? []).filter(isBox).slice(0, 8),
    ...(logo ? { logo } : {}),
    ...(fonts.length ? { fonts } : {}),
  });
  const put = async (link: string, bytes: Uint8Array, contentType: string) => {
    const res = await deps.fetch(link, {
      method: "PUT",
      headers: { "content-type": contentType, "x-upsert": "false" },
      body: new Blob([bytes as Uint8Array<ArrayBuffer>]),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Storing the result failed (${res.status}).`);
    return { bytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") };
  };
  try {
    const [png, fig] = await Promise.all([
      put(r.upload!.png, out.png, "image/png"),
      put(r.upload!.fig, out.fig, "application/octet-stream"),
    ]);
    const { png: _p, fig: _f, ...rest } = out;
    return json(200, { ...rest, png, fig });
  } catch (e) {
    return json(502, { error: (e as Error).message });
  }
}

/** Whether the bytes are a TrueType or OpenType file (the renderer reads no web font formats). */
export function isSfnt(b: Uint8Array): boolean {
  if (b.length < 12) return false;
  const tag = String.fromCharCode(b[0], b[1], b[2], b[3]);
  return tag === "OTTO" || tag === "true" || (b[0] === 0 && b[1] === 1 && b[2] === 0 && b[3] === 0);
}

function isBox(b: unknown): b is Box & { what: string } {
  const x = b as Box & { what: string };
  return Boolean(x) && [x.x, x.y, x.w, x.h].every((n) => typeof n === "number" && Number.isFinite(n)) && typeof x.what === "string";
}

export interface FixRequest {
  op: "fix-crop" | "fix-set";
  /** The whole picture, and for fix-set the image model's redrawn crop, as signed links to Fume's storage. */
  picture: string;
  redrawn?: string;
  /** The part the designer marked, as shares of the picture; for fix-set, the crop fix-crop answered. */
  box: Rect;
  rect?: Rect;
  /** fix-crop: blank the marked part in the crop, so the image model draws it anew. */
  blank?: boolean;
  /** fix-crop for reading small print: a close crop (at least 128 px a side), enlarged to 1024 px on its long side. */
  read?: boolean;
  upload: { crop?: string; png?: string };
}

const isShare = (b: Rect | undefined) =>
  Boolean(b) && [b!.x, b!.y, b!.w, b!.h].every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1) &&
  b!.w > 0 && b!.h > 0 && b!.x + b!.w <= 1.0001 && b!.y + b!.h <= 1.0001;

export function invalidFix(r: Partial<FixRequest>, host: string): string | null {
  if (!signedLink(r.picture, host, "read")) return "The picture must be a signed link to Fume's storage.";
  if (!isShare(r.box)) return "Mark the part to fix inside the picture.";
  if (r.op === "fix-crop" && !signedLink(r.upload?.crop, host, "upload")) return "The crop needs a signed upload link to Fume's storage.";
  if (r.op === "fix-set") {
    if (!signedLink(r.redrawn, host, "read")) return "The redrawn part must be a signed link to Fume's storage.";
    const c = r.rect;
    if (!c || ![c.x, c.y, c.w, c.h].every((n) => Number.isInteger(n) && n >= 0) || c.w < 16 || c.h < 16) return "The crop is not one Fume made.";
    if (!signedLink(r.upload?.png, host, "upload")) return "The result needs a signed upload link to Fume's storage.";
  }
  return null;
}

async function read(link: string, deps: Deps, limit = 25_000_000): Promise<Uint8Array | Response> {
  try {
    const got = await deps.fetch(link, { signal: AbortSignal.timeout(45_000) });
    const type = got.headers.get("content-type") ?? "";
    if (!got.ok || !type.startsWith("image/")) return json(403, { error: "The picture link is not live." });
    const bytes = new Uint8Array(await got.arrayBuffer());
    return bytes.byteLength > limit ? json(413, { error: "The picture is too large." }) : bytes;
  } catch {
    return json(504, { error: "Reading the picture from storage took too long." });
  }
}

async function store(link: string, bytes: Uint8Array, deps: Deps) {
  const res = await deps.fetch(link, {
    method: "PUT",
    headers: { "content-type": "image/png", "x-upsert": "true" },
    body: new Blob([bytes as Uint8Array<ArrayBuffer>]),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Storing the result failed (${res.status}).`);
  return { bytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") };
}

async function fixStep(r: FixRequest, deps: Deps): Promise<Response> {
  const why = invalidFix(r, deps.storageHost);
  if (why) return json(400, { error: why });
  const got = await read(r.picture, deps);
  if (got instanceof Response) return got;
  try {
    const picture = await decode(got);
    if (r.op === "fix-crop") {
      const { rect, ratio } = cropFor(r.box, picture.width, picture.height, r.read ? 128 : 384);
      let cut = crop(picture, rect);
      if (r.read) {
        const k = 1024 / Math.max(cut.width, cut.height);
        if (k > 1) cut = resize(cut, Math.round(cut.width * k), Math.round(cut.height * k));
      }
      if (r.blank) {
        cut = blank(cut, { x: r.box.x * picture.width - rect.x, y: r.box.y * picture.height - rect.y, w: r.box.w * picture.width, h: r.box.h * picture.height });
      }
      const part = await encode(cut);
      return json(200, { rect, ratio, width: picture.width, height: picture.height, crop: await store(r.upload.crop!, part, deps) });
    }
    const rect = r.rect!;
    if (rect.x + rect.w > picture.width || rect.y + rect.h > picture.height) return json(400, { error: "The crop is not one Fume made." });
    const redrawnBytes = await read(r.redrawn!, deps);
    if (redrawnBytes instanceof Response) return redrawnBytes;
    const out = setBack(picture, await decode(redrawnBytes), rect, r.box);
    const png = await store(r.upload.png!, await encode(out.picture), deps);
    return json(200, { width: picture.width, height: picture.height, drift: out.drift, png });
  } catch (e) {
    return json(502, { error: (e as Error).message });
  }
}

export interface FormatRequest {
  op: "format" | "format-set";
  /** The master's picture, and for format-set the image model's drawing, as signed links to Fume's storage. */
  picture: string;
  drawn?: string;
  format: string;
  /** format: crop or expand when the designer chose; the Engine chooses otherwise. */
  method?: "crop" | "expand" | null;
  /** format: what must stay whole (the product), as shares of the picture, when the language model found it. */
  around?: Rect | null;
  /** format: the designer's own crop window, as shares of the picture. */
  window?: Rect | null;
  upload: { png?: string; padded?: string };
}

/** Why the Engine chose as it did, for the designer. */
export type FormatReason = "asked" | "fits" | "cuts" | "safe" | "little" | "unknown";

export function invalidFormat(r: Partial<FormatRequest>, host: string): string | null {
  if (!signedLink(r.picture, host, "read")) return "The picture must be a signed link to Fume's storage.";
  if (!r.format || !(r.format in RATIO)) return "Unknown format.";
  if (r.method != null && r.method !== "crop" && r.method !== "expand") return "Crop or expand.";
  if (r.around != null && !isShare(r.around)) return "The product's box lies inside the picture.";
  if (r.window != null && (!isShare(r.window) || r.method !== "crop")) return "A crop window lies inside the picture.";
  if (r.op === "format" && (!signedLink(r.upload?.png, host, "upload") || !signedLink(r.upload?.padded, host, "upload"))) {
    return "The format needs signed upload links to Fume's storage.";
  }
  if (r.op === "format-set" && (!signedLink(r.drawn, host, "read") || !signedLink(r.upload?.png, host, "upload"))) {
    return "The drawing and the result need signed links to Fume's storage.";
  }
  return null;
}

/** Crop when the product fits the new shape with air around it and the crop keeps most of the master; else expand. */
export function chooseFormat(width: number, height: number, format: string, r: Pick<FormatRequest, "method" | "around" | "window">):
  { method: "crop" | "expand"; window: Rect; reason: FormatReason } {
  const ratio = RATIO[format];
  if (r.window) {
    const w = { x: Math.round(r.window.x * width), y: Math.round(r.window.y * height), w: Math.round(r.window.w * width), h: 0 };
    w.h = Math.min(height - w.y, Math.round(w.w / ratio));
    return { method: "crop", window: w, reason: "asked" };
  }
  const win = windowFor(width, height, ratio, r.around ?? undefined);
  if (r.method) return { method: r.method, window: win, reason: "asked" };
  if (!r.around) return { method: "expand", window: win, reason: "unknown" };
  if (kept(width, height, ratio) < 0.6) return { method: "expand", window: win, reason: "little" };
  if (fits(r.around, win, width, height, AIR[format])) return { method: "crop", window: win, reason: "fits" };
  // Fits but for the platform's top and bottom: the scene is extended so the product clears them.
  const safe = AIR[format].top > AIR.square.top && fits(r.around, win, width, height, { ...AIR[format], top: AIR.square.top, bottom: AIR.square.bottom });
  return { method: "expand", window: win, reason: safe ? "safe" : "cuts" };
}

async function formatStep(r: FormatRequest, deps: Deps): Promise<Response> {
  const why = invalidFormat(r, deps.storageHost);
  if (why) return json(400, { error: why });
  const got = await read(r.picture, deps);
  if (got instanceof Response) return got;
  try {
    const master = await decode(got);
    const canvas = canvasFor(master.width, master.height, RATIO[r.format]);
    if (r.op === "format") {
      const chose = chooseFormat(master.width, master.height, r.format, r);
      const share = (w: Rect) => ({ x: w.x / master.width, y: w.y / master.height, w: w.w / master.width, h: w.h / master.height });
      if (chose.method === "crop") {
        const png = await store(r.upload.png!, await encode(crop(master, chose.window)), deps);
        return json(200, { method: "crop", reason: chose.reason, window: share(chose.window), width: chose.window.w, height: chose.window.h, png });
      }
      const padded = await store(r.upload.padded!, await encode(pad(master, canvas)), deps);
      return json(200, {
        method: "expand", reason: chose.reason, window: share(chose.window), ratio: MODEL_RATIO[r.format],
        width: canvas.width, height: canvas.height, at: canvas.at, padded,
      });
    }
    const drawn = await read(r.drawn!, deps);
    if (drawn instanceof Response) return drawn;
    const out = setMaster(master, await decode(drawn), canvas);
    const png = await store(r.upload.png!, await encode(out.picture), deps);
    return json(200, { width: canvas.width, height: canvas.height, at: canvas.at, drift: out.drift, png });
  } catch (e) {
    return json(502, { error: (e as Error).message });
  }
}
