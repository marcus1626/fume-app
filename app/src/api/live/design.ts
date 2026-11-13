// Fume's graphic design on the live backend (FLOWS §33, DECIDED 10 Nov 2026; docs/mvp/design-layer.md): the brand's
// words laid on a picture from its design system by the `design` edge function. A designer asks for it on a version
// (design_candidate); the layer is made in the background and its PNG comes back as a new version of the creative
// (design_finish). design_layers is for Fume's people only, so a customer reads no design and sees only the picture.
import {
  FumeError,
  type CreativeDocument,
  type DesignAsk,
  type DesignBookUsed,
  type DesignCheck,
  type DesignFinding,
  type DesignWords,
  type FumeApi,
  type Id,
  type RenderVersion,
  type VersionDesign,
} from "../../contract";
import type { Live } from "./context";
import { fileUrls } from "./map";
import { command, rows, supabase, WORDS_COLUMN } from "./supabase";
import { designScores } from "./scores";

type Json = Record<string, unknown>;

export interface DesignRow {
  id: string;
  state: "designing" | "made" | "failed";
  candidate_id: string;
  creative_id: string | null;
  ask: string | null;
  book_id: string | null;
  book_version: number | null;
  words: Json | null;
  layout: Json | null;
  checks: Json[] | null;
  findings: Json[] | null;
  choice: Json | null;
  result_candidate_id: string | null;
  document_file_id: string | null;
  error: string | null;
  llm_usd: number | null;
  requested_by: string;
  created_at: string;
}

const DESIGN =
  "id, state, candidate_id, creative_id, ask, book_id, book_version, words, layout, checks, findings, choice, result_candidate_id, document_file_id, error, llm_usd, requested_by, created_at";

/** The layers on these creatives, oldest first, with the state of the book each was made from. Empty for a reader
 *  who is not one of Fume's people (the table is theirs alone). */
export async function readDesigns(
  creativeIds: Id[],
): Promise<{ layers: DesignRow[]; books: Map<Id, DesignBookUsed>; docs: Map<Id, string> }> {
  const empty = { layers: [], books: new Map(), docs: new Map() };
  if (creativeIds.length === 0) return empty;
  const layers = await rows<DesignRow>(
    supabase().from("design_layers").select(DESIGN).in("creative_id", creativeIds).order("created_at"),
  ).catch(() => [] as DesignRow[]);
  if (layers.length === 0) return empty;
  const bookIds = [...new Set(layers.flatMap((l) => (l.book_id ? [l.book_id] : [])))];
  const [bookRows, files] = await Promise.all([
    bookIds.length
      ? rows<{ id: string; version: number; state: string }>(
          supabase().from("brand_books").select("id, version, state").in("id", bookIds),
        ).catch(() => [])
      : Promise.resolve([]),
    fileUrls(layers.map((l) => l.document_file_id)),
  ]);
  const books = new Map<Id, DesignBookUsed>(
    bookRows.map((b) => [
      b.id,
      { version: b.version, state: b.state === "approved" || b.state === "checked" ? b.state : "draft" },
    ]),
  );
  const docs = new Map<Id, string>([...files].map(([id, f]) => [id, f.url]));
  return { layers, books, docs };
}

/** Where the design service put each part, and the logo it placed, as the design function keeps them (10 Nov). */
function placedOf(l: Json): Pick<NonNullable<VersionDesign["layout"]>, "boxes" | "logo"> {
  const out: Pick<NonNullable<VersionDesign["layout"]>, "boxes" | "logo"> = {};
  const share = (x: unknown) => (typeof x === "number" && x >= 0 && x <= 1 ? x : undefined);
  if (l.boxes && typeof l.boxes === "object") {
    const boxes: Record<string, { x: number; y: number; w: number; h: number }> = {};
    for (const [name, b] of Object.entries(l.boxes as Record<string, Json>)) {
      const [x, y, w, h] = [share(b?.x), share(b?.y), share(b?.w), share(b?.h)];
      if (x !== undefined && y !== undefined && w !== undefined && h !== undefined) boxes[name] = { x, y, w, h };
    }
    if (Object.keys(boxes).length) out.boxes = boxes;
  }
  if (l.logo === null) out.logo = null;
  else if (l.logo && typeof l.logo === "object") {
    const where = str((l.logo as Json).where);
    const variant = str((l.logo as Json).variant);
    if (where) out.logo = { where, ...(variant ? { variant } : {}) };
  }
  return out;
}

const CHECKS = new Set<DesignCheck["check"]>(["fits", "lines", "contrast", "busy", "covers", "font"]);
const str = (x: unknown) => (typeof x === "string" ? x : undefined);
const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : undefined);

/** The words the layer set, as the plan wrote them. */
export function wordsOf(w: Json | null | undefined): DesignWords | undefined {
  const headline = str(w?.headline);
  if (!headline) return undefined;
  const subline = str(w?.subline);
  const cta = str(w?.cta);
  return { headline, ...(subline ? { subline } : {}), ...(cta ? { cta } : {}) };
}

/** A layer as the Studio and Check show it. */
export function toVersionDesign(
  r: DesignRow,
  fromNumber: number,
  book: DesignBookUsed | undefined,
  documentUrl: string | undefined,
  title: string,
): VersionDesign {
  const l = r.layout ?? {};
  const band = str(l.band);
  const align = str(l.align);
  const ground = str(l.ground);
  const words = wordsOf(r.words);
  const checks: DesignCheck[] = (r.checks ?? []).flatMap((c) => {
    const check = str(c.check) as DesignCheck["check"] | undefined;
    if (!check || !CHECKS.has(check)) return [];
    const value = num(c.value);
    const need = num(c.need);
    return [
      {
        check,
        node: str(c.node) ?? "Words",
        ok: c.ok === true,
        hard: c.hard === true,
        ...(value !== undefined ? { value } : {}),
        ...(need !== undefined ? { need } : {}),
        note: str(c.note) ?? "",
      },
    ];
  });
  const findings: DesignFinding[] = (r.findings ?? []).flatMap((f) => {
    const what = str(f.what);
    const severity = str(f.severity);
    if (!what || (severity !== "minor" && severity !== "major" && severity !== "critical")) return [];
    return [{ severity, what, by: f.by === "code" ? "code" : "fume_review" }];
  });
  const verdict = str(r.choice?.verdict);
  return {
    id: r.id,
    state: r.state,
    fromVersionId: r.candidate_id,
    fromNumber,
    ...(r.ask ? { ask: r.ask } : {}),
    ...(book ? { book } : {}),
    ...(words ? { words } : {}),
    ...(band === "top" || band === "middle" || band === "bottom"
      ? {
          layout: {
            band,
            align: align === "right" ? "right" : align === "center" || align === "centre" ? "centre" : "left",
            // The brand's own block of colour is a flat ground under the words.
            // The brand's flat tint over the whole picture darkens it as a shade does.
            ground:
              ground === "gradient" || ground === "tint"
                ? "gradient"
                : ground === "flat" || ground === "block"
                  ? "flat"
                  : "photo",
            colour: str(l.colour) ?? "on_photo",
            ...placedOf(l),
          },
        }
      : {}),
    checks,
    findings,
    ...(verdict === "ready_for_check" || verdict === "needs_work" ? { verdict } : {}),
    ...(r.document_file_id
      ? { document: { name: `${title}, graphic design.fig`, ...(documentUrl ? { url: documentUrl } : {}) } }
      : {}),
    ...(r.error ? { error: r.error } : {}),
    requestedBy: r.requested_by,
    at: r.created_at,
    ...(r.llm_usd != null ? { llmUsd: Number(r.llm_usd) } : {}),
  };
}

/**
 * The creative's versions with Fume's design on them: a designed picture carries its layer, and a layer still being
 * made, or one that failed, is a version of its own (as a render is), so the designer sees it come and nothing is lost.
 * The list comes back numbered again in the order things were made.
 */
export function withDesigns(
  list: RenderVersion[],
  read: Awaited<ReturnType<typeof readDesigns>>,
  creativeId: Id,
  title: string,
): RenderVersion[] {
  const mine = read.layers.filter((l) => l.creative_id === creativeId);
  if (mine.length === 0) return list;
  const out = [...list];
  for (const l of mine) {
    const from = out.find((v) => v.id === l.candidate_id);
    if (l.state === "made" && l.result_candidate_id) {
      const v = out.find((x) => x.id === l.result_candidate_id);
      if (v) {
        v.design = toVersionDesign(
          l,
          from?.number ?? 0,
          l.book_id ? read.books.get(l.book_id) : undefined,
          l.document_file_id ? read.docs.get(l.document_file_id) : undefined,
          title,
        );
        // A design is scored as a design, never as a picture (FLOWS §35.3).
        const review = l.choice?.review as { onBrand?: number | null } | undefined;
        const scores = designScores(v.design, review);
        if (scores) v.evaluation = { ...v.evaluation, scores };
      }
      continue;
    }
    // A layer that never came back (the function stopped) is not shown as at work forever.
    const stale = l.state === "designing" && Date.now() - Date.parse(l.created_at) > 15 * 60_000;
    if (l.state === "made" || !from) continue;
    const design = toVersionDesign(
      {
        ...l,
        ...(stale ? { state: "failed" as const, error: "Fume stopped before the design came back. Ask again." } : {}),
      },
      from.number,
      l.book_id ? read.books.get(l.book_id) : undefined,
      undefined,
      title,
    );
    out.push({
      ...from,
      id: `design:${l.id}`,
      number: 0,
      at: l.created_at,
      by: l.requested_by,
      state: design.state === "designing" ? "rendering" : "failed",
      design,
      ...(design.state === "failed" ? { failure: design.error ?? "Fume could not make the design." } : {}),
      instruction: undefined,
      prompt: undefined,
    });
  }
  // Only the newest failed try per picture is kept: older ones were asked again.
  const failed = out.filter((v) => v.state === "failed" && v.design);
  const keep = new Set(
    failed
      .filter((v) => !failed.some((w) => w.design!.fromVersionId === v.design!.fromVersionId && w.at > v.at))
      .map((v) => v.id),
  );
  const shown = out.filter((v) => !(v.state === "failed" && v.design) || keep.has(v.id));
  shown.sort((a, b) => Number(a.state === "rendering") - Number(b.state === "rendering") || a.at.localeCompare(b.at));
  shown.forEach((v, i) => (v.number = i + 1));
  for (const v of shown)
    if (v.design)
      v.design.fromNumber = shown.find((x) => x.id === v.design!.fromVersionId)?.number ?? v.design.fromNumber;
  return shown;
}

/** The plan's words for the design, picked the way the design function picks them (layer.ts wordsOf). */
function planWords(content: { key?: string; label?: string; value?: string }[]): DesignWords | undefined {
  const clean = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
  const pick = (keys: RegExp) => clean(content.find((c) => keys.test(`${c.key ?? ""} ${c.label ?? ""}`))?.value);
  const headline = pick(/headline|overskrift/i);
  if (!headline) return undefined;
  const subline = pick(/support|subline|sub_?head|body|undertekst|st(ø|_)tte/i);
  const asked = pick(/call_?to_?action|\bcta\b|knapp|handlingsoppfordring/i);
  const cta = /^(none|no (button|cta|call to action)|n\/a|ingen)\b/i.test(asked) ? "" : asked;
  return { headline, ...(subline ? { subline } : {}), ...(cta ? { cta } : {}) };
}

/** The design system in use: approved, else checked, else the newest draft with a body (app.brand_book_in_use). */
async function bookInUse(workspaceId: Id): Promise<DesignBookUsed | undefined> {
  const books = await rows<{ version: number; state: string; body: Json | null }>(
    supabase()
      .from("brand_books")
      .select("version, state, body")
      .eq("workspace_id", workspaceId)
      .eq("kind", "design")
      .order("version", { ascending: false }),
  );
  for (const state of ["approved", "checked", "draft"] as const) {
    const b = books.find((x) => x.state === state && x.body && Object.keys(x.body).length > 0);
    if (b) return { version: b.version, state };
  }
  return undefined;
}

/** The words of the approved plan the creative's job was made under; the newest approved plan when there is none. */
async function wordsFor(campaignId: Id | undefined): Promise<DesignWords | undefined> {
  if (!campaignId) return undefined;
  const plans = await rows<{ body: { content?: { key?: string; label?: string; value?: string }[] } | null }>(
    supabase()
      .from("plan_versions")
      .select("body")
      .eq("campaign_id", campaignId)
      .eq("state", "approved")
      .order("version", { ascending: false })
      .limit(1),
  );
  return planWords(plans[0]?.body?.content ?? []);
}

async function placementFor(d: CreativeDocument): Promise<"on_picture" | "own_area"> {
  const plans = await rows<{
    body: {
      chosen_direction_id?: string;
      directions?: { id: string; creatives?: { id: string; words?: string }[] }[];
      planned_creatives?: { id: string; words?: string }[];
    };
  }>(
    supabase()
      .from("plan_versions")
      .select("body")
      .eq("campaign_id", d.campaignId!)
      .eq("state", "approved")
      .order("version", { ascending: false })
      .limit(1),
  );
  const body = plans[0]?.body;
  const creatives =
    body?.directions?.find((x) => x.id === body.chosen_direction_id)?.creatives ?? body?.planned_creatives;
  // The Studio document's label is its title; read the stable slot from the creative.
  const { data, error } = await supabase().from("creatives").select("slot").eq("id", d.id).single();
  if (error) throw error;
  return creatives?.find((x) => x.id === data.slot)?.words === "own_area" ? "own_area" : "on_picture";
}

type Calls = "designAsk" | "designVersion";

export function designCalls(live: Live, read: (documentId: Id) => Promise<CreativeDocument>): Pick<FumeApi, Calls> {
  async function askOf(d: CreativeDocument, versionId: Id): Promise<DesignAsk> {
    const asked = d.versions.find((v) => v.id === versionId);
    if (!asked) throw new FumeError("not_found", "No such version.");
    // On a designed version, Fume designs again from the picture under it.
    const from = (asked.design && d.versions.find((v) => v.id === asked.design!.fromVersionId)) || asked;
    const [book, words] = await Promise.all([bookInUse(d.workspaceId), wordsFor(d.campaignId)]);
    const designing = d.versions.find((v) => v.state === "rendering" && v.design?.fromVersionId === from.id);
    const blocked =
      from.state !== "done" || !from.image || from.design || from.id.includes(":")
        ? "Graphic design goes on a picture."
        : !book
          ? "The brand has no design system yet. Ask Fume to write one first."
          : !words
            ? "The approved plan has no headline to set on this creative."
            : undefined;
    return {
      wordsPlacement: d.words ?? (await placementFor(d)),
      fromVersionId: from.id,
      fromNumber: from.number,
      ...(words ? { words } : {}),
      ...(book ? { book } : {}),
      ...(blocked ? { blocked } : {}),
      ...(designing ? { designingVersionId: designing.id } : {}),
    };
  }
  return {
    async designAsk(documentId, versionId) {
      if (!(await live.me()).staffRole)
        throw new FumeError("forbidden", "Only a designer asks Fume for the graphic design.");
      return askOf(await read(documentId), versionId);
    },
    // design_candidate keeps the layer (and refuses what cannot be designed); the edge function makes it in the
    // background and answers at once. The document comes back with the version Fume is designing.
    async designVersion(documentId, versionId, ask, words) {
      const d = await read(documentId);
      const a = await askOf(d, versionId);
      if (a.designingVersionId) return d;
      if (a.blocked) throw new FumeError("invalid", a.blocked);
      const layer = await command<{ id: string }>("design_candidate", {
        p_candidate_id: a.fromVersionId,
        ...(WORDS_COLUMN ? { p_words: words ?? null } : {}),
        p_ask: ask?.trim() ? ask.trim().slice(0, 1000) : null,
      });
      const { error } = await supabase().functions.invoke("design", { body: { layerId: layer.id } });
      if (error) throw new FumeError("unavailable", "Fume could not start the design. Try again.");
      return read(documentId);
    },
  };
}
