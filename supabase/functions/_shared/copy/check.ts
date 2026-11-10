// One check over a whole deck of copy: every line against its format, the slop habits, the truth rules and the swap
// test; then the rules that span lines (a track's headline stays the same in every ask, search headlines must differ).
// The report is what the expert reads next to the copy. A machine's reading never blocks on its own: errors send the
// draft back to the writer once, then it goes to the expert with the report.

import { charCount, checkFormat, resolveFormat } from "./formats.ts";
import { contentWords, slopCheck } from "./slop.ts";
import { categoryVocabulary, swapTest, type SwapResult } from "./swap.ts";
import { placeholders, truthCheck } from "./truth.ts";
import type { CopyContext, CopyDeck, CopyFinding } from "./types.ts";

export interface FieldReport {
  ref: string;
  format: string;
  text: string;
  chars: number;
  limit?: number;
  swap?: SwapResult;
}

export interface DeckReport {
  brand: string;
  findings: CopyFinding[];
  fields: FieldReport[];
  /** Every [placeholder] in the deck, once: the assumptions list starts here. */
  placeholders: string[];
  /** Pieces with no anchored headline-like line: another brand could sign them. */
  swapFailures: string[];
  counts: { error: number; warn: number; info: number; fields: number; pieces: number };
  /** No errors. Warnings are for the expert's eye. */
  clean: boolean;
}

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a), B = new Set(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  return inter / (new Set([...A, ...B]).size || 1);
}

export function checkDeck(deck: CopyDeck, ctx: CopyContext): DeckReport {
  const findings: CopyFinding[] = [];
  const fields: FieldReport[] = [];
  const vocab = categoryVocabulary(ctx.categoryLines);
  const allPlaceholders = new Set<string>();
  const swapFailures: string[] = [];
  const groups = new Map<string, { ref: string; text: string }[]>();

  for (const piece of deck.pieces) {
    let anchoredHeadline = false, hasHeadline = false;
    for (const f of piece.fields) {
      const spec = resolveFormat(f.format, ctx.formatOverrides);
      const lang = f.lang ?? ctx.lang;
      findings.push(...checkFormat(f.ref, f.format, f.text, ctx.formatOverrides));
      findings.push(...slopCheck(f.ref, f.text, { lang, format: f.format, avoidWords: ctx.avoidWords, emojiAllowed: ctx.emojiAllowed, briefText: ctx.briefText }));
      findings.push(...truthCheck(f.ref, f.text, ctx));
      for (const p of placeholders(f.text)) if (p && p !== "..." && p !== "…") allPlaceholders.add(p);
      let swap: SwapResult | undefined;
      if (spec?.headline || f.format === "image.sl" || f.format === "landing.sl") {
        swap = swapTest(f.text, ctx, vocab);
        hasHeadline = true;
        if (swap.verdict === "anchored") anchoredHeadline = true;
        if (swap.verdict === "generic")
          findings.push({ code: "swap_generic", severity: "warn", ref: f.ref, message: `Swap test: ${swap.why}`, fix: `Add what only ${ctx.brand} has, or cut the line.` });
      }
      fields.push({ ref: f.ref, format: f.format, text: f.text, chars: charCount(f.text), limit: spec?.max, swap });
      if (f.group) {
        const key = `${f.group}|${f.format}`;
        groups.set(key, [...(groups.get(key) ?? []), { ref: f.ref, text: f.text }]);
      }
    }
    if (hasHeadline && !anchoredHeadline) swapFailures.push(piece.id);
  }

  for (const id of swapFailures)
    findings.push({
      code: "swap_piece", severity: "warn", ref: id,
      message: `No headline or subline in this piece carries anything only ${ctx.brand} has. Another brand could sign it.`,
    });

  for (const [key, list] of groups) {
    const first = list[0].text.trim();
    for (const other of list.slice(1))
      if (other.text.trim() !== first)
        findings.push({
          code: "group_differs", severity: "error", ref: other.ref,
          message: `"${key.split("|")[0]}" keeps one ${key.split("|")[1]} in every variant; this one differs from ${list[0].ref}.`,
        });
  }

  // Search headlines are mixed by the platform, so near duplicates count as one (practice).
  for (const piece of deck.pieces) {
    const heads = piece.fields.filter((f) => f.format === "google.rsa.headline");
    for (let i = 0; i < heads.length; i++)
      for (let j = i + 1; j < heads.length; j++)
        if (jaccard(contentWords(heads[i].text), contentWords(heads[j].text)) >= 0.6)
          findings.push({
            code: "near_duplicate", severity: "warn", ref: heads[j].ref,
            message: `Says nearly what ${heads[i].ref} says; the search ad counts them as one.`,
          });
  }

  const counts = { error: 0, warn: 0, info: 0, fields: fields.length, pieces: deck.pieces.length };
  for (const f of findings) counts[f.severity]++;
  return { brand: deck.brand, findings, fields, placeholders: [...allPlaceholders], swapFailures, counts, clean: counts.error === 0 };
}

/** The report as plain text, for the writer's second try and for a person. */
export function reportText(r: DeckReport): string {
  const lines = [
    `${r.brand}: ${r.counts.pieces} pieces, ${r.counts.fields} lines. ${r.counts.error} errors, ${r.counts.warn} warnings, ${r.counts.info} notes.`,
  ];
  for (const sev of ["error", "warn"] as const)
    for (const f of r.findings.filter((x) => x.severity === sev))
      lines.push(`${sev === "error" ? "ERROR" : "warn "} ${f.ref}: ${f.message}${f.fix ? ` ${f.fix}` : ""}`);
  if (r.placeholders.length) lines.push(`Placeholders: ${r.placeholders.map((p) => `[${p}]`).join(", ")}`);
  return lines.join("\n");
}
