// The edge function `fume-chat` (handler.ts says what it does). Deployed with verify_jwt off: the handler reads the
// message with the caller's own token first. Needs the secret ANTHROPIC_API_KEY (Supabase › Edge Functions › Secrets).
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { betaZodOutputFormat } from "npm:@anthropic-ai/sdk@1.3.0/helpers/beta/zod";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { type Answer, handleChat } from "./handler.ts";
import { ChatAnswer, type ChatContext, prompt, SYSTEM } from "./chat.ts";

// The cheap model first (Marcus, 3 Nov); Opus only where it is needed.
const MODEL = "claude-haiku-5-5";
/** Claude Haiku 5.5's list price for prompts up to 100K tokens, in dollars per million tokens. */
const PRICE = { input: 0.1, output: 0.5 };
const url = Deno.env.get("SUPABASE_URL")!;
const keyOf = (json: string, legacy: string) =>
  (Deno.env.get(json) && JSON.parse(Deno.env.get(json)!).default) || Deno.env.get(legacy)!;
const publishable = keyOf("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
const secret = keyOf("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
const service = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
// A key made for the whole organisation must name the Anthropic workspace to bill (secret ANTHROPIC_WORKSPACE_ID);
// a key made inside a workspace needs nothing more.
const workspace = Deno.env.get("ANTHROPIC_WORKSPACE_ID");
const claude = new Anthropic({
  timeout: 30_000,
  maxRetries: 1,
  ...(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : {}),
});

/** Whether the week's ceiling on the model's cost allows one more call (20261103110000_llm_budget.sql). */
async function withinBudget(): Promise<boolean> {
  const { data, error } = await service.rpc("fume_llm_budget");
  return !error && Boolean((data as { allowed?: boolean } | null)?.allowed);
}

async function write(ctx: ChatContext): Promise<Answer> {
  if (!(await withinBudget()))
    return {
      ok: false,
      error: "This week's budget for Fume's language model is used up.",
      usage: { model: MODEL, input_tokens: 0, output_tokens: 0, cost_usd: 0 },
    };
  const message = await claude.beta.messages.parse({
    model: MODEL,
    max_tokens: 1_000,
    system: SYSTEM,
    messages: [{ role: "user", content: prompt(ctx) }],
    output_config: { effort: "low", format: betaZodOutputFormat(ChatAnswer) },
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
  handleChat(req, (authorization) => {
    const asCaller = createClient(url, publishable, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return {
      canRead: async (messageId) => {
        const { data } = await asCaller.from("conversation_messages").select("id").eq("id", messageId).maybeSingle();
        return Boolean(data);
      },
      context: async (messageId) => {
        const { data, error } = await service.rpc("fume_chat_context", { p_message_id: messageId });
        if (error || !data) return null;
        const ctx = data as ChatContext;
        // What Fume knows about the brand; the answer goes on without it if it cannot be read.
        const brain = await service.rpc("brain_context", { p_workspace_id: ctx.message.workspace_id });
        return { ...ctx, brain: brain.error ? null : brain.data };
      },
      write,
      answer: async (messageId, text, card) => {
        const { data, error } = await service.rpc("fume_chat_answer", {
          p_message_id: messageId,
          p_text: text,
          p_card: card,
        });
        if (error) throw new Error(error.message);
        return data;
      },
      keep: async ({ ctx, output, error, usage }) => {
        const kept = await service.from("task_runs").insert({
          workspace_id: ctx.message.workspace_id,
          kind: "chat",
          subject_id: ctx.message.id,
          attempt: 1,
          state: error ? "failed" : "succeeded",
          model: usage.model || null,
          input: { message: ctx.message.text, campaigns: ctx.campaigns.length, talk: ctx.talk.length },
          output,
          error,
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          cost_usd: usage.cost_usd,
          finished_at: new Date().toISOString(),
        });
        if (kept.error) console.error("task_runs", kept.error.message);
      },
    };
  }),
);
