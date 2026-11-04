import { test } from "node:test";
import assert from "node:assert/strict";
import { handleShot, publicPage, VIEWS } from "../src/shot.ts";

const host = "abc.supabase.co";
const up = (n: number) => `https://${host}/storage/v1/object/upload/sign/workspace-files/w/shots/${n}.jpg?token=t`;
const post = (b: unknown) => new Request("https://x/api/shot", { method: "POST", body: JSON.stringify(b) });

test("only a public web page is opened", () => {
  assert.ok(publicPage("https://www.nike.com/no"));
  for (const bad of ["http://localhost:3000", "https://127.0.0.1/", "http://[::1]/", "https://10.0.0.4/x", "file:///etc/passwd", "https://intranet/", "https://a.b.internal/", "https://u:p@site.com/", "https://site.com:8443/"]) {
    assert.equal(publicPage(bad), null, bad);
  }
});

test("a page is screenshotted only with signed links to store every view in Fume's storage", async () => {
  let opened = 0;
  const puts: string[] = [];
  const deps = {
    storageHost: host,
    fetch: (async (url: string) => (puts.push(url), new Response("{}"))) as typeof fetch,
    capture: async () => (opened++, VIEWS.map(() => new Uint8Array([1, 2, 3]))),
  };
  assert.equal((await handleShot(post({ url: "https://www.nike.com/no", upload: [up(1)] }), deps)).status, 400);
  assert.equal((await handleShot(post({ url: "http://localhost", upload: VIEWS.map((_, i) => up(i)) }), deps)).status, 400);
  assert.equal(opened, 0, "nothing is opened for a request that is turned away");
  const res = await handleShot(post({ url: "https://www.nike.com/no", upload: VIEWS.map((_, i) => up(i)) }), deps);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).shots.length, VIEWS.length);
  assert.deepEqual(puts, VIEWS.map((_, i) => up(i)));
});
