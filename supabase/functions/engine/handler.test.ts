import { assert, assertEquals } from "jsr:@std/assert@1";
import { type Deps, enforcedOf, handleEngine, NO_PROVIDER, roomLesson, runJob, seenLessons, type Taken } from "./handler.ts";
import { byModel, higgsfield, ratioFor } from "./provider.ts";
import { fal, sizeFor } from "./fal.ts";
import type { Composer, Decider, SlotText, Verifier } from "../_shared/engine/index.ts";

const JOB = "0b000000-0000-4000-8000-0000000000aa";
const taken = (attempt = 1): Taken => ({
  run: { job_id: JOB, attempt_id: `att-${attempt}`, attempt, workspace_id: "ws1", kind: "master", image_model: "nano-banana-pro" },
  brand: { name: "LYSNE" },
  creative: { id: "cr1", title: "Master 1", slot: "pc1", format: "feed", kind: "master" },
  plan: {
    chosen_direction_id: "a",
    directions: [{ id: "a", name: "Evening", idea: "The hour before sleep.", productRole: "held in the hand", look: [] }],
    planned_creatives: [{ id: "pc1", name: "Master 1", format: "feed", scene: "A bedside table at dusk", people: "No people" }],
  },
  products: [{
    id: "p1",
    name: "Night oil",
    facts: [{ id: "f1", area: "shape", label: "Bottle", statement: "A small amber glass bottle with a dropper", status: "verified" }],
    pictures: [{ slot: "front", path: "ws1/oil.png" }, { slot: "back", url: "https://brand.example/oil-back.png" }],
  }],
  rules: [],
  taste: [],
  lessons: [],
  exemplars: [],
  master: null,
  change: null,
});

const slots: SlotText[] = [
  { slotKey: "assignment", text: "A quiet campaign photograph.", sources: [] },
  { slotKey: "people", text: "No people are in the frame.", sources: [] },
  { slotKey: "scene", text: "A bedside table at dusk, the bottle beside a lamp.", sources: [] },
  { slotKey: "camera", text: "Captured on full-frame digital with a 50 mm lens at f/2.8 from table height; low daylight at 5600 K from the left at 3:1 contrast; a soft warm grade with fine grain and real wear on the wood.", sources: [] },
  { slotKey: "brand", text: "Warm, low light.", sources: [] },
  { slotKey: "constraints", text: "No person in the frame.", sources: [] },
];
const call = { task: "x", provider: "test", model: "test", latencyMs: 1, costUsd: 0.001 };
const editSlots: SlotText[] = [
  { slotKey: "assignment", text: "Change the first picture as asked.", sources: [] },
  { slotKey: "change", text: "The light turns warm, like late morning sun.", sources: [] },
  { slotKey: "keep", text: "Everything else stays exactly as in the first picture.", sources: [] },
  { slotKey: "constraints", text: "No person in the frame.", sources: [] },
];
// The composer fills the free slots of the grammar it is given.
const compose: Composer = async ({ compilePackage }) => ({
  slots: (compilePackage.grammar.imageType === "picture_edit" ? editSlots : slots).map((s, i) =>
    i === 0 ? { ...s, sources: compilePackage.manifest.map((m) => m.id) } : s
  ),
  call,
});
const decide: Decider = async ({ questions }) => ({
  probabilities: Object.fromEntries(Object.keys(questions).map((k) => [k, k.startsWith("coverage") ? 0.95 : 0.05])),
  call,
});
const verify: Verifier = async () => ({ expressed: true, probability: 0.9, reason: "yes", call });

function fake(opts: { takes: (Taken | { collect: unknown } | null)[]; provider?: Deps["provider"] }) {
  const log: string[] = [];
  const prompts: Record<string, unknown>[] = [];
  const finished: Record<string, unknown>[][] = [];
  const deps: Deps = {
    canRead: async (id) => id === JOB,
    service: {
      take: async () => ({ data: (opts.takes.shift() ?? null) as Taken, error: null }),
      prompted: async (a, p) => (log.push(`prompted ${a} ${p.status}`), prompts.push(p), { error: null }),
      submitted: async (a, n, id) => (log.push(`submitted ${a} ${n} ${id}`), { error: null }),
      finish: async (a, files, _r, cents) => (log.push(`finish ${a} ${cents}`), finished.push(files), { error: null }),
      fail: async (a, e, _r, _c, final) => (log.push(`fail ${a} ${final ? "final" : "again"}: ${e}`), { error: null }),
      sign: async (f) => `https://signed/${f.path}`,
      store: async (p) => (log.push(`store ${p}`), { error: null }),
    },
    models: { compose, decide, verify },
    provider: opts.provider ?? null,
    download: async () => ({ bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 56, 0, 0, 5, 70, 0]), contentType: "image/png" }),
    later: () => undefined,
    wait: async () => undefined,
  };
  return { deps, log, prompts, finished };
}

function fakeProvider(states: ("waiting" | "done" | "nsfw")[], seen: unknown[] = []): Deps["provider"] {
  let n = 0;
  return {
    name: "fake",
    priceCents: () => 15,
    submit: async (r) => (seen.push(r), { ok: true, providerJobId: `req-${++n}` }),
    collect: async () => {
      const s = states.shift() ?? "waiting";
      if (s === "done") return { state: "done", urls: ["https://cdn/x.png"], response: {} };
      if (s === "nsfw") return { state: "failed", error: "refused as unsafe", final: false, response: {} };
      return { state: "waiting" };
    },
  };
}

Deno.test("without an image model the prompt is written and checked, and the job says nothing was rendered", async () => {
  const f = fake({ takes: [taken()] });
  assertEquals(await runJob(JOB, f.deps), "dry");
  assertEquals(f.log, ["prompted att-1 validated", `fail att-1 final: ${NO_PROVIDER}`]);
  const p = f.prompts[0] as { text: string; llm_usd: number; calls: unknown[] };
  assert(p.text.startsWith("The first picture is the product itself (Night oil, front)"));
  assert(p.text.includes("A small amber glass bottle with a dropper."));
  assert(p.llm_usd > 0 && p.calls.length >= 2);
});

Deno.test("with an image model the checked prompt goes unchanged, pictures first, and the picture becomes a candidate", async () => {
  const seen: { text: string; referenceUrls: string[]; aspectRatio: string }[] = [];
  const f = fake({ takes: [taken()], provider: fakeProvider(["waiting", "done"], seen) });
  assertEquals(await runJob(JOB, f.deps), "made");
  assertEquals(f.log, ["prompted att-1 validated", "submitted att-1 fake req-1", `store ws1/engine/${JOB}/att-1-1.png`, "finish att-1 15"]);
  assertEquals(seen[0].referenceUrls, ["https://signed/ws1/oil.png", "https://brand.example/oil-back.png"]);
  assertEquals(seen[0].aspectRatio, "4:5");
  assertEquals(seen[0].text, (f.prompts[0] as { text: string }).text);
  const file = f.finished[0][0] as { width: number; height: number; name: string };
  assertEquals([file.width, file.height, file.name], [1080, 1350, "Master 1, Engine 1.png"]);
});

Deno.test("a refused picture is tried again in the same run", async () => {
  const f = fake({ takes: [taken(1), taken(2)], provider: fakeProvider(["nsfw", "done"]) });
  assertEquals(await runJob(JOB, f.deps), "made");
  assert(f.log.includes("fail att-1 again: refused as unsafe"));
  assert(f.log.includes("finish att-2 15"));
});

Deno.test("a picture still being made is left for the next call, which collects it", async () => {
  const f = fake({ takes: [taken()], provider: fakeProvider(["waiting", "waiting", "waiting"]) });
  f.deps.collectForMs = 0;
  assertEquals(await runJob(JOB, f.deps), "waiting");
  const g = fake({
    takes: [{ collect: { job_id: JOB, attempt_id: "att-1", workspace_id: "ws1", provider: "fake", model: "nano-banana-pro", provider_job_id: "req-1", started_at: "" } }],
    provider: fakeProvider(["done"]),
  });
  assertEquals(await runJob(JOB, g.deps), "made");
  assertEquals(g.log.at(-1), "finish att-1 15");
});

Deno.test("a prompt that does not pass is recorded and nothing is rendered", async () => {
  const f = fake({ takes: [taken()], provider: fakeProvider(["done"]) });
  f.deps.models.decide = async ({ questions }) => ({ probabilities: Object.fromEntries(Object.keys(questions).map((k) => [k, 0.1])), call });
  f.deps.models.verify = async () => ({ expressed: false, probability: 0.1, reason: "no", call });
  assertEquals(await runJob(JOB, f.deps), "failed");
  assertEquals(f.log, ["prompted att-1 escalated"]);
});

Deno.test("a model that fails is recorded with what its calls cost", async () => {
  const f = fake({ takes: [taken()] });
  f.deps.models.compose = async () => {
    throw Object.assign(new Error("The model declined the compose."), { call });
  };
  assertEquals(await runJob(JOB, f.deps), "failed");
  const p = f.prompts[0] as { status: string; llm_usd: number };
  assertEquals([p.status, p.llm_usd], ["blocked", 0.001]);
});

Deno.test("the function answers at once, and only for a job the caller may see", async () => {
  const f = fake({ takes: [] });
  const post = (body: unknown, auth = "Bearer x") =>
    handleEngine(new Request("https://x", { method: "POST", headers: { Authorization: auth }, body: JSON.stringify(body) }), () => f.deps);
  assertEquals((await post({ jobId: JOB })).status, 202);
  assertEquals((await post({ jobId: "0b000000-0000-4000-8000-0000000000bb" })).status, 404);
  assertEquals((await post({ jobId: 3 })).status, 400);
  assertEquals((await handleEngine(new Request("https://x", { method: "POST" }), () => f.deps)).status, 401);
});

Deno.test("Higgsfield gets the prompt, the ratio and the pictures, with Fume's key", async () => {
  const sent: { url: string; init: RequestInit }[] = [];
  const hf = higgsfield("id:secret", {
    fetch: (async (url: string, init: RequestInit) => {
      sent.push({ url, init });
      return new Response(JSON.stringify(url.includes("/requests/") ? { status: "completed", images: [{ url: "https://cdn/a.png" }] } : { request_id: "r1" }));
    }) as typeof fetch,
  });
  const s = await hf.submit({ imageModel: "qwen-image-3", text: "A bench.", referenceUrls: ["https://p/1.png"], aspectRatio: "4:5", resolution: null, seed: null });
  assertEquals(s, { ok: true, providerJobId: "r1", provider: "higgsfield" });
  assertEquals(sent[0].url, "https://api.higgsfield.ai/alibaba/qwen-image-3/edit");
  assertEquals((sent[0].init.headers as Record<string, string>).Authorization, "Key id:secret");
  assertEquals(JSON.parse(sent[0].init.body as string), { prompt: "A bench.", aspect_ratio: "7:9", image_urls: ["https://p/1.png"] });
  const c = await hf.collect("r1");
  assertEquals(c.state === "done" && c.urls, ["https://cdn/a.png"]);
  const none = higgsfield("k", { fetch: (async () => new Response("no", { status: 403 })) as unknown as typeof fetch });
  assertEquals(await none.submit({ imageModel: "qwen-image-3", text: "x", referenceUrls: [], aspectRatio: "1:1", resolution: null, seed: null }),
    { ok: false, error: "Higgsfield has no credits left for Fume.", final: true });
});

Deno.test("a single API key is tried as Key, then as Bearer, and the accepted one is kept", async () => {
  const auths: string[] = [];
  const hf = higgsfield("single-key", {
    fetch: (async (_url: string, init: RequestInit) => {
      const a = (init.headers as Record<string, string>).Authorization;
      auths.push(a);
      return a.startsWith("Bearer") ? new Response(JSON.stringify({ request_id: "r9" })) : new Response("no", { status: 401 });
    }) as typeof fetch,
  });
  const r = { imageModel: "qwen-image-3", text: "x", referenceUrls: [], aspectRatio: "1:1", resolution: null, seed: null };
  assertEquals(await hf.submit(r), { ok: true, providerJobId: "r9", provider: "higgsfield" });
  assertEquals(await hf.submit(r), { ok: true, providerJobId: "r9", provider: "higgsfield" });
  assertEquals(auths, ["Key single-key", "Bearer single-key", "Bearer single-key"]);
});

Deno.test("a format the model does not make is asked as the nearest ratio it does", () => {
  assertEquals(ratioFor("qwen-image-3", "4:5"), "7:9");
  assertEquals(ratioFor("qwen-image-3", "9:16"), "9:16");
  assertEquals(ratioFor("seedream-4", "4:5"), "4:5");
});

const Q = "https://queue.fal.run";
function falFake(sent: { url: string; init: RequestInit }[], result: () => Response = () => new Response(JSON.stringify({ images: [{ url: "https://fal.media/a.png" }] }))) {
  return (async (url: string, init: RequestInit = {}) => {
    sent.push({ url, init });
    if (init.method === "POST") return new Response(JSON.stringify({ request_id: "q1", response_url: `${Q}/fal-ai/nano-banana-pro/requests/q1` }));
    if (url.endsWith("/status")) return new Response(JSON.stringify({ status: "COMPLETED" }));
    return result();
  }) as typeof fetch;
}

Deno.test("fal gets Nano Banana Pro's prompt, ratio and pictures, and is collected from its result address", async () => {
  const sent: { url: string; init: RequestInit }[] = [];
  const p = fal("fal-key", { fetch: falFake(sent) });
  const s = await p.submit({ imageModel: "nano-banana-pro", text: "A bench.", referenceUrls: ["https://p/1.png"], aspectRatio: "4:5", resolution: null, seed: 7 });
  assertEquals(s, { ok: true, providerJobId: `${Q}/fal-ai/nano-banana-pro/requests/q1`, provider: "fal" });
  assertEquals(sent[0].url, `${Q}/fal-ai/nano-banana-pro/edit`);
  assertEquals((sent[0].init.headers as Record<string, string>).Authorization, "Key fal-key");
  assertEquals(JSON.parse(sent[0].init.body as string),
    { prompt: "A bench.", num_images: 1, image_urls: ["https://p/1.png"], seed: 7, aspect_ratio: "4:5", resolution: "2K", output_format: "png" });
  const c = await p.collect(`${Q}/fal-ai/nano-banana-pro/requests/q1`);
  assertEquals(c.state === "done" && c.urls, ["https://fal.media/a.png"]);
  assertEquals(sent.slice(1).map((x) => x.url), [`${Q}/fal-ai/nano-banana-pro/requests/q1/status`, `${Q}/fal-ai/nano-banana-pro/requests/q1`]);
});

Deno.test("fal asks Seedream for a size and GPT Image for its nearest shape; a refusal is tried again", async () => {
  const sent: { url: string; init: RequestInit }[] = [];
  const p = fal("k", { fetch: falFake(sent, () => new Response(JSON.stringify({ detail: "Content flagged by safety checker" }), { status: 422 })) });
  await p.submit({ imageModel: "seedream-4", text: "x", referenceUrls: [], aspectRatio: "9:16", resolution: null, seed: null });
  assertEquals(sent[0].url, `${Q}/fal-ai/bytedance/seedream/v4/text-to-image`);
  assertEquals(JSON.parse(sent[0].init.body as string).image_size, sizeFor("9:16"));
  await p.submit({ imageModel: "gpt-image", text: "x", referenceUrls: [], aspectRatio: "4:5", resolution: null, seed: 3 });
  const g = JSON.parse(sent[1].init.body as string);
  assertEquals([g.image_size, g.seed], ["1024x1536", undefined]);
  const c = await p.collect(`${Q}/fal-ai/nano-banana-pro/requests/q1`);
  assertEquals(c.state === "failed" && [c.error, c.final], ["The image model refused the picture as unsafe.", false]);
  assertEquals(await fal("k", { fetch: (async () => new Response("{}", { status: 401 })) as unknown as typeof fetch })
    .submit({ imageModel: "nano-banana-2", text: "x", referenceUrls: [], aspectRatio: "1:1", resolution: null, seed: null }),
    { ok: false, error: "fal refused Fume's key.", final: true });
});

Deno.test("each model goes to the provider that has it, and comes back from the one that took it", async () => {
  const sent: { url: string; init: RequestInit }[] = [];
  const both = byModel([
    fal("k", { fetch: falFake(sent) }),
    higgsfield("id:s", { fetch: (async (url: string, init: RequestInit = {}) => {
      sent.push({ url, init });
      return new Response(JSON.stringify(url.includes("/requests/") ? { status: "completed", images: [{ url: "https://hf/b.png" }] } : { request_id: "h1" }));
    }) as typeof fetch }),
  ])!;
  const r = { text: "x", referenceUrls: [], aspectRatio: "1:1", resolution: null, seed: null };
  assertEquals((await both.submit({ ...r, imageModel: "nano-banana-pro" })).ok && sent[0].url, `${Q}/fal-ai/nano-banana-pro`);
  assertEquals(await both.submit({ ...r, imageModel: "qwen-image-3" }), { ok: true, providerJobId: "h1", provider: "higgsfield" });
  assertEquals((await both.collect("h1")).state === "done", true);
  assertEquals((await both.collect(`${Q}/fal-ai/nano-banana-pro/requests/q1`)).state === "done", true);
  assertEquals([both.priceCents("nano-banana-pro"), both.priceCents("qwen-image-3")], [15, 4]);
  assertEquals(byModel([]), null);
});

Deno.test("the brand's answers become lessons before the prompt is written, and this prompt uses them", async () => {
  const f = fake({ takes: [taken()] });
  const seenLessons: string[][] = [];
  const digested: unknown[] = [];
  f.deps.models.compose = async (input) => {
    seenLessons.push(input.compilePackage.knowledge.lessons.map((l) => l.statement));
    return compose(input);
  };
  f.deps.models.digest = async (a) => ({
    lessons: [{ statement: `Keep the cap matte (${a.why}).`, polarity: "avoid", reason: a.why, scope: "brand" }],
    call: { ...call, costUsd: 0.0004 },
  });
  f.deps.service.pending = async () => ({
    data: [{ id: "l1", verdict: "no", why: "Too glossy", image_model: "nano-banana-pro", updated_at: "2026-11-04T12:00:00Z", concept: "", slots: [] }],
    error: null,
  });
  f.deps.service.digested = async (...a) => (digested.push(a), { data: 1, error: null });
  assertEquals(await runJob(JOB, f.deps), "dry");
  assertEquals(digested, [["l1", "2026-11-04T12:00:00Z", [{ statement: "Keep the cap matte (Too glossy).", polarity: "avoid", reason: "Too glossy", scope: "brand" }], 0.0004]]);
  assert(seenLessons[0].includes("Keep the cap matte (Too glossy)."));
});

Deno.test("a failed digest never stops the render", async () => {
  const f = fake({ takes: [taken()] });
  f.deps.models.digest = async () => {
    throw new Error("The model declined the digest.");
  };
  f.deps.service.pending = async () => ({
    data: [{ id: "l1", verdict: "yes", why: "Nice", image_model: null, updated_at: "2026-11-04T12:00:00Z", concept: "", slots: [] }],
    error: null,
  });
  f.deps.service.digested = async () => ({ data: 1, error: null });
  assertEquals(await runJob(JOB, f.deps), "dry");
});

Deno.test("the Engine looks at the picture it kept, against what the prompt had to carry", async () => {
  const f = fake({ takes: [taken()], provider: fakeProvider(["done"]) });
  const seen: { pictureUrl: string; productPhotos: unknown[]; checks: { area: string; requirement: string }[] }[] = [];
  const kept: unknown[] = [];
  f.deps.models.evaluate = async (input) => {
    seen.push(input);
    return {
      looked: {
        answers: input.checks.map((c) => ({ n: c.n, verdict: c.area === "product" ? "unclear" : "holds", note: c.area === "product" ? "The label is hidden." : "" })),
        artefacts: "none",
        artefactNotes: [],
        printedText: false,
      },
      call: { ...call, costUsd: 0.0008 },
    };
  };
  f.deps.service.toEvaluate = async () => ({
    data: {
      candidates: [{ id: "cand-1", path: "ws1/engine/x.png", width: 1080, height: 1350 }],
      manifest: [
        { id: "ref-text", kind: "reference_text_locked", refId: "r", required: true, check: "code", requirement: "word for word", suggestedSlot: "references" },
        { id: "inv-1", kind: "product_invariant", refId: "1", required: true, check: "decision", requirement: "A small amber glass bottle", suggestedSlot: "constraints" },
        { id: "brand-1", kind: "brand_rule_hard", refId: "b", required: true, check: "decision", requirement: "No people", suggestedSlot: "people" },
        { id: "brand-taste-light", kind: "brand_rule_soft", refId: "taste-light.even", required: false, check: "decision", requirement: "light even across.", suggestedSlot: "brand" },
      ],
      references: [
        { url: "https://signed/ws1/master.png", role: "the approved Master 1, whose picture this keeps" },
        { url: "https://signed/ws1/oil.png", role: "Oil, front" },
        { url: "https://signed/ws1/oil-back.png", role: "Oil, back" },
      ],
    },
    error: null,
  });
  f.deps.service.evaluated = async (...a) => (kept.push(a), { error: null });
  assertEquals(await runJob(JOB, f.deps), "made");
  assertEquals(seen[0].pictureUrl, "https://signed/ws1/engine/x.png");
  // The Engine fetched the product's photographs itself and handed over their bytes.
  assertEquals(seen[0].productPhotos.map((p) => (p as { mediaType: string }).mediaType), ["image/png", "image/png"]);
  assertEquals(seen[0].checks.map((c) => c.requirement).slice(1), ["A small amber glass bottle", "No people"]);
  assert(seen[0].checks[0].requirement.startsWith("The product in the picture is the product in the photographs"));
  const [id, evaluation, usd] = kept[0] as [string, { productTruth: string; brandRules: string; notes: string[]; evaluated: boolean }, number];
  assertEquals([id, evaluation.productTruth, evaluation.brandRules, evaluation.evaluated, usd], ["cand-1", "flag", "pass", true, 0.0008]);
  assertEquals(evaluation.notes, ["The label is hidden."]);
  assertEquals((seen[0] as { size?: unknown }).size, { width: 1080, height: 1350 });
});

Deno.test("a product photo on a website that keeps the model out is fetched by the Engine, and a stale workspace link is signed again", async () => {
  const f = fake({ takes: [taken()], provider: fakeProvider(["done"]) });
  const fetched: string[] = [];
  const shownToModel: unknown[][] = [];
  f.deps.download = async (u) => {
    fetched.push(u);
    if (u.includes("broken")) throw new Error("403");
    return { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]), contentType: "application/octet-stream" };
  };
  f.deps.service.sign = async (file) => `https://fresh/${file.bucket ?? "workspace-files"}/${file.path}`;
  f.deps.models.evaluate = async (input) => {
    shownToModel.push(input.productPhotos);
    return { looked: { answers: [], artefacts: "none", artefactNotes: [], printedText: false }, call: { ...call, costUsd: 0 } };
  };
  f.deps.service.toEvaluate = async () => ({
    data: {
      candidates: [{ id: "c", path: "ws1/engine/x.png" }],
      manifest: [],
      references: [
        { url: "https://www.anthem-sports.com/media/a11-210.jpg", role: "Goal, front" },
        { url: "https://x.supabase.co/storage/v1/object/sign/workspace-files/ws1/products/oil%20front.jpg?token=old", role: "Oil, front" },
        { url: "https://broken.example/photo.jpg", role: "Oil, back" },
      ],
    },
    error: null,
  });
  f.deps.service.evaluated = async () => ({ error: null });
  assertEquals(await runJob(JOB, f.deps), "made");
  assert(fetched.includes("https://www.anthem-sports.com/media/a11-210.jpg"));
  assert(fetched.includes("https://fresh/workspace-files/ws1/products/oil front.jpg"));
  assertEquals(shownToModel[0], [
    { data: btoa(String.fromCharCode(0xff, 0xd8, 0xff, 0xe0, 1, 2, 3)), mediaType: "image/jpeg" },
    { data: btoa(String.fromCharCode(0xff, 0xd8, 0xff, 0xe0, 1, 2, 3)), mediaType: "image/jpeg" },
  ]);
});

Deno.test("the pictures of a job nobody looked at are looked at on request", async () => {
  const f = fake({ takes: [], provider: fakeProvider([]) });
  const looked: string[] = [];
  f.deps.service.unevaluated = async () => ["att-1", "att-2"];
  f.deps.service.toEvaluate = async (a) => ({ data: { candidates: [{ id: `${a}-c`, path: "p" }], manifest: [], references: [] }, error: null });
  f.deps.models.evaluate = async () => ({ looked: { answers: [], artefacts: "none", artefactNotes: [], printedText: false }, call: { ...call, costUsd: 0 } });
  f.deps.service.evaluated = async (id) => (looked.push(id), { error: null });
  const later: Promise<unknown>[] = [];
  f.deps.later = (w) => void later.push(w);
  const res = await handleEngine(
    new Request("http://x", { method: "POST", headers: { Authorization: "Bearer t" }, body: JSON.stringify({ jobId: JOB, evaluate: true }) }),
    () => f.deps,
  );
  assertEquals([res.status, await res.json()], [202, { evaluating: 2 }]);
  await Promise.all(later);
  assertEquals(looked, ["att-1-c", "att-2-c"]);
});

Deno.test("a picture the model cannot look at stays made, for the expert to check by eye", async () => {
  const f = fake({ takes: [taken()], provider: fakeProvider(["done"]) });
  f.deps.models.evaluate = async () => {
    throw new Error("The model could not read the picture.");
  };
  f.deps.service.toEvaluate = async () => ({ data: { candidates: [{ id: "c", path: "p" }], manifest: [], references: [] }, error: null });
  f.deps.service.evaluated = async () => ({ error: null });
  assertEquals(await runJob(JOB, f.deps), "made");
});

Deno.test("the designer's words change the picked picture: it goes first, and the words are held like a rule", async () => {
  const seen: { text: string; referenceUrls: string[]; aspectRatio: string }[] = [];
  const t = taken();
  t.master = { path: "ws1/engine/pick.png", title: "Master 1", picked: true };
  t.change = { problem: "", must_change: [], must_stay: [], ask: "make the light warmer" };
  const f = fake({ takes: [t], provider: fakeProvider(["done"], seen) });
  assertEquals(await runJob(JOB, f.deps), "made");
  assertEquals(seen[0].referenceUrls[0], "https://signed/ws1/engine/pick.png");
  const p = f.prompts[0] as { compile_package: { manifest: { requirement: string }[]; references: { role: string }[]; lockedReferenceText?: string } };
  assert(p.compile_package.manifest.some((m) => m.requirement === "The designer asks for this change: make the light warmer."));
  assertEquals(p.compile_package.references[0].role, "the picture of Master 1 that this changes");
  assert(!p.compile_package.manifest.some((m) => m.requirement.startsWith("The scene shows")), "the scene is the picture's own");
  assert(seen[0].text.includes("The light turns warm"));
});

Deno.test("a Render's direction is held like a rule, unless the designer asked for a change", () => {
  assertEquals(enforcedOf({ change: { problem: "", must_change: [], must_stay: [], direction: "Morning, the cup steaming" } }), [
    { id: "direction", statement: "The designer's direction for the picture: Morning, the cup steaming." },
  ]);
  assertEquals(
    enforcedOf({ change: { problem: "", must_change: [], must_stay: [], ask: "warmer light!", direction: "Morning" } }).map((x) => x.id),
    ["ask"],
  );
});

Deno.test("a format reshapes its approved master: the master goes first and the frame changes, nothing else", async () => {
  const seen: { text: string; referenceUrls: string[]; aspectRatio: string }[] = [];
  const t = taken();
  t.run = { ...t.run, kind: "format" };
  t.creative = { ...t.creative, format: "story", kind: "format" };
  t.master = { path: "ws1/master.png", title: "Master 1" };
  const f = fake({ takes: [t], provider: fakeProvider(["done"], seen) });
  assertEquals(await runJob(JOB, f.deps), "made");
  assertEquals(seen[0].referenceUrls[0], "https://signed/ws1/master.png");
  assertEquals(seen[0].aspectRatio, "9:16");
  const p = f.prompts[0] as { compile_package: { grammar: { imageType: string }; manifest: { requirement: string }[] } };
  assertEquals(p.compile_package.grammar.imageType, "picture_edit");
  assert(p.compile_package.manifest.some((m) => m.requirement.startsWith("Make the first picture in the story format, 9:16")));
});

Deno.test("what the picture check found on the brand's last pictures is avoided in the next prompt, after people's lessons", async () => {
  assertEquals(seenLessons(undefined), []);
  const five = ["Skin looks waxy", "Skin looks waxy", "Grass too clean to be real.", "Glow on the net.", "x", "Concrete too smooth.", "Warped goal frame."];
  assertEquals(seenLessons(five).map((l) => l.statement), ["Skin looks waxy.", "Grass too clean to be real.", "Glow on the net.", "Concrete too smooth."]);
  const t = { ...taken(), lessons: [{ id: "p1", statement: "Keep the cap matte.", polarity: "avoid" as const, reason: "A designer said so." }], seen: ["Skin looks waxy and plastic."] };
  const f = fake({ takes: [t] });
  const seen: string[][] = [];
  f.deps.models.compose = async (input) => {
    seen.push(input.compilePackage.knowledge.lessons.map((l) => l.statement));
    return compose(input);
  };
  assertEquals(await runJob(JOB, f.deps), "dry");
  assertEquals(seen[0].slice(0, 2), ["Keep the cap matte.", "Skin looks waxy and plastic."]);
});

Deno.test("a picture that left no room for the words is made once more, told what stood in the room", async () => {
  const room = { id: "brand-room", kind: "brand_rule_hard" as const, refId: "room-for-words", required: true, check: "decision" as const, requirement: "The left 40% of the width is bare ground for the words.", suggestedSlot: "scene" as const };
  const run = async (verdicts: ("holds" | "off" | "unclear")[], queue = true) => {
    const f = fake({ takes: [taken()], provider: fakeProvider(["done"]) });
    const asked: [string, string][] = [];
    const ran: string[] = [];
    const later: Promise<unknown>[] = [];
    f.deps.later = (w) => void later.push(w);
    let picture = 0;
    f.deps.models.evaluate = async (input) => {
      const verdict = verdicts[picture++];
      return {
        looked: {
          answers: input.checks.map((c) => ({ n: c.n, verdict: c.requirement === room.requirement ? verdict : "holds", note: c.requirement === room.requirement ? "The sled fills the left side." : "" })),
          artefacts: "none", artefactNotes: [], printedText: false,
        },
        call,
      };
    };
    f.deps.service.toEvaluate = async () => ({
      data: { candidates: verdicts.map((_, i) => ({ id: `cand-${i}`, path: `ws1/engine/${i}.png` })), manifest: [room], references: [] },
      error: null,
    });
    f.deps.service.evaluated = async () => ({ error: null });
    f.deps.service.again = async (attemptId, why) => (asked.push([attemptId, why]), queue);
    f.deps.service.runAgain = async (jobId) => void ran.push(jobId);
    assertEquals(await runJob(JOB, f.deps), "made");
    await Promise.all(later);
    return { asked, ran };
  };
  const off = await run(["off"]);
  assertEquals(off.asked.map((a) => a[1]), ["The sled fills the left side."], "the job is queued once more with what stood in the room");
  assertEquals(off.ran, [JOB], "and the next picture starts at once");
  assertEquals((await run(["off", "holds"])).asked, [], "one picture with room is enough for the expert");
  assertEquals((await run(["unclear"])).asked, [], "a room the check cannot tell is left to the expert");
  assertEquals((await run(["off"], false)).ran, [], "nothing starts when the job may not be made again");
});

Deno.test("the next prompt reads first what filled the room on the last picture", async () => {
  assertEquals(roomLesson(null), []);
  const [lesson] = roomLesson("The sled fills the left side");
  assertEquals([lesson.polarity, lesson.statement.endsWith("On the last picture: The sled fills the left side.")], ["do", true]);
  const t = { ...taken(), lessons: [{ id: "p1", statement: "Keep the cap matte.", polarity: "avoid" as const, reason: "A designer said so." }], again: "The sled fills the left side." };
  const f = fake({ takes: [t] });
  const seen: string[][] = [];
  f.deps.models.compose = async (input) => {
    seen.push(input.compilePackage.knowledge.lessons.map((l) => l.id));
    return compose(input);
  };
  assertEquals(await runJob(JOB, f.deps), "dry");
  assertEquals(seen[0].slice(0, 2), ["room-again", "p1"]);
});
