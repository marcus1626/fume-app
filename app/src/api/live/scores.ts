// The scores of a live version, typed by the studio that made it (FLOWS §35.3, DECIDED 10 Nov 2026). They are read from
// what Fume already measured, never asked of a model again: a picture from the Engine's own picture check and the
// product's parts compared with the real ones; a design from the design service's measured checks and Fume's review.
// A score under the bar is a warning for the expert, never a stop.
import type { DesignCheck, ScoreMeasure, Scores, VersionDesign } from "../../contract";

/** What the picture check keeps on a candidate (supabase/functions/_shared/engine/evaluate.ts). */
export interface StoredLook {
  artefacts?: "none" | "minor" | "major";
  printedText?: boolean;
  artefactNotes?: string[];
  items?: {
    item: string;
    area: "product" | "brand" | "scene";
    verdict: "holds" | "off" | "unclear";
    note?: string;
    hard?: boolean;
  }[];
}
/** A part of the product compared with the real one (details_finish, kind "part"). */
export interface StoredPart {
  kind?: "print" | "part";
  part?: string;
  what: string;
  ok: boolean;
  note?: string;
}

const VERDICT = { holds: 100, unclear: 60, off: 20 } as const;
const round = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const measure = (
  id: ScoreMeasure["id"],
  label: string,
  value: number,
  why?: string,
  parts?: ScoreMeasure["parts"],
): ScoreMeasure => ({
  id,
  label,
  value: round(value),
  ...(parts?.length ? { parts } : {}),
  ...(why && value < 80 ? { why } : {}),
});
const sentence = (s: string | undefined) => (s ? s.trim().replace(/\s+/g, " ") : undefined);

/** A picture: Product (part by part, as its weakest part), Brand, Craft. None when the Engine has not looked at it. */
export function pictureScores(look: StoredLook | null | undefined, details?: StoredPart[] | null): Scores | undefined {
  const items = look?.items ?? [];
  if (!items.length) return undefined;
  // The product, part by part where its parts were compared with the real one, else what the picture check said.
  const compared = (details ?? []).filter((d) => d.kind === "part");
  const parts = compared.length
    ? compared.map((d) => ({ label: d.part || d.what, value: d.ok ? 100 : 30 }))
    : items
        .filter((i) => i.area === "product")
        .map((i) => ({ label: i.item.split(/[.:;]/)[0].slice(0, 48), value: VERDICT[i.verdict] }));
  const weakest = [...parts].sort((a, b) => a.value - b.value)[0];
  const differs = compared.find((d) => !d.ok);
  const productWhy = compared.length
    ? sentence(differs && (differs.note ?? `The ${differs.part || "part"} differs from the real one.`))
    : sentence(items.find((i) => i.area === "product" && i.verdict !== "holds")?.note);
  const product = measure(
    "product",
    "Product",
    weakest?.value ?? 100,
    productWhy,
    parts.length > 1 ? parts : undefined,
  );

  // The brand: its rules and the planned scene; a hard rule that is off, or printed words nobody asked for, weigh most.
  const brandItems = items.filter((i) => i.area !== "product");
  let brand = brandItems.length ? brandItems.reduce((s, i) => s + VERDICT[i.verdict], 0) / brandItems.length : 100;
  const hardOff = brandItems.find((i) => i.hard && i.verdict === "off");
  if (hardOff) brand = Math.min(brand, 55);
  if (look?.printedText) brand = Math.min(brand, 60);
  const brandWhy =
    sentence(hardOff?.note ?? brandItems.find((i) => i.verdict === "off")?.note) ??
    (look?.printedText ? "The picture has printed words nobody asked for." : undefined);

  const craft = look?.artefacts === "major" ? 30 : look?.artefacts === "minor" ? 70 : 95;
  const measures = [
    product,
    measure("brand", "Brand", brand, brandWhy),
    measure("craft", "Craft", craft, sentence(look?.artefactNotes?.[0])),
  ];
  return legacy(measures);
}

/** A design: Readability, Design system, Placement, Words. None for a design not made. */
export function designScores(d: VersionDesign, review?: { onBrand?: number | null } | null): Scores | undefined {
  if (d.state !== "made") return undefined;
  const of = (pick: (c: DesignCheck) => boolean) => d.checks.filter(pick);
  const fromChecks = (checks: DesignCheck[]) => {
    const failed = checks.filter((c) => !c.ok);
    const value = 100 - failed.reduce((s, c) => s + (c.check === "covers" && c.hard ? 50 : c.hard ? 35 : 12), 0);
    const worst = failed.find((c) => c.hard) ?? failed[0];
    return { value, why: worst ? sentence(`${worst.node}: ${worst.note}`) : undefined };
  };
  const breaks = (c: DesignCheck) =>
    c.check === "lines" || (c.check === "fits" && !/safe area|runs into/i.test(c.note));
  const readability = fromChecks(of((c) => c.check === "contrast" || c.check === "busy"));
  const placement = fromChecks(of((c) => c.check === "covers" || (c.check === "fits" && !breaks(c))));
  const words = fromChecks(of(breaks));
  // The design system: Fume's review out of five, else what its findings say of the brand.
  const offBrand = d.findings.find((f) => /^Not like the brand/i.test(f.what));
  const onBrand = review?.onBrand;
  const system =
    typeof onBrand === "number" && onBrand > 0
      ? onBrand * 20
      : offBrand
        ? offBrand.severity === "minor"
          ? 70
          : 45
        : 90;
  const measures = [
    measure("readability", "Readability", readability.value, readability.why),
    measure("system", "Design system", system, sentence(offBrand?.what)),
    measure("placement", "Placement", placement.value, placement.why),
    measure("words", "Words", words.value, words.why),
  ];
  return legacy(measures);
}

/** The two older numbers stay filled for screens that read them: Product and the rest's lowest. */
function legacy(measures: ScoreMeasure[]): Scores {
  const product = measures.find((m) => m.id === "product");
  const rest = measures.filter((m) => m.id !== "product").sort((a, b) => a.value - b.value);
  const engine = rest[0];
  return {
    product: product?.value ?? Math.min(...measures.map((m) => m.value)),
    engine: engine?.value ?? 100,
    why: [
      ...(product?.why ? [{ score: "product" as const, text: product.why }] : []),
      ...(engine?.why ? [{ score: "engine" as const, text: engine.why }] : []),
    ],
    measures,
  };
}
