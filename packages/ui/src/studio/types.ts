// The Studio control library's shapes (FLOWS §9.3, PROPOSED 15 Oct 2026). These mirror the app contract's
// ModeVariable and VarValue (app/src/contract/entities.ts) structurally, so packages/ui never imports app code:
// a ModeVariable from the backend is a StudioVariable here, and a VarValue a StudioValue.

/** Every mode variable is edited with one of these. */
export type StudioControlKind =
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
  | "lightboard";

/** A light direction: azimuth in degrees around the subject (0 = from the camera, 90 = from the right, -90 = from
 *  the left), elevation in degrees above the horizon (0–90). */
export interface StudioLightAngle {
  azimuth: number;
  elevation: number;
}

/** A camera: focal length in mm, height in cm from the surface, tilt in degrees (negative looks down). */
export interface StudioLensValue {
  focal: number;
  height: number;
  tilt: number;
}

/** One light on the advanced light board (FLOWS §18): x/y 0–1 on the board, height 0–90°, warmth in K. */
export interface StudioLight {
  id: string;
  kind: "key" | "fill" | "rim" | "practical";
  x: number;
  y: number;
  height: number;
  warmth: number;
  strength: number;
  softness: number;
}

export interface StudioLightRig {
  lights: StudioLight[];
}

/** Where a look section (Light, Camera, a brand-preset section) comes from (FLOWS §18): the campaign's own look
 *  (v5, Marcus 15 Oct: "Black Friday has completely different colours"), the brand's own preset, one of Fume's
 *  presets, the designer's own values, or the Engine decides. */
export type StudioLookSource = "campaign" | "brand" | "fume" | "own" | "engine";

export type StudioValue = string | number | boolean | string[] | StudioLightAngle | StudioLensValue | StudioLightRig;

export interface StudioOption {
  value: string;
  label: string;
  /** For swatches: the colour, shown through a CSS custom property, never as a class. */
  hex?: string;
}

/** One variable of a mode: what it is called, which control edits it and its range. */
export interface StudioVariable {
  key: string;
  label: string;
  control: StudioControlKind;
  /** The right panel's folding section ("Light", "Camera"). */
  section: string;
  default: StudioValue;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: StudioOption[];
  /** Swatches list the brand's chosen presets of this kind first. */
  brandPreset?: "background" | "colour" | "light";
  help?: string;
}

/** A brand's chosen colour or setting, listed first in swatches and selects (FLOWS §9.4). */
export interface StudioPreset {
  name: string;
  hex?: string;
  /** Whose it is, shown over its group of swatches: the brand ("LYSNE") or a campaign ("Black Friday"). */
  brand: string;
}

/** What every control takes. */
export interface StudioControlProps<V extends StudioValue> {
  value: V;
  onChange: (value: V) => void;
  label: string;
  disabled?: boolean;
  /** A stable id for the label and the control; default from the label. */
  id?: string;
}

export const studioId = (label: string, id?: string) => id ?? `sc-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
