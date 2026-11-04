// The Engine chooses how to say a thing from how it did before. Where a model's dialect has two ways of writing the
// same prompt (rules that share a `choice`), each is an arm: its prompts' scores from the prompt graph (people's
// verdicts first, else the picture check) are its evidence, and Thompson sampling draws one, so the Engine keeps
// trying both while it learns and moves to the better one as the evidence grows. How a model reads a prompt is the
// model's, so the evidence is counted across brands; no brand's data is in it.
import type { Dialect, DialectRule } from "./types.ts";

/** One arm's evidence: n scored prompts, and the sum of their scores (each 0 to 1). */
export type Arm = { feature: string; n: number; sum: number };

// Marsaglia and Tsang's method for a gamma variate (shape >= 1 here, since the prior adds 1).
function gamma(shape: number, random: () => number): number {
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      // A normal variate from two uniforms (Box–Muller).
      x = Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = random();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}
export const beta = (a: number, b: number, random: () => number) => {
  const x = gamma(a, random);
  return x / (x + gamma(b, random));
};

/** The dialect with one rule for each choice: the one whose draw from Beta(1 + sum, 1 + n − sum) is highest. */
export function chooseVariants(dialect: Dialect, arms: Arm[], random: () => number = Math.random): { dialect: Dialect; chosen: string[] } {
  const evidence = new Map(arms.map((a) => [a.feature, a]));
  const choices = new Map<string, DialectRule[]>();
  for (const r of dialect.rules) if (r.choice && r.status !== "retired") choices.set(r.choice, [...(choices.get(r.choice) ?? []), r]);
  const keep = new Set<string>();
  for (const rules of choices.values()) {
    let best: DialectRule | null = null;
    let bestDraw = -1;
    for (const r of rules) {
      const a = evidence.get(`dialect:${r.id}`);
      const n = Math.max(0, a?.n ?? 0);
      const sum = Math.min(n, Math.max(0, a?.sum ?? 0));
      const draw = beta(1 + sum, 1 + n - sum, random);
      if (draw > bestDraw) [best, bestDraw] = [r, draw];
    }
    if (best) keep.add(best.id);
  }
  return {
    dialect: { ...dialect, rules: dialect.rules.filter((r) => !r.choice || keep.has(r.id)) },
    chosen: [...keep].sort(),
  };
}
