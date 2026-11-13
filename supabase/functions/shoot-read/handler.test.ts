// deno test --no-lock supabase/functions/shoot-read/handler.test.ts
// All models, storage and Supabase calls are fake; no secrets or provider requests.
import { handleShootRead, readShoot, type Deps, type Entry, type Input, LIMITS } from "./handler.ts";
const assert = (ok: unknown, why = "Assertion failed") => {
  if (!ok) throw new Error(why);
};
const eq = (a: unknown, b: unknown) =>
  assert(JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} != ${JSON.stringify(b)}`);
const ID = "10000000-0000-0000-0000-000000000001";
const post = (body: unknown) => new Request("https://x", { method: "POST", body: JSON.stringify(body) });
const call = { task: "shoot_assess", model: "fake-cheap", provider: "fake", latencyMs: 1, costUsd: 0.01 };
function setup(count = 3) {
  const input: Input = {
    id: ID,
    workspaceId: "ws",
    state: "reading",
    rights: { people: "none", consentYes: false, until: null },
    look: { light: "warm" },
    products: [
      { id: "pr", name: "Bottle", facts: [], campaignIds: ["campaign"], pictures: [{ bucket: "b", path: "product" }] },
    ],
    pictures: Array.from({ length: count }, (_, n) => ({
      id: `p${n}`,
      number: n + 1,
      kind: "photo",
      bucket: "b",
      path: `p${n}`,
    })),
  };
  const calls: string[] = [],
    costs: unknown[] = [],
    saved: { entries: Entry[]; done: boolean }[] = [],
    works: Promise<unknown>[] = [];
  let takes = 0,
    releases = 0;
  const d: Deps = {
    canRead: async () => true,
    input: async () => input,
    take: async () => {
      takes++;
      return { token: "lease", entries: [] };
    },
    budget: async () => true,
    reserve: async () => true,
    stop: async () => {},
    sign: async (p) => p.path ?? p.url!,
    assess: async (i, url, products) => {
      assert(i.look && products[0].urls[0] === "product", "brand and product vision context missing");
      calls.push(url);
      return {
        read: { sort: "pick", why: "Sharp label, warm light.", sharp: true, look: 92, productId: "pr" },
        quality: 80 + Number(url.slice(1)),
        call,
      };
    },
    compare: async (url, refs) => {
      calls.push(`group:${url}`);
      return { like: refs[0]?.id ?? null, why: "Same setup, a small change in view", call };
    },
    cost: async (_id, _token, usage, error) => {
      costs.push({ usage, error });
    },
    save: async (_id, _token, entries, done) => {
      saved.push({ entries: structuredClone(entries), done });
      return true;
    },
    release: async () => {
      releases++;
    },
    later: (work) => works.push(work),
  };
  return { input, d, calls, costs, saved, works, takes: () => takes, releases: () => releases };
}
Deno.test("auth, method, id and rights are checked before claiming, signing or asking models", async () => {
  const t = setup();
  eq((await handleShootRead(post({ shootId: ID }), { ...t.d, canRead: async () => false })).status, 404);
  eq((await handleShootRead(post({ shootId: "bad" }), t.d)).status, 400);
  eq((await handleShootRead(new Request("https://x"), t.d)).status, 405);
  eq((await handleShootRead(new Request("https://x", { method: "OPTIONS" }), t.d)).status, 200);
  for (const rights of [
    { people: "unsure", consentYes: false, until: null },
    { people: "released", consentYes: false, until: null },
    { people: "none", consentYes: false, until: "2000-01-01" },
  ]) {
    t.input.rights = rights;
    eq((await handleShootRead(post({ shootId: ID }), t.d)).status, 409);
  }
  eq(t.takes(), 0);
  eq(t.calls, []);
});
Deno.test(
  "accepted work runs in the background, groups near copies and keeps the strongest representative",
  async () => {
    const t = setup();
    eq((await handleShootRead(post({ shootId: ID }), t.d)).status, 202);
    await Promise.all(t.works);
    const last = t.saved.at(-1)!;
    eq(last.done, true);
    eq(
      last.entries.map((e) => [e.id, e.read.sort, e.read.like]),
      [
        ["p0", "out", "p2"],
        ["p1", "out", "p2"],
        ["p2", "pick", undefined],
      ],
    );
    eq(last.entries[2].read.productName, "Bottle");
    eq(t.costs.length, 5);
    eq(t.releases(), 1);
  },
);
Deno.test("clips never go to vision; unsupported originals stay for an expert", async () => {
  const t = setup();
  t.input.pictures[0].kind = "clip";
  t.input.pictures[1].contentType = "image/heic";
  await readShoot(ID, "lease", [], t.d);
  eq(t.calls, ["p2"]);
  eq(
    t.saved.at(-1)!.entries.map((e) => e.read.sort),
    ["rest", "rest", "pick"],
  );
});
Deno.test(
  "a used budget never claims work; exhaustion between calls keeps checkpoints and releases the lease",
  async () => {
    const t = setup();
    eq((await handleShootRead(post({ shootId: ID }), { ...t.d, budget: async () => false })).status, 429);
    eq(t.takes(), 0);
    t.d.budget = async () => t.costs.length < 1;
    await readShoot(ID, "lease", [], t.d);
    eq(t.calls, ["p0"]);
    eq(t.saved.at(-1)!.done, false);
    eq(t.saved.at(-1)!.entries.length, 1);
    eq(t.releases(), 1);
    t.d.budget = async () => true;
    await readShoot(ID, "next-lease", t.saved.at(-1)!.entries, t.d);
    eq(t.calls.filter((c) => c === "p0").length, 1);
    eq(t.saved.at(-1)!.done, true);
  },
);
Deno.test("failed or malformed model answers retain usage, never finish, and remain retryable", async () => {
  const t = setup();
  t.d.assess = async () => {
    throw Object.assign(new Error("cut off"), { call });
  };
  await readShoot(ID, "lease", [], t.d);
  eq(t.costs.length, 1);
  eq(t.saved, []);
  eq(t.releases(), 1);
  t.d.assess = async () => ({ read: { sort: "pick", sharp: true, why: "" }, quality: 80, call });
  await readShoot(ID, "lease", [], t.d);
  eq(t.costs.length, 2);
  eq(t.saved, []);
});
Deno.test("rights changed during work prevent the next model and completing the shoot", async () => {
  const t = setup();
  const cost = t.d.cost;
  t.d.cost = async (...args) => {
    await cost(...args);
    t.input.rights.people = "unsure";
  };
  // SQL independently refuses this checkpoint when rights have changed.
  t.d.save = async () => false;
  await readShoot(ID, "lease", [], t.d);
  eq(t.calls, ["p0"]);
  eq(t.saved, []);
  eq(t.releases(), 1);
});
Deno.test(
  "look and product identity are omitted without evidence, and a weaker near copy does not replace the winner",
  async () => {
    const t = setup(2);
    t.input.look = null;
    t.d.assess = async (_i, url) => ({
      read: { sort: "pick", sharp: true, why: "Sharp", look: 95, productId: "invented", productName: "Invented" },
      quality: url === "p0" ? 90 : 70,
      call,
    });
    await readShoot(ID, "lease", [], t.d);
    const entries = t.saved.at(-1)!.entries;
    eq(entries[0].read, { sort: "pick", sharp: true, why: "Sharp" });
    eq(entries[1].read.like, "p0");
  },
);
Deno.test("group comparison selects nearest representatives and rejects hallucinated ids", async () => {
  const t = setup(8);
  t.d.compare = async (_url, others) => {
    t.calls.push(others.map((p) => p.id).join(","));
    return { like: others.some((p) => p.id === "p6") ? "p6" : null, why: "Same setup", call };
  };
  const prior: Entry[] = t.input.pictures
    .slice(0, 7)
    .map((p) => ({ id: p.id, read: { sort: "pick", sharp: true, why: "Sharp" }, quality: 80 }));
  await readShoot(ID, "lease", prior, t.d);
  assert(t.calls.includes("p6"));
  eq(t.saved.at(-1)!.entries[6].read.like, "p7");
  const bad = setup(2);
  bad.d.compare = async () => ({ like: "not-in-shoot", why: "x", call });
  await readShoot(ID, "lease", [], bad.d);
  eq(bad.saved.at(-1)!.done, false);
  eq(bad.costs.length, 3);
});
Deno.test("an existing lease or a completed shoot never starts duplicate work", async () => {
  const t = setup();
  t.d.take = async () => null;
  eq((await handleShootRead(post({ shootId: ID }), t.d)).status, 200);
  t.input.state = "checked";
  eq((await handleShootRead(post({ shootId: ID }), t.d)).status, 200);
  eq(t.calls, []);
  eq(t.works, []);
});

Deno.test(
  "an unusable photograph cannot displace a viable group representative, even with a higher quality score",
  async () => {
    const t = setup(2);
    t.d.assess = async (_i, url) => ({
      read: {
        sort: url === "p0" ? "pick" : "out",
        sharp: url === "p0",
        why: url === "p0" ? "Sharp label" : "Product is cropped out",
      },
      quality: url === "p0" ? 80 : 99,
      call,
    });
    await readShoot(ID, "lease", [], t.d);
    const entries = t.saved.at(-1)!.entries;
    eq(entries[0].read.sort, "pick");
    eq(entries[1].read.like, "p0");
  },
);

Deno.test("reference-shoot rights withdrawn mid-read remove the reference from the next assessment", async () => {
  const t = setup(2),
    seen: string[][] = [],
    signed: string[] = [];
  t.d.sign = async (p) => {
    signed.push(p.path!);
    return p.path!;
  };
  t.d.assess = async (_input, _url, products) => {
    seen.push(products.flatMap((p) => p.urls));
    return { read: { sort: "pick", sharp: true, why: "Sharp" }, quality: 80, call };
  };
  const cost = t.d.cost;
  t.d.cost = async (...args) => {
    await cost(...args);
    // Fake the fresh rights-filtered RPC response, while the MAIN shoot remains usable.
    t.input.products[0].pictures = [];
  };
  await readShoot(ID, "lease", [], t.d);
  eq(seen, [["product"], []]);
  eq(signed.filter((p) => p === "product").length, 1);
  eq(t.saved.at(-1)!.done, true);
});

Deno.test("budget stop between assessment and comparison resumes without paying for assessment twice", async () => {
  const t = setup(2);
  t.d.budget = async () => t.costs.length < 2;
  await readShoot(ID, "lease", [], t.d);
  eq(t.calls, ["p0", "p1"]);
  const entries = t.saved.at(-1)!.entries;
  eq(entries[1].comparison, { ids: ["p0"], next: 0, done: false });
  t.d.budget = async () => true;
  await readShoot(ID, "next", entries, t.d);
  eq(t.calls, ["p0", "p1", "group:p1"]);
  eq(t.saved.at(-1)!.done, true);
});

Deno.test("time stop between comparisons saves position and never repeats a paid comparison", async () => {
  const t = setup(4);
  let time = 0;
  t.d.now = () => time;
  t.d.compare = async (_url, refs) => {
    t.calls.push(refs[0].id);
    time += LIMITS.timeMs;
    return { like: null, why: "Different", call };
  };
  const prior: Entry[] = t.input.pictures
    .slice(0, 3)
    .map((p) => ({ id: p.id, read: { sort: "pick", sharp: true, why: "Sharp" }, quality: 80 }));
  await readShoot(ID, "lease", prior, t.d);
  eq(t.calls, ["p3", "p2"]);
  eq(t.saved.at(-1)!.entries[3].comparison?.next, 1);
  await readShoot(ID, "next", t.saved.at(-1)!.entries, t.d);
  eq(t.calls, ["p3", "p2", "p1"]);
  await readShoot(ID, "third", t.saved.at(-1)!.entries, t.d);
  eq(t.calls, ["p3", "p2", "p1", "p0"]);
  eq(t.saved.at(-1)!.done, true);
});

Deno.test("500 distinct photographs obey lifetime call and spend limits across resumes", async () => {
  const t = setup(500);
  let reserved = 0,
    stopped = false;
  t.d.assess = async (_input, url) => {
    t.calls.push(url);
    return { read: { sort: "pick", sharp: true, why: "Sharp" }, quality: 80, call };
  };
  t.d.compare = async (_url, refs) => {
    assert(refs.length <= LIMITS.representatives);
    t.calls.push("compare");
    return { like: null, why: "Distinct", call };
  };
  t.d.reserve = async () => {
    if (reserved >= LIMITS.calls || (reserved + 1) * LIMITS.reserveUsd > LIMITS.spendUsd) return false;
    reserved++;
    return true;
  };
  t.d.stop = async () => {
    stopped = true;
  };
  // Multiple worker invocations share the same persistent reservation counter.
  t.d.budget = async () => t.calls.length < 20;
  await readShoot(ID, "first", [], t.d);
  t.d.budget = async () => true;
  await readShoot(ID, "next", t.saved.at(-1)!.entries, t.d);
  assert(stopped);
  assert(t.calls.length <= LIMITS.calls);
  eq(t.calls.length, Math.floor(LIMITS.spendUsd / LIMITS.reserveUsd));
  assert(t.calls.length * LIMITS.reserveUsd <= LIMITS.spendUsd);
  eq(t.saved.at(-1)!.done, false);
});

Deno.test("exact hashes group before payment; different hashes still get assessed", async () => {
  const t = setup(3);
  t.input.pictures[0].sha256 = "same";
  t.input.pictures[1].sha256 = "same";
  t.input.pictures[2].sha256 = "different";
  await readShoot(ID, "lease", [], t.d);
  eq(
    t.calls.filter((c) => c === "p1"),
    [],
  );
  assert(t.calls.includes("p2"));
});
