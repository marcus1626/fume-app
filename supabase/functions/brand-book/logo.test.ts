import { assertEquals } from "jsr:@std/assert@1";
import { dnaLogoUrl, safeSvg } from "./logo.ts";

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
