import { assertEquals } from "jsr:@std/assert@1";
import { type Deps, handleLink } from "./handler.ts";

const TOKEN = "a".repeat(44);
const post = (body: unknown) => new Request("http://x", { method: "POST", body: JSON.stringify(body) });

function deps(over: Partial<Deps> = {}): Deps & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    caller: () => Promise.resolve(null),
    view: () =>
      Promise.resolve({
        data: { creatives: [{ creative_versions: [{ files: { id: "f1", path: "w/a.jpg" } }, { files: null }] }] },
      }),
    answer: (a) => (calls.push(a), Promise.resolve({ data: { id: a.versionId, state: "approved" } })),
    plan: (a) => (calls.push(a), Promise.resolve({ data: { state: "approved" } })),
    sign: (paths) => Promise.resolve(Object.fromEntries(paths.map((p) => [p, `https://signed/${p}`]))),
    ...over,
  };
}

Deno.test("the link opens what was sent, with signed pictures by file", async () => {
  const res = await handleLink(post({ action: "view", token: TOKEN }), deps());
  assertEquals(res.status, 200);
  assertEquals((await res.json()).urls, { f1: "https://signed/w/a.jpg" });
});

Deno.test("a made-up token opens nothing, without asking the database", async () => {
  let asked = false;
  const res = await handleLink(
    post({ action: "view", token: "x" }),
    deps({ view: () => ((asked = true), Promise.resolve({ data: { creatives: [] } })) }),
  );
  assertEquals([res.status, asked], [404, false]);
});

Deno.test("a refusal keeps its code and words", async () => {
  const res = await handleLink(
    post({ action: "view", token: TOKEN }),
    deps({ view: () => Promise.resolve({ error: { code: "not_found", message: "This client link has expired." } }) }),
  );
  assertEquals([res.status, (await res.json()).message], [404, "This client link has expired."]);
});

Deno.test(
  "the answer goes in with the signed-in caller, so the agency's preview is refused by the database",
  async () => {
    const d = deps({ caller: () => Promise.resolve("u-nora") });
    const res = await handleLink(
      post({ action: "answer", token: TOKEN, versionId: "v1", verdict: "approve", name: " Sara " }),
      d,
    );
    assertEquals(res.status, 200);
    assertEquals(d.calls, [
      { token: TOKEN, versionId: "v1", verdict: "approve", text: null, name: "Sara", caller: "u-nora" },
    ]);
  },
);

Deno.test("the plan is answered through the same link", async () => {
  const d = deps();
  const res = await handleLink(post({ action: "plan", token: TOKEN, verdict: "changes", text: "Warmer" }), d);
  assertEquals([res.status, (await res.json()).plan.state], [200, "approved"]);
  assertEquals((d.calls[0] as { text: string }).text, "Warmer");
});

Deno.test("an answer names the creative", async () => {
  const res = await handleLink(post({ action: "answer", token: TOKEN, verdict: "approve" }), deps());
  assertEquals(res.status, 400);
});
