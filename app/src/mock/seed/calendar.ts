// The meetings booked with Fume and LYSNE's content calendar: campaigns as windows from their go-live, drops and
// deliveries.
import type { CalendarEntry, Meeting } from "../../contract";
import { img, inDays } from "./helpers";

/** A day from the seed's moment, at an hour (UTC). */
export const day = (d: number, hour = 9) => {
  const t = new Date(inDays(d));
  t.setUTCHours(hour, 0, 0, 0);
  return t.toISOString();
};

export const meetings: Meeting[] = [
  {
    id: "mt-1",
    workspaceId: "w-lysne",
    topic: "Winter gifting: plan the launch",
    at: day(2, 12),
    minutes: 30,
    hostId: "u-sander",
    guestIds: ["u-maja"],
    state: "booked",
  },
];

export const calendar: CalendarEntry[] = [
  {
    id: "ce-1",
    workspaceId: "w-lysne",
    kind: "campaign",
    title: "Autumn launch",
    start: day(3),
    end: day(24),
    campaignId: "c-autumn",
    image: img("05-06", "square"),
  },
  {
    id: "ce-2",
    workspaceId: "w-lysne",
    kind: "campaign",
    title: "Winter gifting",
    start: day(20),
    end: day(55),
    campaignId: "c-winter",
    image: img("02-05", "square"),
  },
  { id: "ce-3", workspaceId: "w-lysne", kind: "drop", title: "Gift sets on lysne.no", start: day(21) },
  {
    id: "ce-4",
    workspaceId: "w-lysne",
    kind: "delivery",
    title: "Autumn masters delivered",
    start: day(-2),
    campaignId: "c-autumn",
  },
  // Black Friday runs Black Friday to Cyber Monday, 27–30 Nov 2026. A campaign's window starts on its go-live (the
  // campaign's dueAt): Autumn 17 Oct, Winter gifting 3 Nov, Black Friday 27 Nov.
  {
    id: "ce-9",
    workspaceId: "w-lysne",
    kind: "campaign",
    title: "Black Friday",
    start: day(44),
    end: day(47),
    campaignId: "c-bf",
    image: img("10-06", "square"),
  },
  {
    id: "ce-5",
    workspaceId: "w-lysne",
    kind: "post",
    title: "Feed 1",
    start: day(3, 18),
    placementId: "pl-ig-feed",
    creativeId: "cr-a-m1",
    campaignId: "c-autumn",
    image: img("05-06", "square"),
  },
  {
    id: "ce-6",
    workspaceId: "w-lysne",
    kind: "post",
    title: "Feed 2",
    start: day(4, 18),
    placementId: "pl-ig-story",
    creativeId: "cr-a-m2",
    campaignId: "c-autumn",
    image: img("08-02", "square"),
  },
  {
    id: "ce-7",
    workspaceId: "w-lysne",
    kind: "post",
    title: "Feed 1",
    start: day(5, 7),
    placementId: "pl-email",
    creativeId: "cr-a-m1",
    campaignId: "c-autumn",
    image: img("05-06", "square"),
  },
  {
    id: "ce-8",
    workspaceId: "w-lysne",
    kind: "meeting",
    title: "Winter gifting: plan the launch",
    start: day(2, 12),
    meetingId: "mt-1",
  },
];
