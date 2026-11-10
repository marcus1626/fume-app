// The compile package: everything one prompt is written from, frozen and hashed, with the manifest of what it must say.
import { createHash } from "node:crypto";
import type {
  BrandContext,
  BrandRule,
  CompilePackage,
  Concept,
  Dialect,
  FormatSpec,
  Grammar,
  Knowledge,
  ManifestItem,
  ProductContext,
  SlotText,
  Target,
} from "./types.ts";

function normalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalise);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = normalise(v);
    }
    return out;
  }
  return value;
}
export const canonicalJson = (value: unknown) => JSON.stringify(normalise(value));
export const sha256Hex = (text: string) => createHash("sha256").update(text).digest("hex");

/** The Look Book's dimensions (context.ts): how the photograph is made. */
export const LOOK_DIMENSIONS = new Set(["camera", "light", "colour grade", "texture", "look recipe"]);

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function applicableRules(brand: BrandContext, lookKey: string | null): BrandRule[] {
  return brand.rules.filter((r) => r.scope !== "category" && (r.lookKey === null || r.lookKey === lookKey));
}

export function buildManifest(input: {
  product: ProductContext;
  brand: BrandContext;
  concept: Concept;
  format: FormatSpec;
  enforcedLessons: { id: string; statement: string }[];
  /** A change to a picture already made (picture_edit): its scene and look are the picture's own. */
  edit?: boolean;
  /** The grammar has a slot for the photograph as it is made (campaign_still v2): the Look Book's rules go there. */
  camera?: boolean;
}): ManifestItem[] {
  const { product, brand, concept, format, edit } = input;
  const hasCamera = Boolean(input.camera);
  const items: ManifestItem[] = [
    { id: "ref-text", kind: "reference_text_locked", refId: "lockedReferenceText", required: true, check: "code", requirement: "The approved reference description, word for word.", expected: product.lockedReferenceText, suggestedSlot: "references" },
    { id: "product-text", kind: "product_text_locked", refId: "lockedProductText", required: true, check: "code", requirement: "The approved product description, word for word.", expected: product.lockedProductText, suggestedSlot: "product" },
  ];
  for (const inv of product.invariants)
    items.push({ id: `inv-${inv.id}`, kind: "product_invariant", refId: inv.id, required: true, check: "decision", requirement: inv.statement, suggestedSlot: "constraints" });
  for (const c of product.colours)
    items.push({ id: `colour-${slug(c.area)}`, kind: "product_colour", refId: `colours.${c.area}`, required: true, check: "code", requirement: `The ${c.area} is the colour ${c.valueHex}.`, expected: c.valueHex, suggestedSlot: "product" });
  for (const rule of applicableRules(brand, concept.lookKey)) {
    if (edit && rule.binding !== "hard") continue;
    items.push({ id: `brand-${rule.id}`, kind: rule.binding === "hard" ? "brand_rule_hard" : "brand_rule_soft", refId: rule.id, required: rule.binding === "hard", check: "decision", requirement: rule.statement, suggestedSlot: edit ? "constraints" : rule.dimension === "people" ? "people" : rule.dimension === "composition" ? "scene" : LOOK_DIMENSIONS.has(rule.dimension) && hasCamera ? "camera" : "brand" });
  }
  if (!edit)
    items.push({ id: "concept", kind: "concept", refId: concept.id, required: true, check: "decision", requirement: `The scene shows: ${concept.sceneIdea} The product's role: ${concept.productRole}.`, suggestedSlot: "scene" });
  for (const lesson of input.enforcedLessons)
    items.push({ id: `lesson-${lesson.id}`, kind: "lesson_enforced", refId: lesson.id, required: true, check: "decision", requirement: lesson.statement, suggestedSlot: edit && lesson.id === "ask" ? "change" : "constraints" });
  items.push({ id: "format", kind: "format", refId: "format", required: true, check: "code", requirement: `Aspect ratio ${format.aspectRatio}.`, expected: format.aspectRatio, suggestedSlot: "assignment" });
  return items;
}

export type CompileInput = {
  target: Target;
  grammar: Grammar;
  dialect: Dialect;
  product: ProductContext;
  brand: BrandContext;
  concept: Concept;
  format: FormatSpec;
  knowledge: Knowledge;
  enforcedLessons: { id: string; statement: string }[];
  fixedSlots?: SlotText[];
};

export function buildCompilePackage(input: CompileInput): { compilePackage: CompilePackage; hash: string } {
  const compilePackage: CompilePackage = {
    target: input.target,
    grammar: input.grammar,
    dialect: input.dialect,
    manifest: buildManifest({
      ...input,
      edit: input.target.imageType === "picture_edit",
      camera: input.grammar.slots.some((s) => s.key === "camera"),
    }),
    brandRules: input.brand.rules.filter((r) => r.lookKey === null || r.lookKey === input.concept.lookKey),
    lockedReferenceText: input.product.lockedReferenceText,
    lockedProductText: input.product.lockedProductText,
    concept: input.concept,
    format: input.format,
    forbiddenTerms: input.brand.forbiddenTerms,
    notVisible: input.product.notVisible,
    references: input.product.references,
    knowledge: input.knowledge,
    ...(input.fixedSlots?.length ? { fixedSlots: input.fixedSlots } : {}),
  };
  return { compilePackage, hash: sha256Hex(canonicalJson(compilePackage)) };
}
