// The Studio on the live backend, as far as manual production needs it: the staff Campaigns table, the brand's kit,
// and the creative documents (production.ts reads them; ids are explained there: a document is a creative, a version
// on its strip is a candidate picture). Until the Engine runs (Wednesday), nothing renders: a designer makes the
// picture elsewhere and it is added to the creative with how it was made.
import { FumeError, type FumeApi, type StudioCampaignRow, type User } from "../../contract";
import { defaults, modes } from "../../mock/seed/studioModes";
import type { Live } from "./context";
import { readCampaigns } from "./map";
import { creativeMode, deskOf, readDocument, readDocuments, toFormat, type StudioCreativeRow } from "./production";
import { readProducts } from "./products";
import { unsentChecked, withToSend } from "./quality";
import { command, requestKey, rows, supabase } from "./supabase";

type Calls =
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
  | "documentToCheck"
  | "undoDocumentToCheck"
  | "setFormatTile";

const NO_ENGINE = "The Engine runs from Wednesday. Until then the picture is made by hand and added to the creative.";

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
        throw new FumeError("unavailable", `${mode.name} is made with the Engine. It runs from Wednesday.`);
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
    async render() {
      throw new FumeError("unavailable", NO_ENGINE);
    },
    async pickVersion(documentId, versionId) {
      const read = await readDocument(live, documentId);
      if (!read.doc.versions.some((v) => v.id === versionId)) throw new FumeError("not_found", "No such version.");
      deskOf(live, documentId).picked = versionId;
      return doc(documentId);
    },
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
