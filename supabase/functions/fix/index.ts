// The edge function `fix` (handler.ts says what it does). Deployed with verify_jwt off: the handler reads the fix with
// the caller's own token first. Needs the secrets FAL_KEY, and ANTHROPIC_API_KEY (with ANTHROPIC_WORKSPACE_ID) to find
// the part on the product's photographs. DESIGN_URL is the design service (as for `design`);
// VERCEL_BYPASS_SECRET lets this function past Vercel's deployment protection on previews.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { fal } from "../engine/fal.ts";
import { handleFix } from "./handler.ts";
import { claudeLocate } from "./locate.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const keyOf = (json: string, legacy: string) =>
  (Deno.env.get(json) && JSON.parse(Deno.env.get(json)!).default) || Deno.env.get(legacy)!;
const publishable = keyOf("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
const secret = keyOf("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
const service = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const designUrl = Deno.env.get("DESIGN_URL") ?? "https://fume-app-git-claude-project-thread-4e84v4-fume-5d92c9b4.vercel.app/api/design";
const bypass = Deno.env.get("VERCEL_BYPASS_SECRET");
const falKey = Deno.env.get("FAL_KEY");
const provider = falKey ? fal(falKey) : null;
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
const locate = claudeLocate(claude, allowed);

Deno.serve((req) =>
  handleFix(req, (authorization) => {
    const caller = createClient(url, publishable, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return {
      canRead: async (id) => {
        const { data } = await caller.from("picture_fixes").select("id").eq("id", id).maybeSingle();
        return Boolean(data);
      },
      service: {
        take: async (id) => {
          const { data, error } = await service.rpc("fix_take", { p_fix_id: id });
          return { data: data ?? null, error };
        },
        finish: async (id, result) => await service.rpc("fix_finish", { p_fix_id: id, p_result: result }),
        fail: async (id, why, cents) => await service.rpc("fix_fail", { p_fix_id: id, p_error: why, p_cost_cents: cents }),
        readLink: async (bucket, path) => (await service.storage.from(bucket).createSignedUrl(path, 900)).data?.signedUrl ?? null,
        uploadLink: async (bucket, path) => (await service.storage.from(bucket).createSignedUploadUrl(path, { upsert: true })).data?.signedUrl ?? null,
        store: async (bucket, path, bytes) =>
          !(await service.storage.from(bucket).upload(path, bytes, { contentType: "image/png", upsert: true })).error,
        spent: async (id, usd, reference) =>
          await service.rpc("fix_spent", { p_fix_id: id, p_llm_usd: usd, p_reference: reference }),
        model: async (task) => (await service.rpc("task_model", { p_task: task })).data ?? null,
      },
      locate,
      askDetails: async (candidateId) => {
        await fetch(`${url}/functions/v1/details`, {
          method: "POST",
          headers: { Authorization: `Bearer ${secret}`, apikey: secret, "content-type": "application/json" },
          body: JSON.stringify({ candidateId }),
          signal: AbortSignal.timeout(20_000),
        });
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
      image: {
        priceCents: (m) => provider?.priceCents(m) ?? 15,
        submit: async (r) => {
          if (!provider) return { ok: false, error: "Fume has no key for fal." };
          const s = await provider.submit(r);
          return s.ok ? { ok: true, providerJobId: s.providerJobId } : { ok: false, error: s.error };
        },
        collect: async (id) => provider ? await provider.collect(id) : { state: "failed", error: "Fume has no key for fal.", final: true, response: null },
      },
      download: async (link) => {
        const res = await fetch(link, { signal: AbortSignal.timeout(60_000) });
        return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
      },
      wait: (ms) => new Promise((r) => setTimeout(r, ms)),
      // deno-lint-ignore no-explicit-any
      later: (work) => (globalThis as any).EdgeRuntime?.waitUntil(work),
      now: () => Date.now(),
    };
  })
);
