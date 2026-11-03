// Fume learns a brand's taste from its pictures: every picture with a verdict (kept or removed in the Brand DNA,
// approved, asked to change, swiped) is measured (measure.ts) and the taste model is computed again
// (public.save_taste_measures). Started by a person who may read the brand; the service saves the numbers, so no one
// can write their own. handler.test.ts runs it without the web.
import { measure, type Measured, type Pixels } from "./measure.ts";

export interface Pending {
  id: string;
  url: string | null;
  bucket: string | null;
  path: string | null;
}

export interface Deps {
  /** public.taste_pending as the caller: gathers the evidence and lists what waits to be measured. */
  pending(workspaceId: string): Promise<{ data?: Pending[]; error?: { code: string; message: string } }>;
  /** A short-lived address for a stored file. */
  sign(bucket: string, path: string): Promise<string | null>;
  /** The picture's bytes, or null. */
  fetchImage(url: string): Promise<Uint8Array | null>;
  /** The picture's pixels, at most 256 px on its long side, or null when it cannot be read. */
  decode(bytes: Uint8Array): Promise<Pixels | null>;
  /** public.save_taste_measures as the service. */
  save(workspaceId: string, measures: unknown[]): Promise<{ data?: unknown; error?: { message: string } }>;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const STATUS: Record<string, number> = { not_found: 404, forbidden: 403, invalid: 400 };
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

/** A picture's address Fume may open: https (or relative to the app), never a private address. */
export function pictureUrl(raw: string, site?: string): string | undefined {
  try {
    const u = new URL(raw, site && /^https:\/\//.test(site) ? site : undefined);
    if (u.protocol !== "https:") return undefined;
    if (!u.hostname.includes(".") || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(u.hostname))
      return undefined;
    // Shopify serves WebP by default; ask for a JPEG, which every reader decodes.
    if (u.hostname.endsWith("cdn.shopify.com") || u.pathname.includes("/cdn/shop/"))
      u.searchParams.set("format", "pjpg");
    if (u.hostname.endsWith("cdn.shopify.com")) u.searchParams.set("width", "512");
    return u.href;
  } catch {
    return undefined;
  }
}

export async function handleLearn(req: Request, authorized: boolean, deps: Deps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply(400, { code: "invalid", message: "Use POST." });
  if (!authorized) return reply(403, { code: "forbidden", message: "Sign in first." });
  // pictures: the app's own pictures (a relative address, behind the preview's password) as base64 JPEG or PNG, sent by
  // the app after a first call named them under `send`.
  let body: { workspaceId?: string; site?: string; pictures?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return reply(400, { code: "invalid", message: "The request could not be read." });
  }
  if (!body.workspaceId) return reply(400, { code: "invalid", message: "Name the brand." });
  const pending = await deps.pending(body.workspaceId);
  if (pending.error) return reply(STATUS[pending.error.code] ?? 503, pending.error);

  const measures: (Partial<Measured> & { id: string; error?: string })[] = [];
  const sent = body.pictures ?? {};
  const own = (p: Pending) => !p.bucket && !!p.url && p.url.startsWith("/") && !p.url.startsWith("//");
  const send = (pending.data ?? []).filter((p) => own(p) && !sent[p.url!]).map((p) => p.url!);
  const list = (pending.data ?? []).filter((p) => !own(p) || sent[p.url!]);
  for (let i = 0; i < list.length; i += 4) {
    const batch = await Promise.all(
      list.slice(i, i + 4).map(async (p) => {
        let bytes: Uint8Array | null;
        if (own(p)) bytes = fromBase64(sent[p.url!]!);
        else {
          const url =
            p.bucket && p.path ? await deps.sign(p.bucket, p.path) : p.url ? pictureUrl(p.url, body.site) : undefined;
          if (!url) return { id: p.id, error: "No address Fume may open" };
          bytes = await deps.fetchImage(url);
        }
        if (!bytes) return { id: p.id, error: "The picture could not be fetched" };
        const pixels = await deps.decode(bytes).catch(() => null);
        if (!pixels) return { id: p.id, error: "The picture could not be read" };
        return { id: p.id, ...measure(pixels) };
      }),
    );
    measures.push(...batch);
  }
  if (!measures.length && send.length) return reply(200, { measured: 0, failed: 0, send });
  const saved = await deps.save(body.workspaceId, measures);
  if (saved.error)
    return reply(503, { code: "unavailable", message: "Fume could not keep what it measured. Try again." });
  return reply(200, {
    measured: measures.filter((m) => !m.error).length,
    failed: measures.filter((m) => m.error).length,
    send,
    profile: saved.data,
  });
}

/** A picture the app sent, at most 2 MB. */
function fromBase64(text: string): Uint8Array | null {
  try {
    const raw = atob(text.replace(/^data:[^,]*,/, ""));
    if (raw.length > 2_000_000) return null;
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}
