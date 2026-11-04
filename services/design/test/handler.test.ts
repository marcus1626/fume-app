import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { handle, signedLink } from "../src/handler.ts";
import { type DesignBook } from "../src/book.ts";

const host = "abc.supabase.co";
const book = JSON.parse(await readFile(new URL("./fixtures/book.json", import.meta.url), "utf8")) as DesignBook;
const read = `https://${host}/storage/v1/object/sign/workspace-files/w/p.png?token=t`;
const up = (n: string) => `https://${host}/storage/v1/object/upload/sign/workspace-files/w/${n}?token=t`;
const body = { picture: read, format: "feed", book, words: { headline: "Hi" }, upload: { png: up("a.png"), fig: up("a.fig") } };
const post = (b: unknown) => new Request("https://x/api/design", { method: "POST", body: JSON.stringify(b) });

const fake = () => {
  const puts: string[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      puts.push(url);
      return new Response("{}", { status: 200 });
    }
    return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } });
  }) as typeof fetch;
  return { f, puts };
};
const designed = async () => ({
  png: new Uint8Array([9]), fig: new Uint8Array([8, 8]), width: 1080, height: 1350, ok: true, checks: [], boxes: {},
  tried: 1, attempts: [], fonts: [], ms: 1,
  layout: { band: "top", align: "left", headline: "h1", colour: "on_photo", ground: "photo", cta: "none", columns: 9 },
}) as never;

test("only signed links to Fume's own storage are taken", () => {
  assert.ok(signedLink(read, host, "read"));
  assert.ok(!signedLink(read.replace(host, "evil.example"), host, "read"));
  assert.ok(!signedLink(read.replace("?token=t", ""), host, "read"));
  assert.ok(!signedLink(up("a.png"), host, "read"));
  assert.ok(signedLink(up("a.png"), host, "upload"));
});

test("a request from anyone else is turned away before any work", async () => {
  const { f } = fake();
  let ran = false;
  const deps = { storageHost: host, fetch: f, design: async () => ((ran = true), designed()) };
  assert.equal((await handle(post({ ...body, picture: "https://evil.example/x.png" }), deps)).status, 400);
  assert.equal((await handle(post({ ...body, upload: { png: "https://evil.example/a" } }), deps)).status, 400);
  assert.equal((await handle(post({ ...body, words: { headline: " " } }), deps)).status, 400);
  assert.equal((await handle(new Request("https://x", { method: "GET" }), deps)).status, 405);
  assert.ok(!ran);
});

test("the result is stored through the signed links and only its numbers come back", async () => {
  const { f, puts } = fake();
  const res = await handle(post(body), { storageHost: host, fetch: f, design: designed });
  assert.equal(res.status, 200);
  const out = await res.json();
  assert.deepEqual(puts.sort(), [up("a.fig"), up("a.png")].sort());
  assert.equal(out.png.bytes, 1);
  assert.equal(out.fig.bytes, 2);
  assert.match(out.png.sha256, /^[0-9a-f]{64}$/);
  assert.ok(!("data" in out.png));
});
