// Which findings stop a prompt, and the checks run on slots a person wrote.
import { assemble, type Assembly } from "./assemble.ts";
import { checkCoverage, type CoverageDecision, DEFAULT_THRESHOLDS, type Thresholds } from "./coverage.ts";
import { lint } from "./lint.ts";
import type { CompilePackage, Decider, Finding, ModelCall, SlotText, Verifier } from "./types.ts";

const ALWAYS_BLOCKING = new Set<string>([
  "unknown_slot", "missing_slot", "empty_slot", "text_request", "forbidden_term", "too_many_references",
  "locked_slot_changed", "not_visible_stated", "file_name",
]);

export type SlotValidation = {
  assembly: Assembly;
  findings: Finding[];
  decisions: CoverageDecision[];
  calls: ModelCall[];
  ambiguous: boolean;
  blocking: Finding[];
  soft: Finding[];
};

/** Findings that stop a prompt, and those a person may pass by stating why. */
export function classifyFindings(findings: Finding[], pkg: CompilePackage): { blocking: Finding[]; soft: Finding[] } {
  const required = new Set(pkg.manifest.filter((m) => m.required).map((m) => m.id));
  const blocking: Finding[] = [];
  const soft: Finding[] = [];
  for (const f of findings) {
    const blocks = ALWAYS_BLOCKING.has(f.code) || (f.manifestItemId !== undefined && required.has(f.manifestItemId));
    (blocks ? blocking : soft).push(f);
  }
  return { blocking, soft };
}

/** The checks a composed prompt passes, run on slots a person wrote and reported all at once. */
export async function validateSlots(
  pkg: CompilePackage,
  slots: SlotText[],
  deps: { decide: Decider; verify: Verifier },
  opts: { maxReferences?: number; thresholds?: Thresholds } = {},
): Promise<SlotValidation> {
  const assembly = assemble(pkg, slots);
  const lintFindings = lint(assembly, pkg, { maxReferences: opts.maxReferences });
  const coverage = await checkCoverage(assembly, pkg, deps, opts.thresholds ?? DEFAULT_THRESHOLDS);
  const findings = [...lintFindings, ...coverage.findings];
  return { assembly, findings, decisions: coverage.decisions, calls: coverage.calls, ambiguous: coverage.ambiguous, ...classifyFindings(findings, pkg) };
}
