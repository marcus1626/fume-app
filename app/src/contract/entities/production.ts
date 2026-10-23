// Production: what the Engine makes and how (ARCHITECTURE §4.5). Engine runs, batches, and the light and camera
// presets a look is set from (FLOWS §18).

import type { Id, Instant } from "./common";
import type { Format } from "./campaigns";

// ─── Engine runs ────────────────────────────────────────────────────────────

export type RunPurpose = "directions" | "masters" | "variants" | "correction";
export type RunState = "queued" | "running" | "paused" | "failed" | "done";
export type StepState = "pending" | "active" | "done" | "waiting" | "paused" | "stopped" | "failed";

export interface EngineStep {
  label: string;
  state: StepState;
  detail?: string;
}

export interface EngineRun {
  id: Id;
  campaignId: Id;
  purpose: RunPurpose;
  state: RunState;
  steps: EngineStep[];
  made: number;
  total: number;
  startedAt: Instant;
  /** Images of what is made so far, newest last. */
  previews: string[];
}

// ─── Batches (FLOWS §9.7) ───────────────────────────────────────────────────

export interface Batch {
  id: Id;
  workspaceId: Id;
  campaignId: Id;
  modeId: Id;
  productIds: Id[];
  collectionId?: Id;
  perProduct: number;
  format: Format;
  state: "queued" | "running" | "done";
  made: number;
  total: number;
  previews: string[];
  by: Id;
  at: Instant;
}

// ─── Light and camera (FLOWS §18) ───────────────────────────────────────────

/** Where a look section comes from: the brand's, the campaign's own look, a Fume preset, the designer's own, or the
 *  Engine decides. */
export type LookSource = "brand" | "campaign" | "fume" | "own" | "engine";

export interface LightAngle {
  /** Degrees around the subject, 0 = from the camera, 90 = from the right. */
  azimuth: number;
  /** Degrees above the horizon, 0–90. */
  elevation: number;
}

export interface Lens {
  /** Focal length in mm. */
  focal: number;
  /** Camera height in cm from the surface. */
  height: number;
  /** Tilt in degrees, negative = looking down. */
  tilt: number;
}

/** One light on the advanced light board. */
export interface LightSource {
  id: Id;
  kind: "key" | "fill" | "rim" | "practical";
  /** Position on the light board over the canvas, 0–1. */
  x: number;
  y: number;
  /** Height above the subject, degrees 0–90. */
  height: number;
  warmth: number;
  strength: number;
  softness: number;
}

export interface LightRig {
  lights: LightSource[];
}

export interface CameraPreset {
  id: Id;
  origin: "brand" | "fume";
  workspaceId?: Id;
  name: string;
  /** The camera and lens, in words: "Hasselblad X2D · XCD 90 mm". */
  body: string;
  lens: Lens;
  image: string;
  note: string;
}

export interface LightPreset {
  id: Id;
  origin: "brand" | "fume";
  workspaceId?: Id;
  name: string;
  value: string;
  rig: LightRig;
}
