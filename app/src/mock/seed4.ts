// Architecture v4 seed (FLOWS.md §15–§21, PROPOSED 15 Oct 2026): placements, LYSNE's detail tokens, camera and
// light presets, the Engine chat, usage, meetings and the content calendar. Same demo brand and clock as seed.ts.

import type {
  CalendarEntry,
  CameraPreset,
  DetailFind,
  DetailToken,
  EngineMessage,
  LightPreset,
  LightRig,
  Meeting,
  Message,
  Placement,
  ProductFix,
  UsageRow,
} from "../contract";
import { at, gen, img, inDays } from "./seed";

// ─── Placements: the format picker (FLOWS §15) ───────────────────────────────

const safe = (top = 0, bottom = 0, left = 0, right = 0) => ({ top, bottom, left, right });

export const placements: Placement[] = [
  {
    id: "pl-ig-feed",
    name: "Instagram feed",
    group: "Instagram",
    ratio: "4:5",
    width: 1080,
    height: 1350,
    format: "feed",
    safe: safe(),
  },
  {
    id: "pl-ig-square",
    name: "Instagram square",
    group: "Instagram",
    ratio: "1:1",
    width: 1080,
    height: 1080,
    format: "square",
    safe: safe(),
  },
  {
    id: "pl-ig-story",
    name: "Instagram story",
    group: "Instagram",
    ratio: "9:16",
    width: 1080,
    height: 1920,
    format: "story",
    safe: safe(0.14, 0.2),
    textLimit: "Keep words out of the top 250 px and bottom 340 px",
  },
  {
    id: "pl-ig-reels",
    name: "Reels cover",
    group: "Instagram",
    ratio: "9:16",
    width: 1080,
    height: 1920,
    format: "story",
    safe: safe(0.1, 0.25),
  },
  {
    id: "pl-meta-feed",
    name: "Meta ad, feed",
    group: "Meta ads",
    ratio: "4:5",
    width: 1080,
    height: 1350,
    format: "feed",
    safe: safe(),
    textLimit: "Primary text 125 characters",
  },
  {
    id: "pl-meta-story",
    name: "Meta ad, stories",
    group: "Meta ads",
    ratio: "9:16",
    width: 1080,
    height: 1920,
    format: "story",
    safe: safe(0.14, 0.2),
  },
  {
    id: "pl-pin",
    name: "Pinterest pin",
    group: "Pinterest",
    ratio: "2:3",
    width: 1000,
    height: 1500,
    format: "feed",
    safe: safe(),
  },
  {
    id: "pl-email",
    name: "Email header",
    group: "Email",
    ratio: "2:1",
    width: 1200,
    height: 600,
    format: "square",
    safe: safe(),
  },
  // r13 #61 (Marcus: "only header? Email has many kinds of pictures"): the common email picture slots.
  {
    id: "pl-email-hero",
    name: "Email hero",
    group: "Email",
    ratio: "3:2",
    width: 1200,
    height: 800,
    format: "square",
    safe: safe(),
  },
  {
    id: "pl-email-product",
    name: "Product block",
    group: "Email",
    ratio: "1:1",
    width: 600,
    height: 600,
    format: "square",
    safe: safe(),
  },
  {
    id: "pl-email-columns",
    name: "Two columns",
    group: "Email",
    ratio: "4:5",
    width: 600,
    height: 750,
    format: "feed",
    safe: safe(),
  },
  {
    id: "pl-email-banner",
    name: "Email banner",
    group: "Email",
    ratio: "4:1",
    width: 1200,
    height: 300,
    format: "square",
    safe: safe(),
  },
  {
    id: "pl-email-full",
    name: "Full width",
    group: "Email",
    ratio: "16:9",
    width: 1200,
    height: 675,
    format: "square",
    safe: safe(),
  },
  {
    id: "pl-pdp",
    name: "Product page",
    group: "Web",
    ratio: "1:1",
    width: 2000,
    height: 2000,
    format: "square",
    safe: safe(),
  },
  {
    id: "pl-banner",
    name: "Web banner",
    group: "Web",
    ratio: "16:9",
    width: 1920,
    height: 1080,
    format: "feed",
    safe: safe(),
  },
];

// ─── Detail tokens: the real product's details the Engine protects (FLOWS §17) ────────────────────────────

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

/** What the Engine read on doc-autumn-m3's renders: v3 reads "200 ml", the demo's product fix. */
export const detailFinds: Record<string, DetailFind[]> = {
  "rv-2": [
    {
      tokenId: "dt-label",
      region: { x: 0.205, y: 0.478, w: 0.22, h: 0.255 },
      read: "LYSNE · Night Body Oil",
      ok: true,
    },
    { tokenId: "dt-size", region: { x: 0.345, y: 0.692, w: 0.05, h: 0.027 }, read: "100 ml", ok: true },
    { tokenId: "dt-cap", region: { x: 0.23, y: 0.252, w: 0.16, h: 0.165 }, read: "Burgundy, matte", ok: true },
  ],
  "rv-3": [
    {
      tokenId: "dt-label",
      region: { x: 0.44, y: 0.455, w: 0.275, h: 0.355 },
      read: "LYSNE · Night Body Oil",
      ok: true,
    },
    { tokenId: "dt-size", region: { x: 0.65, y: 0.755, w: 0.06, h: 0.035 }, read: "200 ml", ok: false },
    { tokenId: "dt-cap", region: { x: 0.42, y: 0.12, w: 0.205, h: 0.195 }, read: "Burgundy, matte", ok: true },
  ],
};

export const fixes: Record<string, ProductFix[]> = {
  "doc-autumn-m3": [
    {
      id: "fx-1",
      tokenId: "dt-cap",
      region: { x: 0.23, y: 0.252, w: 0.16, h: 0.165 },
      found: "Burgundy, glossy",
      expected: "Burgundy, matte",
      auto: true,
      by: "engine",
      at: at(88),
      state: "fixed",
      versionId: "rv-2",
    },
  ],
};

// ─── Light and camera presets (FLOWS §18) ────────────────────────────────────

export const defaultRig: LightRig = {
  lights: [
    { id: "l-key", kind: "key", x: 0.82, y: 0.3, height: 20, warmth: 2700, strength: 80, softness: 60 },
    { id: "l-fill", kind: "fill", x: 0.18, y: 0.45, height: 30, warmth: 3200, strength: 25, softness: 90 },
  ],
};

export const cameras: CameraPreset[] = [
  {
    id: "cp-lysne-close",
    origin: "brand",
    workspaceId: "w-lysne",
    name: "LYSNE close",
    body: "Any full frame · 85 mm",
    lens: { focal: 85, height: 22, tilt: -6 },
    image: img("01-12", "square"),
    note: "The brand's close-up: low, a little from above, shallow.",
  },
  {
    id: "cp-lysne-table",
    origin: "brand",
    workspaceId: "w-lysne",
    name: "LYSNE table",
    body: "Any full frame · 50 mm",
    lens: { focal: 50, height: 35, tilt: -12 },
    image: img("05-06", "square"),
    note: "Product on a surface, room around it.",
  },
  {
    id: "cp-x2d",
    origin: "fume",
    name: "Hasselblad X2D",
    body: "Hasselblad X2D 100C · XCD 90 mm",
    lens: { focal: 90, height: 30, tilt: -5 },
    image: gen("cam-medium"),
    note: "Medium format, calm fall-off. Fume's still-life default.",
  },
  {
    id: "cp-r5",
    origin: "fume",
    name: "Canon R5 macro",
    body: "Canon EOS R5 · RF 100 mm macro",
    lens: { focal: 100, height: 12, tilt: -2 },
    image: gen("cam-macro"),
    note: "Details and textures, very close.",
  },
  {
    id: "cp-leica",
    origin: "fume",
    name: "Leica SL3 35",
    body: "Leica SL3 · Summilux 35 mm",
    lens: { focal: 35, height: 140, tilt: -8 },
    image: gen("cam-35mm"),
    note: "People in a room, natural perspective.",
  },
];

export const lights: LightPreset[] = [
  {
    id: "lp-lysne-evening",
    origin: "brand",
    workspaceId: "w-lysne",
    name: "LYSNE evening light",
    value: "Low side light from the right, warm, 2700 K",
    rig: defaultRig,
  },
  {
    id: "lp-window",
    origin: "fume",
    name: "Soft window",
    value: "One big soft source from the left, 4500 K",
    rig: {
      lights: [{ id: "w1", kind: "key", x: 0.12, y: 0.35, height: 25, warmth: 4500, strength: 70, softness: 95 }],
    },
  },
  {
    id: "lp-rim",
    origin: "fume",
    name: "Rim and glow",
    value: "Back light on the glass, soft fill in front",
    rig: {
      lights: [
        { id: "r1", kind: "rim", x: 0.5, y: 0.08, height: 35, warmth: 3000, strength: 85, softness: 40 },
        { id: "r2", kind: "fill", x: 0.5, y: 0.9, height: 10, warmth: 3600, strength: 20, softness: 90 },
      ],
    },
  },
];

// ─── The Engine chat (Fume's people) ─────────────────────────────────────────

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
  // Round 12 DESK (DTASK-5): the run is the product page's (bt-1 has no campaign); only campaigns whose plan is approved are offered.
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

// ─── Admin: usage per brand ──────────────────────────────────────────────────

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

// ─── Meetings and the content calendar ───────────────────────────────────────

const day = (d: number, hour = 9) => {
  const t = new Date(inDays(d));
  t.setUTCHours(hour, 0, 0, 0);
  return t.toISOString();
};

export const meetings: Meeting[] = [
  {
    id: "mt-1",
    workspaceId: "w-lysne",
    topic: "Winter gifting: plan the launch",
    at: day(2, 12),
    minutes: 30,
    hostId: "u-sander",
    guestIds: ["u-maja"],
    state: "booked",
  },
];

export const calendar: CalendarEntry[] = [
  {
    id: "ce-1",
    workspaceId: "w-lysne",
    kind: "campaign",
    title: "Autumn launch",
    start: day(3),
    end: day(24),
    campaignId: "c-autumn",
    image: img("05-06", "square"),
  },
  {
    id: "ce-2",
    workspaceId: "w-lysne",
    kind: "campaign",
    title: "Winter gifting",
    start: day(20),
    end: day(55),
    campaignId: "c-winter",
    image: img("02-05", "square"),
  },
  { id: "ce-3", workspaceId: "w-lysne", kind: "drop", title: "Gift sets on lysne.no", start: day(21) },
  {
    id: "ce-4",
    workspaceId: "w-lysne",
    kind: "delivery",
    title: "Autumn masters delivered",
    start: day(-2),
    campaignId: "c-autumn",
  },
  // Black Friday runs Black Friday to Cyber Monday, 27–30 Nov 2026. Round 9 (DLOAD-10): a campaign's window starts on
  // its go-live (the campaign's dueAt): Autumn 17 Oct, Winter gifting 3 Nov, Black Friday 27 Nov.
  {
    id: "ce-9",
    workspaceId: "w-lysne",
    kind: "campaign",
    title: "Black Friday",
    start: day(44),
    end: day(47),
    campaignId: "c-bf",
    image: img("10-06", "square"),
  },
  {
    id: "ce-5",
    workspaceId: "w-lysne",
    kind: "post",
    title: "Feed 1",
    start: day(3, 18),
    placementId: "pl-ig-feed",
    creativeId: "cr-a-m1",
    campaignId: "c-autumn",
    image: img("05-06", "square"),
  },
  {
    id: "ce-6",
    workspaceId: "w-lysne",
    kind: "post",
    title: "Feed 2",
    start: day(4, 18),
    placementId: "pl-ig-story",
    creativeId: "cr-a-m2",
    campaignId: "c-autumn",
    image: img("08-02", "square"),
  },
  {
    id: "ce-7",
    workspaceId: "w-lysne",
    kind: "post",
    title: "Feed 1",
    start: day(5, 7),
    placementId: "pl-email",
    creativeId: "cr-a-m1",
    campaignId: "c-autumn",
    image: img("05-06", "square"),
  },
  {
    id: "ce-8",
    workspaceId: "w-lysne",
    kind: "meeting",
    title: "Winter gifting: plan the launch",
    start: day(2, 12),
    meetingId: "mt-1",
  },
];

// ─── Fume hands over to a person, in the one conversation (FLOWS §21) ─────────

export const handover: Message[] = [
  {
    id: "msg-h1",
    threadId: "t-general",
    author: { kind: "person", userId: "u-maja" },
    text: "Can we move the invoice date for October to the end of the month?",
    at: at(60 * 20 + 3),
  },
  {
    id: "msg-h2",
    threadId: "t-general",
    author: { kind: "fume" },
    text: "That is one for a person. Sander at Fume will answer you here.",
    at: at(60 * 20 + 2),
    card: { kind: "handover", userId: "u-sander", reason: "Invoices are handled by people at Fume." },
  },
  {
    id: "msg-h3",
    threadId: "t-general",
    author: { kind: "person", userId: "u-sander" },
    text: "Hi Maja, done: the October invoice is now due on the 31st.",
    at: at(60 * 20),
  },
];
