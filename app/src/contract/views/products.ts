// Products view models: the catalogue and one collection.

import type { Campaign } from "../entities/campaigns";
import type { Delivery } from "../entities/delivery";
import type { Category, Collection, Product } from "../entities/products";
import type { Creative } from "../entities/review";

export interface CatalogueView {
  products: Product[];
  categories: Category[];
  collections: Collection[];
}

export interface CollectionView {
  collection: Collection;
  products: Product[];
  campaigns: Campaign[];
  /** Approved creatives for this collection's products, across campaigns. */
  approved: Creative[];
  deliveries: Delivery[];
}
