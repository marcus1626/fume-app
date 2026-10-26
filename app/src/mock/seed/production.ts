// What Fume has made for LYSNE and SOLV: the creatives with their versions, the Engine's runs, the Engine chat with its
// batch of packshots, and the usage per brand.
import type {
  Batch,
  Creative,
  CreativeVersion,
  EngineMessage,
  EngineRun,
  Format,
  UsageRow,
  VersionState,
} from "../../contract";
import { at, img, SIZE } from "./helpers";

// ─── Creatives ──────────────────────────────────────────────────────────────

let vSeq = 0;

function version(
  creativeId: string,
  tile: string,
  format: Format,
  state: VersionState,
  minutesAgo: number,
  extra: Partial<CreativeVersion> = {},
): CreativeVersion {
  const [width, height] = SIZE[format];
  vSeq += 1;
  const checked = ["checked", "approved", "delivered", "changes_requested"].includes(state);
  const approved = ["approved", "delivered"].includes(state);
  return {
    id: `v-${creativeId}-${vSeq}`,
    creativeId,
    number: 1,
    image: img(tile, format),
    width,
    height,
    state,
    madeAt: at(minutesAgo + 30),
    ...(checked ? { checkedBy: "u-anna", checkedAt: at(minutesAgo) } : {}),
    ...(approved ? { approvedBy: "u-maja", approvedAt: at(Math.max(minutesAgo - 60, 1)) } : {}),
    ...extra,
  };
}

function creative(
  id: string,
  campaignId: string,
  directionId: string,
  masterId: string | null,
  title: string,
  name: string,
  format: Format,
  tile: string,
  state: VersionState,
  minutesAgo: number,
  extra: Partial<CreativeVersion> = {},
): Creative {
  const current = version(id, tile, format, state, minutesAgo, extra);
  return {
    id,
    campaignId,
    directionId,
    masterId,
    kind: masterId ? "variant" : "master",
    format,
    channel: format === "story" ? "organic_social" : "paid_social",
    name,
    title,
    current,
    versions: [current],
  };
}

// A creative made before plans existed is named by its format and its number
// among the campaign's creatives in that format, in the order they were made ("Feed 3"; copy.creativeName adds the
// product: "Night Body Oil · Feed 3"). Its lineage ("Master 2 · Variant 2") stays in the delivery name and the Studio.
export const creatives: Creative[] = [
  // Autumn launch: two approved masters, then variants and formats (6 checked and waiting for Maja, 3 in check)
  creative(
    "cr-a-m1",
    "c-autumn",
    "d-a1",
    null,
    "Feed 1",
    "lysne_autumn_a_m1_feed_v2",
    "feed",
    "05-06",
    "approved",
    60 * 24 * 3,
  ),
  creative(
    "cr-a-m2",
    "c-autumn",
    "d-a1",
    null,
    "Feed 2",
    "lysne_autumn_a_m2_feed_v1",
    "feed",
    "08-02",
    "approved",
    60 * 24 * 3,
  ),
  creative(
    "cr-a-v1",
    "c-autumn",
    "d-a1",
    "cr-a-m1",
    "Feed 3",
    "lysne_autumn_a_m1_v1_feed_v1",
    "feed",
    "04-05",
    "checked",
    45,
  ),
  creative(
    "cr-a-v2",
    "c-autumn",
    "d-a1",
    "cr-a-m1",
    "Story 1",
    "lysne_autumn_a_m1_v1_story_v1",
    "story",
    "04-05",
    "checked",
    44,
  ),
  creative(
    "cr-a-v3",
    "c-autumn",
    "d-a1",
    "cr-a-m1",
    "Feed 4",
    "lysne_autumn_a_m1_v2_feed_v1",
    "feed",
    "03-05",
    "checked",
    40,
  ),
  creative(
    "cr-a-v4",
    "c-autumn",
    "d-a1",
    "cr-a-m1",
    "Square 1",
    "lysne_autumn_a_m1_v2_square_v1",
    "square",
    "03-05",
    "checked",
    39,
  ),
  creative(
    "cr-a-v5",
    "c-autumn",
    "d-a1",
    "cr-a-m2",
    "Feed 5",
    "lysne_autumn_a_m2_v1_feed_v1",
    "feed",
    "05-01",
    "checked",
    22,
  ),
  creative(
    "cr-a-v6",
    "c-autumn",
    "d-a1",
    "cr-a-m2",
    "Story 2",
    "lysne_autumn_a_m2_v1_story_v1",
    "story",
    "05-01",
    "checked",
    21,
  ),
  creative(
    "cr-a-v7",
    "c-autumn",
    "d-a1",
    "cr-a-m2",
    "Feed 6",
    "lysne_autumn_a_m2_v2_feed_v1",
    "feed",
    "09-07",
    "in_check",
    8,
  ),
  creative(
    "cr-a-v8",
    "c-autumn",
    "d-a1",
    "cr-a-m2",
    "Square 2",
    "lysne_autumn_a_m2_v2_square_v1",
    "square",
    "09-07",
    "in_check",
    7,
  ),
  creative(
    "cr-a-v9",
    "c-autumn",
    "d-a1",
    "cr-a-m2",
    "Feed 7",
    "lysne_autumn_a_m2_v3_feed_v1",
    "feed",
    "06-10",
    "held",
    12,
    { heldReason: "The cap reads glossy. Anna is matching it to the matte burgundy in the Product Truth." },
  ),
  // Summer evenings: delivered
  ...["08-06", "09-02", "07-10", "10-08", "09-04", "02-09", "01-12", "04-08"].map((tile, i) =>
    creative(
      `cr-s-${i + 1}`,
      "c-summer",
      "d-s1",
      i === 0 ? null : "cr-s-1",
      i % 2 ? `Story ${(i + 1) / 2}` : `Feed ${i / 2 + 1}`,
      `lysne_summer_a_m1_v${i}_${i % 2 ? "story" : "feed"}_v1`,
      i % 2 ? "story" : "feed",
      tile,
      "delivered",
      60 * 24 * 20 + i,
    ),
  ),
  // SOLV: two masters in check (another workspace, for the Studio queue)
  creative(
    "cr-solv-1",
    "c-solv",
    "d-solv",
    null,
    "Feed 1",
    "solv_morning_a_m1_feed_v1",
    "feed",
    "10-08",
    "in_check",
    30,
  ),
  creative(
    "cr-solv-2",
    "c-solv",
    "d-solv",
    null,
    "Feed 2",
    "solv_morning_a_m2_feed_v1",
    "feed",
    "10-06",
    "in_check",
    28,
  ),
];

// Master 1 went through one round of the customer's changes: keep that history in its version chain.
{
  const m1 = creatives[0];
  const v1: CreativeVersion = {
    ...m1.current,
    id: "v-cr-a-m1-old",
    number: 1,
    image: img("01-03"),
    state: "changes_requested",
    approvedBy: undefined,
    approvedAt: undefined,
    checkedAt: at(60 * 24 * 5),
  };
  m1.versions = [v1, { ...m1.current, number: 2 }];
  m1.current = m1.versions[1];
}

// ─── The Engine: runs, the Engine chat, usage and batches ───────────────────

export const runs: EngineRun[] = [
  {
    id: "run-autumn-v",
    campaignId: "c-autumn",
    purpose: "variants",
    state: "done",
    made: 9,
    total: 9,
    startedAt: at(120),
    previews: [img("04-05"), img("03-05"), img("05-01"), img("09-07"), img("06-10")],
    steps: [
      { label: "Masters 1 and 2 approved by Maja", state: "done" },
      { label: "Variants and channel formats", state: "done", detail: "9 of 9" },
      { label: "Quality Gate: Anna checks each creative", state: "active", detail: "6 of 9" },
    ],
  },
];

export const engineMessages: EngineMessage[] = [
  {
    id: "em-1",
    workspaceId: "w-lysne",
    author: { kind: "person", userId: "u-anna" },
    text: "Packshots of the gift set products for the product page, on LYSNE packshot white.",
    at: at(60 * 7),
  },
  {
    id: "em-2",
    workspaceId: "w-lysne",
    author: { kind: "engine" },
    text: "The Gift sets collection holds 4 products. 3 wait for Maja to confirm their facts, so they are locked. Tick the ones to make for.",
    at: at(60 * 7 - 1),
    widget: { kind: "products", productIds: ["pr-oil", "pr-candle", "pr-ritual", "pr-kveld"], picked: ["pr-oil"] },
  },
  {
    id: "em-3",
    workspaceId: "w-lysne",
    author: { kind: "engine" },
    text: "One product. How many per product?",
    at: at(60 * 7 - 2),
    widget: { kind: "choice", question: "How many per product?", options: ["2", "4", "6"], answer: "4" },
  },
  // The run is the product page's (bt-1 has no campaign); only campaigns whose plan is approved are offered.
  {
    id: "em-3b",
    workspaceId: "w-lysne",
    author: { kind: "engine" },
    text: "Winter gifting and Black Friday wait for their plans to be approved. For which campaign?",
    at: at(60 * 7 - 3),
    widget: {
      kind: "choice",
      question: "For which campaign?",
      options: ["No campaign · product page", "Autumn launch"],
      answer: "No campaign · product page",
    },
  },
  {
    id: "em-4",
    workspaceId: "w-lysne",
    author: { kind: "engine" },
    text: "Making 4 packshots for the product page in Packshot mode, 1:1: 1 × 4. Each lands in Check as it is made, for the expert. Open any of them in the Studio for more control.",
    at: at(60 * 6),
    widget: { kind: "batch", batchId: "bt-1" },
  },
];

export const usage: UsageRow[] = [
  {
    workspaceId: "w-lysne",
    renders: 412,
    cost: 49.44,
    creatives: 31,
    delivered: 14,
    trend: [22, 31, 18, 40, 55, 61, 84, 101],
  },
  { workspaceId: "w-solv", renders: 96, cost: 11.52, creatives: 6, delivered: 0, trend: [0, 0, 0, 4, 12, 20, 28, 32] },
];

export const batches: Batch[] = [
  // Packshots for the product page, no campaign; Winter gifting has no run before its plan is approved.
  {
    id: "bt-1",
    workspaceId: "w-lysne",
    campaignId: "",
    modeId: "m-packshot",
    productIds: ["pr-oil"],
    perProduct: 4,
    format: "square",
    state: "done",
    made: 4,
    total: 4,
    previews: ["03-08", "03-02", "03-05", "03-12"].map((t) => img(t, "square")),
    by: "u-anna",
    at: at(60 * 6),
  },
];
