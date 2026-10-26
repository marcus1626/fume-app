// LYSNE's products (the two it started with, two the Engine read from its website, the catalogue, and the merchandise
// sweater), each with its kind, specs, parts, reference shots and files; the categories and collections they sit in;
// and the detail tokens a product fix reads from the packshot.
import type { Category, Collection, DetailToken, Product } from "../../contract";
import { catalogue } from "./catalogue";
import { at, gen, img, inDays, proposed, supplied } from "./helpers";
import { productSpecs, sweaterProduct } from "./productSpecs";

const fact = (
  id: string,
  productId: string,
  area: Product["facts"][number]["area"],
  label: string,
  statement: string,
  source: Product["facts"][number]["source"],
  confidence: Product["facts"][number]["confidence"] = "high",
): Product["facts"][number] => ({
  id,
  productId,
  area,
  label,
  statement,
  source,
  confidence,
  ...(source === "verified" ? { verifiedBy: "u-maja", verifiedAt: at(60 * 24 * 10) } : {}),
});

/** Night Body Oil's provenance. Known bug, kept on purpose: every mock shares this one object (db.ts links it after
 *  the copy), so a first run, which strips who added what, strips it here for every mock made after it in the same
 *  process. The app makes one mock per page load, so only tests see it. */
export const oilAdded = supplied("Added by Maja");

const lysne: Product[] = [
  {
    id: "pr-oil",
    workspaceId: "w-lysne",
    name: "Night Body Oil",
    variant: "100 ml",
    sku: "LYS-NBO-100",
    state: "verified",
    images: [gen("oil-pack"), gen("oil-scene"), img("03-08"), img("05-08"), img("01-03")],
    categoryId: "cat-oils",
    collectionIds: ["cl-aw26", "cl-ss27", "cl-gifts"],
    provenance: oilAdded,
    variants: [
      { id: "va-oil-100", productId: "pr-oil", name: "100 ml", sku: "LYS-NBO-100", image: img("03-08", "square") },
      { id: "va-oil-30", productId: "pr-oil", name: "30 ml travel", sku: "LYS-NBO-30" },
    ],
    facts: [
      fact(
        "f1",
        "pr-oil",
        "shape",
        "Bottle",
        "Amber glass, 100 ml, tall and round-shouldered, as in the packshot.",
        "verified",
      ),
      fact("f2", "pr-oil", "colour", "Cap", "Burgundy, matte. Never glossy, never black.", "verified"),
      fact(
        "f3",
        "pr-oil",
        "label",
        "Label",
        "Cream paper, front and centred, never cropped. LYSNE, then Night Body Oil · 100 ml.",
        "verified",
      ),
      fact("f4", "pr-oil", "colour", "Oil", "Reads golden, never orange.", "verified"),
      fact("f5", "pr-oil", "never", "Never", "Other sizes, a dropper, hands that cover the label.", "supplied"),
      fact(
        "f6",
        "pr-oil",
        "claim",
        "Claims",
        'Only the lines on the approved list: "For the hour before sleep."',
        "supplied",
      ),
    ],
  },
  {
    id: "pr-balm",
    workspaceId: "w-lysne",
    name: "Hand Balm",
    variant: "50 ml",
    state: "needs_you",
    images: [gen("balm-pack"), gen("balm-scene")],
    categoryId: "cat-hands",
    collectionIds: ["cl-aw26"],
    // Hand Balm is still the Engine's proposal: its facts wait for Maja, so it is not "You approved" yet.
    provenance: proposed("lysne.no/hand-balm", "high"),
    variants: [{ id: "va-balm-50", productId: "pr-balm", name: "50 ml" }],
    facts: [
      fact("f7", "pr-balm", "packaging", "Tube", "Soft cream tube, 50 ml, ribbed brown cap.", "inferred", "medium"),
      fact("f8", "pr-balm", "colour", "Balm", "Pale ivory, soft matte surface.", "inferred", "low"),
      fact(
        "f9",
        "pr-balm",
        "label",
        "Label",
        "LYSNE on the front; Hand Balm · 50 ml near the cap.",
        "inferred",
        "medium",
      ),
      fact("f10", "pr-balm", "claim", "Claims", "Not known yet. Which lines may we use?", "unknown", "low"),
    ],
  },
];

/** Two products the Engine read from the website. Packshots and a scene each, made with Higgsfield
 *  (public/demo/lysne/gen/MANIFEST.md). */
const readFromWebsite: Product[] = [
  {
    id: "pr-mist",
    workspaceId: "w-lysne",
    name: "Pillow Mist",
    variant: "50 ml",
    state: "needs_you",
    images: [gen("mist-pack"), gen("mist-scene")],
    categoryId: "cat-home",
    collectionIds: ["cl-ss27"],
    provenance: proposed("lysne.no/pillow-mist", "high"),
    facts: [
      {
        id: "f20",
        productId: "pr-mist",
        area: "shape",
        label: "Bottle",
        statement: "Amber glass spray, 50 ml, black pump under a clear cap.",
        source: "inferred",
        confidence: "high",
      },
      {
        id: "f21",
        productId: "pr-mist",
        area: "label",
        label: "Label",
        statement: "LYSNE, then Pillow Mist · 50 ml.",
        source: "inferred",
        confidence: "medium",
      },
      {
        id: "f22",
        productId: "pr-mist",
        area: "claim",
        label: "Claims",
        statement: '"Lavender and cedar for the hour before sleep."',
        source: "inferred",
        confidence: "low",
      },
    ],
  },
  {
    id: "pr-candle",
    workspaceId: "w-lysne",
    name: "Evening Candle",
    variant: "180 g",
    state: "needs_you",
    images: [gen("candle-pack"), gen("candle-scene")],
    categoryId: "cat-home",
    collectionIds: ["cl-gifts"],
    provenance: proposed("lysne.no/candle", "medium"),
    facts: [
      {
        id: "f23",
        productId: "pr-candle",
        area: "packaging",
        label: "Vessel",
        statement: "Amber glass tumbler with a travertine lid.",
        source: "inferred",
        confidence: "medium",
      },
      {
        id: "f24",
        productId: "pr-candle",
        area: "claim",
        label: "Claims",
        statement: "Not known yet. Which lines may we use?",
        source: "unknown",
        confidence: "low",
      },
    ],
  },
];

/** Every product, with its kind, specs, parts, shots and files where it has them. */
export const products: Product[] = [...lysne, ...readFromWebsite, ...catalogue, sweaterProduct].map((p) => ({
  ...p,
  ...productSpecs[p.id],
}));

export const categories: Category[] = [
  { id: "cat-body", workspaceId: "w-lysne", name: "Body care" },
  { id: "cat-oils", workspaceId: "w-lysne", name: "Oils", parentId: "cat-body" },
  { id: "cat-hands", workspaceId: "w-lysne", name: "Hands", parentId: "cat-body" },
  { id: "cat-home", workspaceId: "w-lysne", name: "Home" },
  { id: "cat-merch", workspaceId: "w-lysne", name: "Merchandise" },
];

export const collections: Collection[] = [
  {
    id: "cl-aw26",
    workspaceId: "w-lysne",
    name: "AW26",
    kind: "season",
    startsAt: inDays(-30),
    endsAt: inDays(120),
    productIds: ["pr-oil", "pr-balm", "pr-face", "pr-wash", "pr-lip"],
    cover: img("05-06"),
    description: "Autumn and winter: the evening ritual.",
    provenance: supplied("Made by Maja"),
  },
  {
    id: "cl-ss27",
    workspaceId: "w-lysne",
    name: "SS27",
    kind: "season",
    startsAt: inDays(150),
    endsAt: inDays(330),
    productIds: ["pr-mist", "pr-oil", "pr-wash", "pr-diffuser"],
    cover: img("09-13"),
    description: "Spring and summer: light evenings.",
    provenance: supplied("Made by Maja"),
  },
  {
    id: "cl-gifts",
    workspaceId: "w-lysne",
    name: "Gift sets",
    kind: "line",
    productIds: ["pr-oil", "pr-candle", "pr-ritual", "pr-kveld"],
    cover: img("02-05"),
    description: "The Engine grouped the products sold as gifts on lysne.no.",
    provenance: proposed("lysne.no/gifts", "medium"),
  },
];

// ─── Detail tokens ──────────────────────────────────────────────────────────

const decided = (evidence: string): DetailToken["provenance"] => ({
  origin: "customer",
  state: "approved",
  evidence,
  by: "u-maja",
  at: at(60 * 24 * 9),
});

export const detailTokens: DetailToken[] = [
  {
    id: "dt-size",
    productId: "pr-oil",
    label: "Size",
    value: "100 ml",
    kind: "text",
    image: img("09-07", "square"),
    region: { x: 0.56, y: 0.79, w: 0.125, h: 0.05 },
    provenance: decided("Packshot LYS-NBO-100"),
  },
  {
    id: "dt-label",
    productId: "pr-oil",
    label: "Label",
    value: "LYSNE · Night Body Oil",
    kind: "label",
    image: img("09-07", "square"),
    region: { x: 0.345, y: 0.425, w: 0.31, h: 0.44 },
    provenance: decided("Packshot LYS-NBO-100"),
  },
  {
    id: "dt-cap",
    productId: "pr-oil",
    label: "Cap",
    value: "Burgundy, matte",
    kind: "cap",
    image: img("09-07", "square"),
    region: { x: 0.39, y: 0.085, w: 0.22, h: 0.235 },
    provenance: decided("Packshot LYS-NBO-100"),
  },
  {
    id: "dt-logo",
    productId: "pr-oil",
    label: "Wordmark",
    value: "LYSNE",
    kind: "logo",
    image: img("09-07", "square"),
    region: { x: 0.385, y: 0.585, w: 0.225, h: 0.075 },
    provenance: { origin: "engine", state: "proposed", evidence: "lysne.no, header", confidence: "high" },
  },
];
