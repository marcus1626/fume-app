// What Fume asks the model when a customer writes in the Fume chat (FLOWS §12, §21, §23), and how its answer becomes
// a message. The model proposes the words and what to show; fume_chat_answer decides what a card may point at and
// who takes over.
import { z } from "npm:zod@4.6.7";

export const ChatAnswer = z.object({
  reply: z.string().describe("Fume's answer to her, one to three short sentences"),
  show: z
    .enum(["nothing", "campaign", "plan", "product", "waiting", "month", "person"])
    .describe(
      "What to show under the answer: a campaign, its plan or a product (with its id), what waits on her, this month in numbers, or a person at Fume who takes over",
    ),
  id: z.string().nullable().describe("The id of the campaign or product shown, from the facts; null otherwise"),
  reason: z
    .string()
    .nullable()
    .describe("When a person takes over: why, in one sentence she reads ('Packages are handled by people at Fume.')"),
});
export type ChatAnswer = z.infer<typeof ChatAnswer>;

export interface ChatContext {
  message: { id: string; thread_id: string; workspace_id: string; text: string; at: string };
  answer: boolean;
  brand: { name: string; market: string; language: string } | null;
  customer: { name: string; role: string | null } | null;
  campaign_of_thread: string | null;
  talk: { from: "customer" | "fume" | "fume_person"; name: string | null; text: string; at: string }[];
  campaigns: {
    id: string;
    name: string;
    stage: string;
    state: string;
    due_at: string | null;
    brief_sent: boolean;
    plan: { version: number; state: string } | null;
    products: string[];
    creatives: { in_check: number; waiting_on_you: number; changes_asked: number; approved: number; delivered: number };
  }[];
  products: { id: string; name: string; confirmed: boolean; missing: string[] }[];
  people_at_fume: { name: string; title: string; role: string }[];
  brain?: Brain | null;
}

export type Card =
  | { kind: "link"; link: { kind: "campaign" | "plan"; campaignId: string } | { kind: "product"; productId: string } }
  | { kind: "summary"; of: "waiting" | "month" }
  | { kind: "handover"; reason: string };

export const SYSTEM = `You are Fume, the AI in the Fume app. Fume is a creative studio: its Engine makes campaign creatives for a brand, an expert at Fume checks every creative, and only the customer approves. You talk with a customer of the brand. You are AI and say so if asked; you never pretend to be a person.

How you answer:
- Use only the facts you are given about the brand, its campaigns, products and people. Never invent a date, a number, a price, a product fact or a promise. If the facts do not answer it, say what you do know, or hand over to a person.
- Short and plain: one to three sentences, like a calm expert on her side. No hype, no exclamation marks, no emoji. Answer in the language she writes in.
- Words: say "creative", never "file", "asset" or "image". The expert checks; only she approves. Never call unchecked work ready; creatives in check are only counted, she sees them once they are checked and sent.
- Never mention models, prompts, AI tools or the Engine's inner workings. The Engine never talks to her; you speak for Fume ("we").
- Stages: brief (she writes and sends it) → plan (Fume writes it, the expert checks it, she approves it; nothing is made before that) → masters → variants and formats → delivery.

What you show under the answer (field "show"):
- "campaign" or "plan" with the campaign's id when she asks about a campaign or its plan.
- "product" with the product's id when she asks about a product.
- "waiting" when she asks what waits on her; "month" when she asks about this month in numbers or her usage.
- "person" to hand over to a person at Fume, with a reason: contracts, the package, prices, invoices, billing, rights, a complaint or a creative she is unhappy with, a meeting, anything you cannot answer from the facts, or when she asks for a person. Keep "reply" to one sentence then; Fume names the person itself.
- "nothing" otherwise.

To start a new campaign she uses New campaign; the brief form takes her from there. You cannot change the brief, the plan or a creative from here: point her to it.`;

const day = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "Europe/Oslo",
      }).format(Date.parse(iso))
    : null;

/** What Fume knows about the brand (public.brain_context): confirmed, or only proposed. */
export interface Brain {
  identity?: unknown[];
  rules?: unknown[];
  taste?: unknown[];
  market?: unknown[];
  memory?: unknown[];
  /** What Fume measured in the pictures she kept, approved and turned down (taste-learn). */
  taste_profile?: {
    measured_pictures?: number;
    do?: unknown[];
    dont?: unknown[];
    reasons?: unknown[];
    palette?: unknown[];
  };
}

/** The Brand Brain as a part of the prompt; empty when Fume knows nothing more. */
export function brainPart(brain: Brain | null | undefined): string[] {
  if (!brain) return [];
  const known = Object.fromEntries(
    (["identity", "rules", "taste", "market", "memory"] as const).flatMap((k) =>
      brain[k]?.length ? [[k, brain[k]]] : [],
    ),
  );
  const profile = brain.taste_profile;
  const measured = (profile?.measured_pictures ?? 0) > 0 && (profile?.do?.length || profile?.dont?.length);
  if (Object.keys(known).length === 0 && !measured) return [];
  const parts = Object.keys(known).length
    ? [
        `<brand_brain>\n${JSON.stringify(known, null, 1)}\n</brand_brain>`,
        "The brand brain is what Fume knows about the brand: its identity, rules, taste, market, and what it approved or asked to change before (memory). An item with confirmed false is only proposed: a hint, never a fact, and never a claim. Learn from the memory: do not repeat what she asked to change.",
      ]
    : [];
  if (measured)
    parts.push(
      `<taste_profile>\n${JSON.stringify(profile, null, 1)}\n</taste_profile>`,
      "The taste profile is measured in the pictures she kept, approved and turned down: each do and don't has a target (in its unit), a range, a confidence from 0 to 1, and how many pictures it rests on. from says what the pictures were (packshots count for less than scenes). Lean on what is confident (0.5 and up), treat the rest as a hint, and say the look in words a photographer would use; reasons are her own words about what she did not like.",
    );
  return parts;
}

export function prompt(ctx: ChatContext): string {
  const facts = {
    brand: ctx.brand,
    today: day(ctx.message.at),
    she_is: ctx.customer,
    people_at_fume: ctx.people_at_fume,
    campaigns: ctx.campaigns.map((c) => ({ ...c, due: day(c.due_at), due_at: undefined })),
    products: ctx.products,
    this_message_is_about_campaign: ctx.campaign_of_thread,
  };
  const talk = ctx.talk
    .map(
      (t) =>
        `${t.from === "customer" ? "She" : t.from === "fume" ? "Fume" : `${t.name ?? "A person"} at Fume`}: ${t.text}`,
    )
    .join("\n");
  return [
    `<facts>\n${JSON.stringify(facts, null, 1)}\n</facts>`,
    ...brainPart(ctx.brain),
    `<talk_so_far>\n${talk || "(nothing yet)"}\n</talk_so_far>`,
    `<her_message>\n${ctx.message.text || "(she sent a file)"}\n</her_message>`,
  ].join("\n\n");
}

/** The card for the answer, only when it points at something in the facts. */
export function toCard(a: ChatAnswer, ctx: ChatContext): Card | null {
  switch (a.show) {
    case "campaign":
    case "plan":
      return a.id && ctx.campaigns.some((c) => c.id === a.id)
        ? { kind: "link", link: { kind: a.show, campaignId: a.id } }
        : null;
    case "product":
      return a.id && ctx.products.some((p) => p.id === a.id)
        ? { kind: "link", link: { kind: "product", productId: a.id } }
        : null;
    case "waiting":
    case "month":
      return { kind: "summary", of: a.show };
    case "person":
      return { kind: "handover", reason: a.reason?.trim() || "This is one for a person at Fume." };
    default:
      return null;
  }
}
