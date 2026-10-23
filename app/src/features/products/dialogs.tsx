// The catalogue's three dialogs: a new collection (name, kind, its products), a product by hand or from a CSV, and
// a new name for a collection Fume proposed. Each says what happens next in one line and names who acts.
// Round 9 (desktop review 19 Oct, DLAY-15, DLOAD-1, DLOAD-7; PROPOSED): a new collection (a form with a product list)
// opens as the right panel on a desk; the one-field rename stays a small dialog. Later, never "Not now".
import {
  Button,
  Checkbox,
  Choice,
  ChoiceGroup,
  ChoiceText,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldOptional,
  FileInput,
  Input,
  NativeSelect,
  SegmentedControl,
  SegmentedOption,
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  useToast,
} from "@fume/ui";
import { useState, type FormEvent } from "react";
import { useAddCollection, useDecide } from "../../api/hooks";
import type { Category, Collection, Product } from "../../contract";
import * as copy from "../../copy";
import { useAddProducts } from "./hooks";
import { categoryPath, collectionKind } from "./parts";

const kinds = Object.keys(collectionKind) as Collection["kind"][];

// ─── New collection ─────────────────────────────────────────────────────────

export function NewCollectionDialog({
  open,
  onOpenChange,
  products,
  categories,
  onMade,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  categories: Category[];
  onMade?: (collection: Collection) => void;
}) {
  const add = useAddCollection();
  const toast = useToast();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Collection["kind"]>("season");
  const [picked, setPicked] = useState<string[]>([]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    add.mutate(
      { name: name.trim(), kind, productIds: picked },
      {
        onSuccess: (c) => {
          toast.done(`${c.name} made`, { description: `${copy.count(picked.length, "product")} in it. A campaign can take it whole.` });
          setName("");
          setPicked([]);
          onOpenChange(false);
          onMade?.(c);
        },
        onError: (error) => toast.error("The collection wasn’t made", { description: error.message }),
      },
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>New collection</SheetTitle>
          <SheetDescription>A season, a launch or a line. A campaign can take it whole, and each collection can be its own delivery.</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <form id="new-collection" onSubmit={submit} aria-label="New collection">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="collection-name">Name</FieldLabel>
                <Input id="collection-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="SS27" required data-ui-autofocus />
              </Field>
              <Field>
                <FieldLabel htmlFor="collection-kind">Kind</FieldLabel>
                <NativeSelect id="collection-kind" value={kind} onChange={(e) => setKind(e.target.value as Collection["kind"])}>
                  {kinds.map((k) => (
                    <option key={k} value={k}>
                      {collectionKind[k]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <ChoiceGroup legend="Products in it" className="ui-catalogue-pick">
                {products.map((p) => (
                  <Choice key={p.id}>
                    <Checkbox
                      checked={picked.includes(p.id)}
                      onCheckedChange={(on) => setPicked((now) => (on ? [...now, p.id] : now.filter((id) => id !== p.id)))}
                    />
                    <ChoiceText label={p.name} hint={categoryPath(categories, p.categoryId)} />
                  </Choice>
                ))}
              </ChoiceGroup>
            </FieldGroup>
          </form>
        </SheetBody>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="glass-clear">Later</Button>
          </SheetClose>
          <Button type="submit" form="new-collection" variant="glass-white" loading={add.isPending} disabled={!name.trim()}>
            Make the collection
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Add a product ──────────────────────────────────────────────────────────

/** "name,variant,url" per line; a first line that says "name" is a header and is skipped. */
function parseCsv(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(/[,;\t]/).map((cell) => cell.trim().replace(/^"|"$/g, "")))
    .filter((cells, i) => cells[0] && !(i === 0 && cells[0].toLowerCase() === "name"))
    .map(([name, variant = "", url]) => ({ name: name!, variant, url: url || undefined }));
}

export function AddProductDialog({
  open,
  onOpenChange,
  onAdded,
  csvOnly,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded?: (products: Product[]) => void;
  /** Round 6: one product is added by kind (products/add.tsx); this dialog is then only the CSV. */
  csvOnly?: boolean;
}) {
  const add = useAddProducts();
  const toast = useToast();
  const [how, setHow] = useState<"hand" | "csv">(csvOnly ? "csv" : "hand");
  const [name, setName] = useState("");
  const [variant, setVariant] = useState("");
  const [url, setUrl] = useState("");
  const [rows, setRows] = useState<{ name: string; variant: string; url?: string }[]>([]);
  const [csvError, setCsvError] = useState<string>();

  async function readCsv(files: File[]) {
    const file = files[0];
    if (!file) return setRows([]);
    const parsed = parseCsv(await file.text());
    setRows(parsed);
    setCsvError(parsed.length ? undefined : "Fume found no products in it. One product per line: name, size or variant, page.");
  }

  const ready = how === "hand" ? Boolean(name.trim()) : rows.length > 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    const input = how === "hand" ? [{ name: name.trim(), variant: variant.trim(), url: url.trim() || undefined }] : rows;
    add.mutate(input, {
      onSuccess: (products) => {
        toast.done(products.length === 1 ? `${products[0]!.name} added` : `${products.length} products added`, {
          description: "Fume reads them now. Verify each product’s facts once they are there.",
        });
        setName("");
        setVariant("");
        setUrl("");
        setRows([]);
        onOpenChange(false);
        onAdded?.(products);
      },
      onError: (error) => toast.error("Nothing was added", { description: error.message }),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{csvOnly ? "Add products from a CSV" : "Add a product"}</DialogTitle>
          <DialogDescription>
            {csvOnly ? "One product per line. Fume reads each one; open it after to choose its kind and add its photos." : "Fume reads what it can. Nothing is used in a campaign until you verify its facts."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="add-products" onSubmit={submit}>
            <FieldGroup>
              {!csvOnly && (
                <SegmentedControl aria-label="How" value={how} onValueChange={(v) => setHow(v as "hand" | "csv")}>
                  <SegmentedOption value="hand">By hand</SegmentedOption>
                  <SegmentedOption value="csv">From a CSV</SegmentedOption>
                </SegmentedControl>
              )}
              {how === "hand" ? (
                <>
                  <Field>
                    <FieldLabel htmlFor="product-name">Name</FieldLabel>
                    <Input id="product-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Night Body Oil" data-ui-autofocus />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="product-variant">
                      Size or variant <FieldOptional />
                    </FieldLabel>
                    <Input id="product-variant" value={variant} onChange={(e) => setVariant(e.target.value)} placeholder="100 ml" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="product-url">
                      Product page <FieldOptional />
                    </FieldLabel>
                    <Input id="product-url" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
                  </Field>
                </>
              ) : (
                <Field invalid={Boolean(csvError)}>
                  <FieldLabel htmlFor="product-csv">Your product list</FieldLabel>
                  <FileInput id="product-csv" accept=".csv,text/csv,.txt" placeholder="Choose a CSV" onFilesChange={readCsv} aria-describedby="product-csv-help" />
                  <FieldDescription id="product-csv-help">
                    {csvError ?? (rows.length ? `${copy.count(rows.length, "product")} found: ${rows.slice(0, 3).map((r) => r.name).join(", ")}${rows.length > 3 ? " …" : ""}` : "One product per line: name, size or variant, page.")}
                  </FieldDescription>
                </Field>
              )}
            </FieldGroup>
          </form>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="glass-clear">Later</Button>
          </DialogClose>
          <Button type="submit" form="add-products" variant="glass-white" loading={add.isPending} disabled={!ready}>
            {how === "csv" && rows.length > 1 ? `Add ${rows.length} products` : "Add the product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Change a proposed collection ───────────────────────────────────────────

export function ChangeCollectionDialog({ collection, onOpenChange }: { collection: Collection | null; onOpenChange: (open: boolean) => void }) {
  const decide = useDecide();
  const toast = useToast();
  const [name, setName] = useState("");
  const open = Boolean(collection);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!collection || !name.trim()) return;
    decide.mutate(
      { kind: "collection", id: collection.id, verdict: "change", value: name.trim() },
      {
        onSuccess: () => {
          toast.done(`${collection.name} is now ${name.trim()}`);
          setName("");
          onOpenChange(false);
        },
        onError: (error) => toast.error("That wasn’t changed", { description: error.message }),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Change {collection?.name}</DialogTitle>
          <DialogDescription>Fume found it on your website. Give it the name you use, and it is yours.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="change-collection" onSubmit={submit}>
            <Field>
              <FieldLabel htmlFor="collection-rename">Name</FieldLabel>
              <Input id="collection-rename" value={name} onChange={(e) => setName(e.target.value)} placeholder={collection?.name} data-ui-autofocus />
            </Field>
          </form>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="glass-clear">Later</Button>
          </DialogClose>
          <Button type="submit" form="change-collection" variant="glass-white" loading={decide.isPending} disabled={!name.trim()}>
            Save the name
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
