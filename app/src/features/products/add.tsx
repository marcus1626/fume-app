// Add a product (round 6, Marcus 15 Oct: "velger man produkt kategori når man legger til produkt"). Round 8
// (walk-through 19 Oct, TASK-13; PROPOSED): two short steps in one dialog, and the page is for later, not a second
// pass. 1. Its name, its page and its photos; the kind is proposed from the name ("Looks like Skincare and body ·
// Change"), and the photo slots follow the kind. 2. Only what the Engine still needs and could not read, the first
// four; everything else waits. Then it lands in the list with a toast that says what is left ("Foot Cream added · 3
// things left"); what the Engine read is confirmed with the other products, one at a time. Many products come in by
// Import products (website, CSV or zip).
// Round 9 (desktop review 19 Oct, DLAY-15, DTSK-18, DLOAD-1; PROPOSED): on a desk it opens as the right panel (520,
// the full height, its own scroll, the footer pinned at its foot), so the product grid stays in view on the left; the
// phone keeps a sheet from the bottom (the same Sheet). The new product lands in the grid and is shown there. Fume
// reads the product; the Engine only makes creatives.
import {
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldOptional,
  Input,
  NativeSelect,
  PickGrid,
  PickTile,
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Spinner,
  useToast,
} from "@fume/ui";
import { useMemo, useState, type FormEvent } from "react";
import { useProductKinds, useReadProduct, useSaveProductSpecs } from "../../api/hooks";
import type { Product, ProductKind, ShotSlot, SpecField, SpecValue } from "../../contract";
import * as copy from "../../copy";
import { fieldsOf, missingDetails } from "./spec";
import { draftOf, previewOf, ShotGrid, SpecInput, valueOf, type Draft } from "./specs";

/** The kinds as a picture grid; picking one moves on. */
export function KindGrid({ kinds, value, onPick }: { kinds: ProductKind[]; value?: string; onPick: (k: ProductKind) => void }) {
  return (
    <PickGrid size="sm" aria-label="Kinds of product">
      {kinds.map((k) => (
        <PickTile
          key={k.id}
          title={k.name}
          line={k.examples}
          src={k.image}
          icon="package"
          label={`${k.name}: ${k.examples}`}
          {...(value ? { selected: value === k.id, onSelectedChange: () => onPick(k) } : { onOpen: () => onPick(k) })}
        />
      ))}
    </PickGrid>
  );
}

const OTHER = "kind-other";

/** The kind a name or an address most likely is, from the words each kind names ("Foot Cream": Skincare and body). A
 *  proposal only: the customer sees it as "Looks like …" and can change it. */
export function guessKind(kinds: ProductKind[], text: string): ProductKind | undefined {
  const t = ` ${text.toLowerCase().replace(/[^a-zæøå0-9]+/g, " ")} `;
  if (!t.trim()) return undefined;
  for (const k of kinds) {
    if (k.id === OTHER) continue;
    const words = `${k.name} ${k.examples}`
      .toLowerCase()
      .split(/[^a-zæøå]+/)
      .map((w) => w.replace(/(es|s)$/, ""))
      .filter((w) => w.length > 2 && !["and", "the", "for"].includes(w));
    if (words.some((w) => t.includes(` ${w}`))) return k;
  }
  return undefined;
}

// ─── Round 13 (Marcus's video comment #45, robot note 05; PROPOSED 22 Oct 2026) ─────────────────────────────────
// The product type is a select (Bottle, Jar, Tube, Candle, Textile, Accessory, Box or set) and decides which measures
// are asked, each a number with its unit chosen from a select, never typed: a cap has a size in cm, never ml. Fume
// chooses the type from the name as she writes it (Linen Spray: Bottle), and the kind with it when the name alone
// says nothing.

export type ProductType = "bottle" | "jar" | "tube" | "candle" | "textile" | "accessory" | "box" | "other";
interface Measure {
  id: string;
  label: string;
  units: string[];
}
export const productTypes: { id: ProductType; label: string; kindId: string; measures: Measure[] }[] = [
  { id: "bottle", label: "Bottle (skincare, fragrance, sprays)", kindId: "kind-skincare", measures: [{ id: "volume", label: "Volume", units: ["ml", "cl", "l", "fl oz"] }, { id: "height", label: "Height", units: ["cm", "mm"] }] },
  { id: "jar", label: "Jar", kindId: "kind-skincare", measures: [{ id: "content", label: "Content", units: ["ml", "g"] }, { id: "diameter", label: "Diameter", units: ["cm", "mm"] }] },
  { id: "tube", label: "Tube", kindId: "kind-skincare", measures: [{ id: "content", label: "Content", units: ["ml", "g"] }, { id: "length", label: "Length", units: ["cm", "mm"] }] },
  { id: "candle", label: "Candle", kindId: "kind-home", measures: [{ id: "weight", label: "Weight", units: ["g", "kg"] }, { id: "burn", label: "Burn time", units: ["hours"] }] },
  { id: "textile", label: "Textile (clothing, linen)", kindId: "kind-apparel", measures: [{ id: "size", label: "Sizes", units: ["XS to XL", "S to L", "One size"] }, { id: "length", label: "Length", units: ["cm", "m"] }] },
  { id: "accessory", label: "Accessory (cap, bag, scarf)", kindId: "kind-bags", measures: [{ id: "size", label: "Size", units: ["cm", "One size"] }] },
  { id: "box", label: "Box or set", kindId: "kind-other", measures: [{ id: "pieces", label: "Pieces in it", units: ["pieces"] }, { id: "width", label: "Width", units: ["cm"] }] },
  { id: "other", label: "Something else", kindId: "kind-other", measures: [{ id: "size", label: "Size", units: ["ml", "g", "cm", "pieces"] }] },
];
/** The photos each type asks for (round 13 after-check of #45: they followed the kind, so a linen spray asked for "the
 *  wax from above" and a wool cap for "the clasp"). The type decides them; the kind keeps the facts. Slot ids stay the
 *  shared ones (front, back, side, top, open, detail, scale, lit), so the product page shows them in its kind's slots. */
const slot = (id: string, label: string, help: string, required = false): ShotSlot => ({ id, label, help, required });
const front = slot("front", "Front", "Straight on, the label readable, on white.", true);
const scale = slot("scale", "In a hand", "In a hand or beside something known, for scale.");
const typeShots: Record<ProductType, ShotSlot[]> = {
  bottle: [front, slot("back", "Back", "Straight on, the back label readable.", true), slot("side", "Side", "From the left, to show depth and the shoulder.", true), slot("open", "Cap off", "The cap beside it, the pump or the spray showing."), scale],
  jar: [front, slot("top", "Top", "The lid from above.", true), slot("open", "Open", "Lid off: the texture inside."), scale],
  tube: [front, slot("back", "Back", "Straight on, the back label readable.", true), slot("open", "Cap off", "The cap beside it."), scale],
  candle: [front, slot("side", "Side", "From the left, to show the vessel.", true), slot("top", "Top", "The wax from above."), slot("lit", "Lit", "Burning, in a dim room."), scale],
  textile: [slot("front", "Laid flat", "The whole piece, flat on white.", true), slot("back", "Back", "Turned over, flat on white."), slot("detail", "Detail", "Close: the weave or knit, a seam, the label.", true)],
  accessory: [front, slot("side", "Side", "From the side, to show depth and shape.", true), slot("detail", "Detail", "Close: the stitching, the hardware, the logo."), slot("scale", "For scale", "Held or beside something known.")],
  box: [slot("front", "Closed", "The box or set closed, straight on.", true), slot("open", "Open", "Open, with everything in it in view.", true), slot("detail", "Each piece", "The pieces side by side, on white.")],
  other: [front, slot("side", "Side", "From the left, to show depth.", true), slot("detail", "Detail", "Close: the texture or the print."), scale],
};

/** Units that are a size in words, not a number ("One size"): no number is asked with them. */
const wordUnit = (u: string) => /^[A-Z]/.test(u);

/** The type a product's name says ("Linen Spray": a bottle; "Merino Cap": an accessory), or undefined. */
export function guessType(name: string): ProductType | undefined {
  const t = name.toLowerCase();
  if (/spray|mist|oil|serum|parfum|perfume|eau de|toner|wash|shampoo|bottle|tonic|essence/.test(t)) return "bottle";
  if (/candle|wax/.test(t)) return "candle";
  if (/\bset\b|gift|box|kit|ritual/.test(t)) return "box";
  if (/scrub|butter|jar|mask|cream|balm/.test(t)) return /hand cream|lip|tube/.test(t) ? "tube" : "jar";
  if (/tube|lip/.test(t)) return "tube";
  if (/cap\b|hat|bag|tote|belt|wallet|scarf|pouch/.test(t)) return "accessory";
  if (/sweater|shirt|knit|towel|throw|blanket|robe|pyjama|sock|linen|dress|top\b/.test(t)) return "textile";
  return undefined;
}

/** The kind a type says when the name alone does not: a spray for the home is Home and candles. */
function kindOfType(type: ProductType, name: string): string {
  if (type === "bottle" && /linen|room|pillow|home|diffuser/i.test(name)) return "kind-home";
  if (type === "bottle" && /parfum|perfume|eau de|mist/i.test(name)) return "kind-fragrance";
  return productTypes.find((x) => x.id === type)!.kindId;
}

type Step = "basics" | "kind" | "gaps";

export function AddProductFlow({
  open,
  onOpenChange,
  onAdded,
  onCsv,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once it is added. Round 8: by default it stays in the list, with a toast. */
  onAdded?: (product: Product) => void;
  /** Many products at once: Import products (round 7: website, CSV or zip). */
  onCsv?: () => void;
}) {
  const kinds = useProductKinds();
  const read = useReadProduct();
  const save = useSaveProductSpecs();
  const toast = useToast();
  const [step, setStep] = useState<Step>("basics");
  const [chosen, setChosen] = useState<ProductKind>();
  const [name, setName] = useState("");
  // Round 9: the button is never greyed out; pressed with no name, it says so under Name.
  const [noName, setNoName] = useState(false);
  const [type, setType] = useState<ProductType | "">("");
  const [typeChosen, setTypeChosen] = useState(false);
  const [measures, setMeasures] = useState<Record<string, { value: string; unit: string }>>({});
  const [url, setUrl] = useState("");
  const [shots, setShots] = useState<Record<string, { name: string; bytes: number; src: string }>>({});
  const [product, setProduct] = useState<Product>();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const typeGuess = guessType(name);
  const productType = typeChosen ? type : (typeGuess ?? type);
  const typeDef = productTypes.find((x) => x.id === productType);
  const guessed = useMemo(() => {
    if (!kinds.data) return undefined;
    const byName = guessKind(kinds.data, `${name} ${url.replace(/^https?:\/\/[^/]+/, "")}`);
    if (byName && byName.id !== "kind-other") return byName;
    return productType ? kinds.data.find((k) => k.id === kindOfType(productType, name)) : undefined;
  }, [kinds.data, name, url, productType]);
  const kind = chosen ?? guessed;
  // "100 ml · 12 cm": the measures as one line, the first the product's size
  const variant = (typeDef?.measures ?? [])
    .map((m) => {
      const v = measures[m.id];
      const unit = v?.unit ?? m.units[0]!;
      if (wordUnit(unit)) return v?.unit ? unit : "";
      return v?.value.trim() ? `${v.value.trim().replace(",", ".")} ${unit}` : "";
    })
    .filter(Boolean)
    .join(" · ");
  const baseKind = kind ?? kinds.data?.find((k) => k.id === OTHER);
  // The photos follow the type when there is one (round 13, #45), else the kind's own
  const slotsKind = baseKind && productType ? { ...baseKind, shots: typeShots[productType] } : baseKind;

  function reset() {
    setStep("basics");
    setChosen(undefined);
    setName("");
    setNoName(false);
    setType("");
    setTypeChosen(false);
    setMeasures({});
    setUrl("");
    setShots({});
    setProduct(undefined);
    setDrafts({});
  }
  /** It is in the list now: say what is left, and close. */
  function landed(p: Product) {
    const k = kinds.data?.find((x) => x.id === p.kindId);
    const left = missingDetails(p, k);
    // round 13 (robot note 05): the same words the confirm queue uses for it
    toast.done(`${p.name} added.`, { description: left ? `${copy.count(left, "detail")} missing. It waits in your products to confirm.` : "It only needs a look. It waits in your products to confirm." });
    onAdded?.(p);
    onOpenChange(false);
    reset();
  }
  function close(next: boolean) {
    if (!next && product) return landed(product);
    onOpenChange(next);
    if (!next) reset();
  }

  const fields = kind ? fieldsOf(kind) : [];
  const field = (id: string) => fields.find((f) => f.id === id);
  // The gaps: fields the Engine needs and did not read. Long lists stay short: the first four, the rest later.
  const gaps = useMemo(() => fields.filter((f) => f.required && !(product?.specs ?? []).some((s) => s.fieldId === f.id)), [fields, product]);
  const shownGaps = gaps.slice(0, 4);
  const neededShots = slotsKind?.shots.filter((s) => s.required) ?? [];
  const missingShots = neededShots.filter((s) => !shots[s.id]);

  function submitBasics(e: FormEvent) {
    e.preventDefault();
    const k = kind ?? kinds.data?.find((x) => x.id === OTHER);
    if (!name.trim()) {
      setNoName(true);
      document.getElementById("add-name")?.focus();
      return;
    }
    if (!k) return;
    const page = url.trim() ? (/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`) : undefined;
    read.mutate(
      { kindId: k.id, name: name.trim(), variant: variant.trim(), url: page, shots: Object.entries(shots).map(([slotId, s]) => ({ slotId, ...s })) },
      {
        onSuccess: (p) => {
          const open = fieldsOf(k).filter((f) => f.required && !(p.specs ?? []).some((s) => s.fieldId === f.id));
          if (!open.length) return landed(p);
          setChosen(k);
          setProduct(p);
          setStep("gaps");
        },
        onError: (error) => toast.error("The product wasn’t added", { description: error.message }),
      },
    );
  }

  function submitGaps(e: FormEvent) {
    e.preventDefault();
    if (!product || !kind) return;
    const values: { fieldId: string; value: SpecValue; unit?: string }[] = [];
    for (const [fieldId, d] of Object.entries(drafts)) {
      const f = field(fieldId);
      const v = f && valueOf(f, d);
      if (v) values.push({ fieldId, ...v });
    }
    if (!values.length) return landed(product);
    save.mutate({ productId: product.id, values }, { onSuccess: (p) => landed(p), onError: (error) => toast.error("That wasn’t saved", { description: error.message }) });
  }

  const draft = (f: SpecField) => drafts[f.id] ?? draftOf(f, product?.specs?.find((s) => s.fieldId === f.id));
  const setDraft = (f: SpecField, d: Draft) => setDrafts((now) => ({ ...now, [f.id]: d }));

  const title = step === "kind" ? "What kind of product is it?" : step === "basics" ? "Add a product" : `What Fume still needs for ${product?.name ?? name}`;
  const description =
    step === "kind"
      ? "It decides what Fume asks for: a serum needs other measures than a shirt."
      : step === "basics"
        ? "Its name, its page or a photo. Fume reads the rest and asks only for what it cannot see."
        : "Fill in what you know. The rest can wait.";

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <SheetBody>
          {step === "kind" &&
            (kinds.data ? (
              <KindGrid
                kinds={kinds.data}
                value={kind?.id}
                onPick={(k) => {
                  setChosen(k);
                  setStep("basics");
                }}
              />
            ) : (
              <Spinner label="Loading the kinds" />
            ))}

          {step === "basics" && (
            <form id="add-basics" onSubmit={submitBasics} className="ui-pspec-step" aria-label="Add a product">
              <FieldGroup>
                <Field invalid={noName && !name.trim()}>
                  <FieldLabel htmlFor="add-name">Name</FieldLabel>
                  <Input
                    id="add-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-invalid={noName && !name.trim()}
                    aria-describedby="add-name-error"
                    autoComplete="off"
                    data-ui-autofocus
                  />
                  <FieldError id="add-name-error">{noName && !name.trim() ? "Its name first; Fume reads the rest." : undefined}</FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="add-type">Product type</FieldLabel>
                  <NativeSelect
                    id="add-type"
                    value={productType}
                    aria-describedby="add-type-help"
                    onChange={(e) => {
                      setTypeChosen(true);
                      setType(e.target.value as ProductType);
                      setMeasures({});
                    }}
                  >
                    {!productType && (
                      <option value="" disabled>
                        Choose a type
                      </option>
                    )}
                    {productTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </NativeSelect>
                  <FieldDescription id="add-type-help">
                    {!typeChosen && typeGuess ? "Fume chose it from the name. It decides which measures are asked." : "It decides which measures are asked."}
                  </FieldDescription>
                </Field>
                {typeDef?.measures.map((m) => {
                  const v = measures[m.id] ?? { value: "", unit: m.units[0]! };
                  const set = (change: Partial<typeof v>) => setMeasures((now) => ({ ...now, [m.id]: { ...v, ...change } }));
                  return (
                    <Field key={`${productType}-${m.id}`}>
                      <FieldLabel htmlFor={`add-m-${m.id}`}>
                        {m.label} <FieldOptional />
                      </FieldLabel>
                      <div className="ui-measure">
                        {!wordUnit(v.unit) && (
                          <Input id={`add-m-${m.id}`} inputMode="decimal" value={v.value} onChange={(e) => set({ value: e.target.value.replace(/[^0-9.,]/g, "") })} autoComplete="off" />
                        )}
                        <NativeSelect
                          id={wordUnit(v.unit) ? `add-m-${m.id}` : undefined}
                          aria-label={wordUnit(v.unit) ? undefined : `${m.label}: unit`}
                          value={v.unit}
                          onChange={(e) => set({ unit: e.target.value })}
                          disabled={m.units.length < 2}
                        >
                          {m.units.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                    </Field>
                  );
                })}
                <div className="ui-pspec-kind" aria-live="polite">
                  <span className="ui-pspec-need">{kind ? `${chosen ? "Kind" : "Looks like"}: ${kind.name}` : name.trim() ? "Kind: not sure yet" : "Fume proposes the kind from the name"}</span>
                  <Button size="sm" variant="glass-clear" type="button" onClick={() => setStep("kind")} aria-label={kind ? `Change the kind, now ${kind.name}` : "Choose the kind"}>
                    {kind ? "Change" : "Choose"}
                  </Button>
                </div>
                <Field>
                  <FieldLabel htmlFor="add-url">
                    Product page <FieldOptional />
                  </FieldLabel>
                  <Input id="add-url" type="text" inputMode="url" autoComplete="url" spellCheck={false} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="lysne.no/products/…" />
                </Field>
              </FieldGroup>
              {slotsKind && (
                <div className="ui-pspec-group">
                  <p className="ui-pspec-sub">Photos on white{missingShots.length ? ` · ${copy.count(missingShots.length, "more angle")} would help` : ""}</p>
                  <ShotGrid
                    kind={slotsKind}
                    shots={Object.entries(shots).map(([slotId, s]) => ({ slotId, image: s.src, provenance: { origin: "customer", state: "approved" } }))}
                    onPick={(slotId, file) => setShots((now) => ({ ...now, [slotId]: { name: file.name, bytes: file.size, src: previewOf(file) } }))}
                    label={`Photos of ${name.trim() || "the product"}`}
                  />
                </div>
              )}
            </form>
          )}

          {step === "gaps" && product && kind && (
            <form id="add-gaps" onSubmit={submitGaps} className="ui-pspec-step" aria-label={`What Fume still needs for ${product.name}`}>
              <FieldGroup>
                {shownGaps.map((f, i) => (
                  <SpecInput key={f.id} field={f} draft={draft(f)} onDraft={(d) => setDraft(f, d)} idPrefix="gap" autoFocus={i === 0} />
                ))}
              </FieldGroup>
              {gaps.length > shownGaps.length && <p className="ui-pspec-sub">{gaps.length - shownGaps.length} more can wait for its page.</p>}
            </form>
          )}
        </SheetBody>
        <SheetFooter>
          {step === "kind" && (
            <Button variant="glass-clear" icon="arrow-left" onClick={() => setStep("basics")}>
              Back
            </Button>
          )}
          {step === "basics" && (
            <>
              {onCsv ? (
                <Button
                  variant="glass-clear"
                  onClick={() => {
                    close(false);
                    onCsv();
                  }}
                >
                  Many products? Import them
                </Button>
              ) : (
                <SheetClose asChild>
                  <Button variant="glass-clear">Later</Button>
                </SheetClose>
              )}
              <Button type="submit" form="add-basics" variant="glass-white" loading={read.isPending || !kinds.data}>
                Let Fume read it
              </Button>
            </>
          )}
          {step === "gaps" && (
            <>
              <Button variant="glass-clear" onClick={() => close(false)}>
                Later
              </Button>
              <Button type="submit" form="add-gaps" variant="glass-white" loading={save.isPending}>
                Save
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Choose or change the kind of a product that has none yet: a picture grid, in the right panel on a desk. */
export function KindDialog({ open, onOpenChange, value, onPick, busy }: { open: boolean; onOpenChange: (open: boolean) => void; value?: string; onPick: (k: ProductKind) => void; busy?: boolean }) {
  const kinds = useProductKinds();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>What kind of product is it?</SheetTitle>
          <SheetDescription>It decides what Fume asks for. What is already known stays.</SheetDescription>
        </SheetHeader>
        <SheetBody>{kinds.data ? <KindGrid kinds={kinds.data} value={value} onPick={onPick} /> : <Spinner label="Loading the kinds" />}</SheetBody>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="glass-clear" disabled={busy}>
              Later
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
