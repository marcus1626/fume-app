// Round 13 (Marcus's video comment #46; PROPOSED 22 Oct 2026): the product's page and the product check show much more
// of what Fume holds about a product, in one organised sheet: measures and parts, materials and finish, colours with
// their codes, the label's texts, the variants, the claims (and what never to say) and where it all came from. Every
// value Fume holds is here, read or given; changing one is still done on its line above or under All details. The look
// is r13-brand.css.
import { DataList, DataListItem } from "@fume/ui";
import type { CSSProperties } from "react";
import type { ColourValue, Product, ProductFact, ProductFactArea, ProductFile, ProductKind, SpecGroupId } from "../../contract";
import * as copy from "../../copy";
import { coloursIn, filled, valueWords } from "./spec";

type BlockId = "measures" | "materials" | "colours" | "label" | "variants" | "claims";

const blockTitle: Record<BlockId, string> = {
  measures: "Measures and parts",
  materials: "Materials and finish",
  colours: "Colours, with their codes",
  label: "Label texts",
  variants: "Variants",
  claims: "Claims and use",
};

const blockOfGroup: Record<SpecGroupId, BlockId> = {
  identity: "measures",
  size: "measures",
  materials: "materials",
  packaging: "materials",
  construction: "materials",
  decoration: "materials",
  formula: "materials",
  trims: "materials",
  care: "claims",
  label: "label",
  variants: "variants",
  use: "claims",
};

const blockOfFact: Record<ProductFactArea, BlockId> = {
  shape: "measures",
  colour: "colours",
  material: "materials",
  label: "label",
  packaging: "materials",
  claim: "claims",
  never: "claims",
};

const fileWord: Record<ProductFile["kind"], string> = {
  model: "3D model",
  dieline: "Dieline",
  artwork: "Label artwork",
  techpack: "Tech pack",
  flats: "Flats",
  cad: "CAD",
  spec: "Spec sheet",
};

interface Row {
  key: string;
  label: string;
  value: string;
  colours?: ColourValue[];
}

const Swatch = ({ c }: { c: ColourValue }) => (
  <span className="ui-truth-colour">
    <span className="ui-truth-swatch" style={{ "--swatch": c.hex } as CSSProperties} aria-hidden="true" />
    <span>{c.name}</span>
    <span className="ui-truth-code">{[c.hex.toUpperCase(), c.pantone].filter(Boolean).join(" · ")}</span>
  </span>
);

/** Every value Fume holds about a product, in six blocks and its sources. Empty blocks are left out. */
export function ProductTruthSheet({ product, kind, title = "Everything Fume holds" }: { product: Product; kind?: ProductKind; title?: string }) {
  const blocks: Record<BlockId, Row[]> = { measures: [], materials: [], colours: [], label: [], variants: [], claims: [] };
  const specs = product.specs ?? [];

  // the kind's fields, in the kind's order, each in its block (a value with colours goes to Colours)
  for (const g of kind?.groups ?? [])
    for (const f of g.fields) {
      const e = specs.find((s) => s.fieldId === f.id);
      if (!e || !filled(e.value)) continue;
      const colours = coloursIn(e.value);
      if (colours.length) blocks.colours.push({ key: f.id, label: f.label, value: "", colours });
      else blocks[blockOfGroup[g.id]].push({ key: f.id, label: f.label, value: valueWords(f, e) });
    }
  // the parts: what each is made of, its finish and its colour
  for (const part of product.parts ?? []) {
    const words = [part.material, part.finish && part.finish.charAt(0).toUpperCase() + part.finish.slice(1), part.opacity, part.decoration, part.note].filter(Boolean).join(" · ");
    blocks.measures.push({ key: `part-${part.id}`, label: part.name, value: words || "A part of the product" });
    if (part.colour) blocks.colours.push({ key: `part-colour-${part.id}`, label: part.name, value: "", colours: [part.colour] });
  }
  // the Product Truth lines, where the kind holds no value of the same name
  const named = new Set(Object.values(blocks).flatMap((rows) => rows.map((r) => r.label.toLowerCase())));
  for (const f of product.facts.filter((x: ProductFact) => x.source !== "unknown")) {
    if (named.has(f.label.toLowerCase()) && f.area !== "never" && f.area !== "claim") continue;
    blocks[blockOfFact[f.area]].push({ key: `fact-${f.id}`, label: f.area === "never" ? `Never: ${f.label.toLowerCase()}` : f.label, value: f.statement });
  }
  // the variants
  if (product.variant) blocks.variants.unshift({ key: "variant", label: "As sold", value: product.variant });
  if (product.sku) blocks.variants.push({ key: "sku", label: "SKU", value: product.sku });
  for (const v of product.variants ?? []) blocks.variants.push({ key: `v-${v.id}`, label: v.name, value: v.sku ? `SKU ${v.sku}` : "A variant" });

  // where it came from: each source once, with how many values it gave; the files she added
  const sources = new Map<string, number>();
  const from = (e?: string) => e && sources.set(e, (sources.get(e) ?? 0) + 1);
  specs.forEach((s) => from(s.provenance.evidence));
  (product.parts ?? []).forEach((x) => from(x.provenance.evidence));
  (product.shots ?? []).forEach((x) => from(x.provenance.evidence));
  if (product.provenance?.evidence && !sources.has(product.provenance.evidence)) sources.set(product.provenance.evidence, 0);
  const given = specs.filter((s) => s.provenance.origin === "customer").length;
  const files = product.files ?? [];

  const order: BlockId[] = ["measures", "materials", "colours", "label", "variants", "claims"];
  const shown = order.filter((b) => blocks[b].length > 0);
  if (!shown.length && !sources.size && !files.length) return null;

  return (
    <section className="ui-truth" aria-labelledby={`truth-${product.id}`}>
      <h2 className="ui-truth-title" id={`truth-${product.id}`}>
        {title}
      </h2>
      <div className="ui-truth-blocks">
        {shown.map((b) => (
          <section key={b} className="ui-truth-block" aria-labelledby={`truth-${product.id}-${b}`}>
            <h3 className="ui-truth-block-title" id={`truth-${product.id}-${b}`}>
              {blockTitle[b]}
            </h3>
            <DataList variant="stacked">
              {blocks[b].map((r) => (
                <DataListItem key={r.key} label={r.label}>
                  {r.colours ? (
                    <span className="ui-truth-colours">
                      {r.colours.map((c) => (
                        <Swatch key={`${c.name}-${c.hex}`} c={c} />
                      ))}
                    </span>
                  ) : (
                    r.value
                  )}
                </DataListItem>
              ))}
            </DataList>
          </section>
        ))}
        {(sources.size > 0 || files.length > 0 || given > 0) && (
          <section className="ui-truth-block" aria-labelledby={`truth-${product.id}-sources`}>
            <h3 className="ui-truth-block-title" id={`truth-${product.id}-sources`}>
              Sources
            </h3>
            <DataList variant="stacked">
              {[...sources].map(([s, n]) => (
                <DataListItem key={s} label={s}>
                  {n ? `${copy.count(n, "value")} read here` : "Where Fume found the product"}
                </DataListItem>
              ))}
              {given > 0 && <DataListItem label="Given by your team">{copy.count(given, "value")}</DataListItem>}
              {files.map((f) => (
                <DataListItem key={f.id} label={fileWord[f.kind]}>
                  {f.name}
                  {f.read?.length ? ` · ${f.read[0]}` : ""}
                </DataListItem>
              ))}
            </DataList>
          </section>
        )}
      </div>
    </section>
  );
}
