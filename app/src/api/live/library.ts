// FLOWS §37: current creative versions, plus pictures that have never gone to Check. Every read uses the caller's
// RLS, including private pictures; no source assets or Engine lineage are returned to the Library.
import type { PostgrestError } from "@supabase/supabase-js";
import {
  FumeError,
  type FumeApi,
  type Id,
  type LibraryItem,
  type LibraryState,
  type VersionState,
} from "../../contract";
import type { Live } from "./context";
import { CREATIVE_WITH_PARTS, FILE, signFiles, toCreatives, type CreativeWithVersions, type FileRow } from "./map";
import { deskOf, toFormat } from "./production";
import { rows, supabase } from "./supabase";

const states: Record<VersionState, LibraryState> = {
  making: "making",
  in_check: "to_check",
  correcting: "to_check",
  held: "to_check",
  checked: "checked",
  changes_requested: "changes",
  approved: "approved",
  delivered: "delivered",
};
type LibraryCreative = CreativeWithVersions & { slot: string | null };
interface Campaign {
  id: Id;
  workspace_id: Id;
  name: string;
}
interface Job {
  id: Id;
  creative_id: Id;
  requested_by: Id;
}
interface Picture {
  id: Id;
  job_id: Id;
  file_id: Id;
  made_by: Id | null;
  created_at: string;
}
interface Plan {
  campaign_id: Id;
  version: number;
  planned: { id?: string; name?: string }[] | null;
}

// Keep requests below PostgREST's row cap and bound IN lists (including UUIDs in the URL).
const PAGE_SIZE = 1000;
const ID_BATCH = 100;
type PageQuery<T> = PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;
async function readIn<T>(ids: Id[], query: (batch: Id[], from: number, to: number) => PageQuery<T>): Promise<T[]> {
  const result: T[] = [];
  for (let start = 0; start < ids.length; start += ID_BATCH) {
    const batch = ids.slice(start, start + ID_BATCH);
    for (let from = 0; ; from += PAGE_SIZE) {
      const page = await rows<T>(query(batch, from, from + PAGE_SIZE - 1));
      result.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
  }
  return result;
}

function titleOf(c: LibraryCreative, plans: Map<Id, Plan>): string {
  const useful = (name: string | undefined) => name && !/^Master\s+\d+$/i.test(name);
  const title = c.title.trim();
  if (useful(title)) return title;
  const plan = plans.get(c.campaign_id);
  const planned = Array.isArray(plan?.planned)
    ? plan.planned.find((p) => p.id === c.slot || p.name === c.slot)?.name?.trim()
    : undefined;
  return (useful(planned) ? planned : undefined) || c.name.trim() || title;
}

export function libraryCalls(live: Live): Pick<FumeApi, "library"> {
  return {
    async library(workspaceId) {
      const [me, workspaces] = await Promise.all([live.me(), live.workspaces()]);
      const customer = !me.staffRole;
      if (customer) {
        if (!(await live.role())) throw new FumeError("forbidden", "This brand is not yours.");
        workspaceId = await live.workspaceId();
      }
      const scope = workspaces
        .filter(
          (w) => (!workspaceId || w.id === workspaceId) && (!me.agency || w.agencyId === me.agency.organisationId),
        )
        .map((w) => w.id);
      if (!scope.length) return [];
      const campaigns = await readIn<Campaign>(scope, (batch, from, to) =>
        supabase()
          .from("campaigns")
          .select("id, workspace_id, name")
          .in("workspace_id", batch)
          .order("id")
          .range(from, to),
      );
      if (!campaigns.length) return [];
      const campaignIds = campaigns.map((c) => c.id);
      const [found, links, plans] = await Promise.all([
        readIn<LibraryCreative>(campaignIds, (batch, from, to) =>
          supabase()
            .from("creatives")
            .select(`${CREATIVE_WITH_PARTS}, slot`)
            .in("campaign_id", batch)
            .is("creative_versions.approvals.revoked_at", null)
            // Only the newest version visible through RLS is needed, even for long version histories.
            .order("number", { referencedTable: "creative_versions", ascending: false })
            .limit(1, { referencedTable: "creative_versions" })
            .order("id")
            .range(from, to)
            .overrideTypes<LibraryCreative[], { merge: false }>(),
        ),
        readIn<{ campaign_id: Id; product_id: Id }>(campaignIds, (batch, from, to) =>
          supabase()
            .from("campaign_products")
            .select("campaign_id, product_id")
            .in("campaign_id", batch)
            .order("campaign_id")
            .order("product_id")
            .range(from, to),
        ),
        readIn<Plan>(campaignIds, (batch, from, to) =>
          supabase()
            .from("plan_versions")
            .select("campaign_id, version, planned:body->planned_creatives")
            .in("campaign_id", batch)
            .neq("state", "superseded")
            .order("campaign_id")
            .order("version")
            .range(from, to),
        ),
      ]);
      if (!found.length) return [];
      const ids = found.map((c) => c.id);
      const productIds = [...new Set(links.map((p) => p.product_id))];
      const [jobs, products, versionFiles, designs] = await Promise.all([
        customer
          ? Promise.resolve([] as Job[])
          : readIn<Job>(ids, (batch, from, to) =>
              supabase()
                .from("production_jobs")
                .select("id, creative_id, requested_by")
                .in("creative_id", batch)
                .order("id")
                .range(from, to),
            ),
        productIds.length
          ? readIn<{ id: Id; name: string }>(productIds, (batch, from, to) =>
              supabase().from("products").select("id, name").in("id", batch).order("id").range(from, to),
            )
          : Promise.resolve([]),
        signFiles(found.flatMap((c) => (c.creative_versions ?? []).flatMap((v) => (v.files ? [v.files] : [])))),
        customer
          ? Promise.resolve([] as { result_candidate_id: Id | null }[])
          : readIn<{ result_candidate_id: Id | null }>(ids, (batch, from, to) =>
              supabase()
                .from("design_layers")
                .select("result_candidate_id")
                .in("creative_id", batch)
                .eq("state", "made")
                .order("id")
                .range(from, to),
            ),
      ]);
      const pictures = jobs.length
        ? await readIn<Picture>(
            jobs.map((j) => j.id),
            (batch, from, to) =>
              supabase()
                .from("candidates")
                .select("id, job_id, file_id, made_by, created_at")
                .in("job_id", batch)
                .order("created_at")
                .order("id")
                .range(from, to),
          )
        : [];
      const jobsById = new Map(jobs.map((j) => [j.id, j]));
      const picturesByCreative = new Map<Id, Picture[]>();
      const picturesById = new Map(pictures.map((p) => [p.id, p]));
      for (const picture of pictures) {
        const creativeId = jobsById.get(picture.job_id)?.creative_id;
        if (!creativeId) continue;
        const group = picturesByCreative.get(creativeId) ?? [];
        group.push(picture);
        picturesByCreative.set(creativeId, group);
      }
      // A creative can have jobs in different request batches; restore one chronological order for its pictures.
      for (const group of picturesByCreative.values()) {
        group.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
      }
      const draftIds = new Set(found.filter((c) => !c.creative_versions?.length).map((c) => c.id));
      const draftFileIds = [
        ...new Set([...draftIds].flatMap((id) => (picturesByCreative.get(id) ?? []).map((p) => p.file_id))),
      ];
      const draftFiles = await signFiles(
        await readIn<FileRow>(draftFileIds, (batch, from, to) =>
          supabase().from("files").select(FILE).in("id", batch).order("id").range(from, to),
        ),
      );
      const campaignsById = new Map(campaigns.map((c) => [c.id, c]));
      const productsById = new Map(products.map((p) => [p.id, p]));
      const productByCampaign = new Map<Id, Id>();
      for (const link of links) {
        if (!productByCampaign.has(link.campaign_id)) productByCampaign.set(link.campaign_id, link.product_id);
      }
      const plansByCampaign = new Map<Id, Plan>();
      for (const plan of plans) {
        if (plan.version > (plansByCampaign.get(plan.campaign_id)?.version ?? -1))
          plansByCampaign.set(plan.campaign_id, plan);
      }
      const designPictures = new Set(designs.map((d) => d.result_candidate_id));
      const creatives = new Map(found.flatMap((c) => toCreatives([c], versionFiles)).map((c) => [c.id, c]));
      const items: LibraryItem[] = [];
      for (const c of found) {
        const campaign = campaignsById.get(c.campaign_id);
        if (!campaign) continue;
        const current = creatives.get(c.id)?.current;
        const mine = picturesByCreative.get(c.id) ?? [];
        const desk = customer ? undefined : deskOf(live, c.id);
        const shown = mine.find((p) => p.id === desk?.picked) ?? mine.at(-1);
        if (!current && (customer || !shown)) continue;
        if (customer && current?.state !== "approved" && current?.state !== "delivered") continue;
        const version = c.creative_versions?.find((v) => v.id === current?.id);
        const picture = current ? picturesById.get(version?.candidate_id ?? "") : shown;
        const madeBy = picture?.made_by ?? jobsById.get(picture?.job_id ?? version?.job_id ?? "")?.requested_by;
        const product = productsById.get(productByCampaign.get(campaign.id) ?? "");
        const state = current ? states[current.state] : "studio";
        const ways = !customer && me.staffRole !== "admin";
        items.push({
          id: c.id,
          workspaceId: campaign.workspace_id,
          campaignId: campaign.id,
          campaignName: campaign.name,
          ...(current ? { creativeId: c.id } : {}),
          ...(ways ? { documentId: c.id } : {}),
          ...(ways && state === "to_check" ? { checkItemId: current!.id } : {}),
          title: titleOf(c, plansByCampaign),
          name: c.name,
          format: toFormat(c.format),
          studio: picture && designPictures.has(picture.id) ? "design" : (desk?.studio ?? "render"),
          kind: current ? (c.kind === "master" ? "master" : "variant") : "draft",
          image: current?.image ?? (shown ? draftFiles.get(shown.file_id)?.url : undefined),
          state,
          version: current?.number ?? mine.indexOf(shown!) + 1,
          at: current ? (current.approvedAt ?? current.checkedAt ?? current.madeAt) : shown!.created_at,
          ...(madeBy ? { madeBy } : {}),
          ...(current?.checkedBy ? { checkedBy: current.checkedBy, checkedAt: current.checkedAt } : {}),
          ...(current?.approvedBy ? { approvedBy: current.approvedBy, approvedAt: current.approvedAt } : {}),
          ...(product ? { productName: product.name } : {}),
        });
      }
      return items.sort((a, b) => b.at.localeCompare(a.at));
    },
  };
}
