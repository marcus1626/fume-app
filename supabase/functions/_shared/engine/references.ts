// Which reference pictures the Engine sends for one picture (Marcus, 10 Nov 2026: for a lifestyle picture of a model
// from the front, only the model references that angle needs). An image model copies what it is shown, so a picture of
// the back sent for a picture from the front, or a product worn by a person sent for a picture with no people, puts
// the wrong thing in the frame. Every reference picture therefore has a small card (from where its subject is seen,
// what it is of, how close), and the plan's own words say what the picture to be made needs. Code holds the two
// against each other; no model chooses.
//
// A card comes from the picture's slot where the slot says it ("front", "back", "detail"), or from a classifier that
// looked at the picture (Jev: REF_QUESTIONS below). A picture with neither ("site-3" from a web import) is unknown: it
// is sent when there is room and never preferred over one that is known to fit.
// It imports nothing, so the function that reads the cards (taste-read) and the Engine share it as it is.

/** The parts of a reference picture and of a planned creative this file reads (context.ts has the whole of both). */
type Pictured = { slot: string | null; card?: unknown };
type Planned = { scene?: string; people?: string; name?: string; view?: string; crop?: string };

export const VIEWS = ["front", "three_quarter", "side", "back", "top", "bottom"] as const;
export type View = (typeof VIEWS)[number];
export const OFS = ["product", "product_on_person", "product_in_scene", "person", "other"] as const;
export const CROPS = ["close", "half", "whole"] as const;
/** A reference picture's card. */
export type RefCard = {
  /** From where the product or the person is seen; null when it cannot be told. */
  view: View | null;
  /** What it is a picture of. */
  of: (typeof OFS)[number];
  /** How much of it: a close detail (or a face), half, or the whole of it. */
  crop: (typeof CROPS)[number] | null;
};
/** What the picture to be made needs of its references, from the plan's words. */
export type Need = { view: View | null; crop: RefCard["crop"]; people: boolean };

const SLOT_CARD: Record<string, RefCard> = {
  front: { view: "front", of: "product", crop: "whole" },
  hero: { view: "front", of: "product", crop: "whole" },
  packshot: { view: "front", of: "product", crop: "whole" },
  side: { view: "side", of: "product", crop: "whole" },
  profile: { view: "side", of: "person", crop: null },
  angle: { view: "three_quarter", of: "product", crop: "whole" },
  three_quarter: { view: "three_quarter", of: "product", crop: "whole" },
  back: { view: "back", of: "product", crop: "whole" },
  top: { view: "top", of: "product", crop: "whole" },
  bottom: { view: "bottom", of: "product", crop: "whole" },
  detail: { view: null, of: "product", crop: "close" },
  label: { view: "front", of: "product", crop: "close" },
  on_model: { view: null, of: "product_on_person", crop: null },
  full_body: { view: null, of: "product_on_person", crop: "whole" },
  face: { view: "front", of: "person", crop: "close" },
};
const isCard = (c: unknown): c is RefCard =>
  typeof c === "object" && c !== null && (OFS as readonly string[]).includes((c as RefCard).of) &&
  ((c as RefCard).view === null || (VIEWS as readonly string[]).includes((c as RefCard).view!)) &&
  ((c as RefCard).crop === null || (CROPS as readonly string[]).includes((c as RefCard).crop!));
/** A picture's card: what a classifier read of it, else what its slot says, else nothing. */
export function cardOf(pic: Pictured): RefCard | null {
  if (isCard(pic.card)) return pic.card;
  return SLOT_CARD[(pic.slot ?? "").toLowerCase().replaceAll(/[\s-]+/g, "_")] ?? null;
}

// The plan's words for where the camera stands to its subject, as the plan writer writes them ("seen from behind and
// the side", "back mostly to camera", "in three-quarter view", "seen in profile"). The first that is said wins; a plan
// that says none leaves the view open, and then no picture is held to be the wrong side. "Faces turned away" says
// nothing of the side: the plans say it of people seen from anywhere.
const VIEW_WORDS: [View, RegExp][] = [
  ["back", /\bfrom (behind|the back(?! of))\b|\bback view\b|\bback (is |mostly )?to (the )?camera\b|\bwalk(s|ing) away\b|\bover[- ]the[- ]shoulder\b/i],
  ["top", /\bfrom (above|overhead)\b|\btop[- ]down\b|\boverhead (shot|view|angle)\b|\bflat[- ]?lay\b|\bbird'?s[- ]eye\b/i],
  ["bottom", /\bfrom (below|underneath)\b|\bunderside\b/i],
  ["side", /\bin profile\b|\bside view\b|\bfrom the side\b|\bside[- ]on\b|\bprofile (shot|view)\b/i],
  ["three_quarter", /\bthree[- ]quarters?\b|\b3\/4\b/i],
  ["front", /\bfrom the front\b|\bfront view\b|\bfront[- ]on\b|\bhead[- ]on\b|\bstraight[- ]on\b|\b(facing|looks? (in)?to|looking (in)?to) (the )?camera\b/i],
];
const CROP_WORDS: [NonNullable<RefCard["crop"]>, RegExp][] = [
  ["close", /\bclose[- ]?up\b|\bmacro\b|\bdetail\b|\btight on\b|\bhead and shoulders\b/i],
  ["half", /\bwaist[- ]up\b|\bhalf[- ]body\b|\bfrom the waist\b|\bmedium shot\b/i],
  ["whole", /\bfull[- ]body\b|\bfull[- ]length\b|\bhead to toe\b|\bwide (shot|scene|view)\b/i],
];
/** What the planned picture needs: the side its subject is seen from and how close. The plan says so as fields
 *  (`view`, `crop`) since 10 Nov 2026; a plan written before that says it in its scene's words, or not at all. */
export function needOf(planned: Planned | undefined): Need {
  const words = `${planned?.scene ?? ""}. ${planned?.people ?? ""}. ${planned?.name ?? ""}`;
  const people = Boolean(planned?.people?.trim()) && !/^no people/i.test(planned!.people!.trim());
  const view = (VIEWS as readonly string[]).includes(planned?.view ?? "") ? (planned!.view as View) : null;
  const crop = (CROPS as readonly string[]).includes(planned?.crop ?? "") ? (planned!.crop as RefCard["crop"]) : null;
  return {
    view: view ?? VIEW_WORDS.find(([, re]) => re.test(words))?.[0] ?? null,
    crop: crop ?? CROP_WORDS.find(([, re]) => re.test(words))?.[0] ?? null,
    people,
  };
}

const OPPOSITE: Partial<Record<View, View>> = { front: "back", back: "front", top: "bottom", bottom: "top" };
const NEAR: Record<View, View[]> = { front: ["three_quarter"], three_quarter: ["front", "side"], side: ["three_quarter"], back: [], top: [], bottom: [] };
/** How well a reference picture serves the picture to be made. Below nought it would put the wrong thing in the frame. */
export function serves(card: RefCard | null, need: Need, subject: "product" | "person"): number {
  // Unknown: may help, never preferred.
  if (!card) return 1;
  let n = 2;
  if (subject === "product") {
    // The front is the truth about the product whatever the picture shows of it.
    if (card.view === "front" && card.of === "product") n += 4;
    // A product worn by a person brings that person with it.
    if (card.of === "product_on_person") n += need.people ? 2 : -6;
    if (card.of === "product_in_scene") n -= 1;
    if (card.of === "person" || card.of === "other") n -= 6;
  } else if (card.of !== "person" && card.of !== "product_on_person") n -= 6;
  if (need.view && card.view) {
    if (card.view === need.view) n += 6;
    else if (NEAR[need.view].includes(card.view)) n += 2;
    else if (OPPOSITE[need.view] === card.view) n -= subject === "person" ? 6 : card.view === "front" ? 0 : 5;
  }
  if (need.crop && card.crop) {
    if (card.crop === need.crop) n += 3;
    else if (subject === "person" && (card.crop === "close") !== (need.crop === "close")) n -= 1;
  }
  return n;
}

const VIEW_SAYS: Record<View, string> = { front: "from the front", three_quarter: "from a three-quarter angle", side: "from the side", back: "from the back", top: "from above", bottom: "from below" };
/** A card in the words the image model is told: "seen from the back", "a close detail", "worn by a person". */
export function says(card: RefCard): string {
  const parts = [
    card.of === "product_on_person" ? "worn by a person" : card.of === "product_in_scene" ? "in a scene" : "",
    card.crop === "close" ? (card.of === "person" ? "the face close" : "a close detail") : card.crop === "whole" && card.of !== "product" ? "the whole figure" : "",
    card.view ? `seen ${VIEW_SAYS[card.view]}` : "",
  ].filter(Boolean);
  return parts.join(", ");
}
/** Why a picture was not sent, for the ledger. */
export function whyNot(card: RefCard | null, need: Need, subject: "product" | "person", room: number): string {
  if (card && serves(card, need, subject) < 0) {
    if (subject === "product" && card.of === "product_on_person" && !need.people) return "It shows the product on a person, and this picture has no people.";
    if (need.view && card.view && OPPOSITE[need.view] === card.view) return `It is seen ${VIEW_SAYS[card.view]}, and this picture is ${VIEW_SAYS[need.view]}.`;
    return "It is not a picture of what this picture shows.";
  }
  return `No room: the image model takes ${room} pictures, and others fit this picture better.`;
}

export type Candidate = { url: string; role: string; subject: "product" | "person"; owner: string; card: RefCard | null; order: number };
/** The pictures to send, in the order the model should see them: the best of every product and every model first,
 *  then the rest by how well they serve, for as many places as there are. Pictures that would put the wrong thing in
 *  the frame are left out, unless one is all there is of a product. */
export function choose(candidates: Candidate[], need: Need, room: number): Candidate[] {
  const scored = candidates.map((c) => ({ c, n: serves(c.card, need, c.subject) }));
  const by = (a: (typeof scored)[number], b: (typeof scored)[number]) => b.n - a.n || a.c.order - b.c.order;
  const owners = [...new Set(candidates.map((c) => c.owner))];
  const first = owners.flatMap((o) => {
    const own = scored.filter((s) => s.c.owner === o).sort(by);
    // A person is never sent from the wrong side; a product's only picture still says what it is.
    return own.length && (own[0]!.n >= 0 || own[0]!.c.subject === "product") ? [own[0]!] : [];
  });
  const rest = scored.filter((s) => !first.includes(s) && s.n >= 0).sort(by);
  return [...first, ...rest].slice(0, Math.max(0, room)).map((s) => s.c);
}

/** What a classifier is asked of one reference picture, as closed lists (Jev answers them; any reader could). */
export const REF_QUESTIONS = {
  of: {
    ask: "What is this picture of?",
    options: {
      product: "The product alone, on a plain or studio background.",
      product_on_person: "The product worn, held or used by a person.",
      product_in_scene: "The product in a place or among other things, with no person.",
      person: "A person, with no product that is the point of the picture.",
      other: "Something else: a drawing, a diagram, a logo, a size chart.",
    },
  },
  view: {
    ask: "From where is the main subject (the product, or the person) seen?",
    options: {
      front: "From the front.",
      three_quarter: "From a three-quarter angle, between front and side.",
      side: "From the side, in profile.",
      back: "From the back.",
      top: "From above.",
      bottom: "From below, or its underside.",
      cannot_tell: "It has no front or back, or the picture does not show which.",
    },
  },
  crop: {
    ask: "How much of the main subject is in the picture?",
    options: {
      close: "A close detail of it, or a person's face.",
      half: "About half of it; a person from the waist up.",
      whole: "The whole of it; a person's whole figure.",
    },
  },
} as const;
export const REF_SYSTEM = "You look at one reference picture of a brand's product or of a model, for Fume, and say what it shows by choosing from closed lists. Answer from what is visible in this picture only. Never name anyone and never say who a person is.";
/** The three questions for a reader that answers in text: one JSON object, one option each. */
export function refPrompt(): string {
  const lines = Object.entries(REF_QUESTIONS).map(([name, q]) =>
    `"${name}": ${q.ask} One of:\n${Object.entries(q.options).map(([o, about]) => `  - "${o}": ${about}`).join("\n")}`);
  return `Look at the picture and answer three questions.\n\n${lines.join("\n\n")}\n\nAnswer with one JSON object with exactly the keys "of", "view" and "crop", each one of its listed options. No other text and no code fence.`;
}
/** A classifier's three answers as a card; null when it could not say what the picture is of. */
export function cardFromAnswers(a: { of?: unknown; view?: unknown; crop?: unknown }): RefCard | null {
  if (!(OFS as readonly unknown[]).includes(a.of)) return null;
  return {
    of: a.of as RefCard["of"],
    view: (VIEWS as readonly unknown[]).includes(a.view) ? (a.view as View) : null,
    crop: (CROPS as readonly unknown[]).includes(a.crop) ? (a.crop as RefCard["crop"]) : null,
  };
}
