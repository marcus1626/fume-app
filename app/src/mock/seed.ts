// The mock workspace: LYSNE, a Fume demo brand (not a client), on 14 Oct 2026 at 14:32 Oslo.
// Names are placeholders (Verbal Identity): Maja approves for LYSNE, Anna is Fume's expert. Images are LYSNE
// Engine Batch 2 creatives (app/tools/demo-images.py). PROPOSED with the app, 14 Oct 2026.

import type {
  BrandDna,
  BrandRule,
  Brief,
  Campaign,
  Check,
  CheckItem,
  Creative,
  CreativeVersion,
  Delivery,
  Direction,
  EngineRun,
  Format,
  Invitation,
  MemoryEntry,
  Membership,
  Message,
  Notification,
  Organisation,
  Package,
  Product,
  QualityLogEntry,
  RecordEvent,
  Reference,
  ServiceClock,
  SourceAsset,
  StaffAssignment,
  TastePair,
  Thread,
  Understanding,
  User,
  VersionState,
  Workspace,
} from "../contract";

/** The mock's clock: 14 Oct 2026, 14:32 in Oslo. */
export const NOW = Date.parse("2026-10-14T12:32:00Z");
export const at = (minutesAgo: number) => new Date(NOW - minutesAgo * 60_000).toISOString();
export const inDays = (days: number) => new Date(NOW + days * 86_400_000).toISOString();

const SIZE: Record<Format, [number, number]> = { feed: [1080, 1350], square: [1080, 1080], story: [1080, 1920] };
export const img = (tile: string, format: Format = "feed") => `${import.meta.env.BASE_URL}demo/lysne/${tile}-${format}.jpg`;
/** Round 6 mock pictures made with Higgsfield (app/public/demo/lysne/gen/MANIFEST.md). */
export const gen = (name: string) => `${import.meta.env.BASE_URL}demo/lysne/gen/${name}.jpg`;

// ─── People ─────────────────────────────────────────────────────────────────

export const users: User[] = [
  { id: "u-maja", name: "Maja Lind", title: "Head of Marketing", email: "maja@lysne.example" },
  { id: "u-jonas", name: "Jonas Berg", title: "Performance Marketer", email: "jonas@lysne.example" },
  { id: "u-ida", name: "Ida Strand", title: "Finance Lead", email: "ida@lysne.example" },
  { id: "u-anna", name: "Anna", title: "Designer", email: "anna@fumecreatives.com", staffRole: "expert" },
  { id: "u-sander", name: "Sander", title: "Producer", email: "sander@fumecreatives.com", staffRole: "operator" },
  { id: "u-tuva", name: "Tuva", title: "Art Director", email: "tuva@fumecreatives.com", staffRole: "expert" },
  { id: "u-vera", name: "Vera", title: "Operations", email: "vera@fumecreatives.com", staffRole: "admin" },
  { id: "u-solv", name: "Elin Ek", title: "Brand Manager", email: "elin@solv.example" },
];

export const organisations: Organisation[] = [
  { id: "o-lysne", name: "LYSNE", packageId: "p-core" },
  { id: "o-solv", name: "SOLV", packageId: "p-launch" },
];

export const workspaces: Workspace[] = [
  { id: "w-lysne", organisationId: "o-lysne", brandName: "LYSNE", market: "Norway", language: "Norwegian" },
  { id: "w-solv", organisationId: "o-solv", brandName: "SOLV", market: "Sweden", language: "Swedish" },
];

export const memberships: Membership[] = [
  { userId: "u-maja", workspaceId: "w-lysne", role: "owner" },
  { userId: "u-jonas", workspaceId: "w-lysne", role: "member" },
  { userId: "u-ida", workspaceId: "w-lysne", role: "viewer" },
  { userId: "u-solv", workspaceId: "w-solv", role: "owner" },
];

export const invitations: Invitation[] = [
  { id: "inv-1", workspaceId: "w-lysne", email: "eva@lysne.example", role: "approver", invitedBy: "u-maja", state: "sent", at: at(60 * 26) },
];

export const staff: StaffAssignment[] = [
  { userId: "u-anna", workspaceId: "w-lysne", staffRole: "expert" },
  { userId: "u-sander", workspaceId: "w-lysne", staffRole: "operator" },
  { userId: "u-tuva", workspaceId: "w-solv", staffRole: "expert" },
  { userId: "u-sander", workspaceId: "w-solv", staffRole: "operator" },
];

export const packages: Package[] = [
  { id: "p-launch", kind: "launch", creativeCap: 18, directionRounds: 1, productionRounds: 2, period: "one_off" },
  { id: "p-core", kind: "core", creativeCap: 27, directionRounds: 1, productionRounds: 2, period: "monthly" },
];

// ─── Brand DNA ──────────────────────────────────────────────────────────────

export const brandDna: BrandDna = {
  workspaceId: "w-lysne",
  version: 3,
  state: "approved",
  approvedBy: "u-maja",
  approvedAt: at(60 * 24 * 9),
  completeness: 0.86,
  summary:
    "LYSNE makes body oils for the hour before sleep. Calm, warm and close: low evening light on stone and skin, amber glass, few words. Never loud, never clinical.",
};

export const rules: BrandRule[] = [
  { id: "r1", area: "logo", statement: "The wordmark stands alone on the label; never redrawn, never on a busy area.", kind: "hard_constraint", source: "supplied", confidence: "high" },
  { id: "r2", area: "colour", statement: "Warm neutrals and amber light. No cold blue light, no saturated colour.", kind: "rule", source: "verified", confidence: "high" },
  { id: "r3", area: "type", statement: "Serif for the name, small caps for the line under it.", kind: "rule", source: "supplied", confidence: "high" },
  { id: "r4", area: "voice", statement: "Short, quiet sentences. Speaks of the evening, never of results.", kind: "rule", source: "verified", confidence: "high" },
  { id: "r5", area: "imagery", statement: "Stone, linen and glass. Skin is shown in crops, never a face.", kind: "preference", source: "learned", confidence: "medium" },
  { id: "r6", area: "layout", statement: "The product sits low in the frame with air above it.", kind: "preference", source: "inferred", confidence: "medium" },
  { id: "r7", area: "claims", statement: "No skin-result claims. Only lines on the approved claims list.", kind: "hard_constraint", source: "supplied", confidence: "high" },
];

const fact = (id: string, productId: string, area: Product["facts"][number]["area"], label: string, statement: string, source: Product["facts"][number]["source"], confidence: Product["facts"][number]["confidence"] = "high"): Product["facts"][number] => ({
  id, productId, area, label, statement, source, confidence,
  ...(source === "verified" ? { verifiedBy: "u-maja", verifiedAt: at(60 * 24 * 10) } : {}),
});

export const products: Product[] = [
  {
    id: "pr-oil", workspaceId: "w-lysne", name: "Night Body Oil", variant: "100 ml", sku: "LYS-NBO-100", state: "verified",
    images: [gen("oil-pack"), gen("oil-scene"), img("03-08"), img("05-08"), img("01-03")],
    facts: [
      fact("f1", "pr-oil", "shape", "Bottle", "Amber glass, 100 ml, tall and round-shouldered, as in the packshot.", "verified"),
      fact("f2", "pr-oil", "colour", "Cap", "Burgundy, matte. Never glossy, never black.", "verified"),
      fact("f3", "pr-oil", "label", "Label", "Cream paper, front and centred, never cropped. LYSNE, then Night Body Oil · 100 ml.", "verified"),
      fact("f4", "pr-oil", "colour", "Oil", "Reads golden, never orange.", "verified"),
      fact("f5", "pr-oil", "never", "Never", "Other sizes, a dropper, hands that cover the label.", "supplied"),
      fact("f6", "pr-oil", "claim", "Claims", "Only the lines on the approved list: \"For the hour before sleep.\"", "supplied"),
    ],
  },
  {
    id: "pr-balm", workspaceId: "w-lysne", name: "Hand Balm", variant: "50 ml", state: "needs_you",
    images: [gen("balm-pack"), gen("balm-scene")],
    facts: [
      fact("f7", "pr-balm", "packaging", "Tube", "Soft cream tube, 50 ml, ribbed brown cap.", "inferred", "medium"),
      fact("f8", "pr-balm", "colour", "Balm", "Pale ivory, soft matte surface.", "inferred", "low"),
      fact("f9", "pr-balm", "label", "Label", "LYSNE on the front; Hand Balm · 50 ml near the cap.", "inferred", "medium"),
      fact("f10", "pr-balm", "claim", "Claims", "Not known yet. Which lines may we use?", "unknown", "low"),
    ],
  },
];

export const references: Reference[] = [
  { id: "ref1", image: img("02-04"), verdict: "liked", note: "Fluted glass and slow light.", addedBy: "u-maja" },
  { id: "ref2", image: img("08-06"), verdict: "liked", note: "Product low, air above.", addedBy: "u-maja" },
  { id: "ref3", image: img("07-10"), verdict: "disliked", note: "Hands too staged.", addedBy: "u-jonas" },
  { id: "ref4", image: img("02-05"), verdict: "liked", addedBy: "u-jonas" },
];

export const tastePairs: TastePair[] = [
  { id: "tp1", a: img("04-02"), b: img("06-05"), question: "Which feels more like LYSNE?", chosen: "a", reason: "Upright and calm." },
  { id: "tp2", a: img("05-03"), b: img("09-04"), question: "Which feels more like LYSNE?" },
  { id: "tp3", a: img("01-04"), b: img("08-02"), question: "Which feels more like LYSNE?" },
];

export const memory: MemoryEntry[] = [
  { id: "m1", kind: "caught", campaignId: "c-summer", lesson: "Anna caught a glossy cap on two creatives; the Product Truth now says matte.", at: at(60 * 24 * 20) },
  { id: "m2", kind: "changed", campaignId: "c-summer", lesson: "You moved the product lower in the frame twice. New creatives start there.", at: at(60 * 24 * 19) },
  { id: "m3", kind: "rejected", campaignId: "c-autumn", lesson: "You passed on hands that hold the bottle. Fume no longer proposes them.", at: at(60 * 24 * 6) },
  { id: "m4", kind: "approved", campaignId: "c-autumn", lesson: "Evening stone was chosen over skin and texture: warm stone leads.", at: at(60 * 24 * 5) },
];

export const assets: SourceAsset[] = [
  { id: "a1", kind: "logo", name: "LYSNE wordmark.svg", bytes: 18_400, uploadedBy: "u-maja", at: at(60 * 24 * 12) },
  { id: "a2", kind: "guideline", name: "LYSNE brand guide 2026.pdf", bytes: 8_200_000, uploadedBy: "u-maja", at: at(60 * 24 * 12) },
  { id: "a3", kind: "packshot", name: "Night Body Oil packshot", bytes: 1_200_000, uploadedBy: "u-maja", at: at(60 * 24 * 12), thumbnail: img("03-08", "square") },
  { id: "a4", kind: "campaign", name: "Spring 2026 campaign", bytes: 24_000_000, uploadedBy: "u-jonas", at: at(60 * 24 * 11), thumbnail: img("08-02", "square") },
];

export const understanding: Understanding = {
  version: 3,
  summary: [
    "LYSNE is evening care, not skincare: the oil belongs to the hour before sleep.",
    "The light is low and warm, from the side, on stone, linen and glass.",
    "The product is the hero and sits low with air above; people are AI models only, always labelled, mostly as crops of skin.",
  ],
  conflicts: [{ id: "cf1", text: "Your guide shows cool morning light on page 14; every campaign since uses warm evening light.", resolved: "Warm evening light. Page 14 is from before the relaunch." }],
  // Round 8 (UX review ONB-6): the Hand Balm claims question is a line of Hand Balm (fact f10, source "unknown"),
  // asked on the product and in the one question sheet, never as a brand-level question in onboarding.
  unknowns: [],
  testDirections: [
    { id: "td1", name: "Evening stone", image: img("05-06"), verdict: "yes", reason: "This is us." },
    { id: "td2", name: "Water light", image: img("09-13"), verdict: "yes" },
    { id: "td3", name: "Studio white", image: img("06-10"), verdict: "no", reason: "Too clinical." },
  ],
};

// ─── Campaigns ──────────────────────────────────────────────────────────────

const counts = (creatives: number, inCheck: number, checked: number, approved: number, delivered: number) => ({ creatives, inCheck, checked, approved, delivered });

export const campaigns: Campaign[] = [
  {
    id: "c-autumn", workspaceId: "w-lysne", name: "Autumn launch", productIds: ["pr-oil"], state: "in_review", stage: "variants",
    approverId: "u-maja", channels: ["paid_social", "email", "product_page"], formats: ["feed", "story", "square"], market: "Norway", language: "Norwegian",
    dueAt: inDays(3), createdBy: "u-maja", createdAt: at(60 * 24 * 12), updatedAt: at(6), counts: counts(11, 3, 6, 2, 0), roundsUsed: 1, roundsIncluded: 2,
    chosenDirectionId: "d-a1", cover: img("05-06"), brandDnaVersion: 3,
  },
  {
    id: "c-winter", workspaceId: "w-lysne", name: "Winter gifting", productIds: ["pr-oil", "pr-candle"], state: "in_review", stage: "plan", // round 10: the plan waits on Maja (r10-plan.ts)
    approverId: "u-maja", channels: ["paid_social", "organic_social"], formats: ["feed", "story"], market: "Norway", language: "Norwegian",
    dueAt: inDays(20), createdBy: "u-jonas", createdAt: at(60 * 24 * 2), updatedAt: at(2), counts: counts(0, 0, 0, 0, 0), roundsUsed: 0, roundsIncluded: 2,
    cover: img("02-05"), brandDnaVersion: 3,
  },
  {
    id: "c-bf", workspaceId: "w-lysne", name: "Black Friday", productIds: ["pr-oil", "pr-candle"], state: "scoped", stage: "plan", // round 10: the plan is in check with Anna
    approverId: "u-maja", channels: ["paid_social", "email"], formats: ["feed", "story", "square"], market: "Norway", language: "Norwegian",
    dueAt: inDays(44), createdBy: "u-maja", createdAt: at(60 * 24), updatedAt: at(60 * 5), counts: counts(0, 0, 0, 0, 0), roundsUsed: 0, roundsIncluded: 2,
    cover: img("10-06"), brandDnaVersion: 3,
    look: {
      colours: [{ name: "Night black", hex: "#141110", use: "Grounds" }, { name: "Gold foil", hex: "#C9A45C", use: "Words and the offer" }, { name: "Linen", hex: "#EFE6DA", use: "Small text" }],
      backgrounds: [{ name: "Night black", hex: "#141110" }, { name: "Deep burgundy", hex: "#3A1219" }],
      light: "Hard top light, one bright edge on the glass",
      note: "Darker and sharper than LYSNE's evening light: black grounds, gold words, one hard light.",
      provenance: { origin: "customer", state: "approved", evidence: "Black Friday brief", by: "u-maja", at: at(60 * 20) },
    },
  },
  {
    id: "c-balm", workspaceId: "w-lysne", name: "Hand Balm introduction", productIds: ["pr-balm"], state: "awaiting_input", stage: "brief",
    approverId: "u-maja", channels: ["paid_social", "product_page"], formats: ["feed", "square"], market: "Norway", language: "Norwegian",
    createdBy: "u-maja", createdAt: at(60 * 3), updatedAt: at(60 * 3), counts: counts(0, 0, 0, 0, 0), roundsUsed: 0, roundsIncluded: 2, brandDnaVersion: 3,
  },
  {
    id: "c-summer", workspaceId: "w-lysne", name: "Summer evenings", productIds: ["pr-oil"], state: "delivered", stage: "delivery",
    approverId: "u-maja", channels: ["paid_social", "email"], formats: ["feed", "story"], market: "Norway", language: "Norwegian",
    createdBy: "u-maja", createdAt: at(60 * 24 * 40), updatedAt: at(60 * 24 * 18), counts: counts(8, 0, 0, 8, 8), roundsUsed: 1, roundsIncluded: 2,
    chosenDirectionId: "d-s1", cover: img("08-06"), brandDnaVersion: 2,
  },
  {
    id: "c-spring", workspaceId: "w-lysne", name: "Spring relaunch", productIds: ["pr-oil"], state: "closed", stage: "delivery",
    approverId: "u-maja", channels: ["paid_social"], formats: ["feed"], market: "Norway", language: "Norwegian",
    createdBy: "u-maja", createdAt: at(60 * 24 * 90), updatedAt: at(60 * 24 * 60), counts: counts(6, 0, 0, 6, 6), roundsUsed: 2, roundsIncluded: 2,
    cover: img("01-03"), brandDnaVersion: 1,
  },
  {
    id: "c-solv", workspaceId: "w-solv", name: "Morning ritual", productIds: [], state: "in_production", stage: "masters",
    approverId: "u-solv", channels: ["paid_social"], formats: ["feed"], market: "Sweden", language: "Swedish",
    dueAt: inDays(2), createdBy: "u-solv", createdAt: at(60 * 24 * 8), updatedAt: at(30), counts: counts(2, 2, 0, 0, 0), roundsUsed: 0, roundsIncluded: 2,
    cover: img("10-08"), brandDnaVersion: 1,
  },
];

export const briefs: Brief[] = [
  {
    campaignId: "c-bf", version: 1, state: "approved",
    objective: "Black Friday: the oil and the candle as a set, for one week in paid social and email.",
    audience: "Existing customers and people who saved LYSNE posts.",
    offer: "The evening set, 25 % off, Black Friday to Cyber Monday, 27–30 November.",
    message: "One evening, wrapped.",
    mandatory: ["Black grounds, gold words", "The offer readable at a glance"],
    never: ["Red discount stickers", "Countdown clocks"],
    channels: ["paid_social", "email"], formats: ["feed", "story", "square"], creatives: 9,
    references: [img("10-06", "square")], missing: [], approvedBy: "u-maja", approvedAt: at(60 * 20),
  },
  {
    campaignId: "c-autumn", version: 2, state: "approved",
    objective: "Launch Night Body Oil for autumn and make it the evening ritual in paid social.",
    audience: "Women 28–45 in Norway who already buy premium body care.",
    message: "The hour before sleep, slowed down.",
    mandatory: ["The bottle, label front and centred", "Low evening light"],
    never: ["Skin-result claims", "Hands that cover the label"],
    channels: ["paid_social", "email", "product_page"], formats: ["feed", "story", "square"], creatives: 11,
    references: [img("02-04", "square"), img("08-06", "square")], missing: [], approvedBy: "u-maja", approvedAt: at(60 * 24 * 11),
  },
  {
    campaignId: "c-winter", version: 1, state: "approved",
    objective: "Gift sets for the weeks before Christmas, on Instagram and Facebook.",
    audience: "People buying a considered gift for someone close.",
    message: "A slower evening, given.",
    mandatory: ["The bottle with its gift sleeve", "Warm, low light"],
    never: ["Red and green Christmas colours", "Discount language"],
    channels: ["paid_social", "organic_social"], formats: ["feed", "story"], creatives: 9,
    references: [img("02-05", "square")], missing: [], approvedBy: "u-maja", approvedAt: at(60 * 24 * 1),
  },
  {
    campaignId: "c-balm", version: 1, state: "drafting",
    objective: "Introduce Hand Balm to people who already use the oil.",
    audience: "Existing LYSNE customers.",
    message: "",
    mandatory: [], never: [], channels: ["paid_social", "product_page"], formats: ["feed", "square"], creatives: 6, references: [],
    missing: ["The claims we may use for Hand Balm", "A packshot of the tube"],
  },
  {
    campaignId: "c-summer", version: 1, state: "approved",
    objective: "Keep the oil in mind through summer evenings.", audience: "Existing customers.", message: "Light that stays late.",
    mandatory: ["The bottle"], never: ["Beach clichés"], channels: ["paid_social", "email"], formats: ["feed", "story"], creatives: 8,
    references: [], missing: [], approvedBy: "u-maja", approvedAt: at(60 * 24 * 38),
  },
];

export const directions: Direction[] = [
  {
    id: "d-a1", campaignId: "c-autumn", letter: "A", name: "Evening stone", state: "chosen",
    insight: "The oil is used in the last quiet hour of the day, when the light is low.",
    hook: "Low sun on travertine, the bottle catching it.", message: "The hour before sleep, slowed down.",
    visualIdea: "Warm side light on stone steps; the bottle low in the frame; long shadows.",
    whyItFits: "Your Taste Map chose upright, calm compositions, and stone leads in your last two campaigns.",
    risks: ["Stone can read cold if the light is not warm enough."],
    plannedOutputs: "2 masters and 9 variants, in Feed, Story and Square",
    cover: img("05-06"), images: [img("05-06"), img("08-02"), img("04-05")],
    checkedBy: "u-anna", checkedAt: at(60 * 24 * 7), decidedBy: "u-maja", decidedAt: at(60 * 24 * 6), reason: "This is the autumn feeling.",
  },
  {
    id: "d-a2", campaignId: "c-autumn", letter: "B", name: "Skin and light", state: "passed",
    insight: "The ritual is felt on the skin before it is seen.", hook: "Amber light across a bare shoulder.", message: "Warmth, kept.",
    visualIdea: "Close crops of skin in caustic light, the bottle beside.", whyItFits: "Skin as crops, as your Brand Rules prefer.",
    risks: ["Skin crops need care with the claims."], plannedOutputs: "2 masters, 3 variants each",
    cover: img("07-02"), images: [img("07-02"), img("01-07")], checkedBy: "u-anna", checkedAt: at(60 * 24 * 7), decidedBy: "u-maja", decidedAt: at(60 * 24 * 6),
  },
  {
    id: "d-a3", campaignId: "c-autumn", letter: "C", name: "Texture", state: "passed",
    insight: "The oil itself is the most honest picture of the product.", hook: "Golden drops on stone.", message: "Made to be felt.",
    visualIdea: "Macro of oil on travertine, the bottle lying in the light.", whyItFits: "Golden, never orange: the Product Truth's oil colour.",
    risks: ["Macro shots can drift from the real product colour."], plannedOutputs: "2 masters, 3 variants each",
    cover: img("05-03"), images: [img("05-03"), img("07-05")], checkedBy: "u-anna", checkedAt: at(60 * 24 * 7), decidedBy: "u-maja", decidedAt: at(60 * 24 * 6),
  },
  // Round 10: Winter gifting's directions are part of its plan now (r10-plan.ts), never generated before it is approved.
  {
    id: "d-s1", campaignId: "c-summer", letter: "A", name: "Late light", state: "chosen",
    insight: "Summer evenings stay light; the oil keeps them slow.", hook: "Sun through linen at ten at night.", message: "Light that stays late.",
    visualIdea: "Linen, sea window, the bottle on a sill.", whyItFits: "Warm light and stone, as your Brand Rules say.", risks: [],
    plannedOutputs: "1 master, 4 variants", cover: img("08-06"), images: [img("08-06")], decidedBy: "u-maja", decidedAt: at(60 * 24 * 35),
  },
];

// ─── Creatives ──────────────────────────────────────────────────────────────

let vSeq = 0;
function version(creativeId: string, tile: string, format: Format, state: VersionState, minutesAgo: number, extra: Partial<CreativeVersion> = {}): CreativeVersion {
  const [width, height] = SIZE[format];
  vSeq += 1;
  const checked = ["checked", "approved", "delivered", "changes_requested"].includes(state);
  const approved = ["approved", "delivered"].includes(state);
  return {
    id: `v-${creativeId}-${vSeq}`, creativeId, number: 1, image: img(tile, format), width, height, state, madeAt: at(minutesAgo + 30),
    ...(checked ? { checkedBy: "u-anna", checkedAt: at(minutesAgo) } : {}),
    ...(approved ? { approvedBy: "u-maja", approvedAt: at(Math.max(minutesAgo - 60, 1)) } : {}),
    ...extra,
  };
}

function creative(id: string, campaignId: string, directionId: string, masterId: string | null, title: string, name: string, format: Format, tile: string, state: VersionState, minutesAgo: number, extra: Partial<CreativeVersion> = {}): Creative {
  const current = version(id, tile, format, state, minutesAgo, extra);
  return { id, campaignId, directionId, masterId, kind: masterId ? "variant" : "master", format, channel: format === "story" ? "organic_social" : "paid_social", name, title, current, versions: [current] };
}

// Round 12 (DLOAD-8, PROPOSED 20 Oct 2026): a creative made before plans existed is named by its format and its number
// among the campaign's creatives in that format, in the order they were made ("Feed 3"; copy.creativeName adds the
// product: "Night Body Oil · Feed 3"). Its lineage ("Master 2 · Variant 2") stays in the delivery name and the Studio.
export const creatives: Creative[] = [
  // Autumn launch: two approved masters, then variants and formats (6 checked and waiting for Maja, 3 in check)
  creative("cr-a-m1", "c-autumn", "d-a1", null, "Feed 1", "lysne_autumn_a_m1_feed_v2", "feed", "05-06", "approved", 60 * 24 * 3),
  creative("cr-a-m2", "c-autumn", "d-a1", null, "Feed 2", "lysne_autumn_a_m2_feed_v1", "feed", "08-02", "approved", 60 * 24 * 3),
  creative("cr-a-v1", "c-autumn", "d-a1", "cr-a-m1", "Feed 3", "lysne_autumn_a_m1_v1_feed_v1", "feed", "04-05", "checked", 45),
  creative("cr-a-v2", "c-autumn", "d-a1", "cr-a-m1", "Story 1", "lysne_autumn_a_m1_v1_story_v1", "story", "04-05", "checked", 44),
  creative("cr-a-v3", "c-autumn", "d-a1", "cr-a-m1", "Feed 4", "lysne_autumn_a_m1_v2_feed_v1", "feed", "03-05", "checked", 40),
  creative("cr-a-v4", "c-autumn", "d-a1", "cr-a-m1", "Square 1", "lysne_autumn_a_m1_v2_square_v1", "square", "03-05", "checked", 39),
  creative("cr-a-v5", "c-autumn", "d-a1", "cr-a-m2", "Feed 5", "lysne_autumn_a_m2_v1_feed_v1", "feed", "05-01", "checked", 22),
  creative("cr-a-v6", "c-autumn", "d-a1", "cr-a-m2", "Story 2", "lysne_autumn_a_m2_v1_story_v1", "story", "05-01", "checked", 21),
  creative("cr-a-v7", "c-autumn", "d-a1", "cr-a-m2", "Feed 6", "lysne_autumn_a_m2_v2_feed_v1", "feed", "09-07", "in_check", 8),
  creative("cr-a-v8", "c-autumn", "d-a1", "cr-a-m2", "Square 2", "lysne_autumn_a_m2_v2_square_v1", "square", "09-07", "in_check", 7),
  creative("cr-a-v9", "c-autumn", "d-a1", "cr-a-m2", "Feed 7", "lysne_autumn_a_m2_v3_feed_v1", "feed", "06-10", "held", 12, { heldReason: "The cap reads glossy. Anna is matching it to the matte burgundy in the Product Truth." }),
  // Summer evenings: delivered
  ...["08-06", "09-02", "07-10", "10-08", "09-04", "02-09", "01-12", "04-08"].map((tile, i) =>
    creative(`cr-s-${i + 1}`, "c-summer", "d-s1", i === 0 ? null : "cr-s-1", i % 2 ? `Story ${(i + 1) / 2}` : `Feed ${i / 2 + 1}`, `lysne_summer_a_m1_v${i}_${i % 2 ? "story" : "feed"}_v1`, i % 2 ? "story" : "feed", tile, "delivered", 60 * 24 * 20 + i),
  ),
  // SOLV: two masters in check (another workspace, for the Studio queue)
  creative("cr-solv-1", "c-solv", "d-solv", null, "Feed 1", "solv_morning_a_m1_feed_v1", "feed", "10-08", "in_check", 30),
  creative("cr-solv-2", "c-solv", "d-solv", null, "Feed 2", "solv_morning_a_m2_feed_v1", "feed", "10-06", "in_check", 28),
];

// Master 1 went through one round of the customer's changes: keep that history in its version chain.
{
  const m1 = creatives[0];
  const v1: CreativeVersion = { ...m1.current, id: "v-cr-a-m1-old", number: 1, image: img("01-03"), state: "changes_requested", approvedBy: undefined, approvedAt: undefined, checkedAt: at(60 * 24 * 5) };
  m1.versions = [v1, { ...m1.current, number: 2 }];
  m1.current = m1.versions[1];
}

// ─── Engine runs ────────────────────────────────────────────────────────────

export const runs: EngineRun[] = [
  {
    id: "run-autumn-v", campaignId: "c-autumn", purpose: "variants", state: "done", made: 9, total: 9, startedAt: at(120),
    previews: [img("04-05"), img("03-05"), img("05-01"), img("09-07"), img("06-10")],
    steps: [
      { label: "Masters 1 and 2 approved by Maja", state: "done" },
      { label: "Variants and channel formats", state: "done", detail: "9 of 9" },
      { label: "Quality Gate: Anna checks each creative", state: "active", detail: "6 of 9" },
    ],
  },
];

export const clocks: ServiceClock[] = [
  { campaignId: "c-autumn", stage: "variants", dueAt: inDays(3), state: "running" },
  // Round 10: the step after the brief is the plan.
  { campaignId: "c-winter", stage: "plan", dueAt: inDays(5), state: "paused_waiting_on_you", pausedReason: "The plan waits on Maja’s approval." },
  { campaignId: "c-bf", stage: "plan", dueAt: inDays(2), state: "running" },
  { campaignId: "c-balm", stage: "plan", dueAt: inDays(5), state: "paused_waiting_on_you", pausedReason: "Hand Balm waits on Maja’s claims." },
  { campaignId: "c-solv", stage: "masters", dueAt: inDays(2), state: "running" },
];

// ─── Quality Gate ───────────────────────────────────────────────────────────

const items = (prefix: string, notes: Record<number, string> = {}): CheckItem[] =>
  [
    { area: "product_truth", label: "Bottle", against: "Amber glass, 100 ml, as in the packshot." },
    { area: "product_truth", label: "Cap", against: "Burgundy, matte. Never glossy, never black." },
    { area: "product_truth", label: "Label", against: "Front and centred, not cropped, not moved." },
    { area: "brand_rules", label: "Light", against: "Warm neutrals and amber light; no cold light." },
    { area: "claims", label: "Claims against the brief", against: "No skin-result claims in the creative." },
    { area: "channel", label: "Format and safe area", against: "Feed 1080 × 1350; nothing important in the outer 6 %." },
  ].map((it, i) => ({ id: `${prefix}-i${i + 1}`, ...it, result: notes[i] ? ("note" as const) : ("pending" as const), ...(notes[i] ? { noteId: `${prefix}-n1` } : {}) })) as CheckItem[];

export const checks: Check[] = [
  {
    id: "ck-a-v7", versionId: "", creativeId: "cr-a-v7", campaignId: "c-autumn", workspaceId: "w-lysne", expertId: "u-anna", state: "in_check",
    items: items("ck-a-v7", { 1: "x" }).map((it, i) => (i === 0 || i === 2 ? { ...it, result: "pass" } : it)),
    notes: [{ id: "ck-a-v7-n1", number: 1, x: 0.5, y: 0.31, text: "The cap catches too much light and reads glossy. Match the matte burgundy in the Product Truth.", author: "u-anna", at: at(4) }],
    dueAt: inDays(1), risk: "normal", startedAt: at(6),
  },
  { id: "ck-a-v8", versionId: "", creativeId: "cr-a-v8", campaignId: "c-autumn", workspaceId: "w-lysne", expertId: "u-anna", state: "waiting", items: items("ck-a-v8"), notes: [], dueAt: inDays(1), risk: "normal" },
  {
    id: "ck-a-v9", versionId: "", creativeId: "cr-a-v9", campaignId: "c-autumn", workspaceId: "w-lysne", expertId: "u-anna", state: "held",
    items: items("ck-a-v9", { 1: "x" }), notes: [{ id: "ck-a-v9-n1", number: 1, x: 0.52, y: 0.28, text: "Glossy cap. Fixing it before Maja sees it.", author: "u-anna", at: at(12) }],
    dueAt: inDays(1), risk: "high", startedAt: at(14),
  },
  { id: "ck-solv-1", versionId: "", creativeId: "cr-solv-1", campaignId: "c-solv", workspaceId: "w-solv", expertId: "u-tuva", state: "waiting", items: items("ck-solv-1"), notes: [], dueAt: inDays(2), risk: "normal" },
  { id: "ck-solv-2", versionId: "", creativeId: "cr-solv-2", campaignId: "c-solv", workspaceId: "w-solv", expertId: "u-tuva", state: "waiting", items: items("ck-solv-2"), notes: [], dueAt: inDays(2), risk: "normal" },
];
for (const c of checks) c.versionId = creatives.find((cr) => cr.id === c.creativeId)!.current.id;

export const qualityLog: QualityLogEntry[] = [
  { id: "q1", checkId: "ck-a-v9", workspaceId: "w-lysne", campaignId: "c-autumn", creativeId: "cr-a-v9", severity: "major", what: "Glossy cap; the Product Truth says matte burgundy.", fixed: false, by: "u-anna", at: at(12) },
  { id: "q2", checkId: "x", workspaceId: "w-lysne", campaignId: "c-autumn", creativeId: "cr-a-m1", severity: "critical", what: "Label read \"180 ml\"; corrected to 100 ml before Maja saw it.", fixed: true, by: "u-anna", at: at(60 * 24 * 4) },
  { id: "q3", checkId: "x", workspaceId: "w-lysne", campaignId: "c-summer", creativeId: "cr-s-3", severity: "minor", what: "Oil read orange in the highlights; warmed back to golden.", fixed: true, by: "u-anna", at: at(60 * 24 * 21) },
];

// ─── Deliveries, conversation, notifications, record ────────────────────────

export const deliveries: Delivery[] = [
  {
    id: "dl-summer", campaignId: "c-summer", name: "Summer evenings · Direction A", creativeIds: creatives.filter((c) => c.campaignId === "c-summer").map((c) => c.id),
    state: "confirmed_live", rightsNote: "For LYSNE's paid and organic channels in the Nordics, no end date. No real people appear in these creatives.",
    bytes: 38_400_000, createdAt: at(60 * 24 * 18), formats: ["feed", "story"],
  },
  {
    id: "dl-autumn-m", campaignId: "c-autumn", name: "Autumn launch · Masters", creativeIds: ["cr-a-m1", "cr-a-m2"], state: "ready",
    rightsNote: "For LYSNE's paid and organic channels in the Nordics, no end date. No real people appear in these creatives.",
    bytes: 9_600_000, createdAt: at(60 * 24 * 2), formats: ["feed"],
  },
];

export const threads: Thread[] = [
  { id: "t-general", workspaceId: "w-lysne", campaignId: null, title: "Fume", updatedAt: at(60 * 3), unread: 0 },
  { id: "t-autumn", workspaceId: "w-lysne", campaignId: "c-autumn", title: "Autumn launch", updatedAt: at(6), unread: 1 },
  { id: "t-winter", workspaceId: "w-lysne", campaignId: "c-winter", title: "Winter gifting", updatedAt: at(2), unread: 0 },
  { id: "t-balm", workspaceId: "w-lysne", campaignId: "c-balm", title: "Hand Balm introduction", updatedAt: at(60 * 3), unread: 1 },
];

export const messages: Message[] = [
  { id: "msg1", threadId: "t-autumn", author: { kind: "person", userId: "u-maja" }, text: "Autumn launch for the night body oil. Low evening light, stone and skin, calm and close. Paid social, email and the product page.", at: at(60 * 24 * 12) },
  { id: "msg2", threadId: "t-autumn", author: { kind: "fume" }, text: "Here is your brief. Change anything that is off, then send it to Fume.", at: at(60 * 24 * 12 - 2), card: { kind: "brief", campaignId: "c-autumn", version: 2 } },
  { id: "msg3", threadId: "t-autumn", author: { kind: "fume" }, text: "Three directions are ready. Pick one to take forward, or tell us why none fits.", at: at(60 * 24 * 7), card: { kind: "directions", campaignId: "c-autumn" } },
  { id: "msg4", threadId: "t-autumn", author: { kind: "person", userId: "u-maja" }, text: "A. Evening stone is the autumn feeling.", at: at(60 * 24 * 6) },
  { id: "msg5", threadId: "t-autumn", author: { kind: "engine" }, text: "Variants and channel formats for Masters 1 and 2.", at: at(120), card: { kind: "run", runId: "run-autumn-v" } },
  { id: "msg6", threadId: "t-autumn", author: { kind: "fume" }, text: "Anna checked 6 creatives. They are ready for you; 3 more are in check.", at: at(6), card: { kind: "creatives", campaignId: "c-autumn", creativeIds: ["cr-a-v1", "cr-a-v2", "cr-a-v3", "cr-a-v4", "cr-a-v5", "cr-a-v6"] } },
  { id: "msg7", threadId: "t-balm", author: { kind: "person", userId: "u-maja" }, text: "Let's introduce the hand balm to people who already love the oil.", at: at(60 * 3 + 2) },
  { id: "msg8", threadId: "t-balm", author: { kind: "fume" }, text: "Which claims may we use for Hand Balm?", at: at(60 * 3), card: { kind: "question", question: "Which claims may we use for Hand Balm?", why: "Fume checks every line on a creative against your approved claims, so we need them before any work starts.", options: ["Same as the oil", "I'll send a list"] } },
  { id: "msg9", threadId: "t-winter", author: { kind: "fume" }, text: "The plan for Winter gifting is ready and Anna checked it. Approve it and Fume starts on the 3 masters; nothing is made before that.", at: at(60 * 3), card: { kind: "plan", campaignId: "c-winter", version: 1 } },
  { id: "msg10", threadId: "t-general", author: { kind: "fume" }, text: "Tell Fume what you need. We'll ask a few questions and write the plan with you; nothing is made before you approve it.", at: at(60 * 24 * 12 + 5) },
];

export const notifications: Notification[] = [
  { id: "n7", userId: "u-maja", kind: "waiting_on_you", actor: { kind: "fume" }, text: "The plan for Winter gifting is ready", href: "/campaigns/c-winter/plan", read: false, at: at(60 * 3) }, // round 10
  { id: "n1", userId: "u-maja", kind: "checked", actor: { kind: "person", userId: "u-anna" }, text: "Anna checked 6 creatives in Autumn launch", href: "/campaigns/c-autumn/review", read: false, at: at(6) },
  { id: "n2", userId: "u-maja", kind: "held", actor: { kind: "person", userId: "u-anna" }, text: "Anna is fixing one creative in Autumn launch before you see it", href: "/campaigns/c-autumn", read: false, at: at(12) },
  { id: "n3", userId: "u-maja", kind: "waiting_on_you", actor: { kind: "fume" }, text: "Fume needs the Hand Balm claims to start", href: "/fume/t-balm", read: false, at: at(60 * 3) },
  { id: "n4", userId: "u-maja", kind: "engine_done", actor: { kind: "engine" }, text: "The Engine finished 9 creatives for Autumn launch", href: "/campaigns/c-autumn", read: true, at: at(90) },
  { id: "n5", userId: "u-maja", kind: "mention", actor: { kind: "person", userId: "u-jonas" }, text: "Jonas mentioned you in Winter gifting", href: "/fume/t-winter", read: true, at: at(60 * 26) },
  { id: "n6", userId: "u-maja", kind: "delivered", actor: { kind: "fume" }, text: "Autumn launch masters are ready to download", href: "/deliveries/dl-autumn-m", read: true, at: at(60 * 24 * 2) },
];

export const record: RecordEvent[] = [
  { id: "e1", workspaceId: "w-lysne", campaignId: "c-autumn", subjectId: "c-autumn", actor: { kind: "person", userId: "u-maja" }, action: "brief_approved", detail: "Brief v2 approved", at: at(60 * 24 * 11) },
  { id: "e2", workspaceId: "w-lysne", campaignId: "c-autumn", subjectId: "d-a1", actor: { kind: "person", userId: "u-anna" }, action: "checked", detail: "Three directions checked", at: at(60 * 24 * 7) },
  { id: "e3", workspaceId: "w-lysne", campaignId: "c-autumn", subjectId: "d-a1", actor: { kind: "person", userId: "u-maja" }, action: "direction_chosen", detail: "Direction A, Evening stone, chosen", at: at(60 * 24 * 6) },
  { id: "e4", workspaceId: "w-lysne", campaignId: "c-autumn", subjectId: "cr-a-m1", actor: { kind: "person", userId: "u-anna" }, action: "correction", detail: "Label corrected from 180 ml to 100 ml on Feed 1", at: at(60 * 24 * 4) },
  { id: "e5", workspaceId: "w-lysne", campaignId: "c-autumn", subjectId: "cr-a-m1", actor: { kind: "person", userId: "u-maja" }, action: "changes_requested", detail: "Product lower in the frame on Feed 1 (round 1 of 2)", at: at(60 * 24 * 5) },
  { id: "e6", workspaceId: "w-lysne", campaignId: "c-autumn", subjectId: "cr-a-m1", actor: { kind: "person", userId: "u-maja" }, action: "approved", detail: "Masters 1 and 2 approved", at: at(60 * 24 * 3) },
  { id: "e7", workspaceId: "w-lysne", campaignId: "c-autumn", subjectId: "run-autumn-v", actor: { kind: "engine" }, action: "made", detail: "9 variants and formats made", at: at(90) },
  { id: "e8", workspaceId: "w-lysne", campaignId: "c-autumn", subjectId: "cr-a-v9", actor: { kind: "person", userId: "u-anna" }, action: "held", detail: "One creative held back: glossy cap", at: at(12) },
  { id: "e9", workspaceId: "w-lysne", campaignId: "c-autumn", subjectId: "cr-a-v1", actor: { kind: "person", userId: "u-anna" }, action: "checked", detail: "6 creatives checked", at: at(6) },
];
