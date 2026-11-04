// The motor's first half: compose a prompt, check it by code, check it by meaning, write it again on findings, and
// give a person the problem when it stays unclear. Nothing is rendered from a prompt that did not pass.
import { assemble, type Assembly } from "./assemble.ts";
import { buildCompilePackage, type CompileInput } from "./compile.ts";
import { checkCoverage, type CoverageDecision, DEFAULT_THRESHOLDS, type Thresholds } from "./coverage.ts";
import { selectMethod } from "./grammar.ts";
import { lint } from "./lint.ts";
import type { CompilePackage, Composer, Decider, Dialect, Finding, Grammar, ModelCall, SlotText, Verifier } from "./types.ts";

export const DEFAULT_MAX_ATTEMPTS = 3;

/** What goes to the image model: the prompt unchanged, the product pictures first, the format as fields. */
export type ProviderRequest = {
  imageModel: string;
  text: string;
  referenceUrls: string[];
  aspectRatio: string;
  resolution: string | null;
  seed: number | null;
};

export function renderRequest(pkg: CompilePackage, assembly: Assembly, opts: { seed: number | null }): ProviderRequest {
  return {
    imageModel: pkg.target.imageModel,
    text: assembly.text,
    referenceUrls: pkg.references.map((r) => r.url),
    aspectRatio: pkg.format.aspectRatio,
    resolution: pkg.format.resolution,
    seed: opts.seed,
  };
}

export type Attempt = { n: number; slots: SlotText[]; text: string; findings: Finding[]; decisions: CoverageDecision[] };

export type MachineInput = Omit<CompileInput, "grammar" | "dialect"> & { grammars: Grammar[]; dialects: Dialect[] };

export type MachineResult =
  | {
    status: "validated";
    hash: string;
    compilePackage: CompilePackage;
    attempts: Attempt[];
    assembly: Assembly;
    request: ProviderRequest;
    calls: ModelCall[];
  }
  | {
    status: "escalated";
    hash: string;
    compilePackage: CompilePackage;
    attempts: Attempt[];
    reason: "attempts_exhausted" | "ambiguous" | "package_invalid";
    findings: Finding[];
    calls: ModelCall[];
  }
  | { status: "blocked"; code: "no_grammar_for_target"; message: string };

/** Problems in the package itself (the approved texts or the number of pictures) that no prompt can fix. */
export function packageProblems(pkg: CompilePackage, opts: { maxReferences?: number } = {}): Finding[] {
  return lint(assemble(pkg, []), pkg, { maxReferences: opts.maxReferences })
    .filter((f) => f.code === "too_many_references" || f.slotKey === "references" || f.slotKey === "product");
}

export async function runPromptMachine(
  input: MachineInput,
  deps: { compose: Composer; decide: Decider; verify: Verifier },
  opts: { maxAttempts?: number; seed?: number | null; thresholds?: Thresholds; maxReferences?: number } = {},
): Promise<MachineResult> {
  const method = selectMethod(input.target, input.grammars, input.dialects);
  if (method.method === "blocked") return { status: "blocked", code: method.code, message: method.message };

  const { grammars: _g, dialects: _d, ...rest } = input;
  const { compilePackage, hash } = buildCompilePackage({ ...rest, grammar: method.grammar, dialect: method.dialect });
  const packageFindings = packageProblems(compilePackage, { maxReferences: opts.maxReferences });
  if (packageFindings.length > 0)
    return { status: "escalated", hash, compilePackage, attempts: [], reason: "package_invalid", findings: packageFindings, calls: [] };

  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const attempts: Attempt[] = [];
  const calls: ModelCall[] = [];
  let previous: { slots: SlotText[]; findings: Finding[] } | null = null;

  for (let n = 1; n <= maxAttempts; n++) {
    const composed = await deps.compose({ compilePackage, previous });
    calls.push(composed.call);
    const assembly = assemble(compilePackage, composed.slots);

    const lintFindings = lint(assembly, compilePackage, { maxReferences: opts.maxReferences });
    if (lintFindings.length > 0) {
      attempts.push({ n, slots: assembly.slots, text: assembly.text, findings: lintFindings, decisions: [] });
      previous = { slots: composed.slots, findings: lintFindings };
      continue;
    }

    const coverage = await checkCoverage(assembly, compilePackage, deps, opts.thresholds ?? DEFAULT_THRESHOLDS);
    calls.push(...coverage.calls);
    attempts.push({ n, slots: assembly.slots, text: assembly.text, findings: coverage.findings, decisions: coverage.decisions });

    if (coverage.ambiguous)
      return { status: "escalated", hash, compilePackage, attempts, reason: "ambiguous", findings: coverage.findings, calls };
    if (coverage.findings.length === 0)
      return { status: "validated", hash, compilePackage, attempts, assembly, request: renderRequest(compilePackage, assembly, { seed: opts.seed ?? null }), calls };
    previous = { slots: composed.slots, findings: coverage.findings };
  }

  return { status: "escalated", hash, compilePackage, attempts, reason: "attempts_exhausted", findings: attempts.at(-1)?.findings ?? [], calls };
}
