// The Studio on the live backend, as far as manual production needs it: the staff Campaigns table, the brand's kit,
// and the creative documents (production.ts reads them; ids are explained there: a document is a creative, a version
// on its strip is a candidate picture). Render asks the Engine for the picture; a designer can also make it elsewhere
// and add it to the creative with how it was made.
import {
  FumeError,
  type CreativeDocument,
  type DetailToken,
  type EngineEdit,
  type FumeApi,
  type Id,
  type StudioCampaignRow,
  type User,
} from "../../contract";
import { placements } from "../../domain/placements";
import { defaults, modes } from "../../mock/seed/studioModes";
import type { Live } from "./context";
import { readCampaigns } from "./map";
import {
  addManualVersion,
  type CandidateRow,
  creativeMode,
  detailId,
  deskOf,
  readDocument,
  readDocuments,
  toFormat,
  type StudioCreativeRow,
} from "./production";
import { readProducts } from "./products";
import { unsentChecked, withToSend } from "./quality";
import { askEngine, command, requestKey, rows, supabase } from "./supabase";

type Calls =
  | "brandWorkspace"
  | "studioCampaigns"
  | "studioKit"
  | "documents"
  | "document"
  | "openDocument"
  | "updateDocument"
  | "engineEdit"
  | "decideEdit"
  | "render"
  | "pickVersion"
  | "addVersion"
  | "documentToCheck"
  | "undoDocumentToCheck"
  | "setFormatTile"
  | "placements"
  | "brandAssets"
  | "fixProduct"
  | "detailTokens";

/** What the designer says with a Render (render_creative's p_direction): the Engine bar's words and the picture they
 *  change, or the creative's Direction for a new picture. */
type Direction = { instruction?: string; direction?: string; from_candidate_id?: Id };
/** How long Render waits for the Engine's outcome before it leaves the version rendering. */
const RENDER_WAIT_MS = 90_000;
/** How long a fix is watched after it starts: about a minute is usual; a slower one comes in with the record's rows. */
const FIX_WAIT_MS = 120_000;

/** A new picture's Direction, when the creative has one. */
function directionOf(doc: CreativeDocument): Direction | undefined {
  const words = String(doc.variables.direction ?? doc.variables.object ?? "").trim();
  return words ? { direction: words.slice(0, 1000) } : undefined;
}

async function mustBeStaff(live: Live) {
  if (!(await live.me()).staffRole) throw new FumeError("forbidden", "Only Fume's people work in the Studio.");
}

export function studioCalls(live: Live): Pick<FumeApi, Calls> {
  const doc = async (id: string) => (await readDocument(live, id)).doc;

  /** Render with what the designer said: the creative's Engine job starts (or starts again with these words), and the
   *  Studio waits a while for the outcome. */
  async function renderWith(documentId: Id, direction: Direction | undefined): Promise<CreativeDocument> {
    const read = await readDocument(live, documentId);
    const job = await command<{ id: string; state: string; error: string | null }>("render_creative", {
      p_creative_id: read.creative.id,
      p_key: requestKey(),
      p_direction: direction ?? null,
    });
    await askEngine(job.id, true);
    const until = Date.now() + RENDER_WAIT_MS;
    while (Date.now() < until) {
      await new Promise((r) => setTimeout(r, 2_000));
      const now = await rows<{ state: string; error: string | null }>(
        supabase().from("production_jobs").select("state, error").eq("id", job.id),
      );
      const state = now[0]?.state;
      if (state === "failed") throw new FumeError("unavailable", now[0]?.error ?? "The Engine could not render it.");
      if (state === "succeeded" || state === "cancelled") break;
    }
    return doc(documentId);
  }

  const calls: Pick<FumeApi, Calls> = {
    // Every campaign Fume's people can see, with who checks it, who sends it and who approves it. What waits to be sent
    // is what is checked and not sent yet.
    async studioCampaigns() {
      await mustBeStaff(live);
      const [campaigns, workspaces, people, staff, unsent] = await Promise.all([
        readCampaigns({}),
        live.workspaces(),
        live.people(),
        rows<{ user_id: string; workspace_id: string; staff_role: string; can_check: boolean }>(
          supabase().from("staff_assignments").select("user_id, workspace_id, staff_role, can_check"),
        ),
        unsentChecked(),
      ]);
      const person = (id: string | undefined): User | undefined => (id ? people.get(id) : undefined);
      return campaigns.flatMap((campaign): StudioCampaignRow[] => {
        const workspace = workspaces.find((w) => w.id === campaign.workspaceId);
        if (!workspace) return [];
        const on = staff.filter((s) => s.workspace_id === campaign.workspaceId);
        const expert = person(on.find((s) => s.can_check)?.user_id);
        const operator = person(
          (on.find((s) => s.staff_role === "account_manager") ?? on.find((s) => !s.can_check))?.user_id,
        );
        const approver = person(campaign.approverId);
        const readyToRelease = unsent.get(campaign.id) ?? 0;
        return [
          {
            campaign: withToSend(campaign, readyToRelease),
            workspace,
            readyToRelease,
            ...(expert ? { expert } : {}),
            ...(operator ? { operator } : {}),
            ...(approver ? { approver } : {}),
          },
        ];
      });
    },
    // One brand's page in the staff frame: its campaigns. Engine output, the queue, sessions and boards come with the
    // Engine.
    async brandWorkspace(workspaceId) {
      const workspace = (await live.workspaces()).find((w) => w.id === workspaceId);
      if (!workspace) throw new FumeError("not_found", "No such brand.");
      const campaigns = (await calls.studioCampaigns()).filter((r) => r.workspace.id === workspaceId);
      return { workspace, campaigns, engineOutput: [], queue: [], sessions: [], boards: [] };
    },
    // The places a creative is made for: one list for every brand.
    async placements() {
      return placements;
    },
    // A brand's presets, AI models and saved references are made with the Engine; none yet.
    async brandAssets() {
      return { presets: [], models: [], references: [] };
    },
    // The kit's products are the brand's; the Engine's cast, scenes and creative types come with the Engine.
    async studioKit(workspaceId) {
      await mustBeStaff(live);
      return { creativeTypes: [], cast: [], scenes: [], products: await readProducts(workspaceId), references: [] };
    },

    async documents(workspaceId) {
      await mustBeStaff(live);
      const list = await readDocuments(live, { workspaceId });
      return list.map((d) => d.doc).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async document(documentId) {
      await mustBeStaff(live);
      return doc(documentId);
    },
    // A document is a creative of a campaign's approved plan: the one named (creativeId or slot), else the next one the
    // plan has that can be made now (open_creative says which). The same creative opens the same document.
    async openDocument(input) {
      await mustBeStaff(live);
      const mode = modes.find((m) => m.id === input.modeId);
      if (mode && mode.output !== "creative")
        throw new FumeError("unavailable", `${mode.name} is made with the Engine, which is not part of this version.`);
      let id: string;
      if (input.creativeId) id = (await readDocument(live, input.creativeId)).doc.id;
      else {
        if (!input.campaignId)
          throw new FumeError(
            "invalid",
            "Pick the campaign first. This week every creative is made for a campaign's approved plan.",
          );
        const opened = await command<StudioCreativeRow>("open_creative", {
          p_campaign_id: input.campaignId,
          p_slot: input.slot ?? null,
          p_kind: null,
          p_format: null,
          p_master_version_id: null,
          p_title: input.title ?? null,
          p_key: requestKey(),
        });
        id = opened.id;
      }
      const desk = deskOf(live, id);
      if (mode) Object.assign(desk, { modeId: mode.id, studio: input.studio });
      if (input.productId) desk.specs = { ...desk.specs, productId: input.productId };
      return doc(id);
    },
    // What the desk changes stays in this tab (production.ts). A creative stays in the campaign it was planned for.
    async updateDocument(documentId, change) {
      const read = await readDocument(live, documentId);
      if ("campaignId" in change && change.campaignId !== read.doc.campaignId)
        throw new FumeError("conflict", "A creative stays in the campaign it was planned for.");
      const desk = deskOf(live, documentId);
      if (change.modeId && change.modeId !== read.doc.modeId) {
        const next = creativeMode(change.modeId);
        desk.modeId = next.id;
        desk.studio = next.studio;
        desk.variables = { ...defaults(next.id), ...change.variables };
      } else if (change.variables) desk.variables = { ...read.doc.variables, ...change.variables };
      if (change.specs) desk.specs = { ...desk.specs, ...change.specs, format: toFormat(read.creative.format) };
      if (change.layers) desk.layers = change.layers;
      if (change.studio) desk.studio = change.studio;
      if (change.title) desk.title = change.title;
      return doc(documentId);
    },
    // The Engine bar: the words go into the Direction, shown before it renders. The Engine reads them when it writes
    // the prompt; with a picture on the desk it changes that picture as asked and keeps the rest.
    async engineEdit(documentId, text) {
      await mustBeStaff(live);
      const words = text.trim();
      if (!words) throw new FumeError("invalid", "Tell the Engine what to change.");
      if (words.length > 500) throw new FumeError("invalid", "Say it in up to 500 characters.");
      const read = await readDocument(live, documentId);
      const mode = creativeMode(read.doc.modeId);
      const key = mode.variables.some((v) => v.key === "direction") ? "direction" : "object";
      const variable = mode.variables.find((v) => v.key === key);
      if (!variable)
        throw new FumeError("unavailable", `${mode.name} takes no words. Change it on the desk, then render.`);
      const desk = deskOf(live, documentId);
      // A change still waiting is set aside: the newest words are the ones shown.
      desk.edits = (desk.edits ?? []).map((e) => (e.state === "proposed" ? { ...e, state: "undone" } : e));
      const from = String(read.doc.variables[key] ?? "");
      const to = [from.trim().replace(/[.!?]*$/, ""), words].filter(Boolean).join(". ");
      const edit: EngineEdit = {
        id: crypto.randomUUID(),
        text: words,
        changes: [{ key, label: variable.label, from, to }],
        parts: [{ text: words, keys: [key] }],
        by: (await live.me()).id,
        at: new Date().toISOString(),
        state: "proposed",
      };
      desk.edits.push(edit);
      desk.variables = { ...read.doc.variables, [key]: to };
      return doc(documentId);
    },
    async decideEdit(documentId, editId, verdict) {
      await mustBeStaff(live);
      const desk = deskOf(live, documentId);
      const edit = desk.edits?.find((e) => e.id === editId);
      if (!edit) throw new FumeError("not_found", "No such change.");
      if (edit.state !== "proposed") throw new FumeError("conflict", "That change is decided.");
      const read = await readDocument(live, documentId);
      if (verdict === "undo") {
        edit.state = "undone";
        desk.variables = { ...read.doc.variables, ...Object.fromEntries(edit.changes.map((c) => [c.key, c.from])) };
        return doc(documentId);
      }
      edit.state = "kept";
      // With a picture on the desk, the words change it; without one, the Direction goes into a new picture.
      const picture = read.doc.versions.find(
        (v) => v.id === read.doc.pickedVersionId && v.state === "done" && !v.id.startsWith("job:"),
      );
      return renderWith(
        documentId,
        picture ? { instruction: edit.text, from_candidate_id: picture.id } : directionOf(read.doc),
      );
    },
    // The Engine renders the creative (supabase/migrations/20261104130000_engine.sql): the creative's Engine job starts,
    // and the Engine is asked to work on it. The Studio waits a while for the outcome: the new version, or why there
    // is none (the prompt did not pass Fume's checks, the image model refused, the week's budget is used). A picture
    // that takes longer shows as rendering, and the record's new rows bring it in.
    async render(documentId) {
      await mustBeStaff(live);
      const read = await readDocument(live, documentId);
      return renderWith(documentId, directionOf(read.doc));
    },
    async pickVersion(documentId, versionId) {
      const read = await readDocument(live, documentId);
      const version = read.doc.versions.find((v) => v.id === versionId);
      if (!version) throw new FumeError("not_found", "No such version.");
      if (version.state !== "done") throw new FumeError("conflict", "The Engine is still rendering this version.");
      deskOf(live, documentId).picked = versionId;
      return doc(documentId);
    },
    addVersion: (documentId, file, note) => addManualVersion(live, documentId, file, note),
    // The picked picture becomes the creative's next version, waiting for the expert's check.
    async documentToCheck(documentId) {
      const read = await readDocument(live, documentId);
      if (read.doc.state !== "draft") throw new FumeError("conflict", "This creative is in Check already.");
      const picked = read.doc.pickedVersionId;
      if (!picked) throw new FumeError("invalid", "Add the picture first.");
      await command("send_to_check", {
        p_candidate_id: picked,
        p_format: read.creative.format,
        p_title: read.creative.title,
        p_key: requestKey(),
      });
      deskOf(live, documentId).picked = undefined;
      return doc(documentId);
    },
    // A surgical fix (docs/mvp/picture-fix.md): only the brushed part is made again, from the product's own
    // photographs, and the fixed picture comes back as a new version of the same creative, picked. A detail token
    // needs its region on the picture, which the live picture check does not mark yet, so the designer brushes it.
    async fixProduct(documentId, { versionId, tokenId, region: brushed, what }) {
      await mustBeStaff(live);
      const read = await readDocument(live, documentId);
      const picture = read.candidates.find((c) => c.id === versionId);
      if (!picture) throw new FumeError("not_found", "No such version.");
      // A detail the picture check read wrong: its place, and what the real product says.
      const detail = tokenId ? picture.details?.find((d) => detailId(picture.id, d.n) === tokenId) : undefined;
      if (tokenId && !detail) throw new FumeError("not_found", "No such detail on this version.");
      // A detail read tight is grown to the least a fix takes (2.5% a side), around its middle.
      const grow = (b: { x: number; y: number; w: number; h: number }) => {
        const w = Math.max(b.w, 0.025),
          h = Math.max(b.h, 0.025);
        const x = Math.min(Math.max(0, b.x + b.w / 2 - w / 2), 1 - w),
          y = Math.min(Math.max(0, b.y + b.h / 2 - h / 2), 1 - h);
        return { x, y, w, h };
      };
      const region = detail ? grow(detail.box) : brushed;
      if (!region) throw new FumeError("invalid", "Brush the part to fix on the picture.");
      if (region.w * region.h > 0.5) throw new FumeError("invalid", "Draw a smaller box: at most half the picture.");
      const ask = detail
        ? `The ${detail.what} reads "${detail.reads || "nothing legible"}". It says "${detail.expected}", as on the product photographs.`
        : (what ?? "").trim();
      if (!ask) throw new FumeError("invalid", "Say what to change.");
      const fix = await command<{ id: string }>("fix_candidate", {
        p_candidate_id: versionId,
        p_box: region,
        p_ask: ask,
      });
      const { error } = await supabase().functions.invoke("fix", { body: { fixId: fix.id } });
      if (error) throw new FumeError("unavailable", "Fume could not start the fix. Try again in a moment.");
      deskOf(live, documentId).picked = undefined; // the newest picture, the fixed one, is picked when it comes
      const until = Date.now() + FIX_WAIT_MS;
      while (Date.now() < until) {
        await new Promise((r) => setTimeout(r, 3_000));
        const now = await rows<{ state: string; error: string | null }>(
          supabase().from("picture_fixes").select("state, error").eq("id", fix.id),
        );
        if (now[0]?.state === "failed")
          throw new FumeError("unavailable", now[0].error ?? "The fix could not be made.");
        if (now[0]?.state === "made") break;
      }
      return doc(documentId);
    },
    // The real product's cut-outs for the details the picture check read (docs/mvp/detail-read.md): one per place with
    // print on a picture of this product, cut from the product's own photograph. Staff only, like the pictures.
    async detailTokens(productId) {
      const campaigns = await rows<{ campaign_id: string }>(
        supabase().from("campaign_products").select("campaign_id").eq("product_id", productId),
      );
      if (!campaigns.length) return [];
      const jobs = await rows<{ id: string }>(
        supabase()
          .from("production_jobs")
          .select("id")
          .in(
            "campaign_id",
            campaigns.map((c) => c.campaign_id),
          ),
      );
      if (!jobs.length) return [];
      const read = await rows<Pick<CandidateRow, "id" | "details"> & { workspace_id: string }>(
        supabase()
          .from("candidates")
          .select("id, workspace_id, details")
          .in(
            "job_id",
            jobs.map((j) => j.id),
          )
          .not("details", "is", null),
      );
      const found = read.flatMap((c) => (c.details ?? []).filter((d) => d.expected).map((d) => ({ c, d })));
      if (!found.length) return [];
      const { data } = await supabase()
        .storage.from("workspace-files")
        .createSignedUrls(
          found.map(({ c, d }) => `${c.workspace_id}/check/${c.id}-${d.n}-ref.png`),
          3600,
        );
      return found.map(({ c, d }, i): DetailToken => ({
        id: detailId(c.id, d.n),
        productId,
        label: d.what.charAt(0).toUpperCase() + d.what.slice(1),
        value: d.expected,
        kind: "label",
        image: data?.[i]?.signedUrl ?? "",
        region: { x: 0, y: 0, w: 1, h: 1 },
        provenance: { origin: "engine", state: "proposed", evidence: "Read on the product's own photograph" },
      }));
    },
    async undoDocumentToCheck() {
      throw new FumeError(
        "conflict",
        "A version sent to check stays there. The expert can ask for a correction, and the next picture becomes the next version.",
      );
    },
    async setFormatTile() {
      throw new FumeError(
        "unavailable",
        "Crop and expand are the Engine's. Until Wednesday each format is made by hand.",
      );
    },
  };
  return calls;
}
