// Round 13 BRAND (Marcus's video comments #2–#5, #41–#49 and the robots' notes on chapters 05, 08, 10 and 12; PROPOSED
// 22 Oct 2026). What the brand screens need from the mock, over the finished api:
// - #42 each colour's uses (Buttons, Accent, Backgrounds …), set as chips.
// - #3 the pictures Fume found, sorted into groups: Your look (lasting), Campaign looks (named after the campaign or
//   season), Product shots, Not used; she moves a picture to another group.
// - #4 the voice in five parts (identity, how we speak, rules, audience, examples), each confirmed or changed.
// - #43 every rule is a Do or a Don't. The imagery rule no longer says "never a face" while Ane and Leo show faces:
//   people are AI models only, always labelled, never a real person's face (robots, 05-brand).
// - #41 the AI models' sheets: seven angles in a white studio in the same plain clothes, and their specs.
// - #44 two products Fume found since she last looked ("New").
// - #47 "Neither" in a taste pair. #49 her profile changed in place.
// Everyone else is served as before.
import type {
  BrandColour,
  BrandIdentity,
  BrandImage,
  BrandModel,
  BrandRule,
  ColourUse,
  FumeApi,
  Id,
  ModelAngle,
  ModelSpec,
  Product,
  Provenance,
  TastePair,
  User,
  VoiceBook,
} from "../contract";
import { FumeError } from "../contract";
import { at, gen, img } from "./seed";
import { update as brandUpdate } from "./seed9";

type Calls = "setColourUses" | "moveImage" | "decideVoicePart" | "passTastePair" | "updateProfile";
type Wraps = "brandBoard" | "decide";

interface Db {
  identity: BrandIdentity;
  rules: BrandRule[];
  models: BrandModel[];
  products: Product[];
  tastePairs: TastePair[];
  /** Brand › Taste's training cards: a pair answered "Neither" counts as answered. */
  tasteCards?: { id: string }[];
  tasteState?: { answered: number; updatedAt?: string };
  users: User[];
  boards: { items: { id: string; text?: string }[] }[];
}

export interface R13BrandContext {
  db: Db;
  wait: <T>(value: T) => Promise<T>;
  userId: () => Id;
  fresh?: boolean;
}

const clone = <T>(value: T): T => structuredClone(value);

// ─── Colour uses (#42) ──────────────────────────────────────────────────────

const colourUses: Record<string, ColourUse[]> = {
  "col-ink": ["text", "ui"],
  "col-linen": ["backgrounds", "packaging"],
  "col-amber": ["accent", "light", "packaging"],
  "col-cap": ["accent", "buttons", "packaging"],
  "col-stone": ["backgrounds"],
  "col-dusk": [],
};

// ─── Imagery groups (#3) ────────────────────────────────────────────────────

const imageGroups: Record<string, Pick<BrandImage, "group" | "campaign">> = {
  "im-1": { group: "campaign", campaign: "Spring relaunch 2026" },
  "im-2": { group: "look" },
  "im-3": { group: "look" },
  "im-4": { group: "look" },
};

/** More of what Fume found on the website, so every group has something in it. */
const moreImages = (p: (evidence: string) => Provenance): BrandImage[] => [
  {
    id: "im-5",
    image: img("06-05"),
    caption: "Summer evenings, golden hour",
    provenance: p("Summer evenings 2025, lysne.no/journal"),
    group: "campaign",
    campaign: "Summer evenings 2025",
  },
  {
    id: "im-6",
    image: gen("oil-pack"),
    caption: "Night Body Oil on white",
    provenance: p("lysne.no/shop"),
    group: "product",
  },
  {
    id: "im-7",
    image: gen("balm-pack"),
    caption: "Hand Balm on white",
    provenance: p("lysne.no/shop"),
    group: "product",
  },
  {
    id: "im-8",
    image: img("04-06"),
    caption: "Christmas market stand, 2024",
    provenance: p("lysne.no/journal"),
    group: "unused",
  },
];

// ─── Rules as Do or Don't (#43) ─────────────────────────────────────────────

const rulePolarity: Record<string, BrandRule["polarity"]> = {
  r1: "do",
  r2: "do",
  r3: "do",
  r4: "do",
  r5: "do",
  r6: "do",
  r7: "dont",
};
const moreRules: BrandRule[] = [
  {
    id: "r8",
    area: "colour",
    statement: "No cold blue light and no saturated colour.",
    kind: "rule",
    source: "verified",
    confidence: "high",
    polarity: "dont",
  },
  {
    id: "r9",
    area: "voice",
    statement: "No exclamation marks and no urgency: never “now”, “hurry” or “last chance”.",
    kind: "hard_constraint",
    source: "supplied",
    confidence: "high",
    polarity: "dont",
  },
  {
    id: "r10",
    area: "imagery",
    statement: "No real person’s face. People are AI models, always labelled as AI.",
    kind: "hard_constraint",
    source: "supplied",
    confidence: "high",
    polarity: "dont",
  },
];

// ─── AI model sheets (#41) ──────────────────────────────────────────────────

const angles: ModelAngle[] = [
  "front",
  "three-quarter",
  "profile",
  "back",
  "face",
  "face-three-quarter",
  "face-profile",
];
const sheet = (name: string) => angles.map((angle) => ({ angle, image: gen(`models/${name}-${angle}`) }));
const clothing = "Off-white t-shirt, grey trousers, barefoot";
const never = ["Shown as a real customer, a review or a testimonial", "Before-and-after", "Nudity"];

const modelSpecs: Record<string, { look: string; spec: ModelSpec }> = {
  "bm-ane": {
    look: "30s, ash-blonde hair, freckles, calm",
    spec: {
      ageRange: "32 to 38",
      height: "170 cm",
      build: "Slim, soft shoulders",
      skinTone: "Fair, warm undertone, light freckles",
      hair: "Ash blonde, shoulder length, loose waves",
      eyes: "Grey-blue",
      sizes: [
        { label: "Top", value: "S" },
        { label: "Trousers", value: "36" },
        { label: "Shoes", value: "38" },
      ],
      clothing,
      allowedUses: ["Brand photography", "Paid social", "Product pages"],
      neverUses: never,
    },
  },
  "bm-leo": {
    look: "early 30s, light brown hair, light stubble",
    spec: {
      ageRange: "30 to 35",
      height: "184 cm",
      build: "Lean, broad shoulders",
      skinTone: "Fair, neutral undertone",
      hair: "Light brown, short, textured",
      eyes: "Blue-grey",
      sizes: [
        { label: "Top", value: "M" },
        { label: "Trousers", value: "50" },
        { label: "Shoes", value: "44" },
      ],
      clothing,
      allowedUses: ["Brand photography"],
      neverUses: never,
    },
  },
  "bm-mia": {
    look: "20s, long dark-brown hair",
    spec: {
      ageRange: "24 to 28",
      height: "167 cm",
      build: "Slim",
      skinTone: "Fair, cool undertone",
      hair: "Dark brown, long, straight",
      eyes: "Green-grey",
      sizes: [
        { label: "Top", value: "XS" },
        { label: "Trousers", value: "34" },
        { label: "Shoes", value: "38" },
      ],
      clothing,
      allowedUses: ["Brand photography", "Paid social"],
      neverUses: never,
    },
  },
};

// ─── The voice in five parts (#4) ───────────────────────────────────────────

const voiceBook = (p: (evidence: string) => Provenance): VoiceBook => ({
  parts: [
    {
      id: "identity",
      found: "Calm, warm and close: a brand for the hour before sleep.",
      provenance: p("lysne.no/about"),
    },
    {
      id: "speak",
      found: "Short, quiet sentences. “You”, rarely “we”; informal «du» in Norwegian.",
      provenance: p("lysne.no, 14 pages"),
    },
    {
      id: "rules",
      found: "No result claims, no urgency, no exclamation marks.",
      provenance: p("lysne.no/about and product pages"),
    },
    { id: "audience", found: "Women 30 to 55 in Norway who keep an evening ritual.", provenance: p("lysne.no/about") },
    { id: "examples", found: "6 good lines, in Norwegian and English.", provenance: p("lysne.no, Instagram") },
  ],
  identity: {
    who: "LYSNE makes body oils and small rituals for the hour before sleep. Made in Norway, sold in Norway and the Nordics.",
    believe: [
      "The evening is worth slowing down for.",
      "Fewer, better things: a short list, made well.",
      "Care is a habit, not a promise of results.",
    ],
    personality: ["Calm", "Warm", "Close", "Quietly sure"],
  },
  speak: {
    traits: [
      {
        trait: "Calm",
        means: "We never hurry the reader.",
        do: "Warm the oil in your hands. Breathe out.",
        dont: "Don’t miss out. Order tonight!",
      },
      {
        trait: "Close",
        means: "We write to one person, as a friend would.",
        do: "Your evening, slowed down.",
        dont: "Our customers love our bestselling oil.",
      },
      {
        trait: "Plain",
        means: "Simple words; the product speaks for itself.",
        do: "Almond oil and squalane. Nothing else.",
        dont: "A luxurious, transformative elixir.",
      },
      {
        trait: "Sensory",
        means: "We say what it feels like, not what it does.",
        do: "Golden, slow, warm on the skin.",
        dont: "Visibly firmer skin in 7 days.",
      },
    ],
    use: ["evening", "slow", "warm", "your hands", "breathe", "kveld", "ro", "varme"],
    avoid: ["anti-ageing", "miracle", "results", "luxury", "hurry", "transform", "best ever"],
    sentences: "Short: two to eight words, one idea a line. A full stop where others use a comma.",
    formality: "Informal and close: «du» in Norwegian, “you” in English. Never «dere» or “customers”.",
    languages:
      "Norwegian (bokmål) first, on lysne.no and in Norway; English for the Nordics and Instagram. Never both in one line.",
  },
  rules: {
    must: [
      "Name the product as it is printed: Night Body Oil · 100 ml.",
      "Say “you”, rarely “we”.",
      "End a line with a full stop.",
    ],
    never: [
      "Skin-result claims, or before-and-after.",
      "Urgency: “now”, “hurry”, “last chance”.",
      "Exclamation marks and emojis.",
    ],
    claims: ["For the hour before sleep.", "100 % natural oils.", "Made in Norway."],
  },
  audience: {
    who: "Women 30 to 55 in Norway who keep an evening ritual.",
    cares: [
      "A calm end to the day",
      "Few, honest ingredients",
      "Things that look good on a bedside",
      "Gifts that feel personal",
    ],
    notFor: "Not for quick fixes or results-led skincare.",
  },
  examples: [
    { line: "Varm oljen i hendene. Pust ut.", where: "lysne.no, Night Body Oil", language: "no" },
    { line: "Warm the oil in your hands. Breathe out.", where: "Instagram, Autumn launch", language: "en" },
    { line: "Til timen før du sovner.", where: "The label, Night Body Oil", language: "no" },
    { line: "For the hour before sleep.", where: "The approved claims list", language: "en" },
    { line: "Kvelden din, litt langsommere.", where: "Newsletter, September", language: "no" },
    { line: "Your evening, slowed down.", where: "lysne.no, front page", language: "en" },
  ],
});

/** The layer: the db patched once (after a fresh start is set up), the new calls, and the board's two calls wrapped
 *  (they carry the voice book) over the calls as they were before. */
export function r13BrandApi(ctx: R13BrandContext): {
  calls: Pick<FumeApi, Calls>;
  wraps: (base: Pick<FumeApi, Wraps>) => Pick<FumeApi, Wraps>;
} {
  const { db, wait } = ctx;
  // A fresh brand's first reading: everything Fume read waits for her; otherwise what Maja already approved.
  const found = (evidence: string): Provenance =>
    ctx.fresh
      ? { origin: "engine", state: "proposed", evidence, confidence: "medium" }
      : { origin: "engine", state: "approved", evidence, by: "u-maja", at: at(60 * 24 * 9) };

  for (const c of db.identity.colours) c.uses = c.uses ?? colourUses[c.id] ?? [];
  for (const i of db.identity.imagery) Object.assign(i, imageGroups[i.id] ?? { group: i.group ?? "look" });
  if (!db.identity.imagery.some((i) => i.id === "im-5")) db.identity.imagery.push(...moreImages(found));
  for (const r of db.rules) {
    if (r.id === "r5")
      r.statement = "Stone, linen and glass. People are AI models only, always labelled; skin in soft crops.";
    if (r.id === "r2") r.statement = "Warm neutrals and amber light.";
    r.polarity = r.polarity ?? rulePolarity[r.id] ?? (/^(no|never|don’t|don't)\b/i.test(r.statement) ? "dont" : "do");
  }
  if (!db.rules.some((r) => r.id === "r8")) db.rules.push(...moreRules);
  for (const m of db.models) {
    const s = modelSpecs[m.id];
    const name = m.name.toLowerCase();
    if (!s) continue;
    m.look = s.look;
    m.spec = s.spec;
    m.angles = sheet(name);
    m.image = gen(`models/${name}-face`);
    m.sheet = m.angles.map((a) => a.image);
  }
  for (const b of db.boards)
    for (const it of b.items)
      if (it.id === "bi-5") it.text = "Product low in the frame, air above. People are AI models, always labelled.";
  for (const p of db.products) if (p.id === "pr-kveld" || p.id === "pr-sweater") p.isNew = true;
  const book = voiceBook(found);
  // Robot note 05: «Update the brand» names the products Import from website finds (seed8), not three others
  brandUpdate.products = { count: 2, names: ["Body Scrub, new", "Pillow Mist, a new 100 ml size"] };

  const withBook = <T extends { identity: BrandIdentity }>(view: T): T => ({
    ...view,
    identity: { ...view.identity, voiceBook: clone(book) },
  });

  const wraps = (base: Pick<FumeApi, Wraps>): Pick<FumeApi, Wraps> => ({
    async brandBoard() {
      return withBook(await base.brandBoard());
    },
    async decide(input) {
      return withBook(await base.decide(input));
    },
  });

  const calls: Pick<FumeApi, Calls> = {
    async setColourUses({ colourId, uses }) {
      const c = db.identity.colours.find((x) => x.id === colourId);
      if (!c) throw new FumeError("not_found", `No colour ${colourId}`);
      c.uses = [...uses];
      return wait(clone(c) as BrandColour);
    },
    async moveImage({ imageId, group, campaign }) {
      const i = db.identity.imagery.find((x) => x.id === imageId);
      if (!i) throw new FumeError("not_found", `No picture ${imageId}`);
      i.group = group;
      i.campaign = group === "campaign" ? campaign?.trim() || i.campaign || "A campaign" : undefined;
      return wait(clone(i));
    },
    async decideVoicePart({ part, verdict, note }) {
      const p = book.parts.find((x) => x.id === part);
      if (!p) throw new FumeError("not_found", `No voice part ${part}`);
      p.provenance = {
        ...p.provenance,
        state: verdict === "keep" ? "approved" : "changed",
        by: ctx.userId(),
        at: new Date().toISOString(),
      };
      p.note = verdict === "change" ? note?.trim() || p.note : undefined;
      // How we speak holds the board's short voice lines: confirming the part confirms them too.
      if (part === "speak" && verdict === "keep")
        for (const v of db.identity.voice)
          if (v.provenance.state === "proposed")
            v.provenance = { ...v.provenance, state: "approved", by: ctx.userId(), at: new Date().toISOString() };
      return wait(clone(book));
    },
    async passTastePair({ pairId, cardId, reason }) {
      const p = pairId ? db.tastePairs.find((x) => x.id === pairId) : undefined;
      if (p) {
        p.neither = true;
        p.chosen = undefined;
        p.reason = reason ?? p.reason;
      }
      // a training pair answered "Neither": it is answered, and leaves the deck
      const i = cardId && db.tasteCards ? db.tasteCards.findIndex((c) => c.id === cardId) : -1;
      if (i >= 0 && db.tasteCards && db.tasteState) {
        db.tasteCards.splice(i, 1);
        db.tasteState.answered += 1;
        db.tasteState.updatedAt = new Date().toISOString();
      }
      return wait(undefined);
    },
    async updateProfile({ name, title, email }) {
      const u = db.users.find((x) => x.id === ctx.userId());
      if (!u) throw new FumeError("not_found", "No such person");
      if (!name.trim()) throw new FumeError("invalid", "Your name is needed.");
      if (!/^\S+@\S+\.\S+$/.test(email.trim()))
        throw new FumeError("invalid", "That email address doesn’t look right.");
      Object.assign(u, { name: name.trim(), title: title.trim(), email: email.trim() });
      return wait(clone(u));
    },
  };
  return { calls, wraps };
}
