// The edge function `details` (handler.ts says what it does). Deployed with verify_jwt off: the handler reads the
// candidate with the caller's own token first, so only Fume's staff ask; the Engine asks with the project's secret key.
// Secrets: ANTHROPIC_API_KEY (with ANTHROPIC_WORKSPACE_ID). DESIGN_URL is the design service; VERCEL_BYPASS_SECRET
// lets this function past Vercel's deployment protection on previews.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { handleDetails } from "./handler.ts";
import { claudeDetails } from "./models.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const keyOf = (json: string, legacy: string) =>
  (Deno.env.get(json) && JSON.parse(Deno.env.get(json)!).default) || Deno.env.get(legacy)!;
const publishable = keyOf("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
const secret = keyOf("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
const service = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const designUrl = Deno.env.get("DESIGN_URL") ?? "https://fume-app-git-claude-project-thread-4e84v4-fume-5d92c9b4.vercel.app/api/design";
const bypass = Deno.env.get("VERCEL_BYPASS_SECRET");
const workspace = Deno.env.get("ANTHROPIC_WORKSPACE_ID");
const claude = new Anthropic({
  timeout: 60_000,
  maxRetries: 1,
  ...(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : {}),
});
async function allowed(): Promise<boolean> {
  const { data, error } = await service.rpc("fume_llm_budget");
  return !error && Boolean((data as { allowed?: boolean } | null)?.allowed);
}
const models = claudeDetails(claude, allowed);

Deno.serve((req) =>
  handleDetails(req, (authorization) => {
    const caller = createClient(url, publishable, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return {
      canRead: async (id) => {
        if (authorization === `Bearer ${secret}`) return true; // the Engine itself
        const { data } = await caller.from("candidates").select("id").eq("id", id).maybeSingle();
        return Boolean(data);
      },
      service: {
        take: async (id) => {
          const { data, error } = await service.rpc("details_take", { p_candidate_id: id });
          return { data: data ?? null, error };
        },
        finish: async (id, details, usd) => await service.rpc("details_finish", { p_candidate_id: id, p_details: details, p_llm_usd: usd }),
        readLink: async (bucket, path) => (await service.storage.from(bucket).createSignedUrl(path, 900)).data?.signedUrl ?? null,
        uploadLink: async (bucket, path) => (await service.storage.from(bucket).createSignedUploadUrl(path, { upsert: true })).data?.signedUrl ?? null,
        keep: async (link, bucket, path) => {
          if (!/^https:\/\//.test(link)) return false;
          const got = await fetch(link, { signal: AbortSignal.timeout(20_000), redirect: "follow" });
          const type = got.headers.get("content-type") ?? "";
          if (!got.ok || !type.startsWith("image/")) return false;
          const bytes = new Uint8Array(await got.arrayBuffer());
          if (bytes.byteLength > 20_000_000) return false;
          return !(await service.storage.from(bucket).upload(path, bytes, { contentType: type, upsert: true })).error;
        },
        setParts: async (id, parts, photos, model, usd) =>
          await service.rpc("product_parts_set", { p_product_id: id, p_parts: parts, p_photos: photos, p_model: model, p_llm_usd: usd }),
      },
      step: async (request) => {
        const res = await fetch(designUrl, {
          method: "POST",
          headers: { "content-type": "application/json", ...(bypass ? { "x-vercel-protection-bypass": bypass } : {}) },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(90_000),
        });
        let body: Record<string, unknown> = {};
        try {
          body = await res.json();
        } catch {
          body = { error: `The design service answered ${res.status}.` };
        }
        return { ok: res.ok, status: res.status, body };
      },
      ...models,
      // deno-lint-ignore no-explicit-any
      later: (work) => (globalThis as any).EdgeRuntime?.waitUntil(work),
    };
  })
);
