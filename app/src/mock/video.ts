// Video in the Studio, in the mock (FLOWS §27): a new edit from a still, the Engine bar's words on a video, takes the
// Engine makes, and the edit made into other formats. The takes are the demo's real shots (app/public/demo/lysne/video/):
// a new take of a shot plays the shot it was made from, and a new shot plays the one its start frame came from.
import type { CreativeDocument, Id, ShotRecipe, ShotTake, VideoClip, VideoEdit, VideoEngineEdit } from "../contract";
import {
  MIN_SHOT,
  clipLength,
  cutDown,
  editChecks,
  editLength,
  nearestBeat,
  pickedTake,
  placed,
} from "../domain/video";
import { poster, shot } from "./seed/helpers";
import { videoFormats } from "./seed/video";

/** The demo's shots, by name, for takes the mock makes. */
const SHOTS = ["bottle", "turn", "hands", "light"];
/** A second take of the drop is the one that turns the bottle (the first had oil running from its base). */
const BETTER: Record<string, string> = { drop: "turn" };

const nameOf = (url: string | undefined) => url?.match(/video\/([a-z]+)\.(?:jpg|mp4)$/)?.[1];

/** The edit with the Engine's checks worked out again. */
export const withChecks = (edit: Omit<VideoEdit, "checks"> | VideoEdit): VideoEdit => ({
  ...edit,
  checks: editChecks({ ...edit, checks: [] }),
});

/** A new video from a picture: one shot the Engine will make from it (a slow push in), nothing else yet. */
export function startEdit(image: string | undefined, id: (p: string) => Id): VideoEdit {
  const clips: VideoClip[] = image
    ? [
        {
          id: id("vc"),
          name: "Shot 1",
          source: "engine",
          recipe: { startImage: image, move: "push", amount: 15, action: "", seconds: 5, model: "auto" },
          takes: [],
          in: 0,
          out: 5,
          speed: 1,
          transition: "cut",
        },
      ]
    : [];
  return withChecks({
    formatId: "vf-reels",
    formats: videoFormats(),
    clips,
    motion: [],
    captions: [],
    sound: [],
    grade: "LYSNE warm",
    edits: [],
  });
}

/** Takes the Engine is making for a shot; they are ready after `ready` runs. */
export function newTakes(clip: VideoClip | undefined, recipe: ShotRecipe, count: number, id: (p: string) => Id) {
  const first = clip?.takes[0];
  const from = nameOf(first?.video) ?? nameOf(recipe.startImage);
  const name = (from && BETTER[from]) || from || SHOTS[0]!;
  const start = clip?.takes.length ?? 0;
  const takes: ShotTake[] = Array.from({ length: count }, (_, i) => ({
    id: id("tk"),
    number: start + i + 1,
    poster: recipe.startImage,
    seconds: recipe.seconds,
    state: "making",
    model: recipe.model === "auto" ? "Kling 3.0" : recipe.model,
    cost: Math.round(recipe.seconds * 0.084 * 100) / 100,
    findings: [],
    at: new Date().toISOString(),
  }));
  /** The takes as they are once made, by id: the clip may have been copied by an edit in the meantime. */
  const made = new Map(
    takes.map((t, i) => {
      const n = i === 0 ? name : SHOTS[(SHOTS.indexOf(name) + i) % SHOTS.length]!;
      return [t.id, { state: "ready" as const, video: shot(n), poster: poster(n), seconds: 5 }];
    }),
  );
  const ready = (clips: VideoClip[]) => {
    for (const c of clips) c.takes = c.takes.map((t) => (made.has(t.id) ? { ...t, ...made.get(t.id) } : t));
  };
  return { takes, ready };
}

/** Words in the Engine bar on a video. It reads a few kinds of ask and shows the change before it is kept; anything
 *  else it leaves to the expert, and says so. */
export function readVideoAsk(d: CreativeDocument, text: string, id: (p: string) => Id, by: Id): VideoEngineEdit {
  const edit = d.video!;
  const words = text.toLowerCase();
  let clips = edit.clips;
  let captions = edit.captions;
  let motion = edit.motion;
  let sound = edit.sound;
  const changes: string[] = [];
  const before = editLength(edit);

  const seconds = words.match(/(\d+(?:[.,]\d+)?)\s*(?:s\b|sec|seconds)/);
  const target = seconds ? Number(seconds[1]!.replace(",", ".")) : undefined;
  if (target) {
    clips = cutDown(clips, target);
    const after = clips.reduce((s, c) => s + clipLength(c), 0);
    const scale = after / before;
    const at = (n: number) => Math.round(n * scale * 100) / 100;
    captions = captions.map((c) => ({ ...c, start: at(c.start), end: at(c.end) }));
    motion = motion.map((m) => ({ ...m, start: at(m.start), end: at(m.end) }));
    // The music is cut to the new length (it fades out there); a sound effect moves with its moment.
    sound = sound.map((x) =>
      x.kind === "music" ? { ...x, end: Math.min(x.end, target) } : { ...x, start: at(x.start), end: at(x.end) },
    );
    changes.push(`The edit from ${before.toFixed(1)} s to ${after.toFixed(1)} s; every shot gives up the same share`);
  }

  const beats = edit.sound.find((s) => s.kind === "music")?.beats;
  if (/beat|music|rhythm/.test(words) && beats?.length) {
    const shots = placed(clips);
    let shift = 0;
    clips = clips.map((c, i) => {
      const speed = c.speed || 1;
      const end = shots[i]!.end + shift;
      const longest = pickedTake(c)?.seconds ?? c.out;
      // The last shot ends the edit: on the length asked for, else where it is.
      if (i === clips.length - 1) {
        if (!target) return c;
        const out = Math.min(longest, Math.max(c.in + MIN_SHOT * speed, c.out + (target - end) * speed));
        return Math.abs(out - c.out) < 0.01 ? c : { ...c, out: Math.round(out * 100) / 100 };
      }
      // With a length asked for, a cut moves back to the beat before it, so the edit never runs over.
      const beat = target
        ? [...beats].reverse().find((b) => b <= end + 1e-6 && end - b <= 0.4)
        : nearestBeat(beats, end, 0.4);
      if (beat === undefined) return c;
      const out = Math.min(longest, Math.max(c.in + MIN_SHOT * speed, c.out + (beat - end) * speed));
      if (Math.abs(out - c.out) < 0.01) return c;
      shift += (out - c.out) / speed;
      changes.push(`Shot ${i + 1} ends on the beat at ${(end + (out - c.out) / speed).toFixed(2)} s`);
      return { ...c, out: Math.round(out * 100) / 100 };
    });
  }

  const which = words.match(/shot\s*(\d)/);
  const index = which ? Number(which[1]) - 1 : clips.length - 1;
  if (/slow/.test(words) && clips[index]) {
    clips = clips.map((c, i) => (i === index ? { ...c, speed: 0.5 } : c));
    changes.push(`Shot ${index + 1} at half speed`);
  }
  if (/hold|longer/.test(words) && clips[index]) {
    clips = clips.map((c, i) => (i === index ? { ...c, out: Math.min(5, c.out + 1) } : c));
    changes.push(`Shot ${index + 1} holds a second longer`);
  }
  if (/no captions|captions off|without captions/.test(words)) {
    captions = [];
    changes.push("No captions");
  }

  return {
    id: id("ve"),
    text,
    changes,
    after: { clips, captions, motion, sound },
    by,
    at: new Date().toISOString(),
    state: "proposed",
  };
}
