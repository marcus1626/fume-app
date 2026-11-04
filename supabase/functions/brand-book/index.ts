// The edge function `brand-book` (handler.ts says what it does). Deployed with verify_jwt off: the handler reads the
// book with the caller's own token first. Needs the secret ANTHROPIC_API_KEY.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { betaZodOutputFormat } from "npm:@anthropic-ai/sdk@1.3.0/helpers/beta/zod";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { openFetch } from "../_shared/net.ts";
import { morePages } from "../brand-scan/read.ts";
import {
  costOf,
  DESIGN_PARTS,
  DESIGN_SYSTEM,
  type DesignAnswer,
  joinParts,
  designPrompt,
  type PageText,
  pageText,
  toDesignBody,
  toVoiceBody,
  VOICE_PARTS,
  VOICE_SYSTEM,
  type VoiceAnswer,
  voicePrompt,
} from "./book.ts";
import { handleBook, type Written } from "./handler.ts";
import { LOOK_MODEL, LOOK_PARTS, LOOK_SYSTEM, type LookAnswer, type LookPicture, lookCostOf, lookPrompt, pageImages, toLookBody } from "./look.ts";

// The cheap model first (Marcus, 3 Nov); a stronger one only where the books show it is needed.
const MODEL = "claude-haiku-5-5";
const url = Deno.env.get("SUPABASE_URL")!;
const keyOf = (json: string, legacy: string) =>
  (Deno.env.get(json) && JSON.parse(Deno.env.get(json)!).default) || Deno.env.get(legacy)!;
const publishable = keyOf("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
const secret = keyOf("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
const service = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const workspace = Deno.env.get("ANTHROPIC_WORKSPACE_ID");
const claude = new Anthropic({
  timeout: 140_000,
  maxRetries: 1,
  ...(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : {}),
});

async function readPage(target: string): Promise<{ url: string; html: string } | null> {
  try {
    const res = await openFetch(target, { headers: { "User-Agent": "FumeBrandReader/1.0", Accept: "text/html" }, signal: AbortSignal.timeout(12_000) });
    if (!res || !res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return null;
    return { url: res.url || target, html: (await res.text()).slice(0, 1_500_000) };
  } catch {
    return null;
  }
}

async function pages(website: string | null): Promise<PageText[]> {
  if (!website) return [];
  const home = await readPage(website);
  if (!home) return [];
  const more = morePages({ ...home, css: "" }, 4);
  const rest = (await Promise.all(more.map(readPage))).filter((p): p is { url: string; html: string } => Boolean(p));
  return [home, ...rest].map((p) => ({ url: p.url, text: pageText(p.html) })).filter((p) => p.text.length > 40);
}

async function part(system: string, content: string, name: string, schema: Parameters<typeof betaZodOutputFormat>[0]) {
  const message = await claude.beta.messages.parse({
    model: MODEL,
    max_tokens: 24_000,
    system,
    messages: [{ role: "user", content: `${content}\n\nWrite only this part of the book now: ${name}.` }],
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
  });
  return message;
}

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** A picture as the model reads it: fetched here (a brand's CDN may turn the model's own fetch away). */
async function pictureBytes(p: LookPicture): Promise<{ media_type: string; data: string } | null> {
  try {
    let link = p.url ?? null;
    if (p.bucket && p.path) {
      const { data } = await service.storage.from(p.bucket).createSignedUrl(p.path, 600);
      link = data?.signedUrl ?? null;
    }
    if (!link) return null;
    const res = await openFetch(link, { headers: { "User-Agent": "FumeBrandReader/1.0", Accept: "image/*" }, signal: AbortSignal.timeout(15_000) });
    const type = (res?.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!res || !res.ok || !IMAGE_TYPES.has(type)) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength < 8_000 || bytes.byteLength > 4_500_000) return null;
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { media_type: type, data: btoa(bin) };
  } catch {
    return null;
  }
}

/** The Look Book: the brand's own pictures first, then its people's "this is us" and "not us", then its site's. */
async function writeLook(task: Parameters<typeof voicePrompt>[0], read: PageText[]): Promise<Written> {
  const none = { model: LOOK_MODEL, input_tokens: 0, output_tokens: 0, cost_usd: 0 };
  const { data: kept } = await service.rpc("brand_look_pictures", { p_workspace_id: task.book.workspace_id });
  const candidates: LookPicture[] = [...((kept as LookPicture[] | null) ?? [])];
  if (task.website) {
    const home = await readPage(task.website);
    if (home) {
      const more = morePages({ ...home, css: "" }, 3);
      const htmls = [home, ...(await Promise.all(more.map(readPage))).filter((x): x is { url: string; html: string } => Boolean(x))];
      for (const h of htmls) for (const u of pageImages(h.html, h.url, 8)) candidates.push({ url: u, kind: "site" });
    }
  }
  const seen = new Set<string>();
  const pictures: LookPicture[] = [];
  const images: { type: "image"; source: { type: "base64"; media_type: "image/jpeg"; data: string } }[] = [];
  for (const c of candidates) {
    if (images.length >= 12) break;
    const key = c.url ?? `${c.bucket}/${c.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const b = await pictureBytes(c);
    if (!b) continue;
    pictures.push(c);
    images.push({ type: "image", source: { type: "base64", media_type: b.media_type as "image/jpeg", data: b.data } });
  }
  if (pictures.length < 2) return { ok: false, error: "Fume found fewer than two of the brand's pictures to read the look from.", usage: none, final: true };
  const text = lookPrompt(task, pictures, read);
  const settled = await Promise.allSettled(LOOK_PARTS.map((p) =>
    claude.beta.messages.parse({
      model: LOOK_MODEL,
      max_tokens: 16_000,
      system: LOOK_SYSTEM,
      messages: [{ role: "user", content: [...images, { type: "text", text: `${text}\n\nWrite only this part of the book now: ${p.name}.` }] }],
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: betaZodOutputFormat(p.schema) },
    })
  ));
  const messages = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
  const usage = {
    model: LOOK_MODEL,
    input_tokens: messages.reduce((n, m) => n + m.usage.input_tokens, 0),
    output_tokens: messages.reduce((n, m) => n + m.usage.output_tokens, 0),
    cost_usd: Math.round(messages.reduce((n, m) => n + lookCostOf(m.usage), 0) * 10_000) / 10_000,
  };
  const failed = settled.find((s) => s.status === "rejected") as PromiseRejectedResult | undefined;
  if (failed) return { ok: false, error: failed.reason instanceof Error ? failed.reason.message : String(failed.reason), usage };
  if (messages.some((m) => m.stop_reason === "refusal")) return { ok: false, error: "The model declined to write this book.", usage, final: true };
  if (messages.some((m) => m.stop_reason === "max_tokens")) return { ok: false, error: "The book was cut off.", usage };
  if (messages.some((m) => !m.parsed_output)) return { ok: false, error: "The book could not be read.", usage };
  const joined = joinParts<LookAnswer>(messages.map((m) => m.parsed_output as Record<string, unknown>));
  return { ok: true, body: toLookBody(joined, task, pictures), sources: { sources: joined.sources, pictures: pictures.map((p) => p.url ?? p.path) }, usage };
}

async function write(task: Parameters<typeof voicePrompt>[0], read: PageText[]): Promise<Written> {
  if (task.book.kind === "look") return writeLook(task, read);
  const voice = task.book.kind === "voice";
  const content = voice ? voicePrompt(task, read) : designPrompt(task, read);
  const parts = voice ? VOICE_PARTS : DESIGN_PARTS;
  const settled = await Promise.allSettled(parts.map((p) => part(voice ? VOICE_SYSTEM : DESIGN_SYSTEM, content, p.name, p.schema)));
  const messages = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
  const usage = {
    model: messages[0]?.model ?? MODEL,
    input_tokens: messages.reduce((n, m) => n + m.usage.input_tokens, 0),
    output_tokens: messages.reduce((n, m) => n + m.usage.output_tokens, 0),
    cost_usd: Math.round(messages.reduce((n, m) => n + costOf(m.usage), 0) * 10_000) / 10_000,
  };
  const failed = settled.find((s) => s.status === "rejected") as PromiseRejectedResult | undefined;
  if (failed) return { ok: false, error: failed.reason instanceof Error ? failed.reason.message : String(failed.reason), usage };
  if (messages.some((m) => m.stop_reason === "refusal")) return { ok: false, error: "The model declined to write this book.", usage, final: true };
  if (messages.some((m) => m.stop_reason === "max_tokens")) return { ok: false, error: "The book was cut off.", usage };
  if (messages.some((m) => !m.parsed_output)) return { ok: false, error: "The book could not be read.", usage };
  const joined = joinParts<VoiceAnswer & DesignAnswer>(messages.map((m) => m.parsed_output as Record<string, unknown>));
  const body = voice ? toVoiceBody(joined, task) : toDesignBody(joined, task);
  return { ok: true, body, sources: { sources: joined.sources }, usage };
}

const err = (e: { message: string; details?: string } | null) => (e ? { message: e.message, details: e.details } : null);

Deno.serve((req) =>
  handleBook(req, (authorization) => {
    const asCaller = createClient(url, publishable, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return {
      canRead: async (bookId) => {
        const { data } = await asCaller.from("brand_books").select("id").eq("id", bookId).maybeSingle();
        return Boolean(data);
      },
      service: {
        take: async (bookId) => {
          const { data, error } = await service.rpc("brand_book_take", { p_book_id: bookId });
          return { data, error: err(error) };
        },
        finish: async (bookId, body, sources, usage) => {
          const { error } = await service.rpc("brand_book_finish", { p_book_id: bookId, p_body: body, p_sources: sources, p_model: usage.model, p_llm_usd: usage.cost_usd });
          return { error: err(error) };
        },
        fail: async (bookId, error, usage, final) => {
          const { error: e } = await service.rpc("brand_book_fail", { p_book_id: bookId, p_error: error, p_llm_usd: usage.cost_usd, p_final: final });
          return { error: err(e) };
        },
      },
      pages,
      write,
      later: (work) => EdgeRuntime.waitUntil(work),
    };
  }),
);
