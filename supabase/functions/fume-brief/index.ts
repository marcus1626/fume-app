// The edge function `fume-brief` (handler.ts says what it does). Deployed with verify_jwt off: the handler reads the
// brand with the caller's own token first. Needs the secret ANTHROPIC_API_KEY (Supabase › Edge Functions › Secrets).
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { betaZodOutputFormat } from "npm:@anthropic-ai/sdk@1.3.0/helpers/beta/zod";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { type Answer, handleBrief } from "./handler.ts";
import { BriefAnswer, type BriefAsk, type BriefContext, prompt, SYSTEM } from "./brief.ts";

const MODEL = "claude-opus-5-5";
/** Claude Opus 5.5's list price, in dollars per million tokens. */
const PRICE = { input: 4, output: 20 };
const url = Deno.env.get("SUPABASE_URL")!;
const keyOf = (json: string, legacy: string) =>
  (Deno.env.get(json) && JSON.parse(Deno.env.get(json)!).default) || Deno.env.get(legacy)!;
const publishable = keyOf("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
const secret = keyOf("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
const service = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const claude = new Anthropic({ timeout: 60_000, maxRetries: 1 });

async function write(ask: BriefAsk, ctx: BriefContext): Promise<Answer> {
  const message = await claude.beta.messages.parse({
    model: MODEL,
    max_tokens: 4_000,
    system: SYSTEM,
    messages: [{ role: "user", content: prompt(ask, ctx) }],
    output_config: { effort: "low", format: betaZodOutputFormat(BriefAnswer) },
    // If Opus declines for policy reasons, Anthropic retries on its default fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });
  const u = message.usage;
  const usage = {
    model: message.model,
    input_tokens: u.input_tokens,
    output_tokens: u.output_tokens,
    cost_usd:
      Math.round(((u.input_tokens * PRICE.input + u.output_tokens * PRICE.output) / 1_000_000) * 10_000) / 10_000,
  };
  if (message.stop_reason === "refusal") return { ok: false, error: "The model declined.", usage };
  if (!message.parsed_output) return { ok: false, error: "The answer could not be read.", usage };
  return { ok: true, answer: message.parsed_output, usage };
}

Deno.serve((req) =>
  handleBrief(req, (authorization) => {
    const asCaller = createClient(url, publishable, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return {
      canRead: async (workspaceId) => {
        const { data } = await asCaller.from("workspaces").select("id").eq("id", workspaceId).maybeSingle();
        return Boolean(data);
      },
      context: async (workspaceId, productIds) => {
        const { data, error } = await service.rpc("fume_brief_context", {
          p_workspace_id: workspaceId,
          p_product_ids: productIds,
        });
        return error ? null : (data as BriefContext);
      },
      write,
      keep: async ({ workspaceId, ask, output, error, usage }) => {
        await service.from("task_runs").insert({
          workspace_id: workspaceId,
          kind: "brief",
          subject_id: workspaceId,
          attempt: 1,
          state: error ? "failed" : "succeeded",
          model: usage.model || null,
          input: ask,
          output,
          error,
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          cost_usd: usage.cost_usd,
          finished_at: new Date().toISOString(),
        });
      },
    };
  }),
);
