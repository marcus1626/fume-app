// Jev as a reader of the taste schema (Marcus, 10 Nov 2026: classification in Fume uses TypeSafe's model Jev). Jev is
// a decision model, not a writing one: it is sent the picture with named questions and answers each with a choice
// from a closed list or a yes/no probability, and how sure it is (docs.typesafe.ai/api/system-one). The schema's
// read fields are closed lists, so a pass becomes a set of Jev questions:
//   a `choice` field    one choice question, the field's options and "cannot tell";
//   a `choices` field   one yes/no per option, kept where it is more likely than not, the likeliest first;
//   what `idea` shows   one yes/no per statement (read.ts SHOWS);
//   a `words` field     not asked: Jev writes nothing, so those stay empty on a card it read.
// The answers go back in the shape every reader answers in (read.ts answersOf, showsOf), so the card, the profile and
// the bake-off do not know which reader it was.
import type { Asked, Picture, Usage } from "../../taste-read/handler.ts";
import { cardFromAnswers, type RefCard, REF_QUESTIONS } from "../engine/references.ts";
import { CANNOT_TELL, MOST, passFields, passPrompt, SHOWS } from "./read.ts";
import type { Field, Pass, Shows } from "./schema.ts";

export const JEV = {
  url: "https://api.typesafe.ai/v1/systemone",
  model: "jev-latest",
  /** Dollars per million tokens sent; what it answers is free (docs.typesafe.ai/models, 10 Nov 2026). */
  input: 0.042,
  /** Questions in one request. Jev's docs give no limit by count, only by tokens (64,000 a request); a pass has up to
   *  63, so it goes as two requests side by side. A request Jev will not take as it is (too many questions, too many
   *  tokens) is asked again as two halves. */
  most: 40,
  /** A `choices` option and a thing shown are kept when a yes is more likely than a no. */
  yes: 0.5,
};

type Question =
  | { type: "noul"; instructions: string; criteria?: { true: string; false: string } }
  | { type: "choice"; instructions: string; criteria: Record<string, string | null> };
/** What a question's answer is kept as: a field's one option, one option of a list, or a thing the picture shows. */
type Slot = { kind: "choice"; field: Field } | { kind: "option"; field: Field; option: string } | { kind: "shows"; key: keyof Shows };
export type JevAnswer = { type?: string; choice?: string; noul?: number; confidence?: number };

const part = (key: string) => key.slice(key.indexOf(".") + 1);
const plain = (option: string) => option.replaceAll("_", " ");
const HOW = `Answer from what is visible in this picture only, never from what the brand is known for. If the picture is a screenshot of an ad in an app or a feed, read the ad itself and ignore the app around it. If words or shapes are set on a photograph, questions about camera, light, colour and finish are about the photograph underneath. Describe people only by what is visible.`;

/** A pass as Jev is asked it: the picture and how to read it, the questions by a plain name, and what each name stands for. */
export function jevAsk(pass: Pass, fields: Field[], placeholder: string): { state: string; questions: Record<string, Question>; slots: Record<string, Slot> } {
  const questions: Record<string, Question> = {};
  const slots: Record<string, Slot> = {};
  const put = (q: Question, slot: Slot) => {
    const name = `q${Object.keys(questions).length}`;
    questions[name] = q;
    slots[name] = slot;
  };
  for (const f of fields) {
    const about = f.ask ?? `${f.label}.`;
    const options = f.options ?? [];
    if (f.type === "choice" && options.length) {
      put({
        type: "choice",
        instructions: `${f.group}, ${f.label.toLowerCase()}: ${about} Choose the option that fits best; a hard call is still a call.`,
        criteria: { ...Object.fromEntries(options.map((o) => [o, null])), [CANNOT_TELL]: "Only when the picture truly does not show it." },
      }, { kind: "choice", field: f });
    } else if (f.type === "choices") {
      for (const o of options) put({ type: "noul", instructions: `${f.group}, ${f.label.toLowerCase()}: ${about} Does "${plain(o)}" clearly hold for this picture?` }, { kind: "option", field: f, option: o });
    }
  }
  if (pass === "idea") for (const [key, statement] of SHOWS) put({ type: "noul", instructions: statement }, { kind: "shows", key });
  return { state: `An advertising picture, read the way an art director and a photographer would:\n${placeholder}\n\n${passPrompt(pass).split("\n")[0]}\n${HOW}`, questions, slots };
}

/** Jev's answers as a pass's answer: group, then field; `shows` where the pass asked what the picture shows. */
export function jevOut(slots: Record<string, Slot>, answers: Record<string, JevAnswer>): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  const held = new Map<string, { field: Field; options: [string, number][] }>();
  for (const [name, slot] of Object.entries(slots)) {
    const a = answers[name];
    if (slot.kind === "shows") (out.shows ??= {})[slot.key] = typeof a?.noul === "number" && a.noul > JEV.yes;
    else if (slot.kind === "choice") (out[slot.field.group] ??= {})[part(slot.field.key)] = typeof a?.choice === "string" ? a.choice : CANNOT_TELL;
    else {
      const h = held.get(slot.field.key) ?? { field: slot.field, options: [] };
      if (typeof a?.noul === "number" && a.noul > JEV.yes) h.options.push([slot.option, a.noul]);
      held.set(slot.field.key, h);
    }
  }
  for (const { field, options } of held.values())
    (out[field.group] ??= {})[part(field.key)] = options.sort((a, b) => b[1] - a[1]).slice(0, MOST.choices).map(([o]) => o);
  return out;
}

/** One pass asked of Jev. The picture goes with the request, so only a JPEG or a PNG sent as itself can be read. */
export async function askJev(key: string | undefined, pass: Pass, shows: Shows | undefined, picture: Picture, send: typeof fetch = fetch): Promise<Asked> {
  const none: Usage = { model: JEV.model, input_tokens: 0, output_tokens: 0, cost_usd: 0 };
  if (!key) return { ok: false, error: "No key for Jev.", usage: none };
  if ("url" in picture || picture.mediaType === "image/webp") return { ok: false, error: "Jev reads a JPEG or a PNG sent as the picture itself.", usage: none };
  const placeholder = crypto.randomUUID();
  const { state, questions, slots } = jevAsk(pass, passFields(pass, shows), placeholder);
  const names = Object.keys(questions);
  if (!names.length) return { ok: true, out: {}, usage: none };
  const assets = { [placeholder]: { type: "image", format: picture.mediaType === "image/png" ? "png" : "jpeg", data_base64: picture.base64 } };
  const groups: string[][] = [];
  for (let i = 0; i < names.length; i += JEV.most) groups.push(names.slice(i, i + JEV.most));

  type Got = { answers: Record<string, JevAnswer>; model: string; tokens: number } | { error: string };
  const one = async (group: string[]): Promise<Got> => {
    const res = await send(JEV.url, {
      method: "POST",
      signal: AbortSignal.timeout(60_000),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json", "TypeSafe-Danger-Zone-Images": "true" },
      body: JSON.stringify({ model: JEV.model, state, questions: Object.fromEntries(group.map((n) => [n, questions[n]])), assets }),
    });
    const text = await res.text();
    // Too much in one request: the same questions as two halves, down to four at a time.
    if ((res.status === 400 || res.status === 413 || res.status === 422) && group.length > 4) {
      const half = Math.ceil(group.length / 2);
      const [a, b] = await Promise.all([one(group.slice(0, half)), one(group.slice(half))]);
      if ("error" in a) return a;
      if ("error" in b) return b;
      return { answers: { ...a.answers, ...b.answers }, model: b.model, tokens: a.tokens + b.tokens };
    }
    if (!res.ok) return { error: `Jev answered ${res.status}: ${text.replaceAll(key, "[key]").slice(0, 300)}` };
    try {
      const body = JSON.parse(text) as { model?: string; answers?: Record<string, JevAnswer>; usage?: { input_tokens?: number } };
      if (!body.answers || typeof body.answers !== "object") return { error: "Jev gave no answers." };
      return { answers: body.answers, model: body.model ?? JEV.model, tokens: body.usage?.input_tokens ?? 0 };
    } catch {
      return { error: "Jev's answer could not be read." };
    }
  };
  const got = await Promise.all(groups.map(one));
  const answers: Record<string, JevAnswer> = {};
  let tokens = 0, model = JEV.model, error: string | null = null;
  for (const g of got) {
    if ("error" in g) error ??= g.error;
    else {
      Object.assign(answers, g.answers);
      tokens += g.tokens;
      model = g.model;
    }
  }
  const usage: Usage = { model, input_tokens: tokens, output_tokens: 0, cost_usd: Math.round(tokens * JEV.input / 100) / 10_000 };
  // Half a pass would read as a picture that shows less, so one request that failed fails the pass; it is asked again whole.
  if (error) return { ok: false, error, usage };
  return { ok: true, out: jevOut(slots, answers), usage };
}

/** One reference picture asked of Jev: what it is of, from where, how close (engine/references.ts). One request. */
export async function askJevRef(key: string | undefined, picture: Picture, send: typeof fetch = fetch): Promise<{ ok: true; card: RefCard | null; usage: Usage } | { ok: false; error: string; usage: Usage }> {
  const none: Usage = { model: JEV.model, input_tokens: 0, output_tokens: 0, cost_usd: 0 };
  if (!key) return { ok: false, error: "No key for Jev.", usage: none };
  if ("url" in picture || picture.mediaType === "image/webp") return { ok: false, error: "Jev reads a JPEG or a PNG sent as the picture itself.", usage: none };
  const placeholder = crypto.randomUUID();
  const questions = Object.fromEntries(Object.entries(REF_QUESTIONS).map(([name, q]) => [name, { type: "choice", instructions: q.ask, criteria: q.options }]));
  const res = await send(JEV.url, {
    method: "POST",
    signal: AbortSignal.timeout(60_000),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json", "TypeSafe-Danger-Zone-Images": "true" },
    body: JSON.stringify({
      model: JEV.model,
      state: `A reference picture of a brand's product or of a model:\n${placeholder}`,
      questions,
      assets: { [placeholder]: { type: "image", format: picture.mediaType === "image/png" ? "png" : "jpeg", data_base64: picture.base64 } },
    }),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, error: `Jev answered ${res.status}: ${text.replaceAll(key, "[key]").slice(0, 300)}`, usage: none };
  let body: { model?: string; answers?: Record<string, JevAnswer>; usage?: { input_tokens?: number } };
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, error: "Jev's answer could not be read.", usage: none };
  }
  const tokens = body.usage?.input_tokens ?? 0;
  const usage: Usage = { model: body.model ?? JEV.model, input_tokens: tokens, output_tokens: 0, cost_usd: Math.round(tokens * JEV.input / 100) / 10_000 };
  if (!body.answers || typeof body.answers !== "object") return { ok: false, error: "Jev gave no answers.", usage };
  const a = body.answers;
  return { ok: true, card: cardFromAnswers({ of: a.of?.choice, view: a.view?.choice, crop: a.crop?.choice }), usage };
}
