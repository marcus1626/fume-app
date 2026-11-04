import { test } from "node:test";
import assert from "node:assert/strict";
import { handleShot, publicPage, safeSvg, VIEWS } from "../src/shot.ts";

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
    capture: async () => (opened++, { shots: VIEWS.map(() => new Uint8Array([1, 2, 3])) }),
  };
  assert.equal((await handleShot(post({ url: "https://www.nike.com/no", upload: [up(1)] }), deps)).status, 400);
  assert.equal((await handleShot(post({ url: "http://localhost", upload: VIEWS.map((_, i) => up(i)) }), deps)).status, 400);
  assert.equal(opened, 0, "nothing is opened for a request that is turned away");
  const res = await handleShot(post({ url: "https://www.nike.com/no", upload: VIEWS.map((_, i) => up(i)) }), deps);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).shots.length, VIEWS.length);
  assert.deepEqual(puts, VIEWS.map((_, i) => up(i)));
});

test("the header's logo is kept as a safe SVG beside the screenshots", async () => {
  const puts: { url: string; type: string | null; body: string }[] = [];
  const logo = `https://${host}/storage/v1/object/upload/sign/workspace-files/w/brand/logo/b-site?token=t`;
  const deps = {
    storageHost: host,
    fetch: (async (url: string, init?: RequestInit) => {
      puts.push({ url, type: new Headers(init?.headers).get("content-type"), body: init?.body ? await new Response(init.body).text() : "" });
      return new Response("{}");
    }) as typeof fetch,
    capture: async () => ({
      shots: VIEWS.map(() => new Uint8Array([1])),
      logo: { svg: '<svg viewBox="0 0 10 10" onload="alert(1)"><script>alert(2)</script><path d="M0 0h10v10z" fill="rgb(17, 17, 17)"/></svg>' },
    }),
  };
  const res = await handleShot(post({ url: "https://www.nike.com/no", upload: VIEWS.map((_, i) => up(i)), logo }), deps);
  const body = await res.json();
  assert.equal(body.logo.from, "svg");
  const kept = puts.find((p) => p.url === logo)!;
  assert.equal(kept.type, "image/svg+xml");
  assert.ok(!/script|onload/.test(kept.body), "nothing that runs is kept");
  assert.ok(kept.body.includes("<path"));
  assert.equal((await handleShot(post({ url: "https://www.nike.com/no", upload: VIEWS.map((_, i) => up(i)), logo: "https://evil.example/x" }), deps)).status, 400);
});

test("an SVG that is not one, or links out, is not kept", () => {
  assert.equal(safeSvg("<html><svg></svg></html>"), null);
  assert.ok(!safeSvg('<svg><a href="https://x.example"><path d="M0 0"/></a></svg>')!.includes("x.example"));
  assert.ok(safeSvg('<svg><use href="#a"/></svg>')!.includes('href="#a"'));
});
