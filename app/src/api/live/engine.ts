// The Engine's side of the Studio on the live backend (FLOWS §29): the prompt behind a version and its checks, a render
// that did not reach the image model, and people's Yes or No on the Engine's pictures.
//
// engine_prompts and engine_lessons are read by Fume's own people only (20261104150000_engine_studio.sql): for an
// agency's people and customers the reads come back empty, so `prompt` and `taught` are never sent to them.
import type { EnginePrompt, Id } from "../../contract";
import { command, rows, supabase } from "./supabase";

/** One prompt as the Engine kept it (supabase/functions/engine/handler.ts writes it through engine_prompted). */
export interface PromptRow {
  id: string;
  job_id: string;
  attempt_id: string;
  status: EnginePrompt["status"];
  reason: string | null;
  image_model: string;
  text: string | null;
  compile_package: {
    target?: { imageType?: string };
    concept?: { title?: string };
    manifest?: { id: string; requirement: string; kind?: string }[];
    notVisible?: string[];
  } | null;
  findings: Finding[] | null;
  attempts: { n: number; text: string; findings: Finding[]; decisions?: Decision[] }[] | null;
  llm_usd: number | string | null;
  created_at: string;
}
type Finding = { code: string; message: string; manifestItemId?: string };
type Decision = { key: string; kind: "coverage" | "conflict" | "not_visible"; itemId: string | null; passed: boolean };
const PROMPT =
  "id, job_id, attempt_id, status, reason, image_model, text, compile_package, findings, attempts, llm_usd, created_at";

/** The prompts of these jobs, oldest first; none for anyone but Fume's own people. */
export async function readPrompts(jobIds: Id[]): Promise<PromptRow[]> {
  if (!jobIds.length) return [];
  return rows<PromptRow>(supabase().from("engine_prompts").select(PROMPT).in("job_id", jobIds).order("created_at"));
}

const MODEL_NAMES: Record<string, string> = {
  "nano-banana-pro": "Nano Banana Pro",
  "nano-banana-2": "Nano Banana 2",
  "seedream-4": "Seedream 4",
  "gpt-image": "GPT Image",
  "qwen-image-3": "Qwen Image 3",
  "grok-imagine-2": "Grok Imagine 2",
  "flux-kontext": "FLUX Kontext",
};
export const modelName = (m: string) => MODEL_NAMES[m] ?? m;

const REASONS: Record<string, string> = {
  attempts_exhausted: "The prompt still worked against the brand's rules after three tries.",
  ambiguous: "The checks could not tell whether the prompt carries every rule, so a person decides.",
  no_grammar_for_target: "The Engine has no way yet to write for this kind of picture or this image model.",
};

// The checks by code before any model reads the prompt (lint.ts), each with the findings that fail it.
const CODE_CHECKS: { text: string; codes: string[] }[] = [
  { text: "No words for the picture to print", codes: ["text_request"] },
  { text: "No camera equipment named", codes: ["equipment_term"] },
  { text: "No file names", codes: ["file_name"] },
  { text: "No forbidden words", codes: ["forbidden_term"] },
  { text: "The locked parts unchanged", codes: ["locked_slot_changed"] },
  { text: "Every part of the prompt in place", codes: ["unknown_slot", "missing_slot", "empty_slot", "inert_syntax"] },
];

/** A prompt row as the Studio shows it: what it had to carry and what the checks said, from its last try. */
export function toEnginePrompt(p: PromptRow): EnginePrompt {
  const tries = p.attempts ?? [];
  const last = tries.at(-1);
  const findings = last?.findings ?? p.findings ?? [];
  const decisions = last?.decisions ?? [];
  const pkg = p.compile_package ?? {};
  const items: EnginePrompt["findings"] = (pkg.manifest ?? []).map((m) => {
    const f = findings.find((x) => x.manifestItemId === m.id);
    if (!f) return { item: m.requirement, verdict: "carried" };
    if (f.code === "manifest_ambiguous") return { item: m.requirement, verdict: "person", note: f.message };
    return { item: m.requirement, verdict: "against", note: f.message };
  });
  (pkg.notVisible ?? []).forEach((attribute, i) => {
    const d = decisions.find((x) => x.key === `not_visible:${i}`);
    const stated = d
      ? !d.passed
      : findings.some((x) => x.code === "not_visible_stated" && x.message.includes(attribute));
    items.push(
      stated
        ? { item: attribute, verdict: "against", note: "The prompt states what the product pictures cannot show." }
        : { item: attribute, verdict: "not_visible" },
    );
  });
  const imageType = pkg.target?.imageType?.replace(/_/g, " ");
  const method = [imageType && imageType[0]!.toUpperCase() + imageType.slice(1), pkg.concept?.title]
    .filter(Boolean)
    .join(" · ");
  return {
    status: p.status,
    ...(p.status !== "validated" && p.reason ? { reason: REASONS[p.reason] ?? p.reason } : {}),
    model: modelName(p.image_model),
    ...(method ? { method } : {}),
    ...(p.text ? { text: p.text } : {}),
    tries: tries.length,
    findings: items,
    codeChecks: last
      ? CODE_CHECKS.map((c) => ({ text: c.text, pass: !findings.some((f) => c.codes.includes(f.code)) }))
      : [],
    llmUsd: Number(p.llm_usd ?? 0),
  };
}

/** Why a render did not reach a picture, in one sentence for everyone on the desk. */
export function failureOf(error: string | null, prompt: EnginePrompt | undefined): string {
  if (prompt && prompt.status !== "validated") {
    const against = prompt.findings.filter((f) => f.verdict === "against").length;
    if (prompt.status === "escalated")
      return "The checks could not tell whether the prompt carries every rule; a person decides.";
    if (against)
      return `The prompt worked against ${against === 1 ? "1 rule" : `${against} rules`} after ${prompt.tries === 1 ? "one try" : `${prompt.tries} tries`}.`;
  }
  const first = (error ?? "").split(/(?<=[.!?])\s/)[0]?.trim();
  return first || "The Engine could not render it.";
}

/** The answers given on these pictures, the newest per picture. */
export async function readTaught(candidateIds: Id[]): Promise<Map<Id, "yes" | "no">> {
  if (!candidateIds.length) return new Map();
  const answers = await rows<{ source_candidate_id: string; verdict: "yes" | "no" }>(
    supabase()
      .from("engine_lessons")
      .select("source_candidate_id, verdict")
      .in("source_candidate_id", candidateIds)
      .not("verdict", "is", null)
      .order("updated_at"),
  );
  return new Map(answers.map((a) => [a.source_candidate_id, a.verdict]));
}

/** A person's Yes or No on one of the Engine's pictures (a Generation's id is its candidate's id). */
export async function teach(input: { generationId: Id; verdict: "yes" | "no"; why?: string }): Promise<void> {
  await command("teach_engine", {
    p_candidate_id: input.generationId,
    p_verdict: input.verdict,
    p_why: input.why ?? null,
  });
}
