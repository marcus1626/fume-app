// The edge function `fume-plan` (handler.ts says what it does). Deployed with verify_jwt off: the handler reads the
// campaign with the caller's own token first. Needs the secret ANTHROPIC_API_KEY (Supabase › Edge Functions › Secrets).
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { betaZodOutputFormat } from "npm:@anthropic-ai/sdk@1.3.0/helpers/beta/zod";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { handlePlan, type Written } from "./handler.ts";
import { CLAIM_SYSTEM, ClaimRead, claimPrompt, columnOf, costOf, layoutsOf, type CopyLine, PlanAnswer, type PlanTask, prompt, SYSTEM, toBody } from "./plan.ts";

// The cheap model first (Marcus, 3 Nov), and a stronger one where the work is creative: the plan's ideas and words
// (Marcus, 9 Nov: "Virkelig bruk Engine ... kreativitet"). The claim check stays on the cheap model.
const MODEL = "claude-haiku-5-5";
const WRITE_MODEL = "claude-sonnet-5-5";
const url = Deno.env.get("SUPABASE_URL")!;
const keyOf = (json: string, legacy: string) =>
  (Deno.env.get(json) && JSON.parse(Deno.env.get(json)!).default) || Deno.env.get(legacy)!;
const publishable = keyOf("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
const secret = keyOf("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
const service = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
// The function's time runs out after about 150 seconds; the run is taken again on the next read if it does.
// A key made for the whole organisation must name the Anthropic workspace to bill (secret ANTHROPIC_WORKSPACE_ID);
// a key made inside a workspace needs nothing more.
const workspace = Deno.env.get("ANTHROPIC_WORKSPACE_ID");
const claude = new Anthropic({
  timeout: 130_000,
  maxRetries: 1,
  ...(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : {}),
});

/** Whether the week's ceiling on the model's cost allows one more call (20261103110000_llm_budget.sql). */
async function withinBudget(): Promise<boolean> {
  const { data, error } = await service.rpc("fume_llm_budget");
  return !error && Boolean((data as { allowed?: boolean } | null)?.allowed);
}

async function write(task: Parameters<typeof prompt>[0], problem?: string): Promise<Written> {
  if (!(await withinBudget()))
    return {
      ok: false,
      error: "This week's budget for Fume's language model is used up.",
      usage: { model: WRITE_MODEL, input_tokens: 0, output_tokens: 0, cost_usd: 0 },
      final: true,
    };
  const content = problem
    ? `${prompt(task)}\n\nYour last plan was refused by Fume's checks: ${problem}\nWrite it again and fix that.`
    : prompt(task);
  const message = await claude.beta.messages.parse({
    model: WRITE_MODEL,
    max_tokens: 16_000,
    system: SYSTEM,
    messages: [{ role: "user", content }],
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: betaZodOutputFormat(PlanAnswer) },
  });
  const usage = {
    model: message.model,
    input_tokens: message.usage.input_tokens,
    output_tokens: message.usage.output_tokens,
    cost_usd: costOf(message.usage, message.model),
  };
  if (message.stop_reason === "refusal")
    return { ok: false, error: "The model declined to write this plan.", usage, final: true };
  if (message.stop_reason === "max_tokens") return { ok: false, error: "The plan was cut off.", usage };
  if (!message.parsed_output) return { ok: false, error: "The plan could not be read.", usage };
  return { ok: true, answer: message.parsed_output, usage };
}

/** The claim check: the cheap model reads every line of words; code then decides what backs each claim. */
async function checkCopy(task: PlanTask, lines: CopyLine[]) {
  const none = { model: MODEL, input_tokens: 0, output_tokens: 0, cost_usd: 0 };
  if (!(await withinBudget())) return { read: null, usage: none };
  const message = await claude.beta.messages.parse({
    model: MODEL,
    max_tokens: 8_000,
    system: CLAIM_SYSTEM,
    messages: [{ role: "user", content: claimPrompt(task, lines) }],
    thinking: { type: "adaptive" },
    output_config: { effort: "low", format: betaZodOutputFormat(ClaimRead) },
  });
  const usage = {
    model: message.model,
    input_tokens: message.usage.input_tokens,
    output_tokens: message.usage.output_tokens,
    cost_usd: costOf(message.usage),
  };
  return { read: message.stop_reason === "end_turn" ? (message.parsed_output ?? null) : null, usage };
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
          if (error || !data) return { data, error: err(error) };
          // What Fume knows about the brand; the plan is written without it if it cannot be read.
          const brain = await service.rpc("brain_context_of_campaign", { p_campaign_id: campaignId });
          // The brand's Tone of Voice for the words; without it the plan keeps to the brief's.
          const voice = await service.rpc("brand_voice_of_campaign", { p_campaign_id: campaignId });
          // The brand's other recent headlines (the new one is its own) and its column of words (the prompt asks for
          // a headline that fits it, and the copy check holds it). Read through the database: the service role has no
          // rights on the tables themselves.
          const extras = await service.rpc("fume_plan_extras", { p_campaign_id: campaignId });
          const x = (extras.error ? null : extras.data) as { recent?: string[]; scenes?: string[]; layouts?: unknown } | null;
          return {
            data: {
              ...data,
              brain: brain.error ? null : brain.data,
              voice: voice.error ? null : voice.data,
              recent: x?.recent ?? [],
              scenes: Array.isArray(x?.scenes) ? x!.scenes.filter((v): v is string => typeof v === "string") : [],
              column: columnOf(x?.layouts),
              layouts: layoutsOf(x?.layouts),
            },
            error: null,
          };
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
        copyChecked: async (runId, check) => {
          const { error } = await service.rpc("fume_plan_copy_checked", { p_run_id: runId, p_check: check });
          return { error: err(error) };
        },
      },
      write,
      checkCopy,
      toBody,
      later: (work) => EdgeRuntime.waitUntil(work),
    };
  }),
);
