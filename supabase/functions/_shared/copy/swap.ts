// The swap test: if another brand in the category could sign the line, it is not finished. Code cannot judge an idea,
// but it can tell when a line carries nothing only this brand has (an anchor: its name, its mechanism, its proof, a
// customer's words) and is made of the words the category already uses.

import { containsPhrase, contentWords } from "./slop.ts";
import { findQuote } from "./truth.ts";
import type { CopyContext } from "./types.ts";

export interface SwapResult {
  verdict: "anchored" | "generic" | "open";
  /** The anchors the line carries. */
  anchors: string[];
  /** The share of its content words the category already uses (0 to 1). */
  common: number;
  why: string;
}

export function categoryVocabulary(lines: string[]): Set<string> {
  return new Set(lines.flatMap(contentWords));
}

/** Reads one line for the swap test. */
export function swapTest(text: string, ctx: CopyContext, vocab = categoryVocabulary(ctx.categoryLines)): SwapResult {
  const anchors = ctx.anchors.filter((a) => containsPhrase(text, a));
  const quoted = [...text.matchAll(/[“„"]([^“”„"]{8,})[”“"]/g)].some((m) => findQuote(m[1], ctx.quotes));
  if (quoted) anchors.push("a customer's own words");
  const words = contentWords(text);
  const common = words.length ? words.filter((w) => vocab.has(w)).length / words.length : 0;
  if (anchors.length) return { verdict: "anchored", anchors, common, why: `Carries ${anchors.join(", ")}.` };
  if (words.length >= 3 && common >= 0.6)
    return {
      verdict: "generic", anchors, common,
      why: `${Math.round(common * 100)}% of its words are the category's own, and nothing only ${ctx.brand} has.`,
    };
  return { verdict: "open", anchors, common, why: "No anchor, but not the category's words either: a person judges it." };
}
