import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
import type { Deps, Take } from "./handler.ts";
import { checkParts, colourOff, colourWord, keepMap, type Part, roomy } from "./parts.ts";

const shirt: Take = {
  candidate_id: "00000000-0000-0000-0000-0000000000c1",
  workspace_id: "ws",
  brand: { name: "Dressmann", language: "no" },
  picture: { bucket: "workspace-files", path: "ws/engine/j/p.png", width: 1856, height: 2304 },
  products: [{
    id: "p1", name: "Lett flanellskjorte", variant: null,
    pictures: [{ bucket: "workspace-files", path: "ws/p/front.png", file_id: "f1" }, { bucket: "workspace-files", path: "ws/p/detail.png", file_id: "f2" }],
    parts: null,
  }],
  store: { bucket: "workspace-files", prefix: "ws/check/c1" },
};

const MAP = [
  { key: "Buttons", kind: "count" as const, what: "front buttons", count: 7, looks: "seven white buttons", photo: 1, box: { x: 0.45, y: 0.2, w: 0.1, h: 0.6 } },
  { key: "chest pocket", kind: "present" as const, what: "chest pocket", count: null, looks: "one pocket, no flap", photo: 1, box: { x: 0.55, y: 0.3, w: 0.15, h: 0.15 } },
  { key: "pattern", kind: "look" as const, what: "check pattern", count: null, looks: "blue and grey checks", photo: 2, box: { x: 0.3, y: 0.5, w: 0.2, h: 0.2 } },
  { key: "cuffs", kind: "present" as const, what: "cuffs", count: null, looks: "buttoned cuffs", photo: 1, box: { x: 0.1, y: 0.8, w: 0.1, h: 0.1 } },
];

function deps(over: Partial<Deps> = {}, tones: Record<string, unknown> = {}) {
  const calls = { set: [] as unknown[], compare: [] as unknown[], locate: 0, steps: [] as Record<string, unknown>[] };
  const d = {
    canRead: () => Promise.resolve(true),
    service: {
      take: () => Promise.resolve({ data: shirt, error: null }),
      finish: () => Promise.resolve({ error: null }),
      readLink: (_b: string, p: string) => Promise.resolve(`https://s/read/${p}`),
      uploadLink: (_b: string, p: string) => Promise.resolve(`https://s/up/${p}`),
      setParts: (...a: unknown[]) => {
        calls.set.push(a);
        return Promise.resolve({ error: null });
      },
    },
    step: (r: Record<string, unknown>) => {
      calls.steps.push(r);
      const tone = tones[r.picture as string] ?? { l: 50, a: -5, b: -30 };
      return Promise.resolve({ ok: true, status: 200, body: { rect: { x: 0, y: 0, w: 384, h: 384 }, width: 1856, height: 2304, tone } });
    },
    find: () => Promise.resolve({ places: [], usd: 0 }),
    read: () => Promise.resolve({ reads: "", expected: "", ok: true, note: "", usd: 0 }),
    refine: () => Promise.resolve({ box: null, usd: 0 }),
    map: () => Promise.resolve({ parts: MAP, model: "claude-sonnet-5-5", usd: 0.02 }),
    locate: () => {
      calls.locate += 1;
      return Promise.resolve({ usd: 0.001, parts: [
        { key: "p1:buttons", shown: "yes" as const, box: { x: 0.45, y: 0.25, w: 0.1, h: 0.5 } },
        { key: "p1:chest-pocket", shown: "missing" as const, box: { x: 0.55, y: 0.3, w: 0.15, h: 0.15 } },
        { key: "p1:pattern", shown: "yes" as const, box: { x: 0.3, y: 0.5, w: 0.2, h: 0.2 } },
        { key: "p1:cuffs", shown: "hidden" as const, box: null },
      ] });
    },
    compare: (r: { part: { what: string } }) => {
      calls.compare.push(r);
      return Promise.resolve(r.part.what === "front buttons"
        ? { shows: "five white buttons", whole: true, count: 5, same: false, note: "", usd: 0.0005 }
        : { shows: "blue and grey checks", whole: true, count: null, same: true, note: "", usd: 0.0005 });
    },
    later: () => {},
    ...over,
  } as Deps;
  return { d, calls };
}

Deno.test("the parts are mapped once from the product's photographs, and kept by file id", async () => {
  const { d, calls } = deps();
  await checkParts(shirt, d, "https://s/read/pic.png");
  assertEquals(calls.set.length, 1);
  const [id, parts, photos, model, usd] = calls.set[0] as [string, Part[], string[], string, number];
  assertEquals([id, photos, model, usd], ["p1", ["f1", "f2"], "claude-sonnet-5-5", 0.02]);
  assertEquals(parts.map((p) => [p.key, p.photo, p.count]), [["buttons", "f1", 7], ["chest-pocket", "f1", null], ["pattern", "f2", null], ["cuffs", "f1", null]]);
  const again = deps();
  await checkParts({ ...shirt, products: [{ ...shirt.products[0], parts }] }, again.d, "https://s/read/pic.png");
  assertEquals(again.calls.set.length, 0, "a product with a map for these photographs is not mapped again");
});

Deno.test("code decides: a different count and a part missing twice are wrong, a hidden part is no fault", async () => {
  const { d, calls } = deps();
  const { details, usd } = await checkParts(shirt, d, "https://s/read/pic.png");
  assertEquals(calls.locate, 2, "a missing part is looked for once more");
  assertEquals(details.map((x) => [x.part, x.ok]), [["buttons", false], ["chest-pocket", false], ["pattern", true]]);
  assertEquals(details[0].note, "The picture shows 5 front buttons; the product has 7.");
  assertMatch(details[1].note!, /chest pocket is missing/);
  assertEquals(details.every((x) => x.kind === "part"), true);
  assertEquals(calls.compare.length, 3, "a difference is asked twice before it stands; a match once");
  assertEquals(Math.round(usd * 10_000) / 10_000, 0.0035, "the map's cost is kept on the map, not on the picture");
  const photoCrop = calls.steps.find((s) => (s.upload as { crop: string }).crop.endsWith("-11-ref.png"))!;
  assertEquals(photoCrop.picture, "https://s/read/ws/p/front.png", "the buttons are cut from the photograph that shows them");
});

Deno.test("a part found once missing and once there is not called missing; a second look that matches clears it", async () => {
  let n = 0, c = 0;
  const { d } = deps({
    locate: () => Promise.resolve({ usd: 0, parts: [{ key: "p1:chest-pocket", shown: ++n === 1 ? "missing" as const : "yes" as const, box: { x: 0.5, y: 0.3, w: 0.1, h: 0.1 } }] }),
    compare: () => Promise.resolve(++c === 1
      ? { shows: "a pocket with a flap", whole: true, count: null, same: false, note: "The pocket has a flap.", usd: 0 }
      : { shows: "a pocket", whole: true, count: null, same: true, note: "", usd: 0 }),
  });
  const { details } = await checkParts(shirt, d, "https://s/read/pic.png");
  assertEquals(details.map((x) => [x.part, x.ok]), [["chest-pocket", true]]);
});

Deno.test("a colour far from the product's is wrong, measured by code; the light of a scene is not", async () => {
  const { d } = deps({}, { "https://s/read/pic.png": { l: 50, a: -40, b: 30 } });
  const { details } = await checkParts(shirt, d, "https://s/read/pic.png");
  const pattern = details.find((x) => x.part === "pattern")!;
  assertEquals(pattern.ok, false);
  assertMatch(pattern.note!, /is green on the picture; on the product it is blue/);
  assert(!colourOff({ l: 60, a: 0, b: -28 }, { l: 45, a: -6, b: -34 }), "a lighter, warmer blue is still blue");
  assert(colourOff({ l: 60, a: 2, b: 3 }, { l: 45, a: -6, b: -44 }), "a blue part drawn grey");
  assertEquals([colourWord({ l: 90, a: 1, b: 1 }), colourWord({ l: 30, a: 10, b: -40 })], ["white", "dark blue"]);
});

Deno.test("the map is cleaned: unique keys, counts only where they count, a box kept inside the picture", () => {
  const kept = keepMap([
    { key: "Front Buttons!", kind: "count", what: "buttons", count: 7, looks: "x", photo: 3, box: { x: -0.1, y: 0.2, w: 0.3, h: 2 } },
    { key: "front buttons", kind: "count", what: "again", count: 7, looks: "x", photo: 1, box: null },
    { key: "zip", kind: "present", what: "zip", count: 2, looks: "x", photo: 1, box: null },
  ], ["f1"]);
  assertEquals(kept.map((p) => [p.key, p.count, p.photo]), [["front-buttons", 7, null], ["zip", null, "f1"]]);
  assertEquals(kept[0].box, { x: 0, y: 0.2, w: 0.3, h: 1 });
  assertEquals(roomy({ x: 0, y: 0, w: 1, h: 1 }), { x: 0, y: 0, w: 1, h: 1 }, "a part can be the whole product");
});
