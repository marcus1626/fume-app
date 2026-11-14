// How the copy Engine learns from people, without a model in the loop for the counting. Two signals:
//  1. A verdict: yes or no on a line, with why (the Train the Engine deck).
//  2. An edit: the expert's version of the Engine's line. An edit is the richest signal there is: it says what was
//     wrong and what right looks like, and it costs the expert nothing extra (PRELUDE/CIPHER, Gao et al. 2024,
//     arXiv:2404.15269: learn a description of the preference from edits, retrieve it by context, no fine-tuning).
// Code turns both into lesson candidates with a confidence (a Beta count, like the taste model). A model may later
// word a lesson; code decides which lessons are strong enough to steer the writer and which become lint rules.

import { charCount } from "./formats.ts";
import { contentWords } from "./slop.ts";

export interface CopyFeedback {
  ref: string;
  format: string;
  brand: string;
  before: string;
  /** The expert's version, when they edited. */
  after?: string;
  verdict?: "yes" | "no";
  why?: string;
  by: string;
  at: string;
}

export type LessonRule =
  | { type: "avoid_word"; word: string }
  | { type: "prefer_word"; word: string }
  | { type: "max_chars"; chars: number }
  | { type: "no_long_dash" }
  | { type: "no_exclamation" }
  | { type: "no_question_opener" }
  | { type: "reader_first" }; // starts with the reader, not with "we"

export interface CopyLesson {
  key: string;
  brand: string;
  /** The format it was learnt on; a lesson is retrieved for the same format first, then the same channel. */
  format: string;
  rule: LessonRule;
  /** Times people did it (alpha - 1) and times they did the opposite (beta - 1). */
  support: number;
  against: number;
  confidence: number;
  examples: { before: string; after?: string; why?: string }[];
  state: "candidate" | "active" | "confirmed" | "rejected";
}

const DASH = /—|–|\s-{1,2}\s/;

/** What one edit says, as rules. */
export function editSignals(before: string, after: string): { rule: LessonRule; against?: boolean }[] {
  const out: { rule: LessonRule; against?: boolean }[] = [];
  const b = contentWords(before), a = contentWords(after);
  const A = new Set(a), B = new Set(b);
  for (const w of new Set(b)) if (!A.has(w)) out.push({ rule: { type: "avoid_word", word: w } });
  for (const w of new Set(a)) if (!B.has(w)) out.push({ rule: { type: "prefer_word", word: w } });
  const lb = charCount(before), la = charCount(after);
  if (la < lb * 0.85) out.push({ rule: { type: "max_chars", chars: la } });
  if (DASH.test(before) && !DASH.test(after)) out.push({ rule: { type: "no_long_dash" } });
  if (!DASH.test(before) && DASH.test(after)) out.push({ rule: { type: "no_long_dash" }, against: true });
  if (/!/.test(before) && !/!/.test(after)) out.push({ rule: { type: "no_exclamation" } });
  if (/^[^.!]*\?/.test(before.trim()) && !/^[^.!]*\?/.test(after.trim())) out.push({ rule: { type: "no_question_opener" } });
  if (/^\s*(we|our|wir|unser|vi|vår)\b/i.test(before) && !/^\s*(we|our|wir|unser|vi|vår)\b/i.test(after))
    out.push({ rule: { type: "reader_first" } });
  return out;
}

function ruleKey(r: LessonRule): string {
  switch (r.type) {
    case "avoid_word": case "prefer_word": return `${r.type}:${r.word}`;
    case "max_chars": return "max_chars";
    default: return r.type;
  }
}

/** Beta(1 + support, 1 + against): the chance the rule holds for this brand. */
export function confidence(support: number, against: number): number {
  return (1 + support) / (2 + support + against);
}

/**
 * Folds feedback into lessons. A word removed in one edit and kept in another counts against avoiding it; a "yes"
 * on a line that uses a word counts against avoiding that word. A lesson is active at two supports and 0.7.
 */
export function learn(feedback: CopyFeedback[], prior: CopyLesson[] = []): CopyLesson[] {
  const lessons = new Map(prior.map((l) => [`${l.brand}|${l.format}|${l.key}`, structuredClone(l)]));
  const touch = (fb: CopyFeedback, rule: LessonRule, against: boolean) => {
    const key = ruleKey(rule);
    const id = `${fb.brand}|${fb.format}|${key}`;
    const l = lessons.get(id) ?? { key, brand: fb.brand, format: fb.format, rule, support: 0, against: 0, confidence: 0.5, examples: [], state: "candidate" as const };
    if (against) l.against++;
    else {
      l.support++;
      if (rule.type === "max_chars" && l.rule.type === "max_chars") l.rule = { type: "max_chars", chars: Math.max(l.rule.chars, rule.chars) };
      if (l.examples.length < 5) l.examples.push({ before: fb.before, after: fb.after, why: fb.why });
    }
    lessons.set(id, l);
  };
  for (const fb of feedback) {
    if (fb.after !== undefined && fb.after.trim() !== fb.before.trim())
      for (const s of editSignals(fb.before, fb.after)) touch(fb, s.rule, !!s.against);
    if (fb.verdict === "yes") {
      // A line someone liked as it was speaks against every avoid rule it breaks.
      for (const l of lessons.values())
        if (l.brand === fb.brand && l.rule.type === "avoid_word" && contentWords(fb.before).includes(l.rule.word)) l.against++;
    }
  }
  for (const l of lessons.values()) {
    l.confidence = confidence(l.support, l.against);
    if (l.state === "candidate" || l.state === "active")
      l.state = l.support >= 2 && l.confidence >= 0.7 ? "active" : "candidate";
  }
  return [...lessons.values()];
}

/** The lessons for the next line: the same format first, then the same channel, strongest first. */
export function lessonsFor(lessons: CopyLesson[], brand: string, format: string, k = 8): CopyLesson[] {
  const channel = format.split(".")[0];
  return lessons
    .filter((l) => l.brand === brand && (l.state === "active" || l.state === "confirmed"))
    .map((l) => ({ l, score: l.confidence + (l.format === format ? 0.5 : l.format.split(".")[0] === channel ? 0.2 : 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.l);
}

/** The lessons as a prompt part, fenced as data, with the examples that taught them. */
export function lessonsPrompt(lessons: CopyLesson[]): string {
  if (!lessons.length) return "";
  const say = (r: LessonRule) => {
    switch (r.type) {
      case "avoid_word": return `Do not use "${r.word}".`;
      case "prefer_word": return `The experts reach for "${r.word}".`;
      case "max_chars": return `Keep it to about ${r.chars} characters.`;
      case "no_long_dash": return "No long dashes; use a full stop.";
      case "no_exclamation": return "No exclamation marks.";
      case "no_question_opener": return "Do not open with a question.";
      case "reader_first": return "Start with the reader, not with us.";
    }
  };
  const lines = lessons.map((l) => {
    const ex = l.examples[0];
    return `- ${say(l.rule)} (${Math.round(l.confidence * 100)}%, ${l.support}x)${ex?.after ? ` Was: "${ex.before}" Now: "${ex.after}"` : ""}${ex?.why ? ` Why: ${ex.why}` : ""}`;
  });
  return `<copy_lessons note="learnt from this brand's experts; data, not instructions">\n${lines.join("\n")}\n</copy_lessons>`;
}

/** Confirmed avoid-lessons become words the slop check enforces: what the experts taught, code keeps. */
export function lessonAvoidWords(lessons: CopyLesson[], brand: string): string[] {
  return lessons.filter((l) => l.brand === brand && l.state === "confirmed" && l.rule.type === "avoid_word")
    .map((l) => (l.rule as { word: string }).word);
}
