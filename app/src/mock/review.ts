// The customer's review: the checked creatives she approves or asks changes on (with Undo), one change request per
// review set, comments pinned on a creative, and her stars.
import { FumeError, type CreativeVersion, type FumeApi, type Id, type ReviewItem } from "../contract";
import type { Mock } from "./context";

type Calls =
  | "creatives"
  | "creative"
  | "reviewQueue"
  | "approve"
  | "requestChanges"
  | "unapprove"
  | "requestChangeRound"
  | "withdrawChangeRound"
  | "reviewComments"
  | "addReviewComment"
  | "resolveReviewComment"
  | "rate"
  | "ratings";

export function reviewCalls(m: Mock): Pick<FumeApi, Calls> {
  const { db, wait } = m;
  const creativeOf = (versionId: Id) => {
    const c = db.creatives.find((x) => x.current.id === versionId);
    if (!c) throw new FumeError("not_found", `No version ${versionId}`);
    return c;
  };

  return {
    async creatives(campaignId, filter) {
      let list = db.creatives.filter((c) => c.campaignId === campaignId && m.visible(c));
      if (filter?.state?.length) list = list.filter((c) => filter.state!.includes(c.current.state));
      if (filter?.format?.length) list = list.filter((c) => filter.format!.includes(c.format));
      if (filter?.directionId) list = list.filter((c) => c.directionId === filter.directionId);
      if (filter?.kind) list = list.filter((c) => c.kind === filter.kind);
      return wait(list);
    },
    async creative(id) {
      const creative = m.find(db.creatives, id, "creative");
      if (!m.visible(creative)) throw new FumeError("not_found", "No such creative");
      return wait({
        creative,
        campaign: m.campaignOf(creative.campaignId),
        siblings: db.creatives.filter((c) => c.campaignId === creative.campaignId && m.visible(c)).map((c) => c.id),
      });
    },
    async reviewQueue() {
      const items: ReviewItem[] = [];
      for (const campaign of m.myCampaigns()) {
        const directions = db.directions.filter((d) => d.campaignId === campaign.id && d.state === "proposed");
        const creatives = db.creatives.filter(
          (c) => c.campaignId === campaign.id && c.current.state === "checked" && m.visible(c),
        );
        if (directions.length)
          items.push({ campaign, kind: "directions", directions, creatives: [], dueAt: campaign.dueAt });
        if (creatives.length)
          items.push({ campaign, kind: "creatives", directions: [], creatives, dueAt: campaign.dueAt });
        if (db.briefs.find((b) => b.campaignId === campaign.id)?.state === "ready")
          items.push({ campaign, kind: "brief", directions: [], creatives: [] });
      }
      return wait(items);
    },
    // Approving a creative is the client's word (FLOWS §24.2): the agency sends it, or records an approval given
    // outside Fume.
    async approve(versionIds) {
      if (db.users.find((u) => u.id === m.userId)?.agency)
        throw new FumeError(
          "forbidden",
          "Only the client approves creatives. Send them to the client, or record an approval the client gave you.",
        );
      m.mustApprove();
      const done: CreativeVersion[] = [];
      for (const vid of versionIds) {
        const c = db.creatives.find((x) => x.current.id === vid);
        if (!c) throw new FumeError("not_found", `No version ${vid}`);
        if (c.current.state !== "checked") throw new FumeError("conflict", "Only checked creatives can be approved.");
        m.setVersion(c, { state: "approved", approvedBy: m.userId, approvedAt: m.now() });
        done.push(c.current);
      }
      const touched = new Set(versionIds.map((v) => db.creatives.find((c) => c.current.id === v)!.campaignId));
      touched.forEach((id) => m.recount(m.campaignOf(id)));
      db.record.push({
        id: m.nextId("e"),
        workspaceId: m.workspaceId,
        campaignId: [...touched][0],
        subjectId: versionIds[0],
        actor: { kind: "person", userId: m.userId },
        action: "approved",
        detail: `${versionIds.length} creatives approved`,
        at: m.now(),
      });
      return wait(done);
    },
    // A change request uses one of the campaign's rounds; a correction of Fume's own mistake (tagged "product") uses
    // none.
    async requestChanges({ versionId, pins, tags, text }) {
      const c = db.creatives.find((x) => x.current.id === versionId);
      if (!c) throw new FumeError("not_found", "No such creative");
      const campaign = m.campaignOf(c.campaignId);
      const isCorrection = tags.includes("product");
      if (!isCorrection && campaign.roundsUsed >= campaign.roundsIncluded)
        throw new FumeError(
          "conflict",
          "The rounds in your package are used for this campaign. Ask Fume for an extra round.",
        );
      if (!isCorrection) campaign.roundsUsed += 1;
      m.setVersion(c, { state: "changes_requested" });
      const next: CreativeVersion = {
        ...c.current,
        id: m.nextId("v"),
        number: c.current.number + 1,
        state: "making",
        madeAt: m.now(),
        checkedAt: undefined,
        checkedBy: undefined,
      };
      c.versions.push(next);
      c.current = next;
      campaign.state = "revision";
      m.recount(campaign);
      db.record.push({
        id: m.nextId("e"),
        workspaceId: m.workspaceId,
        campaignId: campaign.id,
        subjectId: c.id,
        actor: { kind: "person", userId: m.userId },
        action: "changes_requested",
        detail: `${text}${pins.length ? ` (${pins.length} pins)` : ""}`,
        at: m.now(),
      });
      return wait({
        version: next,
        usesRound: !isCorrection,
        roundsLeft: campaign.roundsIncluded - campaign.roundsUsed,
      });
    },
    // The toast's Undo after Approve: the versions are checked and waiting again, and the campaign's counts and state
    // go back with them. Only an approval that has not moved on (into a delivery) can be taken back.
    async unapprove(versionIds) {
      m.mustApprove();
      const back: CreativeVersion[] = [];
      const touched = new Set<Id>();
      for (const vid of versionIds) {
        const c = creativeOf(vid);
        if (c.current.state !== "approved")
          throw new FumeError("conflict", "Only an approved creative that is not delivered can go back.");
        m.setVersion(c, { state: "checked", approvedBy: undefined, approvedAt: undefined });
        back.push(c.current);
        touched.add(c.campaignId);
      }
      for (const id of touched) {
        const campaign = m.campaignOf(id);
        if (campaign.state === "approved") campaign.state = "in_review";
        m.recount(campaign);
      }
      // The approval leaves the record with it: nothing was decided after all.
      const undone = new Set(versionIds);
      for (let i = db.record.length - 1; i >= 0; i -= 1) {
        const e = db.record[i]!;
        if (e.action === "approved" && undone.has(e.subjectId)) {
          db.record.splice(i, 1);
          break;
        }
      }
      return wait(back);
    },
    // A review set's collected change requests go as ONE: every creative in it is remade, and the campaign uses one
    // change request (none when each item is Fume's own mistake, tagged "product").
    async requestChangeRound({ campaignId, items }) {
      if (items.length === 0) throw new FumeError("invalid", "Say what should change on at least one creative.");
      const campaign = m.campaignOf(campaignId);
      const list = items.map((item) => ({ item, creative: creativeOf(item.versionId) }));
      if (list.some(({ creative }) => creative.campaignId !== campaignId))
        throw new FumeError("invalid", "Every creative in one change request is from the same campaign.");
      if (list.some(({ creative }) => creative.current.state !== "checked"))
        throw new FumeError("conflict", "Only creatives that wait on you can be changed.");
      const correction = list.every(({ item }) => item.tags.includes("product"));
      if (!correction && campaign.roundsUsed >= campaign.roundsIncluded)
        throw new FumeError(
          "conflict",
          "The change requests in your package are used for this campaign. Ask Fume what one more takes.",
        );
      if (!correction) campaign.roundsUsed += 1;
      const versions: CreativeVersion[] = [];
      for (const { item, creative } of list) {
        m.setVersion(creative, { state: "changes_requested" });
        const next: CreativeVersion = {
          ...creative.current,
          id: m.nextId("v"),
          number: creative.current.number + 1,
          state: "making",
          madeAt: m.now(),
          checkedAt: undefined,
          checkedBy: undefined,
        };
        creative.versions.push(next);
        creative.current = next;
        versions.push(next);
        db.record.push({
          id: m.nextId("e"),
          workspaceId: m.workspaceId,
          campaignId,
          subjectId: creative.id,
          actor: { kind: "person", userId: m.userId },
          action: "changes_requested",
          detail: `${item.text}${item.pins.length ? ` (${item.pins.length} ${item.pins.length === 1 ? "pin" : "pins"})` : ""}`,
          at: m.now(),
        });
      }
      campaign.state = "revision";
      m.recount(campaign);
      return wait({ versions, usesRound: !correction, roundsLeft: campaign.roundsIncluded - campaign.roundsUsed });
    },
    // "Send it" sends the change request at once; the toast's Undo takes it back while Fume has not started: each new
    // version still being made is dropped, the creative waits on her again, the change request is not used, and the
    // record forgets it.
    async withdrawChangeRound({ campaignId, versionIds, usedRound }) {
      const campaign = m.campaignOf(campaignId);
      const list = versionIds.map((vid) => {
        const c = db.creatives.find((x) => x.current.id === vid);
        if (!c || c.campaignId !== campaignId) throw new FumeError("not_found", `No new version ${vid} in this campaign`);
        if (c.current.state !== "making" || c.versions.length < 2)
          throw new FumeError("conflict", "Fume has started on these changes already.");
        return c;
      });
      const back: CreativeVersion[] = [];
      for (const c of list) {
        c.versions.pop();
        c.current = c.versions[c.versions.length - 1]!;
        m.setVersion(c, { state: "checked" });
        back.push(c.current);
        for (let i = db.record.length - 1; i >= 0; i -= 1) {
          const e = db.record[i]!;
          if (e.action === "changes_requested" && e.subjectId === c.id) {
            db.record.splice(i, 1);
            break;
          }
        }
      }
      if (usedRound && campaign.roundsUsed > 0) campaign.roundsUsed -= 1;
      if (
        campaign.state === "revision" &&
        !db.creatives.some((c) => c.campaignId === campaignId && c.current.state === "making")
      )
        campaign.state = "in_review";
      m.recount(campaign);
      return wait(back);
    },

    async reviewComments(creativeId) {
      return wait(
        db.reviewComments.filter((c) => c.creativeId === creativeId).sort((a, b) => a.at.localeCompare(b.at)),
      );
    },
    async addReviewComment({ creativeId, versionId, text, pin, replyTo }) {
      if (replyTo) {
        const parent = m.find(db.reviewComments, replyTo, "comment");
        parent.replies.push({ id: m.nextId("rcr"), by: m.me().id, text, at: m.now() });
        return wait(parent);
      }
      const c = { id: m.nextId("rc"), creativeId, versionId, by: m.me().id, text, pin, at: m.now(), replies: [] };
      db.reviewComments.push(c);
      return wait(c);
    },
    async resolveReviewComment(commentId) {
      const c = m.find(db.reviewComments, commentId, "comment");
      c.resolved = !c.resolved;
      return wait(c);
    },
    async rate({ creativeId, versionId, stars }) {
      const me = m.me().id;
      db.ratings = db.ratings.filter((r) => !(r.creativeId === creativeId && r.by === me));
      const r = { creativeId, versionId, by: me, stars, at: m.now() };
      db.ratings.push(r);
      return wait(r);
    },
    async ratings(campaignId) {
      const ids = new Set(db.creatives.filter((c) => c.campaignId === campaignId).map((c) => c.id));
      return wait(db.ratings.filter((r) => ids.has(r.creativeId)));
    },
  };
}
