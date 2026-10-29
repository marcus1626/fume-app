// The plan handler without Supabase or the model: deno test supabase/functions/fume-plan/
import { assertEquals } from "jsr:@std/assert@1";
import { type Deps, handlePlan, type Written } from "./handler.ts";
import { type PlanAnswer, type PlanTask, prompt, toBody } from "./plan.ts";

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

function fake(opts: { canRead?: boolean; task?: PlanTask | null; answers?: Written[]; refusals?: string[] } = {}) {
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
    },
    write: async (_t, problem) => {
      calls.push(`write${problem ? ` (${problem})` : ""}`);
      return answers.shift()!;
    },
    toBody,
    later: (p) => work.push(p),
  });
  return { calls, deps, done: () => Promise.all(work) };
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
