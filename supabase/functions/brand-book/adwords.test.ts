import { assertEquals } from "jsr:@std/assert@1";
import { adWordsPage } from "./adwords.ts";

Deno.test("the brand's ads become the first page its voice is written from, word for word", () => {
  const page = adWordsPage({
    ads: [
      { picture: 1, language: "no", headline: "JUST DO IT.", subline: "", cta: "", other: "" },
      { picture: 2, language: "no", headline: "", subline: "", cta: "", other: "" },
    ],
    habits: ["Short, imperative, no button"],
  })!;
  assertEquals(page.text.includes("headline: JUST DO IT."), true);
  assertEquals(page.text.includes("Ad 2"), false, "an ad with no words is left out");
  assertEquals(page.text.includes("- Short, imperative, no button"), true);
  assertEquals(adWordsPage({ ads: [], habits: [] }), null);
});
