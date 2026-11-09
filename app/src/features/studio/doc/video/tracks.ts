// The timeline's tracks (round 16, PROPOSED 9 Nov 2026). Marcus: "Tidslinjen sin høyde burde representere hva som er
// over hverandre, som layers." The tracks lie top to bottom as they lie over each other in the frame: the brand's
// components, the captions and the text over the video, the video tracks (a clip over the main one is a track above
// Main), then, under a line, the audio tracks. She adds as many as she wants, renames, hides, locks, mutes and moves
// them; the player draws them in this order. An edit saved before round 16 has no tracks: it gets the default set, and
// every item lies on its kind's first track.
import type {
  CaptionCue,
  MotionLayer,
  SoundCue,
  TrackKind,
  VideoEdit,
  VideoOverlay,
  VideoTrack,
} from "../../../../contract";

export const MAIN = "t-main";

/** The default set, top to bottom. */
export const DEFAULT_TRACKS: VideoTrack[] = [
  { id: "t-brand", kind: "brand", name: "Brand" },
  { id: "t-captions", kind: "captions", name: "Captions" },
  { id: "t-text", kind: "text", name: "Text" },
  { id: MAIN, kind: "video", name: "Main" },
  { id: "t-music", kind: "audio", name: "Music" },
  { id: "t-effects", kind: "audio", name: "Effects" },
];
const VOICE: VideoTrack = { id: "t-voice", kind: "audio", name: "Voice" };

export const isAudio = (t: Pick<VideoTrack, "kind">) => t.kind === "audio";

/** The track a layer of words lies on, before the list is known: its own, else its kind's default. */
export const motionTrack = (m: MotionLayer) =>
  m.trackId ?? (m.template === "cta" || m.template === "end" ? "t-brand" : "t-text");
export const captionTrack = (c: CaptionCue) => c.trackId ?? "t-captions";
export const soundTrack = (s: SoundCue) =>
  s.trackId ?? (s.kind === "music" ? "t-music" : s.kind === "voice" ? "t-voice" : "t-effects");

/** Which kinds of track a thing may lie on: words on a text or brand track, captions on a captions track, sound on an
 *  audio track, a clip over the video on a video track other than Main. */
export function fits(kind: TrackKind, thing: "motion" | "caption" | "sound" | "overlay", trackId?: string): boolean {
  if (thing === "motion") return kind === "text" || kind === "brand";
  if (thing === "caption") return kind === "captions";
  if (thing === "sound") return kind === "audio";
  return kind === "video" && trackId !== MAIN;
}

/** Every track, top to bottom, the visual ones first and the audio ones after: the edit's own list with Main always
 *  in it, and a default track added for anything that lies on one the list lacks. */
export function tracksOf(edit: Pick<VideoEdit, "tracks" | "motion" | "captions" | "sound" | "overlays">): VideoTrack[] {
  const list = [
    ...(edit.tracks ??
      DEFAULT_TRACKS.filter(
        (t) => t.id !== "t-effects" || edit.sound.some((s) => s.kind !== "music" && s.kind !== "voice"),
      )),
  ];
  const has = (id: string) => list.some((t) => t.id === id);
  if (!has(MAIN))
    list.splice(list.findIndex(isAudio) < 0 ? list.length : list.findIndex(isAudio), 0, DEFAULT_TRACKS[3]!);
  const need = (id: string) => {
    if (has(id)) return;
    const t = DEFAULT_TRACKS.find((d) => d.id === id) ?? (id === VOICE.id ? VOICE : undefined);
    if (!t) return;
    if (isAudio(t)) list.push(t);
    else
      list.splice(
        list.findIndex((x) => x.id === MAIN),
        0,
        t,
      );
  };
  edit.motion.forEach((m) => need(motionTrack(m)));
  edit.captions.forEach((c) => need(captionTrack(c)));
  edit.sound.forEach((s) => need(soundTrack(s)));
  // Visual first, then audio, each keeping its own order.
  return [...list.filter((t) => !isAudio(t)), ...list.filter(isAudio)];
}

/** The track list with one track changed. */
export const withTrack = (edit: VideoEdit, id: string, change: Partial<VideoTrack>): VideoEdit => ({
  ...edit,
  tracks: tracksOf(edit).map((t) => (t.id === id ? { ...t, ...change } : t)),
});

/** A new track of a kind: a video track goes over Main (video over video), a text track over the top text track, an
 *  audio track at the bottom. Named by its kind and number: "Video 2", "Text 2", "Audio 3". */
export function addTrack(edit: VideoEdit, kind: "video" | "text" | "audio", id: string): VideoEdit {
  const list = tracksOf(edit);
  const same = list.filter((t) => t.kind === kind).length;
  const name =
    kind === "video"
      ? `Video ${same + 1}`
      : kind === "text"
        ? `Text ${same + 1}`
        : `Audio ${list.filter(isAudio).length + 1}`;
  const track: VideoTrack = { id, kind, name };
  const at =
    kind === "audio"
      ? list.length
      : kind === "video"
        ? list.findIndex((t) => t.kind === "video")
        : Math.max(
            0,
            list.findIndex((t) => t.kind === "text"),
          );
  const next = [...list];
  next.splice(at < 0 ? 0 : at, 0, track);
  return { ...edit, tracks: next };
}

/** Move a track up or down among its own (the visual tracks, or the audio ones). */
export function moveTrack(edit: VideoEdit, id: string, to: number): VideoEdit {
  const list = tracksOf(edit);
  const track = list.find((t) => t.id === id);
  if (!track) return edit;
  const group = list.filter((t) => isAudio(t) === isAudio(track));
  const from = group.indexOf(track);
  const target = Math.min(group.length - 1, Math.max(0, to));
  if (from === target) return edit;
  group.splice(from, 1);
  group.splice(target, 0, track);
  const visual = isAudio(track) ? list.filter((t) => !isAudio(t)) : group;
  const audio = isAudio(track) ? group : list.filter(isAudio);
  return { ...edit, tracks: [...visual, ...audio] };
}

/** Take a track out with what lies on it. Main stays. */
export function removeTrack(edit: VideoEdit, id: string): VideoEdit {
  if (id === MAIN) return edit;
  return {
    ...edit,
    tracks: tracksOf(edit).filter((t) => t.id !== id),
    motion: edit.motion.filter((m) => motionTrack(m) !== id),
    captions: edit.captions.filter((c) => captionTrack(c) !== id),
    sound: edit.sound.filter((s) => soundTrack(s) !== id),
    overlays: (edit.overlays ?? []).filter((o) => o.trackId !== id),
  };
}

/** How many things lie on a track. */
export function onTrack(edit: VideoEdit, id: string): number {
  if (id === MAIN) return edit.clips.length;
  return (
    edit.motion.filter((m) => motionTrack(m) === id).length +
    edit.captions.filter((c) => captionTrack(c) === id).length +
    edit.sound.filter((s) => soundTrack(s) === id).length +
    (edit.overlays ?? []).filter((o) => o.trackId === id).length
  );
}

/** What lies on a track other than Main: each thing's id and its time on the timeline. */
export function spansOn(
  edit: Pick<VideoEdit, "motion" | "captions" | "sound" | "overlays">,
  id: string,
): { id: string; start: number; end: number }[] {
  return [
    ...edit.motion.filter((m) => motionTrack(m) === id),
    ...edit.captions.filter((c) => captionTrack(c) === id),
    ...edit.sound.filter((x) => soundTrack(x) === id),
    ...(edit.overlays ?? []).filter((o) => o.trackId === id).map((o) => ({ ...o, end: overlayEnd(o) })),
  ].map((x) => ({ id: x.id, start: x.start, end: x.end }));
}

// Things on one track never overlap, as in CapCut: a thing over another goes on a track above it, so the timeline's
// height always says what lies over what. A hair of slack, for times rounded to a tenth.
const EPS = 0.001;

/** Whether a time is free on a track, leaving out the thing being moved. */
export const isFree = (
  edit: Pick<VideoEdit, "motion" | "captions" | "sound" | "overlays">,
  id: string,
  start: number,
  end: number,
  except?: string,
) => spansOn(edit, id).every((x) => x.id === except || x.end <= start + EPS || x.start >= end - EPS);

/** The free place on a track nearest to `start` for a thing this long: `start` itself, or right before or after
 *  what is in the way. Undefined when there is none. */
export function freeAt(
  edit: Pick<VideoEdit, "motion" | "captions" | "sound" | "overlays">,
  id: string,
  start: number,
  length: number,
  except?: string,
): number | undefined {
  if (isFree(edit, id, start, start + length, except)) return start;
  return spansOn(edit, id)
    .filter((x) => x.id !== except)
    .flatMap((x) => [Math.round((x.start - length) * 10) / 10, x.end])
    .filter((at) => at >= 0 && isFree(edit, id, at, at + length, except))
    .sort((a, b) => Math.abs(a - start) - Math.abs(b - start))[0];
}

/** Where a new thing goes: the first unlocked track that fits it and is free at its time, from the one it would lie
 *  on by default; else a new track of `kind`, which goes above the others of its kind (audio at the bottom). */
export function placeNew(
  edit: VideoEdit,
  fit: (t: VideoTrack) => boolean,
  prefer: string | undefined,
  kind: "video" | "text" | "audio",
  start: number,
  end: number,
  newId: string,
): { edit: VideoEdit; trackId: string } {
  const list = tracksOf(edit).filter((t) => fit(t) && !t.locked);
  const order = [...list.filter((t) => t.id === prefer), ...list.filter((t) => t.id !== prefer)];
  const free = order.find((t) => isFree(edit, t.id, start, end));
  if (free) return { edit, trackId: free.id };
  return { edit: addTrack(edit, kind, newId), trackId: newId };
}

/** The audio tracks that are heard: the solo ones when any is solo, else every one not muted. */
export function heard(tracks: VideoTrack[]): Set<string> {
  const audio = tracks.filter(isAudio);
  const solo = audio.filter((t) => t.solo);
  return new Set((solo.length ? solo : audio.filter((t) => !t.muted)).map((t) => t.id));
}

/** An overlay's end on the timeline. */
export const overlayEnd = (o: Pick<VideoOverlay, "start" | "in" | "out" | "speed">) =>
  o.start + (o.out - o.in) / (o.speed || 1);

/** The icon of a track's kind. */
export const TRACK_ICON = {
  brand: "layers",
  captions: "captions",
  text: "type",
  video: "film",
  audio: "music",
} as const;

/** A hidden track's eye has a slash over it, and an unlocked track shows the open lock, as the design studio's layers. */
export const ICON_HIDDEN = "eye-off" as const;
export const ICON_UNLOCKED = "lock-open" as const;
