// Architecture v2 seed (FLOWS.md, PROPOSED 15 Oct 2026): LYSNE's identity for the Brand DNA board, the catalogue
// with categories and collections, moodboards, the brand scan the onboarding animation plays, the Contact thread
// with people, and the Studio's kit and sessions. Same demo brand and clock as seed.ts.

import type {
  Board,
  BoardItem,
  BrandIdentity,
  BrandScan,
  CastMember,
  Category,
  Collection,
  CreativeType,
  Generation,
  Message,
  Product,
  Provenance,
  Recipe,
  Scene,
  StudioSession,
  Thread,
} from "../contract";
import { at, gen as genPic, img, inDays } from "./seed";

const approved = (evidence: string, minutesAgo = 60 * 24 * 9): Provenance => ({ origin: "engine", state: "approved", evidence, by: "u-maja", at: at(minutesAgo) });
const supplied = (evidence: string): Provenance => ({ origin: "customer", state: "approved", evidence, by: "u-maja", at: at(60 * 24 * 12) });
const proposed = (evidence: string, confidence: Provenance["confidence"] = "medium"): Provenance => ({ origin: "engine", state: "proposed", evidence, confidence });

// ─── Identity: what the Brand DNA board shows ────────────────────────────────

export const identity: BrandIdentity = {
  colours: [
    { id: "col-ink", name: "Night brown", hex: "#2B1D17", role: "text", usage: "Words, the wordmark on light grounds.", provenance: supplied("LYSNE brand guide 2026.pdf, page 6") },
    { id: "col-linen", name: "Linen", hex: "#EFE6DA", role: "ground", usage: "Grounds, the label paper.", provenance: supplied("LYSNE brand guide 2026.pdf, page 6") },
    { id: "col-amber", name: "Amber glass", hex: "#A8642B", role: "primary", usage: "The bottle; the warm light in every image.", provenance: approved("lysne.no, product pages") },
    { id: "col-cap", name: "Burgundy cap", hex: "#5C1F2A", role: "accent", usage: "The cap, and small accents only.", provenance: { ...approved("Night Body Oil packshot"), state: "changed", was: "#6B1E2E" } },
    { id: "col-stone", name: "Evening stone", hex: "#B5A691", role: "support", usage: "Surfaces in images: stone, plaster.", provenance: approved("Spring relaunch") },
    { id: "col-dusk", name: "Dusk blue", hex: "#3E4A5C", role: "support", usage: "Seen in two images on the website.", provenance: proposed("lysne.no/journal, 2 images", "low") },
  ],
  typefaces: [
    { id: "tf-display", name: "Cormorant", role: "display", cssFamily: "\"Cormorant Garamond\", Georgia, serif", weights: ["Regular", "Italic"], sample: "For the hour before sleep.", usage: "The brand name and short lines.", provenance: supplied("LYSNE brand guide 2026.pdf, page 8") },
    { id: "tf-body", name: "Inter", role: "body", cssFamily: "Inter, system-ui, sans-serif", weights: ["Regular", "Medium"], sample: "Night Body Oil · 100 ml. Warm the oil in your hands.", usage: "Body copy, labels, the website.", provenance: approved("lysne.no, CSS") },
    { id: "tf-caps", name: "Small caps", role: "accent", cssFamily: "Inter, system-ui, sans-serif", weights: ["Medium"], sample: "NIGHT BODY OIL", usage: "The line under the name.", provenance: proposed("Label on the packshot", "medium") },
  ],
  logos: [
    { id: "lg-light", name: "Wordmark", wordmark: "LYSNE", use: "On Linen and light images. Alone on the label; never redrawn.", ground: "light", provenance: supplied("LYSNE wordmark.svg") },
    { id: "lg-dark", name: "Wordmark, reversed", wordmark: "LYSNE", use: "On dark images, in Linen.", ground: "dark", provenance: proposed("lysne.no footer", "high") },
  ],
  voice: [
    { id: "vo-1", statement: "Short, quiet sentences.", example: "Warm the oil in your hands. Breathe out.", provenance: approved("lysne.no/about") },
    { id: "vo-2", statement: "Speaks of the evening, never of results.", example: "For the hour before sleep.", provenance: supplied("LYSNE brand guide 2026.pdf, page 11") },
    { id: "vo-3", statement: "Says “you”, rarely “we”.", example: "Your evening, slowed down.", provenance: proposed("lysne.no, 14 pages", "medium") },
  ],
  imagery: [
    { id: "im-1", image: img("05-06"), caption: "Low side light on stone", provenance: approved("Spring relaunch") },
    { id: "im-2", image: img("02-04"), caption: "Fluted glass, slow light", provenance: supplied("Maja's reference") },
    { id: "im-3", image: img("08-06"), caption: "Product low, air above", provenance: approved("Summer evenings, approved creatives") },
    { id: "im-4", image: img("09-13"), caption: "Water light on linen", provenance: proposed("lysne.no/journal", "medium") },
  ],
};

// ─── Catalogue ──────────────────────────────────────────────────────────────

export const categories: Category[] = [
  { id: "cat-body", workspaceId: "w-lysne", name: "Body care" },
  { id: "cat-oils", workspaceId: "w-lysne", name: "Oils", parentId: "cat-body" },
  { id: "cat-hands", workspaceId: "w-lysne", name: "Hands", parentId: "cat-body" },
  { id: "cat-home", workspaceId: "w-lysne", name: "Home" },
];

export const collections: Collection[] = [
  { id: "cl-aw26", workspaceId: "w-lysne", name: "AW26", kind: "season", startsAt: inDays(-30), endsAt: inDays(120), productIds: ["pr-oil", "pr-balm"], cover: img("05-06"), description: "Autumn and winter: the evening ritual.", provenance: supplied("Made by Maja") },
  { id: "cl-ss27", workspaceId: "w-lysne", name: "SS27", kind: "season", startsAt: inDays(150), endsAt: inDays(330), productIds: ["pr-mist", "pr-oil"], cover: img("09-13"), description: "Spring and summer: light evenings.", provenance: supplied("Made by Maja") },
  { id: "cl-gifts", workspaceId: "w-lysne", name: "Gift sets", kind: "line", productIds: ["pr-oil", "pr-candle"], cover: img("02-05"), description: "The Engine grouped the products sold as gifts on lysne.no.", provenance: proposed("lysne.no/gifts", "medium") },
];

/** v2 places for the v1 products, and two products the Engine read from the website. */
export const productPlaces: Record<string, Pick<Product, "categoryId" | "collectionIds" | "variants" | "provenance">> = {
  "pr-oil": {
    categoryId: "cat-oils", collectionIds: ["cl-aw26", "cl-ss27", "cl-gifts"], provenance: supplied("Added by Maja"),
    variants: [
      { id: "va-oil-100", productId: "pr-oil", name: "100 ml", sku: "LYS-NBO-100", image: img("03-08", "square") },
      { id: "va-oil-30", productId: "pr-oil", name: "30 ml travel", sku: "LYS-NBO-30" },
    ],
  },
  // Hand Balm is still the Engine's proposal: its facts wait for Maja, so it is not "You approved" yet (UX review M3).
  "pr-balm": { categoryId: "cat-hands", collectionIds: ["cl-aw26"], provenance: proposed("lysne.no/hand-balm", "high"), variants: [{ id: "va-balm-50", productId: "pr-balm", name: "50 ml" }] },
};

// Round 6: packshots and a scene each, made with Higgsfield (public/demo/lysne/gen/MANIFEST.md).
export const newProducts: Product[] = [
  {
    id: "pr-mist", workspaceId: "w-lysne", name: "Pillow Mist", variant: "50 ml", state: "needs_you", images: [genPic("mist-pack"), genPic("mist-scene")],
    categoryId: "cat-home", collectionIds: ["cl-ss27"], provenance: proposed("lysne.no/pillow-mist", "high"),
    facts: [
      { id: "f20", productId: "pr-mist", area: "shape", label: "Bottle", statement: "Amber glass spray, 50 ml, black pump under a clear cap.", source: "inferred", confidence: "high" },
      { id: "f21", productId: "pr-mist", area: "label", label: "Label", statement: "LYSNE, then Pillow Mist · 50 ml.", source: "inferred", confidence: "medium" },
      { id: "f22", productId: "pr-mist", area: "claim", label: "Claims", statement: "\"Lavender and cedar for the hour before sleep.\"", source: "inferred", confidence: "low" },
    ],
  },
  {
    id: "pr-candle", workspaceId: "w-lysne", name: "Evening Candle", variant: "180 g", state: "needs_you", images: [genPic("candle-pack"), genPic("candle-scene")],
    categoryId: "cat-home", collectionIds: ["cl-gifts"], provenance: proposed("lysne.no/candle", "medium"),
    facts: [
      { id: "f23", productId: "pr-candle", area: "packaging", label: "Vessel", statement: "Amber glass tumbler with a travertine lid.", source: "inferred", confidence: "medium" },
      { id: "f24", productId: "pr-candle", area: "claim", label: "Claims", statement: "Not known yet. Which lines may we use?", source: "unknown", confidence: "low" },
    ],
  },
];

// ─── Boards ─────────────────────────────────────────────────────────────────

const item = (boardId: string, id: string, kind: BoardItem["kind"], x: number, y: number, w: number, h: number, extra: Partial<BoardItem>, provenance: Provenance): BoardItem => ({ id, boardId, kind, x, y, w, h, provenance, ...extra });

export const boards: Board[] = [
  {
    id: "bd-brand", workspaceId: "w-lysne", kind: "brand_moodboard", name: "LYSNE moodboard", width: 1600, height: 1000, updatedAt: at(60 * 24 * 2),
    items: [
      item("bd-brand", "bi-1", "section", 40, 40, 760, 920, { text: "Evening light" }, supplied("Maja")),
      item("bd-brand", "bi-2", "image", 80, 110, 320, 400, { image: img("05-06"), verdict: "liked", note: "Low side light on stone." }, supplied("Maja")),
      item("bd-brand", "bi-3", "image", 430, 110, 330, 330, { image: img("02-04", "square"), verdict: "liked", note: "Fluted glass and slow light." }, supplied("Maja")),
      item("bd-brand", "bi-4", "image", 430, 470, 330, 440, { image: img("08-06"), verdict: "liked" }, supplied("Jonas")),
      item("bd-brand", "bi-5", "note", 80, 560, 320, 160, { text: "Product low in the frame, air above. Skin in crops; people only as AI models." }, supplied("Maja")),
      item("bd-brand", "bi-6", "section", 840, 40, 720, 560, { text: "Not us" }, supplied("Maja")),
      item("bd-brand", "bi-7", "image", 880, 110, 300, 375, { image: img("07-10"), verdict: "disliked", note: "Hands too staged." }, supplied("Jonas")),
      item("bd-brand", "bi-8", "image", 1210, 110, 310, 310, { image: img("06-10", "square"), verdict: "disliked", note: "Too clinical." }, supplied("Maja")),
      item("bd-brand", "bi-9", "swatch", 880, 650, 150, 150, { hex: "#A8642B", text: "Amber glass" }, approved("lysne.no")),
      item("bd-brand", "bi-10", "swatch", 1050, 650, 150, 150, { hex: "#5C1F2A", text: "Burgundy cap" }, approved("Packshot")),
      item("bd-brand", "bi-11", "image", 1230, 650, 300, 300, { image: img("09-13", "square"), note: "Water light on linen: more of this for SS27?" }, proposed("lysne.no/journal")),
    ],
  },
  {
    id: "bd-autumn", workspaceId: "w-lysne", kind: "campaign_moodboard", campaignId: "c-autumn", name: "Autumn launch moodboard", width: 1400, height: 800, updatedAt: at(60 * 24 * 11),
    items: [
      item("bd-autumn", "ba-1", "image", 40, 40, 360, 450, { image: img("05-06"), verdict: "liked" }, supplied("From the brand moodboard")),
      item("bd-autumn", "ba-2", "image", 430, 40, 360, 360, { image: img("04-02", "square"), verdict: "liked", note: "Upright and calm." }, supplied("Maja")),
      item("bd-autumn", "ba-3", "note", 430, 430, 360, 140, { text: "Autumn: stone, wool, the first dark evenings." }, supplied("Maja")),
      item("bd-autumn", "ba-4", "image", 820, 40, 360, 450, { image: img("03-05") }, proposed("The Engine, for this brief")),
      item("bd-autumn", "ba-5", "image", 820, 520, 240, 240, { image: img("01-12", "square") }, proposed("The Engine, for this brief")),
    ],
  },
  {
    id: "bd-winter", workspaceId: "w-lysne", kind: "campaign_moodboard", campaignId: "c-winter", name: "Winter gifting moodboard", width: 1200, height: 700, updatedAt: at(60 * 24 * 2),
    items: [
      item("bd-winter", "bw-1", "image", 40, 40, 360, 450, { image: img("02-05"), verdict: "liked" }, supplied("Jonas")),
      item("bd-winter", "bw-2", "image", 430, 40, 300, 300, { image: img("02-09", "square") }, proposed("The Engine, for this brief")),
      item("bd-winter", "bw-3", "note", 430, 370, 300, 140, { text: "A gift for the evening, not for Christmas." }, supplied("Jonas")),
    ],
  },
  {
    id: "bd-ideas", workspaceId: "w-lysne", kind: "ideas", name: "SS27 ideas", width: 1200, height: 700, updatedAt: at(60 * 5),
    items: [
      item("bd-ideas", "bx-1", "note", 40, 40, 300, 140, { text: "Light evenings: the oil on a balcony at 22:00." }, { origin: "fume", state: "approved", by: "u-tuva", at: at(60 * 5) }),
      item("bd-ideas", "bx-2", "image", 370, 40, 300, 375, { image: img("09-04") }, { origin: "fume", state: "approved", by: "u-tuva", at: at(60 * 5) }),
    ],
  },
];

/** Which campaigns carry which collections and moodboards in v2. */
export const campaignScope: Record<string, { collectionIds: string[]; boardId?: string }> = {
  "c-autumn": { collectionIds: ["cl-aw26"], boardId: "bd-autumn" },
  "c-winter": { collectionIds: ["cl-gifts"], boardId: "bd-winter" },
  "c-bf": { collectionIds: ["cl-gifts"] },
  "c-balm": { collectionIds: [] },
  "c-summer": { collectionIds: [] },
  "c-spring": { collectionIds: [] },
};

// ─── Contact: people ────────────────────────────────────────────────────────

export const contactThread: Thread = { id: "t-contact", workspaceId: "w-lysne", campaignId: null, title: "Contact", kind: "contact", updatedAt: at(60 * 20), unread: 1 };

export const contactMessages: Message[] = [
  { id: "cm1", threadId: "t-contact", author: { kind: "person", userId: "u-sander" }, text: "Hi Maja, I'm Sander, your producer at Fume. Anna checks every creative before you see it. Write here whenever you'd rather talk to a person.", at: at(60 * 24 * 12) },
  { id: "cm2", threadId: "t-contact", author: { kind: "person", userId: "u-maja" }, text: "Can we use the autumn creatives in print as well?", at: at(60 * 22) },
  { id: "cm3", threadId: "t-contact", author: { kind: "person", userId: "u-sander" }, text: "Yes. Your rights note covers paid and organic channels; print is fine too. I've added it to the delivery's note.", at: at(60 * 20) },
];

// ─── Brand scan: what the onboarding animation plays ────────────────────────

export const scan: BrandScan = {
  id: "scan-1", workspaceId: "w-lysne", source: "both", url: "lysne.no", files: ["LYSNE brand guide 2026.pdf", "LYSNE wordmark.svg"], state: "reading",
  sources: [
    { id: "s1", label: "lysne.no", kind: "page", state: "waiting" },
    { id: "s2", label: "lysne.no/about", kind: "page", state: "waiting" },
    { id: "s3", label: "lysne.no/night-body-oil", kind: "page", state: "waiting" },
    { id: "s4", label: "LYSNE brand guide 2026.pdf", kind: "file", state: "waiting" },
    { id: "s5", label: "LYSNE wordmark.svg", kind: "file", state: "waiting" },
  ],
  finds: [
    { id: "x1", kind: "logo", label: "Wordmark", value: "LYSNE", evidence: "LYSNE wordmark.svg", confidence: "high", origin: "customer" },
    { id: "x2", kind: "colour", label: "Night brown", value: "#2B1D17", evidence: "Brand guide, page 6", confidence: "high", origin: "customer" },
    { id: "x3", kind: "colour", label: "Linen", value: "#EFE6DA", evidence: "Brand guide, page 6", confidence: "high", origin: "customer" },
    { id: "x4", kind: "colour", label: "Amber glass", value: "#A8642B", evidence: "lysne.no", confidence: "high", origin: "engine" },
    { id: "x5", kind: "colour", label: "Burgundy cap", value: "#6B1E2E", evidence: "lysne.no/night-body-oil", confidence: "medium", origin: "engine" },
    { id: "x6", kind: "colour", label: "Dusk blue", value: "#3E4A5C", evidence: "lysne.no/journal", confidence: "low", origin: "engine" },
    { id: "x7", kind: "typeface", label: "Cormorant", value: "For the hour before sleep.", evidence: "Brand guide, page 8", confidence: "high", origin: "customer" },
    { id: "x8", kind: "typeface", label: "Inter", value: "Warm the oil in your hands.", evidence: "lysne.no", confidence: "high", origin: "engine" },
    { id: "x9", kind: "image", label: "Low side light on stone", value: img("05-06", "square"), evidence: "lysne.no", confidence: "high", origin: "engine" },
    { id: "x10", kind: "image", label: "Fluted glass", value: img("02-04", "square"), evidence: "lysne.no/about", confidence: "high", origin: "engine" },
    { id: "x11", kind: "image", label: "Water light", value: img("09-13", "square"), evidence: "lysne.no/journal", confidence: "medium", origin: "engine" },
    { id: "x12", kind: "product", label: "Night Body Oil", value: img("03-08", "square"), evidence: "lysne.no/night-body-oil", confidence: "high", origin: "engine" },
    // A product without its own picture on the site lands without one (value ""), never with another product's picture.
    { id: "x13", kind: "product", label: "Hand Balm", value: "", evidence: "lysne.no/hand-balm", confidence: "medium", origin: "engine" },
    { id: "x14", kind: "product", label: "Pillow Mist", value: "", evidence: "lysne.no/pillow-mist", confidence: "high", origin: "engine" },
    { id: "x16", kind: "product", label: "Evening Candle", value: "", evidence: "lysne.no/candle", confidence: "medium", origin: "engine" },
    { id: "x15", kind: "voice", label: "Short, quiet sentences", value: "Warm the oil in your hands. Breathe out.", evidence: "lysne.no/about", confidence: "medium", origin: "engine" },
  ],
  needsYou: 5,
};

// ─── Studio ─────────────────────────────────────────────────────────────────

export const creativeTypes: CreativeType[] = [
  { id: "ct-packshot", name: "Packshot", description: "The product alone, true to the Product Truth, on a ground from the Brand DNA.", family: "H-B Product in light", needs: ["product", "variant", "angle"], formats: ["square", "feed"], checks: ["Edges clean", "Label legible"], cover: img("03-08", "square") },
  { id: "ct-scene", name: "Product in scene", description: "The product in a place and a light from the brand world.", family: "S4 Product still life", needs: ["product", "variant", "scene"], formats: ["feed", "square", "story"], checks: ["Scale believable"], cover: img("05-06", "square") },
  { id: "ct-lifestyle", name: "Lifestyle with a person", description: "A person from the cast with the product. The creative is labelled as an AI model.", family: "S3 Lifestyle in motion", needs: ["product", "cast", "scene"], formats: ["feed", "story"], checks: ["AI model label", "Hands never cover the label"], cover: img("07-05", "square") },
  { id: "ct-portrait", name: "Portrait and beauty", description: "The product in use on skin, close and calm.", family: "S2 Portrait and beauty", needs: ["product", "cast"], formats: ["feed", "story"], checks: ["AI model label", "No result claims in the image"], cover: img("07-02", "square") },
  { id: "ct-detail", name: "Detail", description: "One part of the product, close: the cap, the oil, the label.", family: "H-D Focus detail", needs: ["product", "area"], formats: ["square", "feed"], checks: ["Material true"], cover: img("01-12", "square") },
  { id: "ct-layout", name: "Layout", description: "A creative with words and the logo, built from the brand's own components.", family: "Layout (OpenPencil)", needs: ["product", "layout"], formats: ["feed", "story", "square"], checks: ["Words against the claims list", "Logo clear space"], cover: img("04-05", "square") },
];

export const cast: CastMember[] = [
  { id: "cm-ane", name: "Ane", look: "30s, dark hair, freckles, calm", image: img("07-05", "square"), isAiPerson: true, allowedUses: ["Brand photography", "Paid social"] },
  { id: "cm-leo", name: "Leo", look: "40s, grey at the temples, wool", image: img("07-11", "square"), isAiPerson: true, allowedUses: ["Brand photography"] },
  { id: "cm-hands", name: "Hands only", look: "Hands and shoulders, no face", image: img("07-02", "square"), isAiPerson: true, allowedUses: ["Brand photography", "Paid social", "Product page"] },
];

export const scenes: Scene[] = [
  { id: "sc-stone", workspaceId: "w-lysne", name: "Evening stone", light: "Low side light, warm, 2700 K", image: img("05-06", "square") },
  { id: "sc-linen", workspaceId: "w-lysne", name: "Linen and water", light: "Soft window light, late", image: img("09-13", "square") },
  { id: "sc-bath", workspaceId: "w-lysne", name: "Bathroom shelf", light: "One lamp, amber", image: img("02-04", "square") },
];

const recipe = (extra: Partial<Recipe> = {}): Recipe => ({
  mode: "type", creativeTypeId: "ct-scene", productId: "pr-oil", variantId: "va-oil-100", angle: "Front", castIds: [], sceneId: "sc-stone",
  references: [img("05-06", "square")], format: "feed", count: 4,
  route: { provider: "Higgsfield", model: "Nano Banana Pro" }, prompt: "Evening stone · LYSNE Night Body Oil 100 ml, amber glass, matte burgundy cap · low side light 2700 K · 50 mm · product low, air above · label front and centred", seed: 48213,
  ...extra,
});

const gen = (id: string, branch: number, tile: string, state: Generation["state"], minutesAgo: number, evaluation: Partial<Generation["evaluation"]> = {}, extra: Partial<Generation> = {}): Generation => ({
  id, sessionId: "ss-autumn-m3", branch, image: img(tile), recipe: recipe(), cost: 0.12, state, at: at(minutesAgo),
  evaluation: { productTruth: "pass", brandRules: "pass", artefacts: "none", notes: [], ...evaluation },
  ...extra,
});

export const sessions: StudioSession[] = [
  {
    id: "ss-autumn-m3", workspaceId: "w-lysne", campaignId: "c-autumn", slot: "Master 3 · feed", recipe: recipe(), by: "u-anna", updatedAt: at(20),
    generations: [
      gen("g1", 1, "05-06", "candidate", 60),
      gen("g2", 1, "05-08", "candidate", 60, { productTruth: "flag", notes: ["Cap reads glossy"] }),
      gen("g3", 1, "03-05", "discarded", 60, { artefacts: "minor", notes: ["Label edge soft"] }),
      gen("g4", 1, "04-06", "candidate", 60),
      gen("g5", 2, "05-01", "picked", 20, {}, { repair: "Make the cap matte and move the bottle lower." }),
      gen("g6", 2, "04-08", "candidate", 20),
    ],
    pickedId: "g5",
  },
];
