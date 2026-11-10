// The edge function `taste-read` (handler.ts says what it does). Deployed with verify_jwt off: the handler asks
// Supabase Auth who the caller is and reads their staff roles with their own token. Needs the secret ANTHROPIC_API_KEY
// for the readers asked of Anthropic and FAL_KEY for the ones asked through fal's router.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { betaZodOutputFormat } from "npm:@anthropic-ai/sdk@1.3.0/helpers/beta/zod";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { signedIn as isSignedIn } from "../_shared/net.ts";
import { build } from "../_shared/taste/build.ts";
import type { Card } from "../_shared/taste/profile.ts";
import { parseAnswer, passFields, passPrompt, passPromptWithShape, passShape, READ_SYSTEM } from "../_shared/taste/read.ts";
import { TASTE_SCHEMA_VERSION } from "../_shared/taste/schema.ts";
import { type Asked, handleTasteRead, type Picture, type Reader, type Usage } from "./handler.ts";

/** The readers: which model each is, where it is asked, and its list price in dollars per million tokens (10 Nov 2026).
 *  `anthropic` is asked directly and answers in the shape; `router` is fal's router to any vision model, which
 *  answers in text, so the shape is written into the question. Qwen is not here: the router keeps to providers that
 *  store nothing, and none of Qwen's does. */
const MODELS: Record<Reader, { via: "anthropic" | "router"; id: string; input: number; output: number }> = {
  haiku: { via: "anthropic", id: "claude-haiku-5-5", input: 0.1, output: 0.5 },
  sonnet: { via: "anthropic", id: "claude-sonnet-5-5", input: 2, output: 10 },
  opus: { via: "anthropic", id: "claude-opus-5-5", input: 4, output: 20 },
  "gemini-flash": { via: "router", id: "google/gemini-3.8-flash", input: 0.83, output: 4.12 },
  gemini: { via: "router", id: "google/gemini-4-argon", input: 2, output: 10 },
  "gpt-luna": { via: "router", id: "openai/gpt-6-luna", input: 0.1, output: 0.5 },
  "gpt-terra": { via: "router", id: "openai/gpt-6.1-terra", input: 1, output: 5 },
  "gpt-sol": { via: "router", id: "openai/gpt-6.1-sol", input: 2, output: 10 },
  grok: { via: "router", id: "x-ai/grok-4.7", input: 2, output: 6 },
  "haiku-r": { via: "router", id: "anthropic/claude-haiku-5.5", input: 0.1, output: 0.5 },
  "sonnet-r": { via: "router", id: "anthropic/claude-sonnet-5.5", input: 2, output: 10 },
  "opus-r": { via: "router", id: "anthropic/claude-opus-5.5", input: 4, output: 20 },
};
const ROUTER = "https://fal.run/openrouter/router/vision";
const cents = (usd: number) => Math.round(usd * 10_000) / 10_000;

/** One question through fal's router. The picture goes as a data address; the answer comes back as text. */
async function askRouter(model: (typeof MODELS)[Reader], system: string, prompt: string, picture: Picture): Promise<Asked> {
  const key = Deno.env.get("FAL_KEY");
  const none: Usage = { model: model.id, input_tokens: 0, output_tokens: 0, cost_usd: 0 };
  if (!key) return { ok: false, error: "No key for fal.", usage: none };
  const send = (steady: boolean, reasoning: boolean) =>
    fetch(ROUTER, {
      method: "POST",
      signal: AbortSignal.timeout(110_000),
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        model: model.id,
        system_prompt: system,
        prompt,
        image_urls: ["url" in picture ? picture.url : `data:${picture.mediaType};base64,${picture.base64}`],
        // The same picture should read the same twice; a model that takes no temperature is asked again without one.
        ...(steady ? { temperature: 0 } : {}),
        // Some models cannot answer without reasoning; they are asked again with it, and it then comes with the answer.
        ...(reasoning ? { reasoning: true } : {}),
        max_tokens: reasoning ? 16_000 : 8_000,
      }),
    });
  let steady = true, reasoning = false;
  let res = await send(steady, reasoning);
  let text = await res.text();
  for (let again = 0; again < 2 && !res.ok; again++) {
    if (steady && /temperature/i.test(text)) steady = false;
    else if (!reasoning && /reasoning/i.test(text)) reasoning = true;
    else break;
    res = await send(steady, reasoning);
    text = await res.text();
  }
  if (!res.ok) return { ok: false, error: `fal answered ${res.status}: ${text.replaceAll(key, "[key]").slice(0, 300)}`, usage: none };
  let body: { output?: string; error?: string; usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number } };
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, error: "fal's answer could not be read.", usage: none };
  }
  const input_tokens = body.usage?.prompt_tokens ?? 0, output_tokens = body.usage?.completion_tokens ?? 0;
  // fal's own figure where it gives one; else the list price.
  const usage: Usage = { model: model.id, input_tokens, output_tokens, cost_usd: cents(body.usage?.cost ?? (input_tokens * model.input + output_tokens * model.output) / 1_000_000) };
  if (body.error || !body.output) return { ok: false, error: (body.error ?? "The model gave no answer.").slice(0, 300), usage };
  const out = parseAnswer(body.output);
  return out ? { ok: true, out, usage } : { ok: false, error: "The answer could not be read.", usage };
}

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
      if (model.via === "router") return askRouter(model, READ_SYSTEM, passPromptWithShape(pass, passFields(pass, shows)), picture);
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
        cost_usd: cents((u.input_tokens * model.input + u.output_tokens * model.output) / 1_000_000),
      };
      if (m.stop_reason === "refusal") return { ok: false, error: "The model declined.", usage };
      if (m.stop_reason === "max_tokens" || !m.parsed_output) return { ok: false, error: "The answer could not be read.", usage };
      return { ok: true, out: m.parsed_output as Record<string, Record<string, unknown>>, usage };
    },
    save: async (workspaceId, reading) => {
      const saved = await service.rpc("taste_reading_save", { p_workspace_id: workspaceId, p_reading: reading });
      if (saved.error) return { error: saved.error.message };
      const cards = await service.rpc("taste_cards", { p_workspace_id: workspaceId, p_schema_version: TASTE_SCHEMA_VERSION });
      if (cards.error) return { error: cards.error.message };
      const { brand, engine } = cards.data as { brand: Card[]; engine: Card[] };
      const built = build(brand, engine);
      const profiled = await service.rpc("taste_profile_save", { p_workspace_id: workspaceId, p_built: built });
      if (profiled.error) return { error: profiled.error.message };
      return { score: built.score.score, pictures: brand.length, enginePictures: engine.length };
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
