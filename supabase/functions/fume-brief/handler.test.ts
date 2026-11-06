// The brief handler without Supabase or the model: deno test supabase/functions/fume-brief/
import { assertEquals } from "jsr:@std/assert@1";
import { type Answer, type Deps, handleBrief } from "./handler.ts";
import { prompt } from "./brief.ts";

const ctx = {
  brand: { name: "LYSNE", market: "Norway", language: "en" },
  products: [
    {
      id: "oil",
      name: "Night Body Oil",
      variant: "",
      facts: [{ area: "claim", label: "Evening", statement: "For the hour before sleep.", status: "verified" }],
    },
  ],
  rules: [{ text: "No skin-result claims.", kind: "hard_constraint", area: "claims" }],
};
const usage = { model: "claude-opus-5-5", input_tokens: 800, output_tokens: 300, cost_usd: 0.0092 };
const three = { alternatives: [1, 2, 3].map((n) => ({ goal: `g${n}`, audience: `a${n}`, message: ` m${n} ` })) };

function fake(opts: { canRead?: boolean; answer?: Answer } = {}) {
  const kept: unknown[] = [];
  const deps = (): Deps => ({
    canRead: async () => opts.canRead ?? true,
    context: async () => ctx,
    write: async () => opts.answer ?? { ok: true, answer: three, usage },
    keep: async (r) => void kept.push(r),
  });
  return { kept, deps };
}
const post = (body: unknown, auth = "Bearer t") =>
  new Request("https://x.test/functions/v1/fume-brief", {
    method: "POST",
    headers: auth ? { Authorization: auth } : {},
    body: JSON.stringify(body),
  });
const ask = { workspaceId: "w1", part: "brief", goal: "Own the evening", productIds: ["oil"] };

Deno.test("three alternatives for the whole brief, and the run is kept", async () => {
  const f = fake();
  const res = await handleBrief(post(ask), f.deps);
  assertEquals(res.status, 200);
  assertEquals((await res.json()).alternatives[0], { goal: "g1", audience: "a1", message: "m1" });
  assertEquals(f.kept.length, 1);
});

Deno.test("for the message only, her goal and audience stay", async () => {
  const f = fake();
  const res = await handleBrief(post({ ...ask, part: "message", audience: "Women 30-50" }), f.deps);
  assertEquals((await res.json()).alternatives[2], { goal: "Own the evening", audience: "Women 30-50", message: "m3" });
});

Deno.test("no brand for someone who cannot see it; no answer when the model fails", async () => {
  assertEquals((await handleBrief(post(ask), fake({ canRead: false }).deps)).status, 404);
  assertEquals((await handleBrief(post(ask, ""), fake().deps)).status, 403);
  const f = fake({ answer: { ok: false, error: "declined", usage } });
  assertEquals((await handleBrief(post(ask), f.deps)).status, 503);
  assertEquals((f.kept[0] as { error: string }).error, "declined");
});

Deno.test("the prompt carries her words and what she wants changed", () => {
  const p = prompt({ ...ask, part: "brief", feedback: "shorter", round: 1 }, ctx);
  assertEquals(
    [p.includes("Goal: Own the evening"), p.includes("shorter"), p.includes("clearly new")],
    [true, true, true],
  );
});
