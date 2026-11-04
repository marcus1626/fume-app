import { assertEquals } from "jsr:@std/assert@1";
import { handleScan, siteUrl } from "./handler.ts";
import { colourName, readBrand } from "./read.ts";

const HOME = `<html><head><title>Halm Møbler | Chairs for good</title>
<meta name="description" content="Chairs made in Norway, to keep for good.">
<meta property="og:image" content="/img/hero.jpg">
<link rel="stylesheet" href="/site.css">
<style>h1 { font-family: "Canela", serif; font-weight: 300 } body { font-family: 'Graphik', Helvetica, sans-serif; color: #1a1a1a; background: #F5F0E8 }</style>
</head><body><header><img src="/logo.svg" alt="Halm logo"></header>
<h1>One chair, for good</h1><h2>Made in Oslo</h2>
<img src="/img/chair.jpg" width="1200" alt="The Studio chair in oak"><img src="/icons/cart.png" width="20">
<a href="/about">About</a><a href="https://other.test/about">x</a></body></html>`;
const CSS = `.btn{background:#A0784B}.btn:hover{background:#a0784b}.tag{color:#A0784B}.link{color:#2F5D50}.x{color:#2f5d50}`;

const req = (body: unknown) => new Request("http://x", { method: "POST", body: JSON.stringify(body) });

Deno.test("the reader finds the site's colours, typefaces, logo, pictures and words", () => {
  const r = readBrand(
    [{ url: "https://halm.test/", html: HOME, css: CSS + HOME.match(/<style>([\s\S]*?)<\/style>/)![1] }],
    "Halm",
  );
  assertEquals(
    r.colours.map((c) => [c.hex, c.role]),
    [
      ["#1A1A1A", "text"],
      ["#F5F0E8", "ground"],
      ["#A0784B", "primary"],
      ["#2F5D50", "accent"],
    ],
  );
  assertEquals(
    r.typefaces.map((t) => [t.name, t.role]),
    [
      ["Canela", "display"],
      ["Graphik", "body"],
    ],
  );
  assertEquals(r.logos[0]!.image, "https://halm.test/logo.svg");
  assertEquals(
    r.imagery.map((i) => i.image),
    ["https://halm.test/img/hero.jpg", "https://halm.test/img/chair.jpg"],
  );
  assertEquals(r.voice[0]!.example, "Chairs made in Norway, to keep for good.");
  assertEquals(r.voice[1]!.example, "One chair, for good");
});

Deno.test("a colour gets a plain name", () => {
  assertEquals(
    [colourName("#2B1D17"), colourName("#EFE6DA"), colourName("#FFFFFF")],
    ["Deep brown", "Pale sand", "White"],
  );
});

Deno.test("an address is a public website", () => {
  assertEquals(
    [siteUrl("halm.no"), siteUrl("http://localhost:3000"), siteUrl("")],
    ["https://halm.no/", undefined, undefined],
  );
});

Deno.test(
  "the scan reads the home page, the pages it links to and its stylesheet, and saves it as the caller",
  async () => {
    const fetched: string[] = [];
    let saved: Record<string, unknown> = {};
    const res = await handleScan(req({ workspaceId: "w1", url: "halm.test" }), true, {
      fetchText: (u) => {
        fetched.push(u);
        return Promise.resolve(u.endsWith(".css") ? { url: u, text: CSS } : { url: u, text: HOME });
      },
      save: (input) => ((saved = input), Promise.resolve({ data: { id: "s1", state: "done" } })),
    });
    assertEquals(res.status, 200);
    assertEquals(fetched, ["https://halm.test/", "https://halm.test/about", "https://halm.test/site.css"]);
    assertEquals((saved.p_sources as unknown[]).length, 2);
    assertEquals((saved.p_finds as { kind: string }[]).filter((f) => f.kind === "colour").length, 4);
  },
);

Deno.test("a site that will not open is a failed reading, kept with what to do", async () => {
  let saved: Record<string, unknown> = {};
  const res = await handleScan(req({ workspaceId: "w1", url: "halm.test" }), true, {
    fetchText: () => Promise.resolve(null),
    save: (input) => ((saved = input), Promise.resolve({ data: { state: "failed" } })),
  });
  assertEquals(res.status, 200);
  assertEquals(saved.p_error, "Fume could not open halm.test. Check the address, or upload the brand guide.");
});

Deno.test("no one reads a brand without signing in", async () => {
  const res = await handleScan(req({ workspaceId: "w1", url: "halm.test" }), false, {
    fetchText: () => Promise.resolve(null),
    save: () => Promise.resolve({}),
  });
  assertEquals(res.status, 403);
});

Deno.test("a video player's or a carousel's own face is never taken for the brand's", () => {
  const css = `.vjs-control-bar .vjs-title{font-family:VideoJS} .video-js h1{font-family:VideoJS} .vjs-icon{font-family:VideoJS}
    .vjs-a{font-family:VideoJS}.vjs-b{font-family:VideoJS}.vjs-c{font-family:VideoJS}
    h1{font-family:"Helvetica Now Display",Helvetica,sans-serif} body{font-family:"Helvetica Now Text",Helvetica,sans-serif}
    .slick-title{font-family:slick}`;
  const r = readBrand([{ url: "https://shoe.test/", html: "<html><head><title>Shoe</title></head><body></body></html>", css }], "Shoe");
  assertEquals(r.typefaces.map((t) => [t.name, t.role]), [["Helvetica Now Display", "display"], ["Helvetica Now Text", "body"]]);
});
