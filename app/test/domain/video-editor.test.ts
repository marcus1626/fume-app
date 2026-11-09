// The video editor of round 16 (PROPOSED 9 Nov 2026): the timeline's tracks as the frame's layers, the storyboard's
// sections, the curve editor's numbers, a property's own value and the text animators.
import { describe, expect, test } from "vitest";
import type { MotionLayer, VideoClip, VideoEdit } from "../../src/contract";
import { boardOf, moveShot, nudgeShot, removeSection } from "../../src/features/studio/doc/video/board";
import {
  animator,
  easeNamed,
  fromInfluence,
  influence,
  overshoots,
  unitsAt,
  unitsOf,
  valueAt,
} from "../../src/features/studio/doc/video/motion";
import {
  MAIN,
  addTrack,
  freeAt,
  heard,
  isFree,
  moveTrack,
  placeNew,
  removeTrack,
  tracksOf,
} from "../../src/features/studio/doc/video/tracks";

const clip = (id: string): VideoClip => ({
  id,
  name: id,
  source: "engine",
  takes: [],
  in: 0,
  out: 2,
  speed: 1,
  transition: "dissolve",
});
const layer = (extra: Partial<MotionLayer> = {}): MotionLayer => ({
  id: "mo-1",
  template: "title",
  text: "Night ritual",
  start: 1,
  end: 4,
  enter: "soft",
  place: "centre",
  ...extra,
});
const edit = (extra: Partial<VideoEdit> = {}): VideoEdit => ({
  formatId: "vf",
  formats: [],
  clips: ["a", "b", "c", "d"].map(clip),
  motion: [layer(), layer({ id: "mo-cta", template: "cta", text: "Se oljen" })],
  captions: [{ id: "cp-1", text: "The last light", start: 1, end: 2, by: "engine" }],
  sound: [{ id: "sd-music", kind: "music", name: "Late light", start: 0, end: 8, level: -6 }],
  grade: "",
  checks: [],
  edits: [],
  ...extra,
});

describe("the tracks, as the frame's layers", () => {
  test("an edit from before round 16 gets the default set, captions over the video and audio under it", () => {
    expect(tracksOf(edit()).map((t) => t.name)).toEqual(["Brand", "Captions", "Text", "Main", "Music"]);
  });

  test("a sound effect brings its own track; a voice its own", () => {
    const e = edit({
      sound: [
        ...edit().sound,
        { id: "sd-fx", kind: "effect", name: "Glass", start: 1, end: 2, level: -14 },
        { id: "sd-vo", kind: "voice", name: "Voice", start: 1, end: 3, level: -3 },
      ],
    });
    expect(tracksOf(e).map((t) => t.id)).toEqual([
      "t-brand",
      "t-captions",
      "t-text",
      MAIN,
      "t-music",
      "t-effects",
      "t-voice",
    ]);
  });

  test("a video track goes over Main, a text track over the top text track, audio at the bottom", () => {
    let e = addTrack(edit(), "video", "t-v2");
    e = addTrack(e, "text", "t-x2");
    e = addTrack(e, "audio", "t-a2");
    expect(tracksOf(e).map((t) => t.name)).toEqual([
      "Brand",
      "Captions",
      "Text 2",
      "Text",
      "Video 2",
      "Main",
      "Music",
      "Audio 2",
    ]);
  });

  test("a track moves among its own: a visual track never goes under the audio", () => {
    const e = moveTrack(edit(), "t-captions", 99);
    expect(tracksOf(e).map((t) => t.id)).toEqual(["t-brand", "t-text", MAIN, "t-captions", "t-music"]);
  });

  test("taking out a track takes what lies on it; Main stays", () => {
    const e = removeTrack(edit(), "t-captions");
    expect(e.captions).toEqual([]);
    expect(tracksOf(e).some((t) => t.id === "t-captions")).toBe(false);
    expect(removeTrack(edit(), MAIN)).toEqual(edit());
  });

  test("things on one track never overlap: a moved one stops against its neighbour", () => {
    const e = edit({
      captions: [
        { id: "cp-1", text: "The last light", start: 1, end: 2, by: "engine" },
        { id: "cp-2", text: "of the day", start: 3, end: 4, by: "engine" },
      ],
    });
    expect(isFree(e, "t-captions", 2, 3)).toBe(true);
    expect(isFree(e, "t-captions", 1.5, 2.5)).toBe(false);
    expect(isFree(e, "t-captions", 1.5, 2.5, "cp-1")).toBe(true);
    // cp-2 dragged to 1.4: the nearest free place is right after cp-1
    expect(freeAt(e, "t-captions", 1.4, 1, "cp-2")).toBe(2);
    // a 3 s thing has no room between them, so it goes after the last one
    expect(freeAt(e, "t-captions", 1.6, 3)).toBe(4);
  });

  test("a new thing goes on a free track of its kind, else on a new track above", () => {
    const busy = placeNew(edit(), (k) => k.kind === "text", "t-text", "text", 2, 3, "t-new");
    expect(busy.trackId).toBe("t-new");
    expect(tracksOf(busy.edit).map((t) => t.name)).toEqual(["Brand", "Captions", "Text 2", "Text", "Main", "Music"]);
    const free = placeNew(edit(), (k) => k.kind === "text", "t-text", "text", 5, 6, "t-new");
    expect(free).toEqual({ edit: edit(), trackId: "t-text" });
  });

  test("solo wins over mute: only the solo tracks are heard", () => {
    const tracks = [
      { id: "a", kind: "audio" as const, name: "A", muted: true },
      { id: "b", kind: "audio" as const, name: "B" },
      { id: "c", kind: "audio" as const, name: "C" },
    ];
    expect([...heard(tracks)]).toEqual(["b", "c"]);
    expect([...heard(tracks.map((t) => (t.id === "c" ? { ...t, solo: true } : t)))]).toEqual(["c"]);
  });
});

describe("the storyboard", () => {
  test("an edit with no board gets Hook, Story and End card", () => {
    expect(boardOf(edit()).sections.map((s) => [s.name, s.clipIds])).toEqual([
      ["Hook", ["a"]],
      ["Story", ["b", "c"]],
      ["End card", ["d"]],
    ]);
  });

  test("a shot moved on the board moves in the edit, and the first shot starts on a cut", () => {
    const e = moveShot(edit(), "c", "sb-hook", 0);
    expect(e.clips.map((c) => c.id)).toEqual(["c", "a", "b", "d"]);
    expect(e.clips[0]!.transition).toBe("cut");
    expect(boardOf(e).sections.map((s) => s.clipIds)).toEqual([["c", "a"], ["b"], ["d"]]);
  });

  test("a later place in its own section counts without the shot itself", () => {
    const e = moveShot(edit(), "b", "sb-story", 2);
    expect(boardOf(e).sections[1]!.clipIds).toEqual(["c", "b"]);
  });

  test("earlier and later cross into the next section", () => {
    const e = nudgeShot(edit(), "c", 1);
    expect(boardOf(e).sections.map((s) => s.clipIds)).toEqual([["a"], ["b"], ["c", "d"]]);
  });

  test("a shot moved elsewhere keeps the sections runs, in the edit's order", () => {
    const e = edit({
      board: { sections: boardOf(edit()).sections, notes: [] },
      clips: ["d", "a", "b", "c"].map(clip),
    });
    expect(boardOf(e).sections.map((s) => s.clipIds)).toEqual([[], [], ["d", "a", "b", "c"]]);
  });

  test("a section taken out gives its shots to the one before", () => {
    const e = removeSection(edit(), "sb-story");
    expect(boardOf(e).sections.map((s) => [s.name, s.clipIds])).toEqual([
      ["Hook", ["a", "b", "c"]],
      ["End card", ["d"]],
    ]);
  });
});

describe("the curve, the stopwatch and the text animators", () => {
  test("After Effects' influence and the curve's numbers are the same thing", () => {
    expect(fromInfluence(33, 33)).toEqual([0.33, 0, 0.67, 1]);
    expect(influence([0.33, 0, 0.67, 1])).toEqual({ out: 33, in: 33 });
    expect(easeNamed([0.16, 1, 0.3, 1])).toBe("soft-out");
    expect(easeNamed([0.2, 0, 0.6, 1])).toBeUndefined();
  });

  test("a curve that goes past its mark overshoots", () => {
    expect(overshoots([0.3, 1.4, 0.6, 1])).toBe(true);
    expect(overshoots([0.16, 1, 0.3, 1])).toBe(false);
  });

  test("a property with its stopwatch off has the layer's own value; keys win when it is on", () => {
    expect(valueAt(layer({ transform: { rotate: 12 } }), "rotate", 1)).toBe(12);
    expect(
      valueAt(layer({ transform: { rotate: 12 }, keys: [{ prop: "rotate", at: 0, value: 4 }] }), "rotate", 1),
    ).toBe(4);
    expect(valueAt(layer(), "scale", 1)).toBe(1);
  });

  test("letters, words and lines", () => {
    expect(unitsOf("Night ritual", "word")).toEqual(["Night ", "ritual"]);
    expect(unitsOf("ab", "letter")).toEqual(["a", "b"]);
    expect(unitsOf("one\ntwo", "line")).toEqual(["one", "two"]);
  });

  test("the typewriter puts a letter at a time, and every one is in at the end", () => {
    const l = layer({ text: "abcd", animate: animator("typewriter") });
    expect(unitsAt(l, 0)).toEqual([1, 1, 1, 1]);
    expect(unitsAt(l, 0.6)).toEqual([0, 0, 1, 1]);
    expect(unitsAt(l, 2)).toEqual([0, 0, 0, 0]);
  });

  test("the range picks which units move; the offset slides it", () => {
    const l = layer({ text: "abcd", animate: { ...animator("typewriter"), start: 50, end: 100 } });
    expect(unitsAt(l, 0)).toEqual([0, 0, 1, 1]);
    const shifted = layer({ text: "abcd", animate: { ...animator("typewriter"), start: 0, end: 50, offset: 50 } });
    expect(unitsAt(shifted, 0)).toEqual([0, 0, 1, 1]);
  });
});
