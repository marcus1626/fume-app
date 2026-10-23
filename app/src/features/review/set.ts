// The review set of one campaign (FLOWS §11): the creatives that waited for the customer when the viewer or swipe mode
// opened. It is kept for as long as the screen is open, so a creative you approve or ask changes on stays in the row
// and the arrows keep their order; one that leaves the campaign's view (being remade) drops out. useReviewSetAcross
// does the same for several campaigns at once (the Review place), in the order the campaigns are given.
import { useEffect, useMemo, useState } from "react";
import { useCampaign, useCampaignViews } from "../../api/hooks";
import type { Creative, Id } from "../../contract";

export function useReviewSet(campaignId: Id | undefined) {
  const campaign = useCampaign(campaignId);
  const [ids, setIds] = useState<Id[] | null>(null);
  const all = campaign.data?.creatives;

  useEffect(() => {
    if (ids || !all) return;
    setIds(all.filter((c) => c.current.state === "checked").map((c) => c.id));
  }, [all, ids]);

  const list = useMemo(() => {
    const byId = new Map((all ?? []).map((c) => [c.id, c]));
    return (ids ?? []).map((id) => byId.get(id)).filter((c): c is Creative => Boolean(c));
  }, [all, ids]);

  return { campaign, list, all: all ?? [], ready: Boolean(ids && all) };
}

/** The review set across campaigns: what waited in each, kept while the viewer is open; `all` is every creative. */
export function useReviewSetAcross(campaignIds: Id[]) {
  const views = useCampaignViews(campaignIds);
  const [ids, setIds] = useState<Id[] | null>(null);
  const all = useMemo(() => (views.data ?? []).flatMap((v) => v.creatives), [views.data]);
  const loaded = Boolean(views.data);

  useEffect(() => {
    if (ids || !loaded) return;
    setIds(all.filter((c) => c.current.state === "checked").map((c) => c.id));
  }, [all, ids, loaded]);

  const list = useMemo(() => {
    const byId = new Map(all.map((c) => [c.id, c]));
    return (ids ?? []).map((id) => byId.get(id)).filter((c): c is Creative => Boolean(c));
  }, [all, ids]);

  return { views: views.data ?? [], list, all, ready: Boolean(ids && loaded) };
}
