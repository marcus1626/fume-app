// The edge function `engine` (handler.ts says what it does). Deployed with verify_jwt off: the handler reads the job
// with the caller's own token first. Secrets: ANTHROPIC_API_KEY (and ANTHROPIC_WORKSPACE_ID) for the prompt and its
// checks; HF_CREDENTIALS (Higgsfield's "key id:key secret", or a single API key) for the pictures, and HF_ENDPOINTS to
// change an endpoint.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { againNote, handleEngine } from "./handler.ts";
import { claudeModels } from "./models.ts";
import { fal } from "./fal.ts";
import { byModel, higgsfield } from "./provider.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const keyOf = (json: string, legacy: string) =>
  (Deno.env.get(json) && JSON.parse(Deno.env.get(json)!).default) || Deno.env.get(legacy)!;
const publishable = keyOf("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
const secret = keyOf("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
const service = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const workspace = Deno.env.get("ANTHROPIC_WORKSPACE_ID");
const claude = new Anthropic({
  // A compose of up to 12,000 tokens takes about a minute (models.ts).
  timeout: 90_000,
  // Several renders at once can meet the organisation's limit on requests in flight (429): wait and try again.
  maxRetries: 3,
  ...(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : {}),
});
const json = (name: string) => {
  try {
    return JSON.parse(Deno.env.get(name) ?? "{}");
  } catch {
    return {};
  }
};
const credentials = Deno.env.get("HF_CREDENTIALS");
const falKey = Deno.env.get("FAL_KEY");
// fal first for the image models Higgsfield's API lacks; ENGINE_ROUTE ({"qwen-image-3": "higgsfield"}) moves a model.
const provider = byModel(
  [
    ...(falKey ? [fal(falKey, { endpoints: json("FAL_ENDPOINTS") })] : []),
    ...(credentials ? [higgsfield(credentials, { endpoints: json("HF_ENDPOINTS") })] : []),
  ],
  json("ENGINE_ROUTE"),
);

async function allowed(): Promise<boolean> {
  const { data, error } = await service.rpc("fume_llm_budget");
  return !error && Boolean((data as { allowed?: boolean } | null)?.allowed);
}
const models = claudeModels(claude, allowed);
const err = (e: { message: string } | null) => (e ? { message: e.message } : null);

Deno.serve((req) =>
  handleEngine(req, (authorization) => {
    const asCaller = createClient(url, publishable, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return {
      canRead: async (jobId) => {
        if (authorization === `Bearer ${secret}`) return true; // the Engine itself, making a picture once more
        const { data } = await asCaller.from("production_jobs").select("id").eq("id", jobId).maybeSingle();
        return Boolean(data);
      },
      service: {
        take: async (jobId) => {
          const { data, error } = await service.rpc("engine_take", { p_job_id: jobId });
          // The brand's Look Book: how its photographs are made (20261105040000_look_book.sql).
          if (data?.run) {
            const { data: look } = await service.rpc("engine_look", { p_job_id: jobId });
            if (look) data.look = look;
            // How the brand sets words on its pictures, so a picture that carries words leaves room for them.
            const { data: room } = await service.rpc("engine_words_room", { p_job_id: jobId });
            if (room) data.room = room;
            // What the brand's pictures keep to, read against the taste schema; none until the brand has a profile.
            const { data: taste } = await service.rpc("engine_taste", { p_job_id: jobId });
            if (taste && typeof taste === "object") data.tasteDirection = taste;
            // What each product picture shows (from where, how close, with or without a person), by its address; none
            // until the pictures have been looked at.
            const { data: cards } = await service.rpc("engine_reference_cards", { p_job_id: jobId });
            if (cards && typeof cards === "object")
              for (const p of data.products ?? [])
                for (const pic of p.pictures ?? []) {
                  const card = (cards as Record<string, unknown>)[pic.path ?? pic.url ?? ""];
                  if (card) pic.card = card;
                }
            // What the picture check found on the brand's last pictures, so this one avoids it.
            const { data: seen } = await service.rpc("engine_recent_checks", { p_job_id: jobId });
            if (Array.isArray(seen) && seen.length) data.seen = seen;
            // What the next picture must fix: a crop still needs fixing when the words move to their own area.
            const { data: again } = await service.rpc("engine_again_note", { p_job_id: jobId });
            data.again = againNote(again, data.creative.words);
          }
          return { data, error: err(error) };
        },
        prompted: async (attemptId, prompt) =>
          ({ error: err((await service.rpc("engine_prompted", { p_attempt_id: attemptId, p_prompt: prompt })).error) }),
        submitted: async (attemptId, name, providerJobId, request) =>
          ({ error: err((await service.rpc("engine_submitted", { p_attempt_id: attemptId, p_provider: name, p_provider_job_id: providerJobId, p_request: request })).error) }),
        finish: async (attemptId, files, response, costCents) =>
          ({ error: err((await service.rpc("engine_finish", { p_attempt_id: attemptId, p_files: files, p_response: response, p_cost_cents: costCents })).error) }),
        fail: async (attemptId, error, response, costCents, final) =>
          ({ error: err((await service.rpc("engine_fail", { p_attempt_id: attemptId, p_error: error, p_response: response, p_cost_cents: costCents, p_final: final })).error) }),
        sign: async (file) => {
          const { data, error } = await service.storage.from(file.bucket ?? "workspace-files").createSignedUrl(file.path, 3600);
          if (error || !data) throw new Error(`A picture could not be read: ${error?.message ?? file.path}`);
          return data.signedUrl;
        },
        pending: async (workspaceId) => {
          const { data, error } = await service.rpc("engine_pending", { p_workspace_id: workspaceId, p_limit: 3 });
          return { data, error: err(error) };
        },
        digested: async (answerId, updatedAt, lessons, llmUsd) => {
          const { data, error } = await service.rpc("engine_digested", { p_answer_id: answerId, p_updated_at: updatedAt, p_lessons: lessons, p_llm_usd: llmUsd });
          return { data, error: err(error) };
        },
        toEvaluate: async (attemptId) => {
          const { data, error } = await service.rpc("engine_to_evaluate", { p_attempt_id: attemptId });
          return { data, error: err(error) };
        },
        unevaluated: async (jobId) => {
          const { data, error } = await service.rpc("engine_unevaluated", { p_job_id: jobId });
          if (error) console.error(`engine: unevaluated pictures not listed: ${error.message}`);
          return (data as string[] | null) ?? [];
        },
        evaluated: async (candidateId, evaluation, llmUsd) =>
          ({ error: err((await service.rpc("engine_evaluated", { p_candidate_id: candidateId, p_evaluation: evaluation, p_llm_usd: llmUsd })).error) }),
        askDetails: async (candidateId) => {
          await fetch(`${url}/functions/v1/details`, {
            method: "POST",
            headers: { Authorization: `Bearer ${secret}`, apikey: secret, "content-type": "application/json" },
            body: JSON.stringify({ candidateId }),
            signal: AbortSignal.timeout(20_000),
          });
        },
        again: async (attemptId, why) => {
          const { data, error } = await service.rpc("engine_again", { p_attempt_id: attemptId, p_reason: why });
          if (error) console.error(`engine: not made again: ${error.message}`);
          return data === true;
        },
        runAgain: async (jobId) => {
          await fetch(`${url}/functions/v1/engine`, {
            method: "POST",
            headers: { Authorization: `Bearer ${secret}`, apikey: secret, "content-type": "application/json" },
            body: JSON.stringify({ jobId }),
            signal: AbortSignal.timeout(20_000),
          });
        },
        store: async (path, bytes, contentType) =>
          ({ error: err((await service.storage.from("workspace-files").upload(path, bytes, { contentType, upsert: false })).error) }),
      },
      models,
      provider,
      download: async (u) => {
        const res = await fetch(u);
        if (!res.ok) throw new Error(`The picture could not be fetched (${res.status}).`);
        return { bytes: new Uint8Array(await res.arrayBuffer()), contentType: (res.headers.get("content-type") ?? "image/png").split(";")[0] };
      },
      later: (work) => EdgeRuntime.waitUntil(work),
      wait: (ms) => new Promise((r) => setTimeout(r, ms)),
    };
  }),
);
