import { assertEquals } from "jsr:@std/assert@1";
import { dnaLogoUrl, logoFile, safeSvg } from "./logo.ts";

Deno.test("the site's icon is never taken for the brand's logo", () => {
  assertEquals(dnaLogoUrl({ logos: [{ image: "https://www.nike.com/favicon.ico?v=1", use: "The site's icon" }] }), null);
  assertEquals(dnaLogoUrl({ logos: [{ image: "https://www.mollers.no/_next/image?url=%2Flogo.png&w=256&q=75", use: "The logo on the site" }] }), "https://www.mollers.no/_next/image?url=%2Flogo.png&w=256&q=75");
  assertEquals(dnaLogoUrl({}), null);
});

Deno.test("a logo SVG is kept without anything that runs", () => {
  const s = safeSvg('<?xml version="1.0"?><svg onload="x()"><script>x()</script><path d="M0 0"/></svg>')!;
  assertEquals(/script|onload/.test(s), false);
  assertEquals(safeSvg("<html></html>"), null);
});

Deno.test("an SVG that only wraps a picture of the logo is kept as that picture", () => {
  const png = new Uint8Array(200).fill(7);
  let bin = "";
  for (const b of png) bin += String.fromCharCode(b);
  const svg = `<?xml version="1.0"?><svg xmlns:xlink="http://www.w3.org/1999/xlink"><g><image id="logo" x="0" y="0" xlink:href="data:image/png;base64,${btoa(bin)}"/></g></svg>`;
  const out = logoFile(new TextEncoder().encode(svg), "image/svg+xml")!;
  assertEquals([out.type, out.bytes.length, out.bytes[0]], ["image/png", 200, 7]);
  const drawn = logoFile(new TextEncoder().encode('<svg><path d="M0 0"/><script>x()</script></svg>'), "image/svg+xml")!;
  assertEquals([drawn.type, /script/.test(new TextDecoder().decode(drawn.bytes))], ["image/svg+xml", false]);
});
