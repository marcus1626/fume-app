// Reading a product CSV in the browser (src/api/live/csv.ts): headings in English or Norwegian, quotes, semicolons,
// and Shopify's one row per variant and picture folded into one product.
import { describe, expect, it } from "vitest";
import { fieldOf, parseCsv, productsFromCsv } from "../src/api/live/csv";

describe("product CSV", () => {
  it("reads quotes, doubled quotes and line breaks inside quotes", () => {
    expect(parseCsv('a,b\n"x, y","say ""hi""\nthere"\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"\nthere'],
    ]);
  });

  it("guesses a semicolon separator and Norwegian headings", () => {
    const { found } = productsFromCsv(
      "Produktnavn;Varenummer;Pris;Kategori\nKaffe Etiopia;K-1;189;Kaffe\n",
      "nordlys.csv",
    );
    expect(found).toHaveLength(1);
    expect(found[0]!.name).toBe("Kaffe Etiopia");
    expect(found[0]!.fields.map((f) => [f.fieldId, f.value])).toEqual([
      ["sku", "K-1"],
      ["price", "189"],
      ["type", "Kaffe"],
    ]);
  });

  it("folds Shopify's variant and picture rows into one product", () => {
    const csv = [
      "Handle,Title,Body (HTML),Type,Variant SKU,Variant Price,Image Src",
      "oil,Night Body Oil,<p>Calm &amp; warm</p>,Body care,NBO-100,450,https://cdn.test/a.jpg",
      "oil,,,,NBO-50,290,https://cdn.test/b.jpg",
      "scrub,Body Scrub,,Body care,BS-1,320,",
    ].join("\n");
    const { found } = productsFromCsv(csv, "shopify.csv");
    expect(found.map((p) => p.name)).toEqual(["Night Body Oil", "Body Scrub"]);
    expect(found[0]!.images).toEqual(["https://cdn.test/a.jpg", "https://cdn.test/b.jpg"]);
    expect(found[0]!.fields.find((f) => f.fieldId === "description")?.value).toBe("Calm & warm");
  });

  it("finds nothing without a name column", () => {
    expect(productsFromCsv("Colour,Size\nred,M\n", "x.csv").found).toEqual([]);
    expect(fieldOf("Product Title")).toBe("name");
    expect(fieldOf("Art. nr")).toBe("sku");
  });
});
