// The design service's one request: lay the words on a picture and store the result. It holds no keys. A request
// is taken only with a live signed link to a picture in Fume's own storage and signed links to upload the result
// there, which only Fume's backend can make; anything else is turned away before any work.
import { createHash } from "node:crypto";
import { type DesignBook, type Format, SIZES } from "./book.ts";
import { type Layout, type Words } from "./compose.ts";
import { type Ask, design } from "./design.ts";
import { type Box } from "./pixels.ts";

export interface DesignRequest {
  picture: string;
  format: Format;
  book: DesignBook;
  words: Words;
  prefer?: Partial<Layout>;
  keepClear?: (Box & { what: string })[];
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
  if (!r.format || !(r.format in SIZES)) return "Unknown format.";
  if (!r.book || !Array.isArray(r.book.styles) || !Array.isArray(r.book.colours) || !Array.isArray(r.book.typefaces)) {
    return "The brand's design system is missing.";
  }
  if (!r.words || typeof r.words.headline !== "string" || !r.words.headline.trim()) return "A layout needs a headline.";
  for (const w of [r.words.headline, r.words.subline, r.words.cta]) {
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
  const why = invalid(r, deps.storageHost);
  if (why) return json(400, { error: why });
  const got = await deps.fetch(r.picture!, { signal: AbortSignal.timeout(20_000) });
  const type = got.headers.get("content-type") ?? "";
  if (!got.ok || !type.startsWith("image/")) return json(403, { error: "The picture link is not live." });
  const picture = new Uint8Array(await got.arrayBuffer());
  if (picture.byteLength > 25_000_000) return json(413, { error: "The picture is too large." });

  const out = await (deps.design ?? design)({
    picture,
    format: r.format!,
    book: r.book!,
    words: r.words!,
    prefer: r.prefer ?? {},
    keepClear: (r.keepClear ?? []).filter(isBox).slice(0, 8),
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

function isBox(b: unknown): b is Box & { what: string } {
  const x = b as Box & { what: string };
  return Boolean(x) && [x.x, x.y, x.w, x.h].every((n) => typeof n === "number" && Number.isFinite(n)) && typeof x.what === "string";
}
