// Studio: where Fume's people, and an agency's people, make creatives (FLOWS §9, §24.2). One creative document per
// creative, with its mode, variables, layers and render versions; the modes and the control library; and Studio
// sessions of generations from a recipe (FLOWS §3.4).

import type { Id, Instant } from "./common";
import type { BrandPresetKind } from "./brand";
import type { Format, FormatTile } from "./campaigns";
import type { DetailFind, ProductFix, ProductOverride } from "./products";
import type { LightAngle, Lens, LightRig, LookSource } from "./production";
import type { Evaluation } from "./quality";

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
  /** False for a mode that is planned but not built (3D object, video). */
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
