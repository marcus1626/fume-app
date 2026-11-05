import { assertEquals, assertMatch } from "jsr:@std/assert@1";
import { type Deps, fixPicture, handleFix, promptOf, type Take } from "./handler.ts";

const take: Take = {
  fix_id: "00000000-0000-0000-0000-0000000000f1",
  workspace_id: "ws",
  box: { x: 0.5, y: 0.25, w: 0.08, h: 0.04 },
  ask: "The label reads Dresemann; it says Dressmann.",
  brand: { name: "Dressmann", language: "no" },
  picture: { bucket: "workspace-files", path: "ws/engine/j/p.png", width: 1856, height: 2304 },
  products: [{ name: "Lett flanellskjorte", variant: "Melert blå", pictures: [
    { bucket: "workspace-files", path: "ws/p/1.png" }, { bucket: "workspace-files", path: "ws/p/2.png" },
  ] }],
  store: { bucket: "workspace-files", png: "ws/fix/f1.png", crop: "ws/fix/f1-crop.png" },
};

function deps(over: Partial<Deps> = {}) {
  const calls = { steps: [] as Record<string, unknown>[], submitted: [] as unknown[], stored: [] as string[], finish: [] as Record<string, unknown>[], fail: [] as [string, number][] };
  const d: Deps = {
    canRead: () => Promise.resolve(true),
    service: {
      take: () => Promise.resolve({ data: take, error: null }),
      finish: (_id, r) => {
        calls.finish.push(r);
        return Promise.resolve({ error: null });
      },
      fail: (_id, why, cents) => {
        calls.fail.push([why, cents]);
        return Promise.resolve({ error: null });
      },
      readLink: (_b, p) => Promise.resolve(`https://s/read/${p}`),
      uploadLink: (_b, p) => Promise.resolve(`https://s/up/${p}`),
      store: (_b, p) => {
        calls.stored.push(p);
        return Promise.resolve(true);
      },
    },
    step: (r) => {
      calls.steps.push(r);
      return Promise.resolve(r.op === "fix-crop"
        ? { ok: true, status: 200, body: { rect: { x: 800, y: 400, w: 480, h: 480 }, ratio: "1:1" } }
        : { ok: true, status: 200, body: { width: 1856, height: 2304, drift: 3.2, png: { bytes: 9000, sha256: "ab" } } });
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

Deno.test("the crop goes to the image model with the product's own photographs, and is set back as a candidate", async () => {
  const { d, calls } = deps();
  assertEquals(await fixPicture(take, d), "made");
  assertEquals(calls.steps.map((s) => s.op), ["fix-crop", "fix-set"]);
  const sent = calls.submitted[0] as { referenceUrls: string[]; aspectRatio: string; imageModel: string; text: string };
  assertEquals(sent.referenceUrls, ["https://s/read/ws/fix/f1-crop.png", "https://s/read/ws/p/1.png", "https://s/read/ws/p/2.png"], "the crop first, then the product");
  assertEquals([sent.aspectRatio, sent.imageModel], ["1:1", "nano-banana-pro"]);
  assertMatch(sent.text, /Dresemann; it says Dressmann/);
  assertEquals(calls.stored, ["ws/fix/f1-redrawn.png"], "the model's picture is kept in Fume's storage before the service reads it");
  const set = calls.steps[1] as { redrawn: string; rect: unknown; upload: { png: string } };
  assertEquals([set.redrawn, set.upload.png], ["https://s/read/ws/fix/f1-redrawn.png", "https://s/up/ws/fix/f1.png"]);
  assertEquals(set.rect, { x: 800, y: 400, w: 480, h: 480 });
  assertEquals(calls.finish[0].cost_cents, 15);
  assertEquals((calls.finish[0].png as { path: string }).path, "ws/fix/f1.png");
});

Deno.test("the prompt names the product, says what is wrong, and keeps everything else as it is", () => {
  const text = promptOf(take, 2);
  assertMatch(text, /Image 1 is a close crop of a product photograph made for Dressmann, showing Lett flanellskjorte \(Melert blå\)/);
  assertMatch(text, /Images 2 to 3 are the product's own photographs/);
  assertMatch(text, /Keep everything else in image 1 exactly as it is/);
  assertMatch(promptOf({ ...take, products: [] }, 0), /correctly spelled/);
});

Deno.test("a fix that fails says why, and counts the picture once the model was asked", async () => {
  const before = deps({ step: () => Promise.resolve({ ok: false, status: 400, body: { error: "Mark the part to fix inside the picture." } }) });
  assertEquals(await fixPicture(take, before.d), "failed");
  assertEquals(before.calls.fail, [["Mark the part to fix inside the picture.", 0]]);
  const after = deps({ image: { priceCents: () => 15, submit: () => Promise.resolve({ ok: true, providerJobId: "x" }),
    collect: () => Promise.resolve({ state: "failed", error: "The image model refused the picture as unsafe.", final: false, response: null }) } });
  assertEquals(await fixPicture(take, after.d), "failed");
  assertEquals(after.calls.fail, [["The image model refused the picture as unsafe.", 15]]);
});

Deno.test("only someone who sees the fix starts it, and the answer comes at once", async () => {
  const post = (body: unknown, auth = true) =>
    new Request("http://x", { method: "POST", headers: auth ? { Authorization: "Bearer t" } : {}, body: JSON.stringify(body) });
  assertEquals((await handleFix(post({ fixId: take.fix_id }, false), () => deps().d)).status, 403);
  assertEquals((await handleFix(post({ fixId: "nope" }), () => deps().d)).status, 400);
  assertEquals((await handleFix(post({ fixId: take.fix_id }), () => deps({ canRead: () => Promise.resolve(false) }).d)).status, 404);
  assertEquals((await handleFix(post({ fixId: take.fix_id }), () => deps().d)).status, 202);
});
