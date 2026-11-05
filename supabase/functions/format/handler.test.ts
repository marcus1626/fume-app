import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
import { type Deps, handleFormat, makeFormat, promptOf, type Take, whyOf } from "./handler.ts";

const take: Take = {
  make_id: "00000000-0000-0000-0000-0000000000a1",
  workspace_id: "ws",
  asked: null,
  window: null,
  format: "story",
  brand: { name: "Dressmann" },
  picture: { bucket: "workspace-files", path: "ws/engine/j/p.png", width: 1856, height: 2304 },
  store: { bucket: "workspace-files", prefix: "ws/format/a1" },
};

function deps(method: "crop" | "expand", over: Partial<Deps> = {}, t: Take = take) {
  const calls = { steps: [] as Record<string, unknown>[], submitted: [] as { referenceUrls: string[]; aspectRatio: string }[], stored: [] as string[], finish: [] as Record<string, unknown>[], fail: [] as [string, number, number][], located: 0 };
  const d: Deps = {
    canRead: () => Promise.resolve(true),
    service: {
      take: () => Promise.resolve({ data: t, error: null }),
      finish: (_id, r) => {
        calls.finish.push(r);
        return Promise.resolve({ data: { candidate_id: "c-new" }, error: null });
      },
      fail: (_id, why, cents, usd) => {
        calls.fail.push([why, cents, usd]);
        return Promise.resolve({ error: null });
      },
      readLink: (_b, p) => Promise.resolve(`https://s/read/${p}`),
      uploadLink: (_b, p) => Promise.resolve(`https://s/up/${p}`),
      store: (_b, p) => {
        calls.stored.push(p);
        return Promise.resolve(true);
      },
    },
    locate: () => {
      calls.located++;
      return Promise.resolve({ box: { x: 0.3, y: 0.2, w: 0.4, h: 0.6 }, what: "the shirt", usd: 0.001 });
    },
    step: (r) => {
      calls.steps.push(r);
      if (r.op === "format-set") return Promise.resolve({ ok: true, status: 200, body: { width: 1856, height: 3300, at: { x: 0, y: 498, w: 1856, h: 2304 }, drift: 2, png: { bytes: 9000, sha256: "cd" } } });
      return Promise.resolve(method === "crop"
        ? { ok: true, status: 200, body: { method, reason: "fits", window: { x: 0.15, y: 0, w: 0.7, h: 1 }, width: 1296, height: 2304, png: { bytes: 8000, sha256: "ab" } } }
        : { ok: true, status: 200, body: { method, reason: "cuts", ratio: "9:16", width: 1856, height: 3300, at: { x: 0, y: 498, w: 1856, h: 2304 }, padded: { bytes: 1, sha256: "x" } } });
    },
    image: {
      priceCents: () => 15,
      submit: (r) => {
        calls.submitted.push(r);
        return Promise.resolve({ ok: true, providerJobId: "fal-1" });
      },
      collect: () => Promise.resolve({ state: "done", urls: ["https://fal.media/x.png"], response: {} }),
    },
    download: () => Promise.resolve(new Uint8Array([1, 2, 3])),
    wait: () => Promise.resolve(),
    later: () => {},
    now: () => 0,
    ...over,
  };
  return { d, calls };
}

Deno.test("a crop is made from the master's own pixels: no image model, no cost but finding the product", async () => {
  const { d, calls } = deps("crop");
  assertEquals(await makeFormat(take, d), "made");
  assertEquals(calls.located, 1);
  assertEquals(calls.steps[0].around, { x: 0.3, y: 0.2, w: 0.4, h: 0.6 });
  assertEquals(calls.submitted.length, 0);
  const f = calls.finish[0];
  assertEquals([f.method, f.cost_cents, f.llm_usd, f.width], ["crop", 0, 0.001, 1296]);
  assertEquals((f.png as { path: string }).path, "ws/format/a1.png");
  assertMatch(String(f.why), /The shirt fits the story with air around it/);
});

Deno.test("an expansion sends only the padded master, in the new shape, and sets the master back", async () => {
  const { d, calls } = deps("expand");
  assertEquals(await makeFormat(take, d), "made");
  assertEquals(calls.submitted[0].referenceUrls, ["https://s/read/ws/format/a1-padded.png"]);
  assertEquals(calls.submitted[0].aspectRatio, "9:16");
  assertEquals(calls.stored, ["ws/format/a1-drawn.png"]);
  assertEquals(calls.steps[1].op, "format-set");
  assertEquals(calls.steps[1].drawn, "https://s/read/ws/format/a1-drawn.png");
  const f = calls.finish[0];
  assertEquals([f.method, f.cost_cents, f.height], ["expand", 15, 3300]);
  assertMatch(String(f.why), /would cut the shirt, so the scene is extended above and below/);
});

Deno.test("what the designer chose is not asked of the language model", async () => {
  const t = { ...take, asked: "crop" as const, window: { x: 0, y: 0, w: 0.7, h: 1 } };
  const { d, calls } = deps("crop", {}, t);
  assertEquals(await makeFormat(t, d), "made");
  assertEquals(calls.located, 0);
  assertEquals([calls.steps[0].method, calls.steps[0].window], ["crop", t.window]);
});

Deno.test("a failure says why and keeps what was spent", async () => {
  const { d, calls } = deps("expand", { image: { priceCents: () => 15, submit: () => Promise.resolve({ ok: true, providerJobId: "f" }), collect: () => Promise.resolve({ state: "failed", error: "fal was down", final: true, response: {} }) } });
  assertEquals(await makeFormat(take, d), "failed");
  assertEquals(calls.fail[0], ["fal was down", 15, 0.001]);
});

Deno.test("the prompt draws only the new edges and adds nothing", () => {
  const p = promptOf(take);
  assertMatch(p, /grey areas/);
  assertMatch(p, /Leave the photograph itself exactly as it is/);
  assertMatch(p, /no people/);
  assertMatch(whyOf("expand", "safe", "story", "the shirt"), /platform covers the top and bottom, and a crop would put the shirt there/);
  assert(whyOf("expand", "unknown", "square", "").startsWith("Fume could not tell where the product is"));
  assertMatch(whyOf("expand", "little", "banner", "", { x: 1120, y: 0, w: 1856, h: 2304 }), /extended at the sides/);
});

Deno.test("the request names a make the caller may read", async () => {
  const { d } = deps("crop", { canRead: () => Promise.resolve(false) });
  const res = await handleFormat(new Request("https://x", { method: "POST", headers: { Authorization: "Bearer t" }, body: JSON.stringify({ makeId: take.make_id }) }), () => d);
  assertEquals(res.status, 404);
  const ok = deps("crop");
  const started = await handleFormat(new Request("https://x", { method: "POST", headers: { Authorization: "Bearer t" }, body: JSON.stringify({ makeId: take.make_id }) }), () => ok.d);
  assertEquals(started.status, 202);
  const bad = await handleFormat(new Request("https://x", { method: "POST", headers: { Authorization: "Bearer t" }, body: "{}" }), () => ok.d);
  assertEquals(bad.status, 400);
});

Deno.test("an expansion uses the model named for the task", async () => {
  const { d: base, calls } = deps("expand");
  const d = { ...base, service: { ...base.service, model: () => Promise.resolve("nano-banana-2") } };
  assertEquals(await makeFormat(take, d), "made");
  assertEquals((calls.submitted[0] as unknown as { imageModel: string }).imageModel, "nano-banana-2");
  assertEquals(calls.finish[0].model, "nano-banana-2");
});
