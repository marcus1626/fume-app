// Where a planned post goes out (round 13, Marcus's comment #38; PROPOSED 22 Oct 2026): the calendar's channels,
// Instagram, Facebook, Meta ads, TikTok and Pinterest, and Email and web for the rest. A channel the brand has not
// connected says so and has "Connect" beside it. The connections are the mock's, kept for the visit: Instagram and
// Meta ads are connected; connecting another one takes a click.
import { useSyncExternalStore } from "react";
import type { Placement } from "../../contract";

export interface PublishChannel {
  id: string;
  name: string;
  /** The placement groups that belong to it. */
  groups: string[];
  /** It publishes once connected; Email and web are handed over instead. */
  publishes: boolean;
}

export const CHANNELS: PublishChannel[] = [
  { id: "instagram", name: "Instagram", groups: ["Instagram"], publishes: true },
  { id: "facebook", name: "Facebook", groups: ["Facebook"], publishes: true },
  { id: "meta-ads", name: "Meta ads", groups: ["Meta ads"], publishes: true },
  { id: "tiktok", name: "TikTok", groups: ["TikTok"], publishes: true },
  { id: "pinterest", name: "Pinterest", groups: ["Pinterest"], publishes: true },
  { id: "other", name: "Email and web", groups: ["Email", "Web"], publishes: false },
];

/** The channel a placement belongs to (a group no channel names goes with Email and web). */
export const channelOf = (placement?: Pick<Placement, "group">) =>
  CHANNELS.find((c) => placement && c.groups.includes(placement.group)) ?? CHANNELS[CHANNELS.length - 1]!;

let connected: ReadonlySet<string> = new Set(["instagram", "meta-ads"]);
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Connect a channel (the mock: at once). */
export function connectChannel(id: string) {
  connected = new Set([...connected, id]);
  listeners.forEach((l) => l());
}

/** The channels the brand has connected. */
export const useConnected = () => useSyncExternalStore(subscribe, () => connected);
