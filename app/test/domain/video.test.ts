// The timeline's arithmetic and the Engine's checks on a video (app/src/domain/video.ts, FLOWS §27).
import { describe, expect, test } from "vitest";
import type { ShotTake, VideoClip, VideoEdit } from "../../src/contract";
import {
  MIN_SHOT,
  clipAt,
  clipLength,
  cutDown,
  editChecks,
  editLength,
  nearestBeat,
  pickedTake,
  placed,
  timecode,
} from "../../src/domain/video";

const take = (id: string, extra: Partial<ShotTake> = {}): ShotTake => ({
  id,
  number: 1,
  video: `/v/${id}.mp4`,
  poster: `/v/${id}.jpg`,
  seconds: 5,
  state: "ready",
  model: "Kling 3.0",
  cost: 0.42,
  findings: [],
  at: "2026-10-27T12:00:00.000Z",
  ...extra,
});
const clip = (id: string, cut: [number, number], extra: Partial<VideoClip> = {}): VideoClip => ({
  id,
  name: id,
  source: "engine",
  takes: [take(`tk-${id}`)],
  pickedTakeId: `tk-${id}`,
  in: cut[0],
  out: cut[1],
  speed: 1,
  transition: "cut",
  ...extra,
});
const edit = (clips: VideoClip[], extra: Partial<VideoEdit> = {}): VideoEdit => ({
  formatId: "vf-reels",
  formats: [{ id: "vf-reels", name: "Reels and TikTok", ratio: "9:16", seconds: 15, captions: true, state: "this" }],
  clips,
  motion: [],
  captions: [],
  sound: [{ id: "sd", kind: "music", name: "Late light", start: 0, end: 15, level: -6, licence: "Paid social" }],
  grade: "LYSNE warm",
  checks: [],
  edits: [],
  ...extra,
});

describe("the timeline", () => {
  const clips = [clip("a", [0.5, 4]), clip("b", [0, 4], { speed: 0.5 }), clip("c", [1, 4.5])];

  test("a shot runs its stretch of the take, slower at half speed", () => {
    expect(clipLength(clips[0]!)).toBe(3.5);
    expect(clipLength(clips[1]!)).toBe(8);
  });

  test("shots follow each other, and the edit is their sum", () => {
    expect(placed(clips).map((p) => [p.start, p.end])).toEqual([
      [0, 3.5],
      [3.5, 11.5],
      [11.5, 15],
    ]);
    expect(editLength(edit(clips))).toBe(15);
  });

  test("at a moment, the shot and the second of its take to show", () => {
    expect(clipAt(clips, 1)).toMatchObject({ index: 0, local: 1.5 });
    // Half speed: two seconds on the timeline are one second of the take
    expect(clipAt(clips, 5.5)).toMatchObject({ index: 1, local: 1 });
    expect(clipAt([], 2)).toBeUndefined();
  });

  test("the picked take, else the newest that is ready", () => {
    const c = clip("d", [0, 3], {
      pickedTakeId: undefined,
      takes: [take("t1"), take("t2"), take("t3", { state: "making" })],
    });
    expect(pickedTake(c)?.id).toBe("t2");
  });
});

describe("cutting down to a shorter format", () => {
  const clips = [clip("a", [0, 5]), clip("b", [0, 5]), clip("c", [0, 5])];

  test("every shot gives up the same share and keeps its middle", () => {
    const cut = cutDown(clips, 6);
    expect(editLength(edit(cut))).toBeCloseTo(6, 1);
    for (const c of cut) {
      expect(c.out - c.in).toBeCloseTo(2, 1);
      expect((c.in + c.out) / 2).toBeCloseTo(2.5, 1);
    }
  });

  test("no shot is cut shorter than reads as a shot", () => {
    for (const c of cutDown(clips, 1)) expect(c.out - c.in).toBeGreaterThanOrEqual(MIN_SHOT - 1e-9);
  });

  test("an edit already short enough comes back as it is", () => {
    expect(cutDown(clips, 20)).toBe(clips);
  });
});

describe("the music and the clock", () => {
  test("the nearest beat within reach, else none", () => {
    expect(nearestBeat([0, 0.75, 1.5, 2.25], 1.4)).toBe(1.5);
    expect(nearestBeat([0, 0.75, 1.5], 1.1)).toBeUndefined();
    expect(nearestBeat(undefined, 1)).toBeUndefined();
  });

  test("times as the timeline writes them", () => {
    expect(timecode(0)).toBe("0:00");
    expect(timecode(12.56, true)).toBe("0:12.5");
    expect(timecode(75)).toBe("1:15");
  });
});

describe("the Engine's checks before check", () => {
  const flawed = take("tk-drop", {
    findings: [{ from: 0, to: 3.4, kind: "physics", text: "Oil runs out of the base", state: "open" }],
  });

  test("a finding inside the stretch the edit uses is a flag at its moment", () => {
    const e = edit([clip("a", [0, 4]), clip("b", [0.5, 3.7], { takes: [flawed], pickedTakeId: "tk-drop" })]);
    const product = editChecks(e).find((c) => c.id === "ck-product")!;
    expect(product).toMatchObject({ state: "flag", at: 4 });
    expect(product.note).toContain("Shot 2");
  });

  test("a finding outside the used stretch, or accepted, passes", () => {
    const outside = edit([clip("b", [3.5, 5], { takes: [flawed], pickedTakeId: "tk-drop" })]);
    expect(editChecks(outside).find((c) => c.id === "ck-product")?.state).toBe("pass");
    const accepted = take("tk-ok", { findings: [{ ...flawed.findings[0]!, state: "accepted" }] });
    const ok = edit([clip("b", [0, 3], { takes: [accepted], pickedTakeId: "tk-ok" })]);
    expect(editChecks(ok).find((c) => c.id === "ck-product")?.state).toBe("pass");
  });

  test("a shot still being made, the wrong length and unlicensed music are flags", () => {
    const making = clip("m", [0, 5], { takes: [take("tk-m", { state: "making" })], pickedTakeId: undefined });
    const checks = editChecks(
      edit([clip("a", [0, 4]), making], {
        sound: [{ id: "s", kind: "music", name: "Song", start: 0, end: 9, level: 0 }],
      }),
    );
    expect(checks.find((c) => c.id === "ck-shots")).toMatchObject({ state: "flag", at: 4 });
    expect(checks.find((c) => c.id === "ck-length")).toMatchObject({ state: "flag", note: "The edit runs 9.0 s" });
    expect(checks.find((c) => c.id === "ck-music")?.state).toBe("flag");
  });

  test("every video is marked as made with AI", () => {
    expect(editChecks(edit([clip("a", [0, 15])])).find((c) => c.id === "ck-label")?.state).toBe("pass");
  });
});
