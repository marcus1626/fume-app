// The creatives Maja marked "Needs changes" on one review set (UX review 19 Oct, TASK-5; round 13, Marcus #33, #34):
// a mark says the creative needs changes, and its open comments are the change list (comments post at once, so
// nothing she wrote waits here). "Start the changes" sends every marked creative of the campaign as ONE change
// request. It lives in the tab's sessionStorage per campaign, so the viewer, Swipe through, the review pages and the
// campaign page all see the same marks, and a reload or a trip elsewhere does not lose them. A creative that no
// longer waits on her (approved, or already being remade) drops out when it is read.
// Round 13 (PROPOSED 21 Oct 2026): the store keeps its old name and shape (ChangeTray, ChangeDraft) so the old call
// sites still work; `text` and `pins` are no longer written (the comments are read when the changes start), and
// useMarksAcross reads the marks of several campaigns at once (the Review place, across campaigns).
import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { ChangeTag, Creative, Format, Id, Pin } from "../../contract";

export interface ChangeDraft {
  creativeId: Id;
  /** The version she marked; a newer version drops the mark. */
  versionId: Id;
  title: string;
  image: string;
  format: Format;
  /** "product": the product itself is off (Fume's own mistake, no change request used). */
  tags: ChangeTag[];
  /** Before round 13: what should change, in her words. Now the creative's open comments say it. */
  text?: string;
  /** Before round 13: the spots she marked. Now the comments' pins. */
  pins?: Pin[];
}

const PREFIX = "fume.changes.";
const KEY = (campaignId: Id) => `${PREFIX}${campaignId}`;
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; list: ChangeDraft[] }>();

function read(campaignId: Id): ChangeDraft[] {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(KEY(campaignId));
  } catch {
    /* private mode: the list lives as long as the page */
  }
  const hit = cache.get(campaignId);
  if (hit && hit.raw === raw) return hit.list;
  let list: ChangeDraft[] = [];
  try {
    list = raw ? (JSON.parse(raw) as ChangeDraft[]) : (hit?.list ?? []);
  } catch {
    list = [];
  }
  cache.set(campaignId, { raw, list });
  return list;
}

function write(campaignId: Id, list: ChangeDraft[]) {
  const raw = list.length ? JSON.stringify(list) : null;
  let stored: string | null = null;
  try {
    if (raw) sessionStorage.setItem(KEY(campaignId), raw);
    else sessionStorage.removeItem(KEY(campaignId));
    stored = sessionStorage.getItem(KEY(campaignId));
  } catch {
    /* no storage: the list is kept in memory, in the cache */
  }
  cache.set(campaignId, { raw: stored, list });
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** True when the mark still applies: the creative waits on her, at the version she marked. */
const applies = (d: ChangeDraft, c: Creative | undefined) =>
  Boolean(c && c.current.id === d.versionId && c.current.state === "checked");

export interface ChangeTray {
  /** The marks that still apply: each creative still waits on her, at the version she marked. */
  items: ChangeDraft[];
  has: (creativeId: Id) => boolean;
  get: (creativeId: Id) => ChangeDraft | undefined;
  /** Marks the creative, or replaces its mark (the product tick). */
  put: (draft: ChangeDraft) => void;
  remove: (creativeId: Id) => void;
  clear: () => void;
}

/**
 * The marks of one campaign. Pass the campaign's creatives (as the customer sees them) to drop marks that no
 * longer apply; leave them out while they load.
 */
export function useChangeTray(campaignId: Id | undefined, creatives?: Creative[]): ChangeTray {
  const all = useSyncExternalStore(
    subscribe,
    () => (campaignId ? read(campaignId) : EMPTY),
    () => EMPTY,
  );
  const items = useMemo(() => {
    if (!creatives) return all;
    const byId = new Map(creatives.map((c) => [c.id, c]));
    return all.filter((d) => applies(d, byId.get(d.creativeId)));
  }, [all, creatives]);

  const put = useCallback(
    (draft: ChangeDraft) => {
      if (!campaignId) return;
      const list = read(campaignId).filter((d) => d.creativeId !== draft.creativeId);
      write(campaignId, [...list, draft]);
    },
    [campaignId],
  );
  const remove = useCallback(
    (creativeId: Id) => {
      if (!campaignId) return;
      write(
        campaignId,
        read(campaignId).filter((d) => d.creativeId !== creativeId),
      );
    },
    [campaignId],
  );
  const clear = useCallback(() => campaignId && write(campaignId, []), [campaignId]);

  return {
    items,
    has: (id) => items.some((d) => d.creativeId === id),
    get: (id) => items.find((d) => d.creativeId === id),
    put,
    remove,
    clear,
  };
}

/** The marks of several campaigns, as "creativeId:versionId" (the Review place's selection leaves them out). */
export function useMarksAcross(campaignIds: Id[]): Set<string> {
  const key = campaignIds.join("|");
  const snapshot = useSyncExternalStore(
    subscribe,
    () =>
      key
        .split("|")
        .filter(Boolean)
        .flatMap((id) => read(id).map((d) => `${d.creativeId}:${d.versionId}`))
        .join(","),
    () => "",
  );
  return useMemo(() => new Set(snapshot ? snapshot.split(",") : []), [snapshot]);
}

/** Whether a creative is marked, by the set useMarksAcross gives. */
export const isMarked = (marks: Set<string>, c: Creative) =>
  c.current.state === "checked" && marks.has(`${c.id}:${c.current.id}`);

const EMPTY: ChangeDraft[] = [];
