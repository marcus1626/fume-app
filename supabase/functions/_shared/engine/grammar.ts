// The fixed shape of a prompt per image type (the "deterministic schema"), and how each image model reads one.
import type { Dialect, Grammar, Target } from "./types.ts";

export const CAMPAIGN_STILL_V1: Grammar = {
  imageType: "campaign_still",
  version: 1,
  slots: [
    { key: "references", order: 1, filledBy: "locked", required: true, purpose: "What each reference picture is for and what must not be taken from it." },
    { key: "product", order: 2, filledBy: "locked", required: true, purpose: "The product exactly as it is: construction, materials, colours and proportions." },
    { key: "assignment", order: 3, filledBy: "composer", required: true, purpose: "What is being made, and that the brand rules that follow take precedence over the model's own defaults." },
    { key: "people", order: 4, filledBy: "composer", required: false, purpose: "Who is in the frame and how much of them, from the brand's people rules." },
    { key: "scene", order: 5, filledBy: "composer", required: true, purpose: "The concept's scene and the product's role in it." },
    { key: "brand", order: 6, filledBy: "composer", required: true, purpose: "Every applicable brand rule, written as visible effects." },
    { key: "constraints", order: 7, filledBy: "composer", required: true, purpose: "One sentence per hard brand rule and per product invariant." },
  ],
};

// The Engine bar on a picture already made: the image model changes that picture as the designer asks and keeps the
// rest. The scene and the look are the picture's own, so they are not written again (that makes a new picture).
export const PICTURE_EDIT_V1: Grammar = {
  imageType: "picture_edit",
  version: 1,
  slots: [
    { key: "references", order: 1, filledBy: "locked", required: true, purpose: "What each reference picture is for and what must not be taken from it." },
    { key: "product", order: 2, filledBy: "locked", required: true, purpose: "The product exactly as it is: construction, materials, colours and proportions." },
    { key: "assignment", order: 3, filledBy: "composer", required: true, purpose: "That this changes the first picture as asked, in its format, and keeps everything else in it." },
    { key: "change", order: 4, filledBy: "composer", required: true, purpose: "The designer's change, written as visible effects in the picture and nothing more." },
    { key: "keep", order: 5, filledBy: "composer", required: true, purpose: "What stays exactly as in the first picture: the composition, the scene, the objects, the product and its label." },
    { key: "constraints", order: 6, filledBy: "composer", required: true, purpose: "One sentence per hard brand rule and per product invariant." },
  ],
};

export const GRAMMARS: Grammar[] = [CAMPAIGN_STILL_V1, PICTURE_EDIT_V1];

// Seeded from Fume's research on these models (prototype docs/knowledge/image-models.md, 9 Oct 2026); each becomes
// "measured" once Fume's own verdicts support it.
const common = (prefix: string) => [
  { id: `${prefix}-prose`, text: "Write flowing prose, the way a photographer briefs a scene; no lists, weights or flags.", status: "seeded" as const, sourceUrl: null },
  { id: `${prefix}-first`, text: "Introduce the product photograph first: the first reference sets the base of the picture.", status: "seeded" as const, sourceUrl: null },
  { id: `${prefix}-ratio`, text: "The aspect ratio is a request field; never rely on a reference picture's shape.", status: "seeded" as const, sourceUrl: null },
  { id: `${prefix}-short-no`, text: "Keep exclusions few and plain: long lists of what to avoid trigger refusals.", status: "seeded" as const, sourceUrl: null },
  // Choices: two ways of writing the same prompt. The Engine tries both and moves to the one whose pictures do better
  // (learn.ts); the prompt graph counts them as dialect features.
  { id: `${prefix}-length-tight`, choice: "length", text: "Keep the prompt tight: about 120 to 180 words, every sentence about something the camera sees.", status: "seeded" as const, sourceUrl: null },
  { id: `${prefix}-length-full`, choice: "length", text: "Write a full photographer's brief of about 220 to 320 words: the scene, the light, the materials and the composition each in their own sentences.", status: "seeded" as const, sourceUrl: null },
  { id: `${prefix}-light-first`, choice: "light", text: "Describe the light right after the scene, before the props and the palette: the light carries the mood.", status: "seeded" as const, sourceUrl: null },
  { id: `${prefix}-light-late`, choice: "light", text: "Describe the scene and its objects first, then the light, then the palette.", status: "seeded" as const, sourceUrl: null },
];

export const DIALECTS: Dialect[] = [
  { imageModel: "nano-banana-pro", version: 1, textForm: "prose", maxReferences: 3, rules: [...common("nbp"),
    { id: "nbp-clothing", text: "Describe clothing plainly; words like sheer, fitted or clinging near the body are refused often.", status: "seeded", sourceUrl: null }] },
  { imageModel: "nano-banana-2", version: 1, textForm: "prose", maxReferences: 3, rules: common("nb2") },
  { imageModel: "seedream-4", version: 1, textForm: "prose", maxReferences: 3, rules: common("sd4") },
  // On Higgsfield's API (4 Nov 2026): the models the key may use for a product picture with references.
  { imageModel: "qwen-image-3", version: 1, textForm: "prose", maxReferences: 3, rules: common("qw3") },
  { imageModel: "grok-imagine-2", version: 1, textForm: "prose", maxReferences: 3, rules: common("gk2") },
  { imageModel: "gpt-image", version: 1, textForm: "prose", maxReferences: 3, rules: common("gpt") },
  { imageModel: "flux-kontext", version: 1, textForm: "prose", maxReferences: 1, rules: common("flx") },
];

export type MethodDecision =
  | { method: "compose"; grammar: Grammar; dialect: Dialect }
  | { method: "blocked"; code: "no_grammar_for_target"; message: string };

export function selectMethod(target: Target, grammars = GRAMMARS, dialects = DIALECTS): MethodDecision {
  const grammar = grammars.filter((g) => g.imageType === target.imageType).sort((a, b) => b.version - a.version)[0];
  if (!grammar) return { method: "blocked", code: "no_grammar_for_target", message: `No grammar for the image type ${target.imageType}.` };
  const dialect = dialects.filter((d) => d.imageModel === target.imageModel).sort((a, b) => b.version - a.version)[0];
  if (!dialect) return { method: "blocked", code: "no_grammar_for_target", message: `No dialect for the image model ${target.imageModel}.` };
  return { method: "compose", grammar, dialect };
}
