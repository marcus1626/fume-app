import { assertEquals, assertMatch } from "jsr:@std/assert@1";
import { type Deps, type Detail, handleDetails, readDetails, readsRight, type Take } from "./handler.ts";

const take: Take = {
  candidate_id: "00000000-0000-0000-0000-0000000000c1",
  workspace_id: "ws",
  brand: { name: "Dressmann", language: "no" },
  picture: { bucket: "workspace-files", path: "ws/engine/j/p.png", width: 1856, height: 2304 },
  products: [{ name: "Lett flanellskjorte", variant: null, pictures: [{ bucket: "workspace-files", path: "ws/p/1.png" }] }],
  store: { bucket: "workspace-files", prefix: "ws/check/c1" },
};

function deps(over: Partial<Deps> = {}) {
  const calls = { steps: [] as Record<string, unknown>[], finish: [] as [Detail[], number][], read: [] as unknown[] };
  const d: Deps = {
    canRead: () => Promise.resolve(true),
    service: {
      take: () => Promise.resolve({ data: take, error: null }),
      finish: (_id, details, usd) => {
        calls.finish.push([details, usd]);
        return Promise.resolve({ error: null });
      },
      readLink: (_b, p) => Promise.resolve(`https://s/read/${p}`),
      uploadLink: (_b, p) => Promise.resolve(`https://s/up/${p}`),
    },
    step: (r) => {
      calls.steps.push(r);
      return Promise.resolve({ ok: true, status: 200, body: { rect: { x: 0, y: 0, w: 384, h: 384 }, ratio: "1:1", width: 1856, height: 2304 } });
    },
    find: () => Promise.resolve({ usd: 0.001, places: [
      { what: "the woven collar label", box: { x: 0.58, y: 0.24, w: 0.05, h: 0.02 }, photo: 1, photoBox: { x: 0.46, y: 0.18, w: 0.13, h: 0.05 } },
      { what: "a print on the hem", box: { x: 0.2, y: 0.8, w: 0.05, h: 0.03 }, photo: 0, photoBox: null },
    ] }),
    read: (r) => {
      calls.read.push(r);
      return Promise.resolve(r.refUrl
        ? { reads: "DRESSMEANN", expected: "Dressmann", ok: false, note: "The collar label reads DRESSMEANN; on the product it reads Dressmann.", usd: 0.0005 }
        : { reads: "XO", expected: "", ok: false, note: "Something", usd: 0.0005 });
    },
    refine: () => Promise.resolve({ box: { x: 0.4, y: 0.4, w: 0.2, h: 0.1 }, usd: 0.0001 }),
    later: () => {},
    ...over,
  };
  return { d, calls };
}

Deno.test("each place with print is cropped close on the picture and on the real product, and read against it", async () => {
  const { d, calls } = deps();
  const out = await readDetails(take, d);
  assertEquals(calls.steps.map((s) => [(s.upload as { crop: string }).crop, Boolean(s.read)]), [
    ["https://s/up/ws/check/c1-1.png", false], ["https://s/up/ws/check/c1-1.png", true],
    ["https://s/up/ws/check/c1-1-ref.png", false], ["https://s/up/ws/check/c1-1-ref.png", true],
    ["https://s/up/ws/check/c1-2.png", false], ["https://s/up/ws/check/c1-2.png", true],
  ], "a wider crop, where the part is found again, then a close one to read");
  assertEquals(calls.steps[2].picture, "https://s/read/ws/p/1.png", "the same part, cut from the product's own photograph");
  const close = calls.steps[1].box as { x: number; w: number };
  assertEquals(Math.round(close.x * 1856), Math.round(0.4 * 384 - 0.25 * 0.2 * 384), "the close box is where it was found again");
  assertEquals(out!.map((x) => x.ok), [false, true], "without the real one to read against, nothing is called wrong");
  assertMatch(out![0].note!, /reads DRESSMEANN; on the product it reads Dressmann/);
  assertEquals(out![1].note, undefined);
  assertEquals(Math.round(calls.finish[0][1] * 10_000) / 10_000, 0.0023, "what reading it cost is counted");
});

Deno.test("a picture with no product photographs is read as nothing, and a failure keeps what was read", async () => {
  const none = deps({ service: { ...deps().d.service, readLink: (_b, p) => Promise.resolve(p.includes("/p/") ? null : `https://s/read/${p}`) } });
  assertEquals(await readDetails(take, none.d), []);
  const broken = deps({ find: () => Promise.reject(new Error("down")) });
  assertEquals(await readDetails(take, broken.d), null);
  assertEquals(broken.calls.finish, [[[], 0]]);
});

Deno.test("only someone who sees the picture asks, and the answer comes at once", async () => {
  const post = (body: unknown, auth = true) =>
    new Request("http://x", { method: "POST", headers: auth ? { Authorization: "Bearer t" } : {}, body: JSON.stringify(body) });
  assertEquals((await handleDetails(post({ candidateId: take.candidate_id }, false), () => deps().d)).status, 403);
  assertEquals((await handleDetails(post({ candidateId: "x" }), () => deps().d)).status, 400);
  assertEquals((await handleDetails(post({ candidateId: take.candidate_id }), () => deps({ canRead: () => Promise.resolve(false) }).d)).status, 404);
  assertEquals((await handleDetails(post({ candidateId: take.candidate_id }), () => deps().d)).status, 202);
});

Deno.test("code compares the letters, so a model that contradicts itself does not decide", () => {
  assertEquals(readsRight({ reads: "DRESSMANN", expected: "Dressmann", ok: false, note: "doubled N" }), true);
  assertEquals(readsRight({ reads: "Dressmeann", expected: "Dressmann", ok: true, note: "" }), false);
  assertEquals(readsRight({ reads: "", expected: "Dressmann", ok: true, note: "" }), true, "unreadable: the model's word stands");
  assertEquals(readsRight({ reads: "Dress mann.", expected: "dressmann", ok: false, note: "" }), true);
});
