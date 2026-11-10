// The slop check: the habits that make copy read as written by nobody for nobody. Code finds them before an expert
// reads the line. Sources (read 10 Nov 2026): Ad Legends' study of 400 AI-written ads (the long dash in 52%, the
// brief handed back in 66%, five buttons in 62%), Quartz and Pangram on AI tells, Copyhackers on writing from the
// customer's words. None of these proves a machine wrote a line; each is a line nobody chose.

import { FORMATS } from "./formats.ts";
import type { CopyFinding, Lang } from "./types.ts";

/** Stock phrases: words that sound active and name nothing. */
export const STOCK_PHRASES: Record<Lang, string[]> = {
  en: [
    "delve", "leverage", "landscape", "game-changer", "game changer", "unlock", "unleash", "elevate", "seamless",
    "seamlessly", "effortless", "effortlessly", "revolutionize", "revolutionise", "revolutionary", "cutting-edge",
    "in today's fast-paced world", "fast-paced", "whether you're", "look no further", "synergy", "empower",
    "transform your", "we've got you covered", "at the end of the day", "tapestry", "testament", "harness",
    "streamline", "robust", "unparalleled", "hassle-free", "one-stop", "next level", "journey", "embark",
    "dive into", "it's important to note", "ever-evolving", "realm", "supercharge", "say goodbye to",
    "say hello to", "peace of mind", "tailored solutions", "holistic", "nestled", "curated", "crafted for",
    "designed to help", "take control of", "the power of", "a new era", "redefine", "reimagine", "game-changing",
    "worry-free", "stress-free", "smarter way", "the future of", "navigate",
  ],
  de: [
    "in der heutigen schnelllebigen zeit", "maßgeschneiderte lösungen", "ganzheitlich", "nahtlos", "revolutionär",
    "innovative lösungen", "rundum-sorglos", "aufs nächste level", "auf das nächste level", "entdecken sie",
    "mehrwert", "synergien", "zukunftssicher", "sorgenfrei", "stressfrei", "die zukunft der",
  ],
  no: [
    "sømløs", "sømløst", "skreddersydde løsninger", "i dagens hektiske hverdag", "til neste nivå", "banebrytende",
    "revolusjonerende", "uanstrengt", "bekymringsfri", "helhetlig", "oppdag", "fremtidens",
  ],
};

/** A button that fits every ad on earth. */
export const GENERIC_CTAS = [
  "learn more", "click here", "get started", "sign up today", "find out more", "discover more", "shop now",
  "book now", "get quote", "get a quote", "contact us", "read more", "try it now", "start now", "mehr erfahren",
  "jetzt starten", "les mer", "kom i gang",
];

/** Big words that promise everything and prove nothing; code lets them through only with a verified fact. */
export const UNPROVEN_SUPERLATIVES = [
  "best", "ultimate", "world-class", "premium", "innovative", "state-of-the-art", "leading", "number one", "#1",
  "unbeatable", "cheapest", "guaranteed", "best-in-class", "industry-leading", "the only", "unmatched",
  "beste", "günstigste", "führende", "billigste", "ledende",
];

/** Abstract adjectives a line stacks in threes when it has nothing concrete to say. */
const FILLER_ADJECTIVES = [
  "simple", "fast", "easy", "secure", "reliable", "transparent", "flexible", "smart", "fair", "sustainable",
  "efficient", "affordable", "personal", "modern", "innovative", "seamless", "convenient", "trusted", "quick",
  "einfach", "schnell", "sicher", "transparent", "flexibel", "fair", "nachhaltig", "persönlich",
  "enkel", "rask", "trygg", "fleksibel", "rettferdig", "bærekraftig",
];

const HEDGES = ["simply", "really", "very", "truly", "actually", "just", "basically", "literally"];

const INVENTED_PROBLEM = /^\s*(tired of|sick of|struggling with|fed up with|frustrated by|say goodbye|are you tired|müde von|lei av)\b/i;
const CONTRAST_CLICHE = /\b(not just|isn['’]t just|more than just|not only|nicht nur|ikke bare)\b|\bit['’]s not (about )?[^.?!]{1,40}[.,]\s*it['’]s\b/i;
const EMPTY_QUESTION = /^\s*(ever wondered|what if|did you know|imagine|wussten sie|visste du)\b/i;
const EMOJI = /\p{Extended_Pictographic}/gu;
const LONG_DASH = /—|–|\s-{1,2}\s/g;

export function containsPhrase(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "iu").test(text);
}

export function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => /[\p{L}\p{N}]/u.test(s));
}

const STOP = new Set(
  ("a an the and or but of to in on at for with by from is are be was were it its this that your you our we us my me i " +
    "as if so not no do does can will just than then there their they them he she his her who what when how why all " +
    "every each one more most some any into out up down over own get got has have had der die das und oder ein eine " +
    "ist sind zu im in am mit von für sie ihr ihre wir unser og eller en et er til på med for av som du din ditt vi")
    .split(" "),
);

/** The content words of a line: lower case, no stop words. */
export function contentWords(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [])
    .map((w) => w.replace(/['’]s$/, ""))
    .filter((w) => w.length > 1 && !STOP.has(w));
}

export interface SlopOptions {
  lang: Lang;
  /** The format slot, to weigh buttons and headlines. */
  format?: string;
  avoidWords?: string[];
  emojiAllowed?: boolean;
  briefText?: string;
}

/** Finds the slop habits in one line of copy. */
export function slopCheck(ref: string, text: string, opts: SlopOptions): CopyFinding[] {
  const out: CopyFinding[] = [];
  const spec = opts.format ? FORMATS[opts.format] : undefined;
  if (spec?.fixedList) return out; // a platform's own button is not written by us
  const phrases = [...STOCK_PHRASES[opts.lang], ...(opts.lang === "en" ? [] : STOCK_PHRASES.en)];
  for (const p of phrases)
    if (containsPhrase(text, p))
      out.push({ code: "stock_phrase", severity: "warn", ref, message: `Stock phrase "${p}".`, fix: "Say the plain, specific thing instead." });
  for (const w of opts.avoidWords ?? [])
    if (containsPhrase(text, w))
      out.push({ code: "voice_avoid", severity: "error", ref, message: `The Tone of Voice avoids "${w}".` });

  const dashes = text.match(LONG_DASH)?.length ?? 0;
  if (dashes > 0)
    out.push({
      code: "long_dash", severity: "warn", ref,
      message: `${dashes} long dash${dashes > 1 ? "es" : ""} hinging thoughts together (the commonest tell left).`,
      fix: "Use a full stop or a comma: two short sentences read like a person.",
    });
  const bangs = text.match(/!/g)?.length ?? 0;
  if (bangs > 0) out.push({ code: "exclamation", severity: "warn", ref, message: "Exclamation mark: excitement the line did not earn.", fix: "Delete it." });
  const emoji = text.match(EMOJI)?.length ?? 0;
  if (emoji > 0 && !opts.emojiAllowed) out.push({ code: "emoji", severity: "warn", ref, message: "An emoji the brand does not use.", fix: "Remove it." });
  if (INVENTED_PROBLEM.test(text))
    out.push({ code: "invented_problem", severity: "warn", ref, message: "Opens by telling the reader what they are fed up with.", fix: "Open with the moment they are actually in." });
  if (CONTRAST_CLICHE.test(text))
    out.push({ code: "contrast_cliche", severity: "warn", ref, message: `"Not just X, it's Y": the contrast formula.`, fix: "Say Y, and prove it." });
  if (EMPTY_QUESTION.test(text))
    out.push({ code: "empty_question", severity: "info", ref, message: "Opens with a question that asks nothing.", fix: "Start with the fact or the moment." });
  for (const s of sentences(text)) {
    const fillers = FILLER_ADJECTIVES.filter((a) => containsPhrase(s, a));
    if (fillers.length >= 3)
      out.push({
        code: "abstract_triad", severity: "warn", ref,
        message: `Three abstract adjectives in one sentence (${fillers.slice(0, 3).join(", ")}).`,
        fix: "Keep the one that matters and prove it with a detail.",
      });
  }
  const hedges = HEDGES.filter((h) => containsPhrase(text, h));
  if (hedges.length) out.push({ code: "hedge", severity: "info", ref, message: `Filler word: ${hedges.join(", ")}.` });
  if (spec?.cta || /(\.cta|button)$/.test(opts.format ?? "")) {
    const generic = GENERIC_CTAS.find((c) => text.trim().toLowerCase().replace(/[.!]$/, "") === c);
    if (generic)
      out.push({ code: "generic_cta", severity: "warn", ref, message: `"${text.trim()}" fits every ad on earth.`, fix: "Say what happens when they press it." });
  }
  if (spec?.headline && opts.briefText) {
    const words = contentWords(text);
    const brief = new Set(contentWords(opts.briefText));
    const echoed = words.filter((w) => brief.has(w));
    if (words.length >= 3 && echoed.length / words.length >= 0.75)
      out.push({
        code: "brief_echo", severity: "warn", ref,
        message: `The headline is mostly the brief's own words (${echoed.length} of ${words.length}).`,
        fix: "Write the headline the brief did not: start from what the owner feels.",
      });
  }
  if (spec?.headline && /^\s*(we|our|wir|unser|vi|vår)\b/i.test(text))
    out.push({ code: "starts_with_us", severity: "info", ref, message: "The headline starts with the brand, not the reader." });
  return out;
}
