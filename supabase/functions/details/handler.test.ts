import { assertEquals, assertMatch } from "jsr:@std/assert@1";
import { type Deps, type Detail, handleDetails, photoLink, readDetails, readsRight, type Take } from "./handler.ts";

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
      keep: () => Promise.resolve(false),
      setParts: () => Promise.resolve({ error: null }),
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
    map: () => Promise.resolve({ parts: [], model: "m", usd: 0 }),
    locate: () => Promise.resolve({ parts: [], usd: 0 }),
    compare: () => Promise.resolve({ shows: "", whole: true, count: null, same: true, note: "", usd: 0 }),
    later: () => {},
    ...over,
  };
  return { d, calls };
}

Deno.test("each place with print is cropped close on the picture and on the real product, and read against it", async () => {
  const { d, calls } = deps();
  const out = await readDetails(take, d);
  // The places are read at once, so their steps interleave; each place's own steps keep their order.
  const crop = (s: Record<string, unknown>) => (s.upload as { crop: string }).crop;
  const of = (path: string) => calls.steps.filter((s) => crop(s) === `https://s/up/ws/check/${path}`);
  assertEquals(calls.steps.length, 6);
  for (const path of ["c1-1.png", "c1-1-ref.png", "c1-2.png"]) {
    assertEquals(of(path).map((s) => Boolean(s.read)), [false, true], "a wider crop, where the part is found again, then a close one to read");
  }
  assertEquals(of("c1-1-ref.png")[0].picture, "https://s/read/ws/p/1.png", "the same part, cut from the product's own photograph");
  const close = of("c1-1.png")[1].box as { x: number; w: number };
  assertEquals(Math.round(close.x * 1856), Math.round(0.4 * 384 - 0.25 * 0.2 * 384), "the close box is where it was found again");
  assertEquals(Math.round(out![0].box.x * 1856), Math.round(0.4 * 384), "and that place is kept, without the room");
  assertEquals(out!.map((x) => x.ok), [false, true], "without the real one to read against, nothing is called wrong");
  assertMatch(out![0].note!, /reads DRESSMEANN; on the product it reads Dressmann/);
  assertEquals(out![1].note, undefined);
  assertEquals(Math.round(calls.finish[0][1] * 10_000) / 10_000, 0.0028, "what reading it cost is counted");
});

Deno.test("a read that finds the letters right is read once more, and a mismatch stands", async () => {
  let n = 0;
  const { d } = deps({ find: () => Promise.resolve({ usd: 0, places: [
    { what: "label", box: { x: 0.58, y: 0.24, w: 0.05, h: 0.02 }, photo: 1, photoBox: { x: 0.46, y: 0.18, w: 0.13, h: 0.05 } },
  ] }), read: () => Promise.resolve(++n === 1
    ? { reads: "Dressmann", expected: "Dressmann", ok: true, note: "", usd: 0 }
    : { reads: "Dressmeann", expected: "Dressmann", ok: false, note: "", usd: 0 }) });
  const out = await readDetails(take, d);
  assertEquals([n, out![0].ok, out![0].note], [3, false, "The label reads Dressmeann; on the product it reads Dressmann."],
    "the two reads disagree, and a third agrees with the mismatch");
});

Deno.test("a misread of the real photograph is outvoted, and a word the product shows elsewhere is no fault", async () => {
  let n = 0;
  const { d } = deps({ find: () => Promise.resolve({ usd: 0, places: [
    { what: "icon words", box: { x: 0.58, y: 0.74, w: 0.1, h: 0.02 }, photo: 1, photoBox: { x: 0.46, y: 0.7, w: 0.13, h: 0.05 } },
    { what: "wordmark", box: { x: 0.5, y: 0.5, w: 0.1, h: 0.04 }, photo: 1, photoBox: { x: 0.46, y: 0.4, w: 0.13, h: 0.05 } },
    { what: "name", box: { x: 0.5, y: 0.56, w: 0.1, h: 0.04 }, photo: 1, photoBox: { x: 0.46, y: 0.46, w: 0.13, h: 0.05 } },
  ] }), read: ({ what }) => Promise.resolve(what === "icon words"
    ? (++n === 1 ? { reads: "HJERNE HJERTE", expected: "HUERNE HUERTE", ok: false, note: "x", usd: 0 } : { reads: "HJERNE HJERTE", expected: "HJERNE HJERTE", ok: true, note: "", usd: 0 })
    : what === "wordmark" ? { reads: "MÖLLER'S Tran", expected: "MÖLLER'S", ok: false, note: "x", usd: 0 }
    : { reads: "Tran", expected: "Tran", ok: true, note: "", usd: 0 }) });
  const out = await readDetails(take, d);
  assertEquals(out!.map((x) => [x.what, x.ok, x.note]), [["icon words", true, undefined], ["wordmark", true, undefined], ["name", true, undefined]]);
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
  assertEquals(readsRight({ reads: "", expected: "Dressmann", ok: false, note: "" }), true, "nothing legible is not compared");
  assertEquals(readsRight({ reads: "AIR JORDAN", expected: "AIR", ok: false, note: "" }), true, "a crop with part of the print");
  assertEquals(readsRight({ reads: "AIR JORDANE", expected: "AIR JORDAN", ok: false, note: "" }), false, "a garbled word is still wrong");
  assertEquals(readsRight({ reads: "Dress mann.", expected: "dressmann", ok: false, note: "" }), true);
  assertEquals(readsRight({ reads: "HJEBNE IMHUNEOSEVAN HJEDTE", expected: "HJERNE¹ IMMUNFORSVAR² HJERTE³", ok: false, note: "" }), false,
    "small words under icons, garbled");
  assertEquals(readsRight({ reads: "HJERNE IMMUNFORSVAR HJERTE", expected: "HJERNE¹ IMMUNFORSVAR² HJERTE³", ok: false, note: "" }), true,
    "a footnote mark read on one side only");
  assertEquals(readsRight({ reads: "PETER MØLLER GRUNNLAGT 1864", expected: "PETER MØLLER GRUNNLAGT 1854", ok: true, note: "" }), false, "a wrong year");
  assertEquals(readsRight({ reads: "Omega-3", expected: "Omega-3 Vitamin D+A+E", ok: false, note: "" }), true, "the picture's crop shows fewer words");
  assertEquals(readsRight({ reads: "Omega-3 Vitamin D+A+E XQ", expected: "Omega-3 Vitamin D+A+E", ok: true, note: "" }), false, "an extra word");
});

Deno.test("a packshot kept only as a link is fetched into storage once, then read from there", async () => {
  const kept = new Set<string>();
  const asked: string[] = [];
  const { d } = deps({ service: { ...deps().d.service,
    readLink: (_b, p) => Promise.resolve(p.includes("/p/") || kept.has(p) ? `https://s/read/${p}` : null),
    keep: (url, _b, p) => {
      asked.push(url);
      kept.add(p);
      return Promise.resolve(true);
    } } });
  const pic = { bucket: "workspace-files", path: "ws/check/source-s1.img", url: "https://brand.example/shoe.png" };
  assertEquals(await photoLink(d, pic), "https://s/read/ws/check/source-s1.img");
  assertEquals(await photoLink(d, pic), "https://s/read/ws/check/source-s1.img");
  assertEquals(asked, ["https://brand.example/shoe.png"], "fetched once");
  assertEquals(await photoLink(d, { bucket: "workspace-files", path: "ws/x.png" }), null, "a missing file with no link is nothing");
});
