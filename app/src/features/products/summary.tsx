// The product's spec in a narrow panel, read only (round 6): for the Studio's Specs, under the product picker.
// Fume's people see what the customer holds (fidelity, measures, parts with their finishes, the label lines) and
// keep the Studio's own "change for this creative" on the Product Truth lines. One line to wire it in Specs.tsx:
//   {specs.productId && <ProductSpecSummary productId={specs.productId} />}
import { Progress } from "@fume/ui";
import { useProduct, useProductKinds } from "../../api/hooks";
import { fidelity, pct, valueWords } from "./spec";
import { partLine, Swatch } from "./specs";

export function ProductSpecSummary({ productId }: { productId: string }) {
  const product = useProduct(productId).data;
  const kinds = useProductKinds().data;
  const kind = kinds?.find((k) => k.id === product?.kindId);
  if (!product || !kind) return null;
  const fid = fidelity(product, kind);
  const fields = kind.groups
    .filter((g) => ["size", "materials", "construction", "formula", "label"].includes(g.id))
    .flatMap((g) => g.fields);
  const rows = fields.map((f) => ({ f, e: product.specs?.find((s) => s.fieldId === f.id) })).filter((x) => x.e);
  return (
    <div className="ui-pspec-group" aria-label={`${product.name}: product spec`}>
      <div className="ui-fidelity-head">
        <span className="ui-pspec-sub" id={`fid-${product.id}`}>
          {kind.name} · ready for the Engine
        </span>
        <span className="ui-pspec-sub">{pct(fid.score)}</span>
      </div>
      <Progress value={Math.round(fid.score * 100)} aria-labelledby={`fid-${product.id}`} />
      <dl className="ui-pspec-rows">
        {rows.map(({ f, e }) => (
          <div key={f.id} className="ui-pspec-row" data-state={e!.provenance.state}>
            <dt className="ui-pspec-label">{f.label}</dt>
            <dd className="ui-pspec-value">{valueWords(f, e!)}</dd>
          </div>
        ))}
        {(product.parts ?? []).map((p) => (
          <div key={p.id} className="ui-pspec-row" data-state={p.provenance.state}>
            <dt className="ui-pspec-label">{p.name}</dt>
            <dd className="ui-pspec-value">
              {p.colour && <Swatch colour={p.colour} finish={p.finish} />}
              {[p.colour?.name, partLine(p)].filter(Boolean).join(" · ")}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
