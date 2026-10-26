// The customer's review on the live backend: the creatives she may see, what waits on her, her approvals (with Undo),
// one change request per review set (with Undo), and comments with pins and replies. Row-level security decides what
// comes back: a customer reads a version only once it is checked and sent, so nothing here filters for her; the
// commands check who may decide (owner and approver approve; a member comments and asks for changes; a viewer looks).
import {
  FumeError,
  type ChangeTag,
  type CreativeVersion,
  type FumeApi,
  type Id,
  type ReviewComment,
  type ReviewItem,
} from "../../contract";
import type { Live } from "./context";
import { readCampaigns, readCreatives } from "./map";
import { command, requestKey, rows, supabase } from "./supabase";

type Calls =
  | "creatives"
  | "creative"
  | "reviewQueue"
  | "approve"
  | "unapprove"
  | "requestChanges"
  | "requestChangeRound"
  | "withdrawChangeRound"
  | "reviewComments"
  | "addReviewComment"
  | "resolveReviewComment";

interface CommentRow {
  id: string;
  version_id: string;
  author: string;
  text: string;
  pin: { x?: unknown; y?: unknown } | null;
  created_at: string;
  resolved_at: string | null;
  reply_to: string | null;
}
const COMMENT = "id, version_id, author, text, pin, created_at, resolved_at, reply_to";

/**
 * The mock's rule (mock/review.ts): a change tagged "product" is Fume's own mistake, a correction that uses no round;
 * anything else is a revision. A set uses one round when any item in it is a revision, which the database decides
 * from the causes (request_change_round). The contract has no way to say "changed brief" yet.
 */
const causeOf = (tags: ChangeTag[]) => (tags.includes("product") ? "correction" : "revision");

/** Versions by id, as the contract shows them (with their check, approval and picture), in the order asked. */
async function readVersions(ids: Id[]): Promise<CreativeVersion[]> {
  if (ids.length === 0) return [];
  const found = await rows<{ id: string; creative_id: string }>(
    supabase().from("creative_versions").select("id, creative_id").in("id", ids),
  );
  const creatives = await readCreatives({ creativeIds: [...new Set(found.map((v) => v.creative_id))] });
  const byId = new Map(creatives.flatMap((c) => c.versions).map((v) => [v.id, v]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

function toComments(list: CommentRow[], creativeId: Id): ReviewComment[] {
  const pinOf = (p: CommentRow["pin"]) =>
    p && typeof p.x === "number" && typeof p.y === "number" ? { pin: { x: p.x, y: p.y } } : {};
  return list
    .filter((c) => !c.reply_to)
    .map((c) => ({
      id: c.id,
      creativeId,
      versionId: c.version_id,
      by: c.author,
      text: c.text,
      ...pinOf(c.pin),
      at: c.created_at,
      ...(c.resolved_at ? { resolved: true } : {}),
      replies: list
        .filter((r) => r.reply_to === c.id)
        .map((r) => ({ id: r.id, by: r.author, text: r.text, at: r.created_at })),
    }));
}

async function readComments(creativeId: Id): Promise<ReviewComment[]> {
  const versions = await rows<{ id: string }>(
    supabase().from("creative_versions").select("id").eq("creative_id", creativeId),
  );
  if (versions.length === 0) return [];
  const list = await rows<CommentRow>(
    supabase()
      .from("comments")
      .select(COMMENT)
      .in(
        "version_id",
        versions.map((v) => v.id),
      )
      .order("created_at"),
  );
  return toComments(list, creativeId);
}

async function creativeOfVersion(versionId: Id): Promise<Id> {
  const found = await rows<{ creative_id: string }>(
    supabase().from("creative_versions").select("creative_id").eq("id", versionId),
  );
  const id = found[0]?.creative_id;
  if (!id) throw new FumeError("not_found", "No such creative version.");
  return id;
}

export function reviewCalls(live: Live): Pick<FumeApi, Calls> {
  const calls: Pick<FumeApi, Calls> = {
    async creatives(campaignId, filter) {
      let list = await readCreatives({ campaignIds: [campaignId] });
      if (filter?.state?.length) list = list.filter((c) => filter.state!.includes(c.current.state));
      if (filter?.format?.length) list = list.filter((c) => filter.format!.includes(c.format));
      if (filter?.directionId) list = list.filter((c) => c.directionId === filter.directionId);
      if (filter?.kind) list = list.filter((c) => c.kind === filter.kind);
      return list;
    },

    async creative(creativeId) {
      const [creative] = await readCreatives({ creativeIds: [creativeId] });
      if (!creative) throw new FumeError("not_found", "No such creative.");
      const [[campaign], inCampaign] = await Promise.all([
        readCampaigns({ ids: [creative.campaignId] }),
        rows<{ id: string }>(
          supabase().from("creatives").select("id").eq("campaign_id", creative.campaignId).order("created_at"),
        ),
      ]);
      if (!campaign) throw new FumeError("not_found", "No such campaign.");
      // Siblings are the creatives the caller can see a version of (a customer: checked and sent).
      const seen = await rows<{ creative_id: string }>(
        supabase()
          .from("creative_versions")
          .select("creative_id")
          .in(
            "creative_id",
            inCampaign.map((c) => c.id),
          ),
      );
      const visible = new Set(seen.map((v) => v.creative_id));
      return { creative, campaign, siblings: inCampaign.filter((c) => visible.has(c.id)).map((c) => c.id) };
    },

    // What waits on the customer: per campaign of the open workspace, the creatives whose current version is checked
    // and sent. Briefs and directions are not in the database yet, so they never wait here.
    async reviewQueue() {
      const campaigns = await readCampaigns({ workspaceId: await live.workspaceId() });
      if (campaigns.length === 0) return [];
      const creatives = await readCreatives({ campaignIds: campaigns.map((c) => c.id) });
      const checked = creatives.filter((c) => c.current.state === "checked");
      const sent = checked.length
        ? await rows<{ id: string }>(
            supabase()
              .from("creative_versions")
              .select("id")
              .in(
                "id",
                checked.map((c) => c.current.id),
              )
              .not("sent_at", "is", null),
          )
        : [];
      const waiting = new Set(sent.map((v) => v.id));
      const items: ReviewItem[] = [];
      for (const campaign of campaigns) {
        const mine = checked.filter((c) => c.campaignId === campaign.id && waiting.has(c.current.id));
        if (mine.length)
          items.push({
            campaign,
            kind: "creatives",
            creatives: mine,
            directions: [],
            ...(campaign.dueAt ? { dueAt: campaign.dueAt } : {}),
          });
      }
      return items;
    },

    async approve(versionIds) {
      await command("approve_versions", { p_version_ids: versionIds, p_key: requestKey() });
      return readVersions(versionIds);
    },

    async unapprove(versionIds) {
      await command("undo_approvals", { p_version_ids: versionIds });
      return readVersions(versionIds);
    },

    // One creative's change request is a set of one. The version answered is the one asked on, now waiting for Fume
    // (changes_requested); the new version appears once Fume makes it and the expert checks it.
    async requestChanges({ versionId, pins, tags, text }) {
      const creativeId = await creativeOfVersion(versionId);
      const campaign = await rows<{ campaign_id: string }>(
        supabase().from("creatives").select("campaign_id").eq("id", creativeId),
      );
      if (!campaign[0]) throw new FumeError("not_found", "No such creative version.");
      const r = await calls.requestChangeRound({
        campaignId: campaign[0].campaign_id,
        items: [{ versionId, pins, tags, text }],
      });
      return { version: r.versions[0]!, usesRound: r.usesRound, roundsLeft: r.roundsLeft };
    },

    async requestChangeRound({ campaignId, items }) {
      if (items.length === 0) throw new FumeError("invalid", "Say what should change on at least one creative.");
      const r = await command<{ uses_round: boolean; rounds_left: number }>("request_change_round", {
        p_campaign_id: campaignId,
        p_items: items.map((i) => ({
          version_id: i.versionId,
          cause: causeOf(i.tags),
          problem: i.text,
          must_change: i.tags,
          pins: i.pins,
        })),
        p_key: requestKey(),
      });
      return {
        versions: await readVersions(items.map((i) => i.versionId)),
        usesRound: r.uses_round,
        roundsLeft: r.rounds_left,
      };
    },

    // The database decides whether the round comes back (usedRound is the screen's memory, not a fact).
    async withdrawChangeRound({ campaignId, versionIds }) {
      await command("withdraw_change_round", {
        p_campaign_id: campaignId,
        p_version_ids: versionIds,
        p_key: requestKey(),
      });
      return readVersions(versionIds);
    },

    reviewComments: readComments,

    async addReviewComment({ creativeId, versionId, text, pin, replyTo }) {
      if (replyTo) {
        await command("reply_comment", { p_comment_id: replyTo, p_text: text });
        const parent = (await readComments(creativeId)).find((c) => c.id === replyTo);
        if (!parent) throw new FumeError("not_found", "No such comment.");
        return parent;
      }
      const row = await command<CommentRow>("add_comment", {
        p_version_id: versionId,
        p_text: text,
        p_pin: pin ? { x: pin.x, y: pin.y } : null,
      });
      return toComments([row], creativeId)[0]!;
    },

    async resolveReviewComment(commentId) {
      const row = await command<CommentRow>("resolve_comment", { p_comment_id: commentId });
      const creativeId = await creativeOfVersion(row.version_id);
      const found = (await readComments(creativeId)).find((c) => c.id === commentId);
      return found ?? toComments([row], creativeId)[0]!;
    },
  };

  return calls;
}
