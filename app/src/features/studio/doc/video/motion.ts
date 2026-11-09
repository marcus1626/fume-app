// Motion in the Video studio (FLOWS §34.6, PROPOSED 9 Nov 2026): the brand's named easings, the motion styles, and a
// layer's keyframes worked out at a moment. Fume owns the motion as data (keyframes and easing on the layer); whatever
// plays it in the browser or renders it frame by frame reads the same data.
import { placed } from "../../../../domain/video";
import type {
  EaseId,
  MotionKey,
  MotionLayer,
  MotionProp,
  MotionStyleId,
  TextAnimator,
  TextAnimatorId,
  VideoEdit,
} from "../../../../contract";

/** The brand's easings: slow, continuous, never a bounce. The curve is a CSS cubic-bezier. */
export const EASES: Record<EaseId, { name: string; line: string; curve: [number, number, number, number] }> = {
  "soft-out": { name: "Soft out", line: "Quick to start, a long calm landing", curve: [0.16, 1, 0.3, 1] },
  settle: { name: "Settle", line: "Slow in, slow out, like a focus pull", curve: [0.65, 0, 0.35, 1] },
  "in-out": { name: "In and out", line: "Even on both ends", curve: [0.45, 0, 0.55, 1] },
  even: { name: "Even", line: "The same speed all the way", curve: [0, 0, 1, 1] },
};

/** The motion styles (FLOWS §34.6): each a set of motion, made in the brand's colours and type. */
export const STYLES: Record<
  MotionStyleId,
  {
    name: string;
    line: string;
    energy: number;
    pace: number;
    ease: EaseId;
    enter: MotionLayer["enter"];
    exit: NonNullable<MotionLayer["exit"]>;
    loop: NonNullable<MotionLayer["loop"]>;
  }
> = {
  showcase: {
    name: "Product showcase",
    line: "The product turns; the words wait for it",
    energy: 35,
    pace: 35,
    ease: "soft-out",
    enter: "soft",
    exit: "soft",
    loop: "drift",
  },
  explainer: {
    name: "Explainer",
    line: "One idea a scene, calm and clear",
    energy: 40,
    pace: 45,
    ease: "settle",
    enter: "fade",
    exit: "fade",
    loop: "still",
  },
  saas: {
    name: "SaaS demo",
    line: "Screens and words, quick and exact",
    energy: 60,
    pace: 70,
    ease: "in-out",
    enter: "rise",
    exit: "fade",
    loop: "still",
  },
  kinetic: {
    name: "Kinetic type",
    line: "Words that move on the beat",
    energy: 80,
    pace: 80,
    ease: "soft-out",
    enter: "rise",
    exit: "fall",
    loop: "breathe",
  },
  stats: {
    name: "Stats",
    line: "Numbers that count up, one at a time",
    energy: 55,
    pace: 60,
    ease: "settle",
    enter: "rise",
    exit: "fade",
    loop: "still",
  },
  sting: {
    name: "Logo sting",
    line: "The mark in a second and a half",
    energy: 50,
    pace: 50,
    ease: "soft-out",
    enter: "soft",
    exit: "fade",
    loop: "still",
  },
};

/** A style on the whole edit: every layer's way in, way out, life and easing follow it. Its words, its timing and its
 *  keyframes stay as they are, so trying another style loses nothing. */
export function withStyle(edit: VideoEdit, id: MotionStyleId): VideoEdit {
  const s = STYLES[id];
  return {
    ...edit,
    style: { id, energy: s.energy, pace: s.pace },
    // The style's easing replaces her own curve too; the curve editor draws it again from there.
    motion: edit.motion.map((m) => ({
      ...m,
      enter: s.enter,
      exit: s.exit,
      loop: s.loop,
      ease: s.ease,
      curve: undefined,
    })),
  };
}

/** A layer's curve: her own (the curve editor), else its named easing's. */
export const curveOf = (layer: Pick<MotionLayer, "curve" | "ease">): [number, number, number, number] =>
  layer.curve ?? EASES[layer.ease ?? "soft-out"].curve;

/** The named easing a curve is, if it is one. */
export const easeNamed = (curve: [number, number, number, number]): EaseId | undefined =>
  (Object.keys(EASES) as EaseId[]).find((id) => EASES[id].curve.every((n, i) => Math.abs(n - curve[i]!) < 0.005));

/** A curve that goes past where it starts or lands (a y outside 0–1) overshoots: a bounce, which the brand's motion
 *  never has. She may still use it (the designer has the last word); the editor says it is off the brand's motion. */
export const overshoots = (curve: [number, number, number, number]) =>
  curve[1] < 0 || curve[1] > 1 || curve[3] < 0 || curve[3] > 1;

/** After Effects' ease out of a key and ease into the next, as influence in per cent: x1 and 1 − x2 of the curve. */
export const influence = (curve: [number, number, number, number]) => ({
  out: Math.round(curve[0] * 100),
  in: Math.round((1 - curve[2]) * 100),
});
/** A curve from the two influences, at speed 0 on both keys (After Effects' Easy Ease is 33 and 33). */
export const fromInfluence = (out: number, into: number): [number, number, number, number] => [
  Math.round(Math.min(100, Math.max(0, out))) / 100,
  0,
  Math.round(100 - Math.min(100, Math.max(0, into))) / 100,
  1,
];

/** A cubic-bezier easing as a function of progress 0–1. */
export function bezier([x1, y1, x2, y2]: [number, number, number, number]) {
  const at = (a: number, b: number, t: number) => 3 * a * (1 - t) ** 2 * t + 3 * b * (1 - t) * t ** 2 + t ** 3;
  return (x: number) => {
    if (x <= 0 || x >= 1) return Math.min(1, Math.max(0, x));
    let lo = 0;
    let hi = 1;
    let t = x;
    for (let i = 0; i < 24; i++) {
      const v = at(x1, x2, t);
      if (Math.abs(v - x) < 1e-4) break;
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return at(y1, y2, t);
  };
}

export const REST: Record<MotionProp, number> = { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 };

/** A property's value at a moment of the layer (seconds from its start), from its keyframes and easing. */
export function valueAt(layer: MotionLayer, prop: MotionProp, local: number): number {
  const keys = (layer.keys ?? []).filter((k) => k.prop === prop).sort((a, b) => a.at - b.at);
  if (!keys.length) return layer.transform?.[prop] ?? REST[prop];
  if (local <= keys[0]!.at) return keys[0]!.value;
  const last = keys[keys.length - 1]!;
  if (local >= last.at) return last.value;
  const i = keys.findIndex((k) => k.at > local);
  const a = keys[i - 1]!;
  const b = keys[i]!;
  const ease = bezier(curveOf(layer));
  return a.value + (b.value - a.value) * ease((local - a.at) / (b.at - a.at));
}

/** The props a layer has keyframes on, named and ordered as After Effects' Transform (round 15, Marcus: "som i after
 *  effects, transform, opacity, rotate"). */
export const PROPS: { prop: MotionProp; name: string; unit: string }[] = [
  { prop: "x", name: "Position X", unit: "%" },
  { prop: "y", name: "Position Y", unit: "%" },
  { prop: "scale", name: "Scale", unit: "×" },
  { prop: "rotate", name: "Rotation", unit: "°" },
  { prop: "opacity", name: "Opacity", unit: "" },
];

/** An easing's numbers, as a designer types them: "0.16, 1, 0.30, 1" (cubic-bezier). */
export const curveWords = (id: EaseId) => EASES[id].curve.map((n) => String(n)).join(", ");

/** Put a keyframe at a moment (replacing one there), or take it out. */
export function setKey(keys: MotionKey[] = [], key: MotionKey): MotionKey[] {
  const rest = keys.filter((k) => !(k.prop === key.prop && Math.abs(k.at - key.at) < 0.05));
  return [...rest, key].sort((a, b) => a.at - b.at);
}
export const dropKey = (keys: MotionKey[] = [], prop: MotionProp, at: number) =>
  keys.filter((k) => !(k.prop === prop && Math.abs(k.at - at) < 0.05));

/** How long a layer takes to come in and to go out, in seconds, at the style's pace (0–100): calm is slower. */
export const inOut = (pace = 40) => 0.9 - 0.006 * pace;

/** A layer drawn at a moment of the video: its keyframes, then its way in, its life and its way out on top, all from
 *  the clock, so a still frame on the ruler shows exactly what the film shows there. */
export function layerAt(layer: MotionLayer, t: number, style?: VideoEdit["style"]) {
  const local = t - layer.start;
  const dur = Math.max(0.1, layer.end - layer.start);
  const ease = bezier(curveOf(layer));
  const x = valueAt(layer, "x", local);
  let y = valueAt(layer, "y", local);
  let scale = valueAt(layer, "scale", local);
  const rotate = valueAt(layer, "rotate", local);
  let opacity = valueAt(layer, "opacity", local);
  let blur = 0;
  // The style's energy sets how far words travel and how soft they start; its pace, how long they take.
  const span = inOut(style?.pace);
  const reach = 0.5 + (style?.energy ?? 40) / 100;

  // A text animator is the layer's way in while it is on (round 16).
  const enter = layer.animate ? 1 : ease(Math.min(1, Math.max(0, local / span)));
  if (enter < 1) {
    opacity *= enter;
    if (layer.enter === "soft") blur += 12 * reach * (1 - enter);
    if (layer.enter === "rise") y += 6 * reach * (1 - enter);
  }
  const exit = ease(Math.min(1, Math.max(0, (layer.end - t) / span)));
  if (layer.exit && exit < 1) {
    opacity *= exit;
    if (layer.exit === "soft") blur += 12 * reach * (1 - exit);
    if (layer.exit === "fall") y += 6 * reach * (1 - exit);
  }
  if (layer.loop === "drift") scale *= 1 + 0.03 * Math.min(1, local / dur);
  if (layer.loop === "breathe") scale *= 1 + 0.012 * Math.sin((2 * Math.PI * local) / 2.4);
  return { x, y, scale, rotate, opacity, blur };
}

/** Layers that follow a shot (clipId) move with it: after a trim, a reorder or a shot taken out, each such layer keeps
 *  its place on its shot. A layer whose shot is gone keeps its time and follows nothing. */
export function follow(before: VideoEdit, after: VideoEdit): VideoEdit {
  if (!after.motion.some((m) => m.clipId)) return after;
  const startsOf = (e: VideoEdit) => new Map(placed(e.clips).map((p) => [p.clip.id, p.start]));
  const was = startsOf(before);
  const now = startsOf(after);
  let moved = false;
  const motion = after.motion.map((m) => {
    if (!m.clipId) return m;
    const a = was.get(m.clipId);
    const b = now.get(m.clipId);
    if (b === undefined) {
      moved = true;
      return { ...m, clipId: undefined };
    }
    if (a === undefined || Math.abs(b - a) < 0.001) return m;
    moved = true;
    const d = Math.round((b - a) * 100) / 100;
    return { ...m, start: Math.max(0, m.start + d), end: Math.max(0.1, m.end + d) };
  });
  return moved ? { ...after, motion } : after;
}

// ─── Round 16: text animators ───────────────────────────────────────────────

/** The text animators and presets, as in After Effects' Animate menu: each comes in by letter, word or line. Typewriter
 *  is hard (a letter is there or not); the rest are soft, a few units at a time, on the layer's curve. */
export const ANIMATORS: Record<
  TextAnimatorId,
  { name: string; line: string; by: TextAnimator["by"]; over: number; soft: number }
> = {
  typewriter: { name: "Typewriter", line: "A letter at a time, as it is typed", by: "letter", over: 1.2, soft: 1 },
  "fade-up": { name: "Fade up by word", line: "Each word rises a little as it fades in", by: "word", over: 1, soft: 2 },
  "blur-in": { name: "Blur in by letter", line: "Soft to sharp, a letter at a time", by: "letter", over: 1.2, soft: 4 },
  "slide-up": {
    name: "Slide up by line",
    line: "Each line slides up from under itself",
    by: "line",
    over: 0.9,
    soft: 1.5,
  },
  "tracking-in": { name: "Tracking in", line: "Wide letters draw together", by: "letter", over: 1.4, soft: 6 },
  "scale-down": {
    name: "Scale down by word",
    line: "Each word settles from a little larger",
    by: "word",
    over: 1,
    soft: 2,
  },
};

/** A new animator from a preset, over the whole of the words. */
export const animator = (preset: TextAnimatorId): TextAnimator => ({
  preset,
  by: ANIMATORS[preset].by,
  start: 0,
  end: 100,
  offset: 0,
  over: ANIMATORS[preset].over,
});

/** The words cut into what the animator moves: letters (a space stays with the letter before it), words, or lines. */
export function unitsOf(text: string, by: TextAnimator["by"]): string[] {
  if (by === "line") return text.split("\n");
  if (by === "word") return text.split(/(?<=\s)/);
  return [...text];
}

/** How far each unit still is from being in, 0 (in) to 1 (not yet), at a moment of the layer (seconds from its
 *  start). The range selector picks which units move (start and end, per cent of them); the offset moves the range. */
export function unitsAt(layer: MotionLayer, local: number): number[] {
  const a = layer.animate;
  if (!a) return [];
  const n = unitsOf(layer.text, a.by).length;
  const shift = Math.round((a.offset / 100) * n);
  const from = Math.min(n, Math.max(0, Math.floor((a.start / 100) * n) + shift));
  const to = Math.min(n, Math.max(from, Math.ceil((a.end / 100) * n) + shift));
  const m = Math.max(1, to - from);
  const soft = ANIMATORS[a.preset].soft;
  const ease = bezier(curveOf(layer));
  const p = Math.min(1, Math.max(0, local / Math.max(0.1, a.over)));
  const front = p * (m + soft);
  return Array.from({ length: n }, (_, i) => {
    if (i < from || i >= to) return 0;
    const k = i - from;
    if (soft <= 1) return front >= k + 1 ? 0 : 1;
    return 1 - ease(Math.min(1, Math.max(0, (front - k) / soft)));
  });
}
