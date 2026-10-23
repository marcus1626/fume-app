// v9 seed (round 7, PROPOSED 16 Oct 2026): the first reading of a fresh brand, which the mind-map onboarding plays
// (brand AND products read together from the website, point 4), and a later "Update the brand" reading of
// lysne.no that finds only what is new, changed or unsure against the approved Brand DNA (points 2, 3, 5).
// Same demo brand and clock as seed.ts.

import type { BrandFound, BrandScan, BrandUpdate } from "../contract";
import { at, gen, img } from "./seed";

// ─── The first reading (the onboarding mind map) ─────────────────────────────

/** The website's pages in reading order: each node of the map waits for the page it is read from. */
export const firstSources: BrandScan["sources"] = [
  { id: "p-home", label: "lysne.no", kind: "page", state: "waiting" },
  { id: "p-journal", label: "lysne.no/journal", kind: "page", state: "waiting" },
  { id: "p-shop", label: "lysne.no/shop", kind: "page", state: "waiting" },
  { id: "p-about", label: "lysne.no/about", kind: "page", state: "waiting" },
];

export const firstScan: BrandScan = {
  id: "scan-first", workspaceId: "w-lysne", source: "website", url: "lysne.no", files: [], state: "reading",
  sources: firstSources,
  finds: [
    { id: "m-logo", kind: "logo", label: "Wordmark", value: "LYSNE", evidence: "lysne.no, the header", confidence: "high", origin: "engine", sourceId: "p-home" },
    { id: "m-logo2", kind: "logo", label: "Wordmark, reversed", value: "LYSNE", evidence: "lysne.no, the footer", confidence: "high", origin: "engine", sourceId: "p-home" },
    { id: "m-c1", kind: "colour", label: "Night brown", value: "#2B1D17", evidence: "lysne.no", confidence: "high", origin: "engine", sourceId: "p-home" },
    { id: "m-c2", kind: "colour", label: "Linen", value: "#EFE6DA", evidence: "lysne.no", confidence: "high", origin: "engine", sourceId: "p-home" },
    { id: "m-c3", kind: "colour", label: "Amber glass", value: "#A8642B", evidence: "lysne.no", confidence: "high", origin: "engine", sourceId: "p-home" },
    { id: "m-c4", kind: "colour", label: "Burgundy cap", value: "#5C1F2A", evidence: "lysne.no", confidence: "medium", origin: "engine", sourceId: "p-home" },
    { id: "m-c5", kind: "colour", label: "Evening stone", value: "#B5A691", evidence: "lysne.no", confidence: "medium", origin: "engine", sourceId: "p-home" },
    { id: "m-t1", kind: "typeface", label: "Cormorant", value: "For the hour before sleep.", evidence: "lysne.no, headings", confidence: "high", origin: "engine", sourceId: "p-home" },
    { id: "m-t2", kind: "typeface", label: "Inter", value: "Warm the oil in your hands.", evidence: "lysne.no, body text", confidence: "high", origin: "engine", sourceId: "p-home" },
    { id: "m-t3", kind: "typeface", label: "Small caps", value: "NIGHT BODY OIL", evidence: "lysne.no/shop, the labels", confidence: "medium", origin: "engine", sourceId: "p-shop" },
    { id: "m-i1", kind: "image", label: "Low side light on stone", value: img("05-06", "square"), evidence: "lysne.no/journal", confidence: "high", origin: "engine", sourceId: "p-journal" },
    { id: "m-i2", kind: "image", label: "Fluted glass, slow light", value: img("02-04", "square"), evidence: "lysne.no/journal", confidence: "high", origin: "engine", sourceId: "p-journal" },
    { id: "m-i3", kind: "image", label: "Product low, air above", value: img("08-06", "square"), evidence: "lysne.no/journal", confidence: "high", origin: "engine", sourceId: "p-journal" },
    { id: "m-i4", kind: "image", label: "Water light on linen", value: img("09-13", "square"), evidence: "lysne.no/journal", confidence: "medium", origin: "engine", sourceId: "p-journal" },
    { id: "m-c6", kind: "colour", label: "Dusk blue", value: "#3E4A5C", evidence: "lysne.no/journal, 2 images", confidence: "low", origin: "engine", sourceId: "p-journal" },
    // Products are read with the brand the first time (round 7, point 4); after onboarding they live in Products.
    { id: "m-p1", kind: "product", label: "Night Body Oil", value: gen("oil-pack"), evidence: "lysne.no/shop", confidence: "high", origin: "engine", sourceId: "p-shop", productId: "pr-oil" },
    { id: "m-p2", kind: "product", label: "Hand Balm", value: gen("balm-pack"), evidence: "lysne.no/shop", confidence: "high", origin: "engine", sourceId: "p-shop", productId: "pr-balm" },
    { id: "m-p3", kind: "product", label: "Pillow Mist", value: gen("mist-pack"), evidence: "lysne.no/shop", confidence: "high", origin: "engine", sourceId: "p-shop", productId: "pr-mist" },
    { id: "m-p4", kind: "product", label: "Evening Candle", value: gen("candle-pack"), evidence: "lysne.no/shop", confidence: "medium", origin: "engine", sourceId: "p-shop", productId: "pr-candle" },
    { id: "m-p5", kind: "product", label: "Face Oil", value: gen("face-pack"), evidence: "lysne.no/shop", confidence: "high", origin: "engine", sourceId: "p-shop", productId: "pr-face" },
    { id: "m-p6", kind: "product", label: "Kveld Eau de Parfum", value: gen("kveld-pack"), evidence: "lysne.no/shop", confidence: "medium", origin: "engine", sourceId: "p-shop", productId: "pr-kveld" },
    // Round 8 (UX review ONB-3): every product in the catalogue is read here, so the map, the last card and Home say one number.
    { id: "m-p7", kind: "product", label: "Evening Body Wash", value: gen("wash-pack"), evidence: "lysne.no/shop", confidence: "high", origin: "engine", sourceId: "p-shop", productId: "pr-wash" },
    { id: "m-p8", kind: "product", label: "Room Diffuser", value: gen("diffuser-pack"), evidence: "lysne.no/shop", confidence: "medium", origin: "engine", sourceId: "p-shop", productId: "pr-diffuser" },
    { id: "m-p9", kind: "product", label: "Lip Balm", value: gen("lip-pack"), evidence: "lysne.no/shop", confidence: "high", origin: "engine", sourceId: "p-shop", productId: "pr-lip" },
    { id: "m-p10", kind: "product", label: "Evening Ritual gift box", value: gen("ritual-pack"), evidence: "lysne.no/shop", confidence: "medium", origin: "engine", sourceId: "p-shop", productId: "pr-ritual" },
    { id: "m-p11", kind: "product", label: "Merino Lounge Sweater", value: gen("sweater-flat"), evidence: "lysne.no/shop", confidence: "medium", origin: "engine", sourceId: "p-shop", productId: "pr-sweater" },
    { id: "m-v1", kind: "voice", label: "Short, quiet sentences.", value: "Warm the oil in your hands. Breathe out.", evidence: "lysne.no/about", confidence: "high", origin: "engine", sourceId: "p-about" },
    { id: "m-v2", kind: "voice", label: "Speaks of the evening, never of results.", value: "For the hour before sleep.", evidence: "lysne.no/about", confidence: "medium", origin: "engine", sourceId: "p-about" },
    { id: "m-v3", kind: "voice", label: "Says “you”, rarely “we”.", value: "Your evening, slowed down.", evidence: "lysne.no, 14 pages", confidence: "medium", origin: "engine", sourceId: "p-about" },
    { id: "m-r1", kind: "rule", label: "No results or before-and-after", value: "Never promise results; speak of the evening.", evidence: "lysne.no/about", confidence: "medium", origin: "engine", sourceId: "p-about" },
    { id: "m-r2", kind: "rule", label: "The label is never cropped", value: "The label stays whole, front and centred.", evidence: "lysne.no/shop, every packshot", confidence: "medium", origin: "engine", sourceId: "p-about" },
    { id: "m-a1", kind: "audience", label: "Who LYSNE speaks to", value: "Women 30 to 55 in Norway who keep an evening ritual.", evidence: "lysne.no/about", confidence: "low", origin: "engine", sourceId: "p-about" },
  ],
  needsYou: 12, // the open proposals across Logo, Colour, Type, Imagery and Voice (round 8: one count everywhere)
};

// ─── Update the brand: lysne.no read again (point 2, 3, 5) ───────────────────

export const updateSources: BrandScan["sources"] = [
  { id: "u-home", label: "lysne.no", kind: "page", state: "waiting" },
  { id: "u-autumn", label: "lysne.no/autumn", kind: "page", state: "waiting" },
  { id: "u-about", label: "lysne.no/about", kind: "page", state: "waiting" },
  { id: "u-shop", label: "lysne.no/shop", kind: "page", state: "waiting" },
];

export const updateFound: BrandFound[] = [
  {
    id: "bf-autumn", kind: "image", status: "new", title: "Autumn 2026 campaign", subtitle: "4 pictures",
    image: img("06-05", "square"), images: [img("06-05", "square"), img("07-02", "square"), img("04-06", "square"), img("01-12", "square")],
    confidence: "high", source: "lysne.no/autumn", note: "A new campaign page since your last approval.",
  },
  {
    id: "bf-stone", kind: "colour", status: "changed", title: "Evening stone", subtitle: "Support colour",
    before: "#B5A691", after: "#A3927B", targetId: "col-stone",
    confidence: "medium", source: "lysne.no, the site’s colours", note: "A little darker and warmer on the site now.",
  },
  {
    id: "bf-voice", kind: "voice", status: "new", title: "Names the hour, not the product.", subtitle: "“Seven in the evening. The house goes quiet.”",
    after: "Names the hour, not the product.", confidence: "high", source: "lysne.no/about", note: "A new line on the about page.",
  },
  {
    id: "bf-type", kind: "typeface", status: "unsure", title: "Inter Tight", subtitle: "Body typeface",
    before: "Inter", after: "Inter Tight", targetId: "tf-body",
    confidence: "low", source: "lysne.no/about, headings", note: "The headings look narrower. A new typeface, or Inter set tighter?",
  },
];

export const update: BrandUpdate = {
  id: "bu-1", workspaceId: "w-lysne", source: "website", url: "lysne.no", files: [], state: "reading",
  sources: updateSources,
  found: updateFound,
  unchanged: 23,
  products: { count: 3, names: ["Morning Face Mist", "Linen Spray", "Night Body Oil 30 ml"] },
  startedAt: at(0),
};

/** A zip of new things: the same comparison, read from files. */
export const zipSources = (files: string[]): BrandScan["sources"] =>
  (files.length ? files : ["LYSNE autumn 2026.zip"]).map((name, i) => ({ id: `z${i}`, label: name, kind: "file" as const, state: "waiting" as const }));
