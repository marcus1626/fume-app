// Deploy with verify_jwt off, as details/engine: caller RLS is checked before service-only RPCs.
// Secrets: ANTHROPIC_API_KEY and optional ANTHROPIC_WORKSPACE_ID. No image-generation budget is spent.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { handleShootRead, type Input } from "./handler.ts";
import { signPreview } from "./preview.ts";
import { models } from "./models.ts";
const url = Deno.env.get("SUPABASE_URL")!;
const keyOf = (json: string, legacy: string) =>
  (Deno.env.get(json) && JSON.parse(Deno.env.get(json)!).default) || Deno.env.get(legacy)!;
const publishable = keyOf("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
const secret = keyOf("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(url, secret, options);
const workspace = Deno.env.get("ANTHROPIC_WORKSPACE_ID");
const claude = new Anthropic({
  timeout: 60_000,
  maxRetries: 0,
  ...(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : {}),
});
function checked<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
Deno.serve((req) => {
  const authorization = req.headers.get("Authorization") ?? "";
  const caller = createClient(url, publishable, { ...options, global: { headers: { Authorization: authorization } } });
  return handleShootRead(req, {
    canRead: async (id) => {
      if (authorization === `Bearer ${secret}`) return true;
      const { data, error } = await caller.rpc("get_shoot", { p_shoot_id: id });
      return !error && Boolean(data?.id);
    },
    input: async (id) => checked(await service.rpc("shoot_read_input", { p_shoot_id: id })) as Input | null,
    take: async (id) => checked(await service.rpc("shoot_read_take", { p_shoot_id: id })),
    budget: async () => {
      const { data, error } = await service.rpc("fume_llm_budget");
      return !error && Boolean(data?.allowed);
    },
    sign: (p) => signPreview(service.storage, p),
    reserve: async (id, token) => checked(await service.rpc("shoot_read_reserve", { p_shoot_id: id, p_token: token })),
    stop: async (id, token, entries) => {
      checked(await service.rpc("shoot_read_stop", { p_shoot_id: id, p_token: token, p_entries: entries }));
    },
    cost: async (id, token, call, error) => {
      checked(
        await service.rpc("shoot_read_cost", { p_shoot_id: id, p_token: token, p_call: call, p_error: error ?? null }),
      );
    },
    save: async (id, token, entries, done) =>
      checked(
        await service.rpc("shoot_read_save", { p_shoot_id: id, p_token: token, p_entries: entries, p_done: done }),
      ),
    release: async (id, token) => {
      checked(await service.rpc("shoot_read_release", { p_shoot_id: id, p_token: token }));
    },
    ...models(claude),
    // deno-lint-ignore no-explicit-any
    later: (work) => (globalThis as any).EdgeRuntime?.waitUntil(work),
  });
});
