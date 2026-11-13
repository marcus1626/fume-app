import { assertEquals } from "jsr:@std/assert@1";
import { type Deps, designLayer, handleDesign, placed } from "./handler.ts";
import { keepClearOf, layoutsOf, roomOf, type Take, wordsOf } from "./layer.ts";

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

Deno.test("a plan written with Norwegian labels gives the same words", () => {
  const copy = [
    { key: "overskrift", label: "Overskrift", value: "All tranen, ingen skje" },
    { key: "st_ttelinje", label: "Støttelinje", value: "Kilde til omega-3." },
    { key: "handlingsoppfordring", label: "Handlingsoppfordring", value: "Les mer" },
  ];
  assertEquals(wordsOf({ ...take, copy }), { headline: "All tranen, ingen skje", subline: "Kilde til omega-3.", cta: "Les mer" });
});

Deno.test("the former price goes on the price line, where the design sets it under the price", () => {
  const copy = [
    { key: "headline", label: "Headline", value: "HELG PÅ HYTTA" },
    { key: "former_price", label: "Former price", value: "TIDLIGERE 399,-" },
    { key: "price", label: "Price", value: "NÅ 199,-" },
  ];
  assertEquals(wordsOf({ ...take, copy })!.price, "NÅ 199,- TIDLIGERE 399,-", "the former price is never taken for the price");
  assertEquals(wordsOf({ ...take, copy: [copy[0], copy[2], { key: "former_price", label: "Former price", value: "399,-" }] })!.price,
    "NÅ 199,- Tidligere 399,-", "a bare figure is marked as the former price");
  assertEquals(wordsOf({ ...take, copy: [copy[0], { key: "former_price", label: "Former price", value: "399,-" }] })!.price, undefined,
    "a former price without a price is not set");
});

Deno.test("a call to action the plan wrote as none is not set", () => {
  const copy = [{ key: "headline", value: "Home Court Starts Here" }, { key: "cta", label: "Call to action", value: "None on the picture" }];
  assertEquals(wordsOf({ ...take, copy })!.cta, undefined);
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

Deno.test("a failed look is tried once more, and a design made blind says so", async () => {
  let looked = 0;
  const once = deps({ choose: () => (looked++ ? Promise.resolve({ keepClear: [{ what: "hoop", x: 0.5, y: 0, w: 0.4, h: 0.8 }], people: [], band: "bottom", align: "left", colour: "on_photo", layout: "", why: "" }) : Promise.reject(new Error("timeout"))) });
  await designLayer(take, once.d);
  assertEquals(looked, 2);
  assertEquals((once.calls.lay[0] as { keepClear: unknown[] }).keepClear.length, 1);
  assertEquals((once.calls.finish[0] as { findings: { by: string }[] }).findings.some((f) => f.by === "code"), false);
  const never = deps({ choose: () => Promise.reject(new Error("down")), review: () => Promise.resolve(null) });
  await designLayer(take, never.d);
  const r = never.calls.finish[0] as { findings: { what: string; severity: string }[]; choice: { blind?: string } };
  assertEquals(r.findings[0].severity, "major");
  assertEquals(r.findings[0].what.includes("nothing in it was kept clear"), true);
  assertEquals(r.choice.blind, "down");
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

Deno.test("a designer's ask and a kept layout take precedence over the Engine's room", async () => {
  const roomy = { ...take, room: "the bottom 40% of the height, edge to edge, has no person, product or object in it" };
  const asked = deps();
  await designLayer({ ...roomy, ask: "Put the words at the top" }, asked.d);
  assertEquals((asked.calls.lay[0] as { prefer: { band?: string } }).prefer.band, "top", "the band choose answered wins");
  const kept = deps({ before: () => Promise.resolve({ keepClear: [], people: [], band: "middle", align: "left", colour: "on_photo", layout: "", why: "before" }) });
  await designLayer(roomy, kept.d);
  assertEquals((kept.calls.lay[0] as { prefer: { band?: string } }).prefer.band, "middle", "the earlier layout keeps its band");
  const fresh = deps();
  await designLayer(roomy, fresh.d);
  assertEquals((fresh.calls.lay[0] as { prefer: { band?: string } }).prefer.band, "bottom", "without an ask or a kept layout, the room leads");
});

Deno.test("the room is read from the rule as the Engine writes it today", async () => {
  const { roomRules } = await import("../_shared/engine/context.ts");
  const layout = (band: "top" | "middle" | "bottom", align: "left" | "right") => ({ name: "L", band, align, wordsWidthPct: 40, ground: "photo" });
  const rule = (band: "top" | "middle" | "bottom", align: "left" | "right") =>
    roomRules({
      products: [{ id: "p", name: "Shoe" }], creative: { id: "c1", title: "Master 1" },
      plan: { planned_creatives: [{ creative_id: "c1", kind: "master", title: "Master 1", text: "WORDS", scene: "A shoe on a kerb.", layout: "L" }] },
      room: { id: "db", version: 1, layouts: [layout(band, align)] },
    } as never)[0].statement;
  assertEquals(roomOf({ ...take, room: rule("bottom", "left") }), { band: "bottom" });
  assertEquals(roomOf({ ...take, room: rule("top", "left") }), { band: "top" });
  assertEquals(roomOf({ ...take, room: rule("middle", "right") }), { align: "right" });
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

Deno.test("a fixed picture keeps the layout its earlier design chose; a designer's ask gets a fresh look", async () => {
  const branded = { ...take, book: { ...take.book, body: { ...take.book.body, onPictures: { layouts: [{ name: "Green stack", band: "middle", align: "left", ground: "photo", words: "brand_colour", cta: "box" }] } } } };
  const earlier = { keepClear: [], people: [], band: "middle" as const, align: "left" as const, colour: "accent" as const, layout: "Green stack", why: "before" };
  let looked = 0;
  const a = deps({ before: () => Promise.resolve(earlier), choose: () => (looked++, Promise.resolve(null)) });
  await designLayer(branded, a.d);
  assertEquals(looked, 0, "the model is not asked again");
  assertEquals((a.calls.lay[0] as { prefer: unknown }).prefer, { band: "middle", align: "left", colour: "accent", signature: "Green stack" });
  assertEquals((a.calls.finish[0] as { choice: { kept?: boolean } }).choice.kept, true);
  const asked = deps({ before: () => Promise.resolve(earlier), choose: () => (looked++, Promise.resolve(null)) });
  await designLayer({ ...branded, ask: "Words on the right" }, asked.d);
  assertEquals(looked, 2, "asked afresh, and once more when the first look gave nothing");
  const none = deps({ before: () => Promise.resolve(null) });
  await designLayer(branded, none.d);
  assertEquals((none.calls.lay[0] as { prefer: { band?: string } }).prefer.band, "top", "a first design looks afresh");
});

Deno.test("a choice from before people were marked whole is not kept", async () => {
  const branded = { ...take, book: { ...take.book, body: { ...take.book.body, onPictures: { layouts: [{ name: "Green stack", band: "middle", align: "left", ground: "photo", words: "brand_colour", cta: "box" }] } } } };
  const faceOnly = { keepClear: [{ what: "the player's face", x: 0.2, y: 0.33, w: 0.1, h: 0.1 }], band: "middle" as const, align: "left" as const, colour: "accent" as const, layout: "Green stack", why: "before" };
  let looked = 0;
  const a = deps({ before: () => Promise.resolve(faceOnly), choose: () => (looked++, Promise.resolve(null)) });
  await designLayer(branded, a.d);
  assertEquals(looked >= 1, true, "the model looks again and marks the whole figure");
});

Deno.test("each person's whole figure is kept clear with the product", () => {
  const boxes = keepClearOf({ keepClear: [{ what: "hoop", x: 0.5, y: 0, w: 0.4, h: 0.8 }], people: [{ x: 0.1, y: 0.2, w: 0.2, h: 0.7 }], band: "top", align: "left", colour: "text", layout: "", why: "" }, "feed");
  assertEquals(boxes.map((b) => b.what), ["hoop", "a person"]);
  assertEquals(boxes[1].h > 0.7 * 1350, true, "head to feet, not the face");
});

Deno.test("a layout from a design book the brand has since replaced is not kept", async () => {
  const branded = { ...take, book: { ...take.book, body: { ...take.book.body, onPictures: { layouts: [{ name: "Navy block", band: "bottom", align: "left", ground: "colour_block", words: "light", cta: "outline" }] } } } };
  const earlier = { keepClear: [], band: "middle" as const, align: "left" as const, colour: "accent" as const, layout: "Single line, button right", why: "before" };
  let looked = 0;
  const a = deps({ before: () => Promise.resolve(earlier), choose: () => (looked++, Promise.resolve(null)) });
  await designLayer(branded, a.d);
  assertEquals(looked >= 1, true, "the model looks again");
  assertEquals((a.calls.finish[0] as { choice: { kept?: boolean } | null }).choice?.kept ?? false, false);
});

Deno.test("the words go in the layout the plan chose, where the Engine left room for them", async () => {
  const two = [
    { name: "Green stack", band: "middle", align: "left", ground: "photo", words: "brand_colour", cta: "box" },
    { name: "Top line", band: "top", align: "left", ground: "photo", words: "dark", cta: "box" },
  ];
  const branded = { ...take, planned: { ...take.planned, layout: "Top line" }, book: { ...take.book, body: { ...take.book.body, onPictures: { layouts: two } } } };
  const eye = { keepClear: [], band: "bottom" as const, align: "right" as const, colour: "text" as const, layout: "Green stack", why: "calm" };
  const a = deps({ before: () => Promise.resolve(null), choose: () => Promise.resolve(eye) });
  await designLayer(branded, a.d);
  const prefer = (a.calls.lay[0] as { prefer: Record<string, unknown> }).prefer;
  assertEquals([prefer.band, prefer.align, prefer.signature, prefer.colour], ["top", "left", "Top line", "text"]);
  assertEquals((a.calls.finish[0] as { choice: { planned?: boolean } }).choice.planned, true);
  const blind = deps({ before: () => Promise.resolve(null), choose: () => Promise.resolve(null) });
  await designLayer(branded, blind.d);
  assertEquals((blind.calls.lay[0] as { prefer: Record<string, unknown> }).prefer.signature, "Top line", "without the model's eye too");
  const gone = deps({ before: () => Promise.resolve(null), choose: () => Promise.resolve(eye) });
  await designLayer({ ...branded, planned: { ...take.planned, layout: "Not in the book" } }, gone.d);
  assertEquals((gone.calls.lay[0] as { prefer: Record<string, unknown> }).prefer.signature, "Green stack", "a layout the book lost gives way to the eye");
});

Deno.test("a design Fume's own review sends back is laid out once more, and the better of the two is kept", async () => {
  const settled: unknown[] = [];
  const looks: unknown[] = [];
  let reviews = 0;
  const bad = { findings: [{ severity: "critical" as const, what: "The headline breaks mid-word over bright sand." }], verdict: "needs_work" as const, onBrand: { score: 2, like: [], unlike: [] }, craft: 1 };
  const good = { findings: [{ severity: "minor" as const, what: "Logo a touch small." }], verdict: "ready_for_check" as const, onBrand: { score: 4, like: [], unlike: [] }, craft: 4 };
  const two = deps({
    choose: (_t, _w, _p, _s, earlier) => (looks.push(earlier ?? null), Promise.resolve({ keepClear: [], band: earlier ? "top" : "middle", align: "left", colour: "on_photo", layout: "", why: "" })),
    review: () => Promise.resolve(reviews++ ? good : bad),
  });
  two.d.service.settle = (_t, alt, keep) => (settled.push({ alt, keep }), Promise.resolve());
  two.d.service.links = (_t, alt) => Promise.resolve({ picture: "p", png: alt ? "alt-png" : "png", fig: alt ? "alt-fig" : "fig" });
  two.d.lay = (r) => (two.calls.lay.push(r), Promise.resolve({ ok: true, status: 200, body: { ok: false, layout: { band: (r as { prefer: { band: string } }).prefer.band, align: "left" }, checks: [], attempts: [], png: { bytes: 1, sha256: "a" }, fig: { bytes: 1, sha256: "b" } } }));
  assertEquals(await designLayer(take, two.d), "made");
  assertEquals(two.calls.lay.length, 2);
  assertEquals((two.calls.lay[1] as { upload: { png: string } }).upload.png, "alt-png");
  assertEquals((looks[1] as { faults: string[]; band: string }).faults, ["The headline breaks mid-word over bright sand."]);
  assertEquals((looks[1] as { band: string }).band, "middle");
  assertEquals(settled, [{ alt: { png: "ws/design/aa-2.png", fig: "ws/design/aa-2.fig" }, keep: true }]);
  const r = two.calls.finish[0] as { choice: { verdict: string; band: string; second: { won: boolean } }; png: { path: string } };
  assertEquals(r.choice.verdict, "ready_for_check");
  assertEquals(r.choice.band, "top");
  assertEquals(r.choice.second.won, true);
  assertEquals(r.png.path, "ws/design/aa.png", "the kept design takes the first one's place");

  // A second try that is no better is removed, and the first is kept.
  const settled2: unknown[] = [];
  const worse = deps({ review: () => Promise.resolve(bad) });
  worse.d.service.settle = (_t, _alt, keep) => (settled2.push(keep), Promise.resolve());
  await designLayer(take, worse.d);
  assertEquals(worse.calls.lay.length, 2);
  assertEquals(settled2, [false]);
  assertEquals((worse.calls.finish[0] as { choice: { second: { won: boolean } } }).choice.second.won, false);

  // No second round for a design that passed the review, or once the function is short of time.
  const fine = deps();
  fine.d.service.settle = () => Promise.resolve();
  await designLayer(take, fine.d);
  assertEquals(fine.calls.lay.length, 1);
  let clock = 0;
  const late = deps({ review: () => Promise.resolve(bad), now: () => (clock += 60_000) });
  late.d.service.settle = () => Promise.resolve();
  await designLayer(take, late.d);
  assertEquals(late.calls.lay.length, 1);
});

Deno.test("the layout keeps where each part sits, as shares of the frame, and the logo placed", () => {
  const out = { width: 1000, height: 2000, boxes: { Headline: { x: 100, y: 500, w: 800, h: 200 }, Bad: { x: NaN, y: 0, w: 1, h: 1 } }, logo: { where: "top_left", variant: "Reversed", contrast: 6 }, png: { bytes: 1, sha256: "a" }, fig: { bytes: 1, sha256: "b" } };
  assertEquals(placed(out), { boxes: { Headline: { x: 0.1, y: 0.25, w: 0.8, h: 0.1 } }, logo: { where: "top_left", variant: "Reversed", contrast: 6 } });
  assertEquals(placed({ png: out.png, fig: out.fig }), {});
  assertEquals(placed({ ...out, logo: null, boxes: undefined }), { logo: null });
});

Deno.test("own_area looks for crop subjects while bypassing photographic room for the approved copy", async () => {
  let looks = 0;
  const choice = { keepClear: [{ what: "the shoe", x: 0.2, y: 0.5, w: 0.3, h: 0.3 }], people: [{ x: 0.6, y: 0.2, w: 0.2, h: 0.6 }], band: "top" as const, align: "left" as const, colour: "on_photo" as const, layout: "", why: "crop subjects" };
  const { d, calls } = deps({ choose: () => { looks++; return Promise.resolve(choice); } });
  const own: Take = { ...take, planned: { ...take.planned, words: "own_area" }, room: "the left 40% of the width has no person" };
  assertEquals(roomOf(own), {});
  assertEquals(await designLayer(own, d), "made");
  const request = calls.lay[0] as { wordsPlacement: string; words: unknown; keepClear: unknown[]; prefer: unknown };
  assertEquals(request.wordsPlacement, "own_area");
  assertEquals(request.words, wordsOf(take));
  assertEquals(looks, 1);
  assertEquals(request.keepClear, keepClearOf(choice, "feed"));
  assertEquals(request.prefer, {});
  const old = deps();
  await designLayer(take, old.d);
  assertEquals((old.calls.lay[0] as { wordsPlacement: string }).wordsPlacement, "on_picture");
});
