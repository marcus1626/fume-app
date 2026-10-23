// All products (design-system/components/product-sheet.css), PROPOSED 15 Oct 2026 (Marcus 15 Oct: "når man velger
// produkt i studio er det logisk at det er en view all product knapp til å få opp popup siden en kunde kan ha mange
// produkter"). One sheet for every product picker: the Studio's product, the Engine chat's tick grid, the manual
// brief and Fume's product question. A picker shows its few recent tiles and a "View all products (N)" button; the
// sheet holds them all, with a search, category and collection chips, and a lock on products the customer has not
// confirmed yet ("To confirm", with the way forward under the tile; round 8: one state word, never "facts"; round 9,
// DLOAD-1: the customer confirms, only the expert checks).
//   <ProductSheetButton count={12} onClick={() => setOpen(true)} />
//   <ProductSheet open={open} onOpenChange={setOpen} products={rows} filters={[{ label: "Kind", options }]}
//     multiple value={picked} onPick={(ids) => setPicked(ids)} />
// The sheet is a Dialog on a desk and the Drawer on a phone; it is opaque (the glass's solid fill), so the pictures
// behind never show through the words.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "../controls";
import { Icon } from "../icons";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  useNarrowScreen,
} from "../overlays";
import { PickGrid, ProductTile } from "./product-tile";

export interface SheetProduct {
  id: string;
  name: string;
  /** "100 ml". */
  variant?: string;
  src?: string;
  /** The filter options it belongs to (category, kind and collection ids). */
  tags?: string[];
  /** Not confirmed yet: shown with the lock, never pickable. */
  locked?: boolean;
  /** A quiet third line ("Ready for the Engine · 82%", "In AW26"). */
  note?: ReactNode;
  /** Under a locked tile: the way forward ("Ask Maja to confirm", "Confirm"). */
  action?: ReactNode;
}

export interface SheetFilterGroup {
  /** "Kind", "Collection": the chips' group, for screen readers. */
  label: string;
  options: { id: string; label: string }[];
}

export interface ProductSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Default "All products". */
  title?: string;
  description?: ReactNode;
  products: SheetProduct[];
  /** Chips over the grid: categories, kinds, collections. Groups with no options are left out. */
  filters?: SheetFilterGroup[];
  /** Tick several (a brief, the Engine chat) and confirm with the main button; else a tap picks one and closes. */
  multiple?: boolean;
  /** Picked already. */
  value?: string[];
  /** Single: the tapped product's id. Multiple: every ticked id, on the main button. */
  onPick: (ids: string[]) => void;
  /** Multiple: the main button's words for n ticked; default "Use 3 products". */
  doneLabel?: (n: number) => string;
  /** The lock's words; default "To confirm". */
  lockedLabel?: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const LOCKED = "__locked";

/** The sheet with every product: search, chips, a picture grid, the lock. */
export function ProductSheet({
  open,
  onOpenChange,
  title = "All products",
  description,
  products,
  filters = [],
  multiple = false,
  value = [],
  onPick,
  doneLabel = (n) => (n ? `Use ${plural(n, "product", "products")}` : "Tick a product"),
  lockedLabel = "To confirm",
}: ProductSheetProps) {
  const narrow = useNarrowScreen();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [ticked, setTicked] = useState<string[]>(value);
  const search = useRef<HTMLInputElement>(null);

  // Every opening starts from what is picked now, with no search and no chip.
  const valueKey = value.join(",");
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setFilter("");
    setTicked(valueKey ? valueKey.split(",") : []);
  }, [open, valueKey]);

  const groups = filters.filter((g) => g.options.length > 0);
  const lockedCount = products.filter((p) => p.locked).length;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (!q || `${p.name} ${p.variant ?? ""}`.toLowerCase().includes(q)) &&
        (!filter || (filter === LOCKED ? p.locked : p.tags?.includes(filter))),
    );
  }, [products, query, filter]);
  const filtering = Boolean(query.trim() || filter);

  const pick = (id: string, on: boolean) => {
    if (!multiple) {
      onPick([id]);
      onOpenChange(false);
      return;
    }
    setTicked((list) => (on ? [...new Set([...list, id])] : list.filter((x) => x !== id)));
  };

  const chip = (id: string, label: ReactNode, key = id) => (
    <Button
      key={key}
      type="button"
      size="sm"
      variant="glass-clear"
      icon={filter === id ? "check" : undefined}
      aria-pressed={filter === id}
      onClick={() => setFilter(filter === id ? "" : id)}
    >
      {label}
    </Button>
  );

  const body = (
    <div className="ui-product-sheet-body">
      <InputGroup role="search" className="ui-product-sheet-search">
        <InputGroupAddon>
          <Icon name="search" />
        </InputGroupAddon>
        <InputGroupInput
          ref={search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
          placeholder="Search products"
          aria-label="Search products"
          autoComplete="off"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton clear aria-label="Clear search" onClick={() => (setQuery(""), search.current?.focus())} />
        </InputGroupAddon>
      </InputGroup>
      {(groups.length > 0 || lockedCount > 0) && (
        <div className="ui-product-sheet-chips" role="group" aria-label="Show">
          {chip("", "All")}
          {groups.map((g) => (
            <span key={g.label} className="ui-product-sheet-chip-group" role="group" aria-label={g.label}>
              {g.options.map((o) => chip(o.id, o.label, `${g.label}-${o.id}`))}
            </span>
          ))}
          {lockedCount > 0 &&
            chip(
              LOCKED,
              <>
                <Icon name="lock" />
                {lockedLabel} · {lockedCount}
              </>,
            )}
        </div>
      )}
      <p className="ui-product-sheet-count" aria-live="polite">
        {filtering
          ? `${shown.length} of ${plural(products.length, "product", "products")}`
          : plural(products.length, "product", "products")}
        {multiple && ticked.length > 0 ? ` · ${ticked.length} ticked` : ""}
      </p>
      {shown.length ? (
        <PickGrid aria-label={title} className="ui-product-sheet-grid">
          {shown.map((p) => (
            <ProductTile
              key={p.id}
              name={p.name}
              variant={p.variant}
              src={p.src}
              note={p.note}
              flag={p.locked ? lockedLabel : undefined}
              flagIcon="lock"
              action={p.locked ? p.action : undefined}
              selected={p.locked ? undefined : multiple ? ticked.includes(p.id) : value.includes(p.id)}
              onSelectedChange={(on) => pick(p.id, multiple ? on : true)}
              label={
                p.locked ? `${p.name}${p.variant ? `, ${p.variant}` : ""}: ${lockedLabel.toLowerCase()}` : undefined
              }
            />
          ))}
        </PickGrid>
      ) : (
        <div className="ui-product-sheet-empty">
          <p>{query.trim() ? `No product matches “${query.trim()}”.` : "No product here."}</p>
          <Button type="button" size="sm" variant="glass-clear" onClick={() => (setQuery(""), setFilter(""))}>
            Show all products
          </Button>
        </div>
      )}
    </div>
  );

  const close = narrow ? DrawerClose : DialogClose;
  const Close = close;
  const footer = (
    <>
      <Close asChild>
        <Button variant="glass-clear">{multiple ? "Cancel" : "Close"}</Button>
      </Close>
      {multiple && (
        <Button
          variant="glass-white"
          icon="check"
          disabled={ticked.length === 0}
          onClick={() => {
            onPick(ticked);
            onOpenChange(false);
          }}
        >
          {doneLabel(ticked.length)}
        </Button>
      )}
    </>
  );

  if (narrow)
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="ui-product-sheet">
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
          <DrawerBody>{body}</DrawerBody>
          <DrawerFooter>{footer}</DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="ui-product-sheet">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogBody>{body}</DialogBody>
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface ProductSheetButtonProps {
  /** How many products the sheet holds. */
  count: number;
  onClick: () => void;
  /** Default "View all products". */
  label?: string;
  /** On glass (a popover): the clear glass pill. */
  glass?: boolean;
  disabled?: boolean;
}

/** "View all products (12)": opens the sheet, under a picker's few tiles. */
export function ProductSheetButton({
  count,
  onClick,
  label = "View all products",
  glass,
  disabled,
}: ProductSheetButtonProps) {
  return (
    <Button
      type="button"
      size="sm"
      variant={glass ? "glass-clear" : "secondary"}
      icon="layout-grid"
      onClick={onClick}
      disabled={disabled}
      className="ui-product-sheet-open"
    >
      {label} ({count})
    </Button>
  );
}
