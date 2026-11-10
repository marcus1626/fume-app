// The chat handler without Supabase or the model: deno test supabase/functions/fume-chat/
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { type Answer, type Deps, handleChat } from "./handler.ts";
import { type ChatContext, prompt } from "./chat.ts";

const ctx: ChatContext = {
  message: {
    id: "m1",
    thread_id: "t1",
    workspace_id: "w1",
    text: "Where is Night ritual?",
    at: "2026-11-03T12:00:00Z",
  },
  answer: true,
  brand: { name: "LYSNE", market: "Norway", language: "en" },
  customer: { name: "Maja Berg", role: "approver" },
  campaign_of_thread: null,
  talk: [{ from: "fume_person", name: "William", text: "Hi, William here.", at: "2026-11-02T09:00:00Z" }],
  campaigns: [
    {
      id: "c1",
      name: "Night ritual",
      stage: "plan",
      state: "scoped",
      due_at: "2026-11-20T09:00:00Z",
      brief_sent: true,
      plan: { version: 1, state: "ready" },
      products: ["Night Body Oil"],
      creatives: { in_check: 0, waiting_on_you: 0, changes_asked: 0, approved: 0, delivered: 0 },
    },
  ],
  products: [{ id: "p1", name: "Night Body Oil", confirmed: true, missing: [] }],
  people_at_fume: [{ name: "William Henriksson", title: "Founder & CSO", role: "account_manager" }],
};
const usage = { model: "claude-haiku-5-5", input_tokens: 1200, output_tokens: 80, cost_usd: 0.0002 };

function fake(opts: { canRead?: boolean; answer?: Answer | Error; ctx?: Partial<ChatContext> } = {}) {
  const kept: unknown[] = [];
  const answered: { text: string; card: unknown }[] = [];
  const deps = (): Deps => ({
    canRead: async () => opts.canRead ?? true,
    context: async () => ({ ...ctx, ...opts.ctx }),
    write: async () => {
      if (opts.answer instanceof Error) throw opts.answer;
      return (
        opts.answer ?? {
          ok: true,
          answer: { reply: " Night ritual's plan is ready for you. ", show: "plan", id: "c1", reason: null },
          usage,
        }
      );
    },
    answer: async (_id, text, card) => {
      answered.push({ text, card });
      return { id: "a1", text, card };
    },
    keep: async (r) => void kept.push(r),
  });
  return { kept, answered, deps };
}
const post = (body: unknown, auth = "Bearer t") =>
  new Request("https://x.test/functions/v1/fume-chat", {
    method: "POST",
    headers: auth ? { Authorization: auth } : {},
    body: JSON.stringify(body),
  });

Deno.test("Fume answers with a link to what she asked about, and the run is kept", async () => {
  const f = fake();
  const res = await handleChat(post({ messageId: "m1" }), f.deps);
  assertEquals(res.status, 200);
  assertEquals(f.answered, [
    { text: "Night ritual's plan is ready for you.", card: { kind: "link", link: { kind: "plan", campaignId: "c1" } } },
  ]);
  assertEquals((f.kept[0] as { error: unknown }).error, null);
});

Deno.test("a card that points at nothing in the facts is dropped", async () => {
  const f = fake({
    answer: { ok: true, answer: { reply: "Here.", show: "campaign", id: "c-other", reason: null }, usage },
  });
  await handleChat(post({ messageId: "m1" }), f.deps);
  assertEquals(f.answered[0].card, null);
});

Deno.test("a person takes over in Fume's own words", async () => {
  const f = fake({
    answer: {
      ok: true,
      answer: { reply: "Let me get someone.", show: "person", id: null, reason: "Packages are handled by people." },
      usage,
    },
  });
  await handleChat(post({ messageId: "m1" }), f.deps);
  assertEquals(f.answered[0], { text: "", card: { kind: "handover", reason: "Packages are handled by people." } });
});

Deno.test("when the model fails, a person takes over and the failure is kept", async () => {
  const f = fake({ answer: new Error("400 not scoped") });
  const res = await handleChat(post({ messageId: "m1" }), f.deps);
  assertEquals(res.status, 200);
  assertEquals((f.answered[0].card as { kind: string }).kind, "handover");
  assertEquals((f.kept[0] as { error: string }).error, "400 not scoped");
});

Deno.test("Fume stays quiet when it should not answer", async () => {
  const f = fake({ ctx: { answer: false } });
  const res = await handleChat(post({ messageId: "m1" }), f.deps);
  assertEquals(await res.json(), { message: null });
  assertEquals(f.answered.length, 0);
  assertEquals(f.kept.length, 0);
});

Deno.test("someone who cannot read the message gets nothing", async () => {
  const f = fake({ canRead: false });
  assertEquals((await handleChat(post({ messageId: "m1" }), f.deps)).status, 404);
  assertEquals((await handleChat(post({ messageId: "m1" }, ""), f.deps)).status, 403);
  assertEquals((await handleChat(post({}), f.deps)).status, 400);
});

Deno.test("the prompt holds the facts, the talk and her message", () => {
  const p = prompt(ctx);
  assertStringIncludes(p, "Night ritual");
  assertStringIncludes(p, "William at Fume: Hi, William here.");
  assertStringIncludes(p, "<her_message>\nWhere is Night ritual?");
});
