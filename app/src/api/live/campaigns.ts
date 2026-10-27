// Campaigns and the brief on the live backend: the campaigns of the open brand, one campaign with its brief, creatives
// and record, a brief written on the form (ordered, then sent), and the campaign's approver.
//
// The brief lives in two places in the database: the draft she writes (campaigns.brief_draft, merged line by line by
// save_brief_draft) and every version she sent (brief_versions, never overwritten). send_brief sends the draft and
// has Fume write plan 1 from it (20261027091000_brief_draft_and_first_plan.sql).
import {
  FumeError,
  type Brief,
  type BriefOrder,
  type Campaign,
  type CampaignView,
  type Channel,
  type Creative,
  type Format,
  type FumeApi,
  type Id,
  type RecordEvent,
  type User,
} from "../../contract";
import type { Live } from "./context";
import { type CampaignRow, readCampaigns, readCreatives } from "./map";
import { askFumeToWrite, command, requestKey, rows, supabase } from "./supabase";

type Calls = "campaigns" | "campaign" | "setApprover" | "orderBrief" | "sendBrief" | "approveBrief" | "changeBrief";

// ─── The brief ───────────────────────────────────────────────────────────────

interface BriefVersionRow {
  id: string;
  campaign_id: string;
  version: number;
  body: Record<string, unknown>;
  sent_by: string | null;
  sent_at: string;
}
const BRIEF_VERSION = "id, campaign_id, version, body, sent_by, sent_at";

const text = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const lines = <T extends string>(v: unknown): T[] =>
  (Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [])
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean) as T[];
/** How many creatives the brief asks for, as send_brief reads it (a whole number, one or more), else 0. */
const creativesIn = (body: Record<string, unknown>) => {
  const n = text(body.creatives ?? body.count).trim();
  return /^[1-9][0-9]*$/.test(n) ? Number(n) : 0;
};

/** The same JSON, whatever the order of its keys. */
function sameJson(a: unknown, b: unknown): boolean {
  const norm = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(norm)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.keys(v as object)
              .sort()
              .map((k) => [k, norm((v as Record<string, unknown>)[k])]),
          )
        : v;
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

/**
 * The brief as the contract has it. Sent and unchanged since: "approved" at the sent version. Changed after sending,
 * or never sent: the draft, "ready" once send_brief would take it, else "drafting", at the version it would become.
 *
 * send_brief refuses a brief without a goal, an audience, a message, a format or a number of creatives. The screens
 * check the first three themselves (briefGaps: "Fill in the audience here"), so `missing` names only the other two,
 * and a brief with neither gap is exactly one send_brief takes.
 */
export function toBrief(campaign: Pick<CampaignRow, "id" | "brief_draft">, sent: BriefVersionRow | undefined): Brief {
  const draft = campaign.brief_draft ?? {};
  const unsent = !sent || !sameJson(draft, sent.body);
  const body = unsent ? draft : sent.body;
  const formats = lines<Format>(body.formats);
  const creatives = creativesIn(body);
  const missing = [
    ...(formats.length ? [] : ["Which formats it needs"]),
    ...(creatives ? [] : ["How many creatives it needs"]),
  ];
  const complete = missing.length === 0 && ["objective", "audience", "message"].every((k) => text(body[k]).trim());
  const offer = text(body.offer).trim();
  return {
    campaignId: campaign.id,
    version: sent ? sent.version + (unsent ? 1 : 0) : 1,
    state: !unsent ? "approved" : complete ? "ready" : "drafting",
    objective: text(body.objective),
    audience: text(body.audience),
    ...(offer ? { offer } : {}),
    message: text(body.message),
    mandatory: lines(body.mandatory),
    never: lines(body.never),
    channels: lines<Channel>(body.channels),
    formats,
    creatives,
    references: lines(body.references),
    missing,
    ...(!unsent && sent.sent_by ? { approvedBy: sent.sent_by } : {}),
    ...(!unsent ? { approvedAt: sent.sent_at } : {}),
  };
}

/** The briefs of these campaigns, by campaign id. */
export async function readBriefs(campaignIds: Id[]): Promise<Map<Id, Brief>> {
  const out = new Map<Id, Brief>();
  if (campaignIds.length === 0) return out;
  const [campaigns, versions] = await Promise.all([
    rows<Pick<CampaignRow, "id" | "brief_draft">>(
      supabase().from("campaigns").select("id, brief_draft").in("id", campaignIds),
    ),
    rows<BriefVersionRow>(
      supabase()
        .from("brief_versions")
        .select(BRIEF_VERSION)
        .in("campaign_id", campaignIds)
        .order("version", { ascending: false }),
    ),
  ]);
  for (const c of campaigns)
    out.set(
      c.id,
      toBrief(
        c,
        versions.find((v) => v.campaign_id === c.id),
      ),
    );
  return out;
}

async function readBrief(campaignId: Id): Promise<Brief> {
  const brief = (await readBriefs([campaignId])).get(campaignId);
  if (!brief) throw new FumeError("not_found", "No such campaign.");
  return brief;
}

/** The brief's lines under the names the database keeps them by (the contract's own names). */
const BRIEF_LINES = [
  "objective",
  "audience",
  "offer",
  "message",
  "mandatory",
  "never",
  "channels",
  "formats",
  "creatives",
  "references",
] as const satisfies readonly (keyof Brief)[];

/** Only addresses that last: a picture picked from the brand's own, never a blob: URL of an upload in this tab. */
const lasting = (refs: string[] | undefined) => (refs ?? []).filter((r) => /^https?:\/\//.test(r));

// ─── The record ──────────────────────────────────────────────────────────────

interface EventRow {
  id: number;
  workspace_id: string;
  actor: string | null;
  action: string;
  subject_type: string;
  subject_id: string;
  detail: Record<string, unknown>;
  at: string;
}

/** The database's record as the campaign page's history: the events the contract has a name for. The plan's own
 *  events are not here: the page tells them from the plan (who wrote, checked and approved which version). */
const ACTION: Partial<Record<string, RecordEvent["action"]>> = {
  "brief.sent": "brief_approved",
  "version.in_check": "made",
  "version.checked": "checked",
  "version.correction_asked": "correction",
  "version.held": "held",
  "version.approved": "approved",
  "version.changes_requested": "changes_requested",
  "delivery.made": "delivered",
  "delivery.confirmed_live": "confirmed_live",
};

async function readRecord(campaign: Campaign, creatives: Creative[]): Promise<RecordEvent[]> {
  const [briefs, deliveries] = await Promise.all([
    rows<{ id: string }>(supabase().from("brief_versions").select("id").eq("campaign_id", campaign.id)),
    rows<{ id: string }>(supabase().from("deliveries").select("id").eq("campaign_id", campaign.id)),
  ]);
  // A version's events only for the versions the caller may see (a customer sees checked and sent work only).
  const versions = new Map(creatives.flatMap((c) => c.versions.map((v) => [v.id, { creative: c, number: v.number }])));
  const ids = [campaign.id, ...briefs.map((b) => b.id), ...deliveries.map((d) => d.id), ...versions.keys()];
  const events = await rows<EventRow>(
    supabase()
      .from("record_events")
      .select("id, workspace_id, actor, action, subject_type, subject_id, detail, at")
      .in("subject_id", ids)
      .in("action", Object.keys(ACTION))
      .order("at", { ascending: false }),
  );
  return events.flatMap((e) => {
    const action = ACTION[e.action];
    if (!action) return [];
    const v = versions.get(e.subject_id);
    if (e.subject_type === "creative_version" && !v) return [];
    const of = v ? `${v.creative.title}, version ${v.number}` : "";
    const detail: Record<RecordEvent["action"], string> = {
      brief_approved: `Sent the brief, version ${text(e.detail.version) || "1"}`,
      made: `Made ${of}`,
      checked: `Checked ${of}`,
      correction: `Asked for a correction to ${of}`,
      held: `Held ${of}`,
      approved: `Approved ${of}`,
      changes_requested: `Asked for changes to ${of}`,
      delivered: "Made the delivery",
      confirmed_live: "Confirmed it is live",
      direction_chosen: "",
      brand_dna_approved: "",
    };
    return [
      {
        id: String(e.id),
        workspaceId: e.workspace_id,
        campaignId: campaign.id,
        subjectId: e.subject_id,
        actor: e.actor ? { kind: "person", userId: e.actor } : { kind: "fume" },
        action,
        detail: detail[action],
        at: e.at,
      } satisfies RecordEvent,
    ];
  });
}

// ─── The calls ───────────────────────────────────────────────────────────────

/** No one named yet: the page still has a person to show. */
const NOBODY: User = { id: "", name: "No approver yet", title: "", email: "" };

export function campaignCalls(live: Live): Pick<FumeApi, Calls> {
  const campaignOf = async (id: Id) => {
    const found = (await readCampaigns({ ids: [id] }))[0];
    if (!found) throw new FumeError("not_found", "No such campaign.");
    return found;
  };

  const calls: Pick<FumeApi, Calls> = {
    async campaigns(filter) {
      let list = await readCampaigns({ workspaceId: await live.workspaceId() });
      if (filter?.state?.length) list = list.filter((c) => filter.state!.includes(c.state));
      if (filter?.search) list = list.filter((c) => c.name.toLowerCase().includes(filter.search!.toLowerCase()));
      return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async campaign(id) {
      const [campaign, brief, creatives, people] = await Promise.all([
        campaignOf(id),
        readBrief(id),
        readCreatives({ campaignIds: [id] }),
        live.people(),
      ]);
      const [record, members] = await Promise.all([
        readRecord(campaign, creatives),
        rows<{ user_id: string }>(
          supabase().from("memberships").select("user_id").eq("workspace_id", campaign.workspaceId),
        ),
      ]);
      return {
        campaign,
        brief,
        // Directions, runs and the service clock are not in the database yet: the plan holds the direction.
        directions: [],
        creatives,
        runs: [],
        record,
        approver: people.get(campaign.approverId) ?? NOBODY,
        people: members.flatMap((m) => people.get(m.user_id) ?? []),
        // The conversation is not live yet; its threads are the empty workspace's.
        threadId: "t-general",
      } satisfies CampaignView;
    },

    async setApprover(campaignId, userId) {
      await command("set_campaign_approver", { p_campaign_id: campaignId, p_user_id: userId, p_key: requestKey() });
      return campaignOf(campaignId);
    },

    // The form's brief: the campaign, then every line of the brief as its draft. Sending it is the next call
    // (NewBriefPage sends right after, for someone who may). Collections and a moodboard started on the form are not
    // in the database yet.
    async orderBrief(order: BriefOrder) {
      const ws = await live.workspaceId();
      const workspace = (await live.workspaces()).find((w) => w.id === ws);
      const created = await command<CampaignRow>("create_campaign", {
        p_workspace_id: ws,
        p_name: order.name.trim() || "New campaign",
        p_product_ids: order.productIds,
        p_key: requestKey(),
      });
      const creatives = order.creatives && order.creatives > 0 ? Math.round(order.creatives) : order.formats.length * 4;
      await command("save_brief_draft", {
        p_campaign_id: created.id,
        p_change: {
          objective: order.goal.trim(),
          audience: order.audience?.trim() ?? "",
          message: order.message?.trim() ?? "",
          mandatory: order.mandatory ?? [],
          never: order.never ?? [],
          channels: order.channels,
          formats: order.formats,
          creatives,
          references: lasting(order.references),
          market: order.market ?? workspace?.market ?? "",
          language: order.language ?? workspace?.language ?? "en",
          ...(order.deadline ? { due_at: order.deadline } : {}),
          ...(order.notes.trim() ? { notes: order.notes.trim() } : {}),
        },
        p_key: requestKey(),
      });
      return campaignOf(created.id);
    },

    // She sends the draft: brief version n, and Fume's plan from it (send_brief writes it, or leaves it for Fume to
    // write with the language model when that is on).
    async sendBrief(campaignId) {
      await command("send_brief", { p_campaign_id: campaignId, p_body: null, p_key: requestKey() });
      askFumeToWrite(campaignId, true);
      return readBrief(campaignId);
    },
    async approveBrief(campaignId) {
      return calls.sendBrief(campaignId);
    },

    // A line changed is a change to the draft; after sending, the draft is the next version, sent again with
    // sendBrief (the plan page says so).
    async changeBrief(campaignId, change) {
      const changed: Record<string, unknown> = {};
      for (const key of BRIEF_LINES) if (change[key] !== undefined) changed[key] = change[key];
      if (changed.references) changed.references = lasting(changed.references as string[]);
      if (Object.keys(changed).length)
        await command("save_brief_draft", { p_campaign_id: campaignId, p_change: changed, p_key: requestKey() });
      return readBrief(campaignId);
    },
  };
  return calls;
}
