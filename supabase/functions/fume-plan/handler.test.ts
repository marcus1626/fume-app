// The plan handler without Supabase or the model: deno test supabase/functions/fume-plan/
import { assertEquals } from "jsr:@std/assert@1";
import { type Deps, handlePlan, type Written } from "./handler.ts";
import { type ClaimRead, copyLines, judgeCopy, type PlanAnswer, type PlanTask, prompt, toBody } from "./plan.ts";
import { columnPart, recentPart, repeatsHeadline, tooLongFor } from "./plan.ts";

const task: PlanTask = {
  run_id: "r1",
  attempt: 1,
  plan_id: "p1",
  version: 1,
  campaign_id: "c1",
  brand: { name: "LYSNE", market: "Norway", language: "en" },
  campaign: { name: "Quiet hour", due_at: "2026-12-01T15:00:00Z" },
  brief: {
    objective: "Own the hour before sleep",
    message: "The hour is yours",
    formats: ["feed", "story"],
    creatives: 2,
  },
  products: [
    {
      id: "oil",
      name: "Night Body Oil",
      variant: "",
      facts: [
        {
          id: "f1",
          area: "claim",
          label: "Evening",
          statement: "For the hour before sleep.",
          status: "verified",
          required: false,
        },
        { id: "f2", area: "claim", label: "Silk", statement: "Skin like silk.", status: "unverified", required: false },
      ],
    },
  ],
  rules: [{ text: "Faces", kind: "never", source: "brief" }],
  change: null,
};

const plan: PlanAnswer = {
  summary: "s",
  strategicTask: "t",
  directions: [
    {
      id: "a",
      name: "Lamp light",
      idea: "i",
      hook: "h",
      productRole: "hero",
      why: [{ text: "w", source: "brief" }],
      risks: [],
      look: [{ label: "Light", value: "One lamp", why: "quiet" }],
      creatives: [
        {
          id: "pc1",
          name: "Master 1",
          kind: "master",
          of: null,
          format: "feed",
          productIds: ["oil"],
          scene: "s",
          text: null,
          claimRefs: [],
          people: "No people",
        },
        {
          id: "pc2",
          name: "Story",
          kind: "variant",
          of: "pc1",
          format: "story",
          productIds: ["oil"],
          scene: "s",
          text: "For the hour before sleep.",
          claimRefs: ["f1"],
          people: "No people",
        },
      ],
      recommended: true,
    },
  ],
  chosenDirectionId: "a",
  chosenReason: "r",
  copy: [{ label: "Call to action", value: "Shop the oil", why: "w" }],
  openQuestions: [],
  changes: ["x"],
};
const usage = { model: "claude-opus-5-5", input_tokens: 1000, output_tokens: 500, cost_usd: 0.014 };

function fake(
  opts: { canRead?: boolean; task?: PlanTask | null; answers?: Written[]; refusals?: string[]; reads?: (ClaimRead | null)[] } = {},
) {
  const checks: Record<string, unknown>[] = [];
  const reads = opts.reads ? [...opts.reads] : undefined;
  const calls: string[] = [];
  const work: Promise<unknown>[] = [];
  const answers = [...(opts.answers ?? [{ ok: true, answer: plan, usage }])];
  const refusals = [...(opts.refusals ?? [])];
  const deps = (): Deps => ({
    canRead: async () => opts.canRead ?? true,
    service: {
      take: async () => ({ data: opts.task === undefined ? task : opts.task, error: null }),
      finish: async (_id, body, changes, u) => {
        calls.push(`finish ${(body.directions as unknown[]).length} [${changes}] ${u.cost_usd}`);
        const r = refusals.shift();
        return { error: r ? { message: r, details: "invalid" } : null };
      },
      fail: async (_id, error, u, final) => {
        calls.push(`fail ${error} ${u.cost_usd} ${final}`);
        return { error: null };
      },
      copyChecked: async (_id, check) => {
        checks.push(check);
        calls.push(`copy checked ${check.unbacked}`);
        return { error: null };
      },
    },
    write: async (_t, problem) => {
      calls.push(`write${problem ? ` (${problem})` : ""}`);
      return answers.shift()!;
    },
    ...(reads
      ? {
          checkCopy: async () => {
            calls.push("read words");
            return { read: reads.shift() ?? null, usage: { ...usage, cost_usd: 0.001 } };
          },
        }
      : {}),
    toBody,
    later: (p) => work.push(p),
  });
  return { calls, deps, checks, done: () => Promise.all(work) };
}
const post = (body: unknown, auth = "Bearer t") =>
  new Request("https://x.test/functions/v1/fume-plan", {
    method: "POST",
    headers: auth ? { Authorization: auth } : {},
    body: JSON.stringify(body),
  });

Deno.test("answers at once and writes the plan in the background", async () => {
  const f = fake();
  const res = await handlePlan(post({ campaignId: "c1" }), f.deps);
  assertEquals(res.status, 202);
  await f.done();
  assertEquals(f.calls, ["write", "finish 1 [] 0.014"]);
});

Deno.test("someone who cannot read the campaign gets nothing", async () => {
  const f = fake({ canRead: false });
  assertEquals((await handlePlan(post({ campaignId: "c1" }), f.deps)).status, 404);
  assertEquals((await handlePlan(post({ campaignId: "c1" }, ""), f.deps)).status, 403);
  assertEquals(f.calls, []);
});

Deno.test("nothing to write: the plan is ready or a run is under way", async () => {
  const f = fake({ task: null });
  const res = await handlePlan(post({ campaignId: "c1" }), f.deps);
  assertEquals([res.status, (await res.json()).writing], [200, false]);
});

Deno.test("a plan the database refuses is written once more with its reasons, then fails", async () => {
  const f = fake({
    answers: [
      { ok: true, answer: plan, usage },
      { ok: true, answer: plan, usage },
    ],
    refusals: ["bad claim", "bad claim"],
  });
  await handlePlan(post({ campaignId: "c1" }), f.deps);
  await f.done();
  assertEquals(f.calls, [
    "write",
    "finish 1 [] 0.014",
    "write (bad claim)",
    "finish 1 [] 0.028",
    "fail The plan did not pass: bad claim 0.028 false",
  ]);
});

Deno.test("a refusal by the model is final; the plan from the brief stands", async () => {
  const f = fake({ answers: [{ ok: false, error: "declined", usage, final: true }] });
  await handlePlan(post({ campaignId: "c1" }), f.deps);
  await f.done();
  assertEquals(f.calls, ["write", "fail declined 0.014 true"]);
});

Deno.test("a change passes on what Fume changed", async () => {
  const f = fake({ task: { ...task, version: 2, change: { asked: "Warmer", plan: {} } } });
  await handlePlan(post({ campaignId: "c1" }), f.deps);
  await f.done();
  assertEquals(f.calls, ["write", "finish 1 [x] 0.014"]);
});

Deno.test("the prompt lists only verified claims as usable, and the body keeps the contract's shape", () => {
  const text = prompt(task);
  assertEquals(text.includes("the only claims words may use): f1."), true);
  const body = toBody(plan);
  const d = (body.directions as Record<string, unknown>[])[0]!;
  assertEquals([d.letter, (d.look as { key: string }[])[0]!.key, body.chosen_direction_id], ["A", "light", "a"]);
  const [m, v] = d.creatives as Record<string, unknown>[];
  assertEquals(
    ["of" in m!, v!.of, v!.text, (body.content as { key: string }[])[0]!.key],
    [false, "pc1", "For the hour before sleep.", "call_to_action"],
  );
});

Deno.test("the plan writer reads the brand brain, and what is only proposed is marked", async () => {
  const { prompt } = await import("./plan.ts");
  const base = {
    run_id: "r",
    attempt: 1,
    plan_id: "p",
    version: 1,
    campaign_id: "c",
    brand: { name: "Halm", market: "NO", language: "en" },
    campaign: { name: "Autumn", due_at: null },
    brief: {},
    products: [],
    rules: [],
    change: null,
  };
  const withBrain = prompt({
    ...base,
    brain: {
      market: [{ what: "Young families", kind: "audience", confirmed: true }],
      memory: [{ kind: "change", what: "Too dark" }],
      identity: [],
    },
  });
  if (!withBrain.includes("<brand_brain>") || !withBrain.includes("Young families") || !withBrain.includes("Too dark"))
    throw new Error("the brain is not in the prompt");
  if (withBrain.includes('"identity"')) throw new Error("empty layers are left out");
  if (prompt({ ...base, brain: {} }).includes("<brand_brain>")) throw new Error("an empty brain adds nothing");
  const tasted = prompt({
    ...base,
    brain: {
      taste_profile: {
        measured_pictures: 6,
        do: [{ what: "Light: low key", target: 0.32, confidence: 0.7 }],
        dont: [],
        reasons: ["Too bright"],
      },
    },
  });
  if (!tasted.includes("<taste_profile>") || !tasted.includes("low key") || tasted.includes("<brand_brain>"))
    throw new Error("the taste profile is in the prompt on its own");
  if (prompt({ ...base, brain: { taste_profile: { measured_pictures: 0, do: [] } } }).includes("<taste_profile>"))
    throw new Error("an unmeasured taste adds nothing");
});

const noClaims = (a: PlanAnswer): ClaimRead => ({
  lines: copyLines(a).map((l) => ({ ref: l.ref, claims: [], voice: "on" as const, voiceNote: null, language: "ok" as const, languageNote: null })),
});

Deno.test("every line of words is read for claims; a verified claim fact backs one", () => {
  const lines = copyLines(plan);
  assertEquals(lines.map((l) => l.ref), ["copy:call_to_action", "a/pc2"]);
  const read: ClaimRead = {
    lines: [
      { ref: "copy:call_to_action", claims: [], voice: "on", voiceNote: null, language: "ok" as const, languageNote: null },
      { ref: "a/pc2", claims: [{ words: "For the hour before sleep", kind: "other", backedBy: "f1", brandSays: false }], voice: "on", voiceNote: null, language: "ok" as const, languageNote: null },
    ],
  };
  const j = judgeCopy(task, lines, read);
  assertEquals(j.findings, []);
  assertEquals((j.lines[1].claims[0] as { verdict: string }).verdict, "backed");
});

Deno.test("an unverified fact, an invented id or the brand's own words never back a result", () => {
  const lines = copyLines(plan);
  const read: ClaimRead = {
    lines: [
      { ref: "copy:call_to_action", claims: [{ words: "Skin like silk", kind: "result", backedBy: "f2", brandSays: true }], voice: "on", voiceNote: null, language: "ok" as const, languageNote: null },
      { ref: "a/pc2", claims: [{ words: "Sleep better", kind: "health", backedBy: "f9", brandSays: false }], voice: "off", voiceNote: "Too loud", language: "ok" as const, languageNote: null },
    ],
  };
  const j = judgeCopy(task, lines, read);
  assertEquals(j.findings.map((f) => `${f.ref} ${f.kind} ${f.blocking}`), [
    "copy:call_to_action unbacked_claim true",
    "a/pc2 unbacked_claim true",
    "a/pc2 off_voice false",
  ]);
});

Deno.test("a price the brand says on its site passes as the brand's words; the voice's avoided words are found", () => {
  const t: PlanTask = { ...task, voice: { id: "v1", version: 2, state: "approved", body: { speak: { avoid: ["Nydelig", "Kjøp nå!!"] } } } };
  const a: PlanAnswer = { ...plan, copy: [{ label: "Offer", value: "Nydelig olje. Fri frakt over 998,-", why: "w" }] };
  const read: ClaimRead = {
    lines: [
      { ref: "copy:offer", claims: [{ words: "Fri frakt over 998,-", kind: "offer", backedBy: null, brandSays: true }], voice: "on", voiceNote: null, language: "ok" as const, languageNote: null },
      { ref: "a/pc2", claims: [], voice: "on", voiceNote: null, language: "ok" as const, languageNote: null },
    ],
  };
  const j = judgeCopy(t, copyLines(a), read);
  assertEquals(j.findings.map((f) => `${f.kind} ${f.note}`), ['avoided_word The voice avoids "Nydelig".']);
  assertEquals((j.lines[0].claims[0] as { verdict: string }).verdict, "brand_says");
});

Deno.test("a claim no verified fact states is written once more without it, and the check is kept on the run", async () => {
  const bad: ClaimRead = {
    lines: [
      { ref: "copy:call_to_action", claims: [{ words: "Sleep better", kind: "health", backedBy: null, brandSays: false }], voice: "on", voiceNote: null, language: "ok" as const, languageNote: null },
      { ref: "a/pc2", claims: [], voice: "on", voiceNote: null, language: "ok" as const, languageNote: null },
    ],
  };
  const f = fake({ answers: [{ ok: true, answer: plan, usage }, { ok: true, answer: plan, usage }], reads: [bad, noClaims(plan)] });
  await handlePlan(post({ campaignId: "c1" }), f.deps);
  await f.done();
  assertEquals(f.calls[0], "write");
  assertEquals(f.calls[1], "read words");
  assertEquals(f.calls[2].startsWith('write (Words that make a claim no verified fact states: copy:call_to_action ("Shop the oil"): "Sleep better"'), true);
  assertEquals(f.calls.slice(3), ["read words", "copy checked 0", "finish 1 [] 0.03"]);
  assertEquals(f.checks[0].rewritten, true);
  assertEquals((f.checks[0].rewrote_for as { kind: string }[]).map((x) => x.kind), ["unbacked_claim"]);
});

Deno.test("a claim still unbacked after the rewrite goes to the expert with the check, not to the customer", async () => {
  const bad: ClaimRead = {
    lines: [
      { ref: "copy:call_to_action", claims: [{ words: "Best oil", kind: "superlative", backedBy: null, brandSays: false }], voice: "on", voiceNote: null, language: "ok" as const, languageNote: null },
      { ref: "a/pc2", claims: [], voice: "on", voiceNote: null, language: "ok" as const, languageNote: null },
    ],
  };
  const f = fake({ answers: [{ ok: true, answer: plan, usage }, { ok: true, answer: plan, usage }], reads: [bad, bad] });
  await handlePlan(post({ campaignId: "c1" }), f.deps);
  await f.done();
  assertEquals(f.calls.slice(-2), ["copy checked 1", "finish 1 [] 0.03"]);
  assertEquals((f.checks[0].findings as unknown[]).length, 1);
});

Deno.test("words that cannot be read are kept as not read, and the plan goes on", async () => {
  const f = fake({ reads: [null] });
  await handlePlan(post({ campaignId: "c1" }), f.deps);
  await f.done();
  assertEquals(f.calls, ["write", "read words", "copy checked 0", "finish 1 [] 0.015"]);
  assertEquals(f.checks[0].read, false);
});

Deno.test("the plan writer writes in the brand's Tone of Voice and says how far it stands", () => {
  const p = prompt({ ...task, voice: { id: "v1", version: 3, state: "checked", body: { summary: "Calm and plain" } } });
  assertEquals(p.includes("<tone_of_voice>"), true);
  assertEquals(p.includes("Calm and plain"), true);
  assertEquals(p.includes("A Fume expert checked it"), true);
  assertEquals(prompt(task).includes("<tone_of_voice>"), false);
});

Deno.test("a mistake in the language is a finding that has the plan's words rewritten", () => {
  const lines = [{ ref: "a/pc1", where: "Master 1", text: "EN IKON FOR BYEN OM NATTEN." }];
  const j = judgeCopy(task, lines, {
    lines: [{ ref: "a/pc1", claims: [], voice: "on", voiceNote: null, language: "error", languageNote: "Ikon is neuter: ET IKON FOR BYEN OM NATTEN." }],
  });
  assertEquals(j.findings.map((f) => `${f.kind} ${f.blocking}`), ["language true"]);
});

Deno.test("a call to action that says the headline again is rewritten, unless the brand's own buttons do that", () => {
  const lines = [
    { ref: "copy:headline", where: "Headline", text: "FLANELLSKJORTER" },
    { ref: "copy:call_to_action", where: "Call to action", text: "Flanellskjorter." },
  ];
  const found = repeatsHeadline(lines, [{ cta: "KJØP NÅ", when: "Sale ads where a price is shown." }]);
  assertEquals([found?.kind, found?.blocking, found?.ref], ["repeats_headline", true, "copy:call_to_action"]);
  assertEquals(repeatsHeadline(lines, [{ cta: "DRESSER", when: "Category ads. Repeats the product noun." }]), null);
  assertEquals(repeatsHeadline([lines[0], { ...lines[1], text: "KJØP NÅ" }], []), null);
});

Deno.test("a price is never backed by the brand's words for other products, only by a verified fact", () => {
  const lines = [{ ref: "copy:price", where: "Price", text: "NÅ 199,-" }];
  const read = (backedBy: string | null) => ({
    lines: [{ ref: "copy:price", claims: [{ words: "NÅ 199,-", kind: "price" as const, backedBy, brandSays: true }], voice: "on" as const, voiceNote: null, language: "ok" as const, languageNote: null }],
  });
  assertEquals(judgeCopy(task, lines, read(null)).findings.map((f) => `${f.kind} ${f.blocking}`), ["unbacked_claim true"]);
  const fact = task.products[0].facts.find((f) => f.status === "verified")!;
  assertEquals(judgeCopy(task, lines, read(fact.id)).findings, []);
});

Deno.test("the brand's recent headlines go in the prompt as lines not to repeat", () => {
  assertEquals(recentPart([]), []);
  const part = recentPart(["Trends change. Grails don't.", "Trends change. Grails don't.", " "]).join("\n");
  assertEquals(part.split("- Trends change").length, 2);
  assertEquals(part.includes("not the same build of sentence"), true);
});

Deno.test("a narrow column of words asks for a short headline", () => {
  const narrow = columnPart({ name: "Green stack beside the model, left", pct: 25 }).join(" ");
  assertEquals(narrow.includes("at most 22 characters") && narrow.includes("no word longer than 8 letters"), true);
  assertEquals(columnPart({ name: "Quote stack bottom left", pct: 82 }).join(" ").includes("at most 42 characters"), true);
  assertEquals(columnPart(null), []);
  assertEquals(prompt({ ...task, column: { name: "Green stack", pct: 25 } }).includes("Green stack"), true);
});

Deno.test("a headline too long for the brand's column is sent back once", () => {
  const col = { name: "Green stack beside the model, left", pct: 25 };
  const head = (text: string) => [{ ref: "copy:headline", where: "Headline", text }];
  assertEquals(tooLongFor(head("Samme skjorte, fredag og mandag"), col)?.kind, "too_long");
  assertEquals(tooLongFor(head("Fredag. Mandag. Samme skjorte."), col)?.blocking, true);
  assertEquals(tooLongFor(head("Fra fredag til mandag"), col), null);
  assertEquals(tooLongFor(head("Arbeidsskjortesesongen"), col)?.note.includes("a word of 22 letters"), true);
  assertEquals(tooLongFor(head("Samme skjorte, fredag og mandag"), { name: "Quote stack", pct: 82 }), null);
  assertEquals(tooLongFor(head("Samme skjorte, fredag og mandag"), null), null);
});
