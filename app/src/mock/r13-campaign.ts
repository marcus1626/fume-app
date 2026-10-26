// The mock backend's round 13 calls for the campaign (Marcus's video comments, 22 Oct 2026; PROPOSED):
// - #21 the moodboard is a stage of its own and optional: "Skip the moodboard" is kept on the campaign.
// - #22 the brief's templates: Fume's own (Product launch, Seasonal, Black Friday, Always-on social, Email) and hers,
//   which Fume made from her past campaigns ("Like Autumn launch"; the Engine never talks to customers).
// - #24 three alternatives for the message or the whole brief, again with what she wants changed ("warmer", "shorter").
//   The mock writes them from the brief's own words and the products, so they read like hers.
// - #38 placements for every channel the calendar plans to: Facebook and TikTok beside Instagram, Meta ads, Pinterest.
import type { Brief, BriefTemplate, Campaign, FumeApi, Id, Placement, Product } from "../contract";
import { FumeError } from "../contract";

interface Db {
  campaigns: Campaign[];
  briefs: Brief[];
  products: Product[];
  placements: Placement[];
}

export interface R13CampaignContext {
  db: Db;
  wait: <T>(value: T) => Promise<T>;
  workspaceId: () => Id;
  mustApprove: () => void;
}

const safe = (top = 0, bottom = 0) => ({ top, bottom, left: 0, right: 0 });

/** #38: the placements the calendar's channels need besides those in seed4 (Facebook, TikTok). */
export function r13Db(db: Pick<Db, "placements">) {
  const more: Placement[] = [
    {
      id: "pl-fb-feed",
      name: "Facebook feed",
      group: "Facebook",
      ratio: "4:5",
      width: 1080,
      height: 1350,
      format: "feed",
      safe: safe(),
    },
    {
      id: "pl-fb-story",
      name: "Facebook story",
      group: "Facebook",
      ratio: "9:16",
      width: 1080,
      height: 1920,
      format: "story",
      safe: safe(0.14, 0.2),
    },
    {
      id: "pl-tt-post",
      name: "TikTok post",
      group: "TikTok",
      ratio: "9:16",
      width: 1080,
      height: 1920,
      format: "story",
      safe: safe(0.12, 0.25),
    },
  ];
  for (const p of more) if (!db.placements.some((x) => x.id === p.id)) db.placements.push(p);
}

/** Fume's own templates (#22). */
const FUME: BriefTemplate[] = [
  {
    id: "tpl-launch",
    kind: "fume",
    name: "Product launch",
    description: "A new product, introduced to people who already know the brand.",
    goal: "Launch the product and make it the one people ask for this season",
    audience: "Existing customers and people who follow the brand",
    message: "Something new for the hour before sleep",
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
    message: "One evening, wrapped",
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
    message: "The evening ritual, every day",
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
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Three angles for a message; a new round and her feedback move them. */
function messages(base: string, product: string, feedback: string, round: number): string[] {
  const f = feedback.toLowerCase();
  const short = /short|kort|fewer|brief/.test(f);
  const warm = /warm|varm|soft|myk/.test(f);
  const bold = /bold|strong|sterk|louder/.test(f);
  const pools = [
    [
      `${product}, for the hour before sleep`,
      "A slower evening, given",
      "The last quiet hour of the day",
      "Made to be felt, at night",
      "Give the evening back",
    ],
    [
      "The evening, wrapped",
      `${product}: a quiet gift`,
      "For someone who deserves the evening",
      "Light the evening",
      "Slow down. Then sleep",
    ],
    [
      "Warm light, a slower night",
      "The ritual after the day",
      `Keep ${product} by the bed`,
      "An evening worth giving",
      "Less day, more evening",
    ],
  ];
  // never her own words back as an alternative
  const out = pools
    .map((pool, i) => pool[(round + i) % pool.length])
    .map((m, i) => (trim(m) === trim(base) ? pools[i][(round + i + 1) % pools[i].length] : m));
  return out.map((m) => {
    let t = m;
    if (warm) {
      const w = t.replace(/^The /, "A warm ").replace(/quiet/, "warm");
      t =
        w !== t
          ? w
          : t.replace(
              /\b(the|an?) (evening|night|hour)\b/i,
              (_m, art: string, word: string) => `${/^an$/i.test(art) ? "a" : art} warm ${word}`,
            );
      if (t === m) t = `${t}, warmly`;
    }
    if (bold) t = t.replace(/^(A|The) /, "").replace(/^./, (c) => c.toUpperCase());
    if (short) t = t.split(/[,:]/)[0];
    return cap(trim(t));
  });
}

export function r13CampaignApi(
  ctx: R13CampaignContext,
): Pick<FumeApi, "skipMoodboard" | "briefTemplates" | "briefAlternatives"> {
  const { db, wait } = ctx;
  return {
    async skipMoodboard(campaignId) {
      ctx.mustApprove();
      const c = db.campaigns.find((x) => x.id === campaignId);
      if (!c) throw new FumeError("not_found", `No campaign ${campaignId}`);
      c.moodboardSkipped = true;
      return wait(c);
    },
    async briefTemplates() {
      // Hers: one for each campaign she finished or approved, made by the Engine from its brief (#22).
      const ws = ctx.workspaceId();
      const yours: BriefTemplate[] = db.campaigns
        .filter(
          (c) =>
            c.workspaceId === ws &&
            ["approved", "delivered", "closed", "in_review"].includes(c.state) &&
            !["brief", "plan"].includes(c.stage),
        )
        .map((c) => {
          const b = db.briefs.find((x) => x.campaignId === c.id);
          return b
            ? {
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
              }
            : undefined;
        })
        .filter((t): t is NonNullable<typeof t> => Boolean(t));
      return wait([...FUME, ...yours]);
    },
    async briefAlternatives({ part, goal, audience = "", message = "", productIds = [], feedback = "", round = 0 }) {
      const products = db.products.filter((p) => productIds.includes(p.id)).map((p) => p.name);
      const product = products[0] ?? "The product";
      const msgs = messages(message, product, feedback, round);
      if (part === "message") return wait(msgs.map((m) => ({ goal, audience, message: m })));
      // The whole brief: three angles on the same products (#24).
      const g = trim(goal) || `A campaign for ${product}`;
      const short = /short|kort/.test(feedback.toLowerCase());
      const briefs = [
        {
          goal: `${cap(g.replace(/^(a|an|the) /i, ""))}, told as the evening it gives`,
          audience: audience || "People who buy premium body care for themselves",
          message: msgs[0],
        },
        {
          goal: `${product} as a considered gift, in paid social`,
          audience: "People buying a considered gift for someone close",
          message: msgs[1],
        },
        {
          goal: `${product} close: its texture, its label, its light`,
          audience: audience || "People who already follow the brand",
          message: msgs[2],
        },
      ];
      return wait(short ? briefs.map((b) => ({ ...b, goal: b.goal.split(",")[0] })) : briefs);
    },
  };
}
