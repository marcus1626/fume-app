// The live backend shares a read asked for twice at once, and forgets it after any change (api/live/supabase.ts).
// Run: npm test.
/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "vitest";
import { forgetReads, rows } from "../src/api/live/supabase";

/** A stand-in for a Supabase read: a GET to an address, counting how often it really runs. */
function read(address: string, counter: { n: number }, method = "GET") {
  const run = () => {
    counter.n += 1;
    return Promise.resolve({ data: [{ n: counter.n }], error: null });
  };
  const builder = {
    url: new URL(address),
    method,
    headers: new Headers({ Accept: "application/json" }),
    then: (ok?: (v: unknown) => unknown, fail?: (e: unknown) => unknown) => run().then(ok, fail),
  };
  return builder as unknown as PromiseLike<{ data: { n: number }[]; error: null }>;
}

test("the same read at the same moment runs once", async () => {
  forgetReads();
  const c = { n: 0 };
  const [a, b] = await Promise.all([
    rows(read("https://x.test/rest/v1/campaigns?a=1", c)),
    rows(read("https://x.test/rest/v1/campaigns?a=1", c)),
  ]);
  assert.equal(c.n, 1);
  assert.deepEqual(a, b);
});

test("another read, or a change, is never shared", async () => {
  forgetReads();
  const c = { n: 0 };
  await rows(read("https://x.test/rest/v1/campaigns?a=1", c));
  await rows(read("https://x.test/rest/v1/campaigns?a=2", c));
  await rows(read("https://x.test/rest/v1/rpc/approve", c, "POST"));
  await rows(read("https://x.test/rest/v1/rpc/approve", c, "POST"));
  assert.equal(c.n, 4);
});

test("after forgetting, the read runs again", async () => {
  forgetReads();
  const c = { n: 0 };
  await rows(read("https://x.test/rest/v1/plans?a=1", c));
  forgetReads();
  await rows(read("https://x.test/rest/v1/plans?a=1", c));
  assert.equal(c.n, 2);
});
