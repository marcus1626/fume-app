// The plan's words (FLOWS §22): where a line comes from, the parts of the document in order, and the few sentences more
// than one place says. The customer sends her brief, Fume writes the plan, the expert checks it, she approves it; the
// Engine only makes creatives. Directions are concepts in words with reference pictures. A brand manager's words: "How
// it looks", "The 9 creatives"; every part's index entry is its heading; the expert and the agency read the brand's own
// lines about the customer by name ("Maja's Brand DNA"), never "your".
import type { IconName } from "@fume/ui";
import type { Campaign, CampaignPlan, PlanDirection, PlanSource, PlannedCreative } from "../../contract";
import * as copy from "../../copy";
import { date, due, now, time } from "../../lib/time";
import type { PlanViewer } from "./people";

/** A line's source as a small tag: its icon and its words ("Your Brand DNA"). A line from an approved campaign names
 *  that campaign when the line says which ("Autumn launch"). */
export const sourceIcon: Record<PlanSource, IconName> = {
  brief: "file-text",
  brand_dna: "palette",
  taste: "thumbs-up",
  moodboard: "layers",
  memory: "bookmark",
  product: "package",
  fume: "message-square",
  you: "pencil",
};

const sourceWords: Record<PlanSource, string> = {
  brief: "Your brief",
  brand_dna: "Your Brand DNA",
  taste: "Your taste",
  moodboard: "Your moodboard",
  memory: "Your past campaigns",
  product: "Product Truth",
  fume: "Fume",
  you: "Changed by you",
};

/** The same sources for a reader who is not the brand's customer (the expert, the agency, the agency's client). */
const neutralWords: Record<PlanSource, string> = {
  brief: "The brief",
  brand_dna: "Brand DNA",
  taste: "Taste",
  moodboard: "Moodboard",
  memory: "Past campaigns",
  product: "Product Truth",
  fume: "Fume",
  you: "Changed by the customer",
};

/** "Autumn launch" for a line that comes from that campaign (by id, or named in its own words), else the source's words.
 *  The customer reads "Your brief"; everyone else the plain source ("The brief", "Brand DNA"). */
export function sourceLabel(
  source: PlanSource,
  campaigns: Pick<Campaign, "id" | "name">[],
  opts?: { campaignId?: string; text?: string; staff?: boolean; viewer?: PlanViewer },
): string {
  if (source === "memory") {
    const byId = opts?.campaignId ? campaigns.find((c) => c.id === opts.campaignId) : undefined;
    const named = byId ?? campaigns.find((c) => opts?.text && opts.text.includes(c.name));
    if (named) return named.name;
  }
  const viewer = opts?.viewer ?? (opts?.staff ? "staff" : "customer");
  return viewer === "customer" ? sourceWords[source] : neutralWords[source];
}

/** The parts of the plan, in order: its index (in the summary aside) says each part's own heading. The ids stay as they
 *  were, so links to a part keep working. */
export function partsOf(plan?: CampaignPlan): { id: string; label: string }[] {
  const direction = plan ? chosenOf(plan) : undefined;
  const total = plan ? creativesOf(plan).all.length : 0;
  return [
    { id: "plan-brief", label: "The brief" },
    { id: "plan-direction", label: direction?.name ?? "The direction" },
    { id: "plan-variables", label: "How it looks" },
    { id: "plan-creatives", label: total ? `The ${total} creatives` : "The creatives" },
    { id: "plan-rules", label: "Rules" },
    { id: "plan-when", label: "When" },
  ];
}

/** @deprecated the labels without a plan; use partsOf(plan). */
export const PLAN_PARTS = partsOf();

/** The chosen direction (Fume's pick until she takes another). */
export const chosenOf = (plan: CampaignPlan): PlanDirection | undefined =>
  plan.directions.find((d) => d.id === plan.chosenDirectionId) ?? plan.directions[0];

/** The masters and what follows them, in the chosen direction. */
export function creativesOf(plan: CampaignPlan) {
  const all: PlannedCreative[] = chosenOf(plan)?.creatives ?? [];
  const masters = all.filter((c) => c.kind === "master");
  const variants = all.filter((c) => c.kind === "variant");
  return { all, masters, variants };
}

/** "9 creatives" and "3 masters, 6 variants and formats". */
export function countWords(plan: CampaignPlan): { total: string; split: string } {
  const { all, masters, variants } = creativesOf(plan);
  return {
    total: copy.creatives(all.length),
    split: [
      copy.count(masters.length, "master"),
      variants.length
        ? `${variants.length} ${variants.length === 1 ? "variant or format" : "variants and formats"}`
        : "",
    ]
      .filter(Boolean)
      .join(", "),
  };
}

/** "Feed 4:5" */
export const formatWord = (format: PlannedCreative["format"]) =>
  `${copy.format[format].label} ${copy.format[format].ratio}`;

/** A planned creative's one name, with its format: "Master 1 · Feed 4:5", "The candle alone · Feed 4:5". A name that
 *  already ends in its format word says it once: "Master 1 in Story" is "Master 1 · Story 9:16". */
export const plannedName = (c: Pick<PlannedCreative, "name" | "format">) => {
  const name = c.name.replace(new RegExp(` in ${copy.format[c.format].label}$`), "");
  return copy.creativeName({ title: name, format: c.format, planName: name });
};

const dayKey = (t: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo" }).format(t);

/** "today, 11:32", "yesterday", "on 13 Oct": when something happened, in the middle of a sentence. */
export function onDay(iso: string, withTime = true): string {
  const t = Date.parse(iso);
  const n = now();
  if (dayKey(t) === dayKey(n)) return withTime ? `today, ${time(iso)}` : "today";
  if (dayKey(t) === dayKey(n - 86_400_000)) return "yesterday";
  return `on ${date(iso)}`;
}

/** "13 Oct": the day a brief was sent, as the disclosure names it ("Your brief, sent 13 Oct"). */
export const sentOn = (iso: string) => date(iso);

/** "Thu 15 Oct", "tomorrow": a day ahead. */
export const byDay = (iso: string) => due(iso);

/** What the plan will hold, in one line: the waiting state says it while Fume writes and the expert checks. */
export function partsToCome(creatives: number): string {
  const masters = Math.max(1, Math.min(3, Math.ceil(creatives / 3)));
  const made =
    creatives > 0
      ? `the ${copy.creatives(creatives)}, ${copy.count(masters, "master")} first`
      : "every creative, the masters first";
  return `The brief in Fume’s words, the direction with its reference pictures, how every creative looks, ${made}, the rules and the dates.`;
}

/**
 * The plan's own sentences speak to the brand's customer ("You chose warm light", "your Brand DNA"). Read by the expert
 * or the agency, "you" is the customer, so they read her name: "Maja chose warm light", "Maja's Brand DNA". The
 * customer and the agency's client read them as written.
 */
export function voiceFor(viewer: PlanViewer, customer: string): (text: string) => string {
  if (viewer === "customer" || viewer === "client") return (text) => text;
  const name = customer || "the customer";
  const Name = name.charAt(0).toUpperCase() + name.slice(1);
  return (text) =>
    text
      // the brand's own things are the brand's, not hers: "the Brand DNA", "the moodboard", "the brief"
      .replace(
        /\b([Yy])our (Brand DNA|brief|(?:[\w’']+ ){0,2}moodboard|(?:[\w’']+ ){0,2}look|voice|liked pictures)\b/g,
        (_m, y: string, what: string) => `${y === "Y" ? "The" : "the"} ${what}`,
      )
      .replace(/\bYour\b/g, `${Name}’s`)
      .replace(/\byour\b/g, `${name}’s`)
      .replace(/\bYou\b/g, Name)
      .replace(/\byou\b/g, name);
}
