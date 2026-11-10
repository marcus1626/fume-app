// The copy Engine's shapes. Everything here is checked by code; a model writes copy, code decides whether it holds.

export type Lang = "en" | "de" | "no";
export type Severity = "error" | "warn" | "info";

/** One thing code found in one line of copy. */
export interface CopyFinding {
  code: string;
  severity: Severity;
  /** The field it was found in, for example `trackB/static/meta.primary.1`. */
  ref: string;
  message: string;
  /** What a writer does about it, in one line. */
  fix?: string;
}

/** One line of copy in one format slot. */
export interface CopyField {
  ref: string;
  /** A key in the format registry (formats.ts), for example `meta.headline`. */
  format: string;
  text: string;
  lang?: Lang;
  /**
   * Fields that share a group and a format must say the same thing (the brief's test variable: in one track the
   * headline stays the same in all six asks; only the call to action changes).
   */
  group?: string;
}

/** A piece of work: a static, a search ad, an email, a landing page hero, a script. */
export interface CopyPiece {
  id: string;
  title?: string;
  /** The one job of the piece, in one sentence (briefs ask for it). */
  job?: string;
  fields: CopyField[];
}

export interface CopyDeck {
  brand: string;
  campaign?: string;
  pieces: CopyPiece[];
}

/** A fact the copy may stand on. Only `verified` facts back a claim. */
export interface CopyFact {
  id: string;
  statement: string;
  source: string;
  verified: boolean;
  /** The numbers this fact allows in copy, as written ("500", "60", "1"). */
  numbers?: string[];
  /** A fact that may back a claim of this type: "result" | "price" | "saving" | "comparison" | "award" | "promise". */
  backs?: string[];
}

/** A customer's own words. Copy may quote them only verbatim. */
export interface CopyQuote {
  id: string;
  speaker: string;
  business?: string;
  original: string;
  translation?: string;
  source: string;
}

export interface CopyContext {
  brand: string;
  lang: Lang;
  /** Phrases only this brand can say (its names, products, mechanism, proof). A line with one passes the swap test. */
  anchors: string[];
  facts: CopyFact[];
  quotes: CopyQuote[];
  /** What the category says: competitors' lines, the brief's "every supplier says". The swap test reads it. */
  categoryLines: string[];
  /** The brand's or the brief's no-go phrases, each with why. */
  forbidden: { pattern: string; why: string }[];
  /** Words the Tone of Voice avoids. */
  avoidWords: string[];
  /** The brief, to catch a headline that only hands the brief back. */
  briefText?: string;
  /** No price promise and no savings figure anywhere (SGB, 8 Nov 2026). */
  noPriceOrSavings?: boolean;
  /** The brand already uses emoji in its own ads. */
  emojiAllowed?: boolean;
  /** Limits the brief sets over the registry's (SGB appendix D). */
  formatOverrides?: Record<string, Partial<import("./formats.ts").FormatSpec>>;
}
