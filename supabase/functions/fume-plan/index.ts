// The edge function `fume-plan` (handler.ts says what it does). Deployed with verify_jwt off: the handler reads the
// campaign with the caller's own token first. Needs the secret ANTHROPIC_API_KEY (Supabase › Edge Functions › Secrets).
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { betaZodOutputFormat } from "npm:@anthropic-ai/sdk@1.3.0/helpers/beta/zod";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { handlePlan, type Written } from "./handler.ts";
import { costOf, PlanAnswer, prompt, SYSTEM, toBody } from "./plan.ts";

const MODEL = "claude-opus-5-5";
const url = Deno.env.get("SUPABASE_URL")!;
const keyOf = (json: string, legacy: string) =>
  (Deno.env.get(json) && JSON.parse(Deno.env.get(json)!).default) || Deno.env.get(legacy)!;
const publishable = keyOf("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
const secret = keyOf("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
const service = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
// The function's time runs out after about 150 seconds; the run is taken again on the next read if it does.
const claude = new Anthropic({ timeout: 130_000, maxRetries: 1 });

async function write(task: Parameters<typeof prompt>[0], problem?: string): Promise<Written> {
  const content = problem
    ? `${prompt(task)}\n\nYour last plan was refused by Fume's checks: ${problem}\nWrite it again and fix that.`
    : prompt(task);
  const message = await claude.beta.messages.parse({
    model: MODEL,
    max_tokens: 16_000,
    system: SYSTEM,
    messages: [{ role: "user", content }],
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: betaZodOutputFormat(PlanAnswer) },
    // If Opus declines for policy reasons, Anthropic retries on its default fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });
  const usage = {
    model: message.model,
    input_tokens: message.usage.input_tokens,
    output_tokens: message.usage.output_tokens,
    cost_usd: costOf(message.usage),
  };
  if (message.stop_reason === "refusal")
    return { ok: false, error: "The model declined to write this plan.", usage, final: true };
  if (message.stop_reason === "max_tokens") return { ok: false, error: "The plan was cut off.", usage };
  if (!message.parsed_output) return { ok: false, error: "The plan could not be read.", usage };
  return { ok: true, answer: message.parsed_output, usage };
}

const err = (e: { message: string; details?: string } | null) =>
  e ? { message: e.message, details: e.details } : null;

Deno.serve((req) =>
  handlePlan(req, (authorization) => {
    const asCaller = createClient(url, publishable, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return {
      canRead: async (campaignId) => {
        const { data } = await asCaller.from("campaigns").select("id").eq("id", campaignId).maybeSingle();
        return Boolean(data);
      },
      service: {
        take: async (campaignId) => {
          const { data, error } = await service.rpc("fume_take_plan", { p_campaign_id: campaignId });
          return { data, error: err(error) };
        },
        finish: async (runId, body, changes, usage) => {
          const { error } = await service.rpc("fume_finish_plan", {
            p_run_id: runId,
            p_body: body,
            p_changes: changes,
            p_usage: usage,
          });
          return { error: err(error) };
        },
        fail: async (runId, error, usage, final) => {
          const { error: e } = await service.rpc("fume_fail_plan", {
            p_run_id: runId,
            p_error: error,
            p_usage: usage,
            p_final: final,
          });
          return { error: err(e) };
        },
      },
      write,
      toBody,
      later: (work) => EdgeRuntime.waitUntil(work),
    };
  }),
);
