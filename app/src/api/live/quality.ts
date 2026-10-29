// Check and the release on the live backend: the expert's check of each creative version, the correction they ask
// for, and sending the checked set to the customer.
//
// Ids: QaItem.id = creative_versions.id, so a check always names the exact version the expert saw (the database
// refuses one that is no longer the newest). QaItem.creativeId and QaItem.documentId = creatives.id (production.ts).
// States: in_check → waiting; correcting (the expert asked for a fix, which a designer makes by hand) → in_studio, with
// the maker; checked → checked. The expert's words and pins ("Tell the Engine") are the correction (request_correction).
import {
  FumeError,
  type Campaign,
  type CheckArea,
  type Evaluation,
  type Format,
  type FumeApi,
  type Id,
  type QaFeedback,
  type QaItem,
  type QaPin,
  type QaView,
} from "../../contract";
import type { Live } from "./context";
import { CHECK, VERSION, fileUrls, readCampaigns, type CheckRow, type VersionRow } from "./map";
import {
  CANDIDATE,
  STUDIO_CREATIVE,
  manualEvaluation,
  mustBeId,
  readDocument,
  toFormat,
  type CandidateRow,
  type StudioCreativeRow,
} from "./production";
import { command, requestKey, rows, supabase } from "./supabase";

type Calls = "qaQueue" | "qaCheck" | "qaUncheck" | "qaFeedback" | "qaToStudio" | "release";

/** The versions Check holds: waiting for a check, back with a designer for a correction, held, or checked. */
const IN_CHECK = ["in_check", "correcting", "held", "checked"] as const;

interface ChangeRow {
  id: string;
  version_id: string;
  problem: string;
  pins: QaPin[] | null;
  by: string;
  created_at: string;
  new_version_id: string | null;
}

// ─── What waits to be sent ───────────────────────────────────────────────────

/** Checked versions the customer has not been sent yet, counted by campaign. */
export async function unsentChecked(campaignIds?: Id[]): Promise<Map<Id, number>> {
  const versions = await rows<{ creative_id: string }>(
    supabase().from("creative_versions").select("creative_id").eq("state", "checked").is("sent_at", null),
  );
  const out = new Map<Id, number>();
  if (versions.length === 0) return out;
  let q = supabase()
    .from("creatives")
    .select("id, campaign_id")
    .in("id", [...new Set(versions.map((v) => v.creative_id))]);
  if (campaignIds) q = q.in("campaign_id", campaignIds);
  const creatives = await rows<{ id: string; campaign_id: string }>(q);
  for (const v of versions) {
    const c = creatives.find((x) => x.id === v.creative_id);
    if (c) out.set(c.campaign_id, (out.get(c.campaign_id) ?? 0) + 1);
  }
  return out;
}

/** The campaign with what waits to be sent as the studio counts it: checked and not sent yet. */
export function withToSend(campaign: Campaign, toSend: number): Campaign {
  const { toSend: _was, ...waits } = campaign.waits ?? { questions: 0, directions: 0, briefReady: false };
  return { ...campaign, waits: { ...waits, ...(toSend ? { toSend } : {}) } };
}

// ─── Reading Check ───────────────────────────────────────────────────────────

/** Creatives in Check as QA views: the newest version of each creative in a workspace, or the versions named. */
async function readQa(live: Live, filter: { workspaceId?: Id; versionIds?: Id[] }): Promise<QaView[]> {
  let q = supabase().from("creative_versions").select(VERSION);
  if (filter.versionIds) q = q.in("id", filter.versionIds);
  else q = q.in("state", [...IN_CHECK]);
  if (filter.workspaceId) q = q.eq("workspace_id", filter.workspaceId);
  const found = await rows<VersionRow>(q);
  if (found.length === 0) return [];
  const creativeIds = [...new Set(found.map((v) => v.creative_id))];
  const [creatives, all] = await Promise.all([
    rows<StudioCreativeRow>(supabase().from("creatives").select(STUDIO_CREATIVE).in("id", creativeIds)),
    rows<VersionRow>(
      supabase().from("creative_versions").select(VERSION).in("creative_id", creativeIds).order("number"),
    ),
  ]);
  const newest = (creativeId: Id) => all.filter((v) => v.creative_id === creativeId).at(-1);
  // Check lists each creative once, at its newest version; a version named by id is read as it is.
  const shown = filter.versionIds ? found : found.filter((v) => newest(v.creative_id)?.id === v.id);
  if (shown.length === 0) return [];
  const shownIds = shown.map((v) => v.id);
  const previous = (v: VersionRow) => all.find((x) => x.creative_id === v.creative_id && x.number === v.number - 1);
  const candidateIds = shown.flatMap((v) => (v.candidate_id ? [v.candidate_id] : []));
  const [checks, candidates, changes, files, fileChecks] = await Promise.all([
    rows<CheckRow & { snapshot_id: string | null }>(
      supabase().from("expert_checks").select(`${CHECK}, snapshot_id`).in("version_id", shownIds),
    ),
    candidateIds.length
      ? rows<CandidateRow>(supabase().from("candidates").select(CANDIDATE).in("id", candidateIds))
      : Promise.resolve([]),
    rows<ChangeRow>(
      supabase()
        .from("change_requests")
        // The expert's and the customer's: the expert checks a new version against what was asked for.
        .select("id, version_id, problem, pins, by, created_at, new_version_id")
        .in("source", ["expert", "customer"])
        .is("withdrawn_at", null)
        .in(
          "version_id",
          all.map((v) => v.id),
        )
        .order("created_at"),
    ),
    fileUrls([...shown.map((v) => v.file_id), ...shown.map((v) => previous(v)?.file_id)]),
    // Fume's file check on each version (20261028090000_file_checks.sql); only Fume's team reads it.
    rows<FileFinding>(
      supabase()
        .from("findings")
        .select("version_id, finding, expected, observed")
        .eq("method", "automated")
        .eq("dimension", "file_spec")
        .in("version_id", shownIds)
        .order("created_at"),
    ),
  ]);
  const snapshotIds = [...new Set(checks.flatMap((c) => (c.snapshot_id ? [c.snapshot_id] : [])))];
  const snapshots = snapshotIds.length
    ? await rows<{
        id: string;
        brand_dna_version_id: string | null;
        facts: { id?: string; label: string; statement: string }[];
      }>(supabase().from("context_snapshots").select("id, brand_dna_version_id, facts").in("id", snapshotIds))
    : [];
  const dnaIds = [...new Set(snapshots.flatMap((s) => (s.brand_dna_version_id ? [s.brand_dna_version_id] : [])))];
  const campaignIds = [...new Set(creatives.map((c) => c.campaign_id))];
  // What changed since a version was made (plan Thursday: a new fact or rule is linked to the work it affects): a fact
  // in its snapshot that was corrected since, and a newer approved Brand DNA of its brand.
  const snapFactIds = [...new Set(snapshots.flatMap((s) => s.facts.flatMap((f) => (f.id ? [f.id] : []))))];
  const [corrected, approvedDna] = await Promise.all([
    snapFactIds.length
      ? rows<{ id: string; superseded_by: string }>(
          supabase()
            .from("product_facts")
            .select("id, superseded_by")
            .in("id", snapFactIds)
            .not("superseded_by", "is", null),
        )
      : Promise.resolve([]),
    rows<{ id: string; workspace_id: string; version: number }>(
      supabase()
        .from("brand_dna_versions")
        .select("id, workspace_id, version")
        .eq("state", "approved")
        .in("workspace_id", [...new Set(shown.map((v) => v.workspace_id))]),
    ),
  ]);
  const successors = corrected.length
    ? await rows<{ id: string; label: string; statement: string }>(
        supabase()
          .from("product_facts")
          .select("id, label, statement")
          .in(
            "id",
            corrected.map((c) => c.superseded_by),
          ),
      )
    : [];
  const changedSince = (snapshot: (typeof snapshots)[number] | undefined, workspaceId: string): Check[] => {
    if (!snapshot) return [];
    const facts = snapshot.facts.flatMap((f) => {
      const next = successors.find((x) => x.id === corrected.find((c) => c.id === f.id)?.superseded_by);
      return next
        ? [{ result: "flag" as const, text: `${f.label} was corrected since this was made: now “${next.statement}”` }]
        : [];
    });
    const made = approvedDna.find((d) => d.id === snapshot.brand_dna_version_id);
    const newest = approvedDna.filter((d) => d.workspace_id === workspaceId).sort((a, b) => b.version - a.version)[0];
    const dna =
      made && newest && newest.version > made.version
        ? [
            {
              result: "flag" as const,
              text: `Made with Brand DNA v${made.version}; v${newest.version} is approved since`,
            },
          ]
        : [];
    return [...facts, ...dna];
  };
  const [rules, campaigns, workspaces] = await Promise.all([
    dnaIds.length
      ? rows<{ brand_dna_version_id: string; area: string; statement: string }>(
          supabase()
            .from("brand_rules")
            .select("brand_dna_version_id, area, statement")
            .in("brand_dna_version_id", dnaIds),
        )
      : Promise.resolve([]),
    readCampaigns({ ids: campaignIds }),
    live.workspaces(),
  ]);
  const productIds = [...new Set(campaigns.flatMap((c) => (c.productIds.length === 1 ? c.productIds : [])))];
  const products = productIds.length
    ? await rows<{ id: string; name: string }>(supabase().from("products").select("id, name").in("id", productIds))
    : [];

  const order: Record<QaItem["state"], number> = { waiting: 0, fixing: 1, in_studio: 2, checked: 3 };
  return shown
    .flatMap((v): QaView[] => {
      const cr = creatives.find((c) => c.id === v.creative_id);
      const campaign = cr && campaigns.find((c) => c.id === cr.campaign_id);
      const workspace = workspaces.find((w) => w.id === v.workspace_id);
      if (!cr || !campaign || !workspace) return [];
      const check = checks.find((c) => c.version_id === v.id);
      const made = candidates.find((c) => c.id === v.candidate_id);
      const before = previous(v);
      const snapshot = snapshots.find((s) => s.id === check?.snapshot_id);
      const against = [
        ...(snapshot?.facts ?? []).map((f) => ({
          area: "product_truth" as CheckArea,
          label: f.label,
          against: f.statement,
        })),
        ...rules
          .filter((r) => r.brand_dna_version_id === snapshot?.brand_dna_version_id)
          .map((r) => ({
            area: (r.area === "claims" ? "claims" : "brand_rules") as CheckArea,
            label: r.area.charAt(0).toUpperCase() + r.area.slice(1),
            against: r.statement,
          })),
      ];
      const versionIds = new Set(all.filter((x) => x.creative_id === cr.id).map((x) => x.id));
      const feedback: QaFeedback[] = changes
        .filter((c) => versionIds.has(c.version_id))
        .map((c) => ({
          id: c.id,
          text: c.problem,
          by: c.by,
          at: c.created_at,
          state: c.new_version_id ? "fixed" : "sent",
          ...(c.pins?.length ? { pins: c.pins } : {}),
        }));
      const state: QaItem["state"] =
        v.state === "checked" || v.state === "approved" || v.state === "delivered"
          ? "checked"
          : v.state === "correcting"
            ? "in_studio"
            : "waiting";
      const item: QaItem = {
        id: v.id,
        workspaceId: v.workspace_id,
        campaignId: cr.campaign_id,
        creativeId: cr.id,
        documentId: cr.id,
        title: cr.title,
        slot: cr.title,
        studio: "render",
        image: (v.file_id && files.get(v.file_id)?.url) || "",
        format: toFormat(cr.format),
        madeAt: made?.created_at ?? v.created_at,
        dueAt: campaign.dueAt ?? v.created_at,
        risk: "normal",
        state,
        evaluation: withChanges(
          withFileCheck(
            manualEvaluation(made),
            fileChecks.filter((f) => f.version_id === v.id),
            Boolean(v.file_id),
            toFormat(cr.format),
          ),
          state === "checked" ? [] : changedSince(snapshot, v.workspace_id),
        ),
        feedback,
        version: v.number,
        ...(before
          ? { previous: { image: (before.file_id && files.get(before.file_id)?.url) || "", version: before.number } }
          : {}),
        ...(v.number > 1 && made?.made_by ? { sentBy: made.made_by, sentAt: v.created_at } : {}),
        ...(state === "checked" && check?.expert_id
          ? { checkedBy: check.expert_id, checkedAt: check.decided_at ?? v.created_at }
          : {}),
        ...(state === "in_studio"
          ? { studioBy: made?.made_by ?? "", studioAt: check?.decided_at ?? v.created_at }
          : {}),
      };
      const productName = products.find(
        (p) => campaign.productIds.length === 1 && p.id === campaign.productIds[0],
      )?.name;
      return [{ item, campaign, workspace, against, ...(productName ? { productName } : {}) }];
    })
    .sort(
      (a, b) =>
        order[a.item.state] - order[b.item.state] ||
        a.item.dueAt.localeCompare(b.item.dueAt) ||
        a.item.madeAt.localeCompare(b.item.madeAt),
    );
}

async function readItem(live: Live, itemId: Id): Promise<QaView> {
  const view = (await readQa(live, { versionIds: [mustBeId(itemId, "creative in Check")] }))[0];
  if (!view) throw new FumeError("not_found", "No such creative in Check.");
  return view;
}

export function qualityCalls(live: Live): Pick<FumeApi, Calls> {
  return {
    async qaQueue(workspaceId) {
      if (!(await live.me()).staffRole) throw new FumeError("forbidden", "Check is for Fume's people.");
      return readQa(live, { workspaceId });
    },
    // Signed by the one who checks, against what the version's job used (its Product Truth and the brand's rules).
    async qaCheck(itemId) {
      const view = await readItem(live, itemId);
      if (view.item.state === "checked") return view.item;
      await command("mark_checked", {
        p_version_id: itemId,
        p_items: (view.against ?? []).map((a) => ({ ...a, result: "pass" })),
        p_key: requestKey(),
      });
      return (await readItem(live, itemId)).item;
    },
    // Only the one who checked it, and only before it is sent to the customer.
    async qaUncheck(itemId) {
      const view = await readItem(live, itemId);
      if (view.item.state !== "checked") return view.item;
      await command("uncheck_version", { p_version_id: itemId });
      return (await readItem(live, itemId)).item;
    },
    // The expert's correction: Fume's own fix, no round used. The pins go with it as located notes.
    async qaFeedback(itemId, text, pins) {
      const said = text.trim() || (pins ?? []).map((p) => `${p.n}. ${p.text}`).join(" ");
      if (!said) throw new FumeError("invalid", "Say what to fix.");
      await command("request_correction", {
        p_version_id: mustBeId(itemId, "creative in Check"),
        p_problem: said,
        p_must_change: (pins ?? []).map((p) => p.text),
        p_must_stay: [],
        p_pins: pins ?? [],
      });
      return (await readItem(live, itemId)).item;
    },
    // The creative's document. Nothing is taken from anyone: no Engine works on it this week.
    async qaToStudio(itemId) {
      const view = await readItem(live, itemId);
      const { doc } = await readDocument(live, view.item.creativeId);
      return { item: view.item, document: doc };
    },
    // "Send to Maja": every checked version of the campaign not sent yet becomes visible to the customer.
    async release(campaignId) {
      await command("send_checked", { p_campaign_id: mustBeId(campaignId, "campaign"), p_key: requestKey() });
      const [campaign] = await readCampaigns({ ids: [campaignId] });
      if (!campaign) throw new FumeError("not_found", "No such campaign.");
      return withToSend(campaign, 0);
    },
  };
}

interface FileFinding {
  version_id: string;
  finding: string;
  expected: string | null;
  observed: string | null;
}

/** The file check's result for the expert: what it found, or that the file is right for its format. */
export function withFileCheck(e: Evaluation, found: FileFinding[], hasFile: boolean, format: Format): Evaluation {
  if (!hasFile) return e;
  const checks = found.length
    ? found.map((f) => ({
        result: "flag" as const,
        text: [f.finding, f.expected && `Expected ${f.expected}.`, f.observed && `The file: ${f.observed}.`]
          .filter(Boolean)
          .join(" "),
      }))
    : [{ result: "pass" as const, text: `The file is the right kind, shape and size for ${format}` }];
  return { ...e, checks };
}

type Check = NonNullable<Evaluation["checks"]>[number];

/** Adds what changed in Product Truth or Brand DNA since the version was made, for the expert to weigh. */
export function withChanges(e: Evaluation, changes: Check[]): Evaluation {
  return changes.length ? { ...e, checks: [...(e.checks ?? []), ...changes] } : e;
}
