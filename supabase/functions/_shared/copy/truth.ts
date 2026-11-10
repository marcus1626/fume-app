// The truth check: copy says only what Fume can stand behind. Quotes are verbatim, every number comes from a verified
// fact, an assumption is a [placeholder] and never a claim, and a claim that needs proof has it. Code decides.

import { containsPhrase, UNPROVEN_SUPERLATIVES } from "./slop.ts";
import type { CopyContext, CopyFinding, CopyQuote } from "./types.ts";

/** Everything in square brackets: an assumption or a value not known yet ("[callback time]"). */
export function placeholders(text: string): string[] {
  return [...text.matchAll(/\[([^\]]*)\]/g)].map((m) => m[1].trim());
}

const QUOTED = /[“„"]([^“”„"]{3,})[”“"]|‘([^‘’]{3,})’/g;

function norm(s: string): string {
  return s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").replace(/[.,;:!?]+$/g, "").trim();
}

/** A quote with a cut marked [...] matches when its parts appear in order in the source. */
export function isVerbatim(fragment: string, source: string): boolean {
  const parts = fragment.split(/\[(?:\.\.\.|…)\]/).map(norm).filter(Boolean);
  const hay = norm(source);
  let at = 0;
  for (const p of parts) {
    const i = hay.indexOf(p, at);
    if (i < 0) return false;
    at = i + p.length;
  }
  return parts.length > 0;
}

export function findQuote(fragment: string, quotes: CopyQuote[]): CopyQuote | undefined {
  return quotes.find((q) => isVerbatim(fragment, q.original) || (q.translation ? isVerbatim(fragment, q.translation) : false));
}

/** Removes the verified quotes from a line, so the claim checks read only the brand's own words. */
export function withoutQuotes(text: string, quotes: CopyQuote[]): string {
  return text.replace(QUOTED, (m, a, b) => (findQuote(a ?? b, quotes) ? " " : m));
}

const NUMBER = /(?<![\p{L}\d])(\d+(?:[.,]\d+)*)(\s?%|\s?€|\s?(?:eur|euro|kr|nok|usd))?/giu;
const PRICE_OR_SAVING: RegExp[] = [
  /\b(save|saves|saving|savings|spar(?:en|t)?|einsparung(?:en)?|spare|sparer)\b/i,
  /\b(cheaper|lower (?:price|prices|bill|bills|cost|costs|rates?)|cut (?:your )?(?:bill|costs?)|reduce (?:your )?(?:bill|costs?)|günstiger|billigere?)\b/i,
  /\b(price promise|price guarantee|preisgarantie|prisgaranti)\b/i,
];

/** Checks one line against the facts, the quotes and the rules for claims. */
export function truthCheck(ref: string, text: string, ctx: CopyContext): CopyFinding[] {
  const out: CopyFinding[] = [];
  // Quotes: every quoted stretch that reads like a customer's words must be one of the customer's quotes, verbatim.
  for (const m of text.matchAll(QUOTED)) {
    const frag = m[1] ?? m[2];
    if (/\[[^\]]*\]/.test(frag) && !/\[(\.\.\.|…)\]/.test(frag)) continue; // a placeholder in quotes, not a quote
    const words = frag.trim().split(/\s+/).length;
    if (words < 4) continue; // a quoted word or a short name ("SGB VZ FLEX") is not a quote
    if (!findQuote(frag, ctx.quotes))
      out.push({
        code: "quote_not_verbatim", severity: "error", ref,
        message: `"${frag.slice(0, 60)}" is quoted but matches no customer quote word for word.`,
        fix: "Use the quote exactly as given, and mark a cut with [...].",
      });
  }
  const own = withoutQuotes(text, ctx.quotes);
  const unbracketed = own.replace(/\[[^\]]*\]/g, " ");

  // Numbers: only a verified fact's numbers may appear outside a placeholder.
  const allowed = new Set(ctx.facts.filter((f) => f.verified).flatMap((f) => f.numbers ?? []).map((n) => n.replace(/[.,]/g, "")));
  for (const m of unbracketed.matchAll(NUMBER)) {
    const n = m[1].replace(/[.,]/g, "");
    if (/^(19|20)\d\d$/.test(n) && !m[2]) continue; // a year
    if (ctx.noPriceOrSavings && m[2] && /€|eur|kr|nok|usd/i.test(m[2]))
      out.push({ code: "price_or_saving", severity: "error", ref, message: `"${m[0].trim()}" is a sum of money, which this brief rules out.` });
    if (!allowed.has(n))
      out.push({
        code: "unbacked_number", severity: "error", ref,
        message: `"${m[0].trim()}" is a number no verified fact gives.`,
        fix: "Use a verified fact's number, or write it as a [placeholder] and list it as an assumption.",
      });
  }
  if (ctx.noPriceOrSavings)
    for (const re of PRICE_OR_SAVING) {
      const m = unbracketed.match(re);
      if (m)
        out.push({
          code: "price_or_saving", severity: "error", ref,
          message: `"${m[0]}" reads as a price promise or a saving, which this brief rules out.`,
          fix: "Let a customer's verbatim quote carry savings; the brand's own words never do.",
        });
    }
  for (const sup of UNPROVEN_SUPERLATIVES)
    if (containsPhrase(unbracketed, sup) && !ctx.facts.some((f) => f.verified && f.backs?.includes("comparison")))
      out.push({ code: "unproven_superlative", severity: "error", ref, message: `"${sup}" claims more than any verified fact proves.`, fix: "Trade it for the proof: a name, a detail." });
  for (const f of ctx.forbidden)
    if (new RegExp(f.pattern, "iu").test(unbracketed))
      out.push({ code: "forbidden", severity: "error", ref, message: `Off limits: ${f.why}` });
  for (const p of placeholders(text))
    if (!p || p === "..." || p === "…") continue;
    else out.push({ code: "placeholder", severity: "info", ref, message: `Assumption or open value: [${p}]. It goes on the assumptions list.` });
  return out;
}
