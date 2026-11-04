import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
import {
  assemble,
  buildBrand,
  buildCompilePackage,
  buildConcept,
  buildKnowledge,
  buildLedger,
  buildProduct,
  CAMPAIGN_STILL_V1,
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
  assertEquals(missing.filter((f) => f.code === "missing_slot").map((f) => f.slotKey), ["scene", "brand", "constraints"]);
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
