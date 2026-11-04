import { assertEquals } from "jsr:@std/assert@1";
import { toRead } from "./pictures.ts";

Deno.test("what Fume saw in the pictures is kept with the pictures it was seen in; a colour that is not one is dropped", () => {
  const r = toRead({
    colours: [{ name: "Green", hex: "#0b3b2e", role: "primary", usage: "Headlines", seen: [1, 2] }, { name: "?", hex: "green", role: "accent", usage: "", seen: [1] }],
    typefaces: [], logos: [], voice: [{ statement: "Price first, in capitals", example: "GENSERE NÅ 199,-", seen: [2] }],
  }, ["ad-01.png", "ad-02.png"]);
  assertEquals(r.colours.map((c) => c.hex), ["#0B3B2E"]);
  assertEquals(r.colours[0].provenance.evidence, "The brand's own pictures: ad-01.png, ad-02.png");
  assertEquals(r.voice[0].provenance.confidence, "medium");
});
