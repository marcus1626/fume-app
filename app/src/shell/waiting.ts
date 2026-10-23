// What waits on you, counted once (UX review 15 Oct, C4; round 8: LOAD-3, MOB-16, TASK-15, ONB-8; round 9: DLOAD-4,
// DLOAD-14, DTSK-16, DLOAD-1, DLOAD-3, DLOAD-10). A "thing waiting" is a decision only the customer can make. Home shows
// them as at most five rows, ONE PER SUBJECT, each opening the one place where that work is done, one item at a time:
//   a campaign → what it waits on first: Fume's questions (the product's card when they are all about one product,
//                else the one question sheet), the brief to send, the plan to approve, the directions (a campaign
//                from before the plan), the creatives; its in-check
//                count and a delivery ready to download fold into the same row ("6 creatives to approve · 3 more in
//                check · masters ready to download")
//   a brief half made in the chat → the chat at Fume's open question ("Christmas · Hand Balm · Fume asked who it
//                should reach"); it takes the lowest row's place when there are five
//   products a campaign waits on and no campaign row asks about → the confirm queue (/check/products)
//   the Brand's finds and AI people → Brand › Confirm your brand (/brand/check)
//   a delivery of a campaign with nothing else waiting → the delivery
// Products nothing waits on are NOT a row and not counted: they are one quiet line (`quiet`), in the first-campaign
// card on the first visit, under the rows after that ("Fume found 11 products. Confirm them when you first use them,
// or now (about 6 min)."). The Home nav item carries the number of rows (the only badge in the app), and anything else
// that counts waiting work reads it here, so Home, the badge and Brand never disagree. The bell counts news, not this:
// a row's `kind` and `also` are every kind of ask it holds.
// Round 10 (FLOWS §22, PROPOSED 20 Oct 2026): a plan checked and ready is a row of its own, "The plan for Winter gifting
// is ready", "Checked by Anna. Approve it and Fume starts.", opening the plan, ordered with the decisions (before
// creatives to approve). A brief she can send says "A brief to send" and opens the Plan tab, where she sends it.
import {
  useBrandAssets,
  useBrandBoard,
  useCampaigns,
  useCatalogue,
  useDraftBriefs,
  useHome,
  usePeople,
  usePlans,
  useQuestions,
  useReviewQueue,
  useSession,
} from "../api/hooks";
import type { Campaign, Delivery, Id, OpenQuestion, WaitingItem } from "../contract";
import * as copy from "../copy";
import { firstName } from "./people";

export type WaitingKind =
  "creatives" | "directions" | "plan" | "brief" | "question" | "draft" | "products" | "brand" | "download";

export interface WaitingRow {
  id: string;
  /** What she does first in this row. */
  kind: WaitingKind;
  /** Other asks folded into the same row (a campaign's delivery ready to download), so the bell knows Home has them. */
  also?: WaitingKind[];
  /** What it is about: the campaign's name, "7 products to confirm", "Brand". */
  title: string;
  /** What she does there, in a few words: the campaign's one status sentence (copy.campaignStatus). */
  detail: string;
  /** The campaign's go-live; it shows on the title line as "live Sat, 17 Oct", so a dated row weighs more. */
  dueAt?: string;
  /** Where the work is done. A question row opens the product's card (productId) or the question sheet (questionIds). */
  href: string;
  /** Fume's questions this row answers, in one sheet, one at a time. */
  questionIds?: Id[];
  /** When every question in the row is about one product: the row opens that product's card beside Home. */
  productId?: Id;
  /** The campaign the row is about, if it is about one. */
  campaignId?: Id;
  /** Up to three pictures of what waits (the creatives, the products, the AI person). */
  pictures: string[];
  /** Decisions inside the row. */
  count: number;
}

/** Products Fume found that nothing waits on: a quiet line, never a row and never counted (DLOAD-14). */
export interface QuietProducts {
  count: number;
  /** True when a campaign row already asks about other products ("6 more products"). */
  more: boolean;
  /** "about 6 min" */
  minutes: string;
  href: string;
}

export interface Waiting {
  /** At most five rows, the soonest go-live first. */
  items: WaitingRow[];
  /** The one number: rows waiting on you. 0 while it loads. */
  count: number;
  /** No campaign yet: Home leads with "Start your first campaign" (ONB-8), and the AI people wait to be introduced. */
  firstRun: boolean;
  /** Products to confirm that nothing waits on (not in `items`, not in `count`). */
  quiet?: QuietProducts;
  /** The campaigns with a row, so "Being made" leaves them out (DLOAD-4). */
  campaignIds: Id[];
  /** Still loading what the rows are made of. */
  loading: boolean;
}

/** Products confirm in about half a minute each; never "0 min". */
const minutes = (n: number) => `about ${Math.max(1, Math.round(n / 2))} min`;

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** "the claims and a packshot": a brief's missing lines, as one short phrase. */
function joinLines(lines: string[]): string {
  const short = lines.map((l) => lowerFirst(l.replace(/ we may use for .+$/, "").replace(/ of the .+$/, "")));
  return short.length <= 1 ? (short[0] ?? "") : `${short.slice(0, -1).join(", ")} and ${short.at(-1)}`;
}

/** The order a campaign's asks are done in: an answer holds the rest back, then the brief, the plan, directions,
 *  creatives. */
const first: WaitingKind[] = ["question", "brief", "plan", "directions", "creatives", "download"];
const active = (c: Campaign) => !["delivered", "closed"].includes(c.state);

export function useWaitingOnYou(): Waiting {
  const session = useSession().data;
  const home = useHome();
  const board = useBrandBoard();
  const assets = useBrandAssets();
  const campaigns = useCampaigns();
  const catalogue = useCatalogue();
  const questions = useQuestions();
  const queue = useReviewQueue();
  const drafts = useDraftBriefs();
  // The plans that wait on her: who checked each one (the row says "Checked by Anna").
  const planIds = (home.data?.waitingOnYou ?? [])
    .filter((w) => w.kind === "plan" && w.campaignId)
    .map((w) => w.campaignId!);
  const plans = usePlans(planIds);
  const people = usePeople();
  // Brand decisions are the approver's: an editor or viewer cannot decide them, so they do not wait on them.
  const decides = session?.role === "owner" || session?.role === "approver";
  const firstRun = campaigns.data !== undefined && campaigns.data.length === 0;
  const loading = !home.data;
  if (!home.data) return { items: [], count: 0, firstRun, campaignIds: [], loading };

  const waiting = home.data.waitingOnYou;
  const products = catalogue.data?.products ?? [];
  const productPicture = (id: Id) => {
    const p = products.find((x) => x.id === id);
    return p?.shots?.find((s) => s.slotId === "front")?.image ?? p?.images[0];
  };
  const creativePicture = (campaignId: Id, kind: WaitingItem["kind"]) => {
    const item = queue.data?.find((r) => r.campaign.id === campaignId && r.kind === kind);
    return item?.kind === "creatives"
      ? item.creatives[0]?.current.image
      : item?.kind === "directions"
        ? item.directions[0]?.cover
        : undefined;
  };
  const ready: Delivery[] = home.data.deliveries.filter((d) => d.state === "ready");
  const rows: WaitingRow[] = [];
  // Products a campaign row already asks about: the products row leaves them out (DLOAD-4).
  const askedAbout = new Set<Id>();

  // ── One row per campaign: what it waits on first, the rest folded in ──
  const ids = [
    ...new Set([
      ...waiting.filter((w) => w.campaignId && w.kind !== "product").map((w) => w.campaignId!),
      ...ready.map((d) => d.campaignId),
    ]),
  ];
  for (const campaignId of ids) {
    const campaign = campaigns.data?.find((c) => c.id === campaignId);
    const items = waiting.filter((w) => w.campaignId === campaignId && w.kind !== "product");
    const delivery = ready.filter((d) => d.campaignId === campaignId);
    const open: OpenQuestion[] = (questions.data ?? []).filter((q) => q.campaignId === campaignId);
    const kinds = first.filter((k) =>
      k === "download"
        ? delivery.length > 0
        : k === "question"
          ? open.length > 0 || items.some((w) => w.kind === "question")
          : items.some((w) => w.kind === k),
    );
    if (!kinds.length) continue;
    const [kind, ...also] = kinds;
    const one = items.find((w) => w.kind === kind) ?? items[0];
    const name = campaign?.name ?? one?.title ?? delivery[0]?.name ?? "A campaign";
    const about = [...new Set(open.map((q) => q.productId).filter((p): p is Id => Boolean(p)))];
    about.forEach((p) => askedAbout.add(p));

    // The words: the campaign's one status sentence, then what folds in.
    const status = campaign
      ? copy.campaignStatus(campaign, open.length ? { questions: open.length } : undefined, { date: false }).words
      : undefined;
    let lead: string;
    if (kind === "question")
      lead = open.length
        ? `${status && /question/.test(status) ? status : copy.count(open.length, "question") + " for you"}: ${joinLines(open.map((q) => q.line))}`
        : (one?.detail ?? status ?? "Fume has a question for you");
    else if (kind === "download")
      lead =
        delivery.length === 1
          ? "Ready to download"
          : `${copy.count(delivery.length, "delivery", "deliveries")} ready to download`;
    else if (kind === "creatives")
      lead = status && /to approve/.test(status) ? status : `${copy.count(one?.count ?? 1, "creative")} to approve`;
    else if (kind === "plan") {
      // "Checked by Anna. Approve it and Fume starts." (the plan's checker, by first name). Round 12 (DLOAD-3 b, PLAN):
      // a product the plan shows that waits to be confirmed folds in here, "Confirm Evening Candle first, about 1 min",
      // and the products row leaves it out.
      // Round 13 (Marcus's card, 23 Oct 2026): an agency's client gets the plan the agency checked and sent her; the
      // check reads as the agency's, and its products are the agency's to confirm.
      const agencyClient = Boolean(session?.agencyName && !session.user.agency);
      const checker = plans.data?.find((p) => p?.campaignId === campaignId)?.checkedBy;
      const who = agencyClient
        ? session?.agencyName
        : checker
          ? firstName(people.data?.find((u) => u.id === checker)?.name ?? "") || undefined
          : undefined;
      const unconfirmed = agencyClient
        ? []
        : products.filter((p) => campaign?.productIds.includes(p.id) && p.state === "needs_you");
      unconfirmed.forEach((p) => askedAbout.add(p.id));
      lead = `${who ? `${copy.checkedBy(who)}. ` : ""}${unconfirmed.length ? `Confirm ${unconfirmed[0].name}${unconfirmed.length > 1 ? ` and ${copy.count(unconfirmed.length - 1, "more product")}` : ""} first, ${minutes(unconfirmed.length)}` : "Approve it and Fume starts."}`;
    } else
      lead =
        status && campaign && copy.campaignStatus(campaign).waiting
          ? status
          : kind === "brief"
            ? "A brief to send"
            : "3 directions to choose from";
    const more: string[] = [];
    // An agency's client hears only what was sent to her (AGENCY, 20 Oct): what is in check stays the agency's
    if (campaign && kind !== "question" && campaign.counts.inCheck > 0 && !session?.agencyName)
      more.push(`${campaign.counts.inCheck} more in check`);
    if (kind !== "download" && delivery.length)
      more.push(
        delivery.length === 1
          ? `${lowerFirst(delivery[0].name.replace(`${name} · `, ""))} ready to download`
          : `${delivery.length} deliveries ready`,
      );
    for (const k of also) {
      if (k === "brief") more.push("the brief to send");
      if (k === "plan") more.push("the plan to approve");
      if (k === "directions") more.push("directions to choose");
      if (k === "creatives")
        more.push(`${copy.count(items.find((w) => w.kind === "creatives")?.count ?? 1, "creative")} to approve`);
    }

    const href =
      kind === "download"
        ? delivery.length === 1
          ? `/deliveries/${delivery[0].id}`
          : "/deliveries"
        : kind === "question"
          ? (one?.href ?? "/fume")
          : kind === "plan" || kind === "brief"
            ? `/campaigns/${campaignId}/plan`
            : (items.find((w) => w.kind === kind)?.href ?? `/campaigns/${campaignId}`);
    const pictures =
      kind === "question"
        ? about.map(productPicture)
        : kind === "creatives" || kind === "directions"
          ? [creativePicture(campaignId, kind)]
          : [campaign?.cover];
    rows.push({
      id: `row-${campaignId}`,
      kind,
      also: also.length ? also : undefined,
      title: kind === "plan" ? copy.planReady(name) : name,
      detail: [lead, ...more].join(" · "),
      dueAt: campaign && active(campaign) ? campaign.dueAt : undefined,
      href,
      questionIds: kind === "question" && open.length ? open.map((q) => q.id) : undefined,
      productId:
        kind === "question" && about.length === 1 && open.every((q) => q.productId === about[0]) ? about[0] : undefined,
      campaignId,
      pictures: pictures.filter((p): p is string => Boolean(p)).slice(0, 3),
      count: items.reduce((n, w) => n + (w.count ?? 1), 0) + (kind === "download" ? delivery.length : 0) || 1,
    });
  }

  // ── Products to confirm: a row only when a campaign waits on one that no campaign row already asks about ──
  const toConfirm = waiting.filter((w) => w.kind === "product").map((w) => w.id.replace(/^wp-/, ""));
  const rest = toConfirm.filter((id) => !askedAbout.has(id));
  const running = (campaigns.data ?? []).filter(active);
  const held = rest.map((id) => ({ id, by: running.find((c) => c.productIds.includes(id)) })).filter((x) => x.by);
  let quiet: QuietProducts | undefined;
  if (held.length) {
    const firstProduct = products.find((p) => p.id === held[0].id)?.name ?? "One";
    rows.push({
      id: "row-products",
      kind: "products",
      title: `${copy.count(rest.length, askedAbout.size ? "more product" : "product", askedAbout.size ? "more products" : "products")} to confirm`,
      detail: `${firstProduct} first, ${held[0].by!.name} waits on it`,
      href: `/check/products?start=${held[0].id}`,
      pictures: rest
        .map(productPicture)
        .filter((p): p is string => Boolean(p))
        .slice(0, 3),
      count: rest.length,
    });
  } else if (rest.length)
    quiet = { count: rest.length, more: askedAbout.size > 0, minutes: minutes(rest.length), href: "/check/products" };

  // ── The Brand's own finds, and AI people (held until a campaign exists, ONB-8) ──
  if (decides) {
    const open = board.data?.open ?? 0;
    const people = firstRun ? [] : (assets.data?.models ?? []).filter((m) => m.state === "saved");
    const n = open + people.length;
    if (n > 0)
      rows.push({
        id: "row-brand",
        kind: "brand",
        title: "Brand",
        detail: `${copy.count(n, "find")} to confirm`,
        href: "/brand/check",
        pictures: [],
        count: n,
      });
  }

  // Soonest go-live first; then an answer (it holds a campaign back), the campaign decisions, products, Brand, downloads.
  const order: WaitingKind[] = [
    "question",
    "draft",
    "plan",
    "creatives",
    "directions",
    "brief",
    "products",
    "brand",
    "download",
  ];
  const sort = (list: WaitingRow[]) =>
    list.sort((a, b) =>
      a.dueAt && b.dueAt
        ? a.dueAt.localeCompare(b.dueAt)
        : a.dueAt
          ? -1
          : b.dueAt
            ? 1
            : order.indexOf(a.kind) - order.indexOf(b.kind),
    );

  // ── A brief half made in the chat (DTSK-16): a row of its own, in place of the lowest when there are five ──
  const half: WaitingRow[] = (drafts.data ?? [])
    .filter((d) => !rows.some((r) => r.campaignId === d.campaignId))
    .slice(0, 2)
    .map((d) => {
      const product = products.find((p) => p.name === d.productName);
      return {
        id: `row-draft-${d.campaignId}`,
        kind: "draft",
        title: d.title,
        detail: d.asked,
        href: d.href,
        campaignId: d.campaignId,
        pictures: product ? [productPicture(product.id)].filter((p): p is string => Boolean(p)) : [],
        count: 1,
      };
    });
  const items = sort([...sort(rows).slice(0, Math.max(0, 5 - half.length)), ...half]);
  return {
    items,
    count: items.length,
    firstRun,
    quiet,
    campaignIds: items.map((r) => r.campaignId).filter((c): c is Id => Boolean(c)),
    loading,
  };
}
