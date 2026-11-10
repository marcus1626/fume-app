// Production on the live backend: the Studio's creative documents read from
// the database, Make formats from the approved master, and a picture a designer made by hand.
//
// Ids: how the contract's objects map to database rows (supabase/migrations/20261027110000_manual_production.sql).
//   CreativeDocument.id = creatives.id, and CreativeDocument.creativeId is the same id. The Studio holds one document
//     per creative; opening one for a planned creative makes the creative first (open_creative), with no version, so
//     nobody outside Fume sees it.
//   RenderVersion.id = candidates.id: every picture made for the creative (by the Engine or by hand), on
//     the creative's jobs, numbered in the order they were made. "Send to check" makes the picked one a creative
//     version (send_to_check).
//   QaItem.id = creative_versions.id (quality.ts): one version in Check; its documentId is its creative's id.
// What the desk changes and the database does not hold yet (mode, variables, specs, layers, the picked picture, the
// placements asked for) is kept in this tab only, until the recipe is stored with the job.
import {
  FumeError,
  type CreativeDocument,
  type EngineEdit,
  type Evaluation,
  type Format,
  type FormatTile,
  type FumeApi,
  type Id,
  type Layer,
  type ProductFix,
  type RenderVersion,
  type Specs,
  type StudioKind,
  type Variables,
} from "../../contract";
import { placements } from "../../mock/seed/studio";
import { defaults, modes } from "../../mock/seed/studioModes";
import type { Live } from "./context";
import { CREATIVE, VERSION, fileUrls, uploadFile, type CreativeRow, type VersionRow } from "./map";
import { failureOf, modelName, readPrompts, toEnginePrompt } from "./engine";
import { askEngine, command, requestKey, rows, supabase } from "./supabase";

// ─── Rows ────────────────────────────────────────────────────────────────────

export interface StudioCreativeRow extends CreativeRow {
  slot: string | null;
}
export const STUDIO_CREATIVE = `${CREATIVE}, slot`;

interface JobRow {
  id: string;
  creative_id: string | null;
  kind: "master" | "variant" | "format" | "correction";
  mode: "engine" | "manual";
  state: "queued" | "running" | "succeeded" | "failed" | "cancelled" | "unknown";
  error: string | null;
  requested_by: string;
  created_at: string;
  updated_at: string;
}
const JOB = "id, creative_id, kind, mode, state, error, requested_by, created_at, updated_at";
/** An Engine job still at work: the Studio shows it as the version being rendered. */
export const engineAtWork = (j: Pick<JobRow, "mode" | "state">) =>
  j.mode === "engine" && ["queued", "running", "unknown"].includes(j.state);

export interface CandidateRow {
  id: string;
  job_id: string;
  file_id: string;
  origin: "engine" | "manual";
  note: string | null;
  made_by: string | null;
  attempt_id: string | null;
  created_at: string;
  /** What the Engine saw when it looked at its own picture (20261104170000_engine_evaluation.sql); null until then. */
  evaluation?: StoredEvaluation | null;
  /** The product's small print as the picture check read it (docs/mvp/detail-read.md); null until read. */
  details?: StoredDetail[] | null;
}
/** One place with print, or (kind "part") one part of the product, as `details_finish` keeps it. */
export interface StoredDetail {
  n: number;
  /** print: letters read against the real ones; part: a part compared with the real one (docs/mvp/product-parts.md). */
  kind?: "print" | "part";
  part?: string;
  what: string;
  box: { x: number; y: number; w: number; h: number };
  reads: string;
  expected: string;
  ok: boolean;
  note?: string;
}
export const CANDIDATE = "id, job_id, file_id, origin, note, made_by, attempt_id, created_at, evaluation, details";
/** A detail's id: the picture it was read on, and its number there. Its token (the real product's cut-out) has the same. */
export const detailId = (candidateId: Id, n: number) => `${candidateId}:${n}`;
/** A surgical fix on a picture (docs/mvp/picture-fix.md); staff-only, so a customer reads none. */
const FIX = "id, candidate_id, state, box, ask, error, result_candidate_id, requested_by, created_at";
type FixRow = {
  id: Id;
  candidate_id: Id;
  state: "fixing" | "made" | "failed";
  box: ProductFix["region"];
  ask: string;
  error: string | null;
  result_candidate_id: Id | null;
  requested_by: Id;
  created_at: string;
};
/** A format made from the master's own picture (docs/mvp/formats.md); staff-only. */
const MAKE = "id, creative_id, asked, method, why, window, state, error, result_candidate_id, created_at";
type MakeRow = {
  id: Id;
  creative_id: Id;
  asked: "crop" | "expand" | "regenerate" | null;
  method: "crop" | "expand" | "regenerate" | null;
  why: string | null;
  window: { x: number; y: number; w: number; h: number } | null;
  state: "making" | "made" | "failed";
  error: string | null;
  result_candidate_id: Id | null;
  created_at: string;
};
type StoredEvaluation = Pick<Evaluation, "productTruth" | "brandRules" | "artefacts" | "notes"> & {
  evaluated?: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** An id the database can hold; anything else (an old link, a demo id) is simply not there. */
export function mustBeId(id: Id, what: string): Id {
  if (!UUID.test(id)) throw new FumeError("not_found", `No such ${what}.`);
  return id;
}

export const toFormat = (f: CreativeRow["format"]): Format => (f === "banner" ? "feed" : f);

/** A picture's evaluation: what the Engine saw when it looked at its own picture. A picture made by hand, or one the
 *  Engine has not looked at yet, has none: nothing is said to hold or to be off, the expert checks Product Truth, the
 *  brand rules and artefacts by eye, and the note says how the picture was made. */
export function evaluationOf(c: Pick<CandidateRow, "origin" | "note" | "evaluation"> | undefined): Evaluation {
  const e = c?.evaluation;
  if (c?.origin === "engine" && e?.evaluated)
    return {
      productTruth: e.productTruth,
      brandRules: e.brandRules,
      artefacts: e.artefacts,
      notes: e.notes,
      evaluated: true,
    };
  const how = c?.origin === "engine" ? "Made by the Engine" : "Made by hand";
  return {
    productTruth: "flag",
    brandRules: "flag",
    artefacts: "none",
    evaluated: false,
    notes: [
      // The Engine's own note already says how ("Made by the Engine with …").
      c?.note && /^made by/i.test(c.note.trim())
        ? `${c.note.trim().replace(/[.!?…]+$/, "")}.`
        : `${how}${c?.note ? `: ${c.note.trim().replace(/[.!?…]+$/, "")}` : ""}.`,
    ],
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
  /** The Engine bar's words in this tab, each shown before it renders (FLOWS §9.1). */
  edits?: EngineEdit[];
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
    rows<JobRow>(supabase().from("production_jobs").select(JOB).in("creative_id", ids)),
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
  const [childVersions, makes] = children.length
    ? await Promise.all([
        rows<VersionRow>(
          supabase()
            .from("creative_versions")
            .select(VERSION)
            .in(
              "creative_id",
              children.map((c) => c.id),
            )
            .order("number"),
        ),
        rows<MakeRow>(
          supabase()
            .from("format_makes")
            .select(MAKE)
            .in(
              "creative_id",
              children.map((c) => c.id),
            )
            .order("created_at"),
        ),
      ])
    : [[] as VersionRow[], [] as MakeRow[]];
  const madeIds = makes.flatMap((x) => (x.result_candidate_id ? [x.result_candidate_id] : []));
  const madeFormats = madeIds.length
    ? await rows<{ id: Id; file_id: Id }>(supabase().from("candidates").select("id, file_id").in("id", madeIds))
    : [];
  // The pictures: on the creative's own jobs, and on the jobs its versions came from.
  const jobIds = [...new Set([...jobs.map((j) => j.id), ...versions.flatMap((v) => (v.job_id ? [v.job_id] : []))])];
  const candidates = jobIds.length
    ? await rows<CandidateRow>(supabase().from("candidates").select(CANDIDATE).in("job_id", jobIds).order("created_at"))
    : [];
  const [files, fixRows, prompts] = await Promise.all([
    fileUrls([
      ...candidates.map((c) => c.file_id),
      ...childVersions.map((v) => v.file_id),
      ...madeFormats.map((c) => c.file_id),
    ]),
    candidates.length
      ? rows<FixRow>(
          supabase()
            .from("picture_fixes")
            .select(FIX)
            .in(
              "candidate_id",
              candidates.map((c) => c.id),
            )
            .order("created_at"),
        )
      : Promise.resolve([] as FixRow[]),
    // The prompts behind the Engine's renders: Fume's own people get them, anyone else none.
    readPrompts(jobs.filter((j) => j.mode === "engine").map((j) => j.id)),
  ]);

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
    const list: RenderVersion[] = pictures.map((c) => {
      const p = c.origin === "engine" ? prompts.find((x) => x.attempt_id === c.attempt_id) : undefined;
      return {
        id: c.id,
        number: 0,
        image: files.get(c.file_id)?.url ?? "",
        at: c.created_at,
        by: c.made_by ?? "",
        state: "done",
        ...(c.details?.length
          ? {
              details: c.details.map((d) => ({
                tokenId: detailId(c.id, d.n),
                region: d.box,
                read: d.kind === "part" ? d.reads || "not compared" : d.reads || "nothing legible",
                ok: d.ok,
                ...(d.kind === "part" ? { kind: "part" as const, ...(d.note ? { note: d.note } : {}) } : {}),
              })),
            }
          : {}),
        variables,
        specs: p ? { ...specs, imageModel: modelName(p.image_model) } : specs,
        evaluation: evaluationOf(c),
        instruction: c.origin === "manual" ? `Made by hand${c.note ? `: ${c.note}` : ""}` : (c.note ?? undefined),
        cost: 0,
        ...(p ? { prompt: toEnginePrompt(p) } : {}),
      };
    });
    for (const j of jobs.filter((x) => x.creative_id === cr.id && x.mode === "engine")) {
      const last = prompts.filter((x) => x.job_id === j.id).at(-1);
      const prompt = last ? toEnginePrompt(last) : undefined;
      // A render that did not reach a picture is a version too, so nothing is lost; Render again starts its job over.
      if (j.state === "failed")
        list.push({
          id: `job:${j.id}`,
          number: 0,
          image: "",
          at: j.updated_at,
          by: j.requested_by,
          state: "failed",
          variables,
          specs: { ...specs, imageModel: last ? modelName(last.image_model) : "Engine" },
          evaluation: { productTruth: "flag", brandRules: "flag", artefacts: "none", evaluated: false, notes: [] },
          cost: 0,
          failure: failureOf(j.error, prompt),
          ...(prompt ? { prompt } : {}),
        });
      // The Engine at work on this creative: the next version, rendering. The Engine is asked again now and then, so a
      // picture that was still being made when its run ended is collected.
      else if (engineAtWork(j)) {
        void askEngine(j.id);
        list.push({
          id: `job:${j.id}`,
          number: 0,
          image: "",
          at: j.updated_at,
          by: j.requested_by,
          state: "rendering",
          variables,
          specs: { ...specs, imageModel: "Engine" },
          evaluation: { productTruth: "flag", brandRules: "flag", artefacts: "none", evaluated: false, notes: [] },
          cost: 0,
        });
      }
    }
    // Numbered in the order they were made; the one rendering is the newest.
    list.sort((a, b) => Number(a.state === "rendering") - Number(b.state === "rendering") || a.at.localeCompare(b.at));
    list.forEach((v, i) => (v.number = i + 1));
    // The picture that goes to check: the one picked, else the newest not sent yet; once sent, the one in Check.
    const picked =
      (desk.picked && unsent.some((c) => c.id === desk.picked) ? desk.picked : undefined) ??
      unsent.at(-1)?.id ??
      (state !== "draft" ? (latest?.candidate_id ?? undefined) : undefined);
    // Each format: made from the master's own picture (crop or expand, the Engine's choice unless the designer chose),
    // then a version of its own creative once it goes to check.
    const formats: FormatTile[] = children
      .filter((ch) => ch.master_id === cr.id)
      .map((ch) => {
        const f = toFormat(ch.format);
        const made = childVersions.filter((v) => v.creative_id === ch.id).at(-1);
        const mineMade = makes.filter((x) => x.creative_id === ch.id);
        const last = mineMade.at(-1);
        const engine = mineMade.find((x) => !x.asked && x.method);
        const method = (last?.method ?? last?.asked ?? engine?.method ?? "native") as FormatTile["method"];
        const result = last?.result_candidate_id
          ? madeFormats.find((c) => c.id === last.result_candidate_id)
          : undefined;
        const image = made?.file_id
          ? files.get(made.file_id)?.url
          : result
            ? files.get(result.file_id)?.url
            : undefined;
        const why =
          last?.state === "failed"
            ? `Fume could not make it: ${last.error ?? "it failed"}. Ask again, or choose the other way.`
            : (last?.why ??
              (last
                ? "Fume is choosing how to make it from the master."
                : `Made in its own creative, ${ch.title}, from the approved master.`));
        return {
          placementId: desk.placements?.[f] ?? placements.find((p) => p.format === f)?.id ?? f,
          method,
          engineChose: (engine?.method ?? method) as FormatTile["engineChose"],
          why,
          ...(last?.method === "crop" && last.window ? { crop: last.window } : {}),
          state: made || last?.state === "made" ? "done" : last?.state === "making" ? "making" : "waiting",
          ...(image ? { image } : {}),
        };
      });
    // The fixes a designer brushed on these pictures: one being made shimmers, one made is the new version. A failed
    // fix told the designer why when it failed, and is left out.
    const ids = new Set(pictures.map((c) => c.id));
    const fixes: ProductFix[] = fixRows
      .filter((f) => ids.has(f.candidate_id) && f.state !== "failed")
      .map((f) => ({
        id: f.id,
        region: f.box,
        found: "The brushed area",
        expected: f.ask,
        auto: false,
        by: f.requested_by,
        at: f.created_at,
        state: f.state === "made" ? "fixed" : "fixing",
        ...(f.result_candidate_id ? { versionId: f.result_candidate_id } : {}),
      }));
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
      edits: desk.edits ?? [],
      ...(formats.length ? { formats } : {}),
      ...(fixes.length ? { fixes } : {}),
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

/** Asks for a format of the master (make_format) and starts the `format` function on it. */
export async function makeFormat(
  creativeId: Id,
  method: "crop" | "expand" | "regenerate" | null,
  window: FormatTile["crop"] | null,
) {
  const make = await command<{ id: Id; state: string }>("make_format", {
    p_creative_id: creativeId,
    p_method: method,
    p_window: window ?? null,
  });
  if (make.state === "making") {
    const { error } = await supabase().functions.invoke("format", { body: { makeId: make.id } });
    if (error) throw new FumeError("unavailable", "Fume could not start the format. Ask again in a moment.");
  }
  return make;
}

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
        const opened = await command<{ id: string }>("open_creative", {
          p_campaign_id: creative.campaign_id,
          p_slot: null,
          p_kind: "format",
          p_format: format,
          p_master_version_id: master.id,
          p_title: null,
          p_key: requestKey(),
        });
        desk.placements = { ...desk.placements, [format]: placementId };
        // Fume makes the format from the master's own picture: a crop when the product fits the new shape, else the
        // scene extended. A format that already has a version follows the expert's correction in its own creative.
        try {
          await makeFormat(opened.id, null, null);
        } catch {
          // Made later, from its own creative.
        }
      }
      return (await readDocument(live, creative.id)).doc;
    },
  };
}
