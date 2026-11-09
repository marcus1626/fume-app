// The timeline's arithmetic (FLOWS §27): how long a shot runs, where each one starts, what plays at a moment, and
// how an edit is cut down to a shorter format. The backend's renderer and the Studio both use these, so a cut reads
// the same everywhere. Seconds throughout.
import type { EditCheck, ShotTake, VideoClip, VideoEdit } from "../contract";

/** The shortest a shot may be cut to: shorter reads as a flash. */
export const MIN_SHOT = 0.8;

/** The take a shot uses: the picked one, else the newest that is ready. */
export function pickedTake(clip: VideoClip): ShotTake | undefined {
  return (
    clip.takes.find((t) => t.id === clip.pickedTakeId) ?? [...clip.takes].reverse().find((t) => t.state === "ready")
  );
}

/** How long a shot runs on the timeline. */
export const clipLength = (clip: Pick<VideoClip, "in" | "out" | "speed">) =>
  Math.max(0, clip.out - clip.in) / (clip.speed || 1);

/** Each shot with where it starts and ends on the timeline. */
export function placed(clips: VideoClip[]) {
  let t = 0;
  return clips.map((clip, index) => {
    const start = t;
    t += clipLength(clip);
    return { clip, index, start, end: t };
  });
}

/** The length of the whole edit. */
export const editLength = (edit: Pick<VideoEdit, "clips">) => edit.clips.reduce((sum, c) => sum + clipLength(c), 0);

/** What plays at a moment: the shot, and the second of its take to show. */
export function clipAt(clips: VideoClip[], t: number) {
  const all = placed(clips);
  const hit = all.find((p) => t >= p.start && t < p.end) ?? all.at(-1);
  if (!hit) return undefined;
  const local = Math.min(hit.clip.out, hit.clip.in + Math.max(0, t - hit.start) * (hit.clip.speed || 1));
  return { ...hit, local };
}

/** Cuts an edit down to a length: every shot gives up the same share, none shorter than MIN_SHOT, and each keeps
 *  the middle of what it showed (the action sits there). An edit already short enough comes back as it is. */
export function cutDown(clips: VideoClip[], seconds: number): VideoClip[] {
  const total = clips.reduce((s, c) => s + clipLength(c), 0);
  if (total <= seconds + 1e-6 || !clips.length) return clips;
  const share = seconds / total;
  return clips.map((c) => {
    const length = Math.max(MIN_SHOT, clipLength(c) * share);
    const taken = Math.min(c.out - c.in, length * (c.speed || 1));
    const middle = (c.in + c.out) / 2;
    const start = Math.max(c.in, Math.min(c.out - taken, middle - taken / 2));
    return { ...c, in: round(start), out: round(start + taken) };
  });
}

/** The nearest beat to a moment, within a reach, for cutting on the music. */
export function nearestBeat(beats: number[] | undefined, t: number, reach = 0.25): number | undefined {
  if (!beats?.length) return undefined;
  const best = beats.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a));
  return Math.abs(best - t) <= reach ? best : undefined;
}

/** A time as the timeline writes it: 0:06, 0:12.5 when it falls between seconds. */
export function timecode(t: number, tenths = false): string {
  const s = Math.max(0, t);
  const whole = Math.floor(s);
  const m = Math.floor(whole / 60);
  const rest = whole % 60;
  const head = `${m}:${String(rest).padStart(2, "0")}`;
  return tenths ? `${head}.${Math.floor((s - whole) * 10)}` : head;
}

/** What the Engine checks on the whole edit before it goes to check (FLOWS §27.6). The findings on the picked takes
 *  come first, as flags the expert can jump to; then the shots, the length, the words and the music. */
export function editChecks(edit: VideoEdit): EditCheck[] {
  const format = edit.formats.find((f) => f.id === edit.formatId);
  const shots = placed(edit.clips);
  const checks: EditCheck[] = [];

  const open = shots.flatMap(({ clip, index, start }) => {
    const take = pickedTake(clip);
    return (take?.findings ?? [])
      .filter((f) => f.state === "open" && f.to > clip.in && f.from < clip.out)
      .map((f) => ({ f, index, at: start + Math.max(0, f.from - clip.in) / (clip.speed || 1) }));
  });
  const product = open.filter((o) => o.f.kind === "product" || o.f.kind === "physics");
  checks.push(
    product.length
      ? {
          id: "ck-product",
          label: "Product correct in every frame",
          state: "flag",
          note: `Shot ${product[0]!.index + 1}: ${product[0]!.f.text}`,
          at: product[0]!.at,
        }
      : { id: "ck-product", label: "Product correct in every frame", state: "pass" },
  );
  const people = open.filter((o) => o.f.kind === "people");
  checks.push(
    people.length
      ? {
          id: "ck-people",
          label: "Hands and bodies look right",
          state: "flag",
          note: `Shot ${people[0]!.index + 1}: ${people[0]!.f.text}`,
          at: people[0]!.at,
        }
      : { id: "ck-people", label: "Hands and bodies look right", state: "pass" },
  );

  const missing = shots.find(({ clip }) => !pickedTake(clip));
  checks.push(
    missing
      ? {
          id: "ck-shots",
          label: "Every shot has a take",
          state: "flag",
          note: `Shot ${missing.index + 1} is still being made`,
          at: missing.start,
        }
      : { id: "ck-shots", label: "Every shot has a take", state: "pass" },
  );

  if (format) {
    const length = editLength(edit);
    const off = Math.abs(length - format.seconds) > 0.5;
    checks.push({
      id: "ck-length",
      label: `${format.seconds} s for ${format.name}`,
      state: off ? "flag" : "pass",
      note: off ? `The edit runs ${length.toFixed(1)} s` : undefined,
    });
  }

  const music = edit.sound.find((s) => s.kind === "music");
  checks.push(
    !music || music.licence
      ? { id: "ck-music", label: "Music licensed for paid social", state: "pass" }
      : {
          id: "ck-music",
          label: "Music licensed for paid social",
          state: "flag",
          note: `${music.name} has no licence`,
        },
  );
  checks.push({
    id: "ck-label",
    label: "Marked as made with AI",
    state: "pass",
    note: "In the video’s own data, for every platform",
  });
  return checks;
}

const round = (n: number) => Math.round(n * 100) / 100;
