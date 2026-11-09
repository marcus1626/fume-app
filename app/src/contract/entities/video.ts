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
  /** Round 16: the track it lies on; none is its kind's first track (Text, or Brand for a component). */
  trackId?: Id;
  /** Round 16: her own easing curve (cubic-bezier x1, y1, x2, y2), drawn in the curve editor; it overrides `ease`. */
  curve?: [number, number, number, number];
  /** Round 16: the anchor point, in per cent of the layer's box (50, 50 is its centre), as in After Effects. */
  anchor?: { x: number; y: number };
  /** Round 16: a property's value while its stopwatch is off (no keys), as in After Effects' Transform. A property
   *  with keys takes its value from them; one with neither is at rest (no move, 100 % scale, no turn, fully seen). */
  transform?: Partial<Record<MotionProp, number>>;
  /** Round 16: a text animator (Typewriter, Fade up by word, …): the words come in a letter, a word or a line at a
   *  time. While it is on, it is the layer's way in. */
  animate?: TextAnimator;
}

/** Round 16: the text animators, as in After Effects' Animate menu and its presets. */
export type TextAnimatorId = "typewriter" | "fade-up" | "blur-in" | "slide-up" | "tracking-in" | "scale-down";

/** A text animator with its range selector: which part of the words it moves (start and end, per cent of the
 *  letters, words or lines), an offset, and how long it takes to run through them. */
export interface TextAnimator {
  preset: TextAnimatorId;
  by: "letter" | "word" | "line";
  start: number;
  end: number;
  offset: number;
  /** Seconds from the layer's start until the last letter, word or line is in. */
  over: number;
}

export interface CaptionCue {
  id: Id;
  text: string;
  start: number;
  end: number;
  /** The Engine wrote it, or a person changed it. */
  by: Id;
  /** Round 16: the track it lies on; none is the first Captions track. */
  trackId?: Id;
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
  /** Round 16: the audio track it lies on; none is its kind's track (Music, Effects or Voice). */
  trackId?: Id;
}

/** Round 16 (Marcus, 9 Nov: "Tidslinjen sin høyde burde representere hva som er over hverandre, som layers"): the
 *  timeline's tracks, top to bottom as they lie over each other in the frame, then the audio tracks under a line. */
export type TrackKind = "text" | "brand" | "captions" | "video" | "audio";

export interface VideoTrack {
  id: Id;
  kind: TrackKind;
  name: string;
  /** Left out of the frame (a visual track) while she works; never deleted. */
  hidden?: boolean;
  /** Nothing on it can be picked or moved. */
  locked?: boolean;
  /** Audio: not heard. */
  muted?: boolean;
  /** Audio: only the solo tracks are heard. */
  solo?: boolean;
}

/** A marker on the ruler: a named moment ("Beat drop", "Label in"), as in Premiere. */
export interface VideoMarker {
  id: Id;
  at: number;
  name: string;
}

/** Round 16: a clip over the video, on a video track above Main (video over video): her footage or a take, at its
 *  own time, the whole frame or a picture in the picture, with its opacity. */
export interface VideoOverlay {
  id: Id;
  trackId: Id;
  name: string;
  source: ShotSource;
  takes: ShotTake[];
  pickedTakeId?: Id;
  in: number;
  out: number;
  speed: number;
  /** Seconds on the timeline. */
  start: number;
  /** The whole frame, or a smaller picture in a corner. */
  size?: "full" | "inset";
  /** 0 to 1. */
  opacity?: number;
}

/** Round 16 (Marcus, 9 Nov: "en egen side, med et board, som dekker hele siden, litt som et lite figma canvas"): the
 *  storyboard as its own board. Its sections hold the shots in the order of the edit; notes lie where she put them. */
export interface StoryboardSection {
  id: Id;
  name: string;
  clipIds: Id[];
}
export interface StoryboardNote {
  id: Id;
  text: string;
  /** Where it lies on the board, in board pixels. */
  x: number;
  y: number;
}
export interface Storyboard {
  sections: StoryboardSection[];
  notes: StoryboardNote[];
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
  /** Round 16: the tracks, top to bottom; none is the default set (Brand, Captions, Text, Main, Music, Effects). */
  tracks?: VideoTrack[];
  /** Round 16: named moments on the ruler. */
  markers?: VideoMarker[];
  /** Round 16: clips over the video, on video tracks above Main. */
  overlays?: VideoOverlay[];
  /** Round 16: the storyboard's sections and notes; none is one section per part of the film. */
  board?: Storyboard;
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
