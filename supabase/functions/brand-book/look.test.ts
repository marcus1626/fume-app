import { assertEquals } from "jsr:@std/assert@1";
import { pageImages, toLookBody } from "./look.ts";

Deno.test("the large pictures on a page, without logos and icons", () => {
  const html = `<meta property="og:image" content="https://cdn.x/hero.jpg">
    <img src="/img/logo.png"><img src="https://cdn.x/a.svg"><img src="https://cdn.x/tiny.jpg" width="40">
    <img srcset="https://cdn.x/s-400.jpg 400w, https://cdn.x/s-1600.jpg 1600w"><img data-src="/p/shoe.jpg">
    <img src="http://insecure.x/x.jpg">`;
  assertEquals(pageImages(html, "https://brand.x/no/"), ["https://cdn.x/hero.jpg", "https://cdn.x/s-1600.jpg", "https://brand.x/p/shoe.jpg"]);
});

Deno.test("evidence only names pictures the model was shown", () => {
  const body = toLookBody(
    { evidence: [{ picture: 1, shows: "tungsten practicals" }, { picture: 7, shows: "made up" }], sources: [], gaps: [] } as never,
    { brand: { brand: { name: "Test" } } } as never,
    [{ url: "https://cdn.x/a.jpg", kind: "brand" }],
  );
  assertEquals(body.evidence, [{ picture: 1, shows: "tungsten practicals", url: "https://cdn.x/a.jpg", kind: "brand" }]);
  assertEquals(body.pictures, 1);
});

Deno.test("pictures kept in a shop's data are found too", () => {
  const html = `<script>{"hero":"https:\\u002F\\u002Fstatic.shop.x\\u002Fa\\u002Fimages\\u002Fcampaign.jpg","logo":"https://static.shop.x/logo.png"}</script>`;
  assertEquals(pageImages(html, "https://shop.x/"), ["https://static.shop.x/a/images/campaign.jpg"]);
});
