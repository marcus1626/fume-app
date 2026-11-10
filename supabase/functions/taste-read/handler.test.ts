// The reading handler without Supabase or the model: deno test supabase/functions/taste-read/
import { assert, assertEquals } from "jsr:@std/assert@1";
import { type Asked, type Deps, handleTasteRead, type Reading, type Usage } from "./handler.ts";
import type { Pass } from "../_shared/taste/schema.ts";

const WS = "26681c6c-4558-4359-847d-da160006bc56";
const usage = (cost: number): Usage => ({ model: "m", input_tokens: 1000, output_tokens: 100, cost_usd: cost });
const post = (body: unknown) => new Request("https://x/", { method: "POST", body: JSON.stringify(body) });
const picture = { base64: "A".repeat(200), mediaType: "image/jpeg" };

function deps(over: Partial<Deps> = {}) {
  const asked: Pass[] = [];
  const kept: Parameters<Deps["keep"]>[0][] = [];
  const saved: Reading[] = [];
  const d: Deps = {
    save: (_ws, reading) => (saved.push(reading), Promise.resolve({ score: 41, pictures: saved.length, enginePictures: 0 })),
    staff: () => Promise.resolve(true),
    withinBudget: () => Promise.resolve(true),
    ask: (pass): Promise<Asked> => {
      asked.push(pass);
      if (pass === "idea")
        return Promise.resolve({ ok: true, usage: usage(0.01), out: {
          kind: { type: "photograph" },
          shows: { people: true, face: false, severalPeople: false, product: true, words: false, logo: false, outdoors: true },
        } });
      if (pass === "craft") return Promise.reject(new Error("timed out"));
      const out: Record<string, Record<string, unknown>> = pass === "people" ? { people: { count: "one", framing: "full_body", mouth: "closed" } } : {};
      return Promise.resolve({ ok: true, usage: usage(0.01), out });
    },
    keep: (r) => (kept.push(r), Promise.resolve()),
    ...over,
  };
  return { d, asked, kept, saved };
}

Deno.test("only a signed-in member of Fume's staff on the brand may read, and only within the week's budget", async () => {
  const { d, asked } = deps();
  assertEquals((await handleTasteRead(post({ workspaceId: WS, picture }), false, d)).status, 403);
  assertEquals((await handleTasteRead(post({ workspaceId: WS, picture }), true, { ...d, staff: () => Promise.resolve(false) })).status, 403);
  assertEquals((await handleTasteRead(post({ workspaceId: WS, picture }), true, { ...d, withinBudget: () => Promise.resolve(false) })).status, 429);
  assertEquals((await handleTasteRead(post({ workspaceId: "nike", picture }), true, d)).status, 400);
  assertEquals((await handleTasteRead(post({ workspaceId: WS, picture: { url: "http://10.0.0.1/a.jpg" } }), true, d)).status, 400);
  assertEquals((await handleTasteRead(post({ workspaceId: WS, picture, reader: "gpt" }), true, d)).status, 400);
  assertEquals(asked, []);
});

Deno.test("idea is asked first, then the passes the picture can answer; a pass that fails is named and the rest is kept", async () => {
  const { d, asked, kept } = deps();
  const res = await handleTasteRead(post({ workspaceId: WS, picture, reader: "sonnet" }), true, d);
  const out = await res.json();
  assertEquals(res.status, 200);
  assertEquals(asked[0], "idea");
  assertEquals(new Set(asked.slice(1)), new Set(["people", "subject", "craft", "look", "design"]));
  assertEquals(out.shows.people, true);
  assertEquals([out.read["kind.type"], out.read["people.framing"]], ["photograph", "full_body"]);
  // No face was shown, so the mouth was never asked and is not on the card.
  assert(!("people.mouth" in out.read));
  assertEquals(out.failed, [{ pass: "craft", error: "timed out" }]);
  assertEquals(out.usage.cost_usd, 0.05);
  assertEquals(kept.length, 1);
  assertEquals([kept[0]!.workspaceId, kept[0]!.usage.cost_usd, kept[0]!.error], [WS, 0.05, null]);
  assert(!JSON.stringify(kept[0]!.input).includes("AAAA"), "the picture itself is not kept in the run");
});

Deno.test("when idea fails nothing else is asked, the cost is still kept, and the caller is told", async () => {
  const asked2: Pass[] = [];
  const { d, asked, kept } = deps({ ask: (pass) => (asked2.push(pass), Promise.resolve({ ok: false, error: "The model declined.", usage: usage(0.02) })) });
  const res = await handleTasteRead(post({ workspaceId: WS, picture }), true, d);
  assertEquals(res.status, 502);
  assertEquals([asked, asked2], [[], ["idea"]]);
  assertEquals([kept[0]!.usage.cost_usd, kept[0]!.error], [0.02, "The model declined."]);
});

Deno.test("the budget is asked again before the larger half", async () => {
  let calls = 0;
  const { d, asked } = deps({ withinBudget: () => Promise.resolve(++calls === 1) });
  const out = await (await handleTasteRead(post({ workspaceId: WS, picture }), true, d)).json();
  assertEquals(asked, ["idea"]);
  assertEquals(out.failed.length, 5);
});

Deno.test("with keep the reading becomes the picture's card and the profile is counted again; without it nothing is kept", async () => {
  const { d, saved } = deps();
  await handleTasteRead(post({ workspaceId: WS, picture, reader: "gpt-terra" }), true, d);
  assertEquals(saved, []);
  const res = await handleTasteRead(post({
    workspaceId: WS, picture, reader: "gpt-terra",
    keep: { source: "brand", ref: " ad-1.jpg ", campaign: "why-do-it", measured: { "finish.grain_overall": 0.4, "not.a.field": 1, "camera.height": 2 } },
  }), true, d);
  const out = await res.json();
  assertEquals([out.kept, out.score, out.pictures], [true, 41, 1]);
  const r = saved[0]!;
  assertEquals([r.source, r.ref, r.campaign, r.reader, r.schema_version], ["brand", "ad-1.jpg", "why-do-it", "gpt-terra", 1]);
  assertEquals(r.measured, { "finish.grain_overall": 0.4 });
  assertEquals([r.read!["kind.type"], r.read!["people.framing"], r.shows!.people], ["photograph", "full_body", true]);
  assertEquals(r.failed!.map((f) => f.pass), ["craft"]);
  assert(r.cost_usd! > 0);
  // Half the questions are not a card.
  await handleTasteRead(post({ workspaceId: WS, picture, passes: ["people"], keep: { source: "brand", ref: "ad-2.jpg" } }), true, d);
  assertEquals(saved.length, 1);
  assertEquals((await handleTasteRead(post({ workspaceId: WS, picture, keep: { source: "web", ref: "x" } }), true, d)).status, 400);
  // The tables are not there yet: the reading still comes back, and says it was not kept.
  const lost = await (await handleTasteRead(post({ workspaceId: WS, picture, keep: { source: "engine", ref: "e-1" } }), true,
    { ...d, save: () => Promise.resolve({ error: "no such function" }) })).json();
  assertEquals([lost.kept, lost.keepError, lost.read["kind.type"]], [false, "no such function", "photograph"]);
});

Deno.test("a reading made before is kept as it is: no model is asked, and only what the schema lists goes in", async () => {
  const { d, asked, saved, kept } = deps();
  const card = { reader: "gpt-terra", cost_usd: 0.0156, shows: { people: true, product: "yes" },
    read: { "kind.type": "photograph", "camera.height": "from a drone", "concept.emotion": ["joy", "made up"], "concept.scene_words": [" Wet Track "], "x.y": "z" } };
  const res = await handleTasteRead(post({ workspaceId: WS, keep: { source: "engine", ref: "e-1", fileId: WS }, card }), true, d);
  assertEquals(res.status, 200);
  assertEquals([asked, kept], [[], []]);
  const r = saved[0]!;
  assertEquals(r.read, { "kind.type": "photograph", "camera.height": null, "concept.emotion": ["joy"], "concept.scene_words": ["wet track"] });
  assertEquals([r.source, r.file_id, r.reader, r.cost_usd, r.shows!.people, r.shows!.product], ["engine", WS, "gpt-terra", 0.0156, true, false]);
  assertEquals((await handleTasteRead(post({ workspaceId: WS, keep: { source: "engine", ref: "e-1" }, card }), true, { ...d, staff: () => Promise.resolve(false) })).status, 403);
  assertEquals((await handleTasteRead(post({ workspaceId: WS, keep: { source: "engine", ref: "e-2" }, card: { read: { "x.y": "z" } } }), true, d)).status, 400);
  assertEquals((await handleTasteRead(post({ workspaceId: WS, keep: { source: "engine", ref: "e-1" }, card }), true, { ...d, save: () => Promise.resolve({ error: "down" }) })).status, 502);
});
