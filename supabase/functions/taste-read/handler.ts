// The edge function `taste-read`: a vision model reads one picture against the taste schema's read fields
// (_shared/taste/schema.ts, read.ts) and the answers go back as the read half of the picture's card. Fume's own people
// only, for a brand they work on. `idea` is asked first because it says what the picture shows; the passes that apply
// are then asked side by side. Every question is counted against the week's budget for the language model, and what
// it cost is kept. handler.test.ts runs it without Supabase or the model.
//
// With `keep` the reading is kept as the picture's card (the brand's own picture or one the Engine made for it) and the
// brand's profile, score and direction are counted again. With `card` and no picture a reading made before is kept
// as it is, and no model is asked.
//
// With `references` no picture is sent: the brand's product pictures that have no reference card yet are fetched and
// read one by one (what each is of, from where, how close: _shared/engine/references.ts), and the cards are kept, so
// the Engine can send the pictures a planned picture needs.
import type { RefCard } from "../_shared/engine/references.ts";
import { cleanMeasured, cleanRead, cleanShows } from "../_shared/taste/build.ts";
import { answersOf, laterPasses, passFields, showsOf } from "../_shared/taste/read.ts";
import { type Answer, type Pass, PASSES, type Shows, TASTE_SCHEMA_VERSION } from "../_shared/taste/schema.ts";

export interface Usage {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}
export type Picture = { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" } | { url: string };
export type Asked = { ok: true; out: Record<string, Record<string, unknown>>; usage: Usage } | { ok: false; error: string; usage: Usage };
/** The readers the bake-off compares (docs/mvp/taste-schema.md, index.ts says which model each is); the cheap one unless
 *  asked. The first three are asked of Anthropic directly; the next through fal's router, so no reader is a lock-in;
 *  `jev` is TypeSafe's decision model (_shared/taste/jev.ts), which picks from the lists and writes no free words. */
export const READERS = ["haiku", "sonnet", "opus", "gemini-flash", "gemini", "gpt-luna", "gpt-terra", "gpt-sol", "grok", "haiku-r", "sonnet-r", "opus-r", "jev"] as const;
export type Reader = (typeof READERS)[number];
export const EFFORTS = ["low", "medium", "high"] as const;
export type Effort = (typeof EFFORTS)[number];

/** One picture's card as it is kept (public.taste_reading_save). */
export type Reading = {
  source: "brand" | "engine";
  ref: string;
  title?: string;
  campaign?: string;
  signal_id?: string;
  file_id?: string;
  schema_version: number;
  reader?: string;
  shows?: Shows | null;
  measured?: Record<string, number>;
  read?: Record<string, Answer>;
  failed?: { pass: string; error: string }[];
  cost_usd?: number;
};
export type Kept = { score: number; pictures: number; enginePictures: number } | { error: string };

/** A product picture waiting for its reference card: in Fume's storage, or kept only as a link. */
export type RefPicture = { source_id: string; product: string; slot: string | null; bucket?: string; path?: string; url?: string };
/** `by` when another reader than the one asked for read it (Jev takes no WebP). */
export type RefAsked = { ok: true; card: RefCard | null; usage: Usage; by?: Reader } | { ok: false; error: string; usage: Usage };
/** A picture nobody could fetch or read is marked so, and is not asked again each time. */
export type RefKept = RefCard | { unread: string };
/** How many reference pictures one call reads, and how many at a time. */
export const REFERENCES = { most: 40, usual: 20, together: 4 };

export interface Deps {
  /** As the caller: true when they are one of Fume's own people on this brand. */
  staff(workspaceId: string): Promise<boolean>;
  withinBudget(): Promise<boolean>;
  ask(pass: Pass, shows: Shows | undefined, picture: Picture, reader: Reader, effort: Effort): Promise<Asked>;
  keep(run: { workspaceId: string; input: unknown; output: unknown; error: string | null; usage: Usage }): Promise<void>;
  /** Keeps the reading as the picture's card and counts the brand's profile again. */
  save(workspaceId: string, reading: Reading): Promise<Kept>;
  /** The brand's product pictures with no reference card yet, and how many there are in all. */
  referencePictures(workspaceId: string, most: number): Promise<{ pictures: RefPicture[]; waiting: number } | { error: string }>;
  /** The picture's bytes, or null when it cannot be fetched or is not a picture a reader takes. */
  fetchPicture(p: RefPicture): Promise<Picture | null>;
  askReference(picture: Picture, reader: Reader): Promise<RefAsked>;
  /** Keeps the card on the picture; an error's words, or null when kept. */
  saveReferenceCard(workspaceId: string, sourceId: string, card: RefKept, reader: Reader): Promise<string | null>;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const NONE: Usage = { model: "", input_tokens: 0, output_tokens: 0, cost_usd: 0 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** About 6 MB of picture: over that the model would not take it. */
const MOST_BASE64 = 8_000_000;

function pictureOf(p: unknown): Picture | null {
  if (typeof p !== "object" || p === null) return null;
  const { base64, mediaType, url } = p as { base64?: unknown; mediaType?: unknown; url?: unknown };
  if (typeof url === "string" && /^https:\/\/[^\s]+$/.test(url) && url.length < 2000) return { url };
  if (typeof base64 === "string" && base64.length > 100 && base64.length <= MOST_BASE64 && /^[A-Za-z0-9+/=]+$/.test(base64.slice(0, 400)) &&
    (mediaType === "image/jpeg" || mediaType === "image/png" || mediaType === "image/webp")) return { base64, mediaType };
  return null;
}
/** Fetched bytes as a picture a reader takes: a JPEG, a PNG or a WebP of at most about 6 MB; else null. */
export function pictureOfBytes(b: Uint8Array): Extract<Picture, { base64: string }> | null {
  const mediaType: "image/jpeg" | "image/png" | "image/webp" | null = b[0] === 0xff && b[1] === 0xd8 ? "image/jpeg"
    : b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 ? "image/png"
    : b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 ? "image/webp"
    : null;
  if (!mediaType || b.length < 100 || b.length > (MOST_BASE64 / 4) * 3) return null;
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return { base64: btoa(s), mediaType };
}
/** Whose picture it is and what to call it, so reading it again replaces its card. */
function keepOf(k: unknown): Omit<Reading, "schema_version"> | null {
  if (typeof k !== "object" || k === null) return null;
  const { source, ref, title, campaign, signalId, fileId, measured } = k as Record<string, unknown>;
  if ((source !== "brand" && source !== "engine") || typeof ref !== "string" || !ref.trim() || ref.length > 200) return null;
  const text = (v: unknown, most: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, most) : undefined);
  const id = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : undefined);
  const m = cleanMeasured(measured);
  return {
    source, ref: ref.trim(),
    ...(text(title, 200) ? { title: text(title, 200) } : {}), ...(text(campaign, 120) ? { campaign: text(campaign, 120) } : {}),
    ...(id(signalId) ? { signal_id: id(signalId) } : {}), ...(id(fileId) ? { file_id: id(fileId) } : {}),
    ...(Object.keys(m).length ? { measured: m } : {}),
  };
}
const add = (a: Usage, b: Usage): Usage => ({
  model: b.model || a.model,
  input_tokens: a.input_tokens + b.input_tokens,
  output_tokens: a.output_tokens + b.output_tokens,
  cost_usd: Math.round((a.cost_usd + b.cost_usd) * 10_000) / 10_000,
});
async function tried(f: () => Promise<Asked>): Promise<Asked> {
  try {
    return await f();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), usage: NONE };
  }
}

export async function handleTasteRead(req: Request, signedIn: boolean, deps: Deps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply(400, { code: "invalid", message: "Use POST." });
  if (!signedIn) return reply(403, { code: "forbidden", message: "Sign in first." });
  let body: { workspaceId?: unknown; picture?: unknown; reader?: unknown; effort?: unknown; passes?: unknown; keep?: unknown; card?: unknown; references?: unknown };
  try {
    body = (await req.json()) ?? {};
  } catch {
    return reply(400, { code: "invalid", message: "The request could not be read." });
  }
  const workspaceId = typeof body.workspaceId === "string" && UUID.test(body.workspaceId) ? body.workspaceId : null;
  const picture = pictureOf(body.picture);
  // Classification is Jev's (Marcus, 10 Nov 2026); a full reading keeps the cheap reader unless another is asked for.
  const reader = READERS.find((r) => r === (body.reader ?? (body.references !== undefined ? "jev" : "haiku")));
  const effort = EFFORTS.find((e) => e === (body.effort ?? "low"));
  const only = Array.isArray(body.passes) ? PASSES.filter((p) => (body.passes as unknown[]).includes(p)) : null;
  const keep = body.keep === undefined ? undefined : keepOf(body.keep);
  if (keep === null) return reply(400, { code: "invalid", message: "To keep a reading, say whose picture it is (brand or engine) and give it a name." });

  // The brand's product pictures without a reference card: fetched, read and kept, a few at a time.
  if (body.references !== undefined) {
    if (!workspaceId || !reader) return reply(400, { code: "invalid", message: "Send a brand and a reader Fume knows." });
    const asked = typeof body.references === "object" && body.references !== null ? (body.references as { most?: unknown }).most : undefined;
    const most = typeof asked === "number" && asked >= 1 ? Math.min(Math.floor(asked), REFERENCES.most) : REFERENCES.usual;
    if (!(await deps.staff(workspaceId))) return reply(403, { code: "forbidden", message: "Only Fume's own people on this brand can read its pictures." });
    if (!(await deps.withinBudget())) return reply(429, { code: "budget", message: "This week's budget for Fume's language model is used up." });
    const waiting = await deps.referencePictures(workspaceId, most);
    if ("error" in waiting) return reply(502, { code: "unavailable", message: "Fume could not list the brand's pictures just now.", detail: waiting.error });
    let usage: Usage = NONE;
    const cards: { source_id: string; product: string; slot: string | null; card?: RefKept; error?: string }[] = [];
    const one = async (p: RefPicture) => {
      const row = { source_id: p.source_id, product: p.product, slot: p.slot };
      const picture = await deps.fetchPicture(p).catch(() => null);
      // A picture that cannot be fetched is marked, so it is not fetched again every time; a reader that failed is
      // not, so the picture is asked again.
      if (!picture) {
        const card: RefKept = { unread: "The picture could not be fetched, or is not a JPEG, PNG or WebP." };
        const error = await deps.saveReferenceCard(workspaceId, p.source_id, card, reader);
        return error ? { ...row, error } : { ...row, card };
      }
      let a: RefAsked;
      try {
        a = await deps.askReference(picture, reader);
      } catch (e) {
        a = { ok: false, error: e instanceof Error ? e.message : String(e), usage: NONE };
      }
      usage = add(usage, a.usage);
      if (!a.ok) return { ...row, error: a.error };
      // A reader that could not say what it is of: something else than the product or a person.
      const card: RefCard = a.card ?? { of: "other", view: null, crop: null };
      const error = await deps.saveReferenceCard(workspaceId, p.source_id, card, a.by ?? reader);
      return error ? { ...row, error } : { ...row, card };
    };
    for (let i = 0; i < waiting.pictures.length; i += REFERENCES.together) cards.push(...await Promise.all(waiting.pictures.slice(i, i + REFERENCES.together).map(one)));
    const read = cards.filter((c) => c.card && !("unread" in c.card)).length, failed = cards.filter((c) => c.error).length;
    if (waiting.pictures.length)
      await deps.keep({
        workspaceId,
        input: { task: "reference_cards", reader, pictures: waiting.pictures.length },
        output: { read, unread: cards.length - read - failed, failed },
        error: cards.length > 0 && failed === cards.length ? cards[0]!.error ?? null : null,
        usage,
      });
    return reply(200, { reader, read, unread: cards.length - read - failed, failed, left: Math.max(0, waiting.waiting - (cards.length - failed)), cards, usage });
  }

  // A reading made before, kept as it is: no picture, no model, no cost.
  if (workspaceId && keep && !body.picture && typeof body.card === "object" && body.card !== null) {
    const card = body.card as { read?: unknown; shows?: unknown; reader?: unknown; failed?: unknown; cost_usd?: unknown };
    const stored = cleanRead(card.read);
    if (!Object.keys(stored).length && !keep.measured) return reply(400, { code: "invalid", message: "The card has nothing the schema lists." });
    if (!(await deps.staff(workspaceId))) return reply(403, { code: "forbidden", message: "Only Fume's own people on this brand can read its pictures." });
    const kept = await deps.save(workspaceId, {
      ...keep, schema_version: TASTE_SCHEMA_VERSION, read: stored, shows: cleanShows(card.shows),
      ...(typeof card.reader === "string" && card.reader.length <= 40 ? { reader: card.reader } : {}),
      ...(typeof card.cost_usd === "number" && card.cost_usd >= 0 ? { cost_usd: card.cost_usd } : {}),
    });
    if ("error" in kept) return reply(502, { code: "unavailable", message: "Fume could not keep the reading just now.", detail: kept.error });
    return reply(200, { schema: TASTE_SCHEMA_VERSION, kept: true, fields: Object.keys(stored).length, ...kept });
  }

  if (!workspaceId || !picture || !reader || !effort || (only && !only.length))
    return reply(400, { code: "invalid", message: "Send a brand, a picture (a JPEG, PNG or WebP, or an https address), and a reader Fume knows." });
  if (!(await deps.staff(workspaceId))) return reply(403, { code: "forbidden", message: "Only Fume's own people on this brand can read its pictures." });
  if (!(await deps.withinBudget())) return reply(429, { code: "budget", message: "This week's budget for Fume's language model is used up." });

  const read: Record<string, Answer> = {};
  const failed: { pass: Pass; error: string }[] = [];
  let usage: Usage = NONE;
  const take = (pass: Pass, shows: Shows | undefined, a: Asked) => {
    usage = add(usage, a.usage);
    if (a.ok) Object.assign(read, answersOf(passFields(pass, shows), a.out));
    else failed.push({ pass, error: a.error });
  };

  // `idea` first: what the picture shows decides what else can be asked of it.
  const idea = await tried(() => deps.ask("idea", undefined, picture, reader, effort));
  take("idea", undefined, idea);
  let shows: Shows | null = null;
  if (idea.ok) {
    shows = showsOf(idea.out);
    const s = shows;
    const later = laterPasses(s).filter((p) => !only || only.includes(p));
    // The budget is asked once more before the larger half, so a full week stops here and not five questions later.
    if (later.length && !(await deps.withinBudget())) for (const pass of later) failed.push({ pass, error: "This week's budget is used up." });
    else (await Promise.all(later.map((pass) => tried(() => deps.ask(pass, s, picture, reader, effort))))).forEach((a, i) => take(later[i]!, s, a));
  }

  const answered = Object.values(read).filter((v) => v !== null).length;
  await deps.keep({
    workspaceId,
    input: { task: "taste_read", schema: TASTE_SCHEMA_VERSION, reader, effort, picture: "url" in picture ? picture.url : `${picture.mediaType}, ${picture.base64.length} characters` },
    output: { fields: Object.keys(read).length, answered, failed },
    error: idea.ok ? null : idea.error,
    usage,
  });
  if (!idea.ok) return reply(502, { code: "unavailable", message: "Fume could not read the picture just now.", detail: idea.error, usage });
  // Kept only when every pass was asked for: a card with half its questions would count as a picture that shows
  // less. A pass that failed is named on the card, to be asked again.
  let kept: Kept | null = null;
  if (keep && !only) kept = await deps.save(workspaceId, { ...keep, schema_version: TASTE_SCHEMA_VERSION, reader, shows, read, failed, cost_usd: usage.cost_usd });
  return reply(200, {
    schema: TASTE_SCHEMA_VERSION, reader, effort, shows, read, fields: Object.keys(read).length, answered, failed, usage,
    ...(kept ? ("error" in kept ? { kept: false, keepError: kept.error } : { kept: true, ...kept }) : {}),
  });
}
