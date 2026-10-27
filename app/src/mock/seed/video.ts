// Video in the Studio (FLOWS §27): LYSNE's "Night ritual", a 15 s Reel for the Autumn launch. Four shots: LYSNE's own
// footage of light on stone, then three the Engine made with Kling 3.0 from the 9 Oct masters (real takes, in
// app/public/demo/lysne/video/). The drop's first take has oil running out of the bottle's base while the cap is on;
// the Engine flagged it and Anna asked for a second take that turns the bottle in the light instead.
import type { BrandFootage, CreativeDocument, VideoClip, VideoEdit, VideoFormat } from "../../contract";
import { editChecks } from "../../domain/video";
import { at, poster, shot } from "./helpers";
import { defaults } from "./studioModes";

const ready = (
  id: string,
  n: number,
  name: string,
  minutesAgo: number,
  extra: Partial<VideoClip["takes"][0]> = {},
) => ({
  id,
  number: n,
  video: shot(name),
  poster: poster(name),
  seconds: 5,
  state: "ready" as const,
  model: "Kling 3.0",
  cost: 0.42,
  findings: [],
  at: at(minutesAgo),
  ...extra,
});

const clips: VideoClip[] = [
  {
    id: "vc-light",
    name: "Light on stone",
    source: "library",
    takes: [{ ...ready("tk-light", 1, "light", 60 * 24 * 3), model: "LYSNE footage", cost: 0 }],
    pickedTakeId: "tk-light",
    in: 0.5,
    out: 4,
    speed: 1,
    transition: "cut",
  },
  {
    id: "vc-hands",
    name: "Hands in the light",
    source: "engine",
    recipe: {
      startImage: poster("hands"),
      move: "still",
      amount: 10,
      action: "Two hands move slowly through the window light, as if catching the last sun",
      seconds: 5,
      model: "auto",
    },
    takes: [ready("tk-hands-1", 1, "hands", 52)],
    pickedTakeId: "tk-hands-1",
    in: 0.4,
    out: 4.2,
    speed: 1,
    transition: "dissolve",
  },
  {
    id: "vc-drop",
    name: "The bottle in the hand",
    source: "engine",
    recipe: {
      startImage: poster("drop"),
      move: "push",
      amount: 20,
      action: "The hand turns the closed bottle in the low sun so the label faces the camera. No drops.",
      seconds: 5,
      model: "auto",
    },
    takes: [
      ready("tk-drop-1", 1, "drop", 48, {
        findings: [
          {
            from: 0,
            to: 3.4,
            kind: "physics",
            text: "Oil runs out of the bottle’s base while the cap is on",
            state: "open",
          },
        ],
      }),
      ready("tk-drop-2", 2, "turn", 12, {
        findings: [
          { from: 0, to: 1.2, kind: "physics", text: "Drops from the start frame run off the base", state: "open" },
        ],
        best: { in: 1.4, out: 4.6 },
      }),
    ],
    pickedTakeId: "tk-drop-1",
    in: 0.5,
    out: 3.7,
    speed: 1,
    transition: "dissolve",
    productId: "pr-oil",
  },
  {
    id: "vc-bottle",
    name: "Night Body Oil",
    source: "engine",
    recipe: {
      startImage: poster("bottle"),
      move: "push",
      amount: 15,
      action: "A slow push in on the bottle on travertine; the low sun moves across the stone",
      seconds: 5,
      model: "auto",
    },
    takes: [ready("tk-bottle-1", 1, "bottle", 40)],
    pickedTakeId: "tk-bottle-1",
    in: 0.3,
    out: 4.8,
    speed: 1,
    transition: "focus",
    productId: "pr-oil",
  },
];

export const videoFormats = (thisOne = "vf-reels"): VideoFormat[] =>
  [
    {
      id: "vf-reels",
      name: "Reels and TikTok",
      ratio: "9:16" as const,
      seconds: 15,
      captions: true,
      placementId: "pl-ig-reels",
    },
    { id: "vf-feed", name: "Feed", ratio: "4:5" as const, seconds: 15, captions: true, placementId: "pl-ig-feed" },
    { id: "vf-story", name: "Story", ratio: "9:16" as const, seconds: 6, captions: true, placementId: "pl-ig-story" },
    { id: "vf-ads", name: "Ads", ratio: "1:1" as const, seconds: 6, captions: true, placementId: "pl-ig-square" },
  ].map((f) => ({ ...f, state: f.id === thisOne ? ("this" as const) : ("planned" as const) }));

/** Beats of "Late light" at 80 beats a minute. */
const beats = Array.from({ length: 21 }, (_, i) => Math.round(i * 0.75 * 100) / 100);

const edit: Omit<VideoEdit, "checks"> = {
  formatId: "vf-reels",
  formats: videoFormats(),
  clips,
  motion: [
    { id: "mo-title", template: "title", text: "Night ritual", start: 0.8, end: 3.3, enter: "soft", place: "centre" },
    {
      id: "mo-product",
      template: "product",
      text: "Night Body Oil · 100 ml",
      start: 11.2,
      end: 13.4,
      enter: "rise",
      place: "top",
    },
    { id: "mo-end", template: "end", text: "LYSNE", start: 13.4, end: 15, enter: "soft", place: "centre" },
  ],
  captions: [
    { id: "cp-1", text: "The last light", start: 3.7, end: 5.6, by: "engine" },
    { id: "cp-2", text: "of the day", start: 5.6, end: 7.2, by: "engine" },
    { id: "cp-3", text: "kept for the night", start: 7.6, end: 10.3, by: "engine" },
  ],
  sound: [
    {
      id: "sd-music",
      kind: "music",
      name: "Late light · slow piano",
      start: 0,
      end: 15,
      level: -6,
      licence: "Licensed for paid social",
      beats,
    },
    { id: "sd-glass", kind: "effect", name: "Glass on stone", start: 10.6, end: 11.4, level: -14 },
  ],
  grade: "LYSNE warm",
  edits: [],
};

export const videoDocuments: CreativeDocument[] = [
  {
    id: "doc-night-ritual",
    workspaceId: "w-lysne",
    campaignId: "c-autumn",
    title: "Night ritual",
    slot: "Film 1 · Reels",
    studio: "video",
    modeId: "m-video-film",
    variables: defaults("m-video-film"),
    specs: {
      format: "story",
      count: 1,
      imageModel: "Kling 3.0",
      referenceIds: [],
      modelIds: [],
      productId: "pr-oil",
      variantId: "va-oil-100",
      placementId: "pl-ig-reels",
    },
    overrides: [],
    layers: [],
    // The edit's first frame stands for it where the app shows a picture (Studio, Check).
    versions: [
      {
        id: "rv-night-1",
        number: 1,
        image: poster("bottle"),
        at: at(12),
        by: "u-anna",
        state: "done",
        variables: defaults("m-video-film"),
        specs: {
          format: "story",
          count: 1,
          imageModel: "Kling 3.0",
          referenceIds: [],
          modelIds: [],
          productId: "pr-oil",
        },
        evaluation: { productTruth: "pass", brandRules: "pass", artefacts: "minor", notes: [] },
        instruction: "The Engine's first cut, from the plan's film",
        cost: 1.68,
      },
    ],
    pickedVersionId: "rv-night-1",
    edits: [],
    video: { ...edit, checks: editChecks({ ...edit, checks: [] }) },
    state: "draft",
    by: "u-anna",
    updatedAt: at(10),
  },
];

/** LYSNE's own footage in its library: light moving on travertine, shot by LYSNE. */
export const footage: BrandFootage[] = [
  {
    id: "ft-light",
    workspaceId: "w-lysne",
    name: "Light on stone",
    video: shot("light"),
    poster: poster("light"),
    seconds: 5,
    ratio: "9:16",
  },
];
