// The mock backend's round 8 calls for REVIEW (PROPOSED 19 Oct 2026, UX review TASK-4, TASK-5, MOB-10).
// unapprove() is the toast's Undo after Approve: the versions are checked and waiting again, and the campaign's
// counts and state go back with them. requestChangeRound() sends a review set's collected change requests as ONE:
// every creative in it is remade, and the campaign uses one change request (none when each item is Fume's own
// mistake, tagged "product"). Both reuse the mock's own helpers (setVersion, recount), passed in from createMockApi.

import { FumeError, type Campaign, type Creative, type CreativeVersion, type FumeApi, type Id, type RecordEvent } from "../contract";

interface Db {
  creatives: Creative[];
  record: RecordEvent[];
}

export interface R8ReviewContext {
  db: Db;
  wait: <T>(value: T) => Promise<T>;
  now: () => string;
  nextId: (prefix: string) => string;
  userId: () => Id;
  workspaceId: () => Id;
  mustApprove: () => void;
  campaignOf: (id: Id) => Campaign;
  setVersion: (creative: Creative, change: Partial<CreativeVersion>) => void;
  recount: (campaign: Campaign) => void;
}

export function r8ReviewApi(ctx: R8ReviewContext): Pick<FumeApi, "unapprove" | "requestChangeRound"> {
  const { db, wait, now, nextId, campaignOf, setVersion, recount } = ctx;
  const creativeOf = (versionId: Id) => {
    const c = db.creatives.find((x) => x.current.id === versionId);
    if (!c) throw new FumeError("not_found", `No version ${versionId}`);
    return c;
  };

  return {
    async unapprove(versionIds) {
      ctx.mustApprove();
      const back: CreativeVersion[] = [];
      const touched = new Set<Id>();
      for (const vid of versionIds) {
        const c = creativeOf(vid);
        // Only an approval that has not moved on (into a delivery) can be taken back.
        if (c.current.state !== "approved") throw new FumeError("conflict", "Only an approved creative that is not delivered can go back.");
        setVersion(c, { state: "checked", approvedBy: undefined, approvedAt: undefined });
        back.push(c.current);
        touched.add(c.campaignId);
      }
      for (const id of touched) {
        const campaign = campaignOf(id);
        if (campaign.state === "approved") campaign.state = "in_review";
        recount(campaign);
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

    async requestChangeRound({ campaignId, items }) {
      if (items.length === 0) throw new FumeError("invalid", "Say what should change on at least one creative.");
      const campaign = campaignOf(campaignId);
      const list = items.map((item) => ({ item, creative: creativeOf(item.versionId) }));
      if (list.some(({ creative }) => creative.campaignId !== campaignId)) throw new FumeError("invalid", "Every creative in one change request is from the same campaign.");
      if (list.some(({ creative }) => creative.current.state !== "checked")) throw new FumeError("conflict", "Only creatives that wait on you can be changed.");
      const correction = list.every(({ item }) => item.tags.includes("product"));
      if (!correction && campaign.roundsUsed >= campaign.roundsIncluded)
        throw new FumeError("conflict", "The change requests in your package are used for this campaign. Ask Fume what one more takes.");
      if (!correction) campaign.roundsUsed += 1;
      const versions: CreativeVersion[] = [];
      for (const { item, creative } of list) {
        setVersion(creative, { state: "changes_requested" });
        const next: CreativeVersion = { ...creative.current, id: nextId("v"), number: creative.current.number + 1, state: "making", madeAt: now(), checkedAt: undefined, checkedBy: undefined };
        creative.versions.push(next);
        creative.current = next;
        versions.push(next);
        db.record.push({
          id: nextId("e"),
          workspaceId: ctx.workspaceId(),
          campaignId,
          subjectId: creative.id,
          actor: { kind: "person", userId: ctx.userId() },
          action: "changes_requested",
          detail: `${item.text}${item.pins.length ? ` (${item.pins.length} ${item.pins.length === 1 ? "pin" : "pins"})` : ""}`,
          at: now(),
        });
      }
      campaign.state = "revision";
      recount(campaign);
      return wait({ versions, usesRound: !correction, roundsLeft: campaign.roundsIncluded - campaign.roundsUsed });
    },
  };
}
