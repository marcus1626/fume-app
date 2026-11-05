import { assertEquals } from "jsr:@std/assert@1";
import { type Deps, designLayer, handleDesign } from "./handler.ts";
import { keepClearOf, layoutsOf, type Take, wordsOf } from "./layer.ts";

const take: Take = {
  layer_id: "00000000-0000-0000-0000-0000000000aa",
  workspace_id: "ws",
  ask: null,
  brand: { name: "Nike (test)", language: "nb", market: "NO" },
  picture: { bucket: "workspace-files", path: "ws/engine/p.png", width: 1856, height: 2304 },
  creative: { id: "cr", title: "Master 1", format: "feed", slot: "pc1" },
  planned: { scene: "Text top left, the shoe lower middle." },
  copy: [
    { key: "headline", label: "Headline", value: "IKON FOR  BYEN OM NATTEN." },
    { key: "supporting_line", label: "Supporting line", value: "Høy krage." },
    { key: "call_to_action", label: "Call to action", value: "Kjøp" },
  ],
  products: [],
  book: { id: "b", version: 1, state: "approved", body: { styles: [], colours: [], typefaces: [] } },
  store: { bucket: "workspace-files", png: "ws/design/aa.png", fig: "ws/design/aa.fig" },
};

function deps(over: Partial<Deps> = {}) {
  const calls: Record<string, unknown[]> = { finish: [], fail: [], lay: [] };
  const d: Deps = {
    canRead: () => Promise.resolve(true),
    service: {
      take: () => Promise.resolve({ data: take, error: null }),
      finish: (_id, r) => (calls.finish.push(r), Promise.resolve({ error: null })),
      fail: (_id, why) => (calls.fail.push(why), Promise.resolve({ error: null })),
      links: () => Promise.resolve({ picture: "https://s/sign/p?token=1", png: "https://s/upload/sign/a?token=2", fig: "https://s/upload/sign/b?token=3" }),
      read: () => Promise.resolve(new Uint8Array([1])),
      picture: () => Promise.resolve(new Uint8Array([1])),
    },
    choose: (_t, _w, _p, spent) => {
      spent.usd += 0.001;
      return Promise.resolve({ keepClear: [{ what: "the shoe", x: 0.2, y: 0.5, w: 0.7, h: 0.3 }], band: "top", align: "left", colour: "on_photo", layout: "", why: "calm sky" });
    },
    review: (_t, _w, _p, spent) => {
      spent.usd += 0.001;
      return Promise.resolve({ findings: [{ severity: "minor", what: "Headline sits close to the lamp." }], verdict: "ready_for_check" });
    },
    lay: (r) => (calls.lay.push(r), Promise.resolve({ ok: true, status: 200, body: { ok: true, width: 1080, height: 1350, layout: { band: "top" }, checks: [], attempts: [], png: { bytes: 9, sha256: "a" }, fig: { bytes: 8, sha256: "b" } } })),
    later: () => {},
    now: () => 0,
    ...over,
  };
  return { d, calls };
}

Deno.test("the words are the plan's approved copy, word for word, and nothing else", () => {
  assertEquals(wordsOf(take), { headline: "IKON FOR BYEN OM NATTEN.", subline: "Høy krage.", cta: "Kjøp" });
  assertEquals(wordsOf({ ...take, copy: [{ key: "call_to_action", value: "Kjøp" }] }), null);
});

Deno.test("what must stay clear becomes boxes in the format's pixels, with a margin, cut to the frame", () => {
  const boxes = keepClearOf({ keepClear: [{ what: "shoe", x: 0.5, y: 0.5, w: 0.9, h: 0.2 }, { what: "speck", x: 0, y: 0, w: 0.001, h: 0.5 }], band: "top", align: "left", colour: "text", layout: "", why: "" }, "feed");
  // About 26 px of breathing room on every side, cut to the frame on the right.
  assertEquals(boxes, [{ what: "shoe", x: 514, y: 649, w: 566, h: 322 }]);
});

Deno.test("a layer is laid out from the plan's words and the model's eye, reviewed, and kept with its cost", async () => {
  const { d, calls } = deps();
  assertEquals(await designLayer(take, d), "made");
  const sent = calls.lay[0] as Record<string, unknown>;
  assertEquals(sent.words, { headline: "IKON FOR BYEN OM NATTEN.", subline: "Høy krage.", cta: "Kjøp" });
  assertEquals(sent.prefer, { band: "top", align: "left", colour: "on_photo" });
  assertEquals((sent.keepClear as unknown[]).length, 1);
  const r = calls.finish[0] as Record<string, unknown>;
  assertEquals((r.png as { path: string }).path, "ws/design/aa.png");
  assertEquals(r.llm_usd, 0.002);
  assertEquals((r.findings as { by: string }[])[0].by, "fume_review");
});

Deno.test("without the model's eye the service still lays it out; a failed service fails the layer with why", async () => {
  const blind = deps({ choose: () => Promise.reject(new Error("down")), review: () => Promise.resolve(null) });
  assertEquals(await designLayer(take, blind.d), "made");
  assertEquals((blind.calls.lay[0] as Record<string, unknown>).keepClear, []);
  const broken = deps({ lay: () => Promise.resolve({ ok: false, status: 400, body: { error: "Unknown format." } }) });
  assertEquals(await designLayer(take, broken.d), "failed");
  assertEquals(broken.calls.fail, ["The design service answered 400: Unknown format."]);
});

Deno.test("the brand's own layout the model picked goes to the service by name; a made-up one does not", async () => {
  const branded = { ...take, book: { ...take.book, body: { ...take.book.body, onPictures: { layouts: [{ name: "Big stack", band: "bottom", align: "left", ground: "photo", words: "light", cta: "text" }] } } } };
  const pick = (layout: string) => deps({ choose: () => Promise.resolve({ keepClear: [], band: "bottom", align: "left", colour: "on_photo", layout, why: "" }) });
  const a = pick("Big stack");
  await designLayer(branded, a.d);
  assertEquals((a.calls.lay[0] as { prefer: { signature?: string } }).prefer.signature, "Big stack");
  const b = pick("Something else");
  await designLayer(branded, b.d);
  assertEquals((b.calls.lay[0] as { prefer: { signature?: string } }).prefer.signature, undefined);
});

Deno.test("where the Engine left room for the words comes before the model's eye", async () => {
  const roomy = { ...take, room: "Compose the frame so the product sits whole in the top 68% of the frame's height; the bottom 32% of the height is bare." };
  const a = deps();
  await designLayer(roomy, a.d);
  assertEquals((a.calls.lay[0] as { prefer: { band?: string } }).prefer.band, "bottom");
  const side = deps();
  await designLayer({ ...take, room: "the left 40% of the width, from top to bottom, is bare" }, side.d);
  assertEquals((side.calls.lay[0] as { prefer: unknown }).prefer, { band: "top", align: "left", colour: "on_photo" });
  const none = deps({ choose: () => Promise.reject(new Error("down")) });
  await designLayer(roomy, none.d);
  assertEquals((none.calls.lay[0] as { prefer: unknown }).prefer, { band: "bottom" }, "without the model's eye, the room still leads");
});

Deno.test("a slow service is tried once more; a refusal is not", async () => {
  let n = 0;
  const slow = deps({ lay: (r) => (n++ === 0 ? Promise.resolve({ ok: false, status: 504, body: { error: "slow" } }) : deps().d.lay(r)) });
  assertEquals(await designLayer(take, slow.d), "made");
  assertEquals(n, 2);
  let m = 0;
  const refused = deps({ lay: () => (m++, Promise.resolve({ ok: false, status: 400, body: { error: "Unknown format." } })) });
  assertEquals(await designLayer(take, refused.d), "failed");
  assertEquals(m, 1);
});

Deno.test("the function asks who is calling, and answers at once while the work goes on", async () => {
  const post = (body: unknown, auth = "Bearer x") =>
    new Request("https://f/design", { method: "POST", headers: { Authorization: auth }, body: JSON.stringify(body) });
  const id = take.layer_id;
  assertEquals((await handleDesign(new Request("https://f/design", { method: "POST", body: "{}" }), () => deps().d)).status, 403);
  assertEquals((await handleDesign(post({ layerId: "x" }), () => deps().d)).status, 400);
  assertEquals((await handleDesign(post({ layerId: id }), () => deps({ canRead: () => Promise.resolve(false) }).d)).status, 404);
  let later = 0;
  assertEquals((await handleDesign(post({ layerId: id }), () => deps({ later: () => void later++ }).d)).status, 202);
  assertEquals(later, 1);
});

Deno.test("the brand's logo goes to the service when its design system names one, and a layer without one is still made", async () => {
  const withLogo = deps({
    service: {
      ...deps().d.service,
      links: () => Promise.resolve({ picture: "https://s/sign/p?token=1", png: "https://s/upload/sign/a?token=2", fig: "https://s/upload/sign/b?token=3", logo: "https://s/sign/l?token=4" }),
    },
  });
  assertEquals(await designLayer(take, withLogo.d), "made");
  assertEquals((withLogo.calls.lay[0] as { logo?: string }).logo, "https://s/sign/l?token=4");
  const without = deps();
  assertEquals(await designLayer(take, without.d), "made");
  assertEquals("logo" in (without.calls.lay[0] as object), false);
});

Deno.test("a brand layout with no words is never offered for the plan's words", () => {
  const t = { ...take, book: { ...take.book, body: { ...take.book.body, onPictures: { layouts: [
    { name: "Clean product photo, no words", band: "top", align: "left", ground: "photo", words: "dark", cta: "none", why: "" },
    { name: "Swoosh alone", hasWords: false, band: "middle", align: "center", ground: "flat", words: "light", cta: "none", why: "" },
    { name: "Big stack", band: "bottom", align: "left", ground: "photo", words: "light", cta: "pill", why: "" },
  ] } } } } as typeof take;
  assertEquals(layoutsOf(t).map((l) => l.name), ["Big stack"]);
});

Deno.test("where the brand's layout carries no button, the review is told the call to action is left off on purpose", async () => {
  const { reviewPrompt } = await import("./layer.ts");
  const words = { headline: "IKON", cta: "Kjøp" };
  const off = reviewPrompt({} as Take, words, { cta: "none" });
  assertEquals(off.includes("Kjøp"), false);
  assertEquals(off.includes("left off on purpose"), true);
  assertEquals(reviewPrompt({} as Take, words, { cta: "with_words" }).includes("Kjøp"), true);
});

Deno.test("the brand's layouts from its own ads are offered before its shop's", () => {
  const t = { book: { body: { onPictures: { layouts: [
    { name: "Quote stack bottom left", band: "bottom", align: "left", source: "pictures" },
    { name: "Hero centred with pills", band: "middle", align: "center", source: "site" },
  ] } } } } as unknown as Take;
  assertEquals(layoutsOf(t).map((l) => l.name), ["Quote stack bottom left"]);
  const shopOnly = { book: { body: { onPictures: { layouts: [{ name: "Hero centred with pills", band: "middle", align: "center", source: "site" }] } } } } as unknown as Take;
  assertEquals(layoutsOf(shopOnly).length, 1);
});
