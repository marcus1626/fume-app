// The mock backend's round 9 call for VIEWER (PROPOSED 19 Oct 2026, UX review DTSK-15): "Send it" sends a review set's
// change request at once, and the toast's Undo takes it back while Fume has not started. withdrawChangeRound() undoes
// what requestChangeRound() did (r8-review.ts): each new version that is still being made is dropped, the creative
// waits on the customer again at the version she asked changes on, the change request is not used, and the record
// forgets it. Reuses the mock's own helpers (setVersion, recount), passed in from createMockApi.

import {
  FumeError,
  type Campaign,
  type Creative,
  type CreativeVersion,
  type FumeApi,
  type Id,
  type RecordEvent,
} from "../contract";

interface Db {
  creatives: Creative[];
  record: RecordEvent[];
}

export interface R9ReviewContext {
  db: Db;
  wait: <T>(value: T) => Promise<T>;
  campaignOf: (id: Id) => Campaign;
  setVersion: (creative: Creative, change: Partial<CreativeVersion>) => void;
  recount: (campaign: Campaign) => void;
}

export function r9ReviewApi(ctx: R9ReviewContext): Pick<FumeApi, "withdrawChangeRound"> {
  const { db, wait, campaignOf, setVersion, recount } = ctx;
  return {
    async withdrawChangeRound({ campaignId, versionIds, usedRound }) {
      const campaign = campaignOf(campaignId);
      const list = versionIds.map((vid) => {
        const c = db.creatives.find((x) => x.current.id === vid);
        if (!c || c.campaignId !== campaignId)
          throw new FumeError("not_found", `No new version ${vid} in this campaign`);
        // Only a version Fume has not started on can be taken back.
        if (c.current.state !== "making" || c.versions.length < 2)
          throw new FumeError("conflict", "Fume has started on these changes already.");
        return c;
      });
      const back: CreativeVersion[] = [];
      for (const c of list) {
        c.versions.pop();
        c.current = c.versions[c.versions.length - 1]!;
        setVersion(c, { state: "checked" });
        back.push(c.current);
        // The change request leaves the record with it: nothing was asked after all.
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
      recount(campaign);
      return wait(back);
    },
  };
}
