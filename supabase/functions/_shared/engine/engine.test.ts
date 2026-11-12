import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
import {
  assemble,
  buildBrand,
  buildCompilePackage,
  buildConcept,
  buildKnowledge,
  buildLedger,
  buildProduct,
  beta,
  CAST_ROLE,
  CAMPAIGN_STILL_V1,
  chooseVariants,
  classifyFindings,
  type Composer,
  type Decider,
  DIALECTS,
  type EngineTask,
  formatOf,
  GRAMMARS,
  ledgerSummary,
  lint,
  lintText,
  type MachineInput,
  NO_KNOWLEDGE,
  runPromptMachine,
  selectMethod,
  type SlotText,
  type Verifier,
} from "./index.ts";
import { cardFromAnswers, CROPS, needOf, OFS, REF_QUESTIONS, VIEWS } from "./references.ts";
import { plannedPlace } from "./context.ts";

const task: EngineTask = {
  brand: { name: "Nordlys Kaffe (test)" },
  creative: { id: "cr1", title: "Master 1", slot: "pc1", format: "feed", kind: "master" },
  plan: {
    chosen_direction_id: "a",
    directions: [{
      id: "a",
      name: "Quiet first cup",
      idea: "The first cup before the house wakes.",
      productRole: "the bag, standing beside the cup.",
      look: [{ label: "Light", value: "low winter sun from the left" }, { label: "Palette", value: "warm wood and cream" }],
    }],
    planned_creatives: [{ id: "pc1", name: "Master 1", format: "feed", productIds: ["p1"], scene: "A kitchen bench at dawn, steam over a cup", people: "Hands only" }],
  },
  products: [{
    id: "p1",
    name: "Morning Roast",
    variant: "250 g",
    facts: [
      { id: "f1", area: "shape", label: "Bag", statement: "A flat-bottomed paper bag with a fold-over top", status: "verified" },
      { id: "f2", area: "colour", label: "Bag", statement: "The bag is deep blue #1B2A4A", status: "verified" },
      { id: "f3", area: "never", label: "Roast", statement: "Never show the beans spilled", status: "verified" },
      { id: "f4", area: "material", label: "Window", statement: "A clear window shows the beans", status: "unverified" },
      { id: "f5", area: "claim", label: "Organic", statement: "Certified organic", status: "verified" },
    ],
    pictures: [{ slot: "back", url: "https://x/back.png" }, { slot: "front", url: "https://x/front.png" }],
  }],
  rules: [
    { id: "r1", area: "imagery", statement: "One source of daylight with soft shadows", kind: "hard_constraint", origin: "supplied" },
    { id: "r2", area: "voice", statement: "Speak plainly", kind: "rule", origin: "supplied" },
    { id: "r3", area: "colour", statement: "Muted, natural colour", kind: "preference", origin: "inferred" },
  ],
  taste: [
    { key: "warmth", words: "warm light", do_confidence: 0.8, avoid_words: "cold blue casts", avoid_confidence: 0.7 },
    { key: "detail", words: "busy scenes", do_confidence: 0.3, avoid_words: null, avoid_confidence: 0 },
  ],
  lessons: [],
  exemplars: [],
  master: null,
};

function inputOf(t: EngineTask, imageModel = "nano-banana-pro"): MachineInput {
  const concept = buildConcept(t);
  return {
    target: { imageType: "campaign_still", imageModel },
    grammars: GRAMMARS,
    dialects: DIALECTS,
    product: buildProduct(t, 3),
    brand: buildBrand(t, concept.lookKey),
    concept,
    format: formatOf(t),
    knowledge: buildKnowledge(t),
    enforcedLessons: [],
  };
}

const good: SlotText[] = [
  { slotKey: "assignment", text: "A campaign photograph in a tall four by five frame; the brand rules below come before any habit of the model.", sources: ["format"] },
  { slotKey: "people", text: "Only a hand reaches in from the right; no face.", sources: [] },
  { slotKey: "scene", text: "A kitchen bench at dawn with steam rising over a cup, the bag standing beside it.", sources: ["concept"] },
  { slotKey: "camera", text: "Captured on full-frame digital with a 50 mm lens at f/2.8 from table height; low daylight at 5600 K from the left at 3:1 contrast; a soft warm grade with fine grain and real wear on the wood.", sources: [] },
  { slotKey: "brand", text: "Low winter sun from the left, warm wood and cream, one source of daylight with soft shadows.", sources: [] },
  { slotKey: "constraints", text: "One soft daylight source. The beans stay in the bag.", sources: [] },
];
const claimAll = (slots: SlotText[], ids: string[]) => slots.map((s, i) => (i === 0 ? { ...s, sources: [...s.sources, ...ids] } : s));
const call = { task: "compose", provider: "test", model: "test", latencyMs: 1, costUsd: 0 };

Deno.test("the product text is the verified facts word for word, nothing else", () => {
  const p = buildProduct(task, 3);
  assertEquals(
    p.lockedProductText,
    "The product is Morning Roast (250 g). A flat-bottomed paper bag with a fold-over top. The bag is deep blue #1B2A4A.",
  );
  assertEquals(p.invariants, [{ id: "f3", statement: "Never show the beans spilled." }]);
  assertEquals(p.colours, [{ area: "bag", valueHex: "#1B2A4A" }]);
  // The front first: it sets the base of the picture.
  assertEquals(p.references.map((r) => r.url), ["https://x/front.png", "https://x/back.png"]);
  assertMatch(p.lockedReferenceText, /^The first picture is the product itself \(Morning Roast, front\)/);
});

Deno.test("a variant keeps its approved master as the first picture", () => {
  const p = buildProduct({ ...task, master: { url: "https://x/master.png", title: "Master 1" } }, 2);
  assertEquals(p.references.map((r) => r.url), ["https://x/master.png", "https://x/front.png"]);
  assertMatch(p.lockedReferenceText, /^The first picture is the approved Master 1/);
});

Deno.test("the brand's image rules, the direction's look, people and confident taste become rules", () => {
  const b = buildBrand(task, "a");
  const ids = b.rules.map((r) => r.id);
  assertEquals(ids, ["r1", "r3", "look-a-1", "look-a-2", "people", "taste-warmth", "taste-warmth-avoid"]);
  assertEquals(b.rules.find((r) => r.id === "r1")?.binding, "hard");
  assertEquals(b.rules.find((r) => r.id === "r3")?.binding, "soft");
  assertEquals(b.forbiddenTerms, ["Nordlys Kaffe"]);
  // People who are not only hands are models, never posed as real people or customers.
  const withPeople = buildBrand({ ...task, plan: { ...task.plan, planned_creatives: [{ ...task.plan.planned_creatives![0], people: "A woman in her thirties" }] } }, "a");
  assert(withPeople.rules.some((r) => r.id === "people-ethics" && r.binding === "hard"));
});

Deno.test("the concept is the planned creative in the chosen direction", () => {
  const c = buildConcept(task);
  assertEquals(c, { id: "a.pc1", title: "Master 1", sceneIdea: "A kitchen bench at dawn, steam over a cup.", productRole: "the bag, standing beside the cup", lookKey: "a" });
  assertEquals(formatOf(task).aspectRatio, "4:5");
});

Deno.test("the compile package's hash only changes with its content", () => {
  const i = inputOf(task);
  const m = selectMethod(i.target);
  assert(m.method === "compose");
  const a = buildCompilePackage({ ...i, grammar: m.grammar, dialect: m.dialect });
  const b = buildCompilePackage({ ...i, grammar: m.grammar, dialect: m.dialect });
  assertEquals(a.hash, b.hash);
  const c = buildCompilePackage({ ...i, format: { aspectRatio: "1:1", resolution: null }, grammar: m.grammar, dialect: m.dialect });
  assert(a.hash !== c.hash);
  const kinds = a.compilePackage.manifest.map((x) => x.id);
  assert(kinds.includes("inv-f3") && kinds.includes("colour-bag") && kinds.includes("brand-r1") && kinds.includes("concept"));
});

Deno.test("an unknown model or image type is blocked before anything is paid", () => {
  assertEquals(selectMethod({ imageType: "campaign_still", imageModel: "nope" }).method, "blocked");
  assertEquals(selectMethod({ imageType: "video", imageModel: "nano-banana-pro" }).method, "blocked");
});

Deno.test("lint finds rendered text, equipment, file names, forbidden terms and inert syntax", () => {
  const codes = (t: string) => lintText(t, "scene", { forbiddenTerms: ["Nordlys Kaffe"] }).map((f) => f.code);
  assertEquals(codes('A sign that reads "Open"'), ["text_request"]);
  assertEquals(codes("Lit by a softbox"), ["equipment_term"]);
  assertEquals(codes("Match front.png closely"), ["file_name"]);
  assertEquals(codes("A Nordlys Kaffe morning"), ["forbidden_term"]);
  assertEquals(codes("(warm light:1.3) bench"), ["inert_syntax"]);
  assertEquals(codes("Warm light falls across the bench."), []);
});

Deno.test("the locked slots carry the approved text and any change is found", () => {
  const i = inputOf(task);
  const m = selectMethod(i.target);
  assert(m.method === "compose");
  const { compilePackage } = buildCompilePackage({ ...i, grammar: m.grammar, dialect: m.dialect });
  const a = assemble(compilePackage, [...good, { slotKey: "product", text: "A red bag", sources: [] }, { slotKey: "mood", text: "x", sources: [] }]);
  assertEquals(a.slots[0].text, compilePackage.lockedReferenceText);
  assertEquals(a.slots[1].text, compilePackage.lockedProductText);
  assertEquals(a.findings.map((f) => f.code), ["unknown_slot"]);
  const missing = lint(assemble(compilePackage, good.slice(0, 2)), compilePackage);
  assertEquals(missing.filter((f) => f.code === "missing_slot").map((f) => f.slotKey), ["scene", "camera", "brand", "constraints"]);
  const { blocking } = classifyFindings(missing, compilePackage);
  assertEquals(blocking.length, missing.length);
});

const decideAll = (p: number, overrides: Record<string, number | null> = {}): Decider => async ({ questions }) => ({
  probabilities: Object.fromEntries(Object.keys(questions).map((k) => [k, k in overrides ? overrides[k] : k.startsWith("coverage") ? p : 0.05])),
  call: { ...call, task: "decide" },
});
const verifyNo: Verifier = async () => ({ expressed: false, probability: 0.2, reason: "not there", call: { ...call, task: "verify" } });

Deno.test("a prompt that carries everything is validated, with the request the image model gets", async () => {
  const i = inputOf(task);
  let composed = 0;
  const compose: Composer = async ({ compilePackage }) => {
    composed++;
    return { slots: claimAll(good, compilePackage.manifest.map((m) => m.id)), call };
  };
  const r = await runPromptMachine(i, { compose, decide: decideAll(0.95), verify: verifyNo });
  assertEquals(r.status, "validated");
  if (r.status !== "validated") return;
  assertEquals(composed, 1);
  assertEquals(r.request.referenceUrls, ["https://x/front.png", "https://x/back.png"]);
  assertEquals(r.request.aspectRatio, "4:5");
  assert(r.request.text.startsWith("The first picture is the product itself"));
  assert(r.request.text.includes("deep blue #1B2A4A"));
});

Deno.test("findings send the prompt back to be written again, with the findings", async () => {
  const i = inputOf(task);
  const seen: (string[] | null)[] = [];
  const compose: Composer = async ({ compilePackage, previous }) => {
    seen.push(previous ? previous.findings.map((f) => f.code) : null);
    const slots = claimAll(good, compilePackage.manifest.map((m) => m.id));
    if (!previous) slots[2] = { ...slots[2], text: "A kitchen bench lit by a softbox." };
    return { slots, call };
  };
  const r = await runPromptMachine(i, { compose, decide: decideAll(0.95), verify: verifyNo });
  assertEquals(r.status, "validated");
  assertEquals(seen, [null, ["equipment_term"]]);
});

Deno.test("a rule the prompt works against fails it; after three tries a person decides", async () => {
  const i = inputOf(task);
  const compose: Composer = async ({ compilePackage }) => ({ slots: claimAll(good, compilePackage.manifest.map((m) => m.id)), call });
  const r = await runPromptMachine(i, { compose, decide: decideAll(0.95, { "conflict:inv-f3": 0.9 }), verify: verifyNo });
  assertEquals(r.status, "escalated");
  if (r.status !== "escalated") return;
  assertEquals(r.reason, "attempts_exhausted");
  assertEquals(r.attempts.length, 3);
  assertEquals(r.findings.map((f) => f.code), ["conflict"]);
});

Deno.test("an unclear answer goes to the verifier, and to a person when it stays unclear", async () => {
  const i = inputOf(task);
  const compose: Composer = async ({ compilePackage }) => ({ slots: claimAll(good, compilePackage.manifest.map((m) => m.id)), call });
  let verified = 0;
  const unsure: Verifier = async () => {
    verified++;
    return { expressed: true, probability: 0.65, reason: "partly", call: { ...call, task: "verify" } };
  };
  const r = await runPromptMachine(i, { compose, decide: decideAll(0.65), verify: unsure });
  assertEquals(r.status, "escalated");
  if (r.status === "escalated") assertEquals(r.reason, "ambiguous");
  assert(verified > 0);
});

Deno.test("a product with no verified description is escalated before any paid call", async () => {
  const bare: EngineTask = { ...task, products: [{ ...task.products[0], facts: [], pictures: [] }] };
  const i = { ...inputOf(bare), product: { ...buildProduct(bare, 3), lockedProductText: "" } };
  let composed = 0;
  const r = await runPromptMachine(i, { compose: async () => { composed++; return { slots: good, call }; }, decide: decideAll(1), verify: verifyNo });
  assertEquals(r.status, "escalated");
  if (r.status === "escalated") assertEquals(r.reason, "package_invalid");
  assertEquals(composed, 0);
  assertEquals(CAMPAIGN_STILL_V1.slots.length, 7);
  assertEquals(NO_KNOWLEDGE.lessons.length, 0);
});

const brain = {
  market: { market: "Norway", language: "nb" },
  palette: [
    { id: "c1", name: "Red", hex: "#c83232", role: "primary", confidence: "high", confirmed: true },
    { id: "c2", name: "Black", hex: "#000000", role: "text", confidence: "high", confirmed: true },
    { id: "c3", name: "Teal", hex: "#108474", role: "support", confidence: "low", confirmed: true },
  ],
  imagery: [
    { id: "i1", what: "Low side light on stone", confirmed: true },
    { id: "i2", what: "A picture from the site", confirmed: true },
    { id: "i3", what: "Water light on linen", confirmed: false },
  ],
  notes: [
    { id: "n1", layer: "identity", kind: "look", what: "Never a studio sweep behind the bag", confirmed: true },
    { id: "n2", layer: "market", kind: "audience", what: "Home brewers in their thirties", confirmed: true },
  ],
  changes: [{ id: "ch1", what: "The label is blurred", cause: "correction", from: "customer", creative: "Master 2" }],
  checks: [{ id: "x1", what: "Steam reads as smoke", state: "correction", creative: "Master 3" }],
};

Deno.test("the Brand Brain's look, palette, market and picture notes become soft rules; its history becomes lessons", () => {
  const t: EngineTask = { ...task, brain };
  const rules = buildBrand(t, "a").rules;
  const byId = new Map(rules.map((r) => [r.id, r]));
  assertMatch(byId.get("brain-imagery")!.statement, /low side light on stone\./);
  assert(!byId.get("brain-imagery")!.statement.includes("site"), "a caption that only says where it came from is left out");
  assert(!byId.get("brain-imagery")!.statement.includes("linen"), "a proposed picture is left out");
  assertMatch(byId.get("brain-palette")!.statement, /red #C83232/);
  assert(!byId.get("brain-palette")!.statement.includes("#000000"), "a text colour is for layouts");
  assert(!byId.get("brain-palette")!.statement.includes("#108474"), "an unsure colour is left out");
  assertMatch(byId.get("brain-market")!.statement, /Norway/);
  assert(byId.has("brain-n1") && !byId.has("brain-n2"), "only notes about the picture");
  assert([...byId.keys()].filter((k) => k.startsWith("brain-")).every((k) => byId.get(k)!.binding === "soft"));
  const lessons = buildKnowledge(t).lessons;
  assertEquals(lessons.map((l) => [l.id, l.polarity]), [["brain-ch1", "avoid"], ["brain-x1", "avoid"]]);
  assertMatch(lessons[0].statement, /On Master 2, the customer asked to change: The label is blurred\./);
});

Deno.test("the ledger says what of the brand's data went into the prompt, how it was checked, and why the rest did not", () => {
  const t: EngineTask = { ...task, brain, lessons: [{ id: "l1", statement: "Keep the bag upright", polarity: "do", reason: "said" }] };
  const { compilePackage } = buildCompilePackage({ ...inputOf(t), grammar: CAMPAIGN_STILL_V1, dialect: DIALECTS[0] });
  const decisions = compilePackage.manifest.map((m) => ({ key: m.id, kind: "coverage" as const, itemId: m.id, via: m.check === "code" ? "code" as const : "decision" as const, probability: 1, passed: m.id !== "brand-brain-palette" }));
  const ledger = buildLedger(t, compilePackage, decisions);
  const of = (ref: string) => ledger.find((e) => e.ref === ref)!;
  assertEquals([of("f1").used, of("f1").how, of("f1").passed], [true, "verbatim", true]);
  assertEquals([of("f3").used, of("f3").how], [true, "meaning"]);
  assertEquals([of("f4").used, of("f4").why], [false, "Not verified yet."]);
  assertMatch(of("f5").why!, /claim fact is for the words/);
  assertMatch(of("r2").why!, /voice rule is for the words/);
  assertEquals([of("r1").used, of("r1").how], [true, "meaning"]);
  assertEquals([of("taste-warmth").used, of("taste-detail").used], [true, false]);
  assertEquals([of("i1").used, of("i2").used, of("i3").used], [true, false, false]);
  assertEquals([of("c1").used, of("c1").passed, of("c2").used], [true, false, false]);
  assertEquals([of("market").used, of("n1").used, of("n2").used], [true, true, false]);
  assertEquals([of("l1").used, of("ch1").used, of("x1").used], [true, true, true]);
  assertEquals(ledgerSummary(ledger).missing, ["c1"]);
});

Deno.test("a moodboard picture rules composition, light and mood, after the product's own picture, never the product", () => {
  const t: EngineTask = { ...task, composition: { id: "b1", url: "https://x/mood.jpg" } };
  const p = buildProduct(t, 3);
  assertEquals(p.references.map((r) => r.url), ["https://x/front.png", "https://x/back.png", "https://x/mood.jpg"]);
  assertMatch(p.lockedReferenceText, /The third picture is the moodboard's picture for composition, light and mood only: take its framing, camera angle, light and mood, never its objects, products, people, words or brand\./);
  assertEquals(buildProduct(t, 2).references.map((r) => r.url), ["https://x/front.png", "https://x/mood.jpg"]);
  const variant = buildProduct({ ...t, master: { url: "https://x/master.png", title: "Master 1" } }, 3);
  assert(!variant.references.some((r) => r.url === "https://x/mood.jpg"), "a picture made from a master keeps the master's look");
});

// A seeded random source, so a draw is the same every run.
const seeded = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

Deno.test("each choice in a model's dialect keeps one way of saying it", () => {
  const nbp = DIALECTS.find((d) => d.imageModel === "nano-banana-pro")!;
  const { dialect, chosen } = chooseVariants(nbp, [], seeded(1));
  assertEquals(chosen.length, 2);
  assertEquals(dialect.rules.filter((r) => r.choice === "length").length, 1);
  assertEquals(dialect.rules.filter((r) => r.choice === "light").length, 1);
  assertEquals(dialect.rules.filter((r) => !r.choice).length, nbp.rules.filter((r) => !r.choice).length);
});

Deno.test("the Engine moves to the way of writing whose pictures did better, and still tries the other", () => {
  const nbp = DIALECTS.find((d) => d.imageModel === "nano-banana-pro")!;
  const arms = [
    { feature: "dialect:nbp-length-tight", n: 30, sum: 24 },
    { feature: "dialect:nbp-length-full", n: 30, sum: 9 },
  ];
  const random = seeded(7);
  let tight = 0;
  for (let i = 0; i < 400; i++) if (chooseVariants(nbp, arms, random).chosen.includes("nbp-length-tight")) tight++;
  assert(tight > 380, `the better way wins nearly always with this much evidence (${tight}/400)`);
  let fresh = 0;
  for (let i = 0; i < 400; i++) if (chooseVariants(nbp, [], random).chosen.includes("nbp-length-tight")) fresh++;
  assert(fresh > 150 && fresh < 250, `with no evidence both are tried about as often (${fresh}/400)`);
  let mean = 0;
  for (let i = 0; i < 2000; i++) mean += beta(3, 7, random) / 2000;
  assert(Math.abs(mean - 0.3) < 0.03, `a Beta(3, 7) draw averages 0.3 (${mean.toFixed(3)})`);
});

Deno.test("empty quality words are found, and a camera slot must name the lens, aperture, kelvin and grain", () => {
  const found = lintText("A stunning, hyperrealistic 8K masterpiece with cinematic light.", "scene", { forbiddenTerms: [] });
  assertEquals(found.filter((f) => f.code === "slop_term").length, 5);
  assertEquals(lintText("Low sun on worn wood.", "scene", { forbiddenTerms: [] }).length, 0);
});

Deno.test("the Look Book becomes rules for the camera slot, with the recipe closest to the scene", async () => {
  const { lookRules, recipeFor } = await import("./context.ts");
  const look = {
    camera: { capture: "full-frame digital, clean", lenses: [{ focalMm: 35, use: "places" }], aperture: "f/2.8", height: "at table height" },
    light: { key: "window daylight", quality: "soft", direction: "from the left", colourTemperatureK: "5600 K", contrast: "3:1" },
    colour: { grade: "warm, muted greens", blacks: "rich" },
    texture: { grainCharacter: "fine 35 mm grain", surfaces: "crumbs, worn linen" },
    never: ["plastic skin", "light with no source", "kitchen counters"],
    recipes: [
      { scene: "studio packshot", camera: "100 mm macro at f/8", light: "large soft key", grade: "neutral", composition: "centred" },
      { scene: "kitchen bench at dawn", camera: "35 mm at f/2.8 from table height", light: "window daylight 5600 K", grade: "warm, fine grain", composition: "product right third" },
    ],
  };
  assertEquals(recipeFor(look, "A kitchen bench at dawn, steam over a cup, breakfast")?.scene, "kitchen bench at dawn");
  assertEquals(recipeFor(look, "Skoen på våt asfalt om natten"), null);
  const rules = lookRules({ ...task, look: { id: "lb", version: 1, state: "approved", body: look } });
  assertEquals(rules.map((r) => r.id), ["lookbook-recipe", "lookbook-camera", "lookbook-light", "lookbook-grade", "lookbook-texture", "lookbook-never-taste"]);
  assertEquals(rules.some((r) => r.binding === "hard"), false);
  const brand = buildBrand({ ...task, look: { id: "lb", version: 1, state: "approved", body: look } }, null);
  const { compilePackage } = buildCompilePackage({
    target: { imageType: "campaign_still", imageModel: "nano-banana-pro" },
    grammar: GRAMMARS.find((g) => g.imageType === "campaign_still" && g.version === 2)!,
    dialect: DIALECTS[0],
    product: buildProduct(task, 3),
    brand,
    concept: buildConcept(task),
    format: formatOf(task),
    knowledge: NO_KNOWLEDGE,
    enforcedLessons: [],
  } as never);
  const camera = compilePackage.manifest.filter((m) => m.suggestedSlot === "camera").map((m) => m.id);
  assertEquals(camera, ["brand-lookbook-recipe", "brand-lookbook-camera", "brand-lookbook-light", "brand-lookbook-grade", "brand-lookbook-texture"]);
});

Deno.test("a picture that carries words is made with room for them, where the plan or the brand puts them", async () => {
  const { roomRules, wordsRoom } = await import("./context.ts");
  const pc = task.plan.planned_creatives![0];
  const room = { id: "db", version: 1, layouts: [
    { name: "Panel", band: "middle" as const, align: "center" as const, wordsWidthPct: 38, ground: "colour_block" },
    { name: "Beside the model, left", band: "middle" as const, align: "left" as const, wordsWidthPct: 25, ground: "photo" },
  ] };
  assertEquals(wordsRoom({ ...task, room }), null, "a picture without words needs no room");
  const withWords = (scene: string) => ({ ...task, room, plan: { ...task.plan, planned_creatives: [{ ...pc, text: "FLANELLSKJORTER", scene }] } });
  assertEquals(wordsRoom(withWords("A shirt laid flat. Right side of the frame kept clear for the headline."))?.side, "right");
  const fromBrand = wordsRoom(withWords("A shirt laid flat on grey."));
  assertEquals([fromBrand?.side, fromBrand?.share], ["left", 0.39]);
  const [rule, calm] = roomRules(withWords("A shirt laid flat on grey."));
  assertEquals([rule.id, rule.binding, rule.dimension], ["room-for-words", "hard", "composition"]);
  assertEquals(/right 61% of the frame.s width/.test(rule.statement) && /never fills the frame/.test(rule.statement), true);
  // What is in the room and how calm it is are two rules: only the first has the picture made once more.
  assertEquals([calm.id, calm.binding], ["room-calm", "hard"]);
  assertEquals(/reflections|texture|out of focus/.test(rule.statement), false, "the rule a picture is made again for says nothing of texture");
  assertEquals(/no reflections, puddles, lights/.test(calm.statement), true, "a scene's shiny surface is not room for words");
  assertEquals(/never a flat panel, a blank slab, a split frame/.test(calm.statement), true, "the room is the scene's own background, not a slab");
  assertEquals(/softly out of focus/.test(calm.statement), true, "a brand with no taste read may have a soft background");
  assertEquals(/button/.test(rule.statement), false, "no button corner when the brand sets none apart");
  assertEquals(wordsRoom({ ...withWords("x"), master: { url: "u", title: "V1", picked: true } }), null, "a correction keeps its frame");
  // The layout the plan chose for the creative wins over the scene's words and the brand's first layout.
  const planned = { ...task, room, plan: { ...task.plan, planned_creatives: [{ ...pc, text: "HELG", scene: "Right side kept clear.", layout: "Panel" }] } };
  const chosen = wordsRoom(planned);
  assertEquals([chosen?.side, chosen?.from], ["left", 'the brand\'s layout "Panel"']);
  const top = { ...room, layouts: [...room.layouts, { name: "Top line", band: "top" as const, align: "left" as const, wordsWidthPct: 70, ground: "photo" }] };
  assertEquals(wordsRoom({ ...planned, room: top, plan: { ...planned.plan, planned_creatives: [{ ...pc, text: "HELG", scene: "x", layout: "Top line" }] } })?.side, "top");
  assertEquals(wordsRoom({ ...planned, plan: { ...planned.plan, planned_creatives: [{ ...pc, text: "HELG", scene: "Right side kept clear.", layout: "Not the brand's" }] } })?.side, "right",
    "a layout the brand does not have is not used");
  const measured = { ...room, layouts: [{ ...room.layouts[1], box: { x: 0.07, y: 0.3, w: 0.3, h: 0.35 } }] };
  const boxed = wordsRoom({ ...withWords("A shirt laid flat on grey."), room: measured });
  assertEquals([boxed?.side, boxed?.share], ["left", 0.43], "the room reaches just past the brand's own block of words");
  // Anthem: a big block of words and SHOP NOW apart in the bottom right.
  const anthem = { ...room, layouts: [{ ...room.layouts[1], box: { x: 0.15, y: 0.3, w: 0.4, h: 0.28 }, ctaAt: "bottom_right" }] };
  const wide = wordsRoom({ ...withWords("A hoop in a driveway."), room: anthem });
  assertEquals([wide?.side, wide?.share, wide?.button], ["left", 0.5, "right"], "never more than half the frame");
  const [corner] = roomRules({ ...withWords("A hoop in a driveway."), room: anthem });
  assertEquals(/bottom right corner, the lowest eighth of the frame's height across the right half/.test(corner.statement), true);
  assertEquals(/white/.test(corner.statement), false, "no tone where the brand's words tone is not known");
  // Anthem sets white words: the room is darker than they are, never bright sky.
  const light = { ...anthem, layouts: [{ ...anthem.layouts[0], words: "light" }] };
  const [white] = roomRules({ ...withWords("A hoop in a driveway."), room: light });
  assertEquals(/set in white, so that part of the picture is mid to deep in tone.*never bright sky/.test(white.statement), true);
  // A brand whose own pictures stay sharp behind the subject is never asked for a room out of focus.
  const { keepsSharpBehind } = await import("./context.ts");
  const line = (key: string, says: string, absence = false) => ({ key, group: "camera", lever: "prompt" as const, when: "always" as const, standing: "always" as const, confidence: 0.9, share: 1, says, absence, weight: 0.9 });
  const taste = (lines: ReturnType<typeof line>[]) => ({ schema: 1, pictures: 30, campaigns: 5, tested: false, lines, targets: [], choices: [], never: [] });
  const deep = { ...withWords("A hoop in a driveway."), room: light, tasteDirection: taste([line("camera.depth_of_field", "Camera, depth of field: deep")]) };
  assertEquals(keepsSharpBehind(deep), true);
  assertEquals(keepsSharpBehind({ ...deep, tasteDirection: taste([line("camera.background_blur", "Camera: no background blur", true)]) }), true);
  assertEquals(keepsSharpBehind({ ...deep, tasteDirection: taste([line("camera.depth_of_field", "Camera, depth of field: shallow")]) }), false);
  assertEquals(keepsSharpBehind({ ...deep, tasteDirection: null }), false);
  const [sharpRoom, sharpCalm] = roomRules(deep);
  assertEquals(/out of focus/.test(sharpRoom.statement + sharpCalm.statement), false);
  assertEquals(/as sharp as the rest of the picture/.test(sharpCalm.statement), true);
});

Deno.test("a kind's own deep focus applies when the top-level taste lines are empty", async () => {
  const { keepsSharpBehind, roomRules, schemaLines } = await import("./context.ts");
  const line = { key: "camera.depth_of_field", group: "camera", lever: "prompt" as const, when: "always" as const, standing: "always" as const, confidence: 0.9, share: 1, says: "Camera, depth of field: deep", absence: false, weight: 0.9 };
  const direction = { schema: 1, pictures: 30, campaigns: 5, tested: false, lines: [], targets: [], choices: [], never: [] };
  const alone = {
    ...task,
    plan: { ...task.plan, planned_creatives: [{ ...task.plan.planned_creatives![0], people: "No people", text: "WORDS", scene: "A bag on a bench. Bottom kept clear for words." }] },
    tasteDirection: { ...direction, kinds: { product_alone: { ...direction, lines: [line] } } },
  };
  assertEquals(keepsSharpBehind(alone), true);
  assertEquals(schemaLines(alone).map((l) => l.key), [line.key]);
  const calm = roomRules(alone).find((r) => r.id === "room-calm")!;
  assertEquals(calm.statement.includes("as sharp as the rest of the picture"), true);
});

Deno.test("the picture check holds the product's printed face to its photographs", async () => {
  const { checklist, EVALUATOR_SYSTEM, evaluatorPrompt, toEvaluation } = await import("./evaluate.ts");
  const checks = checklist([], true);
  assertEquals([checks.length, checks[0].area, checks[0].hard], [1, "product", true]);
  assertEquals(/Added or changed words, logos, badges or panels on a face shown in its own photographs make this item off/.test(checks[0].requirement), true);
  assertEquals(evaluatorPrompt(checks, true).includes(checks[0].requirement), true);
  assertEquals(/do not infer a match from a familiar brand or plausible packaging/.test(EVALUATOR_SYSTEM), true);
  assertEquals(EVALUATOR_SYSTEM.includes("checked elsewhere"), false);
  // Møllers Trankapsler, 11 Nov (job a70e3578): a plausible pack with an invented label must not pass.
  const e = toEvaluation(checks, { answers: [{ n: 1, verdict: "off", note: "The pack has a label panel absent from its own photographs." }], artefacts: "none", artefactNotes: [], printedText: false });
  assertEquals([e.productTruth, e.brandRules, e.printedText], ["flag", "pass", false]);
});

Deno.test("only the room-for-words checklist item carries the designer's judging note", async () => {
  const { checklist, ROOM_REF } = await import("./evaluate.ts");
  const requirement = "Keep the left 40% of the picture clear for words.";
  const manifest = [
    { kind: "brand_rule_hard" as const, requirement, required: true, refId: ROOM_REF },
    { kind: "brand_rule_hard" as const, requirement, required: true, refId: "room-calm" },
    { kind: "product_invariant" as const, requirement: "The bag is deep blue.", required: true, refId: "bag" },
    { kind: "concept" as const, requirement: "A kitchen bench at dawn.", required: false, refId: "concept" },
  ];
  const checks = checklist(manifest);
  assertEquals(checks[0].requirement, `${requirement} Judge this by eye, as a designer setting the words would: it holds when the words could be set there without covering the product or a person. A product edge reaching a little into that part, or a calm texture there, still holds. It is off only when the product, a person or an object sits clearly inside it, when it is a flat panel, blank slab or split frame, or when its tone is wrong for the words.`);
  assertEquals(checks[0].ref, ROOM_REF);
  assertEquals(checks.slice(1).map((c) => c.requirement), manifest.slice(1).map((m) => m.requirement));
  assertEquals(manifest[0].requirement, requirement);
});

Deno.test("the taste schema's habits become soft rules in the photograph's slots: what applies to this picture, what the Engine missed first", async () => {
  const { buildProfile } = await import("../taste/profile.ts");
  const { direction } = await import("../taste/direction.ts");
  const { checklist } = await import("./evaluate.ts");
  const card = (id: string, read: Record<string, string>) => ({ id, read, measured: {} });
  const brandCards = Array.from({ length: 12 }, (_, i) => card(`b${i}`, {
    "camera.depth_of_field": "deep", "colour.temperature": "warm", "light.lamps_in_frame": "none", "people.framing": "full_body",
    "light.catchlights": "not_visible", "design.button": "none", "kind.use": "brand_campaign",
  }));
  const engineCards = Array.from({ length: 6 }, (_, i) => card(`e${i}`, { "camera.depth_of_field": "shallow", "colour.temperature": "warm", "light.lamps_in_frame": "none" }));
  const t: EngineTask = { ...task, tasteDirection: direction(buildProfile(brandCards), buildProfile(engineCards)) };
  const schema = buildBrand(t, "a").rules.filter((r) => r.id.startsWith("schema-"));
  assertEquals(schema[0], {
    id: "schema-camera.depth_of_field", dimension: "camera", lookKey: null, binding: "soft", epistemic: "inferred", scope: "core",
    statement: "Camera, depth of field: deep. Earlier Engine pictures had shallow 100%.",
  });
  // Hands only: people are in the frame, a face is not. The plan's and the design layer's fields are not the prompt's.
  const ids = schema.map((r) => r.id);
  assert(ids.includes("schema-people.framing") && !ids.includes("schema-light.catchlights") && !ids.includes("schema-design.button") && !ids.includes("schema-kind.use"));
  assertEquals(schema.find((r) => r.id === "schema-people.framing")!.dimension, "people");
  assert(!buildBrand({ ...t, plan: { ...t.plan, planned_creatives: [{ ...t.plan.planned_creatives![0]!, people: "No people" }] } }, "a").rules.some((r) => r.id === "schema-people.framing"));
  assertEquals(buildBrand(task, "a").rules.filter((r) => r.id.startsWith("schema-")), []);

  const { compilePackage } = buildCompilePackage({ ...inputOf(t), grammar: GRAMMARS.find((g) => g.imageType === "campaign_still" && g.version === 2)!, dialect: DIALECTS[0] });
  const item = compilePackage.manifest.find((m) => m.id === "brand-schema-camera.depth_of_field")!;
  assertEquals([item.kind, item.required, item.suggestedSlot], ["brand_rule_soft", false, "camera"]);
  const ledger = buildLedger(t, compilePackage);
  assertEquals(ledger.find((e) => e.ref === "schema-camera.depth_of_field")!.used, true);
  assertMatch(ledger.find((e) => e.ref === "schema-light.catchlights")!.why!, /weightiest habits that apply/);
  // Whether a picture keeps the habits is judged by reading it against the schema, not by the picture check.
  assert(!checklist(compilePackage.manifest).some((c) => /depth of field/.test(c.requirement)));

  // The brief decides the place. A brand of the studio whose plan sets this picture on a street: the studio's habits
  // are left out and the ledger says why; the craft (deep focus) stays. A plan in the studio keeps them all.
  const studio = Array.from({ length: 12 }, (_, i) => card(`s${i}`, { "setting.type": "plain_studio", "setting.tidiness": "pristine", "camera.depth_of_field": "deep" }));
  const at = (place: string | undefined, scene: string): EngineTask => ({
    ...task, tasteDirection: direction(buildProfile(studio)),
    plan: { ...task.plan, planned_creatives: [{ ...task.plan.planned_creatives![0]!, people: "No people", scene, ...(place ? { place } : {}) }] },
  });
  const idsAt = (x: EngineTask) => buildBrand(x, "a").rules.filter((r) => r.id.startsWith("schema-")).map((r) => r.id);
  assert(idsAt(at("studio", "The bottle on a grey ground.")).includes("schema-setting.tidiness"));
  const street = at("outdoors", "The bottle on a kerb.");
  assertEquals([idsAt(street).includes("schema-setting.tidiness"), idsAt(street).includes("schema-camera.depth_of_field")], [false, true]);
  const streetLedger = buildLedger(street, buildCompilePackage({ ...inputOf(street), grammar: GRAMMARS.find((g) => g.imageType === "campaign_still" && g.version === 2)!, dialect: DIALECTS[0] }).compilePackage);
  assertMatch(streetLedger.find((e) => e.ref === "schema-setting.tidiness")!.why!, /somewhere else than the brand's usual place/);
  // A plan written before the plan said the place: the scene's own words say it; a scene that names none changes nothing.
  assertEquals([plannedPlace({ id: "a", name: "a", format: "feed", scene: "On a seamless grey studio ground." }), plannedPlace({ id: "a", name: "a", format: "feed", scene: "On a wet pavement at night." }), plannedPlace({ id: "a", name: "a", format: "feed", scene: "The bottle, close." })], ["studio", "outdoors", null]);
  assert(!idsAt(at(undefined, "The bottle on a wet pavement at night.")).includes("schema-setting.tidiness"));
});

Deno.test("the Engine sends the reference pictures the planned picture needs: the right side, with or without people", () => {
  const scene = (s: string, people = "No people", extra: Partial<EngineTask> = {}): EngineTask => ({
    ...task, ...extra,
    plan: { ...task.plan, planned_creatives: [{ ...task.plan.planned_creatives![0]!, scene: s, people, ...(extra.cast ? { castIds: ["m1"] } : {}) }] },
  });
  assertEquals(needOf({ name: "x", scene: "She walks away from the camera, seen from behind", people: "One woman, full body" }), { view: "back", crop: "whole", people: true });
  assertEquals(needOf({ name: "x", scene: "A cup on a bench" }), { view: null, crop: null, people: false });
  // The plan's own fields win over its words; a value it does not list is not a side.
  assertEquals(needOf({ scene: "A woman seen from behind", people: "One woman", view: "side", crop: "half" }), { view: "side", crop: "half", people: true });
  assertEquals(needOf({ scene: "A woman seen from behind", people: "One woman", view: "sideways" }).view, "back");
  // The plan writer's own phrases.
  const view = (scene: string) => needOf({ scene, people: "Cast models, faces small or turned away" }).view;
  assertEquals([view("A teen, back mostly to camera, stands under the hoop"), view("A volunteer walks away toward the pitch"), view("One shoe in three-quarter profile on wet paving"),
    view("A player seen in profile and small, eyes on the rim"), view("Photograph from the sideline at kneeling height, faces turned away")], ["back", "back", "three_quarter", "side", null]);

  // A plan that names no side leaves every picture in (the test at the top: front, then back).
  // From the front: the back would put the wrong side in the frame, so it is left out, and the ledger says why.
  const front = scene("The bag seen from the front on a bench");
  assertEquals(buildProduct(front, 3).references.map((r) => r.url), ["https://x/front.png"]);
  const { compilePackage } = buildCompilePackage({ ...inputOf(front), grammar: CAMPAIGN_STILL_V1, dialect: DIALECTS[0] });
  assertEquals(buildLedger(front, compilePackage).find((e) => e.ref === "x/back.png"), {
    ref: "x/back.png", source: "picture", what: "Morning Roast, back", used: false, why: "It is seen from the back, and this picture is from the front.",
  });
  // From behind: the back first, and the front still, for it is the truth about the product.
  assertEquals(buildProduct(scene("The bag from behind, its back to camera"), 3).references.map((r) => r.url), ["https://x/back.png", "https://x/front.png"]);

  // Pictures a classifier has looked at: a web import's "site-3" says nothing, its card does.
  const read: EngineTask["products"] = [{ ...task.products[0]!, pictures: [
    { slot: "front", url: "https://x/front.png" },
    { slot: "site-2", url: "https://x/worn.png", card: { of: "product_on_person", view: "front", crop: "whole" } },
    { slot: "site-3", url: "https://x/unknown.png" },
    { slot: "site-4", url: "https://x/chart.png", card: { of: "other", view: null, crop: null } },
  ] }];
  // No people in the picture: a product on a person would bring the person, and a size chart is not the product.
  const still = buildProduct(scene("The bag on a bench", "No people", { products: read }), 3);
  assertEquals(still.references.map((r) => r.url), ["https://x/front.png", "https://x/unknown.png"]);
  // People in the picture: how it is worn is shown, and the model is told what it is looking at.
  const worn = buildProduct(scene("A woman holds the bag, facing the camera", "One woman, waist up", { products: read }), 3);
  assertEquals(worn.references.map((r) => r.role), ["Morning Roast, front", "Morning Roast, worn by a person, the whole figure, seen from the front", "Morning Roast, site-3"]);
  assertMatch(worn.lockedReferenceText, /The second picture is the product itself \(Morning Roast, worn by a person[^)]*\) and the only truth about its shape, colours and label; the person in it and its background are not used\./);
  // Two products share the places: each one's best picture before either one's second.
  const two = buildProduct({ ...front, products: [...read, { id: "p2", name: "Evening Roast", facts: [], pictures: [{ slot: "front", url: "https://x/evening.png" }] }],
    plan: { ...front.plan, planned_creatives: [{ ...front.plan.planned_creatives![0]!, productIds: ["p1", "p2"] }] } }, 2);
  assertEquals(two.references.map((r) => r.url), ["https://x/front.png", "https://x/evening.png"]);
});

Deno.test("a model the plan casts is sent from the side the picture needs, and never without being cast", () => {
  const cast = [{ id: "m1", name: "Ane", pictures: [
    { slot: "front", url: "https://x/ane-front.png", card: { of: "person", view: "front", crop: "half" } },
    { slot: "back", url: "https://x/ane-back.png", card: { of: "person", view: "back", crop: "whole" } },
    { slot: "profile", url: "https://x/ane-side.png" },
  ] }];
  const planned = (s: string, people: string, castIds?: string[]): EngineTask => ({
    ...task, cast, plan: { ...task.plan, planned_creatives: [{ ...task.plan.planned_creatives![0]!, scene: s, people, ...(castIds ? { castIds } : {}) }] },
  });
  // From the front: her front first among her own pictures, never her back; the product keeps its place.
  const p = buildProduct(planned("A woman drinks coffee by the window, facing the camera", "One woman, waist up", ["m1"]), 4);
  assertEquals(p.references.map((r) => r.url), ["https://x/front.png", "https://x/ane-front.png", "https://x/ane-side.png"]);
  assertMatch(p.lockedReferenceText, /The second picture is the model Ane, seen from the front, an AI person: keep this same person's face, hair, skin and build; their clothes, their pose and the place are not used\./);
  // From behind: only her back.
  const behind = buildProduct(planned("A woman walks to the window, seen from behind", "One woman, full body", ["m1"]), 3);
  assertEquals(behind.references.filter((r) => r.role.startsWith(CAST_ROLE)).map((r) => r.url), ["https://x/ane-back.png"]);
  // Not cast, or no people: nobody is put in the picture.
  assert(!buildProduct(planned("A woman drinks coffee", "One woman"), 4).references.some((r) => r.role.startsWith(CAST_ROLE)));
  assert(!buildProduct(planned("A cup on a bench", "No people", ["m1"]), 4).references.some((r) => r.role.startsWith(CAST_ROLE)));
});

Deno.test("a classifier's answers about a reference picture become its card", () => {
  assertEquals(cardFromAnswers({ of: "product_on_person", view: "three_quarter", crop: "half" }), { of: "product_on_person", view: "three_quarter", crop: "half" });
  assertEquals(cardFromAnswers({ of: "product", view: "cannot_tell", crop: "whole" }), { of: "product", view: null, crop: "whole" });
  assertEquals(cardFromAnswers({ of: "a cat" }), null);
  // The lists a classifier is asked are the lists a card keeps.
  assertEquals(Object.keys(REF_QUESTIONS.of.options), [...OFS]);
  assertEquals(Object.keys(REF_QUESTIONS.view.options), [...VIEWS, "cannot_tell"]);
  assertEquals(Object.keys(REF_QUESTIONS.crop.options), [...CROPS]);
});
