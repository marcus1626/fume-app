// The image models, behind one shape so the provider can change (Marcus, 3 Nov: Higgsfield's API first, another
// provider as the fallback). A provider takes the checked prompt unchanged, with the product pictures first, and
// answers with a request id; the pictures are collected later.
import type { ProviderRequest } from "../_shared/engine/index.ts";

export type Submitted = { ok: true; providerJobId: string } | { ok: false; error: string; final: boolean };
export type Collected =
  | { state: "waiting" }
  | { state: "done"; urls: string[]; response: unknown }
  | { state: "failed"; error: string; final: boolean; response: unknown };

export interface ImageProvider {
  name: string;
  /** What one picture costs, in cents (the provider's list price as Fume knows it). */
  priceCents(imageModel: string): number;
  submit(request: ProviderRequest): Promise<Submitted>;
  collect(providerJobId: string): Promise<Collected>;
  /** Checks the key and lists what the provider offers, without making a picture (no credits). */
  probe?(): Promise<unknown>;
}

const BASE = "https://api.higgsfield.ai";

// Fume's model names to Higgsfield's endpoints. The endpoints are read from Higgsfield's SDK and confirmed on the
// first real call; the secret HF_ENDPOINTS ({"nano-banana-pro": "..."}) replaces any of them without a deploy.
export const HIGGSFIELD_ENDPOINTS: Record<string, { text: string; references: string }> = {
  "qwen-image-3": { text: "alibaba/qwen-image-3/text-to-image", references: "alibaba/qwen-image-3/edit" },
  "grok-imagine-2": { text: "xai/grok-imagine-image-2.0", references: "xai/grok-imagine-image-2.0" },
  "nano-banana-pro": { text: "google/nano-banana-pro/text-to-image", references: "google/nano-banana-pro/edit" },
  "nano-banana-2": { text: "google/nano-banana-2/text-to-image", references: "google/nano-banana-2/edit" },
  "seedream-4": { text: "bytedance/seedream/v4/text-to-image", references: "bytedance/seedream/v4/edit" },
  "flux-kontext": { text: "flux-pro/kontext/max/text-to-image", references: "flux-pro/kontext/max" },
  "gpt-image": { text: "openai/gpt-image/text-to-image", references: "openai/gpt-image/edit" },
};
// The ratios a model makes; another one is asked as the nearest of these, and the picture is cropped to the format
// after (Higgsfield's answers, 4 Nov 2026).
const RATIOS: Record<string, string[]> = {
  "qwen-image-3": ["1:1", "2:3", "3:2", "3:4", "4:3", "7:9", "9:7", "9:16", "16:9", "21:9"],
};
const value = (r: string) => {
  const [w, h] = r.split(":").map(Number);
  return w / h;
};
/** The ratio to ask a model for: the format's own, or the nearest one the model makes. */
export function ratioFor(imageModel: string, ratio: string): string {
  const allowed = RATIOS[imageModel];
  if (!allowed || allowed.includes(ratio)) return ratio;
  return allowed.reduce((a, b) => (Math.abs(Math.log(value(b) / value(ratio))) < Math.abs(Math.log(value(a) / value(ratio))) ? b : a));
}
// Estimates until Higgsfield's bill says otherwise (cents per picture).
const PRICES: Record<string, number> = { "nano-banana-pro": 15, "nano-banana-2": 6, "seedream-4": 4, "flux-kontext": 8, "gpt-image": 10 };

export function higgsfield(
  credentials: string,
  opts: { endpoints?: Record<string, { text: string; references: string }>; fetch?: typeof fetch } = {},
): ImageProvider {
  const endpoints = { ...HIGGSFIELD_ENDPOINTS, ...opts.endpoints };
  const go = opts.fetch ?? fetch;
  // A key made as "key id:key secret" is sent as Key; a single API key is tried as Key, then as Bearer, and the one
  // Higgsfield accepts is kept.
  const schemes = credentials.includes(":") ? ["Key"] : ["Key", "Bearer"];
  let scheme = 0;
  const headersOf = (i: number) => ({ Authorization: `${schemes[i]} ${credentials}`, "Content-Type": "application/json", Accept: "application/json" });
  async function call(url: string, init: RequestInit = {}): Promise<Response> {
    let res = await go(url, { ...init, headers: headersOf(scheme) });
    while (res.status === 401 && scheme < schemes.length - 1) {
      scheme++;
      res = await go(url, { ...init, headers: headersOf(scheme) });
    }
    return res;
  }
  const clean = (t: string) => t.replaceAll(credentials, "[key]").slice(0, 1500);
  const failure = (status: number, text: string) => ({
    error: status === 401 ? "Higgsfield refused Fume's key." : status === 403 ? "Higgsfield has no credits left for Fume."
      : `Higgsfield answered ${status}: ${text.slice(0, 300)}`,
    // A refused key, no credits or a request it cannot read will not get better by trying again.
    final: [400, 401, 403, 404, 422].includes(status),
  });
  return {
    name: "higgsfield",
    priceCents: (m) => PRICES[m] ?? 15,
    async submit(r) {
      const endpoint = endpoints[r.imageModel];
      if (!endpoint) return { ok: false, error: `Higgsfield has no endpoint for ${r.imageModel}.`, final: true };
      const body: Record<string, unknown> = { prompt: r.text, aspect_ratio: ratioFor(r.imageModel, r.aspectRatio) };
      if (r.seed !== null) body.seed = r.seed;
      if (r.resolution) body.resolution = r.resolution;
      // Higgsfield's model routes take the pictures as image_urls (its answer to the first real call, 4 Nov 2026).
      if (r.referenceUrls.length) body.image_urls = r.referenceUrls;
      const path = r.referenceUrls.length ? endpoint.references : endpoint.text;
      const res = await call(`${BASE}/${path}`, { method: "POST", body: JSON.stringify(body) });
      const text = await res.text();
      if (!res.ok) return { ok: false, ...failure(res.status, text) };
      const id = (JSON.parse(text) as { request_id?: string }).request_id;
      return id ? { ok: true, providerJobId: id } : { ok: false, error: "Higgsfield gave no request id.", final: false };
    },
    async collect(id) {
      const res = await call(`${BASE}/requests/${encodeURIComponent(id)}/status`);
      const text = await res.text();
      if (!res.ok) {
        const f = failure(res.status, text);
        return res.status >= 500 ? { state: "waiting" } : { state: "failed", ...f, response: clean(text) };
      }
      const r = JSON.parse(text) as { status?: string; images?: { url: string }[]; error?: string };
      if (r.status === "completed") {
        const urls = (r.images ?? []).map((i) => i.url).filter(Boolean);
        return urls.length ? { state: "done", urls, response: r }
          : { state: "failed", error: "Higgsfield finished without a picture.", final: false, response: r };
      }
      // A safety refusal is common and often passes on a second try (prototype knowledge); it is refunded.
      if (r.status === "nsfw") return { state: "failed", error: "The image model refused the picture as unsafe.", final: false, response: r };
      if (r.status === "failed") return { state: "failed", error: r.error ?? "The image model failed.", final: false, response: r };
      return { state: "waiting" };
    },
    async probe() {
      const out: Record<string, unknown> = {};
      for (const [i, s] of schemes.entries()) {
        const r = await go(`${BASE}/requests/00000000-0000-4000-8000-000000000000/status`, { headers: headersOf(i) });
        out[`status_${s}`] = { status: r.status, body: clean(await r.text()) };
      }
      // What the key may use: every model's address, kind and price in credits.
      const r = await call(`${BASE}/models`);
      if (r.ok) {
        const j = (await r.json()) as { total?: number; items?: { slug: string; output_type: string; base_credits: string; operation_type: string[] }[] };
        out.total = j.total;
        out.models = (j.items ?? []).map((m) => [m.slug, m.output_type, m.base_credits, m.operation_type.join(",")]);
      } else out.models = { status: r.status, body: clean(await r.text()) };
      // The input each of Fume's image models takes.
      for (const slug of new Set(Object.values(endpoints).flatMap((e) => [e.text, e.references]))) {
        const d = await call(`${BASE}/models/${slug}`);
        out[`model ${slug}`] = { status: d.status, body: clean(await d.text()) };
      }
      return out;
    },
  };
}
