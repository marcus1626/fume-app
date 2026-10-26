// A campaign's six stages, as people see them (FLOWS §26.2): Brief → Moodboard → Plan → Masters → Creatives → Delivery.
// The campaign's tabs, the stage dots in lists and the staff board's columns all read from here, so the order and the
// words are the same everywhere. The contract's stages map onto them: "directions" (the first concepts) and "masters"
// are Masters; "variants" (variants and formats) are Creatives.
import type { CampaignStage } from "../../contract";

export const STAGES = [
  { id: "brief", label: "Brief" },
  { id: "moodboard", label: "Moodboard" },
  { id: "plan", label: "Plan" },
  { id: "masters", label: "Masters" },
  { id: "creatives", label: "Creatives" },
  { id: "delivery", label: "Delivery" },
] as const;

export type Stage = (typeof STAGES)[number]["id"];

const FROM_CONTRACT: Record<string, Stage> = {
  brief: "brief",
  moodboard: "moodboard",
  plan: "plan",
  directions: "masters",
  masters: "masters",
  variants: "creatives",
  delivery: "delivery",
};

/** The stage a campaign is in, in the six people see. */
export function stageOf(c: { stage: CampaignStage | string }): Stage {
  return FROM_CONTRACT[c.stage] ?? "brief";
}

/** 0 for Brief … 5 for Delivery. */
export const stageIndex = (s: Stage) => STAGES.findIndex((x) => x.id === s);

export const stageLabel = (s: Stage) => STAGES[stageIndex(s)]?.label ?? s;
