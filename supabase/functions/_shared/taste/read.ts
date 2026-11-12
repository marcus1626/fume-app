// The half of a card a vision model reads (schema.ts: the `read` fields). The schema is too long for one question, so
// a picture is read in passes (schema.ts PASSES): `idea` first, which also says what the picture shows, then the
// passes that apply. Every pass gets its question and its answer shape from the registry, so a field added there is
// asked without another line here.
//
// The answer shape has no optional and no either-or parts (the model's structured answers allow few of those): a
// choice the model cannot make is the option CANNOT_TELL, a list that does not apply comes back empty, and both are
// kept as null on the card.
import { z } from "npm:zod@4.6.7";
import { type Answer, applies, type Field, GROUPS, type Pass, PASSES, readFields, type Shows } from "./schema.ts";

export const CANNOT_TELL = "cannot_tell";
/** The most options a `choices` field keeps, and the most phrases a `words` field keeps. */
export const MOST = { choices: 4, words: 5 };

/** What `idea` says a picture shows, as the statements a reader answers yes or no to. */
export const SHOWS: [keyof Shows, string][] = [
  ["people", "At least one person, or a part of one, is in the picture."],
  ["face", "At least one face can be seen well enough to read its expression."],
  ["severalPeople", "Two or more people are in the picture."],
  ["product", "A product the advertiser sells is in the picture (worn, used or shown)."],
  ["words", "Words are set on the picture as graphics (a headline, a line, a button). Words on clothes or signs in the scene do not count."],
  ["logo", "A logo is set on the picture as graphics. A logo on a product or on clothes does not count."],
  ["outdoors", "The picture is taken outdoors."],
];

/** The read fields a pass asks of a picture: all of the pass's fields that can be answered of what it shows. */
export function passFields(pass: Pass, shows?: Shows): Field[] {
  return readFields(pass).filter((f) => !shows || applies(f, shows));
}

const part = (key: string) => key.slice(key.indexOf(".") + 1);
function shapeOf(f: Field): z.ZodType {
  const about = f.ask ?? f.label;
  if (f.type === "choice") return z.enum([CANNOT_TELL, ...(f.options ?? [])] as [string, ...string[]]).describe(about);
  if (f.type === "choices") return z.array(z.enum((f.options ?? []) as [string, ...string[]])).describe(`${about} Every one that clearly holds, at most ${MOST.choices}; empty when none does.`);
  return z.array(z.string()).describe(`${about} Lower case, at most ${MOST.words}; empty when there is nothing to say.`);
}

/** The shape of a pass's answer: one object per group, one part per field; `idea` also says what the picture shows. */
export function passShape(pass: Pass, fields: Field[]): z.ZodType<Record<string, Record<string, unknown>>> {
  const groups: Record<string, z.ZodType> = {};
  for (const g of GROUPS) {
    const own = fields.filter((f) => f.group === g.key);
    if (own.length) groups[g.key] = z.object(Object.fromEntries(own.map((f) => [part(f.key), shapeOf(f)]))).describe(g.about);
  }
  if (pass === "idea") groups.shows = z.object(Object.fromEntries(SHOWS.map(([k, about]) => [k, z.boolean().describe(about)]))).describe("What the picture shows.");
  return z.object(groups) as unknown as z.ZodType<Record<string, Record<string, unknown>>>;
}

export const READ_SYSTEM = `You read one advertising picture for Fume, the way an art director and a photographer would, and record what you see as fields. The fields from many pictures of one brand are counted together to find the brand's habits, so two readings of the same picture must give the same answers.

Rules:
- Answer from what is visible in this picture only. Never guess from what the brand is known for.
- Choose the option that fits best. Choose "${CANNOT_TELL}" only when the picture truly does not show it; a hard call is still a call.
- Option names are plain words with underscores; read them as written.
- Describe people only by what is visible. Never name anyone and never say who a person is.
- If the picture is a screenshot of an ad in an app or a feed, read the ad itself and ignore the app around it.
- If words or shapes are set on a photograph, the camera, light, colour and finish fields are about the photograph underneath.
- Free words are short phrases a photographer or designer would use, not sentences, unless a field asks for a sentence.`;

const ABOUT: Record<Pass, string> = {
  idea: "What kind of picture this is, what it is of, what it says and how it feels. Also say what the picture shows; later questions depend on it.",
  people: "The people in the picture: how much of them is shown, what they do, how they look, and what they wear.",
  subject: "The product and how it is shown, and the place: setting, surfaces, props, weather and time.",
  craft: "How it was shot and lit: where the camera stands, what the lens does, where the light comes from and what it is like.",
  look: "The colour, the finish and texture of the picture, and how the frame is composed.",
  design: "The graphic design set on top of the picture: words, type, logo, button, shapes, and where they sit.",
};
/** The question of a pass. The fields themselves are in the answer shape. */
export const passPrompt = (pass: Pass) => `Read the picture. This question is about: ${ABOUT[pass]}\nFill in every field.`;

/** The question of a pass for a model that takes no answer shape: the same question with the shape written out. */
export function passPromptWithShape(pass: Pass, fields: Field[]): string {
  return `${passPrompt(pass)}\n\nAnswer with one JSON object that follows this JSON Schema exactly: every listed property, only the listed options. No other text and no code fence.\n${JSON.stringify(z.toJSONSchema(passShape(pass, fields)))}`;
}
/** The JSON object in a model's free answer, or null. answersOf then keeps only what the schema lists. */
export function parseAnswer(text: string): Record<string, Record<string, unknown>> | null {
  const to = text.lastIndexOf("}");
  // The answer is the last thing written; words before it (a model's reasoning) may hold braces of their own, so
  // each opening brace is tried in turn until one starts an object that reads.
  for (let from = text.indexOf("{"), tries = 0; from >= 0 && from < to && tries < 40; from = text.indexOf("{", from + 1), tries++) {
    try {
      const out = JSON.parse(text.slice(from, to + 1));
      if (typeof out === "object" && out !== null && !Array.isArray(out)) return out;
    } catch { /* not here; try the next */ }
  }
  return null;
}

/** What `idea` said the picture shows. */
export function showsOf(out: Record<string, Record<string, unknown>>): Shows {
  const s = (out.shows ?? {}) as Record<string, unknown>;
  const people = s.people === true;
  return {
    people,
    face: people && s.face === true,
    severalPeople: people && s.severalPeople === true,
    product: s.product === true,
    words: s.words === true,
    logo: s.logo === true,
    outdoors: s.outdoors === true,
  };
}

/** A pass's answer as the card keeps it: schema key → answer, only options the schema lists, null where it cannot be told. */
export function answersOf(fields: Field[], out: Record<string, Record<string, unknown>>): Record<string, Answer> {
  const read: Record<string, Answer> = {};
  for (const f of fields) {
    const v = out[f.group]?.[part(f.key)];
    if (f.type === "choice") read[f.key] = typeof v === "string" && (f.options ?? []).includes(v) ? v : null;
    else {
      const list = (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean);
      const kept = f.type === "choices" ? [...new Set(list.filter((x) => (f.options ?? []).includes(x)))].slice(0, MOST.choices) : list.map((x) => x.toLowerCase()).slice(0, MOST.words);
      read[f.key] = kept.length ? kept : null;
    }
  }
  return read;
}

/** The passes after `idea` that have something to ask of a picture showing this. */
export const laterPasses = (shows: Shows): Pass[] => PASSES.filter((p) => p !== "idea" && passFields(p, shows).length > 0);
