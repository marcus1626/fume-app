// The brand's taste profile written as direction: what the plan writer, the picture prompt, the finish step and the
// design layer are told. The profile (profile.ts) says what the brand does; this says it to whoever makes the next
// picture, in the order that matters. Three things decide the order. How sure Fume is of the habit. Whether the habit
// is something the picture has, or something it leaves out (long lists of what to avoid make image models worse, so
// absences are kept few). And, once the Engine has made pictures for the brand and they were read against the same
// schema, where those pictures departed from the brand's own: what the Engine missed last time is said first, and
// what it gets right without being told is said last. That is how a test round teaches the next prompt.
//
// All of it is counting and fixed wording: the same profile always gives the same direction.
import { applies, FIELD, type Field, type Lever, type Shows, TASTE_SCHEMA_VERSION, type When } from "./schema.ts";
import { compare, type FieldProfile, type Kind, kindOf, KINDS, type Profile, type SetGap } from "./profile.ts";

export type Line = {
  key: string;
  group: string;
  lever: Lever;
  when: When;
  standing: "always" | "usually";
  /** 0 to 1: how sure Fume is of the habit. */
  confidence: number;
  /** The share of the brand's pictures that do it. */
  share: number;
  /** The habit in words: "Camera, depth of field: deep". */
  says: string;
  /** The habit is that something is not there ("Design: no badge"). */
  absence: boolean;
  /** Where the Engine's own pictures of this brand departed: what they did instead, and how far (0 to 1). */
  miss?: { engine: string; distance: number };
  /** How much the line matters now, for the order. */
  weight: number;
};
/** A number the brand's pictures keep to, for the finish step and for judging a picture. */
export type Target = {
  key: string;
  label: string;
  group: string;
  lever: Lever;
  unit?: string;
  value: number;
  lo: number;
  hi: number;
  standing: "always" | "usually";
  confidence: number;
  miss?: { engine: number; distance: number };
};
/** A field a campaign chooses: the plan must take it from the campaign, never from habit. */
export type Choice = { key: string; label: string; group: string; lever: Lever; campaigns: Record<string, string | number> };
export type Direction = {
  schema: number;
  pictures: number;
  campaigns: number;
  /** The Engine's own pictures of this brand were read and compared. */
  tested: boolean;
  lines: Line[];
  targets: Target[];
  choices: Choice[];
  /** Options the brand has never used, with pictures enough to say so. */
  never: { key: string; label: string; options: string[] }[];
  /** The same for each kind of picture the brand has enough of (profile.ts KINDS): how it makes the product alone, how
   *  it makes pictures with people. A picture of a kind takes its direction from here. */
  kinds?: Partial<Record<Kind, Direction>>;
};

const NOUN: Record<string, string> = {
  kind: "Picture", concept: "Idea", mood: "Mood", people: "People", styling: "Wardrobe", product: "Product", setting: "Setting",
  camera: "Camera", light: "Light", colour: "Colour", finish: "Finish", composition: "Composition", design: "Design", format: "Format",
};
const KIND_HEAD: Record<Kind, string> = {
  product_alone: "WHEN THE PICTURE IS THE PRODUCT WITH NO PEOPLE, the brand does this",
  people: "WHEN THE PICTURE HAS PEOPLE IN IT, the brand does this",
};
const GONE = new Set(["none", "nothing", "no"]);
const UNSEEN = new Set(["not_visible", "not_shown"]);
const plain = (s: string) => s.replaceAll("_", " ");
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** The habit in words, and whether it is an absence. */
export function say(f: Field, value: string | string[]): { says: string; absence: boolean } {
  const noun = NOUN[f.group] ?? f.group;
  const list = Array.isArray(value) ? value : [value];
  if (list.length === 1 && (GONE.has(list[0]!) || /^no_/.test(list[0]!))) return { says: `${noun}: no ${lower(f.label)}`, absence: true };
  // "Ground shown" that is "not shown" is "ground not shown".
  if (list.length === 1 && UNSEEN.has(list[0]!)) return { says: `${noun}: ${lower(f.label).replace(/ (shown|visible)$/, "")} ${plain(list[0]!)}`, absence: true };
  const what = list.map(plain).join(", ");
  // "Wardrobe, wardrobe: sportswear" is "Wardrobe: sportswear".
  return { says: f.label.toLowerCase() === noun.toLowerCase() ? `${noun}: ${what}` : `${noun}, ${lower(f.label)}: ${what}`, absence: false };
}

const kept = (fp: FieldProfile): fp is FieldProfile & { standing: "always" | "usually" } => fp.standing === "always" || fp.standing === "usually";
const topShare = (fp: FieldProfile) => Math.max(0, ...Object.values(fp.shares ?? {}));

/**
 * The direction a brand's profile gives. `engine` is the profile of the Engine's own pictures for the brand, where a
 * test round was read: with it, what the Engine missed weighs up to twice as much and what it already does weighs a
 * third.
 */
export function direction(profile: Profile, engine: Profile | null = null): Direction {
  const missed = new Map<string, SetGap>();
  if (engine) for (const g of compare(profile, engine)) missed.set(g.key, g);
  const tested = (key: string) => Boolean(engine && (engine.fields[key]?.n ?? 0) >= 3);
  const lines: Line[] = [];
  const targets: Target[] = [];
  const choices: Choice[] = [];
  const never: Direction["never"] = [];

  for (const fp of Object.values(profile.fields)) {
    const f = FIELD.get(fp.key);
    if (!f) continue;
    if (fp.standing === "by_campaign" && fp.campaigns) choices.push({ key: f.key, label: f.label, group: f.group, lever: f.lever, campaigns: fp.campaigns });
    if (fp.never?.length) never.push({ key: f.key, label: f.label, options: fp.never });
    if (!kept(fp) || fp.value === null) continue;
    const gap = missed.get(f.key);
    if (f.type === "number") {
      if (typeof fp.value !== "number" || !fp.range || f.circular) continue;
      targets.push({
        key: f.key, label: f.label, group: f.group, lever: f.lever, ...(f.unit ? { unit: f.unit } : {}),
        value: fp.value, lo: fp.range.p10, hi: fp.range.p90, standing: fp.standing, confidence: fp.confidence,
        ...(gap && typeof engine?.fields[f.key]?.value === "number" ? { miss: { engine: engine.fields[f.key]!.value as number, distance: gap.distance } } : {}),
      });
      continue;
    }
    // Free words are a description, not a habit to hold a picture to.
    if (f.type === "words" || typeof fp.value === "number") continue;
    const { says, absence } = say(f, fp.value);
    const learned = tested(f.key) ? 0.33 + 1.67 * (gap?.distance ?? 0) : 1;
    lines.push({
      key: f.key, group: f.group, lever: f.lever, when: f.when, standing: fp.standing, confidence: fp.confidence, share: topShare(fp), says, absence,
      ...(gap ? { miss: { engine: gap.other, distance: gap.distance } } : {}),
      weight: fp.confidence * (fp.standing === "always" ? 1 : 0.7) * (absence ? 0.5 : 1) * learned,
    });
  }
  // "No button" makes "no button place" and "no button shape" say nothing.
  const gone = new Set(lines.filter((l) => l.absence).map((l) => l.key));
  const said = lines.filter((l) => !(l.absence && [...gone].some((k) => k !== l.key && l.key.startsWith(`${k}_`))));
  said.sort((a, b) => b.weight - a.weight || a.key.localeCompare(b.key));
  targets.sort((a, b) => (b.miss?.distance ?? 0) - (a.miss?.distance ?? 0) || b.confidence - a.confidence || a.key.localeCompare(b.key));
  return { schema: TASTE_SCHEMA_VERSION, pictures: profile.pictures, campaigns: profile.campaigns, tested: Boolean(engine), lines: said, targets, choices, never };
}

/** Where a picture is: on a plain ground or a set, or out in a real place. */
export type Place = "studio" | "world";
/** What the picture to be made will show, as far as the plan says; what the plan does not say is taken as not there.
 *  `place` is where the plan sets it, when the plan says. */
export type Planned = Partial<Shows> & { place?: Place };
const shown = (p: Planned): Shows => ({ people: false, face: false, severalPeople: false, product: true, words: false, logo: false, outdoors: false, ...p });

/** The direction for one picture: its own kind's where the brand has pictures enough of that kind, else the brand's whole. */
export function directionFor(d: Direction, planned: Planned = {}): Direction {
  return d.kinds?.[kindOf(shown(planned)) ?? ("" as Kind)] ?? d;
}

// The brief decides what a picture is of and where it is; the brand's taste decides how it is made. A habit that
// describes the place itself (a pristine, dry, plain studio ground with no trace of use) says nothing true about a wet
// street the brief asked for: in the first round with taste (Nike UK, 10 Nov 2026) seven of a prompt's twelve lines
// were studio habits written into street scenes, and the habits of craft that hold anywhere (deep focus, no blur
// behind, clean edges) were crowded out or contradicted.
const PLACE_KEYS = new Set(["kind.capture", "light.sky", "colour.sky_colour", "colour.background_colour"]);
/** A field that describes where the picture is, not how it is made. */
export const ofThePlace = (key: string): boolean => key.startsWith("setting.") || PLACE_KEYS.has(key);
const STUDIO = /\b(plain studio|built set|empty void)\b/;
/** Where the brand's pictures of this kind are, when they keep to one kind of place. */
export function habitualPlace(d: Direction): Place | null {
  const type = d.lines.find((l) => l.key === "setting.type");
  return type ? (STUDIO.test(type.says) ? "studio" : "world") : null;
}
/** The plan sets this picture somewhere else than the brand's pictures of its kind usually are: the habits of that
 *  place do not apply to it, the habits of craft still do. */
export function awayFromHabit(d: Direction, planned: Planned = {}): boolean {
  const usual = habitualPlace(directionFor(d, planned));
  return Boolean(planned.place && usual && planned.place !== usual);
}

/** The dimension of a brand rule (engine/context.ts) a group's lines belong to: it decides the slot of the prompt. */
const DIMENSION: Record<string, string> = {
  camera: "camera", light: "light", colour: "colour grade", finish: "texture", composition: "composition", people: "people", styling: "people",
  setting: "setting", product: "product", kind: "taste", concept: "taste", mood: "taste",
};
export type PromptLine = { id: string; dimension: string; statement: string; key: string; weight: number };

/**
 * The lines one picture prompt takes: only what the photograph itself carries (not the plan's choices, the design
 * layer or the finish step), only what applies to what the picture will show, the weightiest first, with few absences.
 * Where the plan sets the picture away from the brand's usual place, the habits of that place are left out.
 */
export function promptLines(d: Direction, planned: Planned = {}, most = 16, mostAbsences = 3): PromptLine[] {
  const s = shown(planned);
  const away = awayFromHabit(d, planned);
  const out: PromptLine[] = [];
  let absences = 0;
  for (const l of directionFor(d, planned).lines) {
    if (out.length >= most) break;
    if (l.lever !== "prompt" && l.lever !== "reference") continue;
    if (away && ofThePlace(l.key)) continue;
    const f = FIELD.get(l.key);
    if (!f || !applies(f, s) || !DIMENSION[l.group]) continue;
    if (l.absence && ++absences > mostAbsences) continue;
    const often = l.standing === "always" ? "" : ` (${Math.round(l.share * 100)} % of the brand's pictures)`;
    const last = l.miss && l.miss.distance >= 0.3 ? ` Earlier Engine pictures had ${l.miss.engine}.` : "";
    out.push({ id: `schema-${l.key}`, dimension: DIMENSION[l.group]!, statement: `${l.says}${often}.${last}`, key: l.key, weight: l.weight });
  }
  return out;
}

/**
 * The direction for the plan writer, as text: what the brand's pictures are of and how they are made, group by group,
 * what a campaign chooses, and what the brand has never done. The plan decides the idea, the people and the place, so
 * it gets every lever but the finish step.
 */
export function planBrief(d: Direction, most = 80, mostOfAKind = 40): string {
  const planLines = (x: Direction) => x.lines.filter((l) => l.lever !== "finish" && l.lever !== "select");
  const grouped = (ls: Line[]) => {
    const byGroup = new Map<string, string[]>();
    for (const l of ls) {
      const share = l.standing === "always" ? "always" : `${Math.round(l.share * 100)} %`;
      const miss = l.miss && l.miss.distance >= 0.3 ? `; earlier Engine pictures: ${l.miss.engine}` : "";
      byGroup.set(l.group, [...(byGroup.get(l.group) ?? []), `- ${l.says} (${share}${miss})`]);
    }
    return [...byGroup].map(([g, ls]) => `${NOUN[g] ?? g}\n${ls.join("\n")}`);
  };
  const whole = planLines(d).slice(0, most);
  const parts = grouped(whole);
  // What the brand does only in one kind of picture: said under that kind, and only what the whole did not say already.
  const saidOfAll = new Set(whole.map((l) => `${l.key}=${l.says}`));
  for (const k of KINDS) {
    const own = d.kinds?.[k];
    if (!own) continue;
    const only = planLines(own).filter((l) => !saidOfAll.has(`${l.key}=${l.says}`)).slice(0, mostOfAKind);
    if (only.length) parts.push(`${KIND_HEAD[k]} (${own.pictures} of the brand's pictures)\n${grouped(only).join("\n")}`);
  }
  // A campaign's numbers (its sharpness, its size) are for the finish step and the judge, not for the plan.
  const chosen = d.choices.filter((c) => Object.values(c.campaigns).every((v) => typeof v === "string"));
  if (chosen.length)
    parts.push(`A campaign chooses these; take them from this campaign, not from habit\n${chosen.map((c) => `- ${NOUN[c.group] ?? c.group}, ${lower(c.label)}: ${Object.entries(c.campaigns).map(([k, v]) => `${k}: ${plain(String(v))}`).join("; ")}`).join("\n")}`);
  if (d.never.length)
    parts.push(`Never seen in the brand's pictures\n${d.never.slice(0, 20).map((n) => `- ${NOUN[FIELD.get(n.key)?.group ?? ""] ?? ""}, ${lower(n.label)}: ${n.options.map(plain).join(", ")}`).join("\n")}`);
  return parts.join("\n\n");
}

/** The numbers the finish step brings the pixels to: grain, black and white points, tints, sharpness. */
export const finishTargets = (d: Direction): Target[] => d.targets.filter((t) => t.lever === "finish");
