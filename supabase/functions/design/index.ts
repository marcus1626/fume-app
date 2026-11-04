// The edge function `design` (handler.ts says what it does). Deployed with verify_jwt off: the handler reads the layer
// with the caller's own token first. Needs the secret ANTHROPIC_API_KEY. DESIGN_URL is the design service in the
// fume-app Vercel project (POST /api/design). Until PR #2 is merged the service lives only on this branch's preview,
// so that is the default; when it is merged, the default becomes https://fume-app.vercel.app/api/design.
// VERCEL_BYPASS_SECRET lets this function past Vercel's deployment protection on previews (Marcus chose it 4 Nov).
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { betaZodOutputFormat } from "npm:@anthropic-ai/sdk@1.3.0/helpers/beta/zod";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { handleDesign } from "./handler.ts";
import { CHOOSE_SYSTEM, choosePrompt, costOf, LayoutChoice, MODEL, Review, REVIEW_SYSTEM, reviewPrompt, type Take } from "./layer.ts";

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

const base64 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const typeOf = (bytes: Uint8Array) =>
  bytes[0] === 0x89 ? "image/png" : bytes[0] === 0xff ? "image/jpeg" : bytes[0] === 0x52 ? "image/webp" : "image/png";

async function download(bucket: string, path: string): Promise<Uint8Array | null> {
  const { data, error } = await service.storage.from(bucket).download(path);
  return error || !data ? null : new Uint8Array(await data.arrayBuffer());
}

async function look<T>(system: string, text: string, bytes: Uint8Array, schema: Parameters<typeof betaZodOutputFormat>[0], spent: { usd: number }) {
  const message = await claude.beta.messages.parse({
    model: MODEL,
    max_tokens: 4_000,
    system,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: typeOf(bytes) as "image/png", data: base64(bytes) } },
        { type: "text", text },
      ],
    }],
    output_config: { format: betaZodOutputFormat(schema) },
  });
  spent.usd += costOf(message.usage);
  return (message.parsed_output ?? null) as T | null;
}

Deno.serve((req) =>
  handleDesign(req, (authorization) => {
    const caller = createClient(url, publishable, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return {
      canRead: async (id) => {
        const { data } = await caller.from("design_layers").select("id").eq("id", id).maybeSingle();
        return Boolean(data);
      },
      service: {
        take: async (id) => {
          const { data, error } = await service.rpc("design_take", { p_layer_id: id });
          return { data: (data as Take | null) ?? null, error };
        },
        finish: async (id, result) => (await service.rpc("design_finish", { p_layer_id: id, p_result: result })),
        fail: async (id, why, usd) => (await service.rpc("design_fail", { p_layer_id: id, p_error: why, p_llm_usd: usd })),
        links: async (t) => {
          const read = await service.storage.from(t.picture.bucket).createSignedUrl(t.picture.path, 600);
          const png = await service.storage.from(t.store.bucket).createSignedUploadUrl(t.store.png);
          const fig = await service.storage.from(t.store.bucket).createSignedUploadUrl(t.store.fig);
          if (read.error || png.error || fig.error) throw new Error("Fume could not make the storage links.");
          return { picture: read.data.signedUrl, png: png.data.signedUrl, fig: fig.data.signedUrl };
        },
        read: download,
        picture: (t) => download(t.picture.bucket, t.picture.path),
      },
      choose: (t, words, picture, spent) => look<LayoutChoice>(CHOOSE_SYSTEM, choosePrompt(t, words), picture, LayoutChoice, spent),
      review: (t, words, png, spent) => look<Review>(REVIEW_SYSTEM, reviewPrompt(t, words), png, Review, spent),
      lay: async (request) => {
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
      // deno-lint-ignore no-explicit-any
      later: (work) => (globalThis as any).EdgeRuntime?.waitUntil(work),
      now: () => Date.now(),
    };
  })
);
