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
  type QaFinding,
  type QaFormat,
  type QaItem,
  type QaPin,
  type QaView,
  type QualityLogEntry,
  type Severity,
} from "../../contract";
import type { Live } from "./context";
import { CHECK, VERSION, fileUrls, readCampaigns, type CheckRow, type VersionRow } from "./map";
import {
  CANDIDATE,
  STUDIO_CREATIVE,
  evaluationOf,
  mustBeId,
  readDocument,
  readDocuments,
  toFormat,
  type CandidateRow,
  type StudioCreativeRow,
} from "./production";
import { command, requestKey, rows, supabase } from "./supabase";
import { placements } from "../../domain/placements";

type Calls =
  "qaQueue" | "qaCheck" | "qaUncheck" | "qaFeedback" | "qaSettleFinding" | "qaToStudio" | "release" | "qualityLog";

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

/** A version as Check reads it, before an ad's formats are gathered under it: a format names its master. */
type Read = QaView & { masterId?: Id; method?: QaFormat["method"] };

/** How a format was made from the master, from its picture's note (format_finish). */
const methodOf = (note: string | null | undefined): QaFormat["method"] =>
  /^Cropped/i.test(note ?? "")
    ? "crop"
    : /^Expanded/i.test(note ?? "")
      ? "expand"
      : /^Redrawn/i.test(note ?? "")
        ? "regenerate"
        : "native";

/** Creatives in Check as QA views: the newest version of each creative in a workspace, or the versions named. */
async function readQa(live: Live, filter: { workspaceId?: Id; versionIds?: Id[] }): Promise<Read[]> {
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
  const [checks, candidates, changes, files, fileChecks, holds] = await Promise.all([
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
    // What the Engine's checks found on each version (findings with method automated): each is a comment the one who
    // checks settles (FLOWS §29.6, §35.1). A clear fault on the product is critical and stops the check until the
    // expert decides: a new version fixes it, or they set it aside with their name.
    rows<FindingRow>(
      supabase()
        .from("findings")
        .select(
          "id, version_id, dimension, severity, finding, region, expected, observed, status, resolved_by, resolved_at, created_at, detail",
        )
        .eq("method", "automated")
        .neq("dimension", "file_spec")
        .in("version_id", shownIds)
        .order("created_at"),
    ),
  ]);
  const holdsOf = (versionId: Id) =>
    holds
      .filter((h) => h.version_id === versionId && h.severity === "critical" && h.status === "open" && h.detail)
      .map((h) => ({ id: h.id, text: h.finding }));
  const findingsOf = (versionId: Id): QaFinding[] => holds.filter((h) => h.version_id === versionId).map(toFinding);
  // Fume's graphic design on the versions in Check, numbered as the Studio numbers them (Fume's people only).
  const designed = new Set(
    candidates.filter((c) => c.origin === "engine" && /graphic design/i.test(c.note ?? "")).map((c) => c.id),
  );
  const designDocs = designed.size
    ? await readDocuments(live, {
        creativeIds: [
          ...new Set(shown.filter((v) => v.candidate_id && designed.has(v.candidate_id)).map((v) => v.creative_id)),
        ],
      }).catch(() => [])
    : [];
  const designedVersion = (v: VersionRow) =>
    v.candidate_id ? designDocs.flatMap((d) => d.doc.versions).find((x) => x.id === v.candidate_id) : undefined;
  const designOf = (v: VersionRow) => designedVersion(v)?.design;
  // A design is scored as a design (FLOWS §35.3), and what the Engine saw on the picture under it still holds: the
  // product and the brand were looked at there, not on the words laid over them.
  const scored = (e: Evaluation, v: VersionRow): Evaluation => {
    const designed = designedVersion(v);
    if (!designed?.design) return e;
    const under = designDocs
      .flatMap((d) => d.doc.versions)
      .find((x) => x.id === designed.design!.fromVersionId)?.evaluation;
    const base = !e.evaluated && under?.evaluated ? under : e;
    const scores = designed.evaluation.scores;
    return scores ? { ...base, scores } : base;
  };
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

  return shown
    .flatMap((v): Read[] => {
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
            scored(evaluationOf(made), v),
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
        ...(holdsOf(v.id).length ? { holds: holdsOf(v.id) } : {}),
        ...(findingsOf(v.id).length ? { findings: findingsOf(v.id) } : {}),
        ...(designOf(v) ? { design: designOf(v) } : {}),
      };
      const productName = products.find(
        (p) => campaign.productIds.length === 1 && p.id === campaign.productIds[0],
      )?.name;
      const format =
        cr.kind === "format" && cr.master_id ? { masterId: cr.master_id, method: methodOf(made?.note) } : {};
      return [{ item, campaign, workspace, against, ...(productName ? { productName } : {}), ...format }];
    })
    .sort(inOrder);
}

const ORDER: Record<QaItem["state"], number> = { waiting: 0, fixing: 1, in_studio: 2, checked: 3 };
/** Check's order: what waits first, then the soonest due, then the oldest made. */
const inOrder = (a: QaView, b: QaView) =>
  ORDER[a.item.state] - ORDER[b.item.state] ||
  a.item.dueAt.localeCompare(b.item.dueAt) ||
  a.item.madeAt.localeCompare(b.item.madeAt);

// ─── An ad's formats are one ad (FLOWS §35.2) ────────────────────────────────

const FORMAT_ORDER: Format[] = ["feed", "square", "story"];

/** The newest version of each creative named, when it is in Check. */
async function newestInCheck(creativeIds: Id[]): Promise<Id[]> {
  if (creativeIds.length === 0) return [];
  const all = await rows<{ id: string; creative_id: string; number: number; state: string }>(
    supabase().from("creative_versions").select("id, creative_id, number, state").in("creative_id", creativeIds),
  );
  return creativeIds.flatMap((id) => {
    const newest = all.filter((v) => v.creative_id === id).sort((a, b) => b.number - a.number)[0];
    return newest && (IN_CHECK as readonly string[]).includes(newest.state) ? [newest.id] : [];
  });
}

/** The newest version of each master named, in Check or not (its formats are made once the customer approved it). */
async function newestOf(creativeIds: Id[]): Promise<Id[]> {
  if (creativeIds.length === 0) return [];
  const all = await rows<{ id: string; creative_id: string; number: number }>(
    supabase().from("creative_versions").select("id, creative_id, number").in("creative_id", creativeIds),
  );
  return creativeIds.flatMap((id) => {
    const newest = all.filter((v) => v.creative_id === id).sort((a, b) => b.number - a.number)[0];
    return newest ? [newest.id] : [];
  });
}

/**
 * Check as the one who checks sees it: an ad once, with its formats inside it (Marcus, round 15: "De burde komme opp
 * som en annonse, så går man inn å checker de forskjellige formatene"). Each format is a creative of its own, made from
 * the master the customer approved, and waits in Check as its own version; here it is gathered under its master, which
 * leads with its own picture. The ad waits while any format waits. Each format keeps its version, so a check and a
 * correction still name the exact picture.
 */
async function readAds(live: Live, filter: { workspaceId?: Id; versionIds?: Id[] }): Promise<QaView[]> {
  const read = await readQa(live, filter);
  const formats = read.filter((r) => r.masterId);
  const leads = read.filter((r) => !r.masterId);
  // A master named by its version brings its formats in Check; a format named brings its master.
  if (filter.versionIds) {
    const more = await newestInCheck(
      (
        await rows<{ id: string }>(
          supabase()
            .from("creatives")
            .select("id")
            .eq("kind", "format")
            .in(
              "master_id",
              leads.map((l) => l.item.creativeId),
            ),
        )
      ).map((c) => c.id),
    );
    const missing = more.filter((id) => !formats.some((f) => f.item.id === id));
    if (missing.length) formats.push(...(await readQa(live, { versionIds: missing })).filter((r) => r.masterId));
  }
  const masterIds = [...new Set(formats.map((f) => f.masterId!))].filter(
    (id) => !leads.some((l) => l.item.creativeId === id),
  );
  if (masterIds.length) leads.push(...(await readQa(live, { versionIds: await newestOf(masterIds) })));
  const gathered = new Set<Id>();
  const ads = leads.map((lead): QaView => {
    const mine = formats
      .filter((f) => f.masterId === lead.item.creativeId && f.item.format !== lead.item.format)
      .sort((a, b) => FORMAT_ORDER.indexOf(a.item.format) - FORMAT_ORDER.indexOf(b.item.format));
    const { masterId: _m, method: _h, ...view } = lead;
    if (mine.length === 0) return view;
    mine.forEach((f) => gathered.add(f.item.id));
    const items = [lead.item, ...mine.map((f) => f.item)];
    // The master the customer approved counts as checked; the ad stands where its least advanced part stands.
    const state = items.map((i) => i.state).sort((a, b) => ORDER[a] - ORDER[b])[0];
    const all = <T>(pick: (i: QaItem) => T[] | undefined) => items.flatMap((i) => pick(i) ?? []);
    const holds = all((i) => i.holds);
    const findings = all((i) => i.findings);
    const item: QaItem = {
      ...lead.item,
      state,
      madeAt: items
        .map((i) => i.madeAt)
        .sort()
        .at(-1)!,
      feedback: all((i) => i.feedback).sort((a, b) => a.at.localeCompare(b.at)),
      formats: mine.map((f): QaFormat => ({
        placementId: placements.find((p) => p.format === f.item.format)?.id ?? f.item.format,
        format: f.item.format,
        image: f.item.image,
        method: f.method ?? "native",
        versionId: f.item.id,
        state: f.item.state,
      })),
      ...(holds.length ? { holds } : {}),
      ...(findings.length ? { findings } : {}),
    };
    if (state !== "checked") {
      delete item.checkedBy;
      delete item.checkedAt;
    }
    return { ...view, item };
  });
  // A format whose master could not be read stays on its own.
  const alone = formats.filter((f) => !gathered.has(f.item.id)).map(({ masterId: _m, method: _h, ...v }) => v);
  return [...ads, ...alone].sort(inOrder);
}

async function readItem(live: Live, itemId: Id): Promise<QaView> {
  const id = mustBeId(itemId, "creative in Check");
  const views = await readAds(live, { versionIds: [id] });
  const view = views.find((v) => v.item.id === id || v.item.formats?.some((f) => f.versionId === id));
  if (!view) throw new FumeError("not_found", "No such creative in Check.");
  return view;
}

/** The versions of an ad that a check or a correction names: the master's own when it is in Check, and each format's. */
const partsOf = (item: QaItem) => [
  { versionId: item.id, format: undefined as Format | undefined },
  ...(item.formats ?? []).flatMap((f) => (f.versionId ? [{ versionId: f.versionId, format: f.format }] : [])),
];

/** Each version's own state in the database (an approved master counts as checked in Check, but is not one). */
async function versionStates(ids: Id[]): Promise<Map<Id, string>> {
  const found = await rows<{ id: string; state: string }>(
    supabase().from("creative_versions").select("id, state").in("id", ids),
  );
  return new Map(found.map((v) => [v.id, v.state]));
}

export function qualityCalls(live: Live): Pick<FumeApi, Calls> {
  return {
    async qaQueue(workspaceId) {
      if (!(await live.me()).staffRole) throw new FumeError("forbidden", "Check is for Fume's people.");
      return readAds(live, { workspaceId });
    },
    // Signed by the one who checks, against what the version's job used (its Product Truth and the brand's rules).
    // A fault on the product the expert accepts is signed with their name first (resolve_finding); one not accepted
    // stops the check (mark_checked refuses an open critical finding).
    async qaCheck(itemId, accept) {
      const view = await readItem(live, itemId);
      if (view.item.state === "checked") return view.item;
      for (const id of (view.item.holds ?? []).map((h) => h.id).filter((id) => accept?.includes(id))) {
        await command("resolve_finding", { p_finding_id: id, p_status: "accepted" });
      }
      // An ad is checked with all its formats (FLOWS §35.2): each version that waits, against what its own job used.
      const parts = partsOf(view.item);
      const states = await versionStates(parts.map((p) => p.versionId));
      if (parts.length > 1 && parts.some((p) => states.get(p.versionId) === "correcting"))
        throw new FumeError("conflict", "A format is with a designer for a fix. Check the ad when it is back.");
      const waiting = parts.length > 1 ? parts.filter((p) => states.get(p.versionId) === "in_check") : parts;
      const raws = await readQa(live, { versionIds: waiting.map((p) => p.versionId) });
      for (const r of raws) {
        await command("mark_checked", {
          p_version_id: r.item.id,
          p_items: (r.against ?? []).map((a) => ({ ...a, result: "pass" })),
          p_key: requestKey(),
        });
      }
      return (await readItem(live, view.item.id)).item;
    },
    // Only the one who checked it, and only before it is sent to the customer. An ad's formats are unchecked with it.
    async qaUncheck(itemId) {
      const view = await readItem(live, itemId);
      if (view.item.state !== "checked") return view.item;
      const parts = partsOf(view.item);
      const states = await versionStates(parts.map((p) => p.versionId));
      const checked = parts.length > 1 ? parts.filter((p) => states.get(p.versionId) === "checked") : parts;
      for (const p of checked) await command("uncheck_version", { p_version_id: p.versionId });
      return (await readItem(live, view.item.id)).item;
    },
    // The expert's correction: Fume's own fix, no round used. The pins go with it as located notes.
    // The Engine's own findings the note takes up go with it, in its words, as what must change.
    // On an ad with formats, each pin's correction goes to the format it was put on; words with no pin go to every
    // part that waits.
    async qaFeedback(itemId, text, pins, findingIds) {
      const view = await readItem(live, itemId);
      const parts = partsOf(view.item);
      const taken = findingIds?.length ? (view.item.findings ?? []).filter((f) => findingIds.includes(f.id)) : [];
      const foundOn = taken.length
        ? await rows<{ id: string; version_id: string }>(
            supabase()
              .from("findings")
              .select("id, version_id")
              .in(
                "id",
                taken.map((f) => f.id),
              ),
          )
        : [];
      const states = parts.length > 1 ? await versionStates(parts.map((p) => p.versionId)) : undefined;
      const asked = new Map<Id, { pins: QaPin[]; findings: QaFinding[] }>();
      const on = (versionId: Id) => {
        const was = asked.get(versionId) ?? { pins: [], findings: [] };
        asked.set(versionId, was);
        return was;
      };
      for (const pin of pins ?? [])
        on((parts.find((p) => p.format === pin.format) ?? parts[0]).versionId).pins.push(pin);
      for (const f of taken) on(foundOn.find((x) => x.id === f.id)?.version_id ?? parts[0].versionId).findings.push(f);
      if (asked.size === 0) {
        const open = states ? parts.filter((p) => states.get(p.versionId) === "in_check") : [];
        for (const p of open.length ? open : [parts[0]]) on(p.versionId);
      }
      for (const versionId of asked.keys()) {
        if (states && states.get(versionId) !== "in_check")
          throw new FumeError(
            "invalid",
            versionId === parts[0].versionId
              ? "The master is approved by the customer. Pin the format that needs the fix."
              : "That format is not waiting for a check.",
          );
      }
      for (const [versionId, a] of asked) {
        const said =
          text.trim() || [...a.pins.map((p) => `${p.n}. ${p.text}`), ...a.findings.map((f) => f.finding)].join(" ");
        if (!said) throw new FumeError("invalid", "Say what to fix.");
        await command("request_correction", {
          p_version_id: versionId,
          p_problem: said,
          p_must_change: [...a.pins.map((p) => p.text), ...a.findings.map((f) => f.finding)],
          p_must_stay: [],
          p_pins: a.pins,
        });
      }
      return (await readItem(live, view.item.id)).item;
    },
    // "Not a problem": the one who checks sets the finding aside, with their name (resolve_finding); taking that back
    // opens it again (reopen_finding).
    async qaSettleFinding(itemId, findingId, status) {
      const id = mustBeId(findingId, "finding");
      if (status === "accepted") await command("resolve_finding", { p_finding_id: id, p_status: "accepted" });
      else await command("reopen_finding", { p_finding_id: id });
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
    // Everything the check caught before a customer saw it: the file checks and the expert's findings, and each
    // correction an expert asked for. Fixed once resolved, or once a new version answers the correction.
    async qualityLog() {
      const [found, asked] = await Promise.all([
        rows<{
          id: string;
          workspace_id: string;
          version_id: string;
          severity: Severity;
          finding: string;
          status: string;
          created_by: string | null;
          created_at: string;
        }>(
          supabase()
            .from("findings")
            .select("id, workspace_id, version_id, severity, finding, status, created_by, created_at")
            .order("created_at", { ascending: false })
            .limit(500),
        ),
        rows<{
          id: string;
          workspace_id: string;
          version_id: string;
          problem: string;
          new_version_id: string | null;
          by: string;
          created_at: string;
        }>(
          supabase()
            .from("change_requests")
            .select("id, workspace_id, version_id, problem, new_version_id, by, created_at")
            .eq("source", "expert")
            .order("created_at", { ascending: false })
            .limit(500),
        ),
      ]);
      const versionIds = [...new Set([...found, ...asked].map((x) => x.version_id))];
      if (versionIds.length === 0) return [];
      const [versions, checks] = await Promise.all([
        rows<{ id: string; creative_id: string; creatives: { campaign_id: string } | null }>(
          supabase()
            .from("creative_versions")
            .select("id, creative_id, creatives(campaign_id)")
            .in("id", versionIds)
            .overrideTypes<
              { id: string; creative_id: string; creatives: { campaign_id: string } | null }[],
              { merge: false }
            >(),
        ),
        rows<{ id: string; version_id: string }>(
          supabase().from("expert_checks").select("id, version_id").in("version_id", versionIds),
        ),
      ]);
      const of = (versionId: string) => {
        const v = versions.find((x) => x.id === versionId);
        return v && v.creatives
          ? {
              creativeId: v.creative_id,
              campaignId: v.creatives.campaign_id,
              checkId: checks.find((c) => c.version_id === versionId)?.id ?? versionId,
            }
          : undefined;
      };
      const entries: QualityLogEntry[] = [
        ...found.flatMap((f) => {
          const where = of(f.version_id);
          return where
            ? [
                {
                  id: f.id,
                  ...where,
                  workspaceId: f.workspace_id,
                  severity: f.severity,
                  what: f.finding,
                  fixed: f.status !== "open",
                  by: f.created_by ?? "",
                  at: f.created_at,
                },
              ]
            : [];
        }),
        ...asked.flatMap((c) => {
          const where = of(c.version_id);
          return where
            ? [
                {
                  id: c.id,
                  ...where,
                  workspaceId: c.workspace_id,
                  severity: "major" as const,
                  what: c.problem,
                  fixed: Boolean(c.new_version_id),
                  by: c.by,
                  at: c.created_at,
                },
              ]
            : [];
        }),
      ];
      return entries.sort((a, b) => b.at.localeCompare(a.at));
    },
  };
}

interface FindingRow {
  id: string;
  version_id: string;
  dimension: string;
  severity: "critical" | "major" | "minor";
  finding: string;
  region: { x?: number; y?: number; w?: number; h?: number } | null;
  expected: string | null;
  observed: string | null;
  status: "open" | "resolved" | "accepted";
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  detail: string | null;
}

/** The database's dimensions as Check names them: composition is the design; rights sit with the brand's rules. */
const DIMENSION: Record<string, QaFinding["dimension"]> = {
  product: "product",
  text_claims: "text_claims",
  brand_brief: "brand_brief",
  artefacts: "artefacts",
  composition: "design",
  rights: "brand_brief",
};

export function toFinding(f: FindingRow): QaFinding {
  const r = f.region;
  // A region kept as shares of the picture becomes the pin's place, at its middle.
  const share = (n: unknown) => typeof n === "number" && n >= 0 && n <= 1;
  const spot =
    r && share(r.x) && share(r.y) && share(r.w) && share(r.h)
      ? { x: Math.min(1, r.x! + r.w! / 2), y: Math.min(1, r.y! + r.h! / 2) }
      : undefined;
  return {
    id: f.id,
    dimension: DIMENSION[f.dimension] ?? "brand_brief",
    severity: f.severity,
    finding: f.finding,
    ...(f.expected ? { expected: f.expected } : {}),
    ...(f.observed ? { observed: f.observed } : {}),
    status: f.status,
    ...(f.resolved_by ? { by: f.resolved_by } : {}),
    at: f.resolved_at ?? f.created_at,
    ...(spot ? { spot } : {}),
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
