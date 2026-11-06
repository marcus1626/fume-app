// The product reader without Supabase or the model: deno test supabase/functions/product-truth/
import { assertEquals } from "jsr:@std/assert@1";
import { type Deps, handleTruth, type Read } from "./handler.ts";
import { judgeTruth, type PageText, type TruthAnswer, type TruthTask } from "./truth.ts";

const task: TruthTask = {
  run_id: "r1",
  product: { id: "11111111-1111-4111-8111-111111111111", name: "Etiopia Danche", variant: "250 g", sku: null, kind: null, specs: [] },
  brand: { name: "Nordlys Kaffe (test)", market: "Norway", language: "no" },
  pages: [{ source_id: "s-page", url: "https://kaffa.no/products/danche" }],
  pictures: [{ source_id: "s-pic1", url: "https://cdn.example/1.jpg" }, { source_id: "s-pic2", url: "https://cdn.example/2.jpg" }],
  facts: [{ area: "colour", label: "Bag colour", statement: "A white bag.", status: "verified" }],
};
const pages: PageText[] = [{ source_id: "s-page", url: "https://kaffa.no/products/danche", text: "Etiopia Danche\nBærtørket kaffe fra Gedeb.\nSmaksnotater: blåbærsyltetøy, kakao" }];
const usage = { model: "claude-haiku-5-5", input_tokens: 4000, output_tokens: 800, cost_usd: 0.0008 };
const fact = (x: Partial<TruthAnswer["facts"][number]>): TruthAnswer["facts"][number] => ({
  area: "shape", label: "Bag shape", statement: "A tall stand-up bag with a flat bottom.", from: "picture", picture: 1, quote: null, page: null, ...x,
});

Deno.test("a claim is kept only in the page's own words, a picture fact only from a picture Fume read", () => {
  const j = judgeTruth(task, pages, ["s-pic1", "s-pic2"], {
    facts: [
      fact({}),
      fact({ area: "claim", label: "Process", statement: "Naturally processed", from: "page", quote: "Bærtørket kaffe fra Gedeb.", page: 1 }),
      fact({ area: "claim", label: "Award", statement: "Award winning", from: "page", quote: "Vinner av Nordic Roaster", page: 1 }),
      fact({ area: "label", label: "Front", statement: "Danche printed large", picture: 5 }),
      fact({ area: "colour", label: "Bag", statement: "A  white bag." }),
    ],
    unclear: [],
  });
  assertEquals(j.keep.map((k) => `${k.area} ${k.statement} ${k.source_id} ${k.where}`), [
    "shape A tall stand-up bag with a flat bottom. s-pic1 Picture 1",
    "claim Bærtørket kaffe fra Gedeb. s-page Page: https://kaffa.no/products/danche",
  ]);
  assertEquals(j.dropped.map((d) => d.why), ["Its words are not on the page.", "It names no picture Fume read.", "The product already has it."]);
});

function fake(opts: { may?: { ok: boolean; reading?: boolean }; task?: TruthTask | null; read?: Read; pages?: PageText[] } = {}) {
  const calls: string[] = [];
  const work: Promise<unknown>[] = [];
  const deps = (): Deps => ({
    mayAsk: async () => opts.may ?? { ok: true },
    service: {
      take: async () => ({ data: opts.task === undefined ? task : opts.task, error: null }),
      finish: async (_id, facts, output, u) => {
        calls.push(`finish ${facts.length} dropped ${(output.dropped as unknown[]).length} ${u.cost_usd}`);
        return { data: { added: facts.length }, error: null };
      },
      fail: async (_id, error) => {
        calls.push(`fail ${error}`);
        return { error: null };
      },
    },
    pages: async () => opts.pages ?? pages,
    read: async () => opts.read ?? { ok: true, answer: { facts: [fact({})], unclear: [] }, usage, pictureIds: ["s-pic1"] },
    later: (p) => work.push(p),
  });
  return { calls, deps, done: () => Promise.all(work) };
}
const post = (body: unknown, auth = "Bearer t") =>
  new Request("https://x.test/functions/v1/product-truth", { method: "POST", headers: auth ? { Authorization: auth } : {}, body: JSON.stringify(body) });

Deno.test("answers at once and reads the product in the background", async () => {
  const f = fake();
  const res = await handleTruth(post({ productId: task.product.id }), f.deps);
  assertEquals(res.status, 202);
  await f.done();
  assertEquals(f.calls, ["finish 1 dropped 0 0.0008"]);
});

Deno.test("nobody signed in, a bad id, someone off the brand, a reading under way", async () => {
  assertEquals((await handleTruth(post({ productId: task.product.id }, ""), fake().deps)).status, 403);
  assertEquals((await handleTruth(post({ productId: "x" }), fake().deps)).status, 400);
  assertEquals((await handleTruth(post({ productId: task.product.id }), fake({ may: { ok: false } }).deps)).status, 404);
  const r = await handleTruth(post({ productId: task.product.id }), fake({ may: { ok: true, reading: true } }).deps);
  assertEquals([r.status, await r.json()], [200, { reading: true }]);
});

Deno.test("no page that opens and no pictures: nothing to read, said plainly", async () => {
  const f = fake({ pages: [], task: { ...task, pictures: [] } });
  await handleTruth(post({ productId: task.product.id }), f.deps);
  await f.done();
  assertEquals(f.calls, ["fail The product has no page that opens and no pictures."]);
});

Deno.test("a model that fails fails the run with why", async () => {
  const f = fake({ read: { ok: false, error: "The reading was cut off.", usage } });
  await handleTruth(post({ productId: task.product.id }), f.deps);
  await f.done();
  assertEquals(f.calls, ["fail The reading was cut off."]);
});
