// What Fume asks the model for when she wants alternatives for the message or the whole brief (the brief form's
// "Alternatives", docs/mvp/library.md B05), and how its answer is checked.
import { z } from "npm:zod@4.6.7";

export const BriefAnswer = z.object({
  alternatives: z
    .array(
      z.object({
        goal: z.string().describe("What the campaign should achieve, one sentence"),
        audience: z.string().describe("Who it is for, concretely"),
        message: z.string().describe("The one thing to remember, a short line"),
      }),
    )
    .describe("Exactly three alternatives that differ in idea"),
});
export type BriefAnswer = z.infer<typeof BriefAnswer>;

export interface BriefAsk {
  workspaceId: string;
  part: "message" | "brief";
  goal: string;
  audience?: string;
  message?: string;
  productIds?: string[];
  feedback?: string;
  round?: number;
}

export interface BriefContext {
  brand: { name: string; market: string; language: string } | null;
  products: {
    id: string;
    name: string;
    variant: string;
    facts: { area: string; label: string; statement: string; status: string }[];
  }[];
  rules: { text: string; kind: string; area: string }[];
}

export const SYSTEM = `You are Fume's creative strategist. A customer is writing a campaign brief for Fume, a creative studio whose expert checks every creative before the customer approves it. Suggest alternatives she can pick from.

- Start from her words. Keep what she wrote that is good; offer three different ideas, not three wordings of one.
- Use only what you are given about the brand and the products. Never invent product facts, results, ingredients or prices.
- A message may use a product claim only when it is a verified claim fact, word for word or nearly. Never promise a result (skin, health, sleep) that is not one.
- Respect every rule of the brand.
- Write in the brand's language (English unless it says otherwise), plainly and briefly. No hype, no exclamation marks.`;

export function prompt(ask: BriefAsk, ctx: BriefContext): string {
  const parts = [
    `Brand: ${ctx.brand?.name ?? "unknown"} (market: ${ctx.brand?.market || "not given"}, language: ${ctx.brand?.language ?? "en"}).`,
    `<products>\n${JSON.stringify(
      ctx.products.map((p) => ({ name: [p.name, p.variant].filter(Boolean).join(" "), facts: p.facts })),
      null,
      2,
    )}\n</products>`,
    `<rules>\n${ctx.rules.map((r) => `- ${r.kind === "hard_constraint" ? "Never break" : "Follow"}: ${r.text} (${r.area})`).join("\n") || "none"}\n</rules>`,
    `<her_brief>\nGoal: ${ask.goal || "(empty)"}\nAudience: ${ask.audience || "(empty)"}\nMessage: ${ask.message || "(empty)"}\n</her_brief>`,
  ];
  if (ask.feedback) parts.push(`<what_she_wants_changed>\n${ask.feedback}\n</what_she_wants_changed>`);
  parts.push(
    ask.part === "message"
      ? "Give three alternatives for the message only. Keep her goal and audience exactly as they are in each."
      : "Give three alternatives for the whole brief: goal, audience and message.",
  );
  if ((ask.round ?? 0) > 0) parts.push("She has seen alternatives already; make these clearly new.");
  return parts.join("\n\n");
}

/** Three alternatives, the goal and audience kept when only the message was asked for. */
export function toAlternatives(ask: BriefAsk, a: BriefAnswer): { goal: string; audience: string; message: string }[] {
  return a.alternatives
    .slice(0, 3)
    .map((x) =>
      ask.part === "message"
        ? { goal: ask.goal, audience: ask.audience ?? "", message: x.message.trim() }
        : { goal: x.goal.trim(), audience: x.audience.trim(), message: x.message.trim() },
    );
}
