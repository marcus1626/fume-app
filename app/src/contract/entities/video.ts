// Video in the Studio (FLOWS §27, PROPOSED 27 Oct 2026): a video creative is one document with an edit. Shots lie on
// a timeline in order; the brand's motion design, the captions and the sound lie on their own tracks above and under
// them. The Engine makes a shot with a video model from a start frame (a checked master or a library still), cuts the
// edit, writes the captions in the brand's voice and makes the other formats from it. The expert cuts and checks;
// only the customer approves.

import type { Id, Instant } from "./common";

/** Where a shot comes from: the Engine made it from a start frame, or it is the brand's own footage. */
export type ShotSource = "engine" | "library";

/** How the camera moves in a shot the Engine makes. */
export type CameraMove = "still" | "push" | "pull" | "orbit" | "pan" | "tilt" | "handheld";

/** How a shot comes in after the one before it. */
export type Transition = "cut" | "dissolve" | "focus";

/** What the Engine read on a take, frame by frame (FLOWS §27.6). */
export interface TakeFinding {
  /** Seconds into the take. */
  from: number;
  to: number;
  kind: "product" | "physics" | "people" | "text";
  /** What it saw, in words: "Oil runs from the bottle's base, not its opening". */
  text: string;
  state: "open" | "fixed" | "accepted";
}

/** One take of a shot: the Engine makes a few, the expert picks one. Nothing is overwritten. */
export interface ShotTake {
  id: Id;
  number: number;
  video?: string;
  poster: string;
  /** The take's own length in seconds. */
  seconds: number;
  state: "making" | "ready" | "failed";
  /** Staff only. */
  model: string;
  cost: number;
  findings: TakeFinding[];
  /** The stretch the Engine would use: the clean part, clear of its findings. Picking the take cuts to it. */
  best?: { in: number; out: number };
  at: Instant;
}

/** What the Engine is asked to make for a shot. */
export interface ShotRecipe {
  /** The first frame: a checked master or a library still, so the product starts right. */
  startImage: string;
  /** Where the shot should end, when it matters (a packshot at the end). */
  endImage?: string;
  move: CameraMove;
  /** How far the camera travels, 0–100. */
  amount: number;
  /** What moves in the picture, in words: "A drop of oil falls from the opening". */
  action: string;
  /** Length of the take in seconds. */
  seconds: number;
  /** Staff only: the video model, or "auto" when the Engine picks. */
  model: string;
}

/** A shot on the timeline: a stretch of its picked take. */
export interface VideoClip {
  id: Id;
  name: string;
  source: ShotSource;
  recipe?: ShotRecipe;
  takes: ShotTake[];
  pickedTakeId?: Id;
  /** The stretch of the take that is used, in seconds. */
  in: number;
  out: number;
  /** 1 is real time; 0.5 is half speed. */
  speed: number;
  /** How this shot comes in. */
  transition: Transition;
  productId?: Id;
}

/** The brand's motion design: words and marks that come from its design system (FLOWS §27.4). The call to action is
 *  the brand's own button, a component from its design system: its words change, its look and motion are the brand's
 *  (FLOWS §34.6). */
export type MotionTemplate = "title" | "line" | "product" | "offer" | "cta" | "end";

/** A named easing from the brand's motion, never a bounce (FLOWS §34.6). */
export type EaseId = "soft-out" | "settle" | "in-out" | "even";

/** What a keyframe moves, named as in After Effects' Transform (round 15): Position X and Y, Scale, Rotation (degrees),
 *  Opacity. */
export type MotionProp = "x" | "y" | "scale" | "rotate" | "opacity";

/** One keyframe: a value at a time counted from the layer's own start, so the motion moves with the layer. x and y are
 *  per cent of the frame from where the layer sits; scale is 1 at its size; rotate is degrees; opacity 0 to 1. */
export interface MotionKey {
  prop: MotionProp;
  at: number;
  value: number;
}

/** A motion style (FLOWS §34.6): a set of motion, not a template: easing, pace, how words come in and go, how scenes
 *  meet. Made in the brand's colours and type. */
export type MotionStyleId = "saas" | "explainer" | "kinetic" | "showcase" | "stats" | "sting";

export interface MotionLayer {
  id: Id;
  template: MotionTemplate;
  text: string;
  /** Seconds on the timeline. */
  start: number;
  end: number;
  /** How it comes in: soft to sharp, a fade, or a short rise. */
  enter: "soft" | "fade" | "rise";
  place: "top" | "centre" | "bottom";
  /** How it goes (FLOWS §34.6); none is a cut. Kept as it is when the layer is made longer: the middle stretches. */
  exit?: "soft" | "fade" | "fall";
  /** How it lives while it is on. */
  loop?: "still" | "drift" | "breathe";
  /** The easing of its keyframes and its way in and out. */
  ease?: EaseId;
  /** Keyframes, counted from the layer's start. */
  keys?: MotionKey[];
  /** The shot it sits on: it moves with that shot when the shot moves (FLOWS §34.6). */
  clipId?: Id;
}

export interface CaptionCue {
  id: Id;
  text: string;
  start: number;
  end: number;
  /** The Engine wrote it, or a person changed it. */
  by: Id;
}

export interface SoundCue {
  id: Id;
  kind: "music" | "voice" | "effect";
  name: string;
  start: number;
  end: number;
  /** Level in dB, 0 is as recorded. */
  level: number;
  /** Where it may be used: "Licensed for paid social". */
  licence?: string;
  /** Beats in seconds, for cutting on the music. */
  beats?: number[];
}

/** One format the edit is made into: the Engine reframes and cuts it down; the expert looks it over. */
export interface VideoFormat {
  id: Id;
  /** "Reels and TikTok", "Feed", "Story", "Ads". */
  name: string;
  ratio: "9:16" | "4:5" | "1:1" | "16:9";
  seconds: number;
  /** Captions burnt in, for ads that play without sound. */
  captions: boolean;
  /** The placement whose safe zones it keeps. */
  placementId?: Id;
  state: "this" | "planned" | "making" | "ready";
}

/** What the Engine checked on the whole edit before it goes to check (FLOWS §27.6). */
export interface EditCheck {
  id: Id;
  label: string;
  state: "pass" | "flag";
  note?: string;
  /** Seconds on the timeline, for a flag the expert can jump to. */
  at?: number;
}

/** Words in the Engine bar on a video: the Engine shows the change on the timeline before it is kept. */
export interface VideoEngineEdit {
  id: Id;
  text: string;
  /** What it would change, one line each: "Shot 3 from 3.2 s to 2.4 s, cut on the beat". */
  changes: string[];
  /** The edit as it would be, kept or undone as a whole. */
  after: Pick<VideoEdit, "clips" | "motion" | "captions" | "sound">;
  by: Id;
  at: Instant;
  state: "proposed" | "kept" | "undone";
}

/** A video creative's edit. */
export interface VideoEdit {
  /** The format it is cut for; the others are made from it. */
  formatId: Id;
  formats: VideoFormat[];
  clips: VideoClip[];
  motion: MotionLayer[];
  captions: CaptionCue[];
  sound: SoundCue[];
  /** The colour grade over every shot, so the Engine's shots and the brand's footage match. */
  grade: string;
  checks: EditCheck[];
  edits: VideoEngineEdit[];
  /** The motion style and its knobs, 0–100 (FLOWS §34.6). */
  style?: { id: MotionStyleId; energy: number; pace: number };
}

/** A piece of the brand's own footage in its library (Fume for Agencies, 05): a shot the edit can use as it is. */
export interface BrandFootage {
  id: Id;
  workspaceId: Id;
  name: string;
  video: string;
  poster: string;
  seconds: number;
  ratio: string;
}
