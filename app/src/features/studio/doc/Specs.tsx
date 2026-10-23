// The desk's left panel (FLOWS §9.1): specs only. The mode picker on top (a grid menu in a popover, filtered by the
// studio), then folding sections with only the specs the mode uses: format, count and image model; the brand's
// references (library, upload, make one); the product and its Product Truth, each fact changeable for this creative
// or for the product itself (FLOWS §9.5); the brand's models with their state (FLOWS §9.6). Design shows the layers
// in place of the product's data.
// Round 12 (UX review DLAY-3, DLOAD-15, PROPOSED 20 Oct 2026): the panel scrolls when its open part is taller than
// it (nothing is cut off any more), and the product is one row with only what needs a look under it: the details the
// picked version reads wrong and the facts changed for this creative. "All 20 facts" opens the whole product in a
// right panel over the board (measures, parts and every Product Truth line, each changeable there).
// Round 13 (#60, Marcus: "what happens if you switch in the middle of a project?"): a mode switch asks first, in the
// popover, and says what carries over, what is set aside (kept in the last version) and that the versions stay.
import {
  Button,
  Icon,
  Progress,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  PickGrid,
  PickTrigger,
  ProductSheetButton,
  ProductTile,
  StudioFolds,
  StudioModeGrid,
  StudioNumber,
  StudioSegmented,
  StudioSelect,
  type StudioFold,
  useToast,
} from "@fume/ui";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDetailTokens, useOpenDocument, useOverrideProduct, usePlacements, useProduct, useProductKinds, useStudioKit } from "../../../api/hooks";
import type { BrandAssetsView, CreativeDocument, Format, Layer, ProductOverride, Specs, StudioMode } from "../../../contract";
import * as copy from "../../../copy";
import { AllProductsSheet, confirmed } from "../../fume/AllProducts";
import { fidelity, pct, valueWords } from "../../products/spec";
import { partLine, Swatch } from "../../products/specs";
import { useOpenFlags } from "./sendCheck";
import { FixHistory } from "./fix";
import { PlacementPicker, placementOf } from "./formats";

/** Staff only: the image models the Engine can route to. Never shown to a customer. */
const IMAGE_MODELS = ["Nano Banana Pro", "Seedream 4", "FLUX Kontext Pro", "Imagen 4"];
const FORMATS: Format[] = ["feed", "square", "story"];

export interface SpecsProps {
  doc: CreativeDocument;
  mode?: StudioMode;
  modes: StudioMode[];
  specs: Specs;
  layers: Layer[];
  assets?: BrandAssetsView;
  brandName: string;
  approver: string;
  name: (id: string | undefined) => string;
  onSpecs: (specs: Specs, key: string) => void;
  onLayers: (layers: Layer[], key: string) => void;
  onMode: (modeId: string) => void;
  selectedLayer?: string;
  onSelectLayer: (id: string | undefined) => void;
}

export function SpecsPanel(props: SpecsProps) {
  const { doc, mode, modes, specs, brandName } = props;
  const uses = new Set(mode?.uses ?? []);
  const isDesign = doc.studio === "design";
  const sections: StudioFold[] = [];
  const placements = usePlacements().data;
  const placement = placements && mode?.output === "creative" ? placementOf(specs, placements) : undefined;

  sections.push({
    id: "Output",
    title: "Output",
    meta: `${placement?.name ?? copy.format[specs.format].label} · ${specs.count}`,
    children: (
      <>
        {mode?.output === "creative" &&
          (placements ? (
            <PlacementPicker placements={placements} specs={specs} onPick={(p) => props.onSpecs({ ...specs, placementId: p.id, format: p.format }, "placement")} />
          ) : (
            <StudioSegmented
              label="Format"
              id="spec-format"
              value={specs.format}
              options={FORMATS.map((f) => ({ value: f, label: copy.format[f].label }))}
              onChange={(f) => props.onSpecs({ ...specs, format: f as Format, placementId: undefined }, "format")}
            />
          ))}
        {(uses.has("count") || !isDesign) && (
          <StudioNumber label="Count" id="spec-count" value={specs.count} min={1} max={8} onChange={(n) => props.onSpecs({ ...specs, count: n }, "count")} />
        )}
        <StudioSelect
          label="Generator"
          id="spec-model"
          value={specs.imageModel}
          options={IMAGE_MODELS.map((m) => ({ value: m, label: m }))}
          help="Fume’s people only."
          onChange={(m) => props.onSpecs({ ...specs, imageModel: m }, "imageModel")}
        />
      </>
    ),
  });

  if (isDesign) sections.push({ id: "Layers", title: "Layers", meta: props.layers.length, children: <LayerList {...props} /> });
  else if (uses.has("product")) sections.push({ id: "Product", title: "Product", meta: doc.overrides.length || doc.fixes?.length ? [doc.overrides.length && `${doc.overrides.length} changed`, doc.fixes?.length && `${doc.fixes.length} fixed`].filter(Boolean).join(" · ") : undefined, children: <ProductData {...props} /> });
  if (uses.has("reference")) sections.push({ id: "References", title: "References", meta: specs.referenceIds.length || undefined, children: <References {...props} /> });
  if (uses.has("model")) sections.push({ id: "Models", title: "Models", meta: specs.modelIds.length || undefined, children: <Models {...props} /> });

  return (
    <aside className="ui-desk-panel ui-desk-specs" aria-label="Specs">
      <ModePicker doc={doc} mode={mode} modes={modes.filter((m) => m.studio === doc.studio)} onMode={props.onMode} />
      <StudioFolds key={`${doc.modeId}-${doc.studio}`} label="Specs" sections={sections} initialOpen={["Product", "Layers", "Output", "References", "Models"].filter((id) => sections.some((s) => s.id === id))} />
      <p className="ui-sr-only">{brandName}</p>
    </aside>
  );
}

// ─── Mode picker: a grid menu in a popover ───────────────────────────────────

/** "Light and camera" from ["Light", "Camera"]. */
const listWords = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** What a switch from one mode to another does, in one sentence (#60): the sections that carry over, the ones set
 *  aside (the last version keeps them, so going back or reopening that version brings them back), the versions. */
export function switchWords(doc: CreativeDocument, from: StudioMode | undefined, to: StudioMode): string {
  const keys = new Set(to.variables.map((v) => v.key));
  const sections = from?.sections ?? [];
  // A mode's "Product" section is where the product sits in the frame; the product itself is a spec.
  const named = (s: string) => (s === "Product" ? "framing" : s);
  const carried = sections.filter((s) => from!.variables.some((v) => v.section === s && keys.has(v.key))).map(named);
  const aside = sections.map(named).filter((s) => !carried.includes(s));
  const product = from?.uses.includes("product") && doc.specs.productId;
  if (product && to.uses.includes("product")) carried.unshift("the product");
  else if (product) aside.unshift("the product");
  const last = doc.versions.at(-1);
  const lower = (xs: string[]) => xs.map((x, i) => (i === 0 ? x.charAt(0).toUpperCase() + x.slice(1) : x.toLowerCase()));
  const plural = (xs: string[]) => xs.length > 1;
  const parts = [
    carried.length ? `${listWords(lower(carried))} ${plural(carried) ? "carry" : "carries"} over` : "Nothing carries over",
    aside.length ? `${listWords(aside.map((x) => x.toLowerCase()))} ${aside.length === 1 ? "is" : "are"} set aside${last ? `, kept in V${last.number}` : ""}` : undefined,
  ].filter(Boolean);
  return `${parts.join("; ")}.${doc.versions.length ? " The versions stay." : ""}`;
}

function ModePicker({ doc, mode, modes, onMode }: { doc: CreativeDocument; mode?: StudioMode; modes: StudioMode[]; onMode: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  // The mode she picked, waiting for her yes.
  const [asking, setAsking] = useState<StudioMode>();
  const close = (o: boolean) => {
    setOpen(o);
    if (!o) setAsking(undefined);
  };
  return (
    <Popover open={open} onOpenChange={close}>
      <PopoverTrigger asChild>
        <button type="button" className="ui-desk-mode">
          <span className="ui-desk-mode-text">
            <span className="ui-desk-mode-label">Mode</span>
            <span className="ui-desk-mode-name">{mode?.name ?? "Choose a mode"}</span>
          </span>
          <Icon name="layout-grid" className="ui-desk-mode-icon" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="ui-desk-mode-popover" aria-labelledby="mode-title">
        {asking ? (
          <>
            <PopoverHeader>
              <PopoverTitle id="mode-title">Switch to {asking.name}?</PopoverTitle>
              <PopoverDescription>{switchWords(doc, mode, asking)}</PopoverDescription>
            </PopoverHeader>
            <div className="ui-desk-mode-ask">
              <Button size="sm" variant="glass-clear" onClick={() => setAsking(undefined)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="glass-white"
                onClick={() => {
                  onMode(asking.id);
                  close(false);
                }}
              >
                Switch to {asking.name}
              </Button>
            </div>
          </>
        ) : (
          <>
            <PopoverHeader>
              <PopoverTitle id="mode-title">Modes</PopoverTitle>
              <PopoverDescription>Each mode asks only for what it needs. A switch asks first.</PopoverDescription>
            </PopoverHeader>
            <StudioModeGrid
              compact
              modes={modes}
              value={mode?.id}
              aria-label="Modes"
              onPick={(id) => {
                const next = modes.find((m) => m.id === id);
                if (!next || id === mode?.id) return close(false);
                setAsking(next);
              }}
            />
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─── Product and its Product Truth ───────────────────────────────────────────

function overrideWords(o: ProductOverride, name: (id: string) => string, approver: string, field: string) {
  const who = name(o.by);
  const what = field.toLowerCase();
  if (o.scope === "this_render") return `${who} changed the ${what} for this creative`;
  if (o.state === "proposed") return `${who} proposed this · waiting for ${approver}`;
  if (o.state === "approved") return `${approver} approved this change`;
  return `${approver} kept the product as it was`;
}

function ProductData(props: SpecsProps) {
  const { doc, specs, onSpecs } = props;
  const [all, setAll] = useState(false);
  return (
    <>
      <ProductPicker workspaceId={doc.workspaceId} value={specs.productId} approver={props.approver} onPick={(id) => onSpecs({ ...specs, productId: id, variantId: undefined }, "product")} />
      {specs.productId && <ProductLook {...props} productId={specs.productId} onAll={() => setAll(true)} />}
      {specs.productId && <Fixes doc={doc} productId={specs.productId} name={props.name} />}
      {specs.productId && <AllFacts {...props} productId={specs.productId} open={all} onOpenChange={setAll} />}
    </>
  );
}

/** Under the product: how ready it is for the Engine, then only what needs a look (the details the picked version
 *  reads wrong, the facts changed for this creative), then the way to all of it. */
function ProductLook({ doc, name, approver, productId, onAll }: SpecsProps & { productId: string; onAll: () => void }) {
  const product = useProduct(productId).data;
  const kind = useProductKinds().data?.find((k) => k.id === product?.kindId);
  const { flags } = useOpenFlags(doc);
  if (!product) return null;
  const facts = product.facts.filter((f) => f.area !== "never" && f.area !== "claim");
  const changed = facts.filter((f) => doc.overrides.some((o) => o.field === f.label && o.state !== "declined"));
  const fid = kind ? fidelity(product, kind) : undefined;
  const measures = kind ? specRows(product, kind).length + (product.parts?.length ?? 0) : 0;
  const total = facts.length + measures;
  return (
    <div className="ui-sc">
      {fid && (
        <p className="ui-desk-product-ready">
          {kind!.name} · {pct(fid.score)} ready for the Engine
        </p>
      )}
      {flags.length + changed.length > 0 ? (
        <ul className="ui-desk-facts" aria-label="What needs a look">
          {flags.map(({ find, token }) => (
            <li key={find.tokenId}>
              <p className="ui-desk-flag">
                <Icon name="triangle-alert" />
                <span>
                  {token ? `${token.label} reads ${find.read}, should be ${token.value}` : `It reads ${find.read}`}
                  <span className="ui-desk-flag-note"> · on the picked version</span>
                </span>
              </p>
            </li>
          ))}
          {changed.map((f) => (
            <FactRow key={f.id} doc={doc} fact={f} name={name} approver={approver} />
          ))}
        </ul>
      ) : (
        <p className="ui-sc-help">Nothing flagged or changed on the picked version.</p>
      )}
      <Button size="sm" variant="quiet" icon="list" className="ui-desk-all-facts" onClick={onAll}>
        All {total} facts
      </Button>
    </div>
  );
}

/** The kind's measure and part fields that the product has a value for. */
function specRows(product: NonNullable<ReturnType<typeof useProduct>["data"]>, kind: NonNullable<ReturnType<typeof useProductKinds>["data"]>[number]) {
  return kind.groups
    .filter((g) => ["size", "materials", "construction", "formula", "label"].includes(g.id))
    .flatMap((g) => g.fields)
    .map((f) => ({ f, e: product.specs?.find((s) => s.fieldId === f.id) }))
    .filter((x): x is { f: (typeof x)["f"]; e: NonNullable<(typeof x)["e"]> } => Boolean(x.e));
}

/** The whole product in a right panel over the board: its measures and parts, then every Product Truth line. */
function AllFacts({ doc, name, approver, productId, open, onOpenChange }: SpecsProps & { productId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const product = useProduct(productId).data;
  const kind = useProductKinds().data?.find((k) => k.id === product?.kindId);
  if (!product) return null;
  const facts = product.facts.filter((f) => f.area !== "never" && f.area !== "claim");
  const rows = kind ? specRows(product, kind) : [];
  const fid = kind ? fidelity(product, kind) : undefined;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg" className="ui-desk-sheet">
        <SheetHeader>
          <SheetTitle>
            {product.name} · {product.variant}
          </SheetTitle>
          <SheetDescription>Its Product Truth, as {approver} confirmed it. Change a line for this creative, or propose it for the product.</SheetDescription>
        </SheetHeader>
        <SheetBody>
          {fid && (
            <div className="ui-desk-sheet-ready">
              <span id={`ready-${product.id}`}>
                {kind!.name} · {pct(fid.score)} ready for the Engine
              </span>
              <Progress glass value={Math.round(fid.score * 100)} aria-labelledby={`ready-${product.id}`} />
            </div>
          )}
          <section className="ui-desk-sheet-part" aria-labelledby="facts-truth">
            <h3 className="ui-desk-sheet-head" id="facts-truth">
              Product Truth
            </h3>
            <ul className="ui-desk-facts">
              {facts.map((f) => (
                <FactRow key={f.id} doc={doc} fact={f} name={name} approver={approver} side="left" />
              ))}
            </ul>
          </section>
          {rows.length + (product.parts?.length ?? 0) > 0 && (
            <section className="ui-desk-sheet-part" aria-labelledby="facts-measures">
              <h3 className="ui-desk-sheet-head" id="facts-measures">
                Measures and parts
              </h3>
              <dl className="ui-desk-sheet-rows">
                {rows.map(({ f, e }) => (
                  <div key={f.id}>
                    <dt>{f.label}</dt>
                    <dd>{valueWords(f, e)}</dd>
                  </div>
                ))}
                {(product.parts ?? []).map((p) => (
                  <div key={p.id}>
                    <dt>{p.name}</dt>
                    <dd>
                      {p.colour && <Swatch colour={p.colour} finish={p.finish} />}
                      {[p.colour?.name, partLine(p)].filter(Boolean).join(" · ")}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

/** One Product Truth line; a changed line shows who changed it and for what. */
function FactRow({ doc, fact, name, approver, side = "right" }: { doc: CreativeDocument; fact: { id: string; label: string; statement: string }; name: SpecsProps["name"]; approver: string; side?: "left" | "right" }) {
  const mine = doc.overrides.filter((o) => o.field === fact.label && o.state !== "declined");
  const shown = mine.find((o) => o.scope === "this_render") ?? mine.find((o) => o.state === "approved");
  return (
    <li>
      <FactEditor doc={doc} field={fact.label} statement={shown?.value ?? fact.statement} truth={fact.statement} changed={Boolean(shown)} side={side} />
      {mine.map((o) => (
        <p key={o.id} className="ui-desk-fact-who" data-scope={o.scope}>
          <Icon name={o.scope === "product" && o.state === "proposed" ? "clock" : "pencil"} />
          {overrideWords(o, name, approver, fact.label)}
        </p>
      ))}
    </li>
  );
}

/** The product as a picture; it opens the brand's products as a grid of tiles (Marcus 15 Oct: products as a grid,
 *  never a list of names). The popover holds the few confirmed products, the current one first, and "View all
 *  products" opens the whole catalogue in the shared sheet (walk-through Must 1): search, kinds and collections, and
 *  a lock on products whose facts the customer has not confirmed. */
const RECENT = 6;
function ProductPicker({ workspaceId, value, approver, onPick }: { workspaceId: string; value?: string; approver: string; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const products = useStudioKit(workspaceId).data?.products ?? [];
  const current = products.find((p) => p.id === value);
  const usable = products.filter(confirmed);
  const recent = [...(current ? [current] : []), ...usable.filter((p) => p.id !== value)].slice(0, RECENT);
  const pick = (id: string) => {
    setOpen(false);
    if (id !== value) onPick(id);
  };
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <PickTrigger label="Product" name={current ? `${current.name} · ${current.variant}` : "Pick a product"} src={current?.images[0]} aria-label={current ? `Product: ${current.name}, ${current.variant}. Change` : "Pick a product"} />
        </PopoverTrigger>
        <PopoverContent side="right" align="start" className="ui-pick-popover" aria-labelledby="product-pick-title">
          <PopoverHeader>
            <PopoverTitle id="product-pick-title">Products</PopoverTitle>
            <PopoverDescription>The product this creative shows, with its Product Truth. Only products with confirmed facts.</PopoverDescription>
          </PopoverHeader>
          <PickGrid aria-label="Products">
            {recent.map((p) => (
              <ProductTile key={p.id} name={p.name} variant={p.variant} src={p.images[0]} selected={p.id === value} onSelectedChange={() => pick(p.id)} />
            ))}
          </PickGrid>
          <ProductSheetButton
            glass
            count={products.length}
            onClick={() => {
              setOpen(false);
              setAll(true);
            }}
          />
        </PopoverContent>
      </Popover>
      <AllProductsSheet open={all} onOpenChange={setAll} value={value ? [value] : []} onPick={([id]) => id && pick(id)} staff confirmer={approver} />
    </>
  );
}

/** The product fixes on this creative, the Engine's automatic ones marked as its own (FLOWS §17). */
function Fixes({ doc, productId, name }: { doc: CreativeDocument; productId: string; name: SpecsProps["name"] }) {
  const tokens = useDetailTokens(productId).data ?? [];
  return <FixHistory doc={doc} tokens={tokens} name={name} />;
}

function FactEditor({ doc, field, statement, truth, changed, side = "right" }: { doc: CreativeDocument; field: string; statement: string; truth: string; changed: boolean; side?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(statement);
  const override = useOverrideProduct();
  const toast = useToast();
  const save = (scope: "this_render" | "product") =>
    override.mutate(
      { documentId: doc.id, field, value: text.trim(), scope },
      {
        onSuccess: () => {
          setOpen(false);
          toast.done(scope === "this_render" ? `${field} changed for this creative` : `${field}: proposed to the customer`, {
            description: scope === "this_render" ? "The expert sees it in the check." : "The product changes once the customer approves.",
          });
        },
        onError: (e) => toast.error("That didn’t save", { description: e.message }),
      },
    );
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setText(statement);
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className="ui-desk-fact" data-changed={changed ? "" : undefined} aria-label={`${field}: ${statement}. Change`}>
          <span className="ui-desk-fact-label">{field}</span>
          <span className="ui-desk-fact-text">{statement}</span>
          <Icon name="pencil" className="ui-desk-fact-icon" />
        </button>
      </PopoverTrigger>
      <PopoverContent side={side} align="start" className="ui-desk-fact-popover" aria-labelledby={`fact-${field}`}>
        <PopoverHeader>
          <PopoverTitle id={`fact-${field}`}>{field}</PopoverTitle>
          <PopoverDescription>Product Truth: {truth}</PopoverDescription>
        </PopoverHeader>
        <textarea className="ui-textarea ui-desk-fact-field" rows={3} value={text} aria-label={`${field}, changed`} onChange={(e) => setText(e.target.value)} />
        <div className="ui-desk-fact-actions">
          <Button size="sm" variant="glass-clear" disabled={!text.trim() || text.trim() === truth || override.isPending} onClick={() => save("product")}>
            Change the product
          </Button>
          <Button size="sm" variant="glass-white" loading={override.isPending} disabled={!text.trim() || text.trim() === truth} onClick={() => save("this_render")}>
            For this creative
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── References: the brand's library, upload, make one ───────────────────────

function References({ doc, specs, onSpecs, assets }: SpecsProps) {
  const open = useOpenDocument();
  const navigate = useNavigate();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const refs = assets?.references ?? [];
  const toggle = (id: string) =>
    onSpecs({ ...specs, referenceIds: specs.referenceIds.includes(id) ? specs.referenceIds.filter((x) => x !== id) : [...specs.referenceIds, id] }, "references");
  return (
    <>
      <ul className="ui-desk-thumbs" aria-label="The brand’s references">
        {refs.map((r) => {
          const on = specs.referenceIds.includes(r.id);
          return (
            <li key={r.id}>
              <button type="button" className="ui-desk-thumb" aria-pressed={on} title={`${r.name}${r.state === "draft" ? " (draft)" : ""}`} aria-label={`${r.name}${r.state === "draft" ? ", draft" : ""}`} onClick={() => toggle(r.id)}>
                <img src={r.image} alt="" />
                {on && <Icon name="check" className="ui-desk-thumb-check" />}
                {r.state === "draft" && <span className="ui-desk-thumb-tag">Draft</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="ui-desk-row-actions">
        <input
          ref={file}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) toast.info(`${f.name} is ready for the library`, { description: "Fume keeps uploads once the backend stores them." });
            e.target.value = "";
          }}
        />
        <Button size="sm" variant="quiet" icon="upload" onClick={() => file.current?.click()}>
          Upload
        </Button>
        <Button
          size="sm"
          variant="quiet"
          icon="image-plus"
          loading={open.isPending}
          onClick={() =>
            open.mutate(
              { workspaceId: doc.workspaceId, studio: "render", modeId: "m-reference", campaignId: doc.campaignId },
              { onSuccess: (d) => navigate(`/studio/doc/${d.id}`), onError: (e) => toast.error("The reference maker didn’t open", { description: e.message }) },
            )
          }
        >
          Make a reference
        </Button>
      </div>
    </>
  );
}

// ─── Models: the brand's AI people, with their state ─────────────────────────

function Models({ specs, onSpecs, assets, name, approver }: SpecsProps) {
  const models = assets?.models ?? [];
  if (!models.length) return <p className="ui-sc-help">The brand has no models yet. Make one in Model mode.</p>;
  const state = (m: BrandAssetsView["models"][number]) =>
    m.state === "approved" ? `${approver} approved` : m.state === "saved" ? `Saved by ${name(m.savedBy)}` : m.state === "declined" ? `${approver} declined` : `Draft · ${name(m.madeBy)}`;
  const toggle = (id: string) =>
    onSpecs({ ...specs, modelIds: specs.modelIds.includes(id) ? specs.modelIds.filter((x) => x !== id) : [...specs.modelIds, id] }, "models");
  return (
    <ul className="ui-desk-models" aria-label="The brand’s models">
      {models.map((m) => {
        const usable = m.state === "approved" || m.state === "saved";
        const on = specs.modelIds.includes(m.id);
        return (
          <li key={m.id}>
            <button type="button" className="ui-desk-model" aria-pressed={on} disabled={!usable} onClick={() => toggle(m.id)}>
              <span className="ui-desk-model-img">
                <img src={m.image} alt="" />
                <span className="ui-desk-ai">AI model</span>
              </span>
              <span className="ui-desk-model-text">
                <span className="ui-desk-model-name">{m.name}</span>
                <span className="ui-desk-model-state">{usable ? state(m) : `${state(m)} · not usable yet`}</span>
              </span>
              {on && <Icon name="check" className="ui-desk-model-check" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Layers (Design) ─────────────────────────────────────────────────────────

const layerIcon = { image: "image", text: "type", logo: "tag", shape: "square" } as const;

function LayerList({ layers, onLayers, selectedLayer, onSelectLayer }: SpecsProps) {
  return (
    <ul className="ui-desk-layer-list" aria-label="Layers">
      {[...layers].reverse().map((l) => (
        <li key={l.id} className="ui-desk-layer-row" aria-current={selectedLayer === l.id ? "true" : undefined}>
          <button type="button" className="ui-desk-layer-pick" disabled={l.locked} onClick={() => onSelectLayer(selectedLayer === l.id ? undefined : l.id)}>
            <Icon name={layerIcon[l.kind]} />
            <span className="ui-desk-layer-name">{l.name}</span>
            {l.locked && <Icon name="lock" className="ui-desk-layer-lock" />}
          </button>
          {!l.locked && (
            <Button
              size="sm"
              variant="quiet"
              iconOnly
              icon="eye"
              className="ui-desk-layer-eye"
              data-hidden={l.visible ? undefined : ""}
              aria-label={l.visible ? `Hide ${l.name}` : `Show ${l.name}`}
              onClick={() => onLayers(layers.map((x) => (x.id === l.id ? { ...x, visible: !x.visible } : x)), `layer-${l.id}-visible`)}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
