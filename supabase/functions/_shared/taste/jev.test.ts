// Jev as a reader, without Jev: the questions a pass becomes, and its answers back in the shape every reader answers in.
import { assert, assertEquals } from "jsr:@std/assert@1.0.19";
import { askJev, askJevRef, JEV, jevAsk, jevOut } from "./jev.ts";
import { answersOf, CANNOT_TELL, passFields, showsOf } from "./read.ts";
import type { Shows } from "./schema.ts";

const ALL: Shows = { people: true, face: true, severalPeople: false, product: true, words: true, logo: true, outdoors: true };
const PICTURE = { base64: "A".repeat(200), mediaType: "image/jpeg" as const };

Deno.test("a pass becomes questions Jev can answer: one choice per field, one yes/no per option of a list", () => {
  const fields = passFields("idea");
  const { state, questions, slots } = jevAsk("idea", fields, "PIC");
  assert(state.includes("PIC"));
  const choice = fields.filter((f) => f.type === "choice"), lists = fields.filter((f) => f.type === "choices");
  const asked = Object.values(questions);
  assertEquals(asked.filter((q) => q.type === "choice").length, choice.length);
  // Every option of every list, and the seven things a picture shows.
  assertEquals(asked.filter((q) => q.type === "noul").length, lists.reduce((n, f) => n + f.options!.length, 0) + 7);
  // Free words are not asked: Jev writes nothing.
  assert(!Object.values(slots).some((s) => s.kind !== "shows" && s.field.type === "words"));
  const first = asked.find((q) => q.type === "choice")!;
  assert(first.type === "choice" && CANNOT_TELL in first.criteria && Object.keys(first.criteria).length <= 255);
  // Names a request can carry whatever the API allows in a name.
  assert(Object.keys(questions).every((n) => /^q\d+$/.test(n)));
});

Deno.test("Jev's answers come back as a card's answers: the choice, the likely options likeliest first, what it shows", () => {
  const fields = passFields("idea");
  const { slots } = jevAsk("idea", fields, "PIC");
  const one = fields.find((f) => f.type === "choice")!, list = fields.find((f) => f.type === "choices")!;
  const answers: Record<string, { type: string; choice?: string; noul?: number }> = {};
  for (const [name, s] of Object.entries(slots)) {
    if (s.kind === "shows") answers[name] = { type: "noul", noul: s.key === "people" || s.key === "face" ? 0.9 : 0.1 };
    else if (s.kind === "choice") answers[name] = { type: "choice", choice: s.field.key === one.key ? one.options![1] : CANNOT_TELL };
    else answers[name] = { type: "noul", noul: s.field.key === list.key ? [0.6, 0.2, 0.95][list.options!.indexOf(s.option)] ?? 0.05 : 0 };
  }
  const out = jevOut(slots, answers);
  assertEquals(showsOf(out), { people: true, face: true, severalPeople: false, product: false, words: false, logo: false, outdoors: false });
  const read = answersOf(fields, out);
  assertEquals(read[one.key], one.options![1]);
  assertEquals(read[list.key], [list.options![2], list.options![0]]);
  // What Jev could not tell, and the words it cannot write, are empty on the card.
  assertEquals(read[fields.find((f) => f.type === "choice" && f.key !== one.key)!.key], null);
  assertEquals(read[fields.find((f) => f.type === "words")!.key], null);
});

Deno.test("a pass is sent to Jev with the picture and the header that allows pictures, in requests of at most forty questions", async () => {
  const sent: { headers: Record<string, string>; body: { model: string; state: string; questions: Record<string, unknown>; assets: Record<string, { type: string; format: string; data_base64: string }> } }[] = [];
  const send = ((_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    sent.push({ headers: init.headers as Record<string, string>, body });
    const answers = Object.fromEntries(Object.entries(body.questions as Record<string, { type: string; criteria: Record<string, unknown> }>).map(([n, q]) =>
      [n, q.type === "choice" ? { type: "choice", choice: Object.keys(q.criteria)[0], confidence: 0.8 } : { type: "noul", noul: 0.2 }]));
    return Promise.resolve(new Response(JSON.stringify({ model: "jev-1.14", answers, usage: { input_tokens: 50_000, output_tokens: 9 } })));
  }) as unknown as typeof fetch;
  const a = await askJev("secret", "look", ALL, PICTURE, send);
  assert(a.ok);
  const fields = passFields("look", ALL);
  assertEquals(sent.length, 2);
  assert(sent.every((s) => Object.keys(s.body.questions).length <= JEV.most && s.headers["TypeSafe-Danger-Zone-Images"] === "true" && s.headers.Authorization === "Bearer secret"));
  const [placeholder, asset] = Object.entries(sent[0]!.body.assets)[0]!;
  assert(sent[0]!.body.state.includes(placeholder) && asset.type === "image" && asset.format === "jpeg" && asset.data_base64 === PICTURE.base64);
  const read = answersOf(fields, a.out);
  const one = fields.find((f) => f.type === "choice")!;
  assertEquals(read[one.key], one.options![0]);
  // Two requests of 50,000 tokens at 4.2 cents a million.
  assertEquals(a.usage, { model: "jev-1.14", input_tokens: 100_000, output_tokens: 0, cost_usd: 0.0042 });
});

Deno.test("a request Jev will not take is asked again as two halves, and every question still gets its answer", async () => {
  const sizes: number[] = [];
  const send = ((_url: string, init: RequestInit) => {
    const questions = JSON.parse(init.body as string).questions as Record<string, { type: string; criteria: Record<string, unknown> }>;
    const names = Object.keys(questions);
    sizes.push(names.length);
    // This Jev takes at most twelve questions a request.
    if (names.length > 12) return Promise.resolve(new Response(JSON.stringify({ detail: "too many questions" }), { status: 422 }));
    const answers = Object.fromEntries(names.map((n) => [n, questions[n]!.type === "choice" ? { type: "choice", choice: Object.keys(questions[n]!.criteria)[0], confidence: 0.8 } : { type: "noul", noul: 0.9 }]));
    return Promise.resolve(new Response(JSON.stringify({ model: "jev-1.14", answers, usage: { input_tokens: 1000 } })));
  }) as unknown as typeof fetch;
  const a = await askJev("secret", "look", ALL, PICTURE, send);
  assert(a.ok);
  const fields = passFields("look", ALL);
  assert(sizes.some((n) => n > 12) && sizes.filter((n) => n <= 12).length >= 4);
  const read = answersOf(fields, a.out);
  assert(fields.filter((f) => f.type === "choice").every((f) => read[f.key] === f.options![0]));
  assertEquals(a.usage.input_tokens, sizes.filter((n) => n <= 12).length * 1000);
});

Deno.test("Jev says so plainly when it has no key, cannot take the picture, or a request fails", async () => {
  const never = (() => Promise.reject(new Error("not asked"))) as unknown as typeof fetch;
  const noKey = await askJev(undefined, "idea", undefined, PICTURE, never);
  assert(!noKey.ok && noKey.error === "No key for Jev.");
  const address = await askJev("secret", "idea", undefined, { url: "https://example.com/a.jpg" }, never);
  assert(!address.ok && address.error.includes("JPEG or a PNG"));
  const refused = await askJev("secret", "idea", undefined, PICTURE, (() => Promise.resolve(new Response(JSON.stringify({ detail: "bad token secret" }), { status: 401 }))) as unknown as typeof fetch);
  assert(!refused.ok && refused.error.startsWith("Jev answered 401") && !refused.error.includes("secret"));
});

Deno.test("a reference picture is three choices in one request, and the answers are its card", async () => {
  let sent: { questions: Record<string, { type: string; criteria: Record<string, string> }>; state: string; assets: Record<string, unknown> } | null = null;
  const send = ((_url: string, init: RequestInit) => {
    sent = JSON.parse(init.body as string);
    return Promise.resolve(new Response(JSON.stringify({ model: "jev-1.14", usage: { input_tokens: 2400, output_tokens: 3 }, answers: {
      of: { type: "choice", choice: "product_on_person", confidence: 0.93 }, view: { type: "choice", choice: "cannot_tell", confidence: 0.6 }, crop: { type: "choice", choice: "half", confidence: 0.8 },
    } })));
  }) as unknown as typeof fetch;
  const a = await askJevRef("secret", PICTURE, send);
  assert(a.ok);
  assertEquals(a.card, { of: "product_on_person", view: null, crop: "half" });
  assertEquals(a.usage, { model: "jev-1.14", input_tokens: 2400, output_tokens: 0, cost_usd: 0.0001 });
  assertEquals(Object.keys(sent!.questions), ["of", "view", "crop"]);
  assert(Object.values(sent!.questions).every((q) => q.type === "choice") && "back" in sent!.questions.view!.criteria);
  assert(sent!.state.includes(Object.keys(sent!.assets)[0]!));
  const webp = await askJevRef("secret", { base64: "A".repeat(200), mediaType: "image/webp" }, send);
  assert(!webp.ok && webp.error.includes("JPEG or a PNG"));
});
