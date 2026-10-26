// The Quality Gate: the expert's checks of each creative and what they are checked against, the quality log, and the
// creatives that wait in Check.
import type { Check, CheckItem, QaItem, QualityLogEntry } from "../../contract";
import { campaigns } from "./campaigns";
import { at, img, inDays, ok } from "./helpers";
import { batches, creatives, engineMessages } from "./production";
import { products } from "./products";
import { layoutLayers } from "./studio";

// ─── The Quality Gate's checks ──────────────────────────────────────────────

const items = (prefix: string, notes: Record<number, string> = {}): CheckItem[] =>
  [
    { area: "product_truth", label: "Bottle", against: "Amber glass, 100 ml, as in the packshot." },
    { area: "product_truth", label: "Cap", against: "Burgundy, matte. Never glossy, never black." },
    { area: "product_truth", label: "Label", against: "Front and centred, not cropped, not moved." },
    { area: "brand_rules", label: "Light", against: "Warm neutrals and amber light; no cold light." },
    { area: "claims", label: "Claims against the brief", against: "No skin-result claims in the creative." },
    {
      area: "channel",
      label: "Format and safe area",
      against: "Feed 1080 × 1350; nothing important in the outer 6 %.",
    },
  ].map((it, i) => ({
    id: `${prefix}-i${i + 1}`,
    ...it,
    result: notes[i] ? ("note" as const) : ("pending" as const),
    ...(notes[i] ? { noteId: `${prefix}-n1` } : {}),
  })) as CheckItem[];

export const checks: Check[] = [
  {
    id: "ck-a-v7",
    versionId: "",
    creativeId: "cr-a-v7",
    campaignId: "c-autumn",
    workspaceId: "w-lysne",
    expertId: "u-anna",
    state: "in_check",
    items: items("ck-a-v7", { 1: "x" }).map((it, i) => (i === 0 || i === 2 ? { ...it, result: "pass" } : it)),
    notes: [
      {
        id: "ck-a-v7-n1",
        number: 1,
        x: 0.5,
        y: 0.31,
        text: "The cap catches too much light and reads glossy. Match the matte burgundy in the Product Truth.",
        author: "u-anna",
        at: at(4),
      },
    ],
    dueAt: inDays(1),
    risk: "normal",
    startedAt: at(6),
  },
  {
    id: "ck-a-v8",
    versionId: "",
    creativeId: "cr-a-v8",
    campaignId: "c-autumn",
    workspaceId: "w-lysne",
    expertId: "u-anna",
    state: "waiting",
    items: items("ck-a-v8"),
    notes: [],
    dueAt: inDays(1),
    risk: "normal",
  },
  {
    id: "ck-a-v9",
    versionId: "",
    creativeId: "cr-a-v9",
    campaignId: "c-autumn",
    workspaceId: "w-lysne",
    expertId: "u-anna",
    state: "held",
    items: items("ck-a-v9", { 1: "x" }),
    notes: [
      {
        id: "ck-a-v9-n1",
        number: 1,
        x: 0.52,
        y: 0.28,
        text: "Glossy cap. Fixing it before Maja sees it.",
        author: "u-anna",
        at: at(12),
      },
    ],
    dueAt: inDays(1),
    risk: "high",
    startedAt: at(14),
  },
  {
    id: "ck-solv-1",
    versionId: "",
    creativeId: "cr-solv-1",
    campaignId: "c-solv",
    workspaceId: "w-solv",
    expertId: "u-tuva",
    state: "waiting",
    items: items("ck-solv-1"),
    notes: [],
    dueAt: inDays(2),
    risk: "normal",
  },
  {
    id: "ck-solv-2",
    versionId: "",
    creativeId: "cr-solv-2",
    campaignId: "c-solv",
    workspaceId: "w-solv",
    expertId: "u-tuva",
    state: "waiting",
    items: items("ck-solv-2"),
    notes: [],
    dueAt: inDays(2),
    risk: "normal",
  },
];

// Each check is of its creative's current version.
for (const c of checks) c.versionId = creatives.find((cr) => cr.id === c.creativeId)!.current.id;

export const qualityLog: QualityLogEntry[] = [
  {
    id: "q1",
    checkId: "ck-a-v9",
    workspaceId: "w-lysne",
    campaignId: "c-autumn",
    creativeId: "cr-a-v9",
    severity: "major",
    what: "Glossy cap; the Product Truth says matte burgundy.",
    fixed: false,
    by: "u-anna",
    at: at(12),
  },
  {
    id: "q2",
    checkId: "x",
    workspaceId: "w-lysne",
    campaignId: "c-autumn",
    creativeId: "cr-a-m1",
    severity: "critical",
    what: 'Label read "180 ml"; corrected to 100 ml before Maja saw it.',
    fixed: true,
    by: "u-anna",
    at: at(60 * 24 * 4),
  },
  {
    id: "q3",
    checkId: "x",
    workspaceId: "w-lysne",
    campaignId: "c-summer",
    creativeId: "cr-s-3",
    severity: "minor",
    what: "Oil read orange in the highlights; warmed back to golden.",
    fixed: true,
    by: "u-anna",
    at: at(60 * 24 * 21),
  },
];

// ─── Check: what waits for the expert ───────────────────────────────────────

// The title is the creative's one name ("Feed 6", as on its campaign); the slot keeps its lineage.
const qa = (
  id: string,
  creativeId: string,
  title: string,
  tile: string,
  minutesAgo: number,
  extra: Partial<QaItem> = {},
): QaItem => ({
  id,
  workspaceId: "w-lysne",
  campaignId: "c-autumn",
  creativeId,
  title,
  slot: title,
  studio: "render",
  image: img(tile),
  format: "feed",
  madeAt: at(minutesAgo),
  dueAt: inDays(1),
  risk: "normal",
  state: "waiting",
  evaluation: ok,
  feedback: [],
  ...extra,
});

const seeded: QaItem[] = [
  qa("qa-1", "cr-a-v7", "Feed 6", "09-07", 8, { slot: "Master 2 · Variant 2" }),
  qa("qa-2", "cr-a-v8", "Square 2", "09-07", 7, {
    slot: "Master 2 · Variant 2 · square",
    format: "square",
    image: img("09-07", "square"),
  }),
  qa("qa-3", "cr-a-v9", "Feed 7", "06-10", 12, {
    slot: "Master 2 · Variant 3",
    risk: "high",
    evaluation: { ...ok, productTruth: "flag", notes: ["The cap reads glossy"] },
    feedback: [
      {
        id: "fb-1",
        text: "The cap must be matte burgundy, as in the Product Truth.",
        by: "u-anna",
        at: at(11),
        state: "sent",
      },
    ],
    state: "fixing",
  }),
  qa("qa-4", "cr-doc-autumn-email", "Email header", "05-01", 15, {
    studio: "design",
    documentId: "doc-autumn-email",
    format: "story",
    image: img("05-01", "story"),
    layers: structuredClone(layoutLayers),
  }),
  {
    ...qa("qa-5", "cr-solv-1", "Feed 1", "10-08", 30, { slot: "Master 1" }),
    workspaceId: "w-solv",
    campaignId: "c-solv",
  },
  {
    ...qa("qa-6", "cr-solv-2", "Feed 2", "10-06", 28, {
      slot: "Master 2",
      evaluation: { ...ok, artefacts: "minor", notes: ["A soft edge on the left cup"] },
    }),
    workspaceId: "w-solv",
    campaignId: "c-solv",
  },
];

/** Each creative a batch from the Engine chat made waits in Check, naming its run, whether it was for a campaign or for
 *  the product page ("Product page" in Check). */
const fromEngineChat: QaItem[] = batches
  .filter((b) => engineMessages.some((m) => m.widget?.kind === "batch" && m.widget.batchId === b.id))
  .flatMap((b) => {
    const campaign = campaigns.find((c) => c.id === b.campaignId);
    return Array.from({ length: b.made }, (_, i): QaItem => {
      const product = products.find((p) => p.id === b.productIds[Math.floor(i / b.perProduct)]);
      const label = b.format === "square" ? "Square" : b.format === "story" ? "Story" : "Feed";
      const title = `${product?.name ?? "Packshot"} · ${label} ${i + 1}`;
      return {
        id: `qa-${b.id}-${i + 1}`,
        workspaceId: b.workspaceId,
        campaignId: campaign?.id ?? "",
        creativeId: `${b.id}-c${i + 1}`,
        runId: b.id,
        title,
        slot: title,
        studio: "render",
        image: b.previews[i % Math.max(1, b.previews.length)]!,
        format: b.format,
        madeAt: new Date(Date.parse(b.at) + (i + 1) * 60_000).toISOString(),
        dueAt: campaign?.dueAt ?? new Date(Date.parse(b.at) + 2 * 86_400_000).toISOString(),
        risk: "normal",
        state: "waiting",
        evaluation: { productTruth: "pass", brandRules: "pass", artefacts: "none", notes: [] },
        feedback: [],
      };
    });
  });

export const qaItems: QaItem[] = [...seeded, ...fromEngineChat];
