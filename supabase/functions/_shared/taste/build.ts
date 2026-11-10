// From a brand's cards to everything kept about its taste: the profile, the Engine's own profile where a round of its
// pictures was read, the proof, the score and the direction. One function, so the edge function and the tools count
// the same way. Also what a card sent from outside is cleaned to before it is kept: only the schema's own fields, and
// only answers the schema lists.
import { direction, type Direction } from "./direction.ts";
import { buildProfile, type Card, type Profile, type Proof, proofOf, tasteScore, type TasteScore, word } from "./profile.ts";
import { type Answer, FIELD, type Shows, TASTE_SCHEMA_VERSION } from "./schema.ts";

export type Built = { schema_version: number; profile: Profile; engine: Profile | null; proof: Proof | null; score: TasteScore; direction: Direction };

export function build(brand: Card[], engine: Card[] = []): Built {
  const profile = buildProfile(brand);
  const own = engine.length ? buildProfile(engine) : null;
  const proof = proofOf(brand, engine);
  return { schema_version: TASTE_SCHEMA_VERSION, profile, engine: own, proof, score: tasteScore(profile, proof), direction: direction(profile, own) };
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
