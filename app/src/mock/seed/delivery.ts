// What LYSNE has had delivered: the creatives, their rights and the size of the download.
import type { Delivery } from "../../contract";
import { at } from "./helpers";
import { creatives } from "./production";

export const deliveries: Delivery[] = [
  {
    id: "dl-summer",
    campaignId: "c-summer",
    scope: "campaign",
    name: "Summer evenings · Direction A",
    creativeIds: creatives.filter((c) => c.campaignId === "c-summer").map((c) => c.id),
    state: "confirmed_live",
    rightsNote:
      "For LYSNE's paid and organic channels in the Nordics, no end date. No real people appear in these creatives.",
    bytes: 38_400_000,
    createdAt: at(60 * 24 * 18),
    formats: ["feed", "story"],
  },
  {
    id: "dl-autumn-m",
    campaignId: "c-autumn",
    scope: "campaign",
    name: "Autumn launch · Masters",
    creativeIds: ["cr-a-m1", "cr-a-m2"],
    state: "ready",
    rightsNote:
      "For LYSNE's paid and organic channels in the Nordics, no end date. No real people appear in these creatives.",
    bytes: 9_600_000,
    createdAt: at(60 * 24 * 2),
    formats: ["feed"],
  },
];
