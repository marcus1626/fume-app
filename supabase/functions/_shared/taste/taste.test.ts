// The taste schema, its profile and its questions, without pictures or a model: deno test supabase/functions/_shared/taste/
import { assert, assertEquals } from "jsr:@std/assert@1";
import { z } from "npm:zod@4.6.7";
import { buildProfile, type Card, compare, fit, lowerBound, tasteScore } from "./profile.ts";
import { answersOf, CANNOT_TELL, laterPasses, passFields, passShape, showsOf } from "./read.ts";
import { FIELD, FIELDS, GROUPS, measuredFields, PASSES, readFields, type Shows } from "./schema.ts";
import { measureCard } from "./card.ts";

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
