// v7 seed (round 6, PROPOSED 15 Oct 2026): six more LYSNE products, so the "All products" sheet (walk-through Must 1)
// has a catalogue worth searching and filtering. Packshots made with Higgsfield (gpt_image_2_5), public/demo/lysne/gen/
// (MANIFEST.md). Each has a kindId (seed6.ts kinds) so worker Q can fill its specs later; the confirmed ones carry
// confirmed facts, the rest wait for Maja ("Needs facts"). addV7 merges them into the mock's db (mockApi.ts).
import type { Collection, Product, ProductFact, Provenance } from "../contract";
import { at, gen } from "./seed";

/** Packshots made with Higgsfield for these products; list a name here once its file is in public/demo/lysne/gen/
 *  (<name>-pack.jpg). Until then the tile shows the package icon instead of a broken picture. */
const PACKSHOTS_READY: string[] = ["face", "wash", "kveld", "diffuser", "lip", "ritual"];
const pack = (name: string) => (PACKSHOTS_READY.includes(name) ? [gen(`${name}-pack`)] : []);

const fact = (id: string, productId: string, area: ProductFact["area"], label: string, statement: string, source: ProductFact["source"], confidence: ProductFact["confidence"] = "high"): ProductFact => ({
  id, productId, area, label, statement, source, confidence,
  ...(source === "verified" ? { verifiedBy: "u-maja", verifiedAt: at(60 * 24 * 6) } : {}),
});
const added = (evidence: string): Provenance => ({ origin: "customer", state: "approved", evidence, by: "u-maja", at: at(60 * 24 * 6) });
const read = (evidence: string, confidence: Provenance["confidence"] = "medium"): Provenance => ({ origin: "engine", state: "proposed", evidence, confidence });

export const products: Product[] = [
  {
    id: "pr-face", workspaceId: "w-lysne", name: "Face Oil", variant: "30 ml", sku: "LYS-FO-30", state: "verified", kindId: "kind-skincare", categoryId: "cat-oils",
    images: pack("face"), provenance: added("Added by Maja"),
    facts: [
      fact("f70", "pr-face", "shape", "Bottle", "Amber glass dropper bottle, 30 ml, matte burgundy cap.", "verified"),
      fact("f71", "pr-face", "label", "Label", "Cream paper: LYSNE, then Face Oil · 30 ml.", "verified"),
      fact("f72", "pr-face", "claim", "Claims", "\"Light enough for the evening, gone by morning.\"", "verified"),
    ],
  },
  {
    id: "pr-wash", workspaceId: "w-lysne", name: "Evening Body Wash", variant: "250 ml", sku: "LYS-BW-250", state: "verified", kindId: "kind-skincare", categoryId: "cat-body",
    images: pack("wash"), provenance: added("Added by Maja"),
    facts: [
      fact("f73", "pr-wash", "shape", "Bottle", "Amber pump bottle, 250 ml, matte burgundy pump.", "verified"),
      fact("f74", "pr-wash", "label", "Label", "Cream paper: LYSNE, then Evening Body Wash · 250 ml.", "verified"),
    ],
  },
  {
    id: "pr-kveld", workspaceId: "w-lysne", name: "Kveld Eau de Parfum", variant: "50 ml", state: "needs_you", kindId: "kind-fragrance", categoryId: "cat-home",
    images: pack("kveld"), provenance: read("lysne.no/kveld", "high"),
    facts: [
      fact("f75", "pr-kveld", "shape", "Bottle", "Heavy square clear glass, 50 ml, matte burgundy cap.", "inferred", "high"),
      fact("f76", "pr-kveld", "claim", "Claims", "Not known yet. Which lines may we use?", "unknown", "low"),
    ],
  },
  {
    id: "pr-diffuser", workspaceId: "w-lysne", name: "Room Diffuser", variant: "100 ml", state: "needs_you", kindId: "kind-home", categoryId: "cat-home",
    images: pack("diffuser"), provenance: read("lysne.no/diffuser", "medium"),
    facts: [
      fact("f77", "pr-diffuser", "packaging", "Bottle", "Amber glass, 100 ml, six rattan reeds.", "inferred", "medium"),
      fact("f78", "pr-diffuser", "label", "Label", "LYSNE, then Room Diffuser · 100 ml.", "inferred", "medium"),
    ],
  },
  {
    id: "pr-lip", workspaceId: "w-lysne", name: "Lip Balm", variant: "15 ml", sku: "LYS-LB-15", state: "verified", kindId: "kind-skincare", categoryId: "cat-body",
    images: pack("lip"), provenance: added("Added by Maja"),
    facts: [
      fact("f79", "pr-lip", "packaging", "Tin", "Round matte burgundy tin, 15 ml, LYSNE embossed on the lid.", "verified"),
      fact("f7-lip-1", "pr-lip", "colour", "Balm", "Pale ivory.", "verified"),
    ],
  },
  {
    id: "pr-ritual", workspaceId: "w-lysne", name: "Evening Ritual gift box", variant: "Oil and candle", state: "needs_you", kindId: "kind-home", categoryId: "cat-home",
    images: pack("ritual"), provenance: read("lysne.no/gifts", "medium"),
    facts: [
      fact("f7-ritual-1", "pr-ritual", "packaging", "Box", "Cream rigid box: Night Body Oil 100 ml and Evening Candle 180 g in cream paper.", "inferred", "medium"),
      fact("f7-ritual-2", "pr-ritual", "claim", "Claims", "Not known yet. Which lines may we use?", "unknown", "low"),
    ],
  },
];

/** Where the new products sit in LYSNE's collections. */
const inCollections: Record<string, string[]> = {
  "cl-aw26": ["pr-face", "pr-wash", "pr-lip"],
  "cl-ss27": ["pr-wash", "pr-diffuser"],
  "cl-gifts": ["pr-ritual", "pr-kveld"],
};

/** Merges the v7 products into the mock's db (after v2, before v6). */
export function addV7(db: { products: Product[]; collections: Collection[] }) {
  db.products.push(...structuredClone(products));
  for (const c of db.collections) {
    const more = inCollections[c.id];
    if (more) c.productIds = [...new Set([...c.productIds, ...more])];
  }
  for (const p of db.products) {
    const ids = Object.entries(inCollections).filter(([, list]) => list.includes(p.id)).map(([id]) => id);
    if (ids.length) p.collectionIds = [...new Set([...(p.collectionIds ?? []), ...ids])];
  }
}
