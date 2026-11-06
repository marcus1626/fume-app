import { assertEquals } from "jsr:@std/assert@1";
import { handleLearn, pictureUrl } from "./handler.ts";

const flat = (r: number, g: number, b: number) => {
  const data = new Uint8ClampedArray(32 * 32 * 4);
  for (let i = 0; i < 32 * 32; i++) data.set([r, g, b, 255], i * 4);
  return { width: 32, height: 32, data };
};

Deno.test(
  "pictures are measured and saved by the service, one that fails says why, the app's own are asked for",
  async () => {
    let saved: unknown[] = [];
    const pending = () =>
      Promise.resolve({
        data: [
          { id: "a", url: "/demo/look.jpg", bucket: null, path: null },
          { id: "b", url: null, bucket: "workspace-files", path: "ws/x.png" },
          { id: "c", url: "http://localhost/x.jpg", bucket: null, path: null },
        ],
      });
    const deps = {
      pending,
      sign: (bucket: string, path: string) => Promise.resolve(`https://store.test/${bucket}/${path}`),
      fetchImage: (u: string) => Promise.resolve(u.startsWith("https://") ? new Uint8Array([1]) : null),
      decode: () => Promise.resolve(flat(60, 40, 25)),
      save: (_ws: string, m: unknown[]) => {
        saved = m;
        return Promise.resolve({ data: { do: [] } });
      },
    };
    const first = await handleLearn(
      new Request("https://x/", { method: "POST", body: JSON.stringify({ workspaceId: "ws" }) }),
      true,
      deps,
    );
    const one = await first.json();
    assertEquals([one.measured, one.send], [1, ["/demo/look.jpg"]]);
    assertEquals(saved.length, 2);
    const res = await handleLearn(
      new Request("https://x/", {
        method: "POST",
        body: JSON.stringify({ workspaceId: "ws", pictures: { "/demo/look.jpg": btoa("\xff\xd8") } }),
      }),
      true,
      deps,
    );
    assertEquals(res.status, 200);
    const two = await res.json();
    assertEquals([two.measured, two.send], [2, []]);
    assertEquals((saved[2] as { error: string }).error, "No address Fume may open");
    assertEquals(typeof (saved[0] as { v: Record<string, number> }).v["light.key"], "number");
  },
);

Deno.test("only https pictures on public hosts; Shopify is asked for a JPEG", () => {
  assertEquals(pictureUrl("http://halm.test/a.jpg"), undefined);
  assertEquals(pictureUrl("https://192.168.1.2/a.jpg"), undefined);
  assertEquals(
    pictureUrl("https://cdn.shopify.com/s/files/a.webp"),
    "https://cdn.shopify.com/s/files/a.webp?format=pjpg&width=512",
  );
});

Deno.test("someone who may not read the brand is told so", async () => {
  const res = await handleLearn(
    new Request("https://x/", { method: "POST", body: JSON.stringify({ workspaceId: "ws" }) }),
    true,
    {
      pending: () => Promise.resolve({ error: { code: "not_found", message: "No such brand." } }),
      sign: () => Promise.resolve(null),
      fetchImage: () => Promise.resolve(null),
      decode: () => Promise.resolve(null),
      save: () => Promise.resolve({}),
    },
  );
  assertEquals(res.status, 404);
});
