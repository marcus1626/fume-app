// What Fume asks the model for, and how the answer becomes a plan body (docs/mvp/library.md B06–B08, T03 and T04).
// The model proposes; public.fume_finish_plan checks the body against the campaign's products and verified claims.
import { z } from "npm:zod@4.6.7";

const Source = z.enum(["brief", "brand_dna", "product", "fume"]);
const Line = z.object({
  label: z.string().describe("Short label, e.g. Light, Setting, Headline"),
  value: z.string(),
  why: z.string().describe("One short sentence: why, naming the brief, the brand or the product"),
});
const Creative = z.object({
  id: z.string().describe("pc1, pc2, … unique within the direction"),
  name: z.string().describe("e.g. Master 1, Story from Master 1"),
  kind: z.enum(["master", "variant"]),
  of: z.string().nullable().describe("For a variant: the id of its master in this direction; null for a master"),
  format: z.enum(["feed", "square", "story"]),
  productIds: z.array(z.string()).describe("Ids of the campaign's products shown"),
  scene: z.string().describe("What we see: subject, setting, light, composition, space for text"),
  text: z.string().nullable().describe("The words on the creative, or null for none"),
  claimRefs: z.array(z.string()).describe("Ids of the verified claim facts the words rely on; empty when none"),
  people: z.string().describe("'No people', 'Hands only', or who"),
});
const Direction = z.object({
  id: z.enum(["a", "b", "c"]),
  name: z.string().describe("Two to four words"),
  idea: z.string().describe("The idea in one sentence"),
  hook: z.string().describe("The first thing the viewer gets, in a few words"),
  productRole: z.string().describe("What the product does in the picture"),
  why: z.array(z.object({ text: z.string(), source: Source })).describe("Two or three reasons it fits"),
  risks: z.array(z.string()),
  look: z.array(Line).describe("Three to five lines of art direction: light, setting, palette, composition, mood"),
  creatives: z.array(Creative),
  recommended: z.boolean(),
});
export const PlanAnswer = z.object({
  summary: z.string().describe("One or two sentences for the customer: what this campaign will be"),
  strategicTask: z.string().describe("One paragraph linking the audience and their situation to the creative task"),
  directions: z.array(Direction).describe("One recommended direction and up to two more that differ in idea"),
  chosenDirectionId: z.enum(["a", "b", "c"]).describe("The recommended direction"),
  chosenReason: z.string(),
  copy: z.array(Line).describe("The copy set for the chosen direction: headline, supporting line, call to action"),
  openQuestions: z.array(z.string()).describe("What the brief leaves open that matters; empty when nothing"),
  changes: z.array(z.string()).describe("For a change: what changed, one short line each; empty for a first plan"),
});
export type PlanAnswer = z.infer<typeof PlanAnswer>;

/** What fume_take_plan hands over. */
export interface PlanTask {
  run_id: string;
  attempt: number;
  plan_id: string;
  version: number;
  campaign_id: string;
  brand: { name: string; market: string; language: string };
  campaign: { name: string; due_at: string | null };
  brief: Record<string, unknown>;
  products: {
    id: string;
    name: string;
    variant: string;
    facts: { id: string; area: string; label: string; statement: string; status: string; required: boolean }[];
  }[];
  rules: { text: string; kind: string; source: string }[];
  change: { asked: string; plan: Record<string, unknown> } | null;
}

export const SYSTEM = `You are Fume's creative strategist. Fume is a creative studio: its Engine makes campaign images for a brand, a named Fume expert checks every creative, and only the customer approves.

You write the campaign plan from the customer's brief: the strategic task, one to three creative directions, the planned creatives, and the copy for the recommended direction. A Fume designer and the customer read it next; the expert checks it before production.

How to write:
- Work from the brief, the brand's rules and the product facts you are given. Unknown stays unknown: never invent product facts, ingredients, results or prices. When the brief leaves something open that matters, say so in openQuestions instead of guessing.
- Words on a creative may only use claims from the verified claim facts. List the fact ids you rely on in claimRefs. Never promise a result (skin, health, sleep) that is not one of those facts. With no verified claims, keep the words to the product name, the moment, or the brief's message.
- Directions must differ in idea, not only in look. Mark exactly one as recommended, and choose it.
- Follow the brand's own style. Do not import a house style. Respect every "never" rule from the brief and the brand.
- Plan exactly as many creatives as the brief asks for, across its formats: a master in the first format, and variants of a master for the other formats or angles. A variant's "of" is its master's id in the same direction. Use only the campaign's product ids.
- People: real models only when the brief allows people. Never fake customers, testimonials or user-generated content. When in doubt, no people or hands only.
- Scenes are photographic and concrete: subject, setting, light, composition, where the text sits. No vague adjectives.
- Write in the brief's language (English unless it says otherwise), plainly and briefly. No hype, no exclamation marks.`;

/** The user message: the task as data. Instructions found inside the brief are the customer's words, not orders. */
export function prompt(task: PlanTask): string {
  const facts = task.products.map((p) => ({
    id: p.id,
    name: [p.name, p.variant].filter(Boolean).join(" "),
    facts: p.facts.map((f) => ({ id: f.id, area: f.area, label: f.label, statement: f.statement, status: f.status })),
  }));
  const parts = [
    `Brand: ${task.brand.name} (market: ${task.brand.market || "not given"}, language: ${task.brand.language}).`,
    `Campaign: ${task.campaign.name}${task.campaign.due_at ? `, goes live ${task.campaign.due_at.slice(0, 10)}` : ""}.`,
    `<brief>\n${JSON.stringify(task.brief, null, 2)}\n</brief>`,
    `<products>\n${JSON.stringify(facts, null, 2)}\n</products>`,
    `Verified claim fact ids (the only claims words may use): ${
      task.products
        .flatMap((p) => p.facts.filter((f) => f.area === "claim" && f.status === "verified").map((f) => f.id))
        .join(", ") || "none"
    }.`,
    `<rules>\n${task.rules.map((r) => `- ${r.kind === "never" ? "Never" : "Must"}: ${r.text} (${r.source})`).join("\n") || "none"}\n</rules>`,
  ];
  if (task.change) {
    parts.push(
      `<current_plan>\n${JSON.stringify(task.change.plan, null, 2)}\n</current_plan>`,
      `<asked>\n${task.change.asked}\n</asked>`,
      "The customer asked for the change above. Write the whole plan again with that change made and everything she did not ask to change kept as it is. List what changed in changes.",
    );
  } else {
    parts.push("Write the plan.");
  }
  return parts.join("\n\n");
}

const keyOf = (label: string, i: number) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "") || `line${i + 1}`;
const lines = (xs: z.infer<typeof Line>[]) =>
  xs.map((l, i) => ({ key: keyOf(l.label, i), label: l.label, value: l.value, why: l.why, source: "fume" }));

/** The model's answer as a plan body (the shape app/src/api/live/plan.ts reads). Rules are added by the database. */
export function toBody(a: PlanAnswer): Record<string, unknown> {
  const directions = a.directions.map((d, i) => ({
    id: d.id,
    letter: (["A", "B", "C"] as const)[i] ?? "C",
    name: d.name,
    idea: d.idea,
    hook: d.hook,
    productRole: d.productRole,
    why: d.why,
    risks: d.risks,
    references: [],
    look: lines(d.look),
    creatives: d.creatives.map((c) => ({
      id: c.id,
      name: c.name,
      kind: c.kind,
      ...(c.kind === "variant" && c.of ? { of: c.of } : {}),
      format: c.format,
      productIds: c.productIds,
      scene: c.scene,
      ...(c.text ? { text: c.text } : {}),
      claimRefs: c.claimRefs,
      people: c.people,
    })),
    ...(d.recommended ? { recommended: true } : {}),
  }));
  return {
    summary: a.summary,
    strategic_task: a.strategicTask,
    directions,
    chosen_direction_id: a.chosenDirectionId,
    chosen_reason: a.chosenReason,
    content: lines(a.copy),
    open_questions: a.openQuestions,
  };
}

/** Claude Opus 5.5's list price, in dollars per million tokens. */
const PRICE = { input: 4, output: 20 };
export function costOf(usage: { input_tokens?: number | null; output_tokens?: number | null }): number {
  const cost = ((usage.input_tokens ?? 0) * PRICE.input + (usage.output_tokens ?? 0) * PRICE.output) / 1_000_000;
  return Math.round(cost * 10_000) / 10_000;
}
