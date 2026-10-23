// The customer's name for a creative: what it shows, where it runs and which one it is, "Night Body Oil · Feed 2",
// never "Master 1 · Variant 1" and never the file name. The product is the campaign's when it has one; with several,
// the campaign's name. Review, the viewer, Swipe through, the toasts, the change request, the delivery and the calendar
// all name a creative through here, so she approves and downloads the same name. useCreativeLabels(campaign) gives the
// short label alone ("Feed 2") for a tile's caption or a calendar chip; useCustomerNames puts it in the title.
import { useCallback, useMemo } from "react";
import { useCampaign, useCampaignViews, useCatalogue } from "../../api/hooks";
import type { Campaign, Creative, Direction, Format, Id, Product } from "../../contract";
import * as copy from "../../copy";

/** What the campaign's creatives show: its one product, or the campaign itself. */
export function campaignSubject(
  campaign: Pick<Campaign, "name" | "productIds"> | undefined,
  products: Product[] | undefined,
): string | undefined {
  if (!campaign) return undefined;
  const only = campaign.productIds.length === 1 ? products?.find((p) => p.id === campaign.productIds[0]) : undefined;
  return only?.name ?? campaign.name;
}

/** "Night Body Oil · Feed" (or "Night Body Oil · Feed 2" with the creative's label in place of the format). The one
 *  name is copy.creativeName; this keeps the older call sites on it. */
export const customerName = (subject: string, format: Format, label?: string) =>
  label
    ? copy.creativeName({ title: label, format, productName: subject })
    : `${subject} · ${copy.format[format].label}`;

/**
 * Every creative's short label in one campaign: "Feed 1", "Feed 2", "Story 1" (no direction letter; the number counts
 * the campaign's creatives in that format, in the order the Engine made them). A creative whose title is already its
 * label ("Feed 3", the backend's name) keeps it. Pass the campaign's creatives in the order the Engine made them (the
 * campaign view's order); `directions` is not read.
 */
export function creativeLabels(
  creatives: (Pick<Creative, "id" | "directionId" | "format"> & { title?: string })[],
  _directions?: Pick<Direction, "id" | "letter">[],
): Map<Id, string> {
  const seen = new Map<string, number>();
  const out = new Map<Id, string>();
  for (const c of creatives) {
    const n = (seen.get(c.format) ?? 0) + 1;
    seen.set(c.format, n);
    const own =
      c.title && /^(Feed|Square|Story) [A-Z]?\d+$/.test(c.title.trim())
        ? copy.creativeLabel({ title: c.title, format: c.format })
        : undefined;
    out.set(c.id, own ?? `${copy.format[c.format].label} ${n}`);
  }
  return out;
}

/** The label of one creative ("Feed 2"); the format's word alone until the campaign has loaded. */
export function useCreativeLabels(campaign: Pick<Campaign, "id"> | undefined) {
  const view = useCampaign(campaign?.id);
  const labels = useMemo(
    () => (view.data ? creativeLabels(view.data.creatives, view.data.directions) : undefined),
    [view.data],
  );
  return useCallback(
    (c: Pick<Creative, "id" | "format">) => labels?.get(c.id) ?? copy.format[c.format].label,
    [labels],
  );
}

/** A creative with its customer name as its title: "Night Body Oil · Feed 2". */
export function useCustomerNames(campaign: Campaign | undefined) {
  const catalogue = useCatalogue();
  const what = campaignSubject(campaign, catalogue.data?.products);
  const label = useCreativeLabels(campaign);
  return useCallback(
    (c: Creative): Creative => (what ? { ...c, title: customerName(what, c.format, label(c)) } : c),
    [what, label],
  );
}

/** The same, for creatives from several campaigns (a collection's approved work). */
export function useCustomerNamesAcross(campaigns: Campaign[] | undefined) {
  const catalogue = useCatalogue();
  const products = catalogue.data?.products;
  const views = useCampaignViews((campaigns ?? []).map((k) => k.id));
  const labels = useMemo(() => {
    const all = new Map<Id, string>();
    for (const v of views.data ?? []) for (const [id, l] of creativeLabels(v.creatives, v.directions)) all.set(id, l);
    return all;
  }, [views.data]);
  return useCallback(
    (c: Creative): Creative => {
      const what = campaignSubject(
        campaigns?.find((k) => k.id === c.campaignId),
        products,
      );
      return what ? { ...c, title: customerName(what, c.format, labels.get(c.id)) } : c;
    },
    [campaigns, products, labels],
  );
}

/** The line under that name: the shape, and the version once there is more than one. */
export const shapeLine = (c: Creative) =>
  `${copy.format[c.format].ratio}${c.current.number > 1 ? ` · version ${c.current.number}` : ""}`;

/** The short label back out of a customer name ("Night Body Oil · Feed 2" → "Feed 2"), for a caption. */
export const labelOf = (c: Pick<Creative, "title" | "format">) => {
  const parts = c.title.split(" · ");
  return parts.length > 1 ? parts[parts.length - 1]! : copy.format[c.format].label;
};
