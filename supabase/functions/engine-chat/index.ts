// The edge function `engine-chat` (handler.ts says what it does). Deployed with verify_jwt off: the handler reads the
// message or the field with the caller's own token first. Needs the secret ANTHROPIC_API_KEY.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { betaZodOutputFormat } from "npm:@anthropic-ai/sdk@1.3.0/helpers/beta/zod";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import type { z } from "npm:zod@4.6.7";
import { handleEngineChat, type Written } from "./handler.ts";
import { CHAT_SYSTEM, chatPrompt, EngineAnswer, EngineWriting, WRITE_SYSTEM, writePrompt } from "./chat.ts";

// The cheap model first (Marcus, 3 Nov).
const MODEL = "claude-haiku-5-5";
/** Claude Haiku 5.5's list price for prompts up to 100K tokens, in dollars per million tokens. */
const PRICE = { input: 0.1, output: 0.5 };
const url = Deno.env.get("SUPABASE_URL")!;
const keyOf = (json: string, legacy: string) =>
  (Deno.env.get(json) && JSON.parse(Deno.env.get(json)!).default) || Deno.env.get(legacy)!;
const publishable = keyOf("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
const secret = keyOf("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
const service = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const workspace = Deno.env.get("ANTHROPIC_WORKSPACE_ID");
const claude = new Anthropic({
  timeout: 45_000,
  maxRetries: 2,
  ...(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : {}),
});

/** Whether the week's ceiling on the model's cost allows one more call (20261103110000_llm_budget.sql). */
async function withinBudget(): Promise<boolean> {
  const { data, error } = await service.rpc("fume_llm_budget");
  return !error && Boolean((data as { allowed?: boolean } | null)?.allowed);
}

async function ask<T>(system: string, content: string, schema: z.ZodType<T>): Promise<Written<T>> {
  if (!(await withinBudget()))
    return { ok: false, error: "This week's budget for Fume's language model is used up.", usage: { model: MODEL, input_tokens: 0, output_tokens: 0, cost_usd: 0 } };
  const m = await claude.beta.messages.parse({
    model: MODEL,
    max_tokens: 2_000,
    system,
    messages: [{ role: "user", content }],
    output_config: { effort: "low", format: betaZodOutputFormat(schema) },
  });
  const u = m.usage;
  const usage = {
    model: m.model,
    input_tokens: u.input_tokens,
    output_tokens: u.output_tokens,
    cost_usd: Math.round(((u.input_tokens * PRICE.input + u.output_tokens * PRICE.output) / 1_000_000) * 10_000) / 10_000,
  };
  if (m.stop_reason === "refusal") return { ok: false, error: "The model declined.", usage };
  if (!m.parsed_output) return { ok: false, error: "The answer could not be read.", usage };
  return { ok: true, out: m.parsed_output as T, usage };
}

Deno.serve((req) =>
  handleEngineChat(req, (authorization) => {
    const asCaller = createClient(url, publishable, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return {
      canRead: async (messageId) => {
        const { data } = await asCaller.from("engine_messages").select("id").eq("id", messageId).maybeSingle();
        return Boolean(data);
      },
      context: async (messageId) => {
        const { data, error } = await service.rpc("engine_chat_context", { p_message_id: messageId });
        return error || !data ? null : data;
      },
      writeContext: async (field) => {
        const { data, error } = await asCaller.rpc("engine_write_context", { p_field: field });
        return error || !data ? null : data;
      },
      answer: (ctx) => ask(CHAT_SYSTEM, chatPrompt(ctx), EngineAnswer),
      write: (field, knows) => ask(WRITE_SYSTEM, writePrompt(field, knows, new Date().toISOString()), EngineWriting),
      keepAnswer: async (messageId, text, items, suggestion) => {
        const { data, error } = await service.rpc("engine_chat_answer", {
          p_message_id: messageId,
          p_text: text,
          p_items: items,
          p_suggestion: suggestion,
        });
        if (error) throw new Error(error.message);
        return data;
      },
      keep: async (r) => {
        const kept = await service.from("task_runs").insert({
          workspace_id: r.workspaceId,
          kind: r.kind,
          subject_id: r.subjectId ?? crypto.randomUUID(),
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
    };
  }),
);
