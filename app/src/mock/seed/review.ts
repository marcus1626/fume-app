// The customer's review: comments pinned on creatives and star ratings, both on a creative's current version; and the
// campaign record, what happened and who did it.
import type { RecordEvent, Rating, ReviewComment } from "../../contract";
import { at } from "./helpers";
import { creatives } from "./production";

/** The id of a creative's current version. */
const current = (creativeId: string) => creatives.find((c) => c.id === creativeId)?.current.id ?? creativeId;

export const reviewComments: ReviewComment[] = [
  {
    id: "rc-1",
    creativeId: "cr-a-v1",
    versionId: current("cr-a-v1"),
    by: "u-jonas",
    text: "Could the oil catch a little more light here?",
    pin: { x: 0.52, y: 0.58 },
    at: at(30),
    replies: [{ id: "rc-1r", by: "u-maja", text: "Agree, a touch warmer.", at: at(25) }],
  },
  {
    id: "rc-2",
    creativeId: "cr-a-v1",
    versionId: current("cr-a-v1"),
    by: "u-maja",
    text: "Love the stone. This is the autumn feeling.",
    at: at(28),
    replies: [],
  },
  {
    id: "rc-3",
    creativeId: "cr-a-v3",
    versionId: current("cr-a-v3"),
    by: "u-jonas",
    text: "Too much empty space on the right for paid social.",
    pin: { x: 0.8, y: 0.4 },
    at: at(20),
    replies: [],
  },
];

export const ratings: Rating[] = [
  { creativeId: "cr-a-v1", versionId: current("cr-a-v1"), by: "u-jonas", stars: 4, at: at(30) },
  { creativeId: "cr-a-v3", versionId: current("cr-a-v3"), by: "u-jonas", stars: 3, at: at(20) },
];

// ─── The campaign record ────────────────────────────────────────────────────

export const record: RecordEvent[] = [
  {
    id: "e1",
    workspaceId: "w-lysne",
    campaignId: "c-autumn",
    subjectId: "c-autumn",
    actor: { kind: "person", userId: "u-maja" },
    action: "brief_approved",
    detail: "Brief v2 approved",
    at: at(60 * 24 * 11),
  },
  {
    id: "e2",
    workspaceId: "w-lysne",
    campaignId: "c-autumn",
    subjectId: "d-a1",
    actor: { kind: "person", userId: "u-anna" },
    action: "checked",
    detail: "Three directions checked",
    at: at(60 * 24 * 7),
  },
  {
    id: "e3",
    workspaceId: "w-lysne",
    campaignId: "c-autumn",
    subjectId: "d-a1",
    actor: { kind: "person", userId: "u-maja" },
    action: "direction_chosen",
    detail: "Direction A, Evening stone, chosen",
    at: at(60 * 24 * 6),
  },
  {
    id: "e4",
    workspaceId: "w-lysne",
    campaignId: "c-autumn",
    subjectId: "cr-a-m1",
    actor: { kind: "person", userId: "u-anna" },
    action: "correction",
    detail: "Label corrected from 180 ml to 100 ml on Feed 1",
    at: at(60 * 24 * 4),
  },
  {
    id: "e5",
    workspaceId: "w-lysne",
    campaignId: "c-autumn",
    subjectId: "cr-a-m1",
    actor: { kind: "person", userId: "u-maja" },
    action: "changes_requested",
    detail: "Product lower in the frame on Feed 1 (round 1 of 2)",
    at: at(60 * 24 * 5),
  },
  {
    id: "e6",
    workspaceId: "w-lysne",
    campaignId: "c-autumn",
    subjectId: "cr-a-m1",
    actor: { kind: "person", userId: "u-maja" },
    action: "approved",
    detail: "Masters 1 and 2 approved",
    at: at(60 * 24 * 3),
  },
  {
    id: "e7",
    workspaceId: "w-lysne",
    campaignId: "c-autumn",
    subjectId: "run-autumn-v",
    actor: { kind: "engine" },
    action: "made",
    detail: "9 variants and formats made",
    at: at(90),
  },
  {
    id: "e8",
    workspaceId: "w-lysne",
    campaignId: "c-autumn",
    subjectId: "cr-a-v9",
    actor: { kind: "person", userId: "u-anna" },
    action: "held",
    detail: "One creative held back: glossy cap",
    at: at(12),
  },
  {
    id: "e9",
    workspaceId: "w-lysne",
    campaignId: "c-autumn",
    subjectId: "cr-a-v1",
    actor: { kind: "person", userId: "u-anna" },
    action: "checked",
    detail: "6 creatives checked",
    at: at(6),
  },
];
