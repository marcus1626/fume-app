// The Studio on the live backend, as far as manual production needs it: the staff Campaigns table, the brand's kit,
// and the creative documents (production.ts reads them; ids are explained there: a document is a creative, a version
// on its strip is a candidate picture). Render asks the Engine for the picture; a designer can also make it elsewhere
// and add it to the creative with how it was made.
import { FumeError, type FumeApi, type StudioCampaignRow, type User } from "../../contract";
import { placements } from "../../domain/placements";
import { defaults, modes } from "../../mock/seed/studioModes";
import type { Live } from "./context";
import { readCampaigns } from "./map";
import {
  addManualVersion,
  creativeMode,
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
  | "brandAssets";

const NO_ENGINE = "The Engine does not change variables from words yet. Change them on the desk, then render.";
/** How long Render waits for the Engine's outcome before it leaves the version rendering. */
const RENDER_WAIT_MS = 90_000;

async function mustBeStaff(live: Live) {
  if (!(await live.me()).staffRole) throw new FumeError("forbidden", "Only Fume's people work in the Studio.");
}

export function studioCalls(live: Live): Pick<FumeApi, Calls> {
  const doc = async (id: string) => (await readDocument(live, id)).doc;

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
    async engineEdit() {
      throw new FumeError("unavailable", NO_ENGINE);
    },
    async decideEdit() {
      throw new FumeError("unavailable", NO_ENGINE);
    },
    // The Engine renders the creative (supabase/migrations/20261104130000_engine.sql): the creative's Engine job starts,
    // and the Engine is asked to work on it. The Studio waits a while for the outcome: the new version, or why there
    // is none (the prompt did not pass Fume's checks, the image model refused, the week's budget is used). A picture
    // that takes longer shows as rendering, and the record's new rows bring it in.
    async render(documentId) {
      await mustBeStaff(live);
      const read = await readDocument(live, documentId);
      const job = await command<{ id: string; state: string; error: string | null }>("render_creative", {
        p_creative_id: read.creative.id,
        p_key: requestKey(),
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
