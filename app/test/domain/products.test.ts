// When a product may be used (app/src/domain/products.ts).
import { describe, expect, test } from "vitest";
import type { Product, ProductFact } from "../../src/contract";
import { canBeMade, isConfirmed, productsToConfirm } from "../../src/domain/products";

const fact = (source: ProductFact["source"]) => ({ label: "Size", statement: "50 ml", source }) as ProductFact;
const product = (id: string, state: Product["state"], facts: ProductFact[] = []) => ({ id, state, facts }) as Product;

describe("products", () => {
  test("a product is confirmed once every line is confirmed or supplied", () => {
    expect(isConfirmed(product("p", "needs_you", [fact("verified"), fact("supplied")]))).toBe(true);
    expect(isConfirmed(product("p", "needs_you", [fact("verified"), fact("inferred")]))).toBe(false);
    expect(isConfirmed(product("p", "needs_you", [fact("unknown")]))).toBe(false);
    expect(isConfirmed(product("p", "needs_you", []))).toBe(false);
  });

  test("only a confirmed product is made", () => {
    expect(canBeMade(product("p", "verified"))).toBe(true);
    expect(canBeMade(product("p", "needs_you"))).toBe(false);
    expect(canBeMade(product("p", "draft"))).toBe(false);
  });

  test("a campaign waits on its own products that still need her", () => {
    const all = [product("a", "needs_you"), product("b", "verified"), product("c", "needs_you")];
    expect(productsToConfirm({ productIds: ["a", "b"] }, all).map((p) => p.id)).toEqual(["a"]);
  });
});
