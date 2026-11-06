// Checks by meaning: a decision model answers, for every rule and fact, whether the prompt carries it, works
// against it, or says what the product does not show. Unclear answers go to a second model, then to a person.
import type { Assembly } from "./assemble.ts";
import type { CompilePackage, Decider, Finding, ManifestItem, ModelCall, Verifier } from "./types.ts";

export type Thresholds = { pass: number; fail: number; conflict: number; notVisible: number };
export const DEFAULT_THRESHOLDS: Thresholds = { pass: 0.8, fail: 0.5, conflict: 0.5, notVisible: 0.5 };

export type CoverageDecision = {
  key: string;
  kind: "coverage" | "conflict" | "not_visible";
  itemId: string | null;
  via: "code" | "decision" | "verifier";
  probability: number | null;
  passed: boolean;
};

const coverageQuestion = (item: ManifestItem) =>
  `Does this image prompt clearly express the following requirement? Requirement: ${item.requirement}`;
const conflictQuestion = (item: ManifestItem) =>
  `Does anything in this image prompt contradict or work against the following requirement? Requirement: ${item.requirement}`;
const notVisibleQuestion = (attribute: string) =>
  `Does this image prompt state or describe anything about the following, which must not be mentioned at all? ${attribute}`;

export async function checkCoverage(
  assembly: Assembly,
  pkg: CompilePackage,
  deps: { decide: Decider; verify: Verifier },
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): Promise<{ findings: Finding[]; decisions: CoverageDecision[]; calls: ModelCall[]; ambiguous: boolean }> {
  const findings: Finding[] = [];
  const decisions: CoverageDecision[] = [];
  const calls: ModelCall[] = [];
  let ambiguous = false;
  const text = assembly.text;

  const claimed = new Set(assembly.slots.flatMap((s) => s.sources));
  for (const item of pkg.manifest) {
    if (item.required && item.kind !== "format" && !claimed.has(item.id)) {
      findings.push({ code: "manifest_unclaimed", manifestItemId: item.id,
        message: `no slot claims manifest item ${item.id} (${item.requirement})` });
    }
  }

  const decisionItems: ManifestItem[] = [];
  for (const item of pkg.manifest) {
    if (item.kind === "format") continue;
    if (item.check === "code") {
      const expected = item.expected ?? "";
      const present = item.kind === "product_colour"
        ? text.toLowerCase().includes(expected.toLowerCase())
        : text.includes(expected);
      if (present) {
        decisions.push({ key: `code:${item.id}`, kind: "coverage", itemId: item.id, via: "code", probability: null, passed: true });
        continue;
      }
      if (item.kind === "product_colour") { decisionItems.push(item); continue; }
      decisions.push({ key: `code:${item.id}`, kind: "coverage", itemId: item.id, via: "code", probability: null, passed: false });
      findings.push({ code: "manifest_not_expressed", manifestItemId: item.id, message: `${item.id} is not present verbatim` });
      continue;
    }
    decisionItems.push(item);
  }

  const conflictItems = pkg.manifest.filter((i) => i.kind === "brand_rule_hard" || i.kind === "product_invariant");
  const questions: Record<string, string> = {};
  for (const item of decisionItems) questions[`coverage:${item.id}`] = coverageQuestion(item);
  for (const item of conflictItems) questions[`conflict:${item.id}`] = conflictQuestion(item);
  pkg.notVisible.forEach((attr, i) => { questions[`not_visible:${i}`] = notVisibleQuestion(attr); });

  // A failed decision call propagates: the step records the provider or routing error (§13).
  let probabilities: Record<string, number | null> = {};
  if (Object.keys(questions).length > 0) {
    const result = await deps.decide({ text, questions });
    probabilities = result.probabilities;
    if (result.call) calls.push(result.call);
  }
  const p = (key: string): number | null => (typeof probabilities[key] === "number" ? probabilities[key]! : null);

  for (const item of decisionItems) {
    const key = `coverage:${item.id}`;
    const prob = p(key);
    if (prob !== null && prob >= thresholds.pass) {
      decisions.push({ key, kind: "coverage", itemId: item.id, via: "decision", probability: prob, passed: true });
      continue;
    }
    if (prob !== null && prob < thresholds.fail) {
      decisions.push({ key, kind: "coverage", itemId: item.id, via: "decision", probability: prob, passed: false });
      if (item.required) {
        findings.push({ code: "manifest_not_expressed", manifestItemId: item.id, probability: prob,
          message: `the prompt does not express: ${item.requirement}` });
      }
      continue;
    }
    if (!item.required) {
      decisions.push({ key, kind: "coverage", itemId: item.id, via: "decision", probability: prob, passed: false });
      continue;
    }
    try {
      const v = await deps.verify({ prompt: text, requirement: item.requirement });
      calls.push(v.call);
      const passed = v.expressed && v.probability >= thresholds.pass;
      const failed = !v.expressed || v.probability < thresholds.fail;
      decisions.push({ key, kind: "coverage", itemId: item.id, via: "verifier", probability: v.probability, passed });
      if (passed) continue;
      if (failed) {
        findings.push({ code: "manifest_not_expressed", manifestItemId: item.id, probability: v.probability,
          message: `the prompt does not express: ${item.requirement} (${v.reason})` });
        continue;
      }
    } catch {
      decisions.push({ key, kind: "coverage", itemId: item.id, via: "verifier", probability: null, passed: false });
    }
    ambiguous = true;
    findings.push({ code: "manifest_ambiguous", manifestItemId: item.id,
      message: `it stays unclear whether the prompt expresses: ${item.requirement}` });
  }

  for (const item of conflictItems) {
    const key = `conflict:${item.id}`;
    const prob = p(key);
    if (prob === null) {
      decisions.push({ key, kind: "conflict", itemId: item.id, via: "decision", probability: null, passed: false });
      ambiguous = true;
      findings.push({ code: "manifest_ambiguous", manifestItemId: item.id,
        message: `the decision model gave no answer on whether the prompt contradicts: ${item.requirement}` });
      continue;
    }
    const conflict = prob >= thresholds.conflict;
    decisions.push({ key, kind: "conflict", itemId: item.id, via: "decision", probability: prob, passed: !conflict });
    if (conflict) {
      findings.push({ code: "conflict", manifestItemId: item.id, probability: prob,
        message: `the prompt works against: ${item.requirement}` });
    }
  }

  pkg.notVisible.forEach((attr, i) => {
    const key = `not_visible:${i}`;
    const prob = p(key);
    if (prob === null) {
      decisions.push({ key, kind: "not_visible", itemId: null, via: "decision", probability: null, passed: false });
      ambiguous = true;
      findings.push({ code: "manifest_ambiguous",
        message: `the decision model gave no answer on whether the prompt mentions "${attr}", which is not visible on the product` });
      return;
    }
    const stated = prob >= thresholds.notVisible;
    decisions.push({ key, kind: "not_visible", itemId: null, via: "decision", probability: prob, passed: !stated });
    if (stated) {
      findings.push({ code: "not_visible_stated", probability: prob,
        message: `the prompt says something about "${attr}", which is not visible on the product and must not be stated` });
    }
  });

  return { findings, decisions, calls, ambiguous };
}
