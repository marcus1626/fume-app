// The Engine's prompt machine (FLOWS: Engine; ported from the Fume Engine prototype, spec 01 §6). It turns approved
// facts into a prompt an image model reads, and checks that every rule and product fact is in it before anything is
// paid for. Pure logic: the model calls come in as functions, so every part is tested without a provider.

export const SLOT_KEYS = ["references", "product", "assignment", "people", "scene", "brand", "change", "keep", "constraints"] as const;
export type SlotKey = (typeof SLOT_KEYS)[number];

export type SlotDef = {
  key: SlotKey;
  order: number;
  filledBy: "locked" | "composer";
  required: boolean;
  purpose: string;
};

export type Grammar = { imageType: string; version: number; slots: SlotDef[] };

export type DialectRule = {
  id: string;
  text: string;
  status: "seeded" | "measured" | "retired";
  sourceUrl: string | null;
  /** Rules with the same choice are ways of saying one thing: the Engine uses one, picked from how each has done. */
  choice?: string;
};

/** How one image model is best instructed. */
export type Dialect = {
  imageModel: string;
  version: number;
  textForm: "prose";
  maxReferences: number;
  rules: DialectRule[];
};

export type ManifestKind =
  | "product_text_locked"
  | "reference_text_locked"
  | "product_invariant"
  | "product_colour"
  | "brand_rule_hard"
  | "brand_rule_soft"
  | "concept"
  | "lesson_enforced"
  | "format";

/** One thing the prompt must carry: checked by code (verbatim) or by a decision model (meaning). */
export type ManifestItem = {
  id: string;
  kind: ManifestKind;
  refId: string;
  required: boolean;
  check: "code" | "decision";
  requirement: string;
  expected?: string;
  suggestedSlot: SlotKey;
};

export type Concept = { id: string; title: string; sceneIdea: string; productRole: string; lookKey: string | null };
export type FormatSpec = { aspectRatio: string; resolution: string | null };
export type Target = { imageType: string; imageModel: string };

export type SlotText = { slotKey: string; text: string; sources: string[] };

export type FindingCode =
  | "unknown_slot"
  | "missing_slot"
  | "empty_slot"
  | "text_request"
  | "forbidden_term"
  | "equipment_term"
  | "inert_syntax"
  | "file_name"
  | "too_many_references"
  | "locked_slot_changed"
  | "not_visible_stated"
  | "manifest_unclaimed"
  | "manifest_not_expressed"
  | "manifest_ambiguous"
  | "conflict";

export type Finding = { code: FindingCode; message: string; slotKey?: string; manifestItemId?: string; probability?: number };

/** One paid call to a model, kept with its cost (also when it failed). */
export type ModelCall = {
  task: string;
  provider: string;
  model: string;
  latencyMs: number;
  costUsd: number | null;
  inputTokens?: number;
  outputTokens?: number;
};

/** What earlier work taught: lessons from people's verdicts, approved prompts, fragments that failed. */
export type Knowledge = {
  exemplars: { promptText: string }[];
  lessons: { id: string; statement: string; polarity: "do" | "avoid"; reason: string }[];
  badFragments: { text: string; reason: string }[];
};
export const NO_KNOWLEDGE: Knowledge = { exemplars: [], lessons: [], badFragments: [] };

export type BrandRule = {
  id: string;
  dimension: string;
  /** null: every look. */
  lookKey: string | null;
  statement: string;
  binding: "hard" | "soft";
  /** known: the brand said so; inferred: learned from pictures and verdicts. */
  epistemic: "known" | "inferred" | "uncertain";
  scope: "core" | "look" | "category";
};

export type BrandContext = { rules: BrandRule[]; forbiddenTerms: string[] };

export type ProductContext = {
  name: string;
  /** Approved description of the product, used word for word. */
  lockedProductText: string;
  /** Approved description of what each reference picture is for, used word for word. */
  lockedReferenceText: string;
  invariants: { id: string; statement: string }[];
  colours: { area: string; valueHex: string }[];
  /** What the pictures cannot show: never stated. */
  notVisible: string[];
  references: { url: string; role: string }[];
};

export type CompilePackage = {
  target: Target;
  grammar: Grammar;
  dialect: Dialect;
  manifest: ManifestItem[];
  brandRules: BrandRule[];
  lockedReferenceText: string;
  lockedProductText: string;
  concept: Concept;
  format: FormatSpec;
  forbiddenTerms: string[];
  notVisible: string[];
  references: { url: string; role: string }[];
  knowledge: Knowledge;
  /** A recipe's slots, used as they are. */
  fixedSlots?: SlotText[];
};

export type Composer = (input: {
  compilePackage: CompilePackage;
  previous: { slots: SlotText[]; findings: Finding[] } | null;
}) => Promise<{ slots: SlotText[]; call: ModelCall }>;

/** Answers yes/no questions about a text with a probability each; null when it could not answer one. */
export type Decider = (input: {
  text: string;
  questions: Record<string, string>;
}) => Promise<{ probabilities: Record<string, number | null>; call: ModelCall | null }>;

export type Verifier = (input: {
  prompt: string;
  requirement: string;
}) => Promise<{ expressed: boolean; probability: number; reason: string; call: ModelCall }>;
