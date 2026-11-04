// The data domain: what the Engine knows when it writes a prompt, built from Fume's own records (the job's frozen
// snapshot, the approved plan, the product's verified facts and pictures, the Brand DNA's rules, the taste model and
// the lessons people's verdicts taught). Built by code, never by a model: the product text is the verified facts
// word for word, so the model can only describe the scene around the product, never the product itself.
import type { BrandContext, BrandRule, Concept, FormatSpec, Knowledge, ProductContext } from "./types.ts";

export type Fact = { id: string; product_id?: string; area: string; label: string; statement: string; status: string };
export type Picture = { slot: string | null; url: string; name?: string };
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
};
export type PlanBody = {
  chosen_direction_id?: string;
  directions?: { id: string; name: string; idea: string; hook?: string; productRole?: string; look?: PlanLine[] }[];
  planned_creatives?: PlannedCreative[];
};
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
};

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

  // The pictures: the version this is made from first, then each product's pictures front first.
  const pictures: { url: string; role: string }[] = [];
  if (task.master)
    pictures.push({
      url: task.master.url,
      role: task.master.picked ? `the picture of ${task.master.title} that this changes` : `the approved ${task.master.title}, whose picture this keeps`,
    });
  for (const p of products)
    for (const pic of [...p.pictures].sort((a, b) => slotRank(a.slot) - slotRank(b.slot)))
      pictures.push({ url: pic.url, role: `${p.name}${pic.slot ? `, ${pic.slot}` : ""}` });
  const references = pictures.slice(0, maxReferences);

  const lockedReferenceText = references.length
    ? references.map((r, i) => {
      const n = ORDINAL[i] ?? `next`;
      if (task.master && i === 0)
        return task.master.picked
          ? `The ${n} picture is ${r.role}: change only what the designer asks, and keep everything else in it exactly.`
          : `The ${n} picture is ${r.role}: keep its scene, light and product exactly; change only what is asked.`;
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

  return { rules, forbiddenTerms: [task.brand.name.replace(/\s*\(test\)\s*$/i, "").trim()].filter(Boolean) };
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
    lessons: task.lessons.slice(0, 12),
    badFragments: [],
  };
}

export function formatOf(task: EngineTask): FormatSpec {
  return FORMATS[task.creative.format] ?? FORMATS.feed;
}
