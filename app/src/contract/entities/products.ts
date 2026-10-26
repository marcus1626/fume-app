// Products: the catalogue and each product's Product Truth (ARCHITECTURE §4.2, FLOWS §3.1), the product kinds and the
// specs they ask for, importing products, changes to product data proposed from the Studio, and product fix.

import type { Confidence, FactSource, Id, Instant, Provenance } from "./common";

// ─── Products and Product Truth ─────────────────────────────────────────────

export type ProductFactArea = "shape" | "colour" | "material" | "label" | "packaging" | "claim" | "never";

export interface ProductFact {
  id: Id;
  productId: Id;
  area: ProductFactArea;
  label: string;
  statement: string;
  source: FactSource;
  confidence: Confidence;
  verifiedBy?: Id;
  verifiedAt?: Instant;
}

export interface Product {
  id: Id;
  workspaceId: Id;
  name: string;
  variant: string;
  sku?: string;
  /** Its place in the catalogue (FLOWS §3.1). */
  categoryId?: Id;
  collectionIds?: Id[];
  variants?: Variant[];
  /** Who added it; products the Engine read from the website start as proposals. */
  provenance?: Provenance;
  /** needs_you: Fume extracted facts the customer has not verified yet. */
  state: "draft" | "needs_you" | "verified";
  images: string[];
  facts: ProductFact[];
  /** The product kind (category template) its specs follow; see ProductKind. */
  kindId?: Id;
  /** The values of the kind's fields, each with its provenance (Engine proposal or the customer's). */
  specs?: SpecEntry[];
  /** The physical parts (bottle, cap, pump, box, label), each with material, finish and colour. */
  parts?: ProductPart[];
  /** The reference shots, one per angle slot of the kind. */
  shots?: ReferenceShot[];
  /** A 3D model, dieline or label artwork the customer added. */
  files?: ProductFile[];
  /** Fume found it since she last looked at her products ("New"). */
  isNew?: boolean;
}

export interface Variant {
  id: Id;
  productId: Id;
  name: string;
  sku?: string;
  image?: string;
}

// ─── Catalogue (FLOWS §3.1) ─────────────────────────────────────────────────

export interface Category {
  id: Id;
  workspaceId: Id;
  name: string;
  /** A tree: Body care › Oils. */
  parentId?: Id;
}

export type CollectionKind = "season" | "launch" | "line" | "custom";

export interface Collection {
  id: Id;
  workspaceId: Id;
  /** "SS27", "AW26", "Evening ritual". */
  name: string;
  kind: CollectionKind;
  startsAt?: Instant;
  endsAt?: Instant;
  productIds: Id[];
  cover?: string;
  description?: string;
  provenance: Provenance;
}

// ─── Product kinds and specs: what the Engine needs to know about a product ─
// Like a Studio mode, a product kind is a schema: the customer picks the kind when adding a product, and it holds the
// data the Engine needs for fidelity, measurements included. Research and sources:
// /mnt/project-files/app/product-data-research.md.

export type SpecFieldType =
  | "text"
  | "number"
  | "dimensions"
  | "colour"
  | "material"
  | "finish"
  | "choice"
  | "list"
  | "image"
  | "file"
  | "blend"
  | "measurements"
  | "parts";

export type SpecGroupId =
  | "identity"
  | "size"
  | "materials"
  | "packaging"
  | "label"
  | "variants"
  | "use"
  | "construction"
  | "decoration"
  | "formula"
  | "trims"
  | "care";

/** The three levels of product data (research §7–17): short, full and technical. */
export type SpecLevel = "short" | "full" | "technical";

export type Finish = "matte" | "satin" | "gloss" | "frosted" | "metallic" | "brushed" | "soft-touch" | "textured";

export interface SpecField {
  id: Id;
  label: string;
  type: SpecFieldType;
  /** number: the unit ("ml"); the first of units is the default. */
  units?: string[];
  /** choice, material and finish: the options, in the customer's words. */
  options?: string[];
  /** Needed for fidelity: without it the Engine guesses, so it counts in the fidelity score. */
  required: boolean;
  /** One line under the field: why the Engine needs it, or how to measure it. */
  help?: string;
  placeholder?: string;
  /** A label line the Engine also protects as a detail token (FLOWS §17). */
  detail?: DetailToken["kind"];
  /** Limits what a creative may say (claims, INCI, allergens), never how it looks. */
  compliance?: boolean;
  /** Which of the three levels it belongs to (short: always on top; full: the kind's sections; technical: factory
   *  data beside the files). Left out = full. `required` means Engine-critical. */
  level?: SpecLevel;
  /** measurements: the sizes a new table starts with. */
  sizes?: string[];
  /** measurements: the points of measure a new table starts with. */
  poms?: string[];
}

export interface SpecGroup {
  id: SpecGroupId;
  /** One line under the section title, in the customer's words. */
  text?: string;
  title: string;
  fields: SpecField[];
}

/** One angle the Engine needs a reference photo from. */
export interface ShotSlot {
  id: Id;
  label: string;
  help: string;
  required: boolean;
}

/** A category template: its fields, its shot slots, the parts a product of this kind usually has. */
export interface ProductKind {
  id: Id;
  name: string;
  /** "Serum, oil, cream, balm". */
  examples: string;
  /** A picture for the kind grid. */
  image?: string;
  groups: SpecGroup[];
  shots: ShotSlot[];
  /** Proposed when a product of this kind is added ("Bottle", "Cap", "Box"). */
  parts: string[];
  /** Files that raise fidelity a lot for this kind (3D model, dieline, artwork). */
  files: { kind: ProductFile["kind"]; label: string; help: string }[];
}

// ─── Product data: the values of a product's specs ──────────────────────────

export interface Dimensions {
  /** Width, or the diameter of a round thing. */
  w: number;
  h: number;
  /** Depth; left out for a round thing. */
  d?: number;
  unit: "mm" | "cm";
  shape: "round" | "box" | "flat";
}

export interface ColourValue {
  name: string;
  hex: string;
  pantone?: string;
}

/** Fibres by weight, highest first; the percentages sum to 100 (EU 1007/2011 art. 9). */
export interface FibreBlend {
  fibres: { fibre: string; pct: number }[];
}

/** Points of measure × sizes, each with its tolerance (a tech pack's measurement chart). */
export interface MeasureTable {
  unit: "cm" | "mm" | "in";
  sizes: string[];
  /** The sample size the others are graded from. */
  base?: string;
  rows: { pom: string; code?: string; values: (number | null)[]; tol?: number; how?: string }[];
}

/** One part of a product as data: a garment trim, a shoe component, a furniture part, a surface of a device. */
export interface SpecPart {
  name: string;
  material?: string;
  finish?: string;
  colour?: ColourValue;
  decoration?: string;
  /** A size or amount: "0.35 ct", "15 mm", "6 cm". */
  size?: string;
  note?: string;
}

export interface PartsValue {
  parts: SpecPart[];
}

export type SpecValue =
  string | number | string[] | Dimensions | ColourValue | ColourValue[] | FibreBlend | MeasureTable | PartsValue;

export interface SpecEntry {
  fieldId: Id;
  value: SpecValue;
  /** number: the unit it was given in. */
  unit?: string;
  provenance: Provenance;
  /** A label line linked to the detail token the Engine protects. */
  detailTokenId?: Id;
}

export interface ProductPart {
  id: Id;
  name: string;
  material?: string;
  finish?: Finish;
  opacity?: "opaque" | "translucent" | "clear";
  colour?: ColourValue;
  note?: string;
  /** How it is decorated (screen print, hot-foil, emboss). */
  decoration?: string;
  provenance: Provenance;
}

export interface ReferenceShot {
  slotId: Id;
  image: string;
  provenance: Provenance;
}

export interface ProductFile {
  id: Id;
  kind: "model" | "dieline" | "artwork" | "techpack" | "flats" | "cad" | "spec";
  name: string;
  bytes: number;
  at: Instant;
  by: Id;
  /** What the Engine read from it, one line each ("12 points of measure × 5 sizes"). */
  read?: string[];
  /** The fields it filled. */
  filled?: Id[];
}

/** One thing still missing for fidelity, with the one action that fills it. */
export interface FidelityGap {
  kind: "field" | "shot" | "proposals";
  id: Id;
  label: string;
  groupId?: SpecGroupId;
}

// ─── Import products ────────────────────────────────────────────────────────
// Products have their own "Import products": from the website, a CSV or an unsorted zip. The Engine reads, groups and
// compares with the catalogue, then shows "What the Engine found".

export type ImportSource = "website" | "csv" | "zip";

/** One file the Engine read: a page of the website, a row's picture, a file in the zip. */
export interface ImportFile {
  name: string;
  bytes?: number;
  kind: "page" | "picture" | "pdf" | "spec" | "techpack" | "artwork" | "other";
  /** A picture's preview. */
  src?: string;
}

/** One value the Engine read for a found product, in words; before = what Fume holds now (a changed product). */
export interface ImportField {
  /** A field of the product's kind ("net", "claims"), or name, variant, sku, price. */
  fieldId: Id;
  label: string;
  value: string;
  before?: string;
  source?: string;
}

export interface FoundProduct {
  id: Id;
  status: "new" | "changed" | "unsure";
  name: string;
  variant?: string;
  /** The kind the Engine proposes, and how sure it is of it. */
  kindId?: Id;
  kindConfidence?: Confidence;
  /** How sure the Engine is of the whole (the grouping, for a zip). */
  confidence: Confidence;
  images: string[];
  /** The files grouped into this product (zip), the pages it was read on (website), the row (CSV). */
  files: ImportFile[];
  fields: ImportField[];
  /** Changed: the product in the catalogue it updates. */
  productId?: Id;
  /** Changed: one line on what is new ("New size: 100 ml"). */
  changes?: string;
  /** Changed: the new main picture and variant line, applied on approval. */
  patch?: { variant?: string; image?: string };
  /** Unsure: why, in one line ("These 3 pictures might be one product"). */
  note?: string;
  source?: string;
  /** The customer's answer on this one item, before Approve all. */
  decision?: "kept" | "fixed";
}

/** A CSV column and the Fume field the Engine maps it to; sure = no need to ask. */
export interface ImportColumn {
  column: string;
  sample: string;
  fieldId: Id | null;
  sure: boolean;
  /** Unsure: why, in one line ("Could be millilitres or a garment size"). */
  why?: string;
}

export interface ImportJob {
  id: Id;
  workspaceId: Id;
  source: ImportSource;
  /** website: the address; csv and zip: the file's name. */
  url?: string;
  fileName?: string;
  /** reading → (csv, when unsure) mapping → review → done; dismissed once the customer closes the result. */
  state: "reading" | "mapping" | "review" | "done" | "dismissed";
  /** 0–1. */
  progress: number;
  /** What the Engine is reading now ("Reading lysne.no/products/body-scrub"). */
  reading?: string;
  /** Counts found so far ("Pages read 31", "Products found 4"). */
  counts: { label: string; n: number }[];
  /** What it has read, newest last (the last few are shown, quietly). */
  log: string[];
  /** csv: the columns and the Engine's guesses; shown only when one is not sure. */
  columns?: ImportColumn[];
  /** csv: the Fume fields a column can map to. */
  fieldOptions?: { id: Id; label: string }[];
  found: FoundProduct[];
  /** Products it read that are exactly as Fume holds them (not shown as items). */
  unchanged: number;
  unchangedNames?: string[];
  /** zip: files that are not about a product. */
  setAside?: { count: number; line: string };
  /** After approval: the products that landed or changed. */
  result?: { productIds: Id[]; added: number; updated: number };
  startedAt: Instant;
  approvedAt?: Instant;
  approvedBy?: Id;
}

// ─── Product data changed in the Studio (FLOWS §9.5) ────────────────────────

/** A change to the product's data made in the Studio (FLOWS §9.5). */
export interface ProductOverride {
  id: Id;
  productId: Id;
  /** The Product Truth line it changes ("Cap"). */
  field: string;
  value: string;
  was: string;
  /** this_render: stored on the document only; product: a proposal to the customer to change the product itself. */
  scope: "this_render" | "product";
  by: Id;
  at: Instant;
  /** For scope product: proposed until the customer approves. */
  state: "applied" | "proposed" | "approved" | "declined";
}

// ─── Product fix (FLOWS §17) ────────────────────────────────────────────────

/** A real detail of the real product the Engine protects (FLOWS §17). */
export interface DetailToken {
  id: Id;
  productId: Id;
  label: string;
  /** What it must read or look like: "100 ml". */
  value: string;
  kind: "text" | "label" | "cap" | "logo" | "material";
  /** The cut-out of the real product. */
  image: string;
  /** Where it sits on the product's main image, 0–1. */
  region: { x: number; y: number; w: number; h: number };
  provenance: Provenance;
}

/** A detail the Engine found on a render, with what it read. */
export interface DetailFind {
  tokenId: Id;
  /** Where it is on the render, 0–1. */
  region: { x: number; y: number; w: number; h: number };
  read: string;
  ok: boolean;
}

/** A fix of one detail on a render: the Engine's automatic pass, or one a designer asked for. */
export interface ProductFix {
  id: Id;
  tokenId?: Id;
  region: { x: number; y: number; w: number; h: number };
  found: string;
  expected: string;
  /** auto: the Engine's own pass before QA; by hand: a designer asked. */
  auto: boolean;
  by: Id | "engine";
  at: Instant;
  state: "fixing" | "fixed";
  /** The version the fix made. */
  versionId?: Id;
}
