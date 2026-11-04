import { assertEquals } from "jsr:@std/assert@1";
import { handleImport, readShop } from "./handler.ts";
import { fromPage, productLinks, sitemapLinks } from "./read.ts";

const shopify = {
  products: [
    {
      title: "Oak chair",
      handle: "oak-chair",
      body_html: "<p>Solid oak, <b>oiled</b>.</p>",
      product_type: "Chair",
      variants: [{ title: "Default Title", sku: "OAK-1", price: "4990.00" }],
      images: [{ src: "https://cdn.shopify.com/oak.jpg?v=123" }, { src: "//cdn.shopify.com/oak-2.jpg" }],
    },
    {
      title: "Linen cushion",
      handle: "linen",
      variants: [
        { title: "Sand", sku: "L-S" },
        { title: "Moss", sku: "L-M" },
      ],
      images: [],
    },
  ],
};

const web = (pages: Record<string, string>) => ({
  fetchText: (url: string) => Promise.resolve(pages[url] !== undefined ? { url, text: pages[url]! } : null),
  save: (input: Record<string, unknown>) => Promise.resolve({ data: { id: "imp-1", found: input.p_found } }),
});

Deno.test("a Shopify shop is read from its product feed", async () => {
  const read = await readShop(
    "https://halm.test/",
    web({ "https://halm.test/products.json?limit=250": JSON.stringify(shopify) }),
  );
  assertEquals(read!.found.length, 2);
  const oak = read!.found[0]!;
  assertEquals(oak.variant, "");
  assertEquals(oak.images, ["https://cdn.shopify.com/oak.jpg", "https://cdn.shopify.com/oak-2.jpg"]);
  assertEquals(oak.fields.find((f) => f.fieldId === "sku")?.value, "OAK-1");
  assertEquals(oak.fields.find((f) => f.fieldId === "description")?.value, "Solid oak, oiled.");
  assertEquals(oak.source, "https://halm.test/products/oak-chair");
  assertEquals(read!.found[1]!.fields.find((f) => f.fieldId === "variants")?.value, "Sand, Moss");
});

const page = (name: string) =>
  `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization"},` +
  `{"@type":"Product","name":"${name}","image":["/img/${name}.jpg"],"sku":"S-${name}","offers":{"price":"299","priceCurrency":"NOK"}}]}</script></head></html>`;

Deno.test("another shop is read from its product pages and sitemap", async () => {
  const read = await readShop(
    "https://kaffe.test/",
    web({
      "https://kaffe.test/": `<html><body><a href="/produkt/morgen">Morgen</a><a href="https://other.test/products/x">x</a></body></html>`,
      "https://kaffe.test/sitemap.xml": `<sitemapindex><sitemap><loc>https://kaffe.test/product-sitemap.xml</loc></sitemap></sitemapindex>`,
      "https://kaffe.test/product-sitemap.xml": `<urlset><url><loc>https://kaffe.test/produkt/kveld</loc></url></urlset>`,
      "https://kaffe.test/produkt/morgen": page("Morgen"),
      "https://kaffe.test/produkt/kveld": page("Kveld"),
    }),
  );
  assertEquals(read!.found.map((f) => f.name).sort(), ["Kveld", "Morgen"]);
  const m = read!.found.find((f) => f.name === "Morgen")!;
  assertEquals(m.images, ["https://kaffe.test/img/Morgen.jpg"]);
  assertEquals(m.fields.find((f) => f.fieldId === "price")?.value, "299 NOK");
});

Deno.test("product links stay on the shop and drop pictures", () => {
  assertEquals(
    productLinks(`<a href="/products/a?variant=1"><a href="/products/a.jpg"><a href="/about">`, "https://halm.test/"),
    ["https://halm.test/products/a"],
  );
  assertEquals(
    sitemapLinks("<loc>https://h.test/products/a</loc><loc>https://h.test/sitemap_products_1.xml?from=1</loc>"),
    {
      maps: ["https://h.test/sitemap_products_1.xml?from=1"],
      pages: ["https://h.test/products/a"],
    },
  );
  assertEquals(fromPage("<html>no data</html>", "https://h.test/"), null);
});

Deno.test("the import is saved for review, by the caller", async () => {
  const res = await handleImport(
    new Request("https://x/", { method: "POST", body: JSON.stringify({ workspaceId: "ws", url: "halm.test" }) }),
    true,
    web({ "https://halm.test/products.json?limit=250": JSON.stringify(shopify) }),
  );
  assertEquals(res.status, 200);
  assertEquals(((await res.json()).import.found as unknown[]).length, 2);
});

Deno.test("no products, a closed site, or a private address is said plainly", async () => {
  const ask = (url: string, pages: Record<string, string>) =>
    handleImport(
      new Request("https://x/", { method: "POST", body: JSON.stringify({ workspaceId: "ws", url }) }),
      true,
      web(pages),
    );
  assertEquals(
    (await (await ask("halm.test", {})).json()).message,
    "Fume could not open halm.test. Check the address.",
  );
  const none = await ask("halm.test", { "https://halm.test/": "<html><body>Hello</body></html>" });
  assertEquals(none.status, 400);
  assertEquals((await ask("localhost:3000", {})).status, 400);
  assertEquals(
    (await handleImport(new Request("https://x/", { method: "POST", body: "{}" }), false, web({}))).status,
    403,
  );
});

Deno.test("a shop that draws its products with JavaScript still lists them in its data", () => {
  const html = `<script id="__NEXT_DATA__">{"url":"https:\\/\\/www.nike.com\\/no\\/t\\/air-force-1-07-sko-ABC123\\/CW2288-111","x":"\\u002Fno\\u002Ft\\u002Fpegasus-41\\u002FFD2722-002"}</script><a href="/no/w/herre">`;
  assertEquals(productLinks(html, "https://www.nike.com/no/"), [
    "https://www.nike.com/no/t/air-force-1-07-sko-ABC123/CW2288-111",
    "https://www.nike.com/no/t/pegasus-41/FD2722-002",
  ]);
});

Deno.test("a product group (a model in sizes and colours) is read as the product", () => {
  const html = `<script type="application/ld+json">[{"@context":"https://schema.org","@type":"ProductGroup","name":"Air Jordan 4 Retro","description":"Ta på deg en klassiker.","productGroupID":"JA5911","hasVariant":[{"@type":"Product","sku":"JA5911-320-42","image":"https://static.nike.com/a/1.png","offers":{"price":2199,"priceCurrency":"NOK"}}]}]</script>`;
  const f = fromPage(html, "https://www.nike.com/no/t/aj4/JA5911-320");
  assertEquals([f?.name, f?.images[0], f?.fields.find((x) => x.fieldId === "sku")?.value], ["Air Jordan 4 Retro", "https://static.nike.com/a/1.png", "JA5911"]);
});
