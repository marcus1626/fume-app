// Brand: Brand DNA and everything it holds (ARCHITECTURE §4.2): the identity board, the voice, the rules, the taste,
// Creative Memory; how the Engine reads a brand (the onboarding scan, later updates); and the brand's assets in the
// Studio (presets, AI models, references).

import type { Confidence, FactSource, Id, Instant, Origin, Provenance } from "./common";
import type { Variables } from "./studio";

// ─── Brand DNA ──────────────────────────────────────────────────────────────

export interface BrandDna {
  workspaceId: Id;
  version: number;
  state: "draft" | "in_review" | "approved";
  approvedBy?: Id;
  approvedAt?: Instant;
  /** 0–1: how much of what Fume needs it has. */
  completeness: number;
  summary: string;
}

export type RuleArea = "logo" | "colour" | "type" | "voice" | "layout" | "imagery" | "claims";
/** A rule says what to do, or what never to do. */
export type RulePolarity = "do" | "dont";

export interface BrandRule {
  id: Id;
  area: RuleArea;
  statement: string;
  /** A hard constraint is never broken; a preference can bend for a campaign. */
  kind: "rule" | "hard_constraint" | "preference";
  source: FactSource;
  confidence: Confidence;
  /** Do or Don't. */
  polarity?: RulePolarity;
}

export interface Reference {
  id: Id;
  image: string;
  verdict: "liked" | "disliked";
  note?: string;
  addedBy: Id;
}

export interface TastePair {
  id: Id;
  a: string;
  b: string;
  question: string;
  chosen?: "a" | "b";
  reason?: string;
  /** Neither picture felt like the brand. */
  neither?: boolean;
}

/** Creative Memory: what Fume learned from a campaign. */
export interface MemoryEntry {
  id: Id;
  kind: "approved" | "rejected" | "changed" | "caught";
  campaignId: Id;
  creativeId?: Id;
  lesson: string;
  at: Instant;
}

export type SourceAssetKind = "logo" | "guideline" | "packshot" | "campaign" | "font" | "other";

/** A file the customer gave Fume to learn the brand from. */
export interface SourceAsset {
  id: Id;
  kind: SourceAssetKind;
  name: string;
  bytes: number;
  uploadedBy: Id;
  at: Instant;
  thumbnail?: string;
}

/** The comprehension check: Fume shows what it understood before any campaign (Product Vision §4.2). */
export interface Understanding {
  version: number;
  summary: string[];
  conflicts: { id: Id; text: string; resolved?: string }[];
  unknowns: { id: Id; question: string; why: string; answer?: string }[];
  testDirections: { id: Id; name: string; image: string; verdict?: "yes" | "no"; reason?: string }[];
}

// ─── The identity board: what the Brand DNA board shows ─────────────────────

export type ColourRole = "primary" | "accent" | "ground" | "text" | "support";
/** What a colour is for, chosen as chips when she confirms or changes it. */
export type ColourUse = "buttons" | "accent" | "backgrounds" | "text" | "light" | "packaging" | "ui";

export interface BrandColour {
  id: Id;
  name: string;
  hex: string;
  role: ColourRole;
  usage: string;
  provenance: Provenance;
  uses?: ColourUse[];
}

export interface BrandTypeface {
  id: Id;
  name: string;
  role: "display" | "body" | "accent";
  /** A stand-in web face to draw the specimen with, when the real face cannot be loaded. */
  cssFamily: string;
  weights: string[];
  sample: string;
  usage: string;
  provenance: Provenance;
}

export interface BrandLogo {
  id: Id;
  name: string;
  /** The word or mark as text, drawn in the display face when no image is supplied. */
  wordmark: string;
  image?: string;
  use: string;
  ground: "light" | "dark";
  provenance: Provenance;
}

/** The short form of the voice on the board; the VoiceBook is the whole voice. */
export interface BrandVoiceLine {
  id: Id;
  statement: string;
  example: string;
  provenance: Provenance;
}

/** The group Fume sorts a picture into: the brand's lasting look, a campaign's look (temporary, named after the
 *  campaign or season), a product shot, or not used. She can move a picture to another group. */
export type ImageGroup = "look" | "campaign" | "product" | "unused";

export interface BrandImage {
  id: Id;
  image: string;
  caption: string;
  provenance: Provenance;
  group?: ImageGroup;
  /** A campaign look: the campaign or season it belonged to ("Spring relaunch 2026"). */
  campaign?: string;
}

export interface BrandIdentity {
  colours: BrandColour[];
  typefaces: BrandTypeface[];
  logos: BrandLogo[];
  /** The short form of the voice; voiceBook is the whole voice. */
  voice: BrandVoiceLine[];
  imagery: BrandImage[];
  voiceBook?: VoiceBook;
}

/** What a Keep, Change or Remove decision on the board is about. */
export type IdentityKind =
  "colour" | "typeface" | "logo" | "voice" | "image" | "rule" | "product" | "collection" | "board_item";

// ─── Voice ──────────────────────────────────────────────────────────────────

/** The brand's voice in five parts. */
export type VoicePartId = "identity" | "speak" | "rules" | "audience" | "examples";

export interface VoiceTrait {
  trait: string;
  means: string;
  do: string;
  dont: string;
}

export interface VoiceExample {
  line: string;
  where: string;
  language: "no" | "en";
}

export interface VoiceBook {
  /** What Fume found for each part, in one line, where, and whether she confirmed it. */
  parts: { id: VoicePartId; found: string; provenance: Provenance; note?: string }[];
  identity: { who: string; believe: string[]; personality: string[] };
  speak: {
    traits: VoiceTrait[];
    use: string[];
    avoid: string[];
    sentences: string;
    formality: string;
    languages: string;
  };
  rules: { must: string[]; never: string[]; claims: string[] };
  audience: { who: string; cares: string[]; notFor: string };
  examples: VoiceExample[];
  // The long Tone of Voice Fume writes (FLOWS §30, brand_books.body): the voice at work, besides the five parts.
  /** The voice in three sentences a copywriter can work from. */
  summary?: string;
  /** Where the brand sits between two words, 1 (from) to 5 (to). */
  scale?: { from: string; to: string; at: number }[];
  mechanics?: { casing: string; punctuation: string; numbers: string; emoji: string; names: string };
  /** The brand's own words and how to use them. */
  vocabulary?: { word: string; use: string }[];
  channels?: { channel: VoiceChannel; how: string; length: string; example: string }[];
  headlines?: { pattern: string; example: string }[];
  ctas?: { cta: string; when: string }[];
  /** On brand against off brand, and why. */
  pairs?: { good: string; bad: string; why: string }[];
  sources?: BookSource[];
  /** What Fume could not find, as questions for the brand. */
  gaps?: string[];
}

export type VoiceChannel =
  "instagram_feed" | "instagram_story" | "tiktok" | "paid_social" | "email" | "website" | "packaging" | "print";

/** Where a part of a book comes from: the brand's own pages, its Brand DNA, its rules, its products, its taste, its
 *  past campaigns, or Fume's proposal where the data is thin. */
export interface BookSource {
  part: string;
  source: "site" | "brand_dna" | "rules" | "products" | "taste" | "memory" | "fume";
  evidence: string;
}

// ─── The brand's books (FLOWS §30): a long Tone of Voice and a design system ──
// Fume writes them; an expert checks a draft; only the customer's owner or approver approves one. The approved
// version stays in use until a newer one is approved. A customer never sees a book being written or a draft.

export type DesignRole =
  | "primary"
  | "secondary"
  | "accent"
  | "background"
  | "surface"
  | "text"
  | "text_muted"
  | "on_primary"
  | "on_photo"
  | "cta"
  | "cta_text"
  | "border"
  | "support";
export type DesignFormat = "feed" | "square" | "story" | "banner";
export type DesignStyleName =
  "display" | "h1" | "h2" | "subline" | "body" | "caption" | "label" | "cta" | "price" | "legal";
export type DesignComponentName =
  "headline" | "subline" | "body" | "cta" | "price" | "badge" | "legal" | "product_name" | "logo";

/** The brand's design system for its campaign creatives. Sizes are in pixels at a frame 1080 pixels wide; code builds
 *  the CSS and measures the contrast of every pair that carries words. */
export interface DesignBook {
  summary: string;
  colours: { name: string; hex: string; role: DesignRole; use: string; source: BookSource["source"] }[];
  typefaces: {
    role: "display" | "heading" | "body" | "label";
    family: string;
    /** A Google Font close to it when the brand's own face cannot be loaded. */
    fallback: string;
    weights: number[];
    source: "brand" | "stand_in";
    note: string;
  }[];
  styles: {
    name: DesignStyleName;
    font: "display" | "heading" | "body" | "label";
    sizePx: number;
    lineHeight: number;
    trackingEm: number;
    weight: number;
    case: "none" | "upper" | "title" | "lower";
  }[];
  spacing: { unitPx: number; scale: number[] };
  radiusPx: { none: number; small: number; large: number; pill: number };
  formats: {
    format: DesignFormat;
    marginPx: number;
    safeTopPx: number;
    safeBottomPx: number;
    columns: number;
    gutterPx: number;
  }[];
  logo: {
    versions: { name: string; use: string }[];
    clearSpace: string;
    minWidthPx: number;
    placements: { format: DesignFormat; where: LogoPlace; widthPct: number }[];
  };
  photoText: { rules: string[]; scrim: "none" | "gradient" | "flat"; scrimOpacity: number };
  components: {
    name: DesignComponentName;
    purpose: string;
    style: DesignStyleName;
    colour: DesignRole;
    background: DesignRole | null;
    radius: "none" | "small" | "large" | "pill";
    paddingPx: number;
    rules: string[];
  }[];
  rules: { do: string[]; dont: string[] };
  /** Examples of graphic design: the layers on a photograph, in per cent of the frame. */
  examples: {
    name: string;
    format: DesignFormat;
    purpose: string;
    /** What the photograph behind it shows, and where it is calm. */
    picture: string;
    /** A photograph of the brand's to draw it on; the live API picks one of the brand's own. */
    image?: string;
    layers: {
      component: DesignComponentName;
      text: string;
      x: number;
      y: number;
      w: number;
      h: number;
      align: "left" | "centre" | "right";
      /** The colour when the photograph asks for another than the component's: Linen words on a dark wall. */
      colour?: DesignRole;
    }[];
    why: string;
  }[];
  /** The tokens as CSS variables on a `.brand` class, built by code. */
  css: string;
  checks: {
    contrast: { pair: string; ratio: number; ok: boolean; need: number }[];
    missingRoles: DesignRole[];
    fails: string[];
  };
  sources: BookSource[];
  gaps: string[];
}

export type LogoPlace = "top_left" | "top_centre" | "top_right" | "bottom_left" | "bottom_centre" | "bottom_right";

export type BrandBookKind = "voice" | "design";
export type BrandBookState = "writing" | "failed" | "draft" | "checked" | "changes_asked" | "approved" | "superseded";

interface BookVersion {
  id: Id;
  version: number;
  state: BrandBookState;
  /** The words this version was written for: the customer's change, or Fume's own ask. */
  ask?: string;
  askedBy?: Id;
  /** Why it could not be written (state failed). */
  error?: string;
  createdAt: Instant;
  writtenAt?: Instant;
  checkedBy?: Id;
  checkedAt?: Instant;
  approvedBy?: Id;
  approvedAt?: Instant;
}

/** One version of a book; no body while it is being written, or when writing it failed. */
export type BrandBook =
  (BookVersion & { kind: "voice"; body?: VoiceBook }) | (BookVersion & { kind: "design"; body?: DesignBook });

// ─── Taste (FLOWS §14: taste keeps learning) ────────────────────────────────

export type TasteArea = "light" | "colour" | "people" | "composition" | "styling";

export interface TasteCard {
  id: Id;
  /** pair: which is more LYSNE; single: LYSNE or not. */
  kind: "pair" | "single";
  area: TasteArea;
  question: string;
  a: string;
  b?: string;
}

export interface TasteState {
  /** How sure the Engine is per area, 0–1. */
  confidence: Record<TasteArea, number>;
  answered: number;
  /** What the Engine learned last, in words. */
  lastLesson?: string;
  updatedAt: Instant;
}

// ─── Scan and onboarding (FLOWS §7, steps 3–7) ──────────────────────────────

export type ScanSource = "website" | "upload" | "both";

/** One thing the Engine found while it read the brand: the onboarding animation's data. */
export interface BrandScanFind {
  id: Id;
  kind: "logo" | "colour" | "typeface" | "image" | "product" | "voice" | "rule" | "audience";
  label: string;
  /** For a colour, its hex; for an image or product, its picture; for a typeface or voice, a sample line; for a rule or audience, the line. */
  value: string;
  /** The page or file it was read from (BrandScan.sources[].id), so the onboarding map can say "Reading lysne.no/about". */
  sourceId?: Id;
  /** A product find: the product it lands as in Products after onboarding. */
  productId?: Id;
  evidence: string;
  confidence: Confidence;
  /** customer: the customer gave it themselves (an upload); engine: the Engine read it. */
  origin: Origin;
}

export interface BrandScan {
  id: Id;
  workspaceId: Id;
  source: ScanSource;
  url?: string;
  files: string[];
  state: "reading" | "done" | "failed";
  /** What the Engine is reading now, in words ("Reading lysne.no/about"). */
  reading?: string;
  /** The pages or files, in reading order. */
  sources: { id: Id; label: string; kind: "page" | "file"; state: "waiting" | "reading" | "read" }[];
  finds: BrandScanFind[];
  needsYou: number;
  error?: string;
}

export type OnboardingStepId = "" | "scan" | "review" | "taste";

/** Her word on one line of What Fume understood: "Right" or "Not quite", with an optional reason. */
export interface UnderstoodLine {
  /** brand | light | product | rules | audience */
  id: string;
  verdict: "right" | "not_quite";
  reason?: string;
}

/** Continue where you left off: the furthest the first customer got in the onboarding, kept on the workspace, so
 *  leaving and coming back opens that step and part instead of step 1. */
export interface OnboardingProgress {
  /** The furthest step reached. */
  step: OnboardingStepId;
  /** In "review": the furthest part reached ("logo", "colour", "type", "imagery", "voice"). */
  part?: string;
  lines: UnderstoodLine[];
}

// ─── Brand updates ──────────────────────────────────────────────────────────
// An onboarded brand is read again (the website) or given a zip of new things. The Engine compares what it reads with
// the approved Brand DNA and keeps only what is new, changed or unsure; the customer goes through it in the shared
// "What the Engine found" review. Products it sees are only counted and linked, never imported here.

export type FoundStatus = "new" | "changed" | "unsure";

/** One thing a brand update found. */
export interface BrandFound {
  id: Id;
  kind: "image" | "colour" | "typeface" | "voice" | "logo" | "rule";
  status: FoundStatus;
  title: string;
  subtitle?: string;
  /** The tile's picture: an image find, or the first picture of a set. */
  image?: string;
  /** A set of pictures read together (a campaign), shown as one tile. */
  images?: string[];
  /** What Brand DNA holds now (a hex, a typeface name, a line), for a Changed or Unsure item. */
  before?: string;
  /** What the Engine read now. */
  after?: string;
  /** The Brand DNA item it changes, when it changes one. */
  targetId?: Id;
  confidence: Confidence;
  /** Where the Engine read it ("lysne.no/about"). */
  source: string;
  /** Why the Engine is unsure, or what it noticed. */
  note?: string;
  /** The customer's answer, once given. */
  decision?: "kept" | "removed" | "fixed";
}

export interface BrandUpdate {
  id: Id;
  workspaceId: Id;
  source: "website" | "upload";
  url?: string;
  files: string[];
  state: "reading" | "ready" | "applied" | "failed";
  /** What the Engine is reading now, in words ("Reading lysne.no/about"). */
  reading?: string;
  sources: BrandScan["sources"];
  found: BrandFound[];
  /** How many things the Engine read that match the approved Brand DNA (not shown as items). */
  unchanged: number;
  /** Products it saw that Products does not hold yet: a link only. */
  products?: { count: number; names: string[] };
  startedAt: Instant;
  appliedAt?: Instant;
  appliedBy?: Id;
  error?: string;
}

// ─── Brand assets: presets, AI models, references (FLOWS §9.4, §9.6) ────────

export type BrandPresetKind = "background" | "colour" | "light";

/** The brand's chosen colours, backgrounds and light, first in every swatch (FLOWS §9.4). */
export interface BrandPreset {
  id: Id;
  workspaceId: Id;
  kind: BrandPresetKind;
  name: string;
  hex?: string;
  /** For light: the setting in words ("Low side light, 2700 K"). */
  value?: string;
  /** Where it is used ("Packshot background"). */
  use: string;
  provenance: Provenance;
}

/** draft: a designer's; saved: in the brand's library (Fume); approved or declined: the customer decided. */
export type AssetState = "draft" | "saved" | "approved" | "declined";

/** One angle of an AI model's sheet. Every angle is shot in a white studio in the same plain clothes. */
export type ModelAngle =
  "front" | "three-quarter" | "profile" | "back" | "face" | "face-three-quarter" | "face-profile";

/** An AI model's specs. */
export interface ModelSpec {
  ageRange: string;
  height: string;
  build: string;
  skinTone: string;
  hair: string;
  eyes: string;
  /** Clothing sizes, for styling: "Top S", "Trousers 36", "Shoes 38". */
  sizes: { label: string; value: string }[];
  /** What the model wears on the sheet. */
  clothing: string;
  allowedUses: string[];
  neverUses: string[];
}

/** An AI person made in Model mode. Always labelled as an AI person (F-D041). */
export interface BrandModel {
  id: Id;
  workspaceId: Id;
  name: string;
  image: string;
  /** The model sheet: front, side, three quarter. */
  sheet: string[];
  /** The Model mode variables it was made from (the JSON the Engine prompts from). */
  variables: Variables;
  look: string;
  state: AssetState;
  isAiPerson: true;
  madeBy: Id;
  savedBy?: Id;
  decidedBy?: Id;
  at: Instant;
  documentId?: Id;
  /** Creatives it appears in. */
  usedIn: number;
  /** The sheet, one picture per angle. */
  angles?: { angle: ModelAngle; image: string }[];
  spec?: ModelSpec;
}

/** A reference in the brand's library: made in Reference maker, uploaded, or from the brand. */
export interface BrandReference {
  id: Id;
  workspaceId: Id;
  name: string;
  image: string;
  origin: "made" | "upload" | "brand";
  state: "draft" | "saved";
  madeBy: Id;
  at: Instant;
  documentId?: Id;
}
