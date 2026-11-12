// From a brand's cards to everything kept about its taste: the profile, the Engine's own profile where a round of its
// pictures was read, the proof, the score and the direction. One function, so the edge function and the tools count
// the same way. Also what a card sent from outside is cleaned to before it is kept: only the schema's own fields, and
// only answers the schema lists.
import { direction, type Direction } from "./direction.ts";
import { buildProfile, byKind, type Card, type Kind, kindOf, photographic, type Profile, type Proof, proofOf, tasteScore, type TasteScore, word } from "./profile.ts";
import { type Answer, FIELD, type Shows, TASTE_SCHEMA_VERSION } from "./schema.ts";

export type Built = { schema_version: number; profile: Profile; engine: Profile | null; proof: Proof | null; score: TasteScore; direction: Direction };

/** A card with no photograph in it (type alone, a drawing) has no finish of a photograph: its grain, black point and
 *  tints are a designer's flat colours, and would be taken for how the brand finishes its photographs. Where the
 *  cards were read, such a card's finish numbers are not counted. */
export function finishOfPhotographs(cards: Card[]): Card[] {
  if (!cards.some((c) => c.read["kind.type"])) return cards;
  return cards.map((c) => (photographic(c) ? c : { ...c, measured: Object.fromEntries(Object.entries(c.measured).filter(([k]) => FIELD.get(k)?.lever !== "finish")) }));
}

export function build(brand: Card[], engine: Card[] = []): Built {
  const profile = buildProfile(finishOfPhotographs(brand));
  const own = engine.length ? buildProfile(finishOfPhotographs(engine)) : null;
  const proof = proofOf(brand, engine);
  // Kind by kind: the brand's pictures of a kind against the Engine's of the same kind (three or more, else untested).
  const kinds: Partial<Record<Kind, Direction>> = {};
  for (const [k, cards] of Object.entries(byKind(brand)) as [Kind, Card[]][]) {
    const theirs = engine.filter((c) => kindOf(c.shows) === k);
    kinds[k] = direction(buildProfile(finishOfPhotographs(cards)), theirs.length >= 3 ? buildProfile(finishOfPhotographs(theirs)) : null);
  }
  const whole = direction(profile, own);
  return {
    schema_version: TASTE_SCHEMA_VERSION, profile, engine: own, proof, score: tasteScore(profile, proof),
    direction: Object.keys(kinds).length ? { ...whole, kinds } : whole,
  };
}

/** The measured half of a card as sent: the schema's measured fields with a number, nothing else. */
export function cleanMeasured(x: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (typeof x !== "object" || x === null || Array.isArray(x)) return out;
  for (const [k, v] of Object.entries(x)) if (FIELD.get(k)?.how === "measured" && typeof v === "number" && Number.isFinite(v)) out[k] = v;
  return out;
}

/** The read half of a card as sent: the schema's read fields, an option the schema lists or words; anything else is null. */
export function cleanRead(x: unknown): Record<string, Answer> {
  const out: Record<string, Answer> = {};
  if (typeof x !== "object" || x === null || Array.isArray(x)) return out;
  for (const [k, v] of Object.entries(x)) {
    const f = FIELD.get(k);
    if (!f || f.how !== "read") continue;
    if (f.type === "choice") out[k] = typeof v === "string" && f.options!.includes(v) ? v : null;
    else {
      const list = (Array.isArray(v) ? v : typeof v === "string" ? [v] : []).filter((s): s is string => typeof s === "string");
      const kept = f.type === "choices" ? list.filter((s) => f.options!.includes(s)) : list.map((s) => word(s).slice(0, 60)).filter(Boolean);
      out[k] = kept.length ? [...new Set(kept)].slice(0, 5) : null;
    }
  }
  return out;
}

const SHOWN: (keyof Shows)[] = ["people", "face", "severalPeople", "product", "words", "logo", "outdoors"];
export function cleanShows(x: unknown): Shows | null {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return null;
  return Object.fromEntries(SHOWN.map((k) => [k, (x as Record<string, unknown>)[k] === true])) as Shows;
}
