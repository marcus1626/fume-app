// Manual production on the live backend (until the Engine runs, Wednesday): the Studio's creative documents read from
// the database, Make formats from the approved master, and a picture a designer made by hand.
//
// Ids: how the contract's objects map to database rows (supabase/migrations/20261027110000_manual_production.sql).
//   CreativeDocument.id = creatives.id, and CreativeDocument.creativeId is the same id. The Studio holds one document
//     per creative; opening one for a planned creative makes the creative first (open_creative), with no version, so
//     nobody outside Fume sees it.
//   RenderVersion.id = candidates.id: every picture made for the creative (by hand this week, the Engine's later), on
//     the creative's jobs, numbered in the order they were made. "Send to check" makes the picked one a creative
//     version (send_to_check).
//   QaItem.id = creative_versions.id (quality.ts): one version in Check; its documentId is its creative's id.
// What the desk changes and the database does not hold yet (mode, variables, specs, layers, the picked picture, the
// placements asked for) is kept in this tab only, until the recipe is stored with the job.
import {
  FumeError,
  type CreativeDocument,
  type Evaluation,
  type Format,
  type FormatTile,
  type FumeApi,
  type Id,
  type Layer,
  type RenderVersion,
  type Specs,
  type StudioKind,
  type Variables,
} from "../../contract";
import { placements } from "../../mock/seed/studio";
import { defaults, modes } from "../../mock/seed/studioModes";
import type { Live } from "./context";
import { CREATIVE, VERSION, fileUrls, uploadFile, type CreativeRow, type VersionRow } from "./map";
import { command, requestKey, rows, supabase } from "./supabase";

// ─── Rows ────────────────────────────────────────────────────────────────────

export interface StudioCreativeRow extends CreativeRow {
  slot: string | null;
}
export const STUDIO_CREATIVE = `${CREATIVE}, slot`;

interface JobRow {
  id: string;
  creative_id: string | null;
  kind: "master" | "variant" | "format" | "correction";
  requested_by: string;
  created_at: string;
}

export interface CandidateRow {
  id: string;
  job_id: string;
  file_id: string;
  origin: "engine" | "manual";
  note: string | null;
  made_by: string | null;
  created_at: string;
}
export const CANDIDATE = "id, job_id, file_id, origin, note, made_by, created_at";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** An id the database can hold; anything else (an old link, a demo id) is simply not there. */
export function mustBeId(id: Id, what: string): Id {
  if (!UUID.test(id)) throw new FumeError("not_found", `No such ${what}.`);
  return id;
}

export const toFormat = (f: CreativeRow["format"]): Format => (f === "banner" ? "feed" : f);

/** No evaluation of a picture is stored yet (by hand this week; the Engine's findings come with the Engine). So nothing
 *  is said to hold or to be off: the expert checks Product Truth, the brand rules and artefacts by eye, and the note
 *  says how the picture was made. */
export function manualEvaluation(c: Pick<CandidateRow, "origin" | "note"> | undefined): Evaluation {
  const how = c?.origin === "engine" ? "Made by the Engine" : "Made by hand";
  return {
    productTruth: "flag",
    brandRules: "flag",
    artefacts: "none",
    evaluated: false,
    notes: [`${how}${c?.note ? `: ${c.note.trim().replace(/[.!?…]+$/, "")}` : ""}.`],
  };
}

// ─── The desk's own state, in this tab ───────────────────────────────────────

interface Desk {
  modeId?: Id;
  studio?: StudioKind;
  variables?: Variables;
  specs?: Partial<Specs>;
  layers?: Layer[];
  title?: string;
  picked?: Id;
  /** The placement asked for, by format (Make formats). */
  placements?: Partial<Record<Format, Id>>;
}
const desks = new WeakMap<Live, Map<Id, Desk>>();
export function deskOf(live: Live, documentId: Id): Desk {
  let all = desks.get(live);
  if (!all) desks.set(live, (all = new Map()));
  let d = all.get(documentId);
  if (!d) all.set(documentId, (d = {}));
  return d;
}

/** The mode a document is in: the one it was opened in, else Free. Only modes that make a creative. */
export function creativeMode(modeId: Id | undefined) {
  const mode = modes.find((m) => m.id === modeId);
  return mode && mode.output === "creative" ? mode : modes.find((m) => m.id === "m-free")!;
}

// ─── Reading documents ───────────────────────────────────────────────────────

/** One document with the rows it was read from, for the calls that act on it. */
export interface DocumentRead {
  doc: CreativeDocument;
  creative: StudioCreativeRow;
  /** The creative's versions, oldest first. */
  versions: VersionRow[];
  candidates: CandidateRow[];
}

/** The Studio's documents: every creative of a workspace, or the ones named; what Fume's people may read. */
export async function readDocuments(
  live: Live,
  filter: { workspaceId?: Id; creativeIds?: Id[] },
): Promise<DocumentRead[]> {
  let q = supabase().from("creatives").select(STUDIO_CREATIVE);
  if (filter.workspaceId) q = q.eq("workspace_id", filter.workspaceId);
  if (filter.creativeIds) q = q.in("id", filter.creativeIds);
  const creatives = await rows<StudioCreativeRow>(q.order("created_at"));
  if (creatives.length === 0) return [];
  const ids = creatives.map((c) => c.id);
  const campaignIds = [...new Set(creatives.map((c) => c.campaign_id))];
  const [versions, jobs, children, products] = await Promise.all([
    rows<VersionRow>(supabase().from("creative_versions").select(VERSION).in("creative_id", ids).order("number")),
    rows<JobRow>(
      supabase()
        .from("production_jobs")
        .select("id, creative_id, kind, requested_by, created_at")
        .in("creative_id", ids),
    ),
    // The formats made from a master, for its Make formats strip.
    rows<StudioCreativeRow>(
      supabase()
        .from("creatives")
        .select(STUDIO_CREATIVE)
        .in("master_id", ids)
        .eq("kind", "format")
        .order("created_at"),
    ),
    rows<{ campaign_id: string; product_id: string }>(
      supabase().from("campaign_products").select("campaign_id, product_id").in("campaign_id", campaignIds),
    ),
  ]);
  const childVersions = children.length
    ? await rows<VersionRow>(
        supabase()
          .from("creative_versions")
          .select(VERSION)
          .in(
            "creative_id",
            children.map((c) => c.id),
          )
          .order("number"),
      )
    : [];
  // The pictures: on the creative's own jobs, and on the jobs its versions came from.
  const jobIds = [...new Set([...jobs.map((j) => j.id), ...versions.flatMap((v) => (v.job_id ? [v.job_id] : []))])];
  const candidates = jobIds.length
    ? await rows<CandidateRow>(supabase().from("candidates").select(CANDIDATE).in("job_id", jobIds).order("created_at"))
    : [];
  const files = await fileUrls([...candidates.map((c) => c.file_id), ...childVersions.map((v) => v.file_id)]);

  return creatives.map((cr) => {
    const desk = deskOf(live, cr.id);
    const mine = versions.filter((v) => v.creative_id === cr.id);
    const myJobs = new Set([
      ...jobs.filter((j) => j.creative_id === cr.id).map((j) => j.id),
      ...mine.flatMap((v) => (v.job_id ? [v.job_id] : [])),
    ]);
    const pictures = candidates.filter((c) => myJobs.has(c.job_id));
    const latest = mine.at(-1);
    const state: CreativeDocument["state"] =
      latest?.state === "in_check"
        ? "in_check"
        : latest && ["checked", "approved", "delivered"].includes(latest.state)
          ? "checked"
          : "draft";
    const sent = new Set(mine.flatMap((v) => (v.candidate_id ? [v.candidate_id] : [])));
    const unsent = pictures.filter((c) => !sent.has(c.id));
    const mode = creativeMode(desk.modeId);
    const variables = desk.variables ?? defaults(mode.id);
    const format = toFormat(cr.format);
    const specs: Specs = {
      count: 1,
      imageModel: "Made by hand",
      referenceIds: [],
      modelIds: [],
      productId: products.find((p) => p.campaign_id === cr.campaign_id)?.product_id,
      ...desk.specs,
      format,
    };
    const list: RenderVersion[] = pictures.map((c, i) => ({
      id: c.id,
      number: i + 1,
      image: files.get(c.file_id)?.url ?? "",
      at: c.created_at,
      by: c.made_by ?? "",
      state: "done",
      variables,
      specs,
      evaluation: manualEvaluation(c),
      instruction: c.origin === "manual" ? `Made by hand${c.note ? `: ${c.note}` : ""}` : (c.note ?? undefined),
      cost: 0,
    }));
    // The picture that goes to check: the one picked, else the newest not sent yet; once sent, the one in Check.
    const picked =
      (desk.picked && unsent.some((c) => c.id === desk.picked) ? desk.picked : undefined) ??
      unsent.at(-1)?.id ??
      (state !== "draft" ? (latest?.candidate_id ?? undefined) : undefined);
    const formats: FormatTile[] = children
      .filter((ch) => ch.master_id === cr.id)
      .map((ch) => {
        const f = toFormat(ch.format);
        const made = childVersions.filter((v) => v.creative_id === ch.id).at(-1);
        const image = made?.file_id ? files.get(made.file_id)?.url : undefined;
        return {
          placementId: desk.placements?.[f] ?? placements.find((p) => p.format === f)?.id ?? f,
          method: "native",
          engineChose: "native",
          why: `Made by hand in its own creative, ${ch.title}, from the approved master.`,
          state: made ? "done" : "waiting",
          ...(image ? { image } : {}),
        };
      });
    const times = [cr.created_at, ...pictures.map((c) => c.created_at), ...mine.map((v) => v.created_at)].sort();
    const by = jobs.find((j) => j.creative_id === cr.id)?.requested_by ?? pictures[0]?.made_by ?? "";
    const doc: CreativeDocument = {
      id: cr.id,
      workspaceId: cr.workspace_id,
      campaignId: cr.campaign_id,
      creativeId: cr.id,
      title: desk.title ?? cr.title,
      slot: cr.title,
      studio: desk.studio ?? mode.studio,
      modeId: mode.id,
      variables,
      specs,
      overrides: [],
      layers: desk.layers ?? [],
      versions: list,
      ...(picked ? { pickedVersionId: picked } : {}),
      edits: [],
      ...(formats.length ? { formats } : {}),
      state,
      by,
      updatedAt: times.at(-1)!,
    };
    return { doc, creative: cr, versions: mine, candidates: pictures };
  });
}

export async function readDocument(live: Live, documentId: Id): Promise<DocumentRead> {
  const found = (await readDocuments(live, { creativeIds: [mustBeId(documentId, "creative document")] }))[0];
  if (!found) throw new FumeError("not_found", "No such creative document.");
  return found;
}

// ─── A picture made by hand ──────────────────────────────────────────────────

/** addVersion: the picture a designer made elsewhere, with how
 *  she made it, becomes the document's newest version, picked to go to check. */
export async function addManualVersion(live: Live, documentId: Id, file: File | Blob, note: string) {
  const { creative } = await readDocument(live, documentId);
  if (!note.trim()) throw new FumeError("invalid", "Say how the picture was made.");
  let size: { width?: number; height?: number } = {};
  try {
    const bitmap = await createImageBitmap(file);
    size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
  } catch {
    /* not a picture the browser reads: the size stays unknown */
  }
  const name = (file as File).name || `${creative.name}.jpg`;
  const fileId = await uploadFile(creative.workspace_id, file, { name, purpose: "candidate", ...size });
  const candidate = await command<CandidateRow>("add_manual_version", {
    p_creative_id: creative.id,
    p_file_id: fileId,
    p_note: note.trim(),
    p_key: requestKey(),
  });
  deskOf(live, creative.id).picked = candidate.id;
  return (await readDocument(live, creative.id)).doc;
}

// ─── Make formats ────────────────────────────────────────────────────────────

type Calls = "makeFormats";

export function productionCalls(live: Live): Pick<FumeApi, Calls> {
  return {
    // Each format is a creative of its own, made from the master's approved version (the database refuses a master the
    // customer has not approved), and made by hand in its own document; the strip shows each one once it is made.
    async makeFormats(documentId, placementIds) {
      const { creative, versions } = await readDocument(live, documentId);
      if (creative.kind !== "master") throw new FumeError("invalid", "Formats are made from a master.");
      const master = versions.at(-1);
      if (!master) throw new FumeError("invalid", "The master has no version yet.");
      const desk = deskOf(live, creative.id);
      const wanted = new Map<Format, Id>();
      for (const id of placementIds) {
        const p = placements.find((x) => x.id === id);
        if (!p) throw new FumeError("not_found", `No placement ${id}.`);
        if (!wanted.has(p.format)) wanted.set(p.format, p.id);
      }
      for (const [format, placementId] of wanted) {
        await command("open_creative", {
          p_campaign_id: creative.campaign_id,
          p_slot: null,
          p_kind: "format",
          p_format: format,
          p_master_version_id: master.id,
          p_title: null,
          p_key: requestKey(),
        });
        desk.placements = { ...desk.placements, [format]: placementId };
      }
      return (await readDocument(live, creative.id)).doc;
    },
  };
}
