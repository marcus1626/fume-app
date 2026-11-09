// "Write with Engine" (Round 15, PROPOSED 9 Nov 2026): the words the Engine writes for one field of a plan or a brand
// book, from what it knows (the brief, the plan's look, the Brand DNA, the Tone of Voice). Live, the Engine writes them
// with the brand's context; the mock writes from a few lines per kind of field in LYSNE's voice (short, quiet
// sentences; Norwegian on the creative), and never answers with the words the field already holds. What comes back is
// a suggestion: the screen shows it by the field, and she keeps or drops it.
import type { EngineField, EngineWriting } from "../contract";
import type { Db } from "./db";

type Line = EngineWriting;

/** A plan's lines, by key: the look first, then the products, formats and words. */
const PLAN: Record<string, Line[]> = {
  light: [
    {
      text: "Low, warm light from one window at dusk, from the left; the lit candle the one small light inside.",
      why: "From the brief and the Brand DNA: warm, low light, never cold light inside.",
    },
    {
      text: "One warm source, low and to the side; the shadows long and soft, the glass lit at its edge.",
      why: "From the Brand DNA: warm neutrals and amber light.",
    },
  ],
  camera: [
    {
      text: "50 mm at the product's height, close; the label sharp, the room soft behind it.",
      why: "From what was picked most in earlier campaigns: close, at the product's height.",
    },
  ],
  set: [
    {
      text: "A pale stone sill, a linen cloth and oak; the evening blue outside the window.",
      why: "From the moodboard: stone, linen and oak.",
    },
  ],
  props: [
    {
      text: "The gift sleeve, a loose clay ribbon and the lit candle. Nothing seasonal beyond that.",
      why: "The brief rules out red and green Christmas colours.",
    },
  ],
  colour: [
    {
      text: "Amber glass, cream and clay against the window's deep blue. No red, no green.",
      why: "From the Brand DNA's palette and the brief's never.",
    },
  ],
  people: [
    {
      text: "Hands only, in one master, tying the ribbon. Never a face, never a hand holding the bottle.",
      why: "From memory: hands that hold the bottle were passed on in Autumn launch.",
    },
  ],
  text: [
    {
      text: "One short line in Norwegian on each creative, as the creatives plan it; nothing else on the picture.",
      why: "From the Tone of Voice: short, quiet sentences.",
    },
  ],
  cta: [
    {
      text: "“Gi den bort” in the ad's button, never on the picture.",
      why: "From the Tone of Voice: “Gi den bort” is the call to action for the gift season.",
    },
  ],
  logo: [
    { text: "The wordmark on the label alone; no logo added on the picture.", why: "From the Brand DNA's logo rule." },
  ],
};

/** Words on a creative, in the brand's voice (Norwegian, short, no claim on the skin). */
const WORDS: Line[] = [
  { text: "Gi bort en roligere kveld.", why: "A headline pattern of the Tone of Voice: “[Give] a calmer [evening].”" },
  {
    text: "Kvelden din, litt langsommere.",
    why: "A headline pattern of the Tone of Voice: “Your [moment], [slowed down].”",
  },
  {
    text: "Til noen som fortjener kvelden.",
    why: "A headline pattern of the Tone of Voice: “For [someone who deserves it].”",
  },
  {
    text: "Varm oljen i hendene. Pust ut.",
    why: "A headline pattern of the Tone of Voice: “[A small act]. [A breath].”",
  },
];

/** A book's quoted lines (headlines, calls to action, examples), in the brand's own language. */
const QUOTED: Line[] = [
  { text: "Tenn lyset. Kvelden er din.", why: "Short and quiet, as the voice is; no claim on the skin." },
  { text: "Litt mer kveld, litt mindre skjerm.", why: "From the brand's own lines: the evening, slowed down." },
  { text: "Gi kvelden bort.", why: "A call to action the voice uses for the gift season." },
];

/** A stable pick from a list that is not the words already there. */
function pick(list: Line[], seed: string, not: string): Line {
  let n = 0;
  for (const ch of seed) n = (n * 31 + ch.charCodeAt(0)) % 997;
  const fresh = list.filter((l) => l.text.trim() !== not.trim());
  const from = fresh.length ? fresh : list;
  return from[n % from.length];
}

/** The line, shorter: its first sentence, or its first clause when that one sentence is long. */
function tighter(value: string): Line | undefined {
  const sentences = value.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()) ?? [value.trim()];
  if (sentences.length > 1) return { text: sentences[0], why: "Shorter: the voice keeps to short, quiet sentences." };
  const words = value.trim().split(/\s+/);
  const clause = /^[^,;:]+/.exec(value.trim())?.[0];
  if (words.length > 12 && clause && clause.length < value.trim().length - 4)
    return { text: `${clause.trim()}.`, why: "Shorter: one clause says it; the voice keeps to short sentences." };
  return undefined;
}

export function writeFor(db: Db, field: EngineField): EngineWriting {
  const seed = `${field.kind}:${"key" in field ? field.key : "path" in field ? field.path : field.creativeId}`;
  if (field.kind === "plan_line") {
    const own = PLAN[field.key];
    if (own) return pick(own, seed, field.value);
    return tighter(field.value) ?? { text: field.value, why: "It reads well as it is; nothing to make shorter." };
  }
  if (field.kind === "plan_creative") {
    if (field.part === "text") return pick(WORDS, seed, field.value);
    // The scene: the products the plan puts in it, as the look and the brief set them
    const plan = db.plans.find((p) => p.campaignId === field.campaignId);
    const creative = plan?.directions.flatMap((d) => d.creatives).find((c) => c.id === field.creativeId);
    const names = (creative?.productIds ?? [])
      .map((id) => db.products.find((p) => p.id === id)?.name)
      .filter((n): n is string => Boolean(n));
    const first = names[0] ?? "The product";
    const second = names[1];
    return {
      text: `${first} on the sill, label to the front${second ? `, ${second} lit behind it` : ""}; the window going blue and warm light inside.`,
      why: "From the plan's look and what the brief must show: the label front and centred.",
    };
  }
  if (
    /^(headlines\.\d+\.example|ctas\.\d+\.cta|pairs\.\d+\.(good|bad)|examples\.\d+\.line|channels\.\d+\.example)$/.test(
      field.path,
    )
  )
    return pick(QUOTED, seed, field.value);
  return (
    tighter(field.value) ?? {
      text: field.value.replace(/\s*\([^)]*\)/g, "").trim(),
      why: "It reads well as it is; the Engine would keep it.",
    }
  );
}
