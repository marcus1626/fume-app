// fal, the image models Higgsfield's API does not have (4 Nov 2026: Nano Banana Pro is switched off there, and Nano
// Banana 2, GPT Image and Seedream are missing). Marcus: "Hvis Higgsfield ikke har de så må vi ha fal". fal's queue:
// a request is submitted to the model's address and answered with its own result address, which is kept as the
// provider's job id and asked again until the picture is there.
import type { ProviderRequest } from "../_shared/engine/index.ts";
import type { Collected, ImageProvider, Submitted } from "./provider.ts";

const QUEUE = "https://queue.fal.run";
export const FAL_QUEUE = QUEUE;

type Family = "nano-banana" | "seedream" | "gpt-image";
// Fume's model names to fal's model addresses (fal's catalogue, to be confirmed by the probe; the secret
// FAL_ENDPOINTS replaces any of them without a deploy).
export const FAL_ENDPOINTS: Record<string, { text: string; references: string; family?: Family }> = {
  "nano-banana-pro": { text: "fal-ai/nano-banana-pro", references: "fal-ai/nano-banana-pro/edit", family: "nano-banana" },
  "nano-banana-2": { text: "fal-ai/nano-banana-2", references: "fal-ai/nano-banana-2/edit", family: "nano-banana" },
  "seedream-4": { text: "fal-ai/bytedance/seedream/v4/text-to-image", references: "fal-ai/bytedance/seedream/v4/edit", family: "seedream" },
  "gpt-image": { text: "fal-ai/gpt-image-1.5", references: "fal-ai/gpt-image-1.5/edit", family: "gpt-image" },
};
const familyOf = (model: string, e: { family?: Family }): Family =>
  e.family ?? (model.startsWith("seedream") ? "seedream" : model.startsWith("gpt") ? "gpt-image" : "nano-banana");

// Estimates in cents per picture until fal's bill says otherwise (list prices, 2K where there is a choice).
const PRICES: Record<string, number> = { "nano-banana-pro": 15, "nano-banana-2": 8, "seedream-4": 3, "gpt-image": 13 };

const NANO_RATIOS = ["21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"];
const value = (r: string) => {
  const [w, h] = r.split(":").map(Number);
  return w / h;
};
const nearest = (ratio: string, allowed: string[]) =>
  allowed.includes(ratio) ? ratio
    : allowed.reduce((a, b) => (Math.abs(Math.log(value(b) / value(ratio))) < Math.abs(Math.log(value(a) / value(ratio))) ? b : a));

/** A size of about four megapixels in the format's ratio, in steps of 16 (Seedream takes a width and a height). */
export function sizeFor(ratio: string, area = 2048 * 2048): { width: number; height: number } {
  const r = value(ratio);
  const step = (n: number) => Math.round(n / 16) * 16;
  return { width: step(Math.sqrt(area * r)), height: step(Math.sqrt(area / r)) };
}

/** What fal's model is asked for, from the checked prompt (the text goes unchanged; the pictures go first). */
export function falBody(family: Family, r: ProviderRequest): Record<string, unknown> {
  const body: Record<string, unknown> = { prompt: r.text, num_images: 1 };
  if (r.referenceUrls.length) body.image_urls = r.referenceUrls;
  if (r.seed !== null && family !== "gpt-image") body.seed = r.seed;
  if (family === "nano-banana") {
    body.aspect_ratio = nearest(r.aspectRatio, NANO_RATIOS);
    body.resolution = r.resolution ?? "2K";
    body.output_format = "png";
  } else if (family === "seedream") {
    body.image_size = sizeFor(r.aspectRatio);
  } else {
    const v = value(r.aspectRatio);
    body.image_size = v > 1.15 ? "1536x1024" : v < 0.87 ? "1024x1536" : "1024x1024";
    body.quality = "high";
    body.output_format = "png";
  }
  return body;
}

export function fal(
  key: string,
  opts: { endpoints?: Record<string, { text: string; references: string; family?: Family }>; fetch?: typeof fetch } = {},
): ImageProvider {
  const endpoints = { ...FAL_ENDPOINTS, ...opts.endpoints };
  const go = opts.fetch ?? fetch;
  const headers = { Authorization: `Key ${key}`, "Content-Type": "application/json", Accept: "application/json" };
  const clean = (t: string) => t.replaceAll(key, "[key]").slice(0, 1500);
  const detail = (text: string) => {
    try {
      const d = (JSON.parse(text) as { detail?: unknown }).detail;
      return typeof d === "string" ? d : JSON.stringify(d ?? text);
    } catch {
      return text;
    }
  };
  const failure = (status: number, text: string) => ({
    error: status === 401 ? "fal refused Fume's key." : status === 403 ? "fal has no credits left for Fume, or the key may not use this model."
      : `fal answered ${status}: ${clean(detail(text)).slice(0, 300)}`,
    final: [400, 401, 403, 404, 422].includes(status),
  });
  return {
    name: "fal",
    priceCents: (m) => PRICES[m] ?? 15,
    handles: (m) => Boolean(endpoints[m]),
    async submit(r): Promise<Submitted> {
      const e = endpoints[r.imageModel];
      if (!e) return { ok: false, error: `fal has no address for ${r.imageModel}.`, final: true };
      const path = r.referenceUrls.length ? e.references : e.text;
      const res = await go(`${QUEUE}/${path}`, { method: "POST", headers, body: JSON.stringify(falBody(familyOf(r.imageModel, e), r)) });
      const text = await res.text();
      if (!res.ok) return { ok: false, ...failure(res.status, text) };
      const j = JSON.parse(text) as { request_id?: string; response_url?: string };
      // The result's address names the model's app and the request; it is all collect needs.
      const id = j.response_url ?? (j.request_id ? `${QUEUE}/${path.split("/").slice(0, 2).join("/")}/requests/${j.request_id}` : null);
      return id ? { ok: true, providerJobId: id, provider: "fal" } : { ok: false, error: "fal gave no request id.", final: false };
    },
    async collect(id): Promise<Collected> {
      if (!id.startsWith(`${QUEUE}/`)) return { state: "failed", error: "Not a fal request.", final: true, response: null };
      const s = await go(`${id}/status`, { headers });
      const st = await s.text();
      if (!s.ok) return s.status >= 500 || s.status === 429 ? { state: "waiting" } : { state: "failed", ...failure(s.status, st), response: clean(st) };
      const status = (JSON.parse(st) as { status?: string }).status;
      if (status !== "COMPLETED") return { state: "waiting" };
      const res = await go(id, { headers });
      const text = await res.text();
      if (!res.ok) {
        // A finished request that failed answers with its reason; a refused picture is often fine on a second try.
        const why = detail(text);
        const unsafe = /safety|nsfw|content.?policy|moderation/i.test(why);
        return { state: "failed", error: unsafe ? "The image model refused the picture as unsafe." : `The image model failed: ${clean(why).slice(0, 300)}`,
          final: false, response: clean(text) };
      }
      const r = JSON.parse(text) as { images?: { url?: string }[]; has_nsfw_concepts?: boolean[] };
      const urls = (r.images ?? []).map((i) => i.url ?? "").filter(Boolean);
      return urls.length ? { state: "done", urls, response: r }
        : { state: "failed", error: "fal finished without a picture.", final: false, response: r };
    },
    async probe(routes?: string[]) {
      const out: Record<string, unknown> = {};
      // Each model's address, asked with an empty request: a real one answers 422 (nothing is made), a missing one 404.
      const addresses = routes?.length ? routes : [...new Set(Object.values(endpoints).flatMap((e) => [e.text, e.references]))];
      for (const path of addresses) {
        const r = await go(`https://fal.run/${path}`, { method: "POST", headers, body: "{}" });
        out[`route ${path}`] = { status: r.status, body: clean(await r.text()).slice(0, 300) };
      }
      return out;
    },
  };
}
