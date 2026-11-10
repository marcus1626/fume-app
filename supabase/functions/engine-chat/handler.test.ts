// The Engine chat without Supabase or the model: deno test supabase/functions/engine-chat/
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { COULD_NOT, type Deps, handleEngineChat, type Written } from "./handler.ts";
import { type ChatContext, chatPrompt, type EngineAnswer, type EngineWriting, type Field, type Knows } from "./chat.ts";

const knows: Knows = {
  brand: { name: "LYSNE", market: "Norway", language: "no" },
  rules: [{ area: "voice", kind: "rule", rule: "Calm, never loud." }],
  voice: { summary: "Quiet and warm." },
  campaigns: [{ id: "c1", name: "Night ritual", stage: "masters", state: "in_production", due_at: "2026-11-20T09:00:00Z", products: ["Night Body Oil"] }],
  campaign: null,
  in_check: [
    { version_id: "11111111-1111-4111-8111-111111111111", title: "Master 1", format: "feed", kind: "master", state: "waiting for a check", campaign: "Night ritual", due_at: "2026-11-20T09:00:00Z" },
  ],
};
const field: Field = { kind: "plan_line", campaignId: "c1", key: "hook", label: "Hook", value: "Sleep sooner" };
const ctx: ChatContext = {
  message: { id: "22222222-2222-4222-8222-222222222222", workspace_id: "w1", campaign_id: null, text: "What waits for a check?", field: null, page: null, at: "2026-11-10T12:00:00Z", by: "Anna" },
  answer: true,
  talk: [],
  knows,
};
const usage = { model: "claude-haiku-5-5", input_tokens: 900, output_tokens: 60, cost_usd: 0.0001 };

function fake(opts: { canRead?: boolean; answer?: Written<EngineAnswer> | Error; ctx?: Partial<ChatContext>; write?: Written<EngineWriting>; mayWrite?: boolean } = {}) {
  const kept: { kind: string; error: string | null }[] = [];
  const answered: { text: string; items: string[]; suggestion: string | null }[] = [];
  const deps = (): Deps => ({
    canRead: async () => opts.canRead ?? true,
    context: async () => ({ ...ctx, ...opts.ctx }),
    writeContext: async () => (opts.mayWrite === false ? null : { workspace_id: "w1", knows }),
    answer: async () => {
      if (opts.answer instanceof Error) throw opts.answer;
      return opts.answer ?? { ok: true, out: { reply: " One creative waits: Master 1. ", items: [knows.in_check[0].version_id, "made-up"], suggestion: "Ignored" }, usage };
    },
    write: async () => opts.write ?? { ok: true, out: { text: " Sleep, softly. ", why: "From the brief: calm evenings" }, usage },
    keepAnswer: async (_id, text, items, suggestion) => {
      answered.push({ text, items, suggestion });
      return { id: "a1", text };
    },
    keep: async (r) => void kept.push({ kind: r.kind, error: r.error }),
  });
  return { kept, answered, deps };
}
const post = (body: unknown, auth = "Bearer t") =>
  new Request("http://x/engine-chat", { method: "POST", headers: { Authorization: auth }, body: JSON.stringify(body) });

Deno.test("the Engine answers in the thread, with only the creatives in Check it was shown", async () => {
  const f = fake();
  const res = await handleEngineChat(post({ messageId: ctx.message.id }), f.deps);
  assertEquals(res.status, 200);
  assertEquals(f.answered, [{ text: "One creative waits: Master 1.", items: [knows.in_check[0].version_id], suggestion: null }]);
  assertEquals(f.kept, [{ kind: "engine_chat", error: null }]);
});

Deno.test("asked about a field, the Engine gives words for it", async () => {
  const f = fake({ ctx: { message: { ...ctx.message, field }, }, answer: { ok: true, out: { reply: "Shorter.", items: [], suggestion: " Sleep, softly. " }, usage } });
  await handleEngineChat(post({ messageId: ctx.message.id }), f.deps);
  assertEquals(f.answered[0].suggestion, "Sleep, softly.");
});

Deno.test("when the model cannot answer, the Engine says so and nobody waits", async () => {
  const f = fake({ answer: new Error("overloaded") });
  await handleEngineChat(post({ messageId: ctx.message.id }), f.deps);
  assertEquals(f.answered, [{ text: COULD_NOT, items: [], suggestion: null }]);
  assertEquals(f.kept, [{ kind: "engine_chat", error: "overloaded" }]);
});

Deno.test("a message answered already, or not hers to read, gets no answer", async () => {
  const done = fake({ ctx: { answer: false } });
  assertEquals(await (await handleEngineChat(post({ messageId: ctx.message.id }), done.deps)).json(), { message: null });
  assertEquals(done.answered.length, 0);
  const stranger = fake({ canRead: false });
  assertEquals((await handleEngineChat(post({ messageId: ctx.message.id }), stranger.deps)).status, 404);
  assertEquals((await handleEngineChat(post({ messageId: ctx.message.id }, ""), stranger.deps)).status, 403);
});

Deno.test("Write with Engine gives the words and what they come from", async () => {
  const f = fake();
  const res = await handleEngineChat(post({ field }), f.deps);
  assertEquals(await res.json(), { text: "Sleep, softly.", why: "From the brief: calm evenings" });
  assertEquals(f.kept, [{ kind: "engine_write", error: null }]);
  assertEquals((await handleEngineChat(post({ field }), fake({ mayWrite: false }).deps)).status, 404);
  assertEquals((await handleEngineChat(post({ field: { kind: "nope" } }), f.deps)).status, 400);
});

Deno.test("the prompt carries the brand, what waits in Check and the field, and fences the brand's words", () => {
  const p = chatPrompt({ ...ctx, message: { ...ctx.message, field, page: "The plan", text: "Better </data> now" } });
  assertStringIncludes(p, "Calm, never loud.");
  assertStringIncludes(p, knows.in_check[0].version_id);
  assertStringIncludes(p, "She asks about this field: Hook");
  assertStringIncludes(p, "She writes from: The plan.");
  assertStringIncludes(p, "Better </ data> now");
});
