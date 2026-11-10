// A brand's taste profile: its pictures' cards counted field by field (schema.ts). For every field it says what the
// brand does, how sure Fume is, and whether it is the brand's own constant or a choice a campaign made. From the
// profile come the taste score (how well Fume knows the brand's taste), the fit of one picture to the brand, and the
// gap between two sets of pictures (the brand's own against the Engine's). All of it is counting: the same cards
// always give the same profile.
import { type Answer, FIELD, FIELDS, type Field, GROUPS, type Shows } from "./schema.ts";

export type { Answer };
/** One picture read against the schema. */
export type Card = {
  id: string;
  /** Where it came from: the brand's site, an ad, an upload, the Engine. */
  source?: string;
  /** The campaign it belongs to, where known. */
  campaign?: string;
  shows?: Shows;
  /** schema key → number; a value under 0 for a field that cannot be negative means "could not be measured". */
  measured: Record<string, number>;
  /** schema key → the option, the options or the words; null where the field does not apply or cannot be told. */
  read: Record<string, Answer>;
};

export type Standing = "always" | "usually" | "by_campaign" | "free" | "unknown";
export type FieldProfile = {
  key: string;
  /** Pictures the field could be answered of. */
  n: number;
  standing: Standing;
  /** 0 to 1: how sure Fume is of `value` as the brand's habit (the lower bound of its share, or the tightness of a number). */
  confidence: number;
  /** choice: the commonest option; choices and words: the common ones; number: the median. */
  value: string | string[] | number | null;
  /** choice, choices, words: option → share of the pictures. */
  shares?: Record<string, number>;
  /** number: the middle half and the middle four fifths. */
  range?: { p10: number; p25: number; p75: number; p90: number };
  /** choice: options never seen although the brand has pictures enough to have shown them. */
  never?: string[];
  /** by_campaign: campaign → what it chose. */
  campaigns?: Record<string, string | number>;
};
export type Profile = { version: number; pictures: number; campaigns: number; fields: Record<string, FieldProfile> };

/** Fewer pictures than this and a field stays unknown. */
export const MIN_PICTURES = 5;
/** Pictures enough that an option never seen is probably never used (the rule of three: under 3/n). */
export const NEVER_AFTER = 15;

const q = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))]!;
/** The lower end of what a share may truly be, given how few pictures it was counted on (Wilson, 90%). */
export function lowerBound(yes: number, n: number): number {
  if (n === 0) return 0;
  const z = 1.645, p = yes / n;
  return Math.max(0, (p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n));
}
export const word = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N} -]/gu, "").replace(/\s+/g, " ").trim();
const unmeasured = (f: Field, v: number | undefined) => v === undefined || !Number.isFinite(v) || (v < 0 && (f.lo ?? 0) >= 0);

function numbers(f: Field, cards: Card[]): number[] {
  return cards.map((c) => c.measured[f.key]).filter((v): v is number => !unmeasured(f, v));
}
function answers(f: Field, cards: Card[]): string[][] {
  const out: string[][] = [];
  for (const c of cards) {
    const a = c.read[f.key];
    if (a === null || a === undefined) continue;
    const list = (Array.isArray(a) ? a : [a]).map((x) => (f.type === "words" ? word(x) : x)).filter(Boolean);
    if (list.length) out.push([...new Set(list)]);
  }
  return out;
}

function numberProfile(f: Field, cards: Card[], byCampaign: Map<string, Card[]>): FieldProfile {
  const xs = numbers(f, cards).sort((a, b) => a - b);
  const base: FieldProfile = { key: f.key, n: xs.length, standing: "unknown", confidence: 0, value: null };
  if (xs.length === 0) return base;
  const span = (f.hi ?? 1) - (f.lo ?? 0) || 1;
  if (f.circular) {
    // A hue: the mean direction, and how tightly the pictures gather round it.
    let x = 0, y = 0;
    for (const v of xs) (x += Math.cos((v * Math.PI) / 180)), (y += Math.sin((v * Math.PI) / 180));
    const r = Math.hypot(x, y) / xs.length;
    const value = Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
    const confidence = xs.length >= MIN_PICTURES ? r * (xs.length / (xs.length + 6)) : 0;
    return { ...base, value, confidence, standing: xs.length < MIN_PICTURES ? "unknown" : confidence >= 0.6 ? "always" : r >= 0.6 ? "usually" : "free" };
  }
  const range = { p10: q(xs, 0.1), p25: q(xs, 0.25), p75: q(xs, 0.75), p90: q(xs, 0.9) };
  const value = q(xs, 0.5);
  if (xs.length < MIN_PICTURES) return { ...base, value, range };
  // Tight when the middle four fifths of the pictures take up little of the range the field can take.
  const tight = Math.max(0, 1 - (range.p90 - range.p10) / (span * 0.4));
  const confidence = tight * (xs.length / (xs.length + 6));
  let standing: Standing = confidence >= 0.6 ? "always" : tight >= 0.6 ? "usually" : "free";
  let campaigns: Record<string, number> | undefined;
  if (standing === "free" && byCampaign.size >= 2) {
    const inside = [...byCampaign].map(([name, cs]) => ({ name, xs: numbers(f, cs).sort((a, b) => a - b) })).filter((c) => c.xs.length >= 3);
    if (inside.length >= 2 && inside.every((c) => (q(c.xs, 0.9) - q(c.xs, 0.1)) / (span * 0.4) <= 0.4)) {
      standing = "by_campaign";
      campaigns = Object.fromEntries(inside.map((c) => [c.name, q(c.xs, 0.5)]));
    }
  }
  return { ...base, value, range, confidence, standing, ...(campaigns ? { campaigns } : {}) };
}

function choiceProfile(f: Field, cards: Card[], byCampaign: Map<string, Card[]>): FieldProfile {
  const as = answers(f, cards);
  const n = as.length;
  const counts = new Map<string, number>();
  for (const a of as) for (const o of a) counts.set(o, (counts.get(o) ?? 0) + 1);
  const ranked = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const shares = Object.fromEntries(ranked.slice(0, 12).map(([o, c]) => [o, Math.round((c / n) * 100) / 100]));
  const base: FieldProfile = { key: f.key, n, standing: "unknown", confidence: 0, value: null, shares };
  if (n === 0) return { ...base, shares: {} };
  const [top, topCount] = ranked[0]!;
  const many = f.type !== "choice";
  const common = ranked.filter(([, c]) => c / n >= 0.5).map(([o]) => o);
  const value = many ? (common.length ? common : [top]) : top;
  if (n < MIN_PICTURES) return { ...base, value };
  const confidence = lowerBound(topCount, n);
  let standing: Standing = confidence >= 0.6 ? "always" : topCount / n >= 0.6 ? "usually" : "free";
  let campaigns: Record<string, string> | undefined;
  if (standing === "free" && !many && byCampaign.size >= 2) {
    const inside = [...byCampaign].map(([name, cs]) => {
      const own = answers(f, cs).map((a) => a[0]!);
      const tally = new Map<string, number>();
      for (const o of own) tally.set(o, (tally.get(o) ?? 0) + 1);
      const best = [...tally].sort((a, b) => b[1] - a[1])[0];
      return { name, n: own.length, best: best?.[0], share: best ? best[1] / own.length : 0 };
    }).filter((c) => c.n >= 3);
    if (inside.length >= 2 && inside.every((c) => c.share >= 0.8) && new Set(inside.map((c) => c.best)).size > 1) {
      standing = "by_campaign";
      campaigns = Object.fromEntries(inside.map((c) => [c.name, c.best!]));
    }
  }
  const never = f.type === "choice" && n >= NEVER_AFTER ? (f.options ?? []).filter((o) => !counts.has(o)) : undefined;
  return { ...base, value, confidence, standing, ...(never?.length ? { never } : {}), ...(campaigns ? { campaigns } : {}) };
}

export function buildProfile(cards: Card[]): Profile {
  const byCampaign = new Map<string, Card[]>();
  for (const c of cards) if (c.campaign) byCampaign.set(c.campaign, [...(byCampaign.get(c.campaign) ?? []), c]);
  const fields: Record<string, FieldProfile> = {};
  for (const f of FIELDS) fields[f.key] = f.type === "number" ? numberProfile(f, cards, byCampaign) : choiceProfile(f, cards, byCampaign);
  return { version: 1, pictures: cards.length, campaigns: byCampaign.size, fields };
}

// ─── The taste score ─────────────────────────────────────────────────────────

export type TasteScore = {
  /** 0 to 100: how well Fume knows this brand's taste. */
  score: number;
  parts: { key: "evidence" | "coverage" | "certainty" | "breadth" | "proof"; label: string; points: number; of: number; why: string }[];
  /** What would raise it most, first. */
  next: string[];
};

/**
 * How well the brand's taste is trained. Evidence: how many pictures. Coverage: how much of the schema they answer.
 * Certainty: how much of what they answer is settled (a habit, a campaign's choice, or known to be free). Breadth:
 * how many campaigns, so a campaign's choice is not taken for the brand. Proof: how close the Engine's own pictures
 * come to the brand's (fit, 0 to 1), which is the only part that shows the knowledge works; none until it is tested.
 */
export function tasteScore(profile: Profile, proof: { engineFit: number; ownFit: number; own?: number; left?: number; kinds?: Proof["kinds"] } | null = null): TasteScore {
  const fs = Object.values(profile.fields);
  const n = profile.pictures;
  const evidence = n / (n + 40);
  const known = fs.filter((f) => f.n >= MIN_PICTURES);
  // A field no picture could answer (people fields for a brand that shows none) is knowledge too, once there are pictures
  // enough. A read field is held against the pictures that were read: a picture only measured answers no read field,
  // and that says nothing of the brand.
  const read = Math.max(0, ...fs.filter((f) => FIELD.get(f.key)?.type !== "number").map((f) => f.n));
  const absent = fs.filter((f) => {
    const of = FIELD.get(f.key)?.type === "number" ? n : read;
    return of >= 20 && f.n / of < 0.1;
  });
  const coverage = (known.length + absent.filter((f) => f.n < MIN_PICTURES).length) / fs.length;
  const settled = known.filter((f) => f.standing === "always" || f.standing === "by_campaign" || (f.n >= 20 && f.standing !== "unknown"));
  const certainty = known.length ? settled.length / fs.length : 0;
  const breadth = Math.min(1, profile.campaigns / 5);
  // Where the pictures were held against their own kind, proof is how far the Engine's come from the floor (the brand's
  // other kinds of picture) to the brand's own of that kind; else how close they come to the brand's own at all.
  const ofKinds = Object.values(proof?.kinds ?? {}).filter((k) => k.ownFit > 0);
  const share = (k: KindProof) => Math.max(0, Math.min(1, k.floor !== undefined && k.ownFit > k.floor ? (k.engineFit - k.floor) / (k.ownFit - k.floor) : k.engineFit / k.ownFit));
  const proven = ofKinds.length
    ? ofKinds.reduce((s, k) => s + k.engine * share(k), 0) / ofKinds.reduce((s, k) => s + k.engine, 0)
    : proof && proof.ownFit > 0 ? Math.min(1, proof.engineFit / proof.ownFit) : 0;
  const kindWords: Record<string, string> = { product_alone: "product pictures", people: "pictures with people" };
  const proofWhy = !proof ? "Not tested yet" : ofKinds.length
    ? Object.entries(proof.kinds!).map(([k, p]) => `The Engine's ${kindWords[k] ?? k} fit ${Math.round(p.engineFit * 100)}%, the brand's own ${Math.round(p.ownFit * 100)}%${p.floor !== undefined ? `, the brand's other pictures ${Math.round(p.floor * 100)}%` : ""} (${p.engine} against ${p.own})`).join("; ")
    : `The Engine's pictures fit ${Math.round(proof.engineFit * 100)}%, the brand's own ${Math.round(proof.ownFit * 100)}%${proof.own ? `, counted on ${proof.own} photographs${proof.left ? ` (${proof.left} other pictures left out)` : ""}` : ""}`;
  const part = (key: TasteScore["parts"][number]["key"], label: string, share: number, of: number, why: string) => ({ key, label, points: Math.round(share * of), of, why });
  const parts = [
    part("evidence", "Pictures", evidence, 30, `${n} picture${n === 1 ? "" : "s"} read`),
    part("coverage", "Coverage", coverage, 20, `${known.length} of ${fs.length} fields answered by ${MIN_PICTURES} pictures or more`),
    part("certainty", "Certainty", certainty, 20, `${settled.length} fields settled`),
    part("breadth", "Breadth", breadth, 10, `${profile.campaigns} campaign${profile.campaigns === 1 ? "" : "s"}`),
    part("proof", "Proof", proven, 20, proofWhy),
  ];
  const next: string[] = [];
  if (n < 40) next.push(`Add pictures: ${n} read, the score climbs fastest up to about 100.`);
  if (profile.campaigns < 3) next.push("Add pictures from more campaigns, so a campaign's choice is not taken for the brand's habit.");
  if (!proof) next.push("Test: let the Engine make pictures from this profile and measure how close they come.");
  for (const g of GROUPS) {
    const own = fs.filter((f) => FIELD.get(f.key)?.group === g.key);
    const thin = own.filter((f) => f.n < MIN_PICTURES).length;
    if (own.length >= 8 && thin / own.length > 0.6 && n >= MIN_PICTURES) next.push(`Few pictures answer "${g.label}" (${own.length - thin} of ${own.length} fields).`);
  }
  return { score: parts.reduce((s, p) => s + p.points, 0), parts, next: next.slice(0, 5) };
}

// ─── One picture against the brand ───────────────────────────────────────────

export type Gap = { key: string; label: string; group: string; lever: Field["lever"]; weight: number; closeness: number; brand: string; picture: string };

const show = (v: string | string[] | number | null | undefined) => (v === null || v === undefined ? "" : Array.isArray(v) ? v.join(", ") : String(v)).replaceAll("_", " ");

/** How close one value is to the brand's habit, 0 to 1. */
function closeness(f: Field, fp: FieldProfile, card: Card): number | null {
  if (f.type === "number") {
    const v = card.measured[f.key];
    if (unmeasured(f, v) || !fp.range) return null;
    if (f.circular) return null;
    const { p10, p90 } = fp.range;
    if (v! >= p10 && v! <= p90) return 1;
    const span = (f.hi ?? 1) - (f.lo ?? 0) || 1;
    const room = Math.max(p90 - p10, span * 0.08);
    return Math.max(0, 1 - (v! < p10 ? p10 - v! : v! - p90) / room);
  }
  const a = card.read[f.key];
  if (a === null || a === undefined) return null;
  const list = (Array.isArray(a) ? a : [a]).map((x) => (f.type === "words" ? word(x) : x));
  if (!list.length || !fp.shares) return null;
  const top = Math.max(...Object.values(fp.shares), 0.0001);
  // As common in the brand's pictures as its commonest answer scores 1; an answer the brand never gave scores 0.
  return Math.min(1, mean(list.map((o) => (fp.shares![o] ?? 0) / top)));
}
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * The fit of a picture to the brand, 0 to 1, over the fields the brand keeps to (always or usually), each weighed by
 * how sure Fume is of it; and the gaps, widest first. Free words and fields a campaign chooses are left out.
 */
export function fit(profile: Profile, card: Card, opts: { levers?: Field["lever"][]; skip?: string[] } = {}): { fit: number; counted: number; gaps: Gap[] } {
  const gaps: Gap[] = [];
  let sum = 0, weights = 0;
  for (const fp of Object.values(profile.fields)) {
    const f = FIELD.get(fp.key);
    if (!f || f.type === "words" || (fp.standing !== "always" && fp.standing !== "usually")) continue;
    if ((opts.levers && !opts.levers.includes(f.lever)) || opts.skip?.includes(f.key)) continue;
    const c = closeness(f, fp, card);
    if (c === null) continue;
    const weight = fp.confidence * (fp.standing === "always" ? 1 : 0.6);
    sum += weight * c;
    weights += weight;
    if (c < 0.999)
      gaps.push({
        key: f.key, label: f.label, group: f.group, lever: f.lever, weight, closeness: c,
        brand: f.type === "number" && fp.range ? `${fp.range.p10} to ${fp.range.p90} ${f.unit ?? ""}`.trim() : show(fp.value),
        picture: f.type === "number" ? String(card.measured[f.key]) : show(card.read[f.key]),
      });
  }
  gaps.sort((a, b) => b.weight * (1 - b.closeness) - a.weight * (1 - a.closeness));
  return { fit: weights ? sum / weights : 0, counted: gaps.length, gaps };
}

// ─── Proof: the Engine's pictures against the brand's, like with like ────────

/** A picture with a photograph in it, alone or under words: what a picture the Engine made can be held against. A
 *  card of type alone, or a screenshot with no photograph, says nothing about how the brand shoots. */
export function photographic(c: Card): boolean {
  const type = c.read["kind.type"], under = c.read["kind.picture_under_graphics"];
  return type === "photograph" || type === "photograph_with_graphics" || type === "video_frame" || under === "full_photograph";
}

// A brand does not make every kind of picture the same way: Nike's shoe alone is a studio picture on a plain ground,
// its athletes are outdoors and in motion. Counted together, the two cancel out, every field looks free, and any
// picture fits. So the brand's pictures are also counted kind by kind, and a picture is held against its own kind.
export const KINDS = ["product_alone", "people"] as const;
export type Kind = (typeof KINDS)[number];
/** Pictures of a kind a brand needs before the kind has habits of its own. */
export const MIN_KIND = 15;
/** The kind of a picture from what it shows: people in it, or the product with no one. Null for anything else (type
 *  alone, a place) and for a picture nobody read. */
export function kindOf(shows: Partial<Shows> | null | undefined): Kind | null {
  if (!shows) return null;
  return shows.people ? "people" : shows.product ? "product_alone" : null;
}
/** The brand's cards of each kind it has pictures enough of. */
export function byKind(cards: Card[]): Partial<Record<Kind, Card[]>> {
  const out: Partial<Record<Kind, Card[]>> = {};
  for (const k of KINDS) {
    const own = cards.filter((c) => kindOf(c.shows) === k);
    if (own.length >= MIN_KIND) out[k] = own;
  }
  return out;
}

export type KindProof = {
  engineFit: number;
  ownFit: number;
  own: number;
  engine: number;
  /** How the brand's pictures of its other kinds fit this kind: what a picture scores that is the brand's but not this
   *  kind. The Engine's pictures have shown they know the kind only by as much as they fit better than that. */
  floor?: number;
};
export type Proof = {
  engineFit: number;
  ownFit: number;
  own: number;
  engine: number;
  left: number;
  /** The same, for each kind of picture both the brand and the Engine have: the Engine's against the brand's of that kind. */
  kinds?: Partial<Record<Kind, KindProof>>;
};
/** What the Engine's picture carries before the design layer sets words on it. */
const PICTURE_LEVERS: Field["lever"][] = ["plan", "prompt", "reference", "finish", "select"];

/**
 * How close the Engine's pictures come to the brand's, counted like with like: only the brand's pictures with a
 * photograph in them, and only the fields a photograph carries (not the words and the logo set on it). The brand's own
 * fit is each of its pictures against a profile built without it, so it does not praise itself. Null until the brand
 * has photographs enough to say what its habit is.
 */
export function proofOf(brand: Card[], engine: Card[]): Proof | null {
  const told = brand.some((c) => c.read["kind.type"]);
  const like = told ? brand.filter(photographic) : brand;
  if (like.length <= MIN_PICTURES || engine.length === 0) return null;
  const whole = buildProfile(like);
  // Whether words are set on the picture is the design layer's doing, although the plan decides it.
  const opts = { levers: PICTURE_LEVERS, skip: ["kind.type"] };
  // A picture is held against the brand's pictures of its own kind where the brand has enough of them, else against all.
  const sets = byKind(like);
  const profiles = Object.fromEntries(Object.entries(sets).map(([k, cs]) => [k, buildProfile(cs)])) as Partial<Record<Kind, Profile>>;
  const against = (c: Card) => profiles[kindOf(c.shows) ?? ("" as Kind)] ?? whole;
  const without = (c: Card) => buildProfile((sets[kindOf(c.shows) ?? ("" as Kind)] ?? like).filter((x) => x.id !== c.id));
  const engineFits = engine.map((c) => ({ kind: kindOf(c.shows), fit: fit(against(c), c, opts).fit }));
  const ownFits = like.map((c) => ({ kind: kindOf(c.shows), fit: fit(without(c), c, opts).fit }));
  const kinds: Partial<Record<Kind, KindProof>> = {};
  for (const k of KINDS) {
    const e = engineFits.filter((x) => x.kind === k), o = ownFits.filter((x) => x.kind === k);
    if (!sets[k] || !e.length) continue;
    const others = like.filter((c) => kindOf(c.shows) !== null && kindOf(c.shows) !== k);
    kinds[k] = {
      engineFit: mean(e.map((x) => x.fit)), ownFit: mean(o.map((x) => x.fit)), own: o.length, engine: e.length,
      ...(others.length >= MIN_PICTURES ? { floor: mean(others.map((c) => fit(profiles[k]!, c, opts).fit)) } : {}),
    };
  }
  return {
    engineFit: mean(engineFits.map((x) => x.fit)),
    ownFit: mean(ownFits.map((x) => x.fit)),
    own: like.length,
    engine: engine.length,
    left: brand.length - like.length,
    ...(Object.keys(kinds).length ? { kinds } : {}),
  };
}

// ─── Two sets of pictures against each other ─────────────────────────────────

export type SetGap = { key: string; label: string; group: string; lever: Field["lever"]; how: Field["how"]; standing: Standing; confidence: number; distance: number; brand: string; other: string };

/**
 * Where another set of pictures (the Engine's) departs from the brand's own, field by field, widest and surest first.
 * Distance is 0 to 1: for a choice, how much of the pictures would have to change their answer; for a number, how far
 * the other set's median lies outside the brand's middle four fifths.
 */
export function compare(brand: Profile, other: Profile): SetGap[] {
  const out: SetGap[] = [];
  for (const fp of Object.values(brand.fields)) {
    const f = FIELD.get(fp.key);
    const op = other.fields[fp.key];
    if (!f || !op || f.type === "words" || fp.n < 3 || op.n < 3) continue;
    let distance = 0;
    if (f.type === "number") {
      if (f.circular || !fp.range || typeof op.value !== "number") continue;
      const span = (f.hi ?? 1) - (f.lo ?? 0) || 1;
      const room = Math.max(fp.range.p90 - fp.range.p10, span * 0.08);
      const v = op.value;
      distance = v >= fp.range.p10 && v <= fp.range.p90 ? 0 : Math.min(1, (v < fp.range.p10 ? fp.range.p10 - v : v - fp.range.p90) / room);
    } else {
      const keys = new Set([...Object.keys(fp.shares ?? {}), ...Object.keys(op.shares ?? {})]);
      for (const k of keys) distance += Math.abs((fp.shares?.[k] ?? 0) - (op.shares?.[k] ?? 0));
      distance = Math.min(1, distance / 2);
    }
    if (distance <= 0.001) continue;
    out.push({
      key: f.key, label: f.label, group: f.group, lever: f.lever, how: f.how, standing: fp.standing, confidence: fp.confidence, distance,
      brand: f.type === "number" && fp.range ? `${fp.value} (${fp.range.p10} to ${fp.range.p90})` : describe(fp),
      other: f.type === "number" ? String(op.value) : describe(op),
    });
  }
  const rank = (g: SetGap) => g.distance * (0.25 + g.confidence);
  return out.sort((a, b) => rank(b) - rank(a));
}
/** The answers of a field with their shares, commonest first: "full body 60%, waist up 40%". */
export function describe(fp: FieldProfile): string {
  if (!fp.shares) return show(fp.value);
  return Object.entries(fp.shares).slice(0, 3).map(([o, s]) => `${o.replaceAll("_", " ")} ${Math.round(s * 100)}%`).join(", ");
}
