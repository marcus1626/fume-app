// What the catalogue screens share (FLOWS §3.1, §7 step 5): who may change what, the words for categories, collections
// and provenance, and the two cards (a product, a collection). The look is catalogue.css on top of Proposal
// (proposal.css): a proposal lies flat, what the customer added or approved lifts.
import {
  Badge,
  Button,
  CreativeMoreButton,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Icon,
  Proposal,
  ProposalFoot,
  ProposalTag,
  useToast,
} from "@fume/ui";
import type { ReactElement } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePeople, useSession, useSetProductPlace } from "../../api/hooks";
import type { Category, Collection, Product, Provenance } from "../../contract";
import * as copy from "../../copy";
import { date } from "../../lib/time";
import { directory } from "../../shell/people";

// ─── Who may do what ────────────────────────────────────────────────────────

/** Owner, approver and member sort the catalogue; only owner and approver decide on Fume's proposals. */
export function useCatalogueRights() {
  const role = useSession().data?.role ?? null;
  return {
    canEdit: role === "owner" || role === "approver" || role === "member",
    canDecide: role === "owner" || role === "approver",
  };
}

// ─── Words ──────────────────────────────────────────────────────────────────

export const collectionKind: Record<Collection["kind"], string> = {
  season: "Season",
  launch: "Launch",
  line: "Line",
  custom: "Your own",
};

export const productState: Record<Product["state"], string> = {
  draft: "Fume is reading it",
  needs_you: "Waiting on you",
  verified: "Confirmed",
};

/** "Body care › Oils" */
export function categoryPath(categories: Category[], id: string | undefined): string | undefined {
  if (!id) return undefined;
  const names: string[] = [];
  let at = categories.find((c) => c.id === id);
  while (at) {
    names.unshift(at.name);
    at = at.parentId ? categories.find((c) => c.id === at!.parentId) : undefined;
  }
  return names.length ? names.join(" › ") : undefined;
}

/** A category and every category under it, for filtering by a parent. */
export function categoryAndChildren(categories: Category[], id: string): Set<string> {
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of categories)
      if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
        ids.add(c.id);
        grew = true;
      }
  }
  return ids;
}

/** "12 Sep – 20 Jan", "From 12 Sep" or nothing. */
export function seasonDates(c: Collection): string | undefined {
  if (c.startsAt && c.endsAt) return `${date(c.startsAt)} – ${date(c.endsAt)}`;
  if (c.startsAt) return `From ${date(c.startsAt)}`;
  if (c.endsAt) return `Until ${date(c.endsAt)}`;
  return undefined;
}

/** "Season · 12 Sep – 20 Jan · 2 products" */
export const collectionLine = (c: Collection) =>
  [collectionKind[c.kind], seasonDates(c), copy.count(c.productIds.length, "product")].filter(Boolean).join(" · ");

/** "2 variants · Body care › Oils" */
export function productLine(p: Product, categories: Category[]): string {
  const variants = p.variants?.length ? copy.count(p.variants.length, "variant") : p.variant || undefined;
  return [variants, categoryPath(categories, p.categoryId) ?? "No category yet"].filter(Boolean).join(" · ");
}

/** The confirm queue: the products that need the customer, one at a time. */
export const CHECK_PRODUCTS = "/check/products";

/** A product may go into a campaign only once it is confirmed (FLOWS §7 step 5). */
export const usable = (p: Product) => p.state === "verified";

// ─── Provenance ─────────────────────────────────────────────────────────────

const fallback: Provenance = { origin: "customer", state: "approved" };

/** Who put it in and who decided: "Fume found this on lysne.no/candle", "You added this · 3 Oct", "Maja approved". */
export function ProvenanceTag({ provenance }: { provenance?: Provenance }) {
  const people = directory(usePeople().data);
  const me = useSession().data?.user.id;
  const p = provenance ?? fallback;
  const state = p.state === "removed" ? "approved" : p.state;
  const by = p.by ? (p.by === me ? "You" : people.name(p.by)) : undefined;
  return (
    <ProposalTag origin={p.origin} state={state} evidence={p.evidence} by={by} when={p.at ? date(p.at) : undefined} />
  );
}

const stateOf = (p?: Provenance) => (p?.state === "removed" ? "approved" : (p?.state ?? "approved"));

// ─── Product card ───────────────────────────────────────────────────────────

/** The product's state as a badge: Confirmed, Not confirmed yet (it waits for her), or Fume is still reading it; "New"
 *  is a badge of its own. Status is never Ink, so it never looks like a button. She confirms; only the expert checks. */
export function ProductStateBadge({ product }: { product: Product }) {
  if (product.state === "verified") return <Badge icon="circle-check">{productState.verified}</Badge>;
  if (product.state === "needs_you") return <Badge dot="on">Not confirmed yet</Badge>;
  return <Badge dot="live">{productState.draft}</Badge>;
}

/** "New": Fume found it since she last looked at her products. */
export function ProductNewBadge({ product }: { product: Product }) {
  return product.isNew ? <Badge variant="secondary">New</Badge> : null;
}

export interface ProductCardProps {
  product: Product;
  /** @deprecated The card shows the picture and the name only; category and collections live on the product's page.
   *  Kept so callers need not change. */
  categories?: Category[];
  collections?: Collection[];
  canEdit?: boolean;
}

/** One product: its picture and its name, and a "To confirm" chip only while it needs her. The kind, category,
 *  collections and who put it in live on the product's page under All details. */
export function ProductCard({ product: p }: ProductCardProps) {
  const image = p.images[0] ?? p.variants?.find((v) => v.image)?.image;
  return (
    <div className="ui-product-card" data-state={p.state}>
      <div className="ui-product-card-media">
        {image ? <img src={image} alt="" loading="lazy" /> : <Icon name="image" />}
      </div>
      <div className="ui-product-card-body">
        <Link to={`/brand/products/${p.id}`} className="ui-product-card-link">
          {p.name}
        </Link>
        <span className="ui-product-card-badges">
          <ProductNewBadge product={p} />
          <ProductStateBadge product={p} />
        </span>
      </div>
    </div>
  );
}

/** The card's menu: open it, put it in a category, add it to or take it out of collections. */
export function ProductMenu({
  product: p,
  categories,
  collections,
  trigger,
  onPage,
}: {
  product: Product;
  categories: Category[];
  collections: Collection[];
  /** The button that opens the menu (default the quiet More circle). */
  trigger?: ReactElement;
  /** On the product's own page: no "Open the product" row. */
  onPage?: boolean;
}) {
  const place = useSetProductPlace();
  const toast = useToast();
  const navigate = useNavigate();
  const inIds = p.collectionIds ?? [];

  const move = (change: { categoryId?: string; collectionIds?: string[] }, done: string) =>
    place.mutate(
      { productId: p.id, ...change },
      {
        onSuccess: () => toast.done(done),
        onError: (error) => toast.error("That wasn’t moved", { description: error.message }),
      },
    );

  return (
    <div className="ui-product-card-menu">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {trigger ?? <CreativeMoreButton aria-label={`More for ${p.name}`} />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align={trigger ? "start" : "end"}>
          {!onPage && (
            <>
              <DropdownMenuItem icon="arrow-up-right" onSelect={() => navigate(`/brand/products/${p.id}`)}>
                {p.state === "needs_you" ? "Open and confirm it" : "Open the product"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuLabel>Category</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={p.categoryId ?? ""}
            onValueChange={(id) => move({ categoryId: id }, `${p.name} is in ${categoryPath(categories, id)}`)}
          >
            {categories.map((c) => (
              <DropdownMenuRadioItem key={c.id} value={c.id}>
                {categoryPath(categories, c.id)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Collections</DropdownMenuLabel>
          {collections.map((c) => {
            const on = inIds.includes(c.id);
            return (
              <DropdownMenuCheckboxItem
                key={c.id}
                checked={on}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={() =>
                  move(
                    { collectionIds: on ? inIds.filter((id) => id !== c.id) : [...inIds, c.id] },
                    on ? `${p.name} left ${c.name}` : `${p.name} is in ${c.name}`,
                  )
                }
              >
                {c.name}
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ─── Collection card ────────────────────────────────────────────────────────

export interface CollectionCardProps {
  collection: Collection;
  /** Confirm · Change · Remove on a collection Fume proposed; only the customer's approvers decide. */
  onDecide?: (verdict: "keep" | "change" | "remove") => void;
  deciding?: boolean;
}

/** One collection: its cover, name, kind and dates, how many products; who made it only while it is a proposal. */
export function CollectionCard({ collection: c, onDecide, deciding }: CollectionCardProps) {
  const state = stateOf(c.provenance);
  return (
    <Proposal state={state} className="ui-collection-card">
      <div className="ui-collection-card-cover">
        {c.cover ? <img src={c.cover} alt="" loading="lazy" /> : <Icon name="layers" />}
      </div>
      <div className="ui-product-card-body">
        <Link to={`/products/collections/${c.id}`} className="ui-collection-card-link">
          {c.name}
        </Link>
        <p className="ui-product-card-meta">{collectionLine(c)}</p>
      </div>
      {state === "proposed" && (
        // Who made it shows only while it waits for her; its description lives on its page.
        <ProposalFoot>
          <ProvenanceTag provenance={c.provenance} />
          {onDecide && (
            // No Ink on a card: the page keeps its one Ink action.
            <div className="ui-proposal-actions">
              <Button
                size="sm"
                variant="secondary"
                disabled={deciding}
                onClick={() => onDecide("keep")}
                aria-label={`Confirm ${c.name}`}
              >
                Confirm
              </Button>
              <Button size="sm" variant="quiet" disabled={deciding} onClick={() => onDecide("change")}>
                Change
              </Button>
              <Button size="sm" variant="quiet" disabled={deciding} onClick={() => onDecide("remove")}>
                Remove
              </Button>
            </div>
          )}
        </ProposalFoot>
      )}
    </Proposal>
  );
}
