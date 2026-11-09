// Studio: where Fume's people, and an agency's people, make creatives (FLOWS §9, §24.2). One creative document per
// creative, with its mode, variables, layers and render versions; the modes and the control library; and Studio
// sessions of generations from a recipe (FLOWS §3.4).

import type { Id, Instant } from "./common";
import type { BrandPresetKind } from "./brand";
import type { Format, FormatTile } from "./campaigns";
import type { DetailFind, ProductFix, ProductOverride } from "./products";
import type { LightAngle, Lens, LightRig, LookSource } from "./production";
import type { Evaluation } from "./quality";
import type { VideoEdit } from "./video";

// ─── Modes and controls ─────────────────────────────────────────────────────

/** The three studios (FLOWS §9.1). */
export type StudioKind = "render" | "design" | "video";

/** The Studio's control library: every mode variable is edited with one of these (FLOWS §9.3). */
export type ControlKind =
  | "slider"
  | "segmented"
  | "select"
  | "swatch"
  | "toggle"
  | "angle"
  | "lens"
  | "chips"
  | "text"
  | "number"
  /** The advanced light board (FLOWS §18). */
  | "lightboard";

export type VarValue = string | number | boolean | string[] | LightAngle | Lens | LightRig;
export type Variables = Record<string, VarValue>;

export interface ModeVariable {
  key: string;
  label: string;
  control: ControlKind;
  /** The right panel's folding section it sits in ("Light", "Camera"). */
  section: string;
  default: VarValue;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: { value: string; label: string; hex?: string }[];
  /** Swatches list the brand's chosen presets of this kind first (FLOWS §9.4). */
  brandPreset?: BrandPresetKind;
  help?: string;
}

/** A mode is a schema the Engine turns into a prompt; an agent makes a new mode by writing one (FLOWS §9.3). */
export interface StudioMode {
  id: Id;
  studio: StudioKind;
  name: string;
  description: string;
  /** What a render in this mode makes. */
  output: "creative" | "model" | "reference";
  /** Section order in the right panel. */
  sections: string[];
  variables: ModeVariable[];
  /** False for a mode that is planned but not built (3D object). */
  available: boolean;
  /** Which left-panel specs this mode uses. */
  uses: ("product" | "model" | "reference" | "count")[];
}

// ─── Creative documents (FLOWS §9.2) ────────────────────────────────────────

export interface Specs {
  format: Format;
  count: number;
  /** The image model; staff only, never shown to a customer. */
  imageModel: string;
  referenceIds: Id[];
  productId?: Id;
  variantId?: Id;
  modelIds: Id[];
  /** The placement it is made for; the ratio follows (FLOWS §15). */
  placementId?: Id;
}

/** A layer of a Design creative (and the picked render under it). */
export interface Layer {
  id: Id;
  kind: "image" | "text" | "logo" | "shape";
  name: string;
  /** Position and size, 0–1 of the frame. */
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  image?: string;
  /** For text: the role in the brand's type scale. */
  style?: "headline" | "body" | "small";
  visible: boolean;
  locked?: boolean;
}

/** One render: a version in the strip at the bottom. Nothing is overwritten (FLOWS §9.2). */
export interface RenderVersion {
  id: Id;
  number: number;
  image: string;
  at: Instant;
  by: Id;
  state: "rendering" | "done" | "failed";
  variables: Variables;
  specs: Specs;
  evaluation: Evaluation;
  /** The Engine bar instruction that led to it, if any. */
  instruction?: string;
  /** Staff only. */
  cost: number;
  /** The product details the Engine masked and read on this render (FLOWS §17). */
  details?: DetailFind[];
  /** Why a failed version did not render, in one sentence ("The prompt missed 2 of LYSNE's rules after three tries"). */
  failure?: string;
  /** How the Engine wrote and checked the prompt behind it (engine_prompts). Fume's staff only: never an agency's
   *  people, never a customer (FLOWS §29). */
  prompt?: EnginePrompt;
  /** The graphic design Fume laid on the version under it (design_layers; FLOWS §33, PROPOSED). Fume's people only:
   *  never an agency's people, never a customer. While Fume designs, the version is `rendering`; a layer that could
   *  not be made is a `failed` version with the layer's error as its `failure`. */
  design?: VersionDesign;
  /** Demo only: the words as laid out, so the mock can draw them on the picture under it (`image`). The live picture
   *  is the designed PNG, which carries the words, so the live API leaves this out. */
  drawn?: DesignDrawing;
}

// ─── Graphic design by Fume (FLOWS §33, PROPOSED) ───────────────────────────
// A Fume designer asks Fume to lay the plan's approved words on a picture, in the brand's design system. A model
// says where the words may go; the design service (OpenPencil) lays them out and measures them by code; Fume's
// review looks at the result. It comes back as a new version beside the picture, with an editable design file. The
// expert checks it; only the customer approves it.

/** The plan's approved words for the creative, word for word: code picks them, never a model. */
export interface DesignWords {
  headline: string;
  /** The supporting line. */
  subline?: string;
  /** The call to action. */
  cta?: string;
}

/** The design system a layer is made from: the one in use (approved, else checked, else the newest draft). */
export interface DesignBookUsed {
  version: number;
  state: "approved" | "checked" | "draft";
}

/** One measurement by code on the laid-out words. A hard check that fails rules the layout out; a soft one is said to
 *  the expert. */
export interface DesignCheck {
  /** fits: inside the safe area; lines: how many lines; contrast: against nine in ten of the pixels under the words;
   *  busy: how calm the picture is under them; covers: words over what must stay clear (the product, a lamp, a face);
   *  font: the brand's own face is not on file. */
  check: "fits" | "lines" | "contrast" | "busy" | "covers" | "font";
  /** The part it measured: Words, Headline, Subline, CTA. */
  node: string;
  ok: boolean;
  hard: boolean;
  value?: number;
  need?: number;
  /** In words: "4.8:1 against nine in ten of the pixels under the words (needs 3:1)." */
  note: string;
}

/** What a designer would fix, from Fume's look at the finished layout (fume_review), or from code when no layout
 *  passed every hard check. */
export interface DesignFinding {
  severity: "minor" | "major" | "critical";
  what: string;
  by: "fume_review" | "code";
}

/** A layer of graphic design on a version (design_layers). */
export interface VersionDesign {
  id: Id;
  state: "designing" | "made" | "failed";
  /** The picture under it (candidates.designed_from). */
  fromVersionId: Id;
  fromNumber: number;
  /** What the designer asked Fume to know (design_layers.ask). */
  ask?: string;
  /** The design system it was made from (book_version); none until the work starts. */
  book?: DesignBookUsed;
  words?: DesignWords;
  /** Where code put the words: the band, the alignment, what they stand on and their colour (layout). */
  layout?: {
    band: "top" | "middle" | "bottom";
    align: "left" | "centre" | "right";
    ground: "photo" | "gradient" | "flat";
    /** The design system's colour role, by name. */
    colour: string;
  };
  checks: DesignCheck[];
  findings: DesignFinding[];
  /** Fume's review: ready for the expert's check, or work for the designer first. */
  verdict?: "ready_for_check" | "needs_work";
  /** How many layouts code tried (attempts). */
  tried?: number;
  /** The editable design file beside the PNG (document_file_id): a .fig, with the words as text and the picture as
   *  its own layer. No url in the demo. */
  document?: { name: string; url?: string };
  /** Why it could not be made (state failed). */
  error?: string;
  requestedBy: Id;
  at: Instant;
  /** What Fume's looks at the picture cost, in USD (llm_usd). */
  llmUsd?: number;
}

/** Demo only: words drawn on a photograph, in per cent of the frame, sized as pixels at a frame 1080 wide. */
export interface DesignDrawing {
  /** A soft shade from one edge behind the words (the design system's scrim), 0–1. */
  shade?: { from: "top" | "bottom"; opacity: number };
  /** The faces to load, by their Google Fonts name. */
  fonts: string[];
  layers: {
    role: "headline" | "subline" | "cta";
    text: string;
    x: number;
    y: number;
    w: number;
    align: "left" | "centre" | "right";
    sizePx: number;
    /** A CSS font family list. */
    family: string;
    weight: number;
    lineHeight: number;
    trackingEm: number;
    colour: string;
    /** The call to action's pill. */
    fill?: string;
    radiusPx?: number;
    paddingPx?: number;
  }[];
}

/** What "Add graphic design" will lay on a version, and whether it can now (FLOWS §33). */
export interface DesignAsk {
  /** The picture the words go on: the version asked for, or the picture under a designed one. */
  fromVersionId: Id;
  fromNumber: number;
  /** None when the plan has no approved headline for the creative. */
  words?: DesignWords;
  /** None when the brand has no design system yet. */
  book?: DesignBookUsed;
  /** Why it cannot be asked now, in one sentence. */
  blocked?: string;
  /** The version Fume is designing on this picture right now: asking again opens it. */
  designingVersionId?: Id;
}

/** The prompt behind a render and its checks, as the Engine kept them (engine_prompts; FLOWS §29, PROPOSED). */
export interface EnginePrompt {
  /** validated: it passed and went to the image model; escalated: a person had to judge it; blocked: it did not
   *  pass, and nothing was rendered. */
  status: "validated" | "escalated" | "blocked";
  /** Why it was blocked or escalated, in words. */
  reason?: string;
  /** The image model, by its name ("Nano Banana Pro"). */
  model: string;
  /** The method the Engine picked for the picture ("Product on a surface"). */
  method?: string;
  /** The prompt as the image model got it; none when it was blocked before it was finished. */
  text?: string;
  /** How many times the Engine wrote it (up to three: findings send it back). */
  tries: number;
  /** What the prompt had to carry (the brand's rules, the product's verified facts) and what the check said of each:
   *  carried, works against it, not visible in a picture, or sent to a person to judge. */
  findings: { item: string; verdict: "carried" | "against" | "not_visible" | "person"; note?: string }[];
  /** The checks by code before any model read it: no rendered text, no equipment, no file names, no forbidden
   *  terms, the locked slots unchanged. */
  codeChecks: { text: string; pass: boolean }[];
  /** What writing and checking it cost, in USD. */
  llmUsd: number;
  /** Everything the Engine had for this prompt, piece by piece: whether each went in, how the check looked for it, and
   *  why the rest was left out (engine_prompts.ledger). */
  ledger?: PromptLedgerEntry[];
}

/** One piece of the brand's data in a prompt's ledger (FLOWS §29.5, PROPOSED). */
export interface PromptLedgerEntry {
  /** Where it came from: a verified product fact, a Brand DNA rule, the taste model, the Brand Brain, a lesson from
   *  earlier verdicts, a reference picture, or the plan (an approved prompt to learn from). */
  source: "product_fact" | "brand_rule" | "taste" | "brain" | "lesson" | "picture" | "plan";
  what: string;
  used: boolean;
  /** verbatim: word for word, checked by code; meaning: a model checked the prompt says it; guidance: the writer read
   *  it; reference: sent to the image model as a picture. */
  how?: "verbatim" | "meaning" | "guidance" | "reference";
  /** Whether the check found it in the prompt (verbatim and meaning only). */
  passed?: boolean;
  /** Why it was left out. */
  why?: string;
}

/** One part of an Engine bar instruction: the words, the variables it changed, or why nothing changed ("Placement is
 *  already Low") and, where the Engine has a guess, the change it would make if asked. */
export interface EngineEditPart {
  text: string;
  keys: string[];
  note?: string;
  suggestion?: { key: string; label: string; from: VarValue; to: VarValue };
}

/** What the Engine changed from words in the Engine bar, shown before it renders (FLOWS §9.1). */
export interface EngineEdit {
  id: Id;
  text: string;
  changes: { key: string; label: string; from: VarValue; to: VarValue }[];
  by: Id;
  at: Instant;
  state: "proposed" | "kept" | "undone";
  /** Each part of the instruction, read or not. */
  parts?: EngineEditPart[];
}

/** The project file of one creative, like a PSD (FLOWS §9.2). */
export interface CreativeDocument {
  id: Id;
  workspaceId: Id;
  campaignId?: Id;
  creativeId?: Id;
  title: string;
  /** The planned creative it fills ("Master 3 · feed"). */
  slot?: string;
  studio: StudioKind;
  modeId: Id;
  variables: Variables;
  specs: Specs;
  overrides: ProductOverride[];
  layers: Layer[];
  versions: RenderVersion[];
  /** The version that goes to the check. */
  pickedVersionId?: Id;
  edits: EngineEdit[];
  /** Where each look section comes from (FLOWS §18), by section name. */
  sources?: Record<string, LookSource>;
  /** Make formats (FLOWS §16). */
  formats?: FormatTile[];
  /** Product fixes, automatic and by hand (FLOWS §17). */
  fixes?: ProductFix[];
  /** A video creative's edit (FLOWS §27): set when the document is in the Video studio. */
  video?: VideoEdit;
  state: "draft" | "in_check" | "checked";
  by: Id;
  updatedAt: Instant;
}

// ─── Studio sessions: generations from a recipe (FLOWS §3.4) ────────────────

export interface CreativeType {
  id: Id;
  name: string;
  description: string;
  /** Imagery v0.2 family it maps to (S1–S4, H-B, H-D). */
  family: string;
  needs: ("product" | "variant" | "angle" | "cast" | "scene" | "area" | "layout")[];
  formats: Format[];
  /** Check items this type adds to the Quality Gate. */
  checks: string[];
  cover: string;
}

export interface CastMember {
  id: Id;
  name: string;
  look: string;
  image: string;
  /** Always true for now: an AI person, always labelled on use (F-D041, Imagery v0.2). */
  isAiPerson: boolean;
  allowedUses: string[];
  /** Set for a brand's own cast; left out for Fume's shared cast. Who owns the cast is open (FLOWS §8, Q5). */
  workspaceId?: Id;
}

export interface Scene {
  id: Id;
  workspaceId: Id;
  name: string;
  light: string;
  image: string;
}

export interface Recipe {
  mode: "free" | "type";
  creativeTypeId?: Id;
  direction?: string;
  productId?: Id;
  variantId?: Id;
  angle?: string;
  castIds: Id[];
  sceneId?: Id;
  references: string[];
  format: Format;
  count: number;
  /** Staff only, never sent to a customer (Roadmap §8.2). */
  route?: { provider: string; model: string };
  prompt?: string;
  seed?: number;
}

export interface Generation {
  id: Id;
  sessionId: Id;
  branch: number;
  image: string;
  recipe: Recipe;
  evaluation: Evaluation;
  /** Generation cost in USD, staff only. */
  cost: number;
  state: "making" | "candidate" | "picked" | "discarded" | "sent_to_check";
  at: Instant;
  /** What the designer asked to repair, in words. */
  repair?: string;
  /** What a person taught the Engine about this picture (Yes or No, FLOWS §29); unset until someone answers. */
  taught?: "yes" | "no";
}

export interface StudioSession {
  id: Id;
  workspaceId: Id;
  campaignId?: Id;
  /** The planned creative this session fills ("Master 3 · feed"). */
  slot?: string;
  recipe: Recipe;
  generations: Generation[];
  pickedId?: Id;
  by: Id;
  updatedAt: Instant;
}
