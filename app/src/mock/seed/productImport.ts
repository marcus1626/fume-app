// What the Engine reads when LYSNE imports products, from the website, a CSV or an unsorted zip. Each source has a
// script (what it reads, step by step, with counts) and what it finds. The products domain plays the script by the
// clock and compares the finds with the catalogue when it is done, so a product that already came in another way shows
// as unchanged. Pictures: public/demo/lysne/gen/ (MANIFEST.md).
import type { FoundProduct, ImportColumn, ImportFile, ImportSource } from "../../contract";
import { gen } from "./helpers";

export interface ImportStep {
  /** How long this step takes, in ms. */
  ms: number;
  reading: string;
  /** Counts after this step. */
  counts: Record<string, number>;
  /** csv: stop here and ask about the columns when the Engine is unsure of one. */
  mapping?: true;
}

export interface ImportScript {
  steps: ImportStep[];
  /** Products it reads that Fume already holds exactly (by name). */
  unchanged: string[];
  found: FoundProduct[];
  setAside?: { count: number; line: string };
  columns?: ImportColumn[];
}

const pic = (name: string, src: string, bytes = 2_400_000): ImportFile => ({ name, bytes, kind: "picture", src });

const doc = (name: string, kind: ImportFile["kind"], bytes = 380_000): ImportFile => ({ name, bytes, kind });

const page = (name: string): ImportFile => ({ name, kind: "page" });

const scrubFields = (source: string): FoundProduct["fields"] => [
  { fieldId: "net", label: "Net content", value: "200 ml", source },
  { fieldId: "container", label: "Container", value: "Jar", source },
  { fieldId: "container-material", label: "Container material", value: "Amber glass", source },
  { fieldId: "finish", label: "Finish", value: "Gloss", source: "Packshot" },
  { fieldId: "label-size", label: "Size as printed", value: "Body Scrub · 200 ml", source: "Packshot" },
  { fieldId: "wordmark", label: "Wordmark", value: "LYSNE", source: "Packshot" },
  { fieldId: "claims", label: "Claims you may use", value: "Polishes without stripping", source },
];

const mistChange = (source: string, image: string): FoundProduct => ({
  id: "fp-mist",
  status: "changed",
  name: "Pillow Mist",
  variant: "50 ml · 100 ml",
  kindId: "kind-fragrance",
  kindConfidence: "high",
  confidence: "high",
  productId: "pr-mist",
  changes: "New size: 100 ml",
  patch: { variant: "50 ml · 100 ml", image },
  images: [image, gen("mist-pack")],
  files: [],
  source,
  fields: [
    { fieldId: "sizes", label: "Sizes", value: "50 ml, 100 ml", before: "50 ml", source },
    {
      fieldId: "label-size",
      label: "Size as printed",
      value: "Pillow Mist · 100 ml",
      before: "Pillow Mist · 50 ml",
      source: "New packshot",
    },
    { fieldId: "price", label: "Price", value: "NOK 420 (100 ml)", before: "NOK 290", source },
  ],
});

const website: ImportScript = {
  steps: [
    { ms: 900, reading: "Opening lysne.no", counts: { "Pages read": 1, "Products found": 0, Pictures: 0 } },
    {
      ms: 1100,
      reading: "Reading the sitemap: 46 pages",
      counts: { "Pages read": 3, "Products found": 0, Pictures: 4 },
    },
    {
      ms: 1000,
      reading: "Reading the Shopify product feed",
      counts: { "Pages read": 9, "Products found": 4, Pictures: 11 },
    },
    {
      ms: 900,
      reading: "Reading lysne.no/products/night-body-oil",
      counts: { "Pages read": 17, "Products found": 4, Pictures: 15 },
    },
    {
      ms: 900,
      reading: "Reading lysne.no/products/pillow-mist",
      counts: { "Pages read": 24, "Products found": 4, Pictures: 19 },
    },
    {
      ms: 900,
      reading: "Reading lysne.no/products/body-scrub",
      counts: { "Pages read": 31, "Products found": 4, Pictures: 23 },
    },
    {
      ms: 900,
      reading: "Comparing with your catalogue",
      counts: { "Pages read": 31, "Products found": 4, Pictures: 23 },
    },
  ],
  unchanged: ["Night Body Oil", "Hand Balm"],
  found: [
    {
      id: "fp-scrub",
      status: "new",
      name: "Body Scrub",
      variant: "200 ml",
      kindId: "kind-skincare",
      kindConfidence: "high",
      confidence: "high",
      images: [gen("scrub-pack"), gen("scrub-detail")],
      files: [
        page("lysne.no/products/body-scrub"),
        pic("body-scrub-packshot.jpg", gen("scrub-pack")),
        pic("body-scrub-texture.jpg", gen("scrub-detail")),
      ],
      source: "lysne.no/products/body-scrub",
      fields: [
        { fieldId: "price", label: "Price", value: "NOK 380", source: "lysne.no/products/body-scrub" },
        ...scrubFields("lysne.no/products/body-scrub"),
      ],
    },
    {
      ...mistChange("lysne.no/products/pillow-mist", gen("mist100-pack")),
      files: [page("lysne.no/products/pillow-mist"), pic("pillow-mist-100ml.jpg", gen("mist100-pack"))],
    },
  ],
};

const csv: ImportScript = {
  steps: [
    { ms: 900, reading: "Opening lysne-products-2026.csv", counts: { Rows: 12, Columns: 9, "Products found": 0 } },
    {
      ms: 1000,
      reading: "Matching the 9 columns to Fume’s fields",
      counts: { Rows: 12, Columns: 9, "Products found": 0 },
      mapping: true,
    },
    { ms: 1000, reading: "Reading rows 1 to 6", counts: { Rows: 12, Columns: 9, "Products found": 6 } },
    { ms: 1000, reading: "Reading rows 7 to 12", counts: { Rows: 12, Columns: 9, "Products found": 12 } },
    {
      ms: 900,
      reading: "Fetching 11 pictures from the image links",
      counts: { Rows: 12, Columns: 9, "Products found": 12 },
    },
    { ms: 800, reading: "Comparing with your catalogue", counts: { Rows: 12, Columns: 9, "Products found": 12 } },
  ],
  columns: [
    { column: "Handle", sample: "night-body-oil", fieldId: null, sure: true },
    { column: "Title", sample: "Night Body Oil", fieldId: "name", sure: true },
    { column: "Variant", sample: "100 ml", fieldId: "variant", sure: true },
    { column: "SKU", sample: "LYS-NBO-100", fieldId: "sku", sure: true },
    { column: "Pris", sample: "490", fieldId: "price", sure: true },
    {
      column: "Str.",
      sample: "100",
      fieldId: "net",
      sure: false,
      why: "Numbers with no unit: the Engine reads them as millilitres, like the rest of your catalogue.",
    },
    {
      column: "Kategori",
      sample: "Kropp",
      fieldId: "kind",
      sure: false,
      why: "Your own categories (Kropp, Hjem): the Engine maps them to Fume’s kinds of product.",
    },
    { column: "Ingredienser", sample: "Prunus Amygdalus Dulcis Oil, Squalane…", fieldId: "inci", sure: true },
    { column: "Image Src", sample: "cdn.shopify.com/…/oil-pack.jpg", fieldId: "image", sure: true },
  ],
  unchanged: [
    "Night Body Oil",
    "Pillow Mist",
    "Evening Candle",
    "Face Oil",
    "Evening Body Wash",
    "Kveld Eau de Parfum",
    "Room Diffuser",
    "Lip Balm",
  ],
  found: [
    {
      id: "fp-csv-balm",
      status: "changed",
      name: "Hand Balm",
      variant: "50 ml",
      kindId: "kind-skincare",
      kindConfidence: "high",
      confidence: "high",
      productId: "pr-balm",
      changes: "Ingredients and price added",
      images: [gen("balm-pack")],
      files: [doc("Row 2", "other")],
      source: "lysne-products-2026.csv, row 2",
      fields: [
        {
          fieldId: "inci",
          label: "Ingredients (INCI)",
          value: "Butyrospermum Parkii Butter, Glycerin, Cera Alba, Tocopherol",
          before: "Not known yet",
          source: "Row 2",
        },
        { fieldId: "price", label: "Price", value: "NOK 260", before: "Not known yet", source: "Row 2" },
        { fieldId: "sku", label: "SKU", value: "LYS-HB-50", before: "Not known yet", source: "Row 2" },
      ],
    },
    {
      id: "fp-csv-scrub",
      status: "new",
      name: "Body Scrub",
      variant: "200 ml",
      kindId: "kind-skincare",
      kindConfidence: "high",
      confidence: "high",
      images: [gen("scrub-pack")],
      files: [doc("Row 9", "other")],
      source: "lysne-products-2026.csv, row 9",
      fields: [
        { fieldId: "sku", label: "SKU", value: "LYS-BS-200", source: "Row 9" },
        { fieldId: "price", label: "Price", value: "NOK 380", source: "Row 9" },
        ...scrubFields("Row 9").slice(0, 3),
      ],
    },
    {
      id: "fp-csv-sleep",
      status: "new",
      name: "Sleep Balm",
      variant: "30 g",
      kindId: "kind-skincare",
      kindConfidence: "high",
      confidence: "high",
      images: [gen("sleep-pack")],
      files: [doc("Row 10", "other")],
      source: "lysne-products-2026.csv, row 10",
      fields: [
        { fieldId: "sku", label: "SKU", value: "LYS-SB-30", source: "Row 10" },
        { fieldId: "price", label: "Price", value: "NOK 240", source: "Row 10" },
        { fieldId: "net", label: "Net content", value: "30 g", source: "Row 10" },
        { fieldId: "container", label: "Container", value: "Tin", source: "Picture" },
        {
          fieldId: "inci",
          label: "Ingredients (INCI)",
          value: "Cera Alba, Lavandula Angustifolia Oil, Helianthus Annuus Seed Oil",
          source: "Row 10",
        },
      ],
    },
    {
      id: "fp-csv-gift",
      status: "unsure",
      name: "Gavekort",
      variant: "NOK 500",
      confidence: "low",
      images: [],
      files: [doc("Row 12", "other")],
      source: "lysne-products-2026.csv, row 12",
      note: "A gift card: no size, no picture, no ingredients. Is it a product Fume should make creatives of?",
      fields: [{ fieldId: "price", label: "Price", value: "NOK 500", source: "Row 12" }],
    },
  ],
};

const zip: ImportScript = {
  steps: [
    {
      ms: 900,
      reading: "Opening LYSNE_AW26_everything.zip: 31 files",
      counts: { Files: 31, Pictures: 0, Documents: 0, "Products found": 0 },
    },
    {
      ms: 1100,
      reading: "Looking at 19 pictures",
      counts: { Files: 31, Pictures: 19, Documents: 0, "Products found": 0 },
    },
    {
      ms: 1000,
      reading: "Reading spec-sheet_body-scrub.pdf",
      counts: { Files: 31, Pictures: 19, Documents: 3, "Products found": 2 },
    },
    {
      ms: 1000,
      reading: "Reading LYSNE_techpack_linen-spray_v3.pdf",
      counts: { Files: 31, Pictures: 19, Documents: 6, "Products found": 3 },
    },
    {
      ms: 1100,
      reading: "Grouping the files into products",
      counts: { Files: 31, Pictures: 19, Documents: 8, "Products found": 5 },
    },
    {
      ms: 900,
      reading: "Comparing with your catalogue",
      counts: { Files: 31, Pictures: 19, Documents: 8, "Products found": 5 },
    },
  ],
  unchanged: [],
  setAside: {
    count: 6,
    line: "The Engine set aside 6 files that are not about a product: 4 moodboard pictures, an invoice and a font. They are not imported.",
  },
  found: [
    {
      id: "fp-zip-scrub",
      status: "new",
      name: "Body Scrub",
      variant: "200 ml",
      kindId: "kind-skincare",
      kindConfidence: "high",
      confidence: "high",
      images: [gen("scrub-pack"), gen("scrub-detail")],
      files: [
        pic("DSC_0412.jpg", gen("scrub-pack")),
        pic("DSC_0415.jpg", gen("scrub-detail")),
        pic("DSC_0417.jpg", gen("scrub-pack")),
        pic("scrub_lid_off.jpg", gen("scrub-detail")),
        doc("spec-sheet_body-scrub.pdf", "spec"),
        doc("label_body-scrub_200ml.ai", "artwork", 2_100_000),
      ],
      source: "spec-sheet_body-scrub.pdf",
      fields: [
        ...scrubFields("spec-sheet_body-scrub.pdf"),
        {
          fieldId: "inci",
          label: "Ingredients (INCI)",
          value: "Sucrose, Prunus Amygdalus Dulcis Oil, Tocopherol",
          source: "spec-sheet_body-scrub.pdf",
        },
      ],
    },
    {
      id: "fp-zip-sleep",
      status: "new",
      name: "Sleep Balm",
      variant: "30 g",
      kindId: "kind-skincare",
      kindConfidence: "high",
      confidence: "medium",
      images: [gen("sleep-pack")],
      files: [
        pic("sleep_balm_01.jpg", gen("sleep-pack")),
        pic("sleep_balm_02.jpg", gen("sleep-pack")),
        pic("sleep_balm_open.jpg", gen("sleep-pack")),
        doc("sleep-balm_INCI.pdf", "pdf"),
        doc("tin_dieline_60mm.pdf", "artwork"),
      ],
      source: "sleep-balm_INCI.pdf",
      fields: [
        { fieldId: "net", label: "Net content", value: "30 g", source: "Label in sleep_balm_01.jpg" },
        { fieldId: "container", label: "Container", value: "Tin", source: "Pictures" },
        { fieldId: "container-material", label: "Container material", value: "Aluminium", source: "Pictures" },
        { fieldId: "finish", label: "Finish", value: "Brushed", source: "Pictures" },
        {
          fieldId: "inci",
          label: "Ingredients (INCI)",
          value: "Cera Alba, Lavandula Angustifolia Oil, Helianthus Annuus Seed Oil",
          source: "sleep-balm_INCI.pdf",
        },
      ],
    },
    {
      id: "fp-zip-linen",
      status: "new",
      name: "Linen Spray",
      variant: "150 ml",
      kindId: "kind-fragrance",
      kindConfidence: "medium",
      confidence: "high",
      images: [gen("linen-pack")],
      files: [
        pic("linen_spray_front.jpg", gen("linen-pack")),
        pic("linen_spray_side.jpg", gen("linen-pack")),
        pic("linen_spray_top.jpg", gen("linen-pack")),
        doc("LYSNE_techpack_linen-spray_v3.pdf", "techpack", 4_800_000),
        doc("linen-spray_label_150ml.pdf", "artwork"),
        doc("bottle_150ml_boston.step", "other", 9_200_000),
      ],
      source: "LYSNE_techpack_linen-spray_v3.pdf",
      fields: [
        { fieldId: "concentration", label: "Concentration", value: "Mist", source: "Tech pack, page 1" },
        { fieldId: "net", label: "Net content", value: "150 ml", source: "Tech pack, page 1" },
        { fieldId: "glass", label: "Glass", value: "Tinted glass", source: "Tech pack, page 2" },
        {
          fieldId: "label-size",
          label: "Size as printed",
          value: "Linen Spray · 150 ml",
          source: "linen-spray_label_150ml.pdf",
        },
        { fieldId: "wordmark", label: "Wordmark", value: "LYSNE", source: "linen-spray_label_150ml.pdf" },
        { fieldId: "notes", label: "Notes", value: "Linen, lavender, cedar", source: "Tech pack, page 3" },
      ],
      note: "Fragrance or Home? The tech pack calls it a room and linen mist.",
    },
    {
      ...mistChange("pillow-mist_100ml_spec.pdf", gen("mist100-pack")),
      id: "fp-zip-mist",
      files: [
        pic("PM100_front.jpg", gen("mist100-pack")),
        pic("PM100_side.jpg", gen("mist100-pack")),
        pic("PM100_hand.jpg", gen("mist100-pack")),
        doc("pillow-mist_100ml_spec.pdf", "spec"),
        doc("PM_label_100ml.pdf", "artwork"),
      ],
    },
    {
      id: "fp-zip-holder",
      status: "unsure",
      name: "Stoneware holder",
      variant: "Name not found",
      kindId: "kind-home",
      kindConfidence: "low",
      confidence: "low",
      images: [gen("holder-front"), gen("holder-top"), gen("holder-lit")],
      files: [
        pic("IMG_4471.HEIC", gen("holder-front"), 3_100_000),
        pic("IMG_4472.HEIC", gen("holder-top"), 3_000_000),
        pic("IMG_4480.HEIC", gen("holder-lit"), 3_400_000),
      ],
      note: "These 3 pictures might be one product. The Engine found no name, size or label for it.",
      fields: [
        { fieldId: "vessel", label: "Vessel", value: "Ceramic", source: "Pictures" },
        { fieldId: "vessel-finish", label: "Vessel finish", value: "Matte", source: "Pictures" },
      ],
    },
  ],
};

export const importScripts: Record<ImportSource, ImportScript> = { website, csv, zip };

/** The Fume fields a CSV column can map to. */
export const csvFields: { id: string; label: string }[] = [
  { id: "name", label: "Name" },
  { id: "variant", label: "Size or variant" },
  { id: "sku", label: "SKU" },
  { id: "gtin", label: "Barcode (GTIN)" },
  { id: "price", label: "Price" },
  { id: "kind", label: "Kind of product" },
  { id: "net", label: "Net content" },
  { id: "inci", label: "Ingredients (INCI)" },
  { id: "claims", label: "Claims you may use" },
  { id: "description", label: "Description" },
  { id: "image", label: "Picture link" },
];
