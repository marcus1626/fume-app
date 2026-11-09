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
import { CREATIVES_SYSTEM, CreativesAnswer, creativesPrompt, withCreatives } from "./creatives.ts";
import { AdWords, ADWORDS_SYSTEM, adWordsPage, adWordsPrompt } from "./adwords.ts";
import { type BookLogo, dnaLogoUrl, LOGO_TYPES, logoFile } from "./logo.ts";
import { type BookFont, faceOf, fontFilesPage, withFontFiles } from "./fontfile.ts";
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

type Image = { type: "image"; source: { type: "base64"; media_type: "image/jpeg"; data: string } };

/** The brand's own pictures first, then its people's "this is us" and "not us", then its site's; at most twelve. */
const shotUrl = Deno.env.get("SHOT_URL") ?? "https://fume-app-git-claude-project-thread-4e84v4-fume-5d92c9b4.vercel.app/api/shot";
const bypass = Deno.env.get("VERCEL_BYPASS_SECRET");
const SHOT_VIEWS = ["desktop", "desktop_second", "mobile"];

/**
 * Screenshots of the brand's own website, stored in its workspace: how the brand sets words on its pictures as a
 * visitor sees it. The pictures on a site carry no words; the page does. Empty when the page cannot be opened.
 */
async function siteShots(task: Parameters<typeof voicePrompt>[0]): Promise<{ shots: LookPicture[]; logo: BookLogo | null }> {
  const none = { shots: [], logo: null };
  if (!task.website) return none;
  const bucket = "workspace-files";
  const paths = SHOT_VIEWS.map((v) => `${task.book.workspace_id}/brand/shots/${task.book.id}-${v}.jpg`);
  // The logo in the site's header is kept beside the screenshots, as the brand's own mark for the design layer.
  const logoPath = `${task.book.workspace_id}/brand/logo/${task.book.id}-site`;
  try {
    const links = await Promise.all([...paths, logoPath].map((p) => service.storage.from(bucket).createSignedUploadUrl(p)));
    if (links.some((l) => l.error || !l.data)) return none;
    const res = await fetch(shotUrl, {
      method: "POST",
      headers: { "content-type": "application/json", ...(bypass ? { "x-vercel-protection-bypass": bypass } : {}) },
      body: JSON.stringify({ url: task.website, upload: links.slice(0, -1).map((l) => l.data!.signedUrl), logo: links.at(-1)!.data!.signedUrl }),
      signal: AbortSignal.timeout(95_000),
    });
    if (!res.ok) return none;
    const out = (await res.json()) as { shots?: { view: string }[]; logo?: { type: string; from: string } | null };
    const taken = new Set((out.shots ?? []).map((s) => s.view));
    const shots = SHOT_VIEWS.flatMap((v, i) =>
      taken.has(v) ? [{ bucket, path: paths[i], kind: "screenshot" as const, note: `The brand's own website, ${v.replace("_", " ")}` }] : []
    );
    const logo = out.logo && LOGO_TYPES.test(out.logo.type)
      ? { bucket, path: logoPath, type: out.logo.type, from: `the header of ${new URL(task.website).hostname}` }
      : null;
    return { shots, logo };
  } catch {
    return none;
  }
}

/** The Brand DNA's logo, kept in the brand's workspace: a picture or a safe SVG, never the site's icon. */
async function dnaLogo(task: Parameters<typeof voicePrompt>[0]): Promise<BookLogo | null> {
  const url = dnaLogoUrl(task.identity);
  if (!url) return null;
  try {
    const res = await openFetch(url, { signal: AbortSignal.timeout(10_000) });
    const type = (res?.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!res?.ok || !LOGO_TYPES.test(type)) return null;
    const raw = new Uint8Array(await res.arrayBuffer());
    if (raw.byteLength > 3_000_000) return null;
    const kept = logoFile(raw, type);
    if (!kept) return null;
    const bucket = "workspace-files";
    const path = `${task.book.workspace_id}/brand/logo/${task.book.id}-dna`;
    const { error } = await service.storage.from(bucket).upload(path, kept.bytes, { contentType: kept.type, upsert: true });
    return error ? null : { bucket, path, type: kept.type, from: "the Brand DNA" };
  } catch {
    return null;
  }
}

/** The logo file the brand's people added (a source of kind logo): the brand's own file is the best one there is. */
async function fileLogo(task: Parameters<typeof voicePrompt>[0]): Promise<BookLogo | null> {
  try {
    const { data: f, error: e1 } = await service.rpc("brand_logo_file", { p_workspace_id: task.book.workspace_id });
    if (e1) console.error("brand-book logo file", e1.message);
    const src = { name: (f as { name?: string } | null)?.name ?? null };
    if (!f || !LOGO_TYPES.test(f.type ?? "")) return null;
    const { data: blob, error: e3 } = await service.storage.from(f.bucket).download(f.path);
    if (e3) console.error("brand-book logo file", e3.message);
    if (!blob || blob.size > 3_000_000) return null;
    const kept = logoFile(new Uint8Array(await blob.arrayBuffer()), f.type);
    if (!kept) return null;
    const bucket = "workspace-files";
    const path = `${task.book.workspace_id}/brand/logo/${task.book.id}-file`;
    const { error } = await service.storage.from(bucket).upload(path, kept.bytes, { contentType: kept.type, upsert: true });
    if (error) console.error("brand-book logo file", error.message);
    return error ? null : { bucket, path, type: kept.type, from: `the brand's own file ${src.name ?? ""}`.trim() };
  } catch (e) {
    console.error("brand-book logo file", e instanceof Error ? e.message : String(e));
    return null;
  }
}

/** The font files the brand's people added (sources of kind font), each read for its own family and weight. */
async function fileFonts(task: Parameters<typeof voicePrompt>[0]): Promise<BookFont[]> {
  try {
    const { data, error } = await service.rpc("brand_font_files", { p_workspace_id: task.book.workspace_id });
    if (error) console.error("brand-book font files", error.message);
    const files = (Array.isArray(data) ? data : []) as { bucket: string; path: string; name: string | null; file: string; bytes: number }[];
    const out: BookFont[] = [];
    for (const [i, f] of files.entries()) {
      if (f.bytes > 8_000_000) continue;
      const { data: blob, error: e2 } = await service.storage.from(f.bucket).download(f.path);
      if (e2) console.error("brand-book font file", e2.message);
      if (!blob || blob.size > 8_000_000) continue;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const face = faceOf(bytes);
      if (!face) continue;
      // A copy beside the book, so the design layer reads only what the book names.
      const bucket = "workspace-files";
      const path = `${task.book.workspace_id}/brand/font/${task.book.id}-${i}`;
      const { error: e3 } = await service.storage.from(bucket).upload(path, bytes, { contentType: "font/ttf", upsert: true });
      if (e3) {
        console.error("brand-book font file", e3.message);
        continue;
      }
      out.push({ ...face, bucket, path, from: f.file || f.name || "a font file" });
    }
    return out;
  } catch (e) {
    console.error("brand-book font files", e instanceof Error ? e.message : String(e));
    return [];
  }
}

async function brandPictures(
  task: Parameters<typeof voicePrompt>[0],
  opts: { shots?: boolean } = {},
): Promise<{ pictures: LookPicture[]; images: Image[]; logo: BookLogo | null }> {
  const [{ data: kept }, site] = await Promise.all([
    service.rpc("brand_look_pictures", { p_workspace_id: task.book.workspace_id }),
    opts.shots ? siteShots(task) : Promise.resolve({ shots: [] as LookPicture[], logo: null }),
  ]);
  const shots = site.shots;
  // The brand's own uploads first, then its website as a visitor sees it, then the pictures on its pages.
  const own = ((kept as LookPicture[] | null) ?? []);
  // For the design system, the pictures the brand's people added as "this is us" (its own ads) come first of all.
  const candidates: LookPicture[] = opts.shots
    ? [...own.filter((p) => p.kind === "liked"), ...shots, ...own.filter((p) => p.kind === "brand"), ...own.filter((p) => p.kind !== "brand" && p.kind !== "liked")]
    : [...own.filter((p) => p.kind === "brand" || p.kind === "liked"), ...shots, ...own.filter((p) => p.kind !== "brand" && p.kind !== "liked")];
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
  const images: Image[] = [];
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
  return { pictures, images, logo: site.logo };
}

/** The Look Book, read from the brand's pictures. */
async function writeLook(task: Parameters<typeof voicePrompt>[0], read: PageText[]): Promise<Written> {
  const none = { model: LOOK_MODEL, input_tokens: 0, output_tokens: 0, cost_usd: 0 };
  const { pictures, images } = await brandPictures(task);
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

/** How the brand sets words on its pictures, read with eyes; null when there are no pictures or the read fails. */
async function readCreatives(task: Parameters<typeof voicePrompt>[0], read: PageText[]) {
  const { pictures, images, logo: siteLogo } = await brandPictures(task, { shots: true });
  const logo = (await fileLogo(task)) ?? siteLogo ?? (await dnaLogo(task));
  if (!pictures.length) return { answer: null, pictures, message: null, logo };
  try {
    const message = await claude.beta.messages.parse({
      model: LOOK_MODEL,
      max_tokens: 12_000,
      system: CREATIVES_SYSTEM,
      messages: [{ role: "user", content: [...images, { type: "text", text: creativesPrompt(task, pictures, read) }] }],
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: betaZodOutputFormat(CreativesAnswer) },
    });
    return { answer: message.stop_reason === "end_turn" ? (message.parsed_output as CreativesAnswer | null) : null, pictures, message, logo };
  } catch {
    return { answer: null, pictures, message: null, logo };
  }
}

/** The words on the brand's own ads, read with eyes; null when it has no pictures or the read fails. */
async function readAdWords(task: Parameters<typeof voicePrompt>[0]) {
  try {
    const { pictures, images } = await brandPictures(task);
    if (!pictures.length) return null;
    const message = await claude.beta.messages.parse({
      model: LOOK_MODEL,
      max_tokens: 8_000,
      system: ADWORDS_SYSTEM,
      messages: [{ role: "user", content: [...images, { type: "text", text: adWordsPrompt(pictures) }] }],
      output_config: { effort: "low", format: betaZodOutputFormat(AdWords) },
    });
    const answer = message.stop_reason === "end_turn" ? (message.parsed_output as AdWords | null) : null;
    return { answer, page: adWordsPage(answer), pictures, usage: message.usage };
  } catch {
    return null;
  }
}

async function write(task: Parameters<typeof voicePrompt>[0], read: PageText[]): Promise<Written> {
  if (task.book.kind === "look") return writeLook(task, read);
  const voice = task.book.kind === "voice";
  // The voice is written from the brand's own ads first, then its pages.
  const ads = voice ? await readAdWords(task) : null;
  // The brand's own font files are named to the design system's writer, so it names their families.
  const fonts = voice ? [] : await fileFonts(task);
  const fontPage = fontFilesPage(fonts);
  const content = voice ? voicePrompt(task, ads?.page ? [ads.page, ...read] : read) : designPrompt(task, fontPage ? [fontPage, ...read] : read);
  const parts = voice ? VOICE_PARTS : DESIGN_PARTS;
  // The design system's tokens come from the pages; how the brand sets words on pictures, from its pictures, at the same time.
  const eyes = voice ? Promise.resolve(null) : readCreatives(task, read);
  const settled = await Promise.allSettled(parts.map((p) => part(voice ? VOICE_SYSTEM : DESIGN_SYSTEM, content, p.name, p.schema)));
  const seen = await eyes;
  const messages = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
  const usage = {
    model: messages[0]?.model ?? MODEL,
    input_tokens: messages.reduce((n, m) => n + m.usage.input_tokens, 0) + (seen?.message?.usage.input_tokens ?? 0) + (ads?.usage.input_tokens ?? 0),
    output_tokens: messages.reduce((n, m) => n + m.usage.output_tokens, 0) + (seen?.message?.usage.output_tokens ?? 0) + (ads?.usage.output_tokens ?? 0),
    cost_usd:
      Math.round((messages.reduce((n, m) => n + costOf(m.usage), 0) + (seen?.message ? lookCostOf(seen.message.usage) : 0) + (ads ? lookCostOf(ads.usage) : 0)) * 10_000) / 10_000,
  };
  const failed = settled.find((s) => s.status === "rejected") as PromiseRejectedResult | undefined;
  if (failed) return { ok: false, error: failed.reason instanceof Error ? failed.reason.message : String(failed.reason), usage };
  if (messages.some((m) => m.stop_reason === "refusal")) return { ok: false, error: "The model declined to write this book.", usage, final: true };
  if (messages.some((m) => m.stop_reason === "max_tokens")) return { ok: false, error: "The book was cut off.", usage };
  if (messages.some((m) => !m.parsed_output)) return { ok: false, error: "The book could not be read.", usage };
  const joined = joinParts<VoiceAnswer & DesignAnswer>(messages.map((m) => m.parsed_output as Record<string, unknown>));
  if (voice) {
    const sources = { sources: joined.sources, ...(ads?.page ? { ads: ads.pictures.map((p) => p.url ?? p.path) } : {}) };
    return { ok: true, body: { ...toVoiceBody(joined, task), adWords: ads?.answer ?? null }, sources, usage };
  }
  const design = toDesignBody(joined, task);
  const onBrand = seen?.answer ? withCreatives(design, seen.answer, seen.pictures) : { ...design, onPictures: null };
  // The logo file the design layer sets on every creative, or none yet.
  const body = withFontFiles({ ...onBrand, logo: seen?.logo ?? null }, fonts);
  if (!seen?.answer) (body as { gaps: string[] }).gaps = [...((body as { gaps?: string[] }).gaps ?? joined.gaps), "Fume could not read how the brand sets words on its pictures; upload a few of the brand's own ads."];
  const sources = { sources: [...joined.sources, ...(seen?.answer?.sources ?? [])], pictures: (seen?.pictures ?? []).map((p) => p.url ?? p.path) };
  return { ok: true, body, sources, usage };
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
