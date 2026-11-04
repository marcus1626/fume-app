// The edge function `product-truth` (handler.ts says what it does). Deployed with verify_jwt off: the handler asks
// with the caller's own token first. Needs the secret ANTHROPIC_API_KEY.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { betaZodOutputFormat } from "npm:@anthropic-ai/sdk@1.3.0/helpers/beta/zod";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { openFetch } from "../_shared/net.ts";
import { pageText } from "../brand-book/book.ts";
import { handleTruth, type Read } from "./handler.ts";
import { costOf, type PageText, TRUTH_SYSTEM, TruthAnswer, truthPrompt, type TruthTask } from "./truth.ts";

// The cheap model first (Marcus, 3 Nov).
const MODEL = "claude-haiku-5-5";
const url = Deno.env.get("SUPABASE_URL")!;
const keyOf = (json: string, legacy: string) =>
  (Deno.env.get(json) && JSON.parse(Deno.env.get(json)!).default) || Deno.env.get(legacy)!;
const publishable = keyOf("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
const secret = keyOf("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
const service = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const workspace = Deno.env.get("ANTHROPIC_WORKSPACE_ID");
const claude = new Anthropic({
  timeout: 120_000,
  maxRetries: 1,
  ...(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : {}),
});

async function pages(task: TruthTask): Promise<PageText[]> {
  const out: PageText[] = [];
  for (const p of task.pages.slice(0, 2)) {
    try {
      const res = await openFetch(p.url, { headers: { "User-Agent": "FumeProductReader/1.0", Accept: "text/html" }, signal: AbortSignal.timeout(12_000) });
      if (!res || !res.ok || !(res.headers.get("content-type") ?? "").includes("html")) continue;
      const text = pageText((await res.text()).slice(0, 1_500_000), 9000);
      if (text.length > 40) out.push({ source_id: p.source_id, url: res.url || p.url, text });
    } catch {
      // A page that will not open is left out.
    }
  }
  return out;
}

type Media = "image/jpeg" | "image/png" | "image/webp" | "image/gif";
const MEDIA = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** A picture as bytes, so a picture that will not open leaves out only itself. */
async function picture(p: TruthTask["pictures"][number]): Promise<{ data: string; media: Media } | null> {
  try {
    let address = p.url;
    if (p.bucket && p.path) {
      const { data } = await service.storage.from(p.bucket).createSignedUrl(p.path, 600);
      address = data?.signedUrl;
    }
    if (!address) return null;
    const res = await (p.bucket ? fetch(address, { signal: AbortSignal.timeout(12_000) }) : openFetch(address, { signal: AbortSignal.timeout(12_000) }));
    if (!res || !res.ok) return null;
    const media = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!MEDIA.includes(media)) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > 4_500_000) return null;
    return { data: encodeBase64(bytes), media: media as Media };
  } catch {
    return null;
  }
}

async function withinBudget(): Promise<boolean> {
  const { data, error } = await service.rpc("fume_llm_budget");
  return !error && Boolean((data as { allowed?: boolean } | null)?.allowed);
}

async function read(task: TruthTask, read: PageText[]): Promise<Read> {
  const none = { model: MODEL, input_tokens: 0, output_tokens: 0, cost_usd: 0 };
  if (!(await withinBudget())) return { ok: false, error: "This week's budget for Fume's language model is used up.", usage: none };
  const opened = await Promise.all(task.pictures.slice(0, 4).map(async (p) => ({ p, img: await picture(p) })));
  const pics = opened.filter((x) => x.img);
  const message = await claude.beta.messages.parse({
    model: MODEL,
    max_tokens: 12_000,
    system: TRUTH_SYSTEM,
    messages: [{
      role: "user",
      content: [
        ...pics.map((x) => ({ type: "image" as const, source: { type: "base64" as const, media_type: x.img!.media, data: x.img!.data } })),
        { type: "text" as const, text: truthPrompt(task, read, pics.length) },
      ],
    }],
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: betaZodOutputFormat(TruthAnswer) },
  });
  const usage = { model: message.model, input_tokens: message.usage.input_tokens, output_tokens: message.usage.output_tokens, cost_usd: costOf(message.usage) };
  if (message.stop_reason === "refusal") return { ok: false, error: "The model declined to read this product.", usage };
  if (message.stop_reason === "max_tokens") return { ok: false, error: "The reading was cut off.", usage };
  if (!message.parsed_output) return { ok: false, error: "The reading could not be read.", usage };
  return { ok: true, answer: message.parsed_output, usage, pictureIds: pics.map((x) => x.p.source_id) };
}

const err = (e: { message: string; details?: string } | null) => (e ? { message: e.message, details: e.details } : null);

Deno.serve((req) =>
  handleTruth(req, (authorization) => {
    const asCaller = createClient(url, publishable, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return {
      mayAsk: async (productId) => {
        const { data, error } = await asCaller.rpc("ask_product_truth", { p_product_id: productId });
        return error ? { ok: false } : { ok: true, reading: Boolean((data as { reading?: boolean }).reading) };
      },
      service: {
        take: async (productId) => {
          const { data, error } = await service.rpc("product_truth_take", { p_product_id: productId });
          return { data, error: err(error) };
        },
        finish: async (runId, facts, output, usage) => {
          const { data, error } = await service.rpc("product_truth_finish", { p_run_id: runId, p_facts: facts, p_output: output, p_usage: usage });
          return { data, error: err(error) };
        },
        fail: async (runId, error, usage) => {
          const { error: e } = await service.rpc("product_truth_fail", { p_run_id: runId, p_error: error, p_usage: usage });
          return { error: err(e) };
        },
      },
      pages,
      read,
      later: (work) => EdgeRuntime.waitUntil(work),
    };
  }),
);
