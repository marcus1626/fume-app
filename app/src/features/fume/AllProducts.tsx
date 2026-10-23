// "View all products" (walk-through Must 1, Marcus 15 Oct: a customer can have many products): the brand's whole
// catalogue in the shared ProductSheet (packages/ui/src/fume/product-sheet.tsx), with the kinds and collections as
// chips, and a lock on products the customer has not confirmed yet (round 8, LOAD-2: one word, "Confirmed"; round 9,
// DLOAD-1: the picker's own "To confirm" on the lock, since "check" is the expert's word; the readiness percentage only for Fume's
// people, never on a confirmed product). A locked product's "Confirm details" opens the one product panel.
// Every product picker uses it: the Studio's product, the Engine chat's tick grid, the manual brief and Fume's
// product question. A picker shows a few tiles and <ProductSheetButton> under them.
import { Button, ProductSheet, useToast, type SheetFilterGroup, type SheetProduct } from "@fume/ui";
import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useCatalogue, useProductKinds } from "../../api/hooks";
import type { CatalogueView, Id, Product } from "../../contract";
import { fidelity, pct } from "../products/spec";

/** A product Fume may make creatives of: the customer has confirmed it. */
export const confirmed = (p: Product) => p.state === "verified";

/** The catalogue as the sheet's rows and chips. `only` keeps a subset (the products an Engine card offers). */
export function useAllProducts(only?: Id[]) {
  const catalogue = useCatalogue();
  const kinds = useProductKinds().data;
  return useMemo(() => {
    const data = catalogue.data as CatalogueView | undefined;
    const products = (data?.products ?? []).filter((p) => !only || only.includes(p.id));
    const usedKinds = (kinds ?? []).filter((k) => products.some((p) => p.kindId === k.id));
    const usedCollections = (data?.collections ?? []).filter((c) => products.some((p) => c.productIds.includes(p.id)));
    const usedCategories = (data?.categories ?? []).filter((c) => !c.parentId && products.some((p) => p.categoryId === c.id || data?.categories.find((x) => x.id === p.categoryId)?.parentId === c.id));
    const filters: SheetFilterGroup[] = [
      usedKinds.length
        ? { label: "Category", options: usedKinds.map((k) => ({ id: k.id, label: k.name })) }
        : { label: "Category", options: usedCategories.map((c) => ({ id: c.id, label: c.name })) },
      { label: "Collection", options: usedCollections.map((c) => ({ id: c.id, label: c.name })) },
    ];
    const tags = (p: Product) => {
      const parent = data?.categories.find((x) => x.id === p.categoryId)?.parentId;
      return [p.kindId, p.categoryId, parent, ...(data?.collections ?? []).filter((c) => c.productIds.includes(p.id)).map((c) => c.id)].filter((x): x is string => Boolean(x));
    };
    const readiness = (p: Product) => {
      const kind = kinds?.find((k) => k.id === p.kindId);
      const score = kind ? fidelity(p, kind).score : 0;
      return score > 0 ? `${pct(score)} ready` : undefined;
    };
    return { products, filters, tags, readiness, loading: catalogue.isPending };
  }, [catalogue.data, catalogue.isPending, kinds, only]);
}

export interface AllProductsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  multiple?: boolean;
  value?: Id[];
  onPick: (ids: Id[]) => void;
  title?: string;
  description?: ReactNode;
  doneLabel?: (n: number) => string;
  /** Only these products (an Engine card's offer). */
  only?: Id[];
  /** Fume's people: who confirms a locked product's details ("Ask Maja to confirm"). */
  confirmer?: string;
  /** A customer confirms a locked product's details in place (the brief's dialog); else its page opens. */
  onConfirm?: (productId: Id) => void;
  /** Staff ask the customer; customers confirm themselves. */
  staff?: boolean;
}

/** The whole catalogue in the shared sheet. */
export function AllProductsSheet({ open, onOpenChange, only, confirmer, onConfirm, staff, ...props }: AllProductsSheetProps) {
  const { products, filters, tags, readiness } = useAllProducts(only);
  const toast = useToast();
  const who = confirmer ?? "the customer";
  const rows: SheetProduct[] = products.map((p) => {
    const locked = !confirmed(p);
    return {
      id: p.id,
      name: p.name,
      variant: p.variant,
      src: p.images[0],
      tags: tags(p),
      locked,
      note: locked || !staff ? undefined : readiness(p),
      action: !locked ? undefined : staff ? (
        <Button
          size="sm"
          variant="glass-clear"
          icon="send"
          aria-label={`Ask ${who} to confirm the details of ${p.name}`}
          onClick={() => toast.done(`${who} is asked to confirm ${p.name}`, { description: "It waits on their Home. The product can be picked once it is confirmed." })}
        >
          Ask {who.split(" ")[0]}
        </Button>
      ) : onConfirm ? (
        <Button
          size="sm"
          variant="glass-clear"
          icon="circle-check"
          aria-label={`Confirm the details of ${p.name}`}
          onClick={() => {
            onOpenChange(false);
            onConfirm(p.id);
          }}
        >
          Confirm details
        </Button>
      ) : (
        <Button asChild size="sm" variant="glass-clear" icon="circle-check">
          <Link to={`/brand/products/${p.id}`} aria-label={`Confirm the details of ${p.name}`}>
            Confirm details
          </Link>
        </Button>
      ),
    };
  });
  return (
    <ProductSheet
      open={open}
      onOpenChange={onOpenChange}
      products={rows}
      filters={filters}
      description={
        props.description ??
        (staff ? `Products with a lock wait for ${who} to confirm their details; the Engine makes nothing of them before that.` : "We make creatives only of products you have confirmed.")
      }
      {...props}
    />
  );
}
