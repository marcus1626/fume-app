// Products calls: Product Truth, the catalogue, product kinds and specs, importing products, product-data changes from
// the Studio, and product fix.

import type { Id } from "../entities/common";
import type {
  Collection,
  DetailToken,
  ImportJob,
  ImportSource,
  Product,
  ProductFact,
  ProductFile,
  ProductFix,
  ProductKind,
  ProductOverride,
  ProductPart,
  SpecValue,
} from "../entities/products";
import type { CreativeDocument } from "../entities/studio";
import type { CatalogueView, CollectionView } from "../views/products";

/** Import products: from the website, a CSV or a zip; the customer goes through what the Engine found. */
export interface ProductImportApi {
  /** The import that is under way or waits for review, or the result not yet closed; null when none. */
  productImport(): Promise<ImportJob | null>;
  startProductImport(input: {
    source: ImportSource;
    url?: string;
    file?: { name: string; bytes: number };
  }): Promise<ImportJob>;
  importJob(id: Id): Promise<ImportJob>;
  /** csv: the customer's answer to the column mapping; reading goes on. */
  mapImportColumns(jobId: Id, columns: { column: string; fieldId: Id | null }[]): Promise<ImportJob>;
  /** One found product: keep, remove, fix (its values), split a zip group, or merge it into another. */
  decideFound(
    jobId: Id,
    foundId: Id,
    decision:
      | { verdict: "keep" | "remove" | "split" }
      | { verdict: "merge"; intoId: Id }
      | { verdict: "fix"; name?: string; variant?: string; kindId?: Id; fields?: { fieldId: Id; value: string }[] },
  ): Promise<ImportJob>;
  /** Approve all that is left: new products land in the catalogue, changed ones are updated. */
  approveImport(jobId: Id): Promise<ImportJob>;
  /** Close the result (or cancel an import under way). */
  dismissImport(jobId: Id): Promise<void>;
}

export interface ProductsApi extends ProductImportApi {
  // Products and Product Truth
  product(productId: Id): Promise<Product>;
  verifyFact(factId: Id): Promise<ProductFact>;
  correctFact(factId: Id, statement: string): Promise<ProductFact>;
  verifyProduct(productId: Id): Promise<Product>;
  addProduct(input: { name: string; variant: string; url?: string }): Promise<Product>;

  // The catalogue (FLOWS §3.1)
  catalogue(): Promise<CatalogueView>;
  collection(collectionId: Id): Promise<CollectionView>;
  addCollection(input: { name: string; kind: Collection["kind"]; productIds: Id[] }): Promise<Collection>;
  setProductPlace(productId: Id, change: { categoryId?: Id; collectionIds?: Id[] }): Promise<Product>;

  // Product kinds and specs
  /** The category templates: fields, shot slots, parts (like Studio modes). */
  productKinds(): Promise<ProductKind[]>;
  /** Add a product of a kind: the Engine reads the shots and the product page and proposes specs and parts. */
  readProduct(input: {
    kindId: Id;
    name: string;
    variant: string;
    url?: string;
    shots: { slotId: Id; name: string; bytes: number; src?: string }[];
  }): Promise<Product>;
  /** The customer's values and decisions: set values (supplied), keep proposals (approved), remove, parts. */
  saveProductSpecs(
    productId: Id,
    input: {
      kindId?: Id;
      values?: { fieldId: Id; value: SpecValue; unit?: string }[];
      keep?: Id[];
      remove?: Id[];
      parts?: Omit<ProductPart, "provenance">[];
      keepParts?: Id[];
      /** Reference shots the Engine took from the website, kept by slot. */
      keepShots?: Id[];
    },
  ): Promise<Product>;
  /** A reference photo for one angle slot. src: where the upload landed (the mock takes the browser's preview); blob:
   *  the picture itself, which the live backend stores. */
  uploadShot(
    productId: Id,
    slotId: Id,
    file: { name: string; bytes: number; src?: string; blob?: Blob },
  ): Promise<Product>;
  /** A 3D model, dieline or label artwork. */
  uploadProductFile(productId: Id, file: { kind: ProductFile["kind"]; name: string; bytes: number }): Promise<Product>;

  // Product data changed in the Studio (FLOWS §9.5): only the customer approves Product Truth
  /** Product-data changes Fume made in the Studio for this product (scope product, any state), for the customer to decide. */
  productProposals(productId: Id): Promise<ProductOverride[]>;
  decideOverride(overrideId: Id, verdict: "approve" | "decline"): Promise<ProductOverride>;

  // Product fix (FLOWS §17)
  detailTokens(productId: Id): Promise<DetailToken[]>;
  /** Fix a detail with the real product: a token the Engine masked, or a region the designer brushed. */
  fixProduct(
    documentId: Id,
    input: { versionId: Id; tokenId?: Id; region?: ProductFix["region"]; what?: string },
  ): Promise<CreativeDocument>;
}
