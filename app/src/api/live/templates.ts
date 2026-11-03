// The briefs a customer can start from (Brief › Start from): Fume's own templates, in words that fit any brand, and
// hers, one from each campaign that went past its plan.
import type { BriefTemplate, Campaign } from "../../contract";
import { readBriefs } from "./campaigns";

/** Fume's own templates. The message is a starting line she or Fume rewrites for the brand. */
export const FUME_BRIEF_TEMPLATES: BriefTemplate[] = [
  {
    id: "tpl-launch",
    kind: "fume",
    name: "Product launch",
    description: "A new product, introduced to people who already know the brand.",
    goal: "Launch the product and make it the one people ask for this season",
    audience: "Existing customers and people who follow the brand",
    message: "Something new, worth asking for",
    channels: ["paid_social", "organic_social", "product_page"],
    formats: ["feed", "story", "square"],
    creatives: 12,
    mandatory: ["The product, label front and centred"],
    never: ["Before-and-after pictures"],
  },
  {
    id: "tpl-seasonal",
    kind: "fume",
    name: "Seasonal",
    description: "A season's mood around the products that suit it.",
    goal: "Show the products in this season's light, on social",
    audience: "People who buy for themselves when the season turns",
    message: "The season, slowed down",
    channels: ["organic_social", "paid_social"],
    formats: ["feed", "story"],
    creatives: 8,
  },
  {
    id: "tpl-bf",
    kind: "fume",
    name: "Black Friday",
    description: "One clear offer for one week, readable at a glance.",
    goal: "Black Friday: one offer for one week, in paid social and email",
    audience: "Existing customers and people who saved our posts",
    message: "One clear offer, for one week",
    channels: ["paid_social", "email"],
    formats: ["feed", "story", "square"],
    creatives: 9,
    mandatory: ["The offer readable at a glance"],
    never: ["Countdown clocks", "Red discount stickers"],
  },
  {
    id: "tpl-always",
    kind: "fume",
    name: "Always-on social",
    description: "A steady month of posts that keep the brand in view.",
    goal: "A month of organic posts that keep the brand in view",
    audience: "People who follow the brand",
    message: "The brand, every day",
    channels: ["organic_social"],
    formats: ["feed", "story"],
    creatives: 12,
  },
  {
    id: "tpl-email",
    kind: "fume",
    name: "Email",
    description: "Headers and pictures for one newsletter.",
    goal: "Pictures for this month's newsletter",
    audience: "Newsletter subscribers",
    message: "What is new this month",
    channels: ["email"],
    formats: ["square", "feed"],
    creatives: 4,
  },
];

const trim = (s: string) => s.replace(/[.\s]+$/, "").trim();

/** Her own templates: one from each campaign past its plan, with its audience, channels, formats and rules. */
export async function yourBriefTemplates(campaigns: Campaign[]): Promise<BriefTemplate[]> {
  const past = campaigns.filter((c) => c.stage !== "brief" && c.stage !== "plan");
  const briefs = await readBriefs(past.map((c) => c.id));
  return past.flatMap((c) => {
    const b = briefs.get(c.id);
    if (!b || !b.objective.trim()) return [];
    return [
      {
        id: `tpl-${c.id}`,
        kind: "yours" as const,
        name: `Like ${c.name}`,
        description: `Fume made it from ${c.name}: its audience, channels, formats and rules.`,
        goal: trim(b.objective),
        audience: trim(b.audience),
        message: trim(b.message),
        channels: b.channels,
        formats: b.formats,
        creatives: b.creatives,
        mandatory: b.mandatory,
        never: b.never,
        campaignId: c.id,
      },
    ];
  });
}
