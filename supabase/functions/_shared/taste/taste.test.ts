// The taste schema, its profile and its questions, without pictures or a model: deno test supabase/functions/_shared/taste/
import { assert, assertEquals } from "jsr:@std/assert@1";
import { z } from "npm:zod@4.6.7";
import { awayFromHabit, direction, finishTargets, habitualPlace, ofThePlace, planBrief, promptLines } from "./direction.ts";
import { buildProfile, type Card, compare, fit, lowerBound, proofOf, tasteScore } from "./profile.ts";
import { answersOf, CANNOT_TELL, laterPasses, parseAnswer, passFields, passPromptWithShape, passShape, showsOf } from "./read.ts";
import { FIELD, FIELDS, GROUPS, measuredFields, PASSES, readFields, type Shows } from "./schema.ts";
import { build, finishOfPhotographs } from "./build.ts";
import { measureCard } from "./card.ts";
import { resizeTo, SMALLEST, VIEW } from "./finish.ts";

const card = (id: string, read: Card["read"], measured: Card["measured"] = {}, campaign?: string): Card => ({ id, read, measured, campaign });
const NOTHING: Shows = { people: false, face: false, severalPeople: false, product: false, words: false, logo: false, outdoors: false };

Deno.test("the schema: every field has a group, read fields have options or are words, and every read field is asked in one pass", () => {
  const groups = new Set(GROUPS.map((g) => g.key));
  for (const f of FIELDS) {
    assert(groups.has(f.group), `${f.key}: no such group`);
    if (f.how === "measured") assertEquals(f.type, "number", f.key);
    else if (f.type !== "words") assert((f.options?.length ?? 0) >= 2 && !f.options!.includes(CANNOT_TELL), `${f.key}: options`);
  }
  assert(FIELDS.length >= 340 && measuredFields().length >= 70);
  const asked = PASSES.flatMap((p) => readFields(p).map((f) => f.key));
  assertEquals(new Set(asked).size, asked.length);
  assertEquals(asked.length, readFields().length);
});

Deno.test("a flat picture measures every measured field of the schema and nothing else", () => {
  const data = new Uint8ClampedArray(640 * 800 * 4);
  for (let i = 0; i < 640 * 800; i++) data.set([120 + (i % 7), 90, 60, 255], i * 4);
  const { measured } = measureCard({ width: 640, height: 800, data });
  const unknown = Object.keys(measured).filter((k) => FIELD.get(k)?.how !== "measured");
  assertEquals(unknown, []);
  const missing = measuredFields().map((f) => f.key).filter((k) => !(k in measured));
  assertEquals(missing, []);
});

Deno.test("a habit is 'always' only with pictures enough; a split is free; a split that follows the campaigns is the campaign's choice", () => {
  assert(lowerBound(3, 3) < 0.6 && lowerBound(10, 10) > 0.75);
  const few = buildProfile([1, 2, 3].map((i) => card(`f${i}`, { "people.framing": "full_body" })));
  assertEquals(few.fields["people.framing"]!.standing, "unknown");

  const cards = Array.from({ length: 12 }, (_, i) =>
    card(`c${i}`, {
      "people.framing": "full_body",
      "people.gaze": i % 2 ? "into_the_camera" : "down",
      "mood.temperature": i < 6 ? "cold" : "warm",
    }, { "finish.grain_overall": 0.4 + (i % 3) * 0.01 }, i < 6 ? "winter" : "summer"));
  const p = buildProfile(cards);
  assertEquals([p.pictures, p.campaigns], [12, 2]);
  assertEquals(p.fields["people.framing"]!.standing, "always");
  assertEquals(p.fields["people.framing"]!.value, "full_body");
  assertEquals(p.fields["people.gaze"]!.standing, "free");
  assertEquals(p.fields["mood.temperature"]!.standing, "by_campaign");
  assertEquals(p.fields["mood.temperature"]!.campaigns, { winter: "cold", summer: "warm" });
  assert(p.fields["finish.grain_overall"]!.range!.p90 < 0.43);
});

Deno.test("fit counts only what the brand keeps to; the gap between two sets names the field that differs", () => {
  const brand = buildProfile(Array.from({ length: 12 }, (_, i) =>
    card(`b${i}`, { "people.framing": "full_body", "camera.height": "low", "people.gaze": i % 2 ? "into_the_camera" : "down" }, { "finish.grain_overall": 0.5 })));
  const like = card("x", { "people.framing": "full_body", "camera.height": "low", "people.gaze": "down" }, { "finish.grain_overall": 0.5 });
  const unlike = card("y", { "people.framing": "close_up", "camera.height": "eye_level", "people.gaze": "down" }, { "finish.grain_overall": 3 });
  assertEquals(fit(brand, like).fit, 1);
  const off = fit(brand, unlike);
  assert(off.fit < 0.2, String(off.fit));
  assert(!off.gaps.some((g) => g.key === "people.gaze"), "a free field is not a gap");

  const engine = buildProfile(Array.from({ length: 6 }, (_, i) => ({ ...unlike, id: `e${i}` })));
  const gaps = compare(brand, engine);
  assertEquals(new Set(gaps.slice(0, 3).map((g) => g.key)), new Set(["people.framing", "camera.height", "finish.grain_overall"]));
  assert(!gaps.some((g) => g.key === "people.gaze" && g.distance > 0.5));
});

Deno.test("the taste score climbs with pictures, campaigns and proof, and says what would raise it", () => {
  const cards = (n: number) => Array.from({ length: n }, (_, i) => card(`c${i}`, { "people.framing": "full_body" }, {}, `k${i % 5}`));
  const thin = tasteScore(buildProfile(cards(4)));
  const fuller = tasteScore(buildProfile(cards(60)));
  const proven = tasteScore(buildProfile(cards(60)), { engineFit: 0.8, ownFit: 0.8 });
  assert(thin.score < fuller.score && fuller.score < proven.score);
  assertEquals(proven.parts.find((p) => p.key === "proof")!.points, 20);
  assert(thin.next.some((n) => n.startsWith("Add pictures")));
  assert(fuller.next.some((n) => n.startsWith("Test:")));
  assertEquals(thin.parts.reduce((s, p) => s + p.of, 0), 100);
});

Deno.test("pictures that were only measured say nothing of the read fields: they are not counted as covered", () => {
  const measuredOnly = Array.from({ length: 60 }, (_, i) => card(`m${i}`, {}, { "finish.grain_overall": 0.5 }, `k${i % 5}`));
  const read = Array.from({ length: 60 }, (_, i) => card(`r${i}`, { "people.framing": "full_body" }, { "finish.grain_overall": 0.5 }, `k${i % 5}`));
  const points = (cards: Card[]) => tasteScore(buildProfile(cards)).parts.find((p) => p.key === "coverage")!.points;
  // (The few points left are measured fields these test cards do not carry.)
  assert(points(measuredOnly) <= 5, String(points(measuredOnly)));
  // Read pictures that never answer a field (no people in any of them) do say the brand leaves it out.
  assert(points(read) > 15, String(points(read)));
});

Deno.test("the answer shape has no optional and no either-or parts, and asks only what the picture can answer", () => {
  for (const pass of PASSES) {
    const js = JSON.stringify(z.toJSONSchema(passShape(pass, passFields(pass))));
    assert(!js.includes("anyOf") && !js.includes('"null"'), pass);
    const top = z.toJSONSchema(passShape(pass, passFields(pass))) as { required?: string[]; properties: Record<string, unknown> };
    assertEquals(new Set(top.required), new Set(Object.keys(top.properties)));
  }
  assertEquals(passFields("people", NOTHING).map((f) => f.key), ["people.count"]);
  assert(passFields("people", { ...NOTHING, people: true }).length > 20);
  assert(!passFields("people", { ...NOTHING, people: true }).some((f) => f.when === "face" || f.when === "several_people"));
  assert(laterPasses(NOTHING).includes("look") && laterPasses(NOTHING).includes("craft"));
});

Deno.test("a pass's answer is kept by schema key; what the schema does not list, and what cannot be told, is null", () => {
  const fields = passFields("idea");
  const read = answersOf(fields, {
    kind: { type: "photograph", use: CANNOT_TELL, capture: "a made-up option" },
    concept: { emotion: ["joy", "joy", "not listed", "pride"], scene_words: [" Wet Track ", "", "floodlights"], one_line: [] },
    shows: { people: true, face: false, severalPeople: true, product: true, words: false, logo: false, outdoors: true },
  });
  assertEquals(read["kind.type"], "photograph");
  assertEquals([read["kind.use"], read["kind.capture"], read["concept.one_line"], read["mood.pace"]], [null, null, null, null]);
  assertEquals(read["concept.emotion"], ["joy", "pride"]);
  assertEquals(read["concept.scene_words"], ["wet track", "floodlights"]);
  assertEquals(Object.keys(read).length, fields.length);
  assertEquals(showsOf({ shows: { people: false, face: true, severalPeople: true, product: true } }), { ...NOTHING, product: true });
});

Deno.test("a model that answers in text gets the shape in the question, and its answer is read out of what it wrote", () => {
  const q = passPromptWithShape("idea", passFields("idea"));
  assert(q.includes('"photograph_with_graphics"') && q.includes('"shows"'));
  assertEquals(parseAnswer('```json\n{"kind":{"type":"photograph"}}\n```'), { kind: { type: "photograph" } });
  assertEquals(parseAnswer('The options are {a, b}; I choose a.\n{"kind":{"type":"photograph"}}'), { kind: { type: "photograph" } });
  assertEquals(parseAnswer("I cannot read this picture."), null);
  assertEquals(parseAnswer("[1, 2]"), null);
  assertEquals(parseAnswer('{"kind": {'), null);
});

// ─── Direction: the profile said to whoever makes the next picture ───────────

const brandCards = () =>
  Array.from({ length: 12 }, (_, i) =>
    card(`b${i}`, {
      "kind.type": "photograph",
      "camera.depth_of_field": "deep",
      "camera.height": "eye",
      "light.lamps_in_frame": "none",
      "setting.ground_shown": "not_shown",
      "styling.wardrobe": "sportswear",
      "people.framing": "full_body",
      "design.button": "none",
      "design.button_place": "none",
      "people.gaze": i % 2 ? "into_the_camera" : "down",
      "mood.temperature": i < 6 ? "cold" : "warm",
    }, { "finish.grain_overall": 0.4 + (i % 3) * 0.01 }, i < 6 ? "winter" : "summer"));

Deno.test("direction says what the brand keeps to in plain words, sets absences apart, and leaves out what is free", () => {
  const d = direction(buildProfile(brandCards()));
  const says = new Map(d.lines.map((l) => [l.key, l]));
  assertEquals(says.get("camera.depth_of_field")!.says, "Camera, depth of field: deep");
  assertEquals(says.get("styling.wardrobe")!.says, "Wardrobe: sportswear");
  assertEquals([says.get("light.lamps_in_frame")!.says, says.get("light.lamps_in_frame")!.absence], ["Light: no lamps in frame", true]);
  assertEquals(says.get("setting.ground_shown")!.says, "Setting: ground not shown");
  assert(!says.has("people.gaze"), "a free field gives no direction");
  assert(says.has("design.button") && !says.has("design.button_place"), "no button already says there is no place for one");
  assert(says.get("camera.depth_of_field")!.weight > says.get("light.lamps_in_frame")!.weight, "what the picture has weighs more than what it leaves out");
  assertEquals(d.choices.map((c) => [c.key, c.campaigns]), [["mood.temperature", { winter: "cold", summer: "warm" }]]);
  assertEquals(finishTargets(d).map((t) => t.key), ["finish.grain_overall"]);
  assert(!d.tested);
});

Deno.test("a prompt takes only what the photograph carries and the picture will show; the plan gets the campaign's choices", () => {
  const d = direction(buildProfile(brandCards()));
  const product = promptLines(d).map((l) => l.key);
  assert(product.includes("camera.depth_of_field") && !product.includes("people.framing") && !product.includes("design.button"));
  const withPeople = promptLines(d, { people: true });
  assertEquals(withPeople.find((l) => l.key === "people.framing")!.dimension, "people");
  assertEquals(withPeople.find((l) => l.key === "camera.height")!, { id: "schema-camera.height", dimension: "camera", statement: "Camera, height: eye.", key: "camera.height", weight: withPeople.find((l) => l.key === "camera.height")!.weight });
  assertEquals(promptLines(d, { people: true }, 16, 1).filter((l) => /: no | not shown/.test(l.statement)).length, 1);
  const brief = planBrief(d);
  assert(brief.includes("- Camera, depth of field: deep (always)") && brief.includes("Mood, temperature: winter: cold; summer: warm") && brief.includes("Design: no button"));
});

Deno.test("what the Engine missed last time is said first, with what it did instead; what it already does is said last", () => {
  const brand = buildProfile(brandCards());
  const engine = buildProfile(Array.from({ length: 6 }, (_, i) =>
    card(`e${i}`, { "kind.type": "photograph", "camera.depth_of_field": "shallow", "camera.height": "eye", "light.lamps_in_frame": "none", "setting.ground_shown": "half_or_more" }, { "finish.grain_overall": 3 })));
  const d = direction(brand, engine);
  assert(d.tested);
  const lines = promptLines(d);
  assertEquals(lines[0]!.key, "camera.depth_of_field");
  assert(lines[0]!.statement.endsWith("Earlier Engine pictures had shallow 100%."), lines[0]!.statement);
  const at = (k: string) => lines.findIndex((l) => l.key === k);
  assert(at("setting.ground_shown") < at("camera.height"), "a missed absence comes before a habit the Engine already keeps");
  assertEquals(finishTargets(d)[0]!.miss!.engine, 3);
  // A field the Engine's pictures could not answer is not taken as learned.
  assertEquals(d.lines.find((l) => l.key === "styling.wardrobe")!.weight, direction(brand).lines.find((l) => l.key === "styling.wardrobe")!.weight);
});

Deno.test("proof holds the Engine's pictures against the brand's photographs only, and waits until there are enough", () => {
  const photo = (id: string, depth: string) => card(id, { "kind.type": "photograph_with_graphics", "camera.depth_of_field": depth, "design.button": "solid_button" });
  const typeCard = (id: string) => card(id, { "kind.type": "graphics_only", "design.button": "none" });
  const brand = [...Array.from({ length: 8 }, (_, i) => photo(`p${i}`, "deep")), ...Array.from({ length: 5 }, (_, i) => typeCard(`t${i}`))];
  const good = proofOf(brand, [card("e1", { "kind.type": "photograph", "camera.depth_of_field": "deep" })])!;
  const bad = proofOf(brand, [card("e2", { "kind.type": "photograph", "camera.depth_of_field": "shallow" })])!;
  assertEquals([good.own, good.left, good.engine], [8, 5, 1]);
  assertEquals([good.engineFit, good.ownFit], [1, 1]);
  assert(bad.engineFit < 0.5, "the words set on the brand's pictures are not held against a picture without words");
  assertEquals(proofOf(brand.slice(0, 5), [card("e3", {})]), null);
  assert(tasteScore(buildProfile(brand), good).parts.find((p) => p.key === "proof")!.why.includes("8 photographs (5 other pictures left out)"));
});

/** A grey picture with the same noise in every pixel at any size (a fixed, seeded scatter). */
function noisy(width: number, height: number, spread: number): { width: number; height: number; data: Uint8ClampedArray } {
  const data = new Uint8ClampedArray(width * height * 4);
  let seed = 7;
  const next = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296 - 0.5) * 2 * spread;
  for (let i = 0; i < width * height; i++) {
    const v = 120 + next();
    data.set([v, v, v, 255], i * 4);
  }
  return { width, height, data };
}

Deno.test("grain is read at one viewing size: the same picture delivered three times as large measures the same, not finer", () => {
  const small = noisy(1024, VIEW, 30);
  // The same picture delivered larger: every pixel three times as wide and as high.
  const W = 1024 * 3, H = VIEW * 3;
  const large = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const from = (Math.floor(y / 3) * 1024 + Math.floor(x / 3)) * 4;
      large.data.set(small.data.subarray(from, from + 4), (y * W + x) * 4);
    }
  const a = measureCard(small).measured, b = measureCard(large).measured;
  assert(a["finish.grain_mids"]! > 1, "the noise is there to be read");
  assertEquals(b["finish.grain_mids"], a["finish.grain_mids"]);
  assertEquals(b["finish.sharpness_peak"], a["finish.sharpness_peak"]);
  assertEquals([b["format.megapixels"], a["format.megapixels"]], [14.16, 1.57]);
  const sized = resizeTo(large, VIEW);
  assertEquals([sized.width, sized.height], [1024, VIEW]);
  assertEquals(resizeTo(small, VIEW), small, "a picture is never made larger");
  // A size that does not divide evenly still lands on the long side asked for.
  const odd = resizeTo(noisy(2000, 1300, 10), 1536);
  assertEquals([odd.width, odd.height], [1536, 998]);
});

Deno.test("a picture too small to have a finish leaves grain and sharpness unmeasured, and a profile leaves them out", () => {
  const tiny = measureCard(noisy(360, 440, 30)).measured;
  assert(360 < SMALLEST);
  assertEquals([tiny["finish.grain_shadows"], tiny["finish.grain_mids"], tiny["finish.grain_chroma"], tiny["finish.sharpness_peak"]], [-1, -1, -1, -1]);
  assert(tiny["finish.black_point"]! > 0, "tone is still read");
  const cards = Array.from({ length: 6 }, (_, i) => card(`s${i}`, {}, tiny));
  assertEquals(buildProfile(cards).fields["finish.grain_mids"]!.n, 0);
});

Deno.test("a card of type alone has no finish of a photograph: its finish numbers are not counted, its other numbers are", () => {
  const photo = (id: string) => card(id, { "kind.type": "photograph" }, { "finish.black_point": 4, "composition.space": 0.3 });
  const type = (id: string) => card(id, { "kind.type": "graphics_only" }, { "finish.black_point": 0, "composition.space": 0.8 });
  const cards = [...Array.from({ length: 6 }, (_, i) => photo(`p${i}`)), ...Array.from({ length: 6 }, (_, i) => type(`t${i}`))];
  const profile = build(cards).profile;
  assertEquals([profile.fields["finish.black_point"]!.n, profile.fields["finish.black_point"]!.value], [6, 4]);
  // How much of the frame is empty is the layout's, not the finish step's: it is counted on every card.
  assertEquals([FIELD.get("finish.black_point")!.lever, FIELD.get("composition.space")!.lever], ["finish", "prompt"]);
  assertEquals(profile.fields["composition.space"]!.n, 12);
  // Cards nobody has read are counted as they are: nothing says which are photographs.
  const unread = Array.from({ length: 6 }, (_, i) => card(`u${i}`, {}, { "finish.black_point": 0 }));
  assertEquals(finishOfPhotographs(unread), unread);
});

Deno.test("a brand's kinds of picture are counted apart: a picture is held against its own kind, and takes its direction from it", () => {
  const product = { people: false, face: false, severalPeople: false, product: true, words: false, logo: false, outdoors: false };
  const people = { ...product, people: true, face: true, outdoors: true };
  // The brand: the product alone always inside and sharp front to back, people always outside with shallow focus; the
  // camera is low in both. Counted together, where and how sharp look free.
  const of = (id: string, inside: boolean, i: number, shows: Shows): Card => ({
    ...card(id, { "kind.type": "photograph", "setting.inside_outside": inside ? "inside" : "outside", "camera.depth_of_field": inside ? "deep" : "shallow", "camera.height": "low" }, {}, `k${i % 4}`),
    shows,
  });
  const brand: Card[] = [...Array.from({ length: 20 }, (_, i) => of(`p${i}`, true, i, product)), ...Array.from({ length: 20 }, (_, i) => of(`h${i}`, false, i, people))];
  assertEquals(buildProfile(brand).fields["camera.depth_of_field"]!.standing, "free");
  // The Engine made the product alone, outside, with shallow focus.
  const engine: Card[] = Array.from({ length: 4 }, (_, i) => of(`e${i}`, false, i, product));
  const built = build(brand, engine);
  // Against everything it would fit; against the brand's own product pictures it does not.
  assert(built.proof!.kinds!.product_alone!.engineFit < 0.7, JSON.stringify(built.proof));
  assert(built.proof!.kinds!.product_alone!.ownFit > 0.95);
  assert(built.proof!.engineFit < built.proof!.ownFit);
  // The floor is what the brand's other kind scores against this one; the Engine's pictures did no better, so no proof.
  assert(built.proof!.kinds!.product_alone!.floor! < 0.7);
  assert(built.score.parts.find((p) => p.key === "proof")!.points <= 2, JSON.stringify(built.score.parts));
  assert(built.score.parts.find((p) => p.key === "proof")!.why.includes("the brand's other pictures"));
  // The direction of the kind says what the whole cannot, and names what the Engine did instead.
  assert(!built.direction.lines.some((l) => l.key === "camera.depth_of_field"));
  const line = built.direction.kinds!.product_alone!.lines.find((l) => l.key === "camera.depth_of_field")!;
  assertEquals(line.says, "Camera, depth of field: deep");
  assert(line.miss!.engine.includes("shallow"));
  // A prompt for the product alone takes the kind's line; one with people takes the people's.
  assert(promptLines(built.direction, { product: true }).some((l) => l.statement.startsWith("Camera, depth of field: deep")));
  assert(promptLines(built.direction, { product: true, people: true }).some((l) => l.statement.startsWith("Camera, depth of field: shallow")));
  // The plan writer is told both, each under its kind, and not twice what holds for all.
  const brief = planBrief(built.direction);
  assert(brief.includes("WHEN THE PICTURE IS THE PRODUCT WITH NO PEOPLE") && brief.includes("WHEN THE PICTURE HAS PEOPLE IN IT"));
  assert(brief.includes("inside outside: inside") && brief.includes("inside outside: outside"));
  assertEquals(brief.split("height: low").length - 1, 1);
  // A small brand has no kinds: nothing changes for it.
  assertEquals(build(brand.slice(0, 8)).direction.kinds, undefined);
});

Deno.test("the brief decides the place: a picture the plan sets away from the brand's usual place leaves that place's habits out, and keeps the craft", () => {
  // The brand shows its product in a plain studio: pristine, dry, sharp front to back, lit with flash off the camera.
  const brand: Card[] = Array.from({ length: 12 }, (_, i) => card(`b${i}`, {
    "setting.type": "plain_studio", "setting.tidiness": "pristine", "setting.surface_state": "dry", "kind.capture": "studio_packshot",
    "camera.depth_of_field": "deep", "camera.flash": "off_camera", "composition.edges_of_frame": "clean",
  }, {}, `k${i % 4}`));
  const d = direction(buildProfile(brand));
  assertEquals(habitualPlace(d), "studio");
  assert(ofThePlace("setting.tidiness") && ofThePlace("kind.capture") && !ofThePlace("camera.depth_of_field"));
  const keys = (planned: Parameters<typeof promptLines>[1]) => promptLines(d, planned).map((l) => l.key);
  // The plan names no place, or the studio: every habit applies.
  for (const planned of [{}, { place: "studio" as const }]) {
    assertEquals(awayFromHabit(d, planned), false);
    assert(["setting.tidiness", "setting.surface_state", "kind.capture", "camera.depth_of_field"].every((k) => keys(planned).includes(k)));
  }
  // The brief asked for a wet street: the studio's habits say nothing true of it, the craft still holds.
  const street = keys({ place: "world", outdoors: true });
  assertEquals(awayFromHabit(d, { place: "world" }), true);
  assertEquals(street.filter(ofThePlace), []);
  assert(["camera.depth_of_field", "camera.flash", "composition.edges_of_frame"].every((k) => street.includes(k)));
  // A brand with no one kind of place has no habit of place to be away from.
  const mixed = direction(buildProfile(brand.map((c, i) => ({ ...c, read: { ...c.read, "setting.type": ["plain_studio", "city_street", "home", "wild_nature"][i % 4]! } }))));
  assertEquals([habitualPlace(mixed), awayFromHabit(mixed, { place: "world" })], [null, false]);
});
