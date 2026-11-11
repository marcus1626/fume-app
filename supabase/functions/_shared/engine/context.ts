// The data domain: what the Engine knows when it writes a prompt, built from Fume's own records (the job's frozen
// snapshot, the approved plan, the product's verified facts and pictures, the Brand DNA's rules, the taste model and
// the lessons people's verdicts taught). Built by code, never by a model: the product text is the verified facts
// word for word, so the model can only describe the scene around the product, never the product itself.
import { type Direction, directionFor, type Planned, promptLines, type PromptLine } from "../taste/direction.ts";
import { type Candidate, cardOf, choose, needOf, says } from "./references.ts";
import type { BrandContext, BrandRule, Concept, FormatSpec, Knowledge, ProductContext } from "./types.ts";

export type Fact = { id: string; product_id?: string; area: string; label: string; statement: string; status: string };
/** `card` is what a classifier read of the picture (references.ts RefCard), where one has looked at it. */
export type Picture = { slot: string | null; url: string; name?: string; card?: unknown };
/** One of the brand's models: an AI person, never a real one, with the pictures that say who they are. */
export type CastMember = { id: string; name: string; pictures: Picture[] };
export type TaskProduct = { id: string; name: string; variant?: string | null; facts: Fact[]; pictures: Picture[] };
export type PlanLine = { label: string; value: string };
export type PlannedCreative = {
  id: string;
  name: string;
  kind?: string;
  of?: string;
  format: string;
  productIds?: string[];
  scene: string;
  text?: string;
  people?: string;
  /** The brand's layout the plan sets this creative's words in (fume-plan, 9 Nov). */
  layout?: string;
  /** From where the camera sees the main subject and how much of it, where the plan says (references.ts). */
  view?: string;
  crop?: string;
  /** Where the plan sets the picture: studio, indoors or outdoors (fume-plan, 11 Nov). */
  place?: string;
  /** The brand's models this picture is of, where the plan names them. */
  castIds?: string[];
};
export type PlanBody = {
  chosen_direction_id?: string;
  directions?: { id: string; name: string; idea: string; hook?: string; productRole?: string; look?: PlanLine[] }[];
  planned_creatives?: PlannedCreative[];
};
/** What the Brand Brain knows that shapes a picture (app.engine_brain); every item keeps its node's id. */
export type Brain = {
  market?: { market?: string; language?: string } | null;
  palette: { id: string; name: string; hex: string; role?: string; use?: string; confidence?: string; confirmed: boolean }[];
  imagery: { id: string; what: string; confirmed: boolean }[];
  notes: { id: string; layer: string; kind: string; what: string; confirmed: boolean }[];
  changes: { id: string; what: string; cause?: string; from?: string; creative?: string; this_campaign?: boolean }[];
  checks: { id: string; what: string; state: string; creative?: string }[];
};
export const NO_BRAIN: Brain = { market: null, palette: [], imagery: [], notes: [], changes: [], checks: [] };

export type Taste = { key: string; words: string | null; do_confidence: number; avoid_words: string | null; avoid_confidence: number };

/** What public.engine_take hands over, with the pictures' addresses signed by the function. */
export type EngineTask = {
  brand: { name: string };
  creative: { id: string; title: string; slot: string | null; format: string; kind: string };
  plan: PlanBody;
  products: TaskProduct[];
  rules: { id: string; area: string; statement: string; kind: string; origin: string }[];
  taste: Taste[];
  lessons: { id: string; statement: string; polarity: "do" | "avoid"; reason: string }[];
  exemplars: { text: string }[];
  /** For a variant, a format or a correction: the version it is made from, as the first reference. `picked` when it is
   *  the picture the designer's words change (the Engine bar), not yet approved. */
  master: { url: string; title: string; picked?: boolean } | null;
  brain?: Brain;
  /** The campaign moodboard's picture for composition, light and mood; never the product's truth. */
  composition?: { id: string; url: string; note?: string } | null;
  /** The brand's Look Book in use (public.engine_look): how its photographs are made. */
  look?: { id: string; version: number; state: string; body: LookBody } | null;
  /** How the brand sets words on its pictures, from its design system in use (public.engine_words_room). */
  room?: { id: string; version: number; layouts: RoomLayout[] } | null;
  /** What the brand's pictures keep to, read against the taste schema (public.engine_taste, taste/direction.ts). */
  tasteDirection?: Direction | null;
  /** The brand's models, for the pictures the plan casts them in. Nobody is put in a picture the plan did not name. */
  cast?: CastMember[];
};

/** How many of the taste schema's lines one prompt takes, and how many of them may be absences. */
export const SCHEMA_LINES = { most: 12, absences: 2 };
/** The taste schema's lines for this picture: what applies to what the plan says it shows, the weightiest first. */
export function schemaLines(task: EngineTask): PromptLine[] {
  if (!task.tasteDirection?.lines?.length) return [];
  return promptLines(task.tasteDirection, plannedShows(task), SCHEMA_LINES.most, SCHEMA_LINES.absences);
}
/** What the plan says the picture will show, as the taste schema asks it: it decides which habits apply, and which
 *  kind of the brand's pictures this one is held to (the product alone, or a picture with people). */
export function plannedShows(task: EngineTask): Planned {
  const planned = plannedCreative(task);
  const people = planned?.people?.trim() ?? "";
  const shown = Boolean(people) && !/^no people/i.test(people);
  const place = plannedPlace(planned);
  return {
    people: shown, face: shown && !/^hands? only/i.test(people), product: task.products.length > 0,
    ...(place ? { place: place === "studio" ? "studio" as const : "world" as const, outdoors: place === "outdoors" } : {}),
  };
}
const STUDIO_SCENE = /\b(studio|seamless|cyclorama|infinity cove|paper sweep)\b/i;
const OUTDOOR_SCENE = /\b(street|pavement|kerb|road|alley|park|pitch|field|beach|forest|mountain|rooftop|outdoors?|outside|sky|rain|puddle|terrace|car park|court|track|platform|estate|bridge|canal)\b/i;
/** Where the plan sets the picture: what the plan writer said (place), else what its scene names. A plan from before
 *  the plan said it, whose scene names neither, gives nothing, and then every habit applies as before. */
export function plannedPlace(planned: PlannedCreative | undefined): "studio" | "indoors" | "outdoors" | null {
  if (planned?.place === "studio" || planned?.place === "indoors" || planned?.place === "outdoors") return planned.place;
  const scene = planned?.scene ?? "";
  return STUDIO_SCENE.test(scene) ? "studio" : OUTDOOR_SCENE.test(scene) ? "outdoors" : null;
}

export type RoomLayout = {
  name: string;
  band: "top" | "middle" | "bottom";
  align: "left" | "center" | "right";
  wordsWidthPct: number;
  ground: string;
  why?: string;
  /** The block of words in the brand's ads, as shares of the frame from its top left (books read from 9 Nov). */
  box?: { x: number; y: number; w: number; h: number };
  /** Where the brand sets its button apart from the words (Anthem's SHOP NOW, bottom right). */
  ctaAt?: string | null;
  /** The tone of the brand's words on its pictures: light (white words) or dark. */
  words?: string | null;
};
export type Side = "left" | "right" | "top" | "bottom";

/**
 * Where the words will go on a picture that carries them, and how much of the frame they need: the brand's layout the
 * plan chose for this creative first (the design layer sets the words in the same one), then the plan's own scene
 * ("Left side of the frame kept clear"), else the brand's first layout that sets words on the photograph. Null for a
 * picture without words.
 */
export function wordsRoom(task: EngineTask): { side: Side; share: number; from: string; button?: "left" | "right"; tone?: "dark" | "light" } | null {
  const planned = plannedCreative(task);
  if (!planned?.text?.trim() || task.master?.picked) return null;
  const scene = planned.scene ?? "";
  const said = scene.match(/\b(left|right|top|bottom|upper|lower)\b[^.]*\b(clear|empty|free|space|room)\b/i)?.[1]?.toLowerCase();
  const fromScene: Side | undefined = said === "upper" ? "top" : said === "lower" ? "bottom" : (said as Side | undefined);
  const layouts = task.room?.layouts ?? [];
  const chosen = planned.layout ? layouts.find((l) => l.name === planned.layout) : undefined;
  const layout = chosen ?? layouts.find((l) => l.ground === "photo");
  const fromLayout: Side | undefined = !layout ? undefined
    : layout.band === "top" ? "top" : layout.band === "bottom" ? "bottom" : layout.align === "right" ? "right" : "left";
  const side = chosen ? fromLayout : fromScene ?? fromLayout;
  if (!side) return null;
  const width = layout ? Math.min(60, Math.max(25, layout.wordsWidthPct)) / 100 : 0.3;
  // A band holds a two-line headline, a line under it and the logo: about 450 px of a 1350 px feed, so 40%.
  let share = side === "top" || side === "bottom" ? 0.4 : Math.round(Math.min(0.5, Math.max(0.38, width + 0.14)) * 100) / 100;
  // Where the brand's ads show the block of words, the room reaches just past it, with a margin.
  const b = layout?.box;
  if (b && layout && side === fromLayout) {
    const reach = { left: b.x + b.w, right: 1 - b.x, top: b.y + b.h, bottom: 1 - b.y }[side] + 0.06;
    // Half the frame at most: more, and the image model paints a blank slab beside the scene (Anthem v9, 9 Nov).
    share = Math.round(Math.min(0.5, Math.max(0.25, reach)) * 100) / 100;
  }
  // A button the brand sets apart in a bottom corner needs that corner too.
  const button = layout?.ctaAt === "bottom_right" ? "right" : layout?.ctaAt === "bottom_left" ? "left" : undefined;
  // White words need a room darker than they are; dark words a light one (Anthem v11, 9 Nov: the room was bright sky,
  // white could not be read on it, and the words were set in navy, off the brand).
  const tone = layout?.words === "light" ? "dark" : layout?.words === "dark" ? "light" : undefined;
  return { side, share, from: chosen || !fromScene ? `the brand's layout "${layout!.name}"` : "the plan's scene", ...(button ? { button } : {}), ...(tone ? { tone } : {}) };
}

/** Whether the brand's own pictures of this kind stay sharp behind the subject (taste schema: deep focus, or no blur
 *  behind). The room for the words is then never asked for as something out of focus. */
export function keepsSharpBehind(task: EngineTask): boolean {
  if (!task.tasteDirection?.lines?.length) return false;
  return directionFor(task.tasteDirection, plannedShows(task)).lines.some((l) =>
    (l.key === "camera.depth_of_field" && /: (deep|everything sharp)$/.test(l.says)) || (l.key === "camera.background_blur" && l.absence));
}

/** The room for the words as rules the prompt must carry: where the product sits and what is kept out of the room
 *  (`room-for-words`), and how calm that part of the photograph is (`room-calm`). They are two rules because they fail
 *  differently: a product, a person or the wrong tone where the words go breaks the layout, and the Engine makes the
 *  picture once more (engine/handler.ts makeRoom); a texture there is the designer's to shade. As one rule, every
 *  first picture of a brand whose taste keeps the background sharp was called off for its gravel or its puddle and
 *  made twice, the second time with a smaller product (Nike UK and Møllers, 11 Nov 2026: eight of eight). */
export function roomRules(task: EngineTask): BrandRule[] {
  const room = wordsRoom(task);
  if (!room) return [];
  const pct = Math.round(room.share * 100);
  const rest = 100 - pct;
  const across = room.side === "left" || room.side === "right";
  const other = { left: "right", right: "left", top: "bottom", bottom: "top" }[room.side];
  // A brand that keeps its backgrounds sharp is not told to blur the room: the two would be written against each other.
  const sharp = keepsSharpBehind(task);
  const far = sharp ? "the sky, a far field, a plain wall or even ground, as sharp as the rest of the picture" : "the sky, a far field, a wall or trees softly out of focus";
  // The room is the photograph's own open background, the way a photographer frames for a headline. Asked for as bare
  // ground of one tone, the model painted a blank slab beside the scene, a split frame no designer would set words on
  // (Anthem v9, 9 Nov). A scene's shiny surface (wet asphalt, a lit street) is not room either: words read only on
  // calm ground.
  const calm = `The part of the frame kept for the words is the same continuous photograph, the scene's own open background carried on (${far}), calm and low in detail: no reflections, puddles, lights, highlights, hard shadows or busy texture there. It is never a flat panel, a blank slab, a split frame or a border.`;
  const tone = room.tone === "dark"
    ? ` The words there are set in white, so that part of the picture is mid to deep in tone: the shaded side of the scene, a darker tree line, hedge or wall${sharp ? "" : " softly out of focus"}, never bright sky, a pale wall or sunlit concrete.`
    : room.tone === "light"
      ? " The words there are set in a dark colour, so that part of the picture is light in tone: open sky, a pale wall or light ground, never deep shade."
      : "";
  const button = room.button ? ` The bottom ${room.button} corner, the lowest eighth of the frame's height across ${room.button === room.side ? "that side" : `the ${room.button} half`}, holds only ground (grass, court, floor), with no person, feet, ball or base of the product in it, for the brand's button.` : "";
  const statement = across
    ? `Compose the frame so the product sits whole in the ${other} ${rest}% of the frame's width; the ${room.side} ${pct}% of the width, around the middle of the frame's height, has no person, product or object in it, for the words set later.${tone}${button} The product never fills the frame.`
    : `Compose the frame so the product sits whole in the ${other} ${rest}% of the frame's height; the ${room.side} ${pct}% of the height, edge to edge, has no person, product or object in it, for the words set later.${tone}${button} The product never fills the frame.`;
  return [
    { id: "room-for-words", dimension: "composition", lookKey: null, statement, binding: "hard", epistemic: "known", scope: "core" },
    { id: "room-calm", dimension: "composition", lookKey: null, statement: calm, binding: "hard", epistemic: "known", scope: "core" },
  ];
}

/** The parts of a Look Book (brand-book/look.ts) the prompt is written from. */
export type LookBody = {
  summary?: string;
  signature?: string[];
  camera?: { capture?: string; lenses?: { focalMm: number; use: string }[]; aperture?: string; height?: string; distance?: string; motion?: string };
  light?: { key?: string; quality?: string; direction?: string; colourTemperatureK?: string; contrast?: string; timeOfDay?: string; rules?: string[] };
  colour?: { grade?: string; saturation?: string; blacks?: string; highlights?: string; whiteBalance?: string };
  texture?: { grain?: string; grainCharacter?: string; sharpness?: string; surfaces?: string; lensCharacter?: string };
  composition?: { rules?: string[]; negativeSpace?: string; subjectPlacement?: string };
  people?: { shows?: boolean; skin?: string; direction?: string };
  retouch?: string;
  never?: string[];
  recipes?: { scene: string; camera: string; light: string; grade: string; composition: string }[];
};

const words = (t: string) => new Set(t.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 3));

/** The Look Book's recipe closest to the planned scene, by the words they share (at least two), else none. */
export function recipeFor(look: LookBody, scene: string) {
  const want = words(scene);
  let best: { r: NonNullable<LookBody["recipes"]>[number]; n: number } | null = null;
  for (const r of look.recipes ?? []) {
    const n = [...words(`${r.scene} ${r.composition}`)].filter((w) => want.has(w)).length;
    if (!best || n > best.n) best = { r, n };
  }
  // A recipe for another kind of scene would pull the picture away from the plan: none is better than a stranger.
  return best && best.n >= 2 ? best.r : null;
}

const AI_TELL = /skin|finger|hand|smooth|cgi|render|symmetr|no source|glow|bloom|halo|garbl|warp|invent|front to back|everything (razor )?sharp|in focus|oversaturat|neon|plastic|waxy|airbrush/i;

/** The Look Book as rules: how this picture is shot, lit, graded and textured, and what the brand never does. */
export function lookRules(task: EngineTask): BrandRule[] {
  const look = task.look?.body;
  if (!look) return [];
  const id = (k: string) => `lookbook-${k}`;
  const rule = (k: string, dimension: string, statement: string | null, binding: "hard" | "soft" = "soft"): BrandRule[] =>
    statement && statement.trim().length > 8
      ? [{ id: id(k), dimension, lookKey: null, statement: sentence(statement), binding, epistemic: "known", scope: "core" }]
      : [];
  const join = (...xs: (string | undefined | null)[]) => xs.filter((x) => x && x.trim()).join("; ");
  const planned = plannedCreative(task);
  const recipe = recipeFor(look, `${planned?.scene ?? ""} ${task.creative.title}`);
  const c = look.camera ?? {};
  const lenses = (c.lenses ?? []).map((l) => `${l.focalMm} mm for ${l.use}`).join(", ");
  const l = look.light ?? {};
  const g = look.colour ?? {};
  const t = look.texture ?? {};
  const never = (look.never ?? []).slice(0, 12);
  const taste = never.filter((n) => !AI_TELL.test(n)).slice(0, 6);
  return [
    ...rule("recipe", "look recipe", recipe
      ? `Shoot it as the brand shoots ${recipe.scene}: ${recipe.camera}. Light: ${recipe.light}. Grade: ${recipe.grade}`
      : null),
    ...rule("camera", "camera", join(c.capture && `Captured as ${c.capture}`, lenses && `lenses ${lenses}`, c.aperture, c.height, c.distance)),
    ...rule("light", "light", join(l.key, l.quality, l.direction, l.colourTemperatureK, l.contrast)),
    ...rule("grade", "colour grade", join(g.grade, g.saturation, g.blacks && `blacks ${g.blacks}`, g.highlights && `highlights ${g.highlights}`)),
    ...rule("texture", "texture", join(t.grainCharacter, t.surfaces, t.lensCharacter)),
    // What the brand never does is its taste, held softly so a plan that asks for something else is not blocked by
    // it. The marks of a generated picture are looked for in the picture itself (evaluate.ts), not listed in the
    // prompt: long lists of what to avoid make image models worse.
    ...rule("composition", "composition", join(look.composition?.subjectPlacement, look.composition?.negativeSpace)),
    ...rule("never-taste", "taste", taste.length ? `The brand's pictures avoid ${taste.join("; ")}` : null),
    ...(planned?.people && !/^no people/i.test(planned.people) && look.people?.skin ? rule("skin", "people", look.people.skin, "hard") : []),
  ];
}

export const COMPOSITION_ROLE = "the moodboard's picture for composition, light and mood";
/** How a reference picture of one of the brand's models is named; the picture check does not take it for the product. */
export const CAST_ROLE = "the model ";

export const FORMATS: Record<string, FormatSpec> = {
  feed: { aspectRatio: "4:5", resolution: null },
  square: { aspectRatio: "1:1", resolution: null },
  story: { aspectRatio: "9:16", resolution: null },
  banner: { aspectRatio: "16:9", resolution: null },
};

// Product picture slots in the order a model should see them: the front first sets the base of the picture.
const SLOT_ORDER = ["front", "hero", "packshot", "side", "angle", "back", "top", "detail", "label"];
const slotRank = (slot: string | null) => {
  const i = SLOT_ORDER.indexOf((slot ?? "").toLowerCase());
  return i < 0 ? SLOT_ORDER.length : i;
};
const ORDINAL = ["first", "second", "third", "fourth", "fifth"];

// Brand DNA areas that shape a picture without words; voice, type, claims and the logo shape the words on it.
const IMAGE_AREAS = new Set(["imagery", "colour", "layout"]);
const PRODUCT_AREAS = ["shape", "material", "colour", "packaging", "label"];
const sentence = (s: string) => {
  const t = s.trim().replace(/\s+/g, " ");
  return /[.!?]$/.test(t) ? t : `${t}.`;
};
const HEX = /#[0-9a-f]{6}\b/gi;

/** Which products the creative shows: the planned ones, else every product of the campaign. */
function shown(task: EngineTask, planned: PlannedCreative | undefined): TaskProduct[] {
  const ids = new Set(planned?.productIds ?? []);
  const picked = task.products.filter((p) => ids.has(p.id));
  return picked.length ? picked : task.products;
}

export function plannedCreative(task: EngineTask): PlannedCreative | undefined {
  return (task.plan.planned_creatives ?? []).find((c) => c.id === task.creative.slot);
}

/** Every picture the Engine could send for this creative, with its card: the shown products' own, front first, and
 *  those of the models the plan casts in it. references.ts chooses among them. */
export function referenceCandidates(task: EngineTask): Candidate[] {
  const planned = plannedCreative(task);
  const out: Candidate[] = [];
  const named = (pic: Picture) => {
    const card = cardOf(pic);
    const said = card && pic.card ? says(card) : "";
    return { card, tail: said ? `, ${said}` : pic.slot ? `, ${pic.slot}` : "" };
  };
  for (const p of shown(task, planned))
    for (const pic of [...p.pictures].sort((a, b) => slotRank(a.slot) - slotRank(b.slot))) {
      const { card, tail } = named(pic);
      out.push({ url: pic.url, role: `${p.name}${tail}`, subject: "product", owner: p.id, card, order: out.length });
    }
  const cast = needOf(planned).people ? (task.cast ?? []).filter((m) => planned?.castIds?.includes(m.id)) : [];
  for (const m of cast)
    for (const pic of m.pictures) {
      const { card, tail } = named(pic);
      out.push({ url: pic.url, role: `${CAST_ROLE}${m.name}${tail}`, subject: "person", owner: m.id, card, order: out.length });
    }
  return out;
}

export function buildProduct(task: EngineTask, maxReferences: number): ProductContext {
  const planned = plannedCreative(task);
  const products = shown(task, planned);
  const verified = (p: TaskProduct) => p.facts.filter((f) => f.status === "verified");

  // The product, word for word from its verified facts: shape, material, colour, packaging, label.
  const described = products.map((p) => {
    const name = p.variant ? `${p.name} (${p.variant})` : p.name;
    const facts = verified(p)
      .filter((f) => PRODUCT_AREAS.includes(f.area))
      .sort((a, b) => PRODUCT_AREAS.indexOf(a.area) - PRODUCT_AREAS.indexOf(b.area) || a.label.localeCompare(b.label))
      .map((f) => sentence(f.statement));
    return [`The product is ${name}.`, ...facts].join(" ");
  });
  const lockedProductText = described.join("\n");

  const invariants = products.flatMap((p) =>
    verified(p).filter((f) => f.area === "never").map((f) => ({ id: f.id, statement: sentence(f.statement) }))
  );
  const colours = products.flatMap((p) =>
    verified(p).filter((f) => f.area === "colour").flatMap((f) =>
      [...f.statement.matchAll(HEX)].map((m) => ({ area: f.label.toLowerCase(), valueHex: m[0].toUpperCase() }))
    )
  );

  // The pictures: the version this is made from first, then the product's and the models' own pictures that serve
  // this picture (references.ts: the side it is seen from, how close, with or without people), the best of each first.
  const references: { url: string; role: string }[] = [];
  if (task.master)
    references.push({
      url: task.master.url,
      role: task.master.picked ? `the picture of ${task.master.title} that this changes` : `the approved ${task.master.title}, whose picture this keeps`,
    });
  const candidates = referenceCandidates(task);
  // A composition reference takes the last place, after at least one of the product's own pictures.
  const composition = !task.master && task.composition ? task.composition : null;
  const room = (composition && candidates.length > 0 ? maxReferences - 1 : maxReferences) - references.length;
  const chosen = choose(candidates, needOf(planned), room);
  for (const c of chosen) references.push({ url: c.url, role: c.role });
  if (composition && references.length < maxReferences) references.push({ url: composition.url, role: COMPOSITION_ROLE });
  const onPerson = new Set(chosen.filter((c) => c.card?.of === "product_on_person").map((c) => c.url));

  const lockedReferenceText = references.length
    ? references.map((r, i) => {
      const n = ORDINAL[i] ?? `next`;
      if (task.master && i === 0)
        return task.master.picked
          ? `The ${n} picture is ${r.role}: change only what the designer asks, and keep everything else in it exactly.`
          : `The ${n} picture is ${r.role}: keep its scene, light and product exactly; change only what is asked.`;
      if (r.role === COMPOSITION_ROLE)
        return `The ${n} picture is ${r.role} only: take its framing, camera angle, light and mood, never its objects, products, people, words or brand.`;
      if (r.role.startsWith(CAST_ROLE))
        return `The ${n} picture is ${r.role}, an AI person: keep this same person's face, hair, skin and build; their clothes, their pose and the place are not used.`;
      if (onPerson.has(r.url))
        return `The ${n} picture is the product itself (${r.role}) and the only truth about its shape, colours and label; the person in it and its background are not used.`;
      return `The ${n} picture is the product itself (${r.role}) and the only truth about its shape, colours and label; its background is not used.`;
    }).join(" ")
    : "There is no picture of the product; follow the description of it exactly.";

  return {
    name: products.map((p) => p.name).join(", "),
    lockedProductText,
    lockedReferenceText,
    invariants,
    colours,
    notVisible: [],
    references,
  };
}

const PEOPLE: [RegExp, string][] = [
  [/^no people/i, "No people and no part of a person are in the frame."],
  [/^hands? only/i, "Only a hand, or hands and forearms, are in the frame; no face."],
];

export function buildBrand(task: EngineTask, lookKey: string | null): BrandContext {
  const rules: BrandRule[] = task.rules
    .filter((r) => IMAGE_AREAS.has(r.area))
    .map((r) => ({
      id: r.id,
      dimension: r.area,
      lookKey: null,
      statement: sentence(r.statement),
      binding: r.kind === "preference" ? "soft" : "hard",
      epistemic: r.origin === "supplied" ? "known" : "inferred",
      scope: "core",
    }));

  // What the approved plan's direction says about light, setting, palette and mood: this look's rules.
  const direction = (task.plan.directions ?? []).find((d) => d.id === lookKey);
  for (const [i, line] of (direction?.look ?? []).entries())
    rules.push({
      id: `look-${lookKey}-${i + 1}`,
      dimension: line.label.toLowerCase(),
      lookKey,
      statement: sentence(`${line.label}: ${line.value}`),
      binding: "soft",
      epistemic: "known",
      scope: "look",
    });

  // Who is in the frame. People in a Fume picture are models in a staged scene, never a real or known person and
  // never presented as a customer (Fume's ethics).
  const people = plannedCreative(task)?.people?.trim();
  if (people) {
    const known = PEOPLE.find(([re]) => re.test(people));
    rules.push({
      id: "people",
      dimension: "people",
      lookKey: null,
      statement: known ? known[1] : sentence(`People: ${people}`),
      binding: "hard",
      epistemic: "known",
      scope: "core",
    });
    if (!known)
      rules.push({
        id: "people-ethics",
        dimension: "people",
        lookKey: null,
        statement: "Any person is a model in a staged scene, never a recognisable real person and never posed as a customer.",
        binding: "hard",
        epistemic: "known",
        scope: "core",
      });
  }

  // The taste model: what the brand's pictures do and avoid, where Fume is confident of it.
  const confident = 0.6;
  for (const t of [...task.taste].sort((a, b) => b.do_confidence - a.do_confidence).slice(0, 12)) {
    if (t.words && t.do_confidence >= confident)
      rules.push({ id: `taste-${t.key}`, dimension: "taste", lookKey: null, statement: sentence(t.words), binding: "soft", epistemic: "inferred", scope: "core" });
    if (t.avoid_words && t.avoid_confidence >= confident)
      rules.push({ id: `taste-${t.key}-avoid`, dimension: "taste", lookKey: null, statement: sentence(`Avoid ${t.avoid_words}`), binding: "soft", epistemic: "inferred", scope: "core" });
  }

  // The taste schema: the brand's habits counted from its own pictures, field by field, and first of all the ones
  // the Engine's earlier pictures missed. Soft: the plan may ask for something else, and then the plan wins.
  for (const l of schemaLines(task))
    rules.push({ id: l.id, dimension: l.dimension, lookKey: null, statement: l.statement, binding: "soft", epistemic: "inferred", scope: "core" });

  rules.push(...brainRules(task.brain ?? NO_BRAIN));
  rules.push(...lookRules(task));
  rules.push(...roomRules(task));

  return { rules, forbiddenTerms: [task.brand.name.replace(/\s*\(test\)\s*$/i, "").trim()].filter(Boolean) };
}

// The brand's own pictures in words. A caption that only says where a picture came from says nothing about its look.
const GENERIC_CAPTION = /^(a |the )?(picture|image|photo)s? (from|on|of) (the )?(site|website|web|page|shop|instagram)\b/i;
// The palette roles that colour a brand; text and ground colours belong to layouts, not to a scene.
const SCENE_ROLES = new Set(["primary", "accent", "secondary", "brand", "support"]);
// What a note says about the picture, by its kind; other notes are about words, people or the business.
const PICTURE_NOTE = /image|imagery|look|photo|picture|style|light|colour|color|scene|setting|prop/i;
export const brainImagery = (b: Brain) => b.imagery.filter((i) => i.confirmed && !GENERIC_CAPTION.test(i.what.trim()));
export const brainPalette = (b: Brain) =>
  b.palette
    .filter((c) => c.confirmed && SCENE_ROLES.has((c.role ?? "").toLowerCase()) && c.confidence !== "low")
    .sort((a, c) => (a.role === "primary" ? -1 : 0) - (c.role === "primary" ? -1 : 0))
    .slice(0, 3);
export const brainNotes = (b: Brain) =>
  b.notes.filter((n) => n.confirmed && (n.layer === "rules" || PICTURE_NOTE.test(n.kind)));

/** The Brand Brain's rules for a picture: all soft, the brand's own taste, not its hard rules (those are the Brand DNA's). */
export function brainRules(b: Brain): BrandRule[] {
  const rules: BrandRule[] = [];
  const imagery = brainImagery(b).slice(0, 6);
  if (imagery.length)
    rules.push({
      id: "brain-imagery",
      dimension: "imagery",
      lookKey: null,
      statement: sentence(`The brand's own pictures look like this: ${imagery.map((i) => i.what.trim().replace(/[.]$/, "").toLowerCase()).join("; ")}`),
      binding: "soft",
      epistemic: "known",
      scope: "core",
    });
  const palette = brainPalette(b);
  if (palette.length)
    rules.push({
      id: "brain-palette",
      dimension: "colour",
      lookKey: null,
      statement: sentence(`Where the scene's own colours are free (props, cloth, a wall), they lean to the brand's ${palette.map((c) => `${c.name.toLowerCase()} ${c.hex.toUpperCase()}`).join(" and ")}, and never compete with the product`),
      binding: "soft",
      epistemic: "known",
      scope: "core",
    });
  const market = b.market?.market?.trim();
  if (market)
    rules.push({ id: "brain-market", dimension: "setting", lookKey: null, statement: sentence(`The setting is believable for the brand's market, ${market}`), binding: "soft", epistemic: "known", scope: "core" });
  for (const n of brainNotes(b).slice(0, 4))
    rules.push({ id: `brain-${n.id}`, dimension: n.kind.toLowerCase(), lookKey: null, statement: sentence(n.what), binding: "soft", epistemic: "known", scope: "core" });
  return rules;
}

/** What people asked to change in the brand's other creatives, and what experts said: lessons for this prompt. */
export function brainLessons(b: Brain): Knowledge["lessons"] {
  const changes = b.changes.slice(0, 4).map((c) => ({
    id: `brain-${c.id}`,
    statement: sentence(`${c.creative ? `On ${c.creative}, ` : ""}${c.from === "customer" ? "the customer" : "Fume"} asked to change: ${c.what}`),
    polarity: "avoid" as const,
    reason: c.cause ? sentence(c.cause) : "An earlier creative of this brand.",
  }));
  const checks = b.checks.filter((c) => c.state === "checked" || c.state === "correction").slice(0, 3).map((c) => ({
    id: `brain-${c.id}`,
    statement: sentence(c.what),
    polarity: c.state === "checked" ? ("do" as const) : ("avoid" as const),
    reason: `An expert's note on ${c.creative ?? "an earlier creative"}.`,
  }));
  return [...changes, ...checks];
}

export function buildConcept(task: EngineTask): Concept {
  const planned = plannedCreative(task);
  const directionId = task.plan.chosen_direction_id ?? null;
  const direction = (task.plan.directions ?? []).find((d) => d.id === directionId);
  return {
    id: `${directionId ?? "-"}.${task.creative.slot ?? task.creative.id}`,
    title: planned?.name ?? task.creative.title,
    sceneIdea: sentence(planned?.scene ?? direction?.idea ?? task.creative.title),
    productRole: (direction?.productRole ?? "the clear hero of the frame").replace(/\.$/, ""),
    lookKey: direction ? direction.id : null,
  };
}

export function buildKnowledge(task: EngineTask): Knowledge {
  return {
    exemplars: task.exemplars.slice(0, 3).map((e) => ({ promptText: e.text })),
    lessons: [...task.lessons.slice(0, 12), ...brainLessons(task.brain ?? NO_BRAIN)],
    badFragments: [],
  };
}

export function formatOf(task: EngineTask): FormatSpec {
  return FORMATS[task.creative.format] ?? FORMATS.feed;
}
