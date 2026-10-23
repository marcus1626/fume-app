// How a campaign's creatives fall into collections and products (FLOWS §3.2): what each collection has approved,
// whether it is ready to deliver, and the delivery's tree (collection › product › direction › master, variant,
// format). A creative does not carry its product yet: it belongs to the campaign's product when the campaign has
// one, and to every product of the campaign when it has several (the backend tags it per product later).
import type { Campaign, Collection, Creative, Delivery, Direction, Format, Id, Product } from "../../contract";

const FORMAT_ORDER: Format[] = ["feed", "square", "story"];

/** The product a creative shows, when the campaign tells it. */
export const productOf = (_c: Creative, campaign: Campaign): Id | undefined =>
  campaign.productIds.length === 1 ? campaign.productIds[0] : undefined;

/** Does this creative belong to this collection? */
export function inCollection(c: Creative, campaign: Campaign, collection: Collection): boolean {
  const product = productOf(c, campaign);
  return product
    ? collection.productIds.includes(product)
    : campaign.productIds.some((id) => collection.productIds.includes(id));
}

export interface Readiness {
  /** Undefined for the whole campaign. */
  collection?: Collection;
  total: number;
  approved: number;
  delivered: number;
  /** Still in the making, in check, with you, or being fixed. */
  underWay: number;
  /** Every creative in it is approved or delivered, and some are not delivered yet. */
  ready: boolean;
  /** Every approved creative here is in a delivery: the newest of them. */
  delivery?: Delivery;
}

function measure(creatives: Creative[], deliveries: Delivery[], collection?: Collection): Readiness {
  const approved = creatives.filter((c) => c.current.state === "approved");
  const delivered = creatives.filter((c) => c.current.state === "delivered").length;
  // Any of the campaign's deliveries counts (round 8, TASK-16): what a collection delivery holds is delivered for the
  // whole campaign too, so the same creatives are never offered twice. The row opens the newest one that holds them.
  const packed = new Set(deliveries.flatMap((d) => d.creativeIds));
  const delivery =
    approved.length > 0 && approved.every((c) => packed.has(c.id))
      ? [...deliveries]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .find((d) => approved.some((c) => d.creativeIds.includes(c.id)))
      : undefined;
  return {
    collection,
    total: creatives.length,
    approved: approved.length,
    delivered,
    underWay: creatives.length - approved.length - delivered,
    ready: approved.length > 0 && approved.length + delivered === creatives.length,
    delivery,
  };
}

/** One row per collection the campaign takes, then the whole campaign. */
export function readiness(
  campaign: Campaign,
  creatives: Creative[],
  collections: Collection[],
  deliveries: Delivery[],
): Readiness[] {
  const mine = deliveries.filter((d) => d.campaignId === campaign.id);
  const rows = (campaign.collectionIds ?? [])
    .map((id) => collections.find((c) => c.id === id))
    .filter((c): c is Collection => Boolean(c))
    .map((cl) =>
      measure(
        creatives.filter((c) => inCollection(c, campaign, cl)),
        mine,
        cl,
      ),
    );
  return [...rows, measure(creatives, mine)];
}

/** "AW26 is ready to deliver", "2 of 11 approved · 9 still under way", "Nothing approved yet". */
export function readinessLine(r: Readiness, name: string): string {
  if (r.total === 0) return "No creatives yet";
  if (r.delivery) return `In a delivery · ${r.approved} approved`;
  if (r.ready) return `${name} is ready to deliver · ${r.approved} approved`;
  if (r.approved === 0)
    return r.delivered
      ? `${r.delivered} delivered · ${r.underWay} still under way`
      : `Nothing approved yet · ${r.underWay} under way`;
  return `${r.approved} of ${r.total} approved · ${r.underWay} still under way`;
}

// ─── The delivery's tree ────────────────────────────────────────────────────

export interface DirectionGroup {
  direction?: Direction;
  directionId: Id;
  creatives: Creative[];
}
export interface ProductGroup {
  product?: Product;
  productId?: Id;
  directions: DirectionGroup[];
  count: number;
}
export interface CollectionGroup {
  collection?: Collection;
  products: ProductGroup[];
  count: number;
}

/** Masters before their variants, variants in order, then the format order; by name last. */
function byMasterVariantFormat(a: Creative, b: Creative): number {
  const master = (c: Creative) => c.masterId ?? c.id;
  return (
    master(a).localeCompare(master(b)) ||
    Number(a.kind === "variant") - Number(b.kind === "variant") ||
    a.title.localeCompare(b.title) ||
    FORMAT_ORDER.indexOf(a.format) - FORMAT_ORDER.indexOf(b.format)
  );
}

export function deliveryTree(
  delivery: Delivery,
  creatives: Creative[],
  campaign: Campaign,
  catalogue: { products: Product[]; collections: Collection[] } | undefined,
  directions: Direction[],
): CollectionGroup[] {
  const collections = catalogue?.collections ?? [];
  const products = catalogue?.products ?? [];
  const scoped = delivery.collectionId ? collections.find((c) => c.id === delivery.collectionId) : undefined;
  const campaignCollections = (campaign.collectionIds ?? [])
    .map((id) => collections.find((c) => c.id === id))
    .filter((c): c is Collection => Boolean(c));

  const collectionOf = (c: Creative): Collection | undefined =>
    scoped ?? campaignCollections.find((cl) => inCollection(c, campaign, cl));

  const groups = new Map<
    string,
    { collection?: Collection; byProduct: Map<string, { productId?: Id; byDirection: Map<Id, Creative[]> }> }
  >();
  for (const c of creatives) {
    const collection = collectionOf(c);
    const productId = productOf(c, campaign);
    const g = groups.get(collection?.id ?? "") ?? { collection, byProduct: new Map() };
    groups.set(collection?.id ?? "", g);
    const p = g.byProduct.get(productId ?? "") ?? { productId, byDirection: new Map() };
    g.byProduct.set(productId ?? "", p);
    p.byDirection.set(c.directionId, [...(p.byDirection.get(c.directionId) ?? []), c]);
  }

  return [...groups.values()].map((g) => {
    const productGroups: ProductGroup[] = [...g.byProduct.values()].map((p) => {
      const dirs: DirectionGroup[] = [...p.byDirection].map(([directionId, list]) => ({
        directionId,
        direction: directions.find((d) => d.id === directionId),
        creatives: [...list].sort(byMasterVariantFormat),
      }));
      dirs.sort((a, b) => (a.direction?.letter ?? "").localeCompare(b.direction?.letter ?? ""));
      return {
        productId: p.productId,
        product: products.find((x) => x.id === p.productId),
        directions: dirs,
        count: dirs.reduce((n, d) => n + d.creatives.length, 0),
      };
    });
    return { collection: g.collection, products: productGroups, count: productGroups.reduce((n, p) => n + p.count, 0) };
  });
}
