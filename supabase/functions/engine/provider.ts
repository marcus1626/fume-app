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
}

const BASE = "https://api.higgsfield.ai";

// Fume's model names to Higgsfield's endpoints. The endpoints are read from Higgsfield's SDK and confirmed on the
// first real call; the secret HF_ENDPOINTS ({"nano-banana-pro": "..."}) replaces any of them without a deploy.
export const HIGGSFIELD_ENDPOINTS: Record<string, { text: string; references: string }> = {
  "nano-banana-pro": { text: "google/nano-banana-pro/text-to-image", references: "google/nano-banana-pro/edit" },
  "nano-banana-2": { text: "google/nano-banana-2/text-to-image", references: "google/nano-banana-2/edit" },
  "seedream-4": { text: "bytedance/seedream/v4/text-to-image", references: "bytedance/seedream/v4/edit" },
  "flux-kontext": { text: "flux-pro/kontext/max/text-to-image", references: "flux-pro/kontext/max" },
  "gpt-image": { text: "openai/gpt-image/text-to-image", references: "openai/gpt-image/edit" },
};
// Estimates until Higgsfield's bill says otherwise (cents per picture).
const PRICES: Record<string, number> = { "nano-banana-pro": 15, "nano-banana-2": 6, "seedream-4": 4, "flux-kontext": 8, "gpt-image": 10 };

export function higgsfield(
  credentials: string,
  opts: { endpoints?: Record<string, { text: string; references: string }>; fetch?: typeof fetch } = {},
): ImageProvider {
  const endpoints = { ...HIGGSFIELD_ENDPOINTS, ...opts.endpoints };
  const go = opts.fetch ?? fetch;
  const headers = { Authorization: `Key ${credentials}`, "Content-Type": "application/json", Accept: "application/json" };
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
      const body: Record<string, unknown> = { prompt: r.text, aspect_ratio: r.aspectRatio };
      if (r.seed !== null) body.seed = r.seed;
      if (r.resolution) body.resolution = r.resolution;
      if (r.referenceUrls.length)
        body.input_images = r.referenceUrls.map((image_url) => ({ type: "image_url", image_url }));
      const path = r.referenceUrls.length ? endpoint.references : endpoint.text;
      const res = await go(`${BASE}/${path}`, { method: "POST", headers, body: JSON.stringify(body) });
      const text = await res.text();
      if (!res.ok) return { ok: false, ...failure(res.status, text) };
      const id = (JSON.parse(text) as { request_id?: string }).request_id;
      return id ? { ok: true, providerJobId: id } : { ok: false, error: "Higgsfield gave no request id.", final: false };
    },
    async collect(id) {
      const res = await go(`${BASE}/requests/${encodeURIComponent(id)}/status`, { headers });
      const text = await res.text();
      if (!res.ok) {
        const f = failure(res.status, text);
        return res.status >= 500 ? { state: "waiting" } : { state: "failed", ...f, response: text.slice(0, 2000) };
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
  };
}
