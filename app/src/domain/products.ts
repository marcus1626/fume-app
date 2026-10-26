// When a product may be used.
import type { Campaign, Product } from "../contract";

/** A product is confirmed once the customer has confirmed or supplied every line of it (FLOWS §7 step 5). */
export function isConfirmed(product: Product): boolean {
  return product.facts.length > 0 && product.facts.every((f) => f.source === "verified" || f.source === "supplied");
}

/** Only a confirmed product is used in a campaign or made by the Engine (FLOWS §7 step 5: verify before production). */
export function canBeMade(product: Product): boolean {
  return product.state === "verified";
}

/** A campaign waits on its own products that still need the customer to confirm them (FLOWS §7 step 5). */
export function productsToConfirm(campaign: Pick<Campaign, "productIds">, products: Product[]): Product[] {
  return products.filter((p) => campaign.productIds.includes(p.id) && p.state === "needs_you");
}
