// The edge function `taste-read` (handler.ts says what it does). Deployed with verify_jwt off: the handler asks
// Supabase Auth who the caller is and reads their staff roles with their own token. Needs the secret ANTHROPIC_API_KEY.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { betaZodOutputFormat } from "npm:@anthropic-ai/sdk@1.3.0/helpers/beta/zod";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { signedIn as isSignedIn } from "../_shared/net.ts";
import { passFields, passPrompt, passShape, READ_SYSTEM } from "../_shared/taste/read.ts";
import { type Asked, handleTasteRead, type Reader, type Usage } from "./handler.ts";

/** The readers, with their list prices in dollars per million tokens (prompts up to 100K tokens). */
const MODELS: Record<Reader, { id: string; input: number; output: number }> = {
  haiku: { id: "claude-haiku-5-5", input: 0.1, output: 0.5 },
  sonnet: { id: "claude-sonnet-5-5", input: 2, output: 10 },
  opus: { id: "claude-opus-5-5", input: 4, output: 20 },
};
const url = Deno.env.get("SUPABASE_URL")!;
const keyOf = (json: string, legacy: string) =>
  (Deno.env.get(json) && JSON.parse(Deno.env.get(json)!).default) || Deno.env.get(legacy)!;
const publishable = keyOf("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
const secret = keyOf("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
const service = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const workspace = Deno.env.get("ANTHROPIC_WORKSPACE_ID");
const claude = new Anthropic({
  timeout: 110_000,
  maxRetries: 1,
  ...(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : {}),
});

Deno.serve(async (req) => {
  const authorization = req.headers.get("Authorization") ?? "";
  const asCaller = createClient(url, publishable, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signedIn = req.method === "POST" && (await isSignedIn(asCaller, authorization));
  return handleTasteRead(req, signedIn, {
    staff: async (workspaceId) => {
      const { data: who } = await asCaller.auth.getUser(authorization.replace(/^Bearer\s+/i, ""));
      if (!who.user) return false;
      // Her own rows only: a customer on the brand can see who its staff are, but is not one of them.
      const { data } = await asCaller.from("staff_assignments").select("staff_role").eq("workspace_id", workspaceId).eq("user_id", who.user.id).limit(1);
      return Boolean(data?.length);
    },
    withinBudget: async () => {
      const { data, error } = await service.rpc("fume_llm_budget");
      return !error && Boolean((data as { allowed?: boolean } | null)?.allowed);
    },
    ask: async (pass, shows, picture, reader, effort): Promise<Asked> => {
      const model = MODELS[reader];
      const m = await claude.beta.messages.parse({
        model: model.id,
        max_tokens: 12_000,
        system: READ_SYSTEM,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: "url" in picture ? { type: "url", url: picture.url } : { type: "base64", media_type: picture.mediaType, data: picture.base64 } },
            { type: "text", text: passPrompt(pass) },
          ],
        }],
        output_config: { effort, format: betaZodOutputFormat(passShape(pass, passFields(pass, shows))) },
      });
      const u = m.usage;
      const usage: Usage = {
        model: m.model,
        input_tokens: u.input_tokens,
        output_tokens: u.output_tokens,
        cost_usd: Math.round(((u.input_tokens * model.input + u.output_tokens * model.output) / 1_000_000) * 10_000) / 10_000,
      };
      if (m.stop_reason === "refusal") return { ok: false, error: "The model declined.", usage };
      if (m.stop_reason === "max_tokens" || !m.parsed_output) return { ok: false, error: "The answer could not be read.", usage };
      return { ok: true, out: m.parsed_output as Record<string, Record<string, unknown>>, usage };
    },
    keep: async (r) => {
      // Until the taste tables are live the cost is kept as a `facts` run (a reading of a source, the nearest kind the
      // table takes), so the week's budget counts it; `input.task` says what it was.
      const kept = await service.from("task_runs").insert({
        workspace_id: r.workspaceId,
        kind: "facts",
        subject_id: crypto.randomUUID(),
        attempt: 1,
        state: r.error ? "failed" : "succeeded",
        model: r.usage.model || null,
        input: r.input,
        output: r.output,
        error: r.error,
        input_tokens: r.usage.input_tokens,
        output_tokens: r.usage.output_tokens,
        cost_usd: r.usage.cost_usd,
        finished_at: new Date().toISOString(),
      });
      if (kept.error) console.error("task_runs", kept.error.message);
    },
  });
});
