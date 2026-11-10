// The format registry: every slot copy goes into, with its limit and where the limit comes from. Code counts the
// characters; a model never decides whether a line fits.
//
// source: "platform" = the platform's own rule (it cuts or refuses the text), "practice" = what practice sources say
// (the platform shows more, but the rest is hidden or cut on most placements), "proposed" = Fume's or a brief's choice.

import type { CopyFinding } from "./types.ts";

export interface FormatSpec {
  id: string;
  channel: string;
  label: string;
  /** Never longer than this. */
  max?: number;
  /** Aim for this; longer is a warning. */
  recommended?: number;
  /** The first N characters must make sense on their own (the rest is behind "See more"). */
  visible?: number;
  source: "platform" | "practice" | "proposed";
  note?: string;
  noEmoji?: boolean;
  /** Letters, digits and spaces only (WhatsApp buttons in the SGB brief). */
  plain?: boolean;
  /** A call to action: the generic-button check applies. */
  cta?: boolean;
  /** A headline-like line: the swap test and the brief-echo check weigh more here. */
  headline?: boolean;
  /** Picked from the platform's fixed list, not written. */
  fixedList?: string[];
}

const META_BUTTONS = [
  "Apply Now", "Book Now", "Call Now", "Contact Us", "Download", "Get Offer", "Get Quote", "Learn More", "Sign Up",
  "Subscribe", "Request Time", "See Menu", "Send Message", "Send WhatsApp Message", "Shop Now", "Get Started",
];
const LINKEDIN_BUTTONS = [
  "Apply", "Download", "View Quote", "Learn More", "Sign Up", "Subscribe", "Register", "Join", "Attend",
  "Request Demo", "Book Now", "Get Quote",
];

export const FORMATS: Record<string, FormatSpec> = {
  "image.hl": { id: "image.hl", channel: "static", label: "Headline on the image", max: 40, source: "proposed", headline: true, noEmoji: true },
  "image.sl": { id: "image.sl", channel: "static", label: "Subline on the image", max: 90, source: "proposed", noEmoji: true },
  "meta.primary": {
    id: "meta.primary", channel: "meta", label: "Meta primary text", visible: 125, source: "practice",
    note: "Meta shows about 125 characters before See more on most placements.",
  },
  "meta.headline": { id: "meta.headline", channel: "meta", label: "Meta headline", recommended: 27, max: 40, source: "practice", headline: true },
  "meta.description": { id: "meta.description", channel: "meta", label: "Meta description", recommended: 25, max: 30, source: "practice", note: "Not shown on every placement." },
  "meta.button": { id: "meta.button", channel: "meta", label: "Meta button", source: "platform", fixedList: META_BUTTONS },
  "linkedin.intro": { id: "linkedin.intro", channel: "linkedin", label: "LinkedIn intro text", visible: 150, max: 600, source: "practice" },
  "linkedin.headline": { id: "linkedin.headline", channel: "linkedin", label: "LinkedIn headline", recommended: 70, max: 200, source: "practice", headline: true },
  "linkedin.button": { id: "linkedin.button", channel: "linkedin", label: "LinkedIn button", source: "platform", fixedList: LINKEDIN_BUTTONS },
  "google.rsa.headline": { id: "google.rsa.headline", channel: "google", label: "Search ad headline", max: 30, source: "platform", headline: true, noEmoji: true },
  "google.rsa.description": { id: "google.rsa.description", channel: "google", label: "Search ad description", max: 90, source: "platform", noEmoji: true },
  "google.rsa.path": { id: "google.rsa.path", channel: "google", label: "Display path", max: 15, source: "platform", noEmoji: true },
  "landing.hl": { id: "landing.hl", channel: "landing", label: "Landing page headline", recommended: 60, source: "proposed", headline: true },
  "landing.sl": { id: "landing.sl", channel: "landing", label: "Landing page subline", recommended: 140, source: "proposed" },
  "landing.cta": { id: "landing.cta", channel: "landing", label: "Landing page button", max: 30, source: "proposed", cta: true },
  "landing.body": { id: "landing.body", channel: "landing", label: "Landing page block", source: "proposed" },
  "form.label": { id: "form.label", channel: "form", label: "Form field label", max: 40, source: "proposed" },
  "instant.headline": { id: "instant.headline", channel: "meta", label: "Instant form headline", max: 60, source: "practice", headline: true },
  "instant.body": { id: "instant.body", channel: "meta", label: "Instant form text", max: 300, source: "practice" },
  "quiz.question": { id: "quiz.question", channel: "quiz", label: "Quiz question", recommended: 80, source: "proposed" },
  "quiz.answer": { id: "quiz.answer", channel: "quiz", label: "Quiz answer button", max: 40, source: "proposed", noEmoji: true },
  "email.subject": { id: "email.subject", channel: "email", label: "Email subject", max: 45, source: "proposed", headline: true },
  "email.preheader": { id: "email.preheader", channel: "email", label: "Email preheader", max: 80, source: "proposed" },
  "email.body": { id: "email.body", channel: "email", label: "Email body", source: "proposed" },
  "email.cta": { id: "email.cta", channel: "email", label: "Email button", max: 30, source: "proposed", cta: true },
  "whatsapp.body": { id: "whatsapp.body", channel: "whatsapp", label: "WhatsApp message", max: 300, source: "proposed", note: "WhatsApp allows 1024 in a template body." },
  "whatsapp.button": { id: "whatsapp.button", channel: "whatsapp", label: "WhatsApp button", max: 20, source: "platform", plain: true, noEmoji: true, cta: true },
  "video.hook": { id: "video.hook", channel: "video", label: "Hook (first three seconds, on screen)", max: 42, source: "practice", headline: true },
  "video.onscreen": { id: "video.onscreen", channel: "video", label: "Text on screen", recommended: 42, max: 84, source: "practice", note: "Two caption lines of about 42 characters at most; one line reads in about two seconds." },
  "video.spoken": { id: "video.spoken", channel: "video", label: "Spoken line", source: "proposed" },
  "plain.idea": { id: "plain.idea", channel: "thinking", label: "Idea in one sentence", recommended: 140, source: "proposed" },
  "plain.summary": { id: "plain.summary", channel: "thinking", label: "Summary (100 words or fewer)", source: "proposed" },
  "plain.text": { id: "plain.text", channel: "thinking", label: "Text", source: "proposed" },
};

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Characters as a person counts them (an emoji or an accented letter is one). */
export function charCount(text: string): number {
  let n = 0;
  for (const _ of segmenter.segment(text)) n++;
  return n;
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

const EMOJI = /\p{Extended_Pictographic}/u;

export function resolveFormat(id: string, overrides?: Record<string, Partial<FormatSpec>>): FormatSpec | undefined {
  const base = FORMATS[id];
  const over = overrides?.[id];
  if (!base && !over) return undefined;
  return { ...(base ?? { id, channel: "custom", label: id, source: "proposed" }), ...(over ?? {}) } as FormatSpec;
}

/** Checks one line against its slot: length, the visible part, emoji, plain buttons, fixed lists, word limits. */
export function checkFormat(ref: string, formatId: string, text: string, overrides?: Record<string, Partial<FormatSpec>>): CopyFinding[] {
  const spec = resolveFormat(formatId, overrides);
  if (!spec) return [{ code: "unknown_format", severity: "error", ref, message: `No format "${formatId}" in the registry.` }];
  const out: CopyFinding[] = [];
  const n = charCount(text);
  if (!text.trim()) out.push({ code: "empty", severity: "error", ref, message: `${spec.label} is empty.` });
  if (spec.max !== undefined && n > spec.max)
    out.push({
      code: "too_long", severity: "error", ref,
      message: `${spec.label}: ${n} characters, the limit is ${spec.max} (${spec.source}).`,
      fix: `Cut ${n - spec.max} characters.`,
    });
  else if (spec.recommended !== undefined && n > spec.recommended)
    out.push({
      code: "over_recommended", severity: "warn", ref,
      message: `${spec.label}: ${n} characters, ${spec.recommended} is recommended (${spec.source}).`,
    });
  if (spec.visible !== undefined && n > spec.visible) {
    const head = Array.from(segmenter.segment(text), (s) => s.segment).slice(0, spec.visible).join("");
    // The visible part must end on a finished thought: a full stop, a question mark or a colon inside it.
    if (!/[.!?:]\s/.test(head + " ") || !/[.!?:]/.test(head))
      out.push({
        code: "visible_part_unfinished", severity: "warn", ref,
        message: `${spec.label}: the first ${spec.visible} characters end mid-thought ("…${head.slice(-30)}").`,
        fix: "Finish the first sentence inside the visible part.",
      });
  }
  if (spec.id === "plain.summary" && wordCount(text) > 100)
    out.push({ code: "too_many_words", severity: "error", ref, message: `Summary has ${wordCount(text)} words; 100 or fewer.` });
  if (spec.noEmoji && EMOJI.test(text)) out.push({ code: "emoji_not_allowed", severity: "error", ref, message: `${spec.label} takes no emoji.` });
  if (spec.plain && /[^\p{L}\p{N} ]/u.test(text))
    out.push({ code: "not_plain", severity: "error", ref, message: `${spec.label}: letters, numbers and spaces only.` });
  if (spec.fixedList && !spec.fixedList.some((b) => b.toLowerCase() === text.trim().toLowerCase()))
    out.push({
      code: "not_in_fixed_list", severity: "error", ref,
      message: `${spec.label} "${text}" is not on the platform's list.`,
      fix: `Pick one of: ${spec.fixedList.join(", ")}.`,
    });
  return out;
}
