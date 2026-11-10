import { assert, assertEquals } from "jsr:@std/assert@1";
import { closedAddress, openFetch, publicUrl, signedIn } from "./net.ts";

Deno.test("private, local and metadata addresses are closed; public ones open", () => {
  for (const a of [
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "[::1]",
    "::",
    "fd00::1",
    "fe80::1",
    "::ffff:10.0.0.1",
    "::ffff:a9fe:a9fe",
  ])
    assert(closedAddress(a), a);
  for (const a of ["8.8.8.8", "172.32.0.1", "151.101.1.1", "2606:4700::1111"]) assert(!closedAddress(a), a);
});

Deno.test("only plain web addresses on public hosts pass", () => {
  for (const u of [
    "http://localhost/",
    "https://127.0.0.1/",
    "https://2130706433/",
    "https://0x7f000001/",
    "https://[::1]/",
    "https://metadata.google.internal/",
    "https://printer.local/",
    "https://intranet/",
    "file:///etc/passwd",
    "https://halm.no:8080/",
    "https://user:pw@halm.no/",
  ])
    assertEquals(publicUrl(u), undefined, u);
  assertEquals(publicUrl("https://halm.no/products")?.href, "https://halm.no/products");
});

const resolve = (map: Record<string, string[]>) => (host: string, type: "A" | "AAAA") =>
  Promise.resolve(type === "A" ? (map[host] ?? []) : []);

Deno.test("a redirect or a name that leads to a closed address is not followed", async () => {
  const seen: string[] = [];
  const web = (routes: Record<string, Response>) =>
    ((url: string) => {
      seen.push(url);
      return Promise.resolve(routes[url] ?? new Response("missing", { status: 404 }));
    }) as typeof fetch;
  const open = { "halm.no": ["151.101.1.1"], "evil.test": ["169.254.169.254"] };

  const ok = await openFetch(
    "https://halm.no/a",
    {},
    {
      fetch: web({
        "https://halm.no/a": new Response(null, { status: 301, headers: { location: "/b" } }),
        "https://halm.no/b": new Response("hello"),
      }),
      resolve: resolve(open),
    },
  );
  assertEquals(await ok?.text(), "hello");
  assertEquals(ok?.url, "https://halm.no/b");

  seen.length = 0;
  const bounced = await openFetch(
    "https://halm.no/x",
    {},
    {
      fetch: web({
        "https://halm.no/x": new Response(null, { status: 302, headers: { location: "http://10.0.0.1/" } }),
      }),
      resolve: resolve(open),
    },
  );
  assertEquals(bounced, null);
  assertEquals(seen, ["https://halm.no/x"]);

  seen.length = 0;
  assertEquals(await openFetch("https://evil.test/", {}, { fetch: web({}), resolve: resolve(open) }), null);
  assertEquals(seen, []);
});

Deno.test("a token is asked of Supabase Auth, not judged by its shape", async () => {
  const auth = (user: unknown) => ({ auth: { getUser: () => Promise.resolve({ data: { user } }) } });
  assertEquals(await signedIn(auth({ id: "u" }), "Bearer a.b.c"), true);
  assertEquals(await signedIn(auth(null), "Bearer a.b.c"), false);
  assertEquals(await signedIn(auth({ id: "u" }), "Bearer nonsense"), false);
  assertEquals(await signedIn(auth({ id: "u" }), ""), false);
});
