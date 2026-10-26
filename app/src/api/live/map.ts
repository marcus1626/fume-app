// The database's campaigns and creatives as the contract's: one place, so every live domain module answers with the
// same Campaign and Creative (the status sentence, the counts and the names agree everywhere).
import type {
  Campaign,
  CampaignStage,
  CampaignState,
  Channel,
  Creative,
  CreativeVersion,
  Format,
  Id,
  VersionState,
} from "../../contract";
import { countCreatives } from "../../domain/creatives";
import { command, rows, supabase } from "./supabase";

// ─── Rows ────────────────────────────────────────────────────────────────────

export interface CampaignRow {
  id: string;
  workspace_id: string;
  name: string;
  state: CampaignState;
  stage: "brief" | "plan" | "masters" | "variants" | "delivery";
  approver_id: string | null;
  rounds_included: number;
  rounds_used: number;
  due_at: string | null;
  created_by: string | null;
  created_at: string;
  brief_draft: Record<string, unknown>;
}
export const CAMPAIGN =
  "id, workspace_id, name, state, stage, approver_id, rounds_included, rounds_used, due_at, created_by, created_at, brief_draft";

export interface CreativeRow {
  id: string;
  workspace_id: string;
  campaign_id: string;
  master_id: string | null;
  kind: "master" | "variant" | "format";
  format: "feed" | "square" | "story" | "banner";
  channel: string;
  name: string;
  title: string;
  created_at: string;
}
export const CREATIVE = "id, workspace_id, campaign_id, master_id, kind, format, channel, name, title, created_at";

export interface VersionRow {
  id: string;
  workspace_id: string;
  creative_id: string;
  number: number;
  state: VersionState;
  file_id: string | null;
  candidate_id: string | null;
  job_id: string | null;
  master_version_id: string | null;
  held_reason: string | null;
  sent_at: string | null;
  sent_by: string | null;
  created_at: string;
}
export const VERSION =
  "id, workspace_id, creative_id, number, state, file_id, candidate_id, job_id, master_version_id, held_reason, sent_at, sent_by, created_at";

export interface CheckRow {
  id: string;
  version_id: string;
  state: "waiting" | "checked" | "correction" | "held";
  items: unknown[];
  expert_id: string | null;
  decided_at: string | null;
  note: string | null;
  created_at: string;
}
export const CHECK = "id, version_id, state, items, expert_id, decided_at, note, created_at";

export interface ApprovalRow {
  id: string;
  version_id: string;
  decided_by: string;
  created_at: string;
  revoked_at: string | null;
}

export interface FileRow {
  id: string;
  path: string;
  name: string;
  content_type: string;
  bytes: number;
  sha256: string | null;
  width: number | null;
  height: number | null;
}
export const FILE = "id, path, name, content_type, bytes, sha256, width, height";

// ─── Files ───────────────────────────────────────────────────────────────────

export const BUCKET = "workspace-files";

/** Short-lived signed addresses for private files, by file id; a file the caller may not read gets none. */
export async function fileUrls(fileIds: (Id | null | undefined)[]): Promise<Map<Id, { url: string; file: FileRow }>> {
  const ids = [...new Set(fileIds.filter((x): x is Id => Boolean(x)))];
  const out = new Map<Id, { url: string; file: FileRow }>();
  if (ids.length === 0) return out;
  const files = await rows<FileRow>(supabase().from("files").select(FILE).in("id", ids));
  if (files.length === 0) return out;
  const { data } = await supabase()
    .storage.from(BUCKET)
    .createSignedUrls(
      files.map((f) => f.path),
      60 * 60,
    );
  for (const f of files) {
    const signed = data?.find((d) => d.path === f.path)?.signedUrl;
    if (signed) out.set(f.id, { url: signed, file: f });
  }
  return out;
}

/** Uploads a file into the workspace's folder and registers it; answers the file's id. */
export async function uploadFile(
  workspaceId: Id,
  file: File | Blob,
  input: { name: string; purpose: "source" | "candidate"; width?: number; height?: number },
): Promise<Id> {
  const path = `${workspaceId}/${crypto.randomUUID()}-${input.name.replace(/[^\w.-]+/g, "_")}`;
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const { error } = await supabase()
    .storage.from(BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) throw new Error(error.message);
  const row = await command<{ id: Id }>("register_file", {
    p_workspace_id: workspaceId,
    p_path: path,
    p_name: input.name,
    p_content_type: file.type || "application/octet-stream",
    p_bytes: bytes.byteLength,
    p_sha256: sha256,
    p_width: input.width ?? null,
    p_height: input.height ?? null,
    p_purpose: input.purpose,
    p_key: crypto.randomUUID(),
  });
  return row.id;
}

// ─── Creatives ───────────────────────────────────────────────────────────────

const FORMAT_SIZE: Record<Format, { width: number; height: number }> = {
  feed: { width: 1080, height: 1350 },
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
};

function toFormat(f: CreativeRow["format"]): Format {
  return f === "banner" ? "feed" : f;
}
function toChannel(c: string): Channel {
  return (
    (["paid_social", "organic_social", "email", "product_page", "display"] as const).find((x) => x === c) ??
    "organic_social"
  );
}

/** Everything one set of creatives needs, read in a few queries; the caller's row-level security decides what comes back. */
export async function readCreatives(filter: { campaignIds?: Id[]; creativeIds?: Id[] }): Promise<Creative[]> {
  let q = supabase().from("creatives").select(CREATIVE);
  if (filter.campaignIds) q = q.in("campaign_id", filter.campaignIds);
  if (filter.creativeIds) q = q.in("id", filter.creativeIds);
  const creatives = await rows<CreativeRow>(q.order("created_at"));
  if (creatives.length === 0) return [];
  const versions = await rows<VersionRow>(
    supabase()
      .from("creative_versions")
      .select(VERSION)
      .in(
        "creative_id",
        creatives.map((c) => c.id),
      )
      .order("number"),
  );
  const versionIds = versions.map((v) => v.id);
  const [checks, approvals, files] = await Promise.all([
    versionIds.length
      ? rows<CheckRow>(supabase().from("expert_checks").select(CHECK).in("version_id", versionIds))
      : Promise.resolve([]),
    versionIds.length
      ? rows<ApprovalRow>(
          supabase()
            .from("approvals")
            .select("id, version_id, decided_by, created_at, revoked_at")
            .in("version_id", versionIds)
            .is("revoked_at", null),
        )
      : Promise.resolve([]),
    fileUrls(versions.map((v) => v.file_id)),
  ]);
  return creatives.flatMap((c) => {
    const mine = versions.filter((v) => v.creative_id === c.id);
    if (mine.length === 0) return [];
    const format = toFormat(c.format);
    const toVersion = (v: VersionRow): CreativeVersion => {
      const check = checks.find((x) => x.version_id === v.id);
      const approval = approvals.find((a) => a.version_id === v.id);
      const file = v.file_id ? files.get(v.file_id) : undefined;
      return {
        id: v.id,
        creativeId: c.id,
        number: v.number,
        image: file?.url ?? "",
        width: file?.file.width ?? FORMAT_SIZE[format].width,
        height: file?.file.height ?? FORMAT_SIZE[format].height,
        state: v.state,
        madeAt: v.created_at,
        ...(check ? { checkId: check.id } : {}),
        ...(check?.state === "checked" && check.expert_id
          ? { checkedBy: check.expert_id, checkedAt: check.decided_at ?? v.created_at }
          : {}),
        ...(approval ? { approvedBy: approval.decided_by, approvedAt: approval.created_at } : {}),
        ...(v.held_reason ? { heldReason: v.held_reason } : {}),
      };
    };
    const list = mine.map(toVersion);
    return [
      {
        id: c.id,
        campaignId: c.campaign_id,
        directionId: "a",
        masterId: c.master_id,
        kind: c.kind === "master" ? "master" : "variant",
        format,
        channel: toChannel(c.channel),
        name: c.name,
        title: c.title,
        current: list[list.length - 1]!,
        versions: list,
      } satisfies Creative,
    ];
  });
}

// ─── Campaigns ───────────────────────────────────────────────────────────────

/** The brief's lines as the campaign shows them (channels, formats, market, language). */
function briefLines(draft: Record<string, unknown>) {
  const list = <T extends string>(v: unknown): T[] =>
    Array.isArray(v) ? (v as T[]) : typeof v === "string" && v ? (v.split(",").map((x) => x.trim()) as T[]) : [];
  return {
    channels: list<Channel>(draft.channels),
    formats: list<Format>(draft.formats),
    market: typeof draft.market === "string" ? draft.market : "",
    language: typeof draft.language === "string" ? draft.language : "en",
  };
}

const STAGE: Record<CampaignRow["stage"], CampaignStage> = {
  brief: "brief",
  plan: "plan",
  masters: "masters",
  variants: "variants",
  delivery: "delivery",
};

/**
 * Campaigns with their counts and what they wait on. `creatives` is what the caller sees (a customer sees only
 * checked and sent versions); the plan's state comes from its latest version.
 */
export async function readCampaigns(filter: { workspaceId?: Id; ids?: Id[] }): Promise<Campaign[]> {
  let q = supabase().from("campaigns").select(CAMPAIGN);
  if (filter.workspaceId) q = q.eq("workspace_id", filter.workspaceId);
  if (filter.ids) q = q.in("id", filter.ids);
  const list = await rows<CampaignRow>(q.order("created_at", { ascending: false }));
  if (list.length === 0) return [];
  const ids = list.map((c) => c.id);
  const [products, plans, creatives, unsent] = await Promise.all([
    rows<{ campaign_id: string; product_id: string }>(
      supabase().from("campaign_products").select("campaign_id, product_id").in("campaign_id", ids),
    ),
    rows<{
      campaign_id: string;
      version: number;
      state: string;
      checked_by: string | null;
      body: { planned_creatives?: unknown[] };
    }>(
      supabase()
        .from("plan_versions")
        .select("campaign_id, version, state, checked_by, body")
        .in("campaign_id", ids)
        .neq("state", "superseded"),
    ),
    readCreatives({ campaignIds: ids }),
    rows<{ creative_id: string }>(
      supabase().from("creative_versions").select("creative_id").eq("state", "checked").is("sent_at", null),
    ),
  ]);
  return list.map((c) => {
    const lines = briefLines(c.brief_draft ?? {});
    const plan = plans.filter((p) => p.campaign_id === c.id).sort((a, b) => b.version - a.version)[0];
    const mine = creatives.filter((x) => x.campaignId === c.id);
    const toSend = mine.filter((x) => unsent.some((u) => u.creative_id === x.id)).length;
    return {
      id: c.id,
      workspaceId: c.workspace_id,
      name: c.name,
      productIds: products.filter((p) => p.campaign_id === c.id).map((p) => p.product_id),
      state: c.state,
      stage: STAGE[c.stage],
      approverId: c.approver_id ?? "",
      channels: lines.channels,
      formats: lines.formats,
      market: lines.market,
      language: lines.language,
      ...(c.due_at ? { dueAt: c.due_at } : {}),
      createdBy: c.created_by ?? "",
      createdAt: c.created_at,
      updatedAt: c.created_at,
      counts: countCreatives(mine),
      roundsUsed: c.rounds_used,
      roundsIncluded: c.rounds_included,
      chosenDirectionId: "a",
      brandDnaVersion: 1,
      waits: {
        questions: 0,
        directions: 0,
        briefReady: false,
        ...(plan ? { plan: (plan.state === "changes_asked" ? "changes_asked" : plan.state) as never } : {}),
        ...(plan?.body?.planned_creatives ? { planned: plan.body.planned_creatives.length } : {}),
        ...(plan?.checked_by ? { planChecked: true } : {}),
        ...(toSend ? { toSend } : {}),
      },
    } satisfies Campaign;
  });
}
