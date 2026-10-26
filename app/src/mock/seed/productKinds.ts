// Product kinds: a product category as a schema, like a Studio mode. Every field has a level (short: always on top;
// full: the kind's sections; technical: factory data beside the files); `required` means the Engine needs it, and
// `compliance` limits what a creative may say. Field types include a fibre blend (rows of fibre and %, summing to 100),
// a measurement table (points of measure by size, with tolerance) and parts (material, finish, colour, decoration per
// part). Fields and values come from product-data-research.md §7–17 (tech packs, BOMs, spec sheets, EU law).
import type { FibreBlend, ProductFile, ProductKind, ShotSlot, SpecEntry, SpecField, SpecGroup } from "../../contract";

/** Category pictures (made with Higgsfield, recraft_v4_1) go in public/demo/kinds/<name>.jpg; list a name here once
 *  its file is there. Until then the kind grid shows the kind's icon on the quiet surface. */
const KIND_PICTURES_READY: string[] = [
  "skincare",
  "makeup",
  "hair",
  "fragrance",
  "apparel",
  "footwear",
  "bags",
  "jewellery",
  "candle",
  "furniture",
  "food",
  "supplements",
  "electronics",
  "other",
];

const kindImg = (name: string) =>
  KIND_PICTURES_READY.includes(name) ? `${import.meta.env.BASE_URL}demo/kinds/${name}.jpg` : undefined;

// ─── Field builders ─────────────────────────────────────────────────────────

type Opt = Partial<Omit<SpecField, "id" | "label" | "type">>;

const F = (id: string, label: string, type: SpecField["type"], o: Opt = {}): SpecField => ({
  id,
  label,
  type,
  required: false,
  level: "full",
  ...o,
});

const R = (id: string, label: string, type: SpecField["type"], o: Opt = {}): SpecField =>
  F(id, label, type, { ...o, required: true });

const S = (id: string, label: string, help: string, required = false): ShotSlot => ({ id, label, help, required });

const G = (id: SpecGroup["id"], fields: SpecField[], title?: string, text?: string): SpecGroup => ({
  id,
  title: title ?? groupTitle[id],
  fields,
  ...(text ? { text } : {}),
});

const short: Opt = { level: "short" };

const tech: Opt = { level: "technical" };

/** A choice with real options. */
const ch = (options: string[], o: Opt = {}): Opt => ({ options, ...o });

const groupTitle: Record<SpecGroup["id"], string> = {
  identity: "What it is",
  size: "Size and shape",
  materials: "Materials and finish",
  construction: "Construction",
  packaging: "Packaging parts",
  decoration: "Decoration",
  formula: "Formula",
  label: "Label and text",
  trims: "Trims and details",
  variants: "Variants",
  care: "Care and origin",
  use: "Use and claims",
};

// ─── Shared vocabularies ────────────────────────────────────────────────────

const finishes = ["Matte", "Satin", "Gloss", "Frosted", "Metallic", "Brushed", "Soft-touch", "Textured"];

const decorations = [
  "Screen print",
  "Hot-foil",
  "Cold-foil",
  "Pad print",
  "Emboss",
  "Deboss",
  "Spot UV",
  "Pressure-sensitive label",
  "Shrink sleeve",
  "Metallisation",
  "Frosting",
  "Laser engraving",
];

const apparelPoms = [
  "Chest width ½",
  "Body length from HPS",
  "Shoulder width",
  "Sleeve length from CB",
  "Armhole straight",
  "Sleeve opening",
  "Hem width",
  "Neck width",
  "Front neck drop",
  "Hem rib depth",
  "Cuff rib depth",
  "Neck rib depth",
];

const certifications = [
  "RWS",
  "GOTS",
  "OEKO-TEX 100",
  "Mulesing-free",
  "GRS",
  "FSC",
  "Leather Working Group",
  "Fairtrade",
  "COSMOS",
  "Vegan",
];

// Fields many kinds share.
const net = (units = ["ml", "g"], o: Opt = {}) =>
  R("net", "Net content", "number", {
    units,
    help: "As printed on the pack. The Engine writes it exactly like this.",
    compliance: true,
    level: "short",
    ...o,
  });

const dims = (help = "Measure it standing on its base. For a round product, give the diameter.", o: Opt = {}) =>
  R("dims", "Dimensions", "dimensions", { units: ["mm", "cm"], help, ...o });

const front = R("label-front", "Front label", "text", {
  detail: "label",
  help: "Every line on the front, top to bottom.",
});

const sizePrinted = R("label-size", "Size as printed", "text", {
  detail: "text",
  help: "The Engine reads it on every creative and puts it back when it reads wrong.",
});

const wordmark = R("wordmark", "Wordmark", "text", {
  detail: "logo",
  help: "The brand name as it sits on the product.",
});

const back = F("label-back", "Back label", "text", {
  help: "Only seen in back shots. Paste it or let the Engine read it from a photo.",
});

const claims = F("claims", "Claims you may use", "list", {
  compliance: true,
  help: "Only these lines are said about the product. Every claim must be true and backed.",
});

const sizes = F("sizes", "Sizes", "list", { help: "Other sizes of the same product, each its own variant." });

const colourways = R("colourways", "Colourways", "list", {
  level: "short",
  help: "Each colour with its name and hex; add the Pantone code (TCX for textiles) if you have it.",
});

const finish = (id = "finish", label = "Finish", req = true, o: Opt = {}) =>
  (req ? R : F)(id, label, "finish", {
    options: finishes,
    help: "Matte and satin look alike in photos, so the Engine asks.",
    ...o,
  });

const decoration = (req = true) =>
  (req ? R : F)("decoration", "Decoration methods", "list", {
    options: decorations,
    help: "How the words and the logo are put on the pack. Hot-foil shines, screen print sits flat, an emboss casts a shadow.",
  });

const foil = F("foil-colour", "Foil colour", "colour", {
  help: "Gold, copper, silver or a coloured foil, if there is one.",
});

const origin = F("origin", "Made in", "text", { compliance: true, placeholder: "Portugal" });

const certs = F("certifications", "Certifications", "list", {
  options: certifications,
  compliance: true,
  help: "Only marks the product truly has may appear on a creative.",
});

const neckFinish = F("neck-finish", "Neck finish", "choice", {
  ...ch(["18/415", "20/410", "24/410", "28/410", "GL 18", "FEA 15 crimp", "FEA 13 crimp"]),
  ...tech,
  help: "The thread or crimp the closure sits on (from the bottle's drawing).",
});

const pcr = F("pcr", "Recycled content", "number", {
  units: ["% PCR"],
  ...tech,
  compliance: true,
  help: "Only say “recycled” on a creative when this is filled.",
});

const labelStock = R(
  "label-stock",
  "Label material",
  "choice",
  ch(["Uncoated paper", "Textured paper", "Coated paper", "White PP", "Clear PP", "Kraft", "Printed on the pack"]),
);

const labelFinish = finish("label-finish", "Label finish");

const carton = F("carton", "Outer box", "text", {
  help: "Board, finish and print: “Uncoated board, blind emboss, printed inside”.",
});

const pao = F("pao", "PAO and batch", "text", {
  compliance: true,
  ...tech,
  help: "The open-jar symbol (12M) and where the batch code sits.",
});

const fileKinds = {
  dieline: {
    kind: "dieline",
    label: "Dieline",
    help: "The flat drawing of the box or label with its measures (PDF, AI).",
  },
  artwork: {
    kind: "artwork",
    label: "Label artwork",
    help: "The print file of the label, so every letter is exact (PDF, AI, SVG).",
  },
  model: {
    kind: "model",
    label: "3D model",
    help: "If you have one (GLB, OBJ, STEP), the Engine keeps the shape exactly.",
  },
  spec: {
    kind: "spec",
    label: "Component spec sheet",
    help: "The supplier's spec of each part: material, finish, colour, decoration (PDF, XLSX).",
  },
  techpack: {
    kind: "techpack",
    label: "Tech pack",
    help: "Measures, materials, construction and colourways in one file (PDF, XLSX). It fills most of this page.",
  },
  flats: { kind: "flats", label: "Flats", help: "The flat drawings, front and back (AI, SVG, PDF)." },
  cad: { kind: "cad", label: "CAD", help: "Pattern pieces (DXF-AAMA), a last or a mould (STEP, DWG)." },
} satisfies Record<string, ProductKind["files"][number]>;

const beautyFiles: ProductKind["files"] = [fileKinds.dieline, fileKinds.artwork, fileKinds.spec, fileKinds.model];

// Shot slots the GS1 image standard names (front, back, sides, top), plus scale and in use.
const shot = {
  front: S("front", "Front", "Straight on, label readable, on white.", true),
  back: S("back", "Back", "Straight on, the back label readable.", true),
  side: S("side", "Side", "From the left, to show depth and the shoulder.", true),
  top: S("top", "Top", "From above: the cap, the lid, the wax.", false),
  detail: S("detail", "Detail", "Close: the texture, a seam, a stone, the print.", false),
  scale: S("scale", "In a hand", "In a hand or beside something known, for scale.", false),
  open: S("open", "Open", "Cap off, lid off, open: what the customer sees in use.", false),
};

/** The pack and its decoration, shared by skincare, hair, makeup and fragrance (research §12). */
const beautyDecoration = G(
  "decoration",
  [decoration(), foil, labelStock, labelFinish, carton],
  undefined,
  "How the words and the logo sit on each part. The Engine copies the method, not only the colour.",
);

// ─── The kinds ──────────────────────────────────────────────────────────────

export const productKinds: ProductKind[] = [
  {
    id: "kind-skincare",
    name: "Skincare and body",
    examples: "Serum, oil, cream, balm, body wash",
    image: kindImg("skincare"),
    parts: ["Bottle", "Cap", "Label", "Box"],
    files: beautyFiles,
    groups: [
      G("size", [
        net(),
        dims(),
        R("fill-level", "Fill level", "choice", {
          ...ch(["To the shoulder", "To the neck", "Three-quarters", "Not seen (opaque)"]),
          help: "Seen through clear and amber glass.",
        }),
        F("brimful", "Brimful capacity", "number", { units: ["ml"], ...tech }),
      ]),
      G(
        "materials",
        [
          R(
            "container",
            "Container",
            "choice",
            ch(["Bottle", "Pump bottle", "Dropper bottle", "Jar", "Tube", "Airless", "Tin", "Stick"]),
          ),
          R(
            "container-material",
            "Container material",
            "material",
            ch([
              "Clear glass",
              "Amber glass",
              "Frosted glass",
              "Opal glass",
              "PET",
              "PETG",
              "PP",
              "HDPE",
              "Aluminium",
              "Tin",
            ]),
          ),
          finish(),
          neckFinish,
          pcr,
        ],
        "Container",
      ),
      beautyDecoration,
      G("formula", [
        R("texture", "Texture", "choice", {
          ...ch(["Oil", "Serum", "Gel", "Cream", "Balm", "Foam", "Lotion"]),
          level: "short",
        }),
        R("formula-colour", "Colour of the formula", "colour", {
          help: "Seen through clear glass, in a swatch, on skin.",
        }),
        F("viscosity", "How it flows", "choice", ch(["Water-thin", "Fluid", "Gel", "Thick", "Solid"])),
        F("scent", "Scent", "text", { placeholder: "Lavender and almond, soft" }),
      ]),
      G("label", [front, sizePrinted, wordmark, back, pao]),
      G("variants", [sizes]),
      G("use", [
        F("how", "How it is used", "text", { help: "Hands and texture shots follow it." }),
        F("inci", "Ingredients (INCI)", "text", {
          compliance: true,
          help: "Printed on the pack by law. A claimed ingredient must be in it.",
        }),
        claims,
        F("warnings", "Warnings", "text", { compliance: true }),
        origin,
      ]),
    ],
    shots: [
      shot.front,
      shot.back,
      shot.side,
      shot.top,
      S("label", "Label, close", "The label straight on, close enough to read every letter.", false),
      shot.open,
      shot.scale,
    ],
  },
  {
    id: "kind-makeup",
    name: "Makeup",
    examples: "Lipstick, foundation, palette, mascara",
    image: kindImg("makeup"),
    parts: ["Case", "Cap", "Applicator", "Box"],
    files: beautyFiles,
    groups: [
      G(
        "variants",
        [
          R("shades", "Shades", "list", {
            level: "short",
            help: "The shade is the product: name, hex and Pantone for each.",
          }),
          F("undertone", "Undertones", "list", ch(["Cool", "Neutral", "Warm", "Olive"])),
        ],
        "Shades",
      ),
      G("size", [
        net(["g", "ml"]),
        dims("Closed, standing. Give the length open too in the note if it changes."),
        F("pan", "Pan or bullet size", "text", { ...tech, placeholder: "Ø 12.7 mm bullet" }),
      ]),
      G(
        "materials",
        [
          R(
            "case-material",
            "Case material",
            "material",
            ch(["Aluminium", "Plastic", "Glass", "Paper", "Refillable metal", "Zamac"]),
          ),
          finish("case-finish", "Case finish"),
          R(
            "mechanism",
            "How it opens",
            "choice",
            ch(["Twist-up", "Click", "Magnetic", "Screw cap", "Compact hinge", "Pull-off cap"]),
          ),
          R("applicator", "Applicator", "choice", ch(["Bullet", "Doe-foot", "Brush", "Sponge", "Wand", "None"])),
          pcr,
        ],
        "Case",
      ),
      G("formula", [
        R("product-finish", "Finish of the makeup", "choice", {
          ...ch(["Matte", "Satin", "Dewy", "Shimmer", "Metallic", "Glitter"]),
          level: "short",
        }),
        R("coverage", "Coverage", "choice", ch(["Sheer", "Medium", "Full", "Buildable"])),
      ]),
      beautyDecoration,
      G("label", [wordmark, F("shade-label", "Shade name on the base", "text", { detail: "text" }), pao]),
      G("use", [F("inci", "Ingredients (INCI)", "text", { compliance: true }), claims, origin]),
    ],
    shots: [
      S("closed", "Closed", "Standing, cap on.", true),
      S("open", "Open", "Cap off, the bullet or pan showing.", true),
      S("swatch", "Swatch", "On skin, light to deep.", false),
      shot.top,
      shot.scale,
    ],
  },
  {
    id: "kind-hair",
    name: "Hair",
    examples: "Shampoo, mask, styling, tools",
    image: kindImg("hair"),
    parts: ["Bottle", "Pump", "Label"],
    files: beautyFiles,
    groups: [
      G("size", [net(), dims()]),
      G(
        "materials",
        [
          R("dispensing", "How it dispenses", "choice", {
            ...ch(["Pump", "Flip-top", "Disc-top", "Spray", "Tub", "Tube"]),
            level: "short",
          }),
          R("container-material", "Container material", "material", ch(["PET", "HDPE", "PP", "Glass", "Aluminium"])),
          finish(),
          neckFinish,
          pcr,
        ],
        "Container",
      ),
      beautyDecoration,
      G("formula", [
        R("formula-colour", "Colour of the formula", "colour"),
        F("viscosity", "How it flows", "choice", ch(["Water-thin", "Fluid", "Gel", "Thick", "Paste"])),
        F("hair-type", "For hair that is", "list", ch(["Fine", "Thick", "Curly", "Coily", "Coloured", "All hair"])),
      ]),
      G("label", [front, sizePrinted, wordmark, back, pao]),
      G("variants", [sizes]),
      G("use", [
        F("how", "How it is used", "text"),
        F("inci", "Ingredients (INCI)", "text", { compliance: true }),
        claims,
        origin,
      ]),
    ],
    shots: [
      shot.front,
      shot.back,
      shot.side,
      S("nozzle", "Cap or nozzle", "Close, from above.", false),
      S("use", "In use", "In the hand or in the hair.", false),
    ],
  },
  {
    id: "kind-fragrance",
    name: "Fragrance",
    examples: "Eau de parfum, mist, perfume oil",
    image: kindImg("fragrance"),
    parts: ["Bottle", "Cap", "Atomiser", "Collar", "Label", "Box"],
    files: beautyFiles,
    groups: [
      G("identity", [
        R("concentration", "Concentration", "choice", {
          ...ch(["Extrait", "Parfum", "Eau de parfum", "Eau de toilette", "Eau de cologne", "Mist", "Perfume oil"]),
          level: "short",
          help: "It is printed on the bottle.",
        }),
        F(
          "family",
          "Olfactive family",
          "choice",
          ch(["Floral", "Woody", "Amber", "Fresh", "Citrus", "Gourmand", "Chypre", "Fougère"]),
        ),
      ]),
      G("size", [net(["ml"]), dims()]),
      G(
        "materials",
        [
          R(
            "glass",
            "Glass",
            "material",
            ch([
              "Clear glass",
              "Extra-flint glass",
              "Frosted glass",
              "Tinted glass",
              "Lacquered glass",
              "Heavy-base glass",
            ]),
          ),
          R("juice-colour", "Colour of the liquid", "colour", {
            help: "Seen through the glass, so it shapes every shot.",
          }),
          R(
            "cap-material",
            "Cap",
            "material",
            ch(["Zamac", "Surlyn", "Wood", "Aluminium", "Plastic", "Stone", "No cap"]),
          ),
          finish("cap-finish", "Cap finish"),
          neckFinish,
        ],
        "Bottle and cap",
      ),
      beautyDecoration,
      G("label", [front, sizePrinted, wordmark]),
      G("variants", [sizes]),
      G("use", [
        F("notes", "Notes", "list", { help: "Top, heart and base. For the mood of a scene, never a claim." }),
        F("perfumer", "Perfumer", "text", tech),
        F("allergens", "Allergens (IFRA)", "text", { compliance: true }),
        claims,
        origin,
      ]),
    ],
    shots: [
      shot.front,
      shot.side,
      shot.top,
      S("cap-off", "Cap off", "The atomiser and collar.", false),
      S("box", "Box", "The box, front.", false),
      shot.scale,
    ],
  },
  {
    id: "kind-apparel",
    name: "Fashion and apparel",
    examples: "Knitwear, tops, dresses, outerwear",
    image: kindImg("apparel"),
    parts: ["Main fabric", "Rib trims", "Woven label"],
    files: [
      fileKinds.techpack,
      fileKinds.flats,
      { ...fileKinds.cad, help: "Pattern pieces (DXF-AAMA) or the grading file." },
      {
        ...fileKinds.model,
        label: "3D garment",
        help: "CLO (.zprj) or Browzwear: the Engine keeps the drape and the proportions.",
      },
      {
        ...fileKinds.artwork,
        label: "Print or jacquard artwork",
        help: "Any print, intarsia or jacquard, so it is exact.",
      },
    ],
    groups: [
      G("identity", [
        R("garment", "Garment", "choice", {
          ...ch([
            "Sweater",
            "Cardigan",
            "Vest",
            "T-shirt",
            "Shirt",
            "Dress",
            "Trousers",
            "Skirt",
            "Jacket",
            "Coat",
            "Other",
          ]),
          level: "short",
        }),
        F("style-no", "Style number", "text", { placeholder: "LYS-KN-001" }),
        F("season", "Season", "text", { placeholder: "AW26" }),
        F("gender", "For", "choice", ch(["Women", "Men", "Unisex", "Kids"])),
      ]),
      G(
        "materials",
        [
          R("composition", "Fibre blend", "blend", {
            level: "short",
            compliance: true,
            help: "Each fibre by weight, highest first; it must add up to 100 %. The label may differ by 3 % at most (EU 1007/2011).",
          }),
          R("yarn-finish", "Yarn finish", "choice", {
            ...ch(["Smooth", "Brushed", "Mercerised", "Superwash", "Felted / boiled", "Raw", "Melange"]),
            help: "A brushed yarn has a soft halo; the Engine draws it.",
          }),
          F("dye", "Dyed", "choice", ch(["Yarn-dyed", "Piece-dyed", "Garment-dyed", "Undyed"])),
          F("yarn-count", "Yarn count", "text", {
            placeholder: "2/28 Nm",
            help: "Metres per gram, and how many ends: 2/28 Nm is two ends of a 28 Nm yarn.",
          }),
          F(
            "yarn-weight",
            "Yarn weight",
            "choice",
            ch(["Lace", "Fingering", "Sport", "DK", "Worsted", "Aran", "Bulky"]),
          ),
          F("gsm", "Fabric weight", "number", { units: ["g/m²"], help: "Decides how sheer it reads." }),
          F("garment-weight", "Garment weight, sample size", "number", { units: ["g"], ...tech }),
          F("yarn-supplier", "Yarn supplier and quality", "text", {
            ...tech,
            placeholder: "Zegna Baruffa, Cashwool 2/28",
          }),
        ],
        "Yarn and fabric",
        "What it is made of. The blend and the finish decide how the surface takes the light.",
      ),
      G(
        "construction",
        [
          R("knit", "Knit structure", "choice", {
            ...ch([
              "Jersey",
              "Rib 1:1",
              "Rib 2:2",
              "Half cardigan",
              "Full cardigan",
              "Cable",
              "Waffle",
              "Pointelle",
              "Moss",
              "Jacquard",
              "Intarsia",
              "Links-links",
              "Woven",
            ]),
            level: "short",
          }),
          R("gauge", "Gauge", "choice", {
            ...ch(["3GG", "5GG", "7GG", "10GG", "12GG", "14GG", "16GG", "18GG"]),
            help: "Needles per inch on the machine: 3–5GG is chunky, 12GG a fine knit, 16GG and up very fine.",
          }),
          F("make", "Make", "choice", ch(["Fully fashioned", "Cut and sew", "Whole garment (seamless)"])),
          R(
            "neckline",
            "Neckline",
            "choice",
            ch(["Crew", "Mock neck", "Turtleneck", "V-neck", "Boat", "Polo", "Hood", "Collar"]),
          ),
          R("sleeve", "Sleeve", "choice", ch(["Set-in", "Raglan", "Saddle", "Drop shoulder", "Sleeveless"])),
          R("trim-rib", "Rib trims", "choice", {
            ...ch(["Rib 1:1", "Rib 2:2", "Tubular", "Roll edge", "Same as body", "None"]),
            help: "The neck, cuffs and hem.",
          }),
          R("hem-rib", "Hem rib depth", "number", { units: ["mm"] }),
          R("cuff-rib", "Cuff rib depth", "number", { units: ["mm"] }),
          F("neck-rib", "Neck rib depth", "number", { units: ["mm"] }),
          R("drape", "Drape", "choice", {
            ...ch(["Crisp", "Soft", "Fluid", "Structured"]),
            help: "How it falls on a body and on a hanger.",
          }),
          F("seams", "Seams", "choice", { ...ch(["Linked", "Cup-seamed", "Overlocked", "Flatlock"]), ...tech }),
          F("stitch-density", "Stitch density", "text", { ...tech, placeholder: "56 wales × 84 courses per 10 cm" }),
        ],
        "Knit and construction",
      ),
      G(
        "size",
        [
          R("fit", "Fit", "choice", { ...ch(["Slim", "Regular", "Relaxed", "Oversized", "Boxy"]), level: "short" }),
          R("measures", "Points of measure", "measurements", {
            sizes: ["XS", "S", "M", "L", "XL"],
            poms: apparelPoms,
            help: "Each point of measure per size, in cm, with its tolerance. The base size is the sample.",
          }),
          F("size-run", "Size run", "list", { placeholder: "XS, S, M, L, XL" }),
          F("model", "Model size and height", "text", { placeholder: "Wears S, 176 cm" }),
          F("grading", "Grade rule", "text", { ...tech, placeholder: "Chest +2 cm per size, length +1.5 cm" }),
          F("measured", "Measured", "choice", { ...ch(["Flat, relaxed", "Flat, stretched", "On the form"]), ...tech }),
        ],
        "Fit and measures",
        "Proportion on a body. The Engine draws the garment from these, so a size M looks like a size M.",
      ),
      G(
        "trims",
        [
          R("trims", "Labels and trims", "parts", {
            help: "Every label, button and tag: material, finish, colour, and where it sits.",
          }),
          R("branding", "Branding and where it sits", "text", { detail: "label" }),
        ],
        "Trims and branding",
      ),
      G("variants", [colourways]),
      G("care", [
        F("care", "Care", "text", { compliance: true, placeholder: "Hand wash 30 °C, dry flat" }),
        F("care-symbols", "Care symbols", "list", {
          ...ch([
            "Hand wash",
            "Machine wash 30",
            "Do not bleach",
            "Dry flat",
            "Do not tumble dry",
            "Iron low",
            "Dry clean",
          ]),
          ...tech,
          compliance: true,
        }),
        origin,
        certs,
      ]),
      G("use", [claims]),
    ],
    shots: [
      S("flat-front", "Flat, front", "Laid flat, straight from above.", true),
      S("flat-back", "Flat, back", "Laid flat, the back.", true),
      S("on-body", "On a body", "Front, full length.", false),
      S("detail", "Detail", "The knit, a rib, the label.", true),
      S("folded", "Folded", "As it is sold.", false),
    ],
  },
  {
    id: "kind-footwear",
    name: "Footwear",
    examples: "Sneakers, boots, sandals",
    image: kindImg("footwear"),
    parts: ["Upper", "Lining", "Outsole", "Laces"],
    files: [
      fileKinds.model,
      fileKinds.techpack,
      { ...fileKinds.cad, help: "The last or the outsole mould (STEP, IGES)." },
      fileKinds.flats,
    ],
    groups: [
      G("identity", [
        R("style", "Style", "choice", {
          ...ch([
            "Sneaker",
            "Boot",
            "Chelsea boot",
            "Loafer",
            "Derby",
            "Oxford",
            "Sandal",
            "Mule",
            "Pump",
            "Ballet flat",
          ]),
          level: "short",
        }),
        R("construction", "Construction", "choice", {
          ...ch(["Cemented", "Goodyear welted", "Blake stitched", "Vulcanised", "Strobel", "Injection moulded"]),
          help: "How the upper meets the sole. A welt shows.",
        }),
      ]),
      G("materials", [
        R("upper", "Upper material", "material", {
          ...ch(["Full-grain leather", "Suede", "Nubuck", "Patent", "Canvas", "Knit", "Synthetic"]),
          level: "short",
        }),
        finish("upper-finish", "Upper finish"),
        R("components", "Components", "parts", {
          help: "Upper, lining, sock liner, midsole, outsole, heel: material, finish and colour each.",
        }),
        R("outsole", "Outsole", "choice", ch(["Rubber", "Crepe", "EVA", "TPU", "Leather", "Cork"])),
        R("outsole-colour", "Outsole colour", "colour"),
        F("stitching", "Stitching colour", "colour"),
        F("leather-thickness", "Leather thickness", "number", { units: ["mm"], ...tech }),
        F("hardness", "Outsole hardness", "number", { units: ["Shore A"], ...tech }),
      ]),
      G(
        "size",
        [
          R("heel", "Heel height", "number", { units: ["mm"], level: "short" }),
          R("toe", "Toe shape", "choice", ch(["Round", "Almond", "Square", "Pointed"])),
          F("stack", "Platform or stack", "number", { units: ["mm"] }),
          F("shaft", "Shaft height", "number", { units: ["mm"] }),
          F("sizes", "Size run", "text", { placeholder: "EU 36–46, half sizes" }),
          F("size-system", "Size system", "choice", ch(["EU", "UK", "US"])),
          F("width", "Width", "choice", ch(["Narrow", "Standard", "Wide"])),
          F("last", "Last", "text", { ...tech, placeholder: "Last 2214, almond toe" }),
          F("toe-spring", "Toe spring", "number", { units: ["mm"], ...tech }),
        ],
        "Size and last",
      ),
      G("variants", [colourways]),
      G("label", [
        R("logo", "Logo and where it sits", "text", { detail: "logo" }),
        F("sock-print", "Sock liner print", "text", { detail: "text" }),
      ]),
      G("care", [
        F("materials-label", "Materials label", "text", {
          compliance: true,
          help: "Upper, lining and sock, outsole, as the law asks (94/11/EC).",
        }),
        origin,
        certs,
      ]),
    ],
    shots: [
      S("lateral", "Outside", "The outer side, the hero view.", true),
      S("medial", "Inside", "The inner side.", false),
      shot.front,
      S("back", "Back", "The heel.", false),
      S("top", "Top", "From above.", true),
      S("sole", "Sole", "The sole, flat.", true),
      S("on-foot", "On foot", "Worn, for scale.", false),
    ],
  },
  {
    id: "kind-bags",
    name: "Bags and accessories",
    examples: "Bags, belts, wallets, scarves",
    image: kindImg("bags"),
    parts: ["Body", "Strap", "Hardware", "Lining"],
    files: [
      fileKinds.model,
      fileKinds.techpack,
      { ...fileKinds.artwork, label: "Logo artwork", help: "The emboss or plate artwork, so the logo is exact." },
    ],
    groups: [
      G("identity", [
        R("type", "Type", "choice", {
          ...ch(["Tote", "Shoulder bag", "Crossbody", "Clutch", "Backpack", "Belt bag", "Wallet", "Belt", "Scarf"]),
          level: "short",
        }),
      ]),
      G("size", [
        dims("Width, height and depth, standing, without the strap.", { level: "short" }),
        R("drop", "Strap drop", "number", {
          units: ["cm"],
          help: "From the top of the strap to the top of the bag: where it sits on a body.",
        }),
        F("handle-drop", "Handle drop", "number", { units: ["cm"] }),
        F("drop-range", "Adjustable drop", "text", { placeholder: "48–58 cm" }),
        F("capacity", "Capacity", "number", { units: ["l"] }),
        F("weight", "Weight", "number", { units: ["g"] }),
      ]),
      G("materials", [
        R("material", "Main material", "material", {
          ...ch([
            "Full-grain leather",
            "Top-grain leather",
            "Nappa",
            "Suede",
            "Nubuck",
            "Patent",
            "Saffiano",
            "Vegetable-tanned leather",
            "Canvas",
            "Nylon",
            "Raffia",
          ]),
          level: "short",
        }),
        finish(),
        R("edges", "Edges", "choice", {
          ...ch(["Painted", "Burnished", "Turned", "Raw"]),
          help: "Painted edges read as a fine line around every panel.",
        }),
        F("edge-colour", "Edge paint colour", "colour"),
        R("components", "Components", "parts", { help: "Body, gusset, handle, strap, lining, base." }),
        F("leather-thickness", "Leather thickness", "number", { units: ["mm"], ...tech }),
        F("stitching", "Stitching", "text", { ...tech, placeholder: "8 SPI, tone-on-tone" }),
      ]),
      G(
        "trims",
        [
          R("hardware", "Hardware finish", "choice", {
            ...ch(["Gold, polished", "Gold, brushed", "Silver, polished", "Palladium", "Gunmetal", "Antique brass"]),
            level: "short",
          }),
          R("closure", "Closure", "choice", ch(["Zip", "Magnetic snap", "Turn lock", "Flap", "Drawstring", "Open"])),
          F("hardware-parts", "Hardware parts", "parts", { help: "Clasp, D-rings, zip puller, feet, chain." }),
          F("base-metal", "Base metal", "choice", { ...ch(["Brass", "Zinc alloy", "Stainless steel"]), ...tech }),
          F("plating", "Plating thickness", "number", { units: ["µm"], ...tech }),
        ],
        "Hardware",
      ),
      G("variants", [colourways]),
      G("label", [
        R("logo", "Logo, stamp or emboss", "text", { detail: "logo" }),
        R(
          "logo-method",
          "How the logo is made",
          "choice",
          ch(["Blind emboss", "Foil emboss", "Metal plate", "Print", "Woven label"]),
        ),
      ]),
      G("use", [F("interior", "Inside", "text", { help: "Lining colour, pockets." }), origin]),
    ],
    shots: [
      shot.front,
      shot.back,
      shot.side,
      S("open", "Open", "From above, open.", false),
      S("hardware", "Hardware", "Close, the clasp or buckle.", true),
      S("on-body", "Worn", "On a shoulder or in a hand, for scale.", false),
    ],
  },
  {
    id: "kind-jewellery",
    name: "Jewellery and watches",
    examples: "Rings, necklaces, earrings, watches",
    image: kindImg("jewellery"),
    parts: ["Metal", "Stone", "Clasp"],
    files: [
      { ...fileKinds.cad, help: "The piece's CAD (.3dm, .stl): every prong and link exact." },
      fileKinds.model,
      fileKinds.techpack,
    ],
    groups: [
      G("identity", [
        R("type", "Type", "choice", {
          ...ch(["Ring", "Necklace", "Earrings", "Bracelet", "Watch", "Brooch", "Anklet"]),
          level: "short",
        }),
      ]),
      G(
        "materials",
        [
          R("metal", "Metal", "material", {
            ...ch([
              "925 sterling silver",
              "9k gold",
              "14k gold",
              "18k gold",
              "Platinum 950",
              "Stainless steel 316L",
              "Brass",
              "Titanium",
            ]),
            level: "short",
          }),
          R("metal-colour", "Metal colour", "choice", {
            ...ch(["Yellow", "White", "Rose", "Two-tone"]),
            level: "short",
          }),
          R("plating", "Plating", "choice", ch(["None", "Gold vermeil", "Gold plated", "Rhodium plated", "PVD"])),
          R("surface", "Surface", "choice", ch(["High polish", "Satin", "Hammered", "Sandblasted", "Oxidised"])),
          F("plating-microns", "Plating thickness", "number", {
            units: ["µm"],
            ...tech,
            compliance: true,
            help: "Vermeil is at least 2.5 µm on silver; under 0.175 µm is only “gold washed”.",
          }),
          F("plating-karat", "Plating karat", "choice", { ...ch(["14k", "18k", "22k", "24k"]), ...tech }),
        ],
        "Metal",
      ),
      G(
        "trims",
        [
          R("stones", "Stones", "parts", {
            help: "Each stone: type, cut, colour and size (carat or mm). Note lab-grown or natural.",
          }),
          R("setting", "Setting", "choice", ch(["Prong", "Bezel", "Pavé", "Channel", "Flush", "Tension", "No stones"])),
          F("grading", "Grading or certificate", "text", { ...tech, compliance: true, placeholder: "IGI, F VS1" }),
        ],
        "Stones",
      ),
      G("size", [
        dims("In mm."),
        F("chain", "Chain length", "number", { units: ["cm"] }),
        F(
          "chain-type",
          "Chain",
          "choice",
          ch(["Cable", "Curb", "Box", "Snake", "Figaro", "Rope", "Paperclip", "Bead"]),
        ),
        F("band", "Band width", "number", { units: ["mm"] }),
        F("clasp", "Clasp", "choice", ch(["Lobster", "Spring ring", "Toggle", "Box", "Magnetic", "Hook"])),
        F("ring-sizes", "Ring sizes", "text", { placeholder: "EU 48–60" }),
        F("case", "Watch case diameter", "number", { units: ["mm"] }),
        F("dial", "Dial colour", "colour"),
        F("weight", "Weight", "number", { units: ["g"], ...tech }),
      ]),
      G("label", [F("engraving", "Engraving or hallmark", "text", { detail: "text" })]),
      G("care", [F("nickel", "Nickel and hallmark", "text", { compliance: true }), origin, certs]),
    ],
    shots: [
      shot.front,
      shot.side,
      S("back", "Back or clasp", "The back, the clasp.", false),
      S("macro", "Macro", "Very close: facets, prongs, links.", true),
      S("on-body", "Worn", "On a hand or neck, for scale.", false),
    ],
  },
  {
    id: "kind-home",
    name: "Home and candles",
    examples: "Candles, diffusers, ceramics, textiles",
    image: kindImg("candle"),
    parts: ["Vessel", "Lid", "Wick", "Label", "Box"],
    files: [fileKinds.artwork, fileKinds.dieline, fileKinds.model],
    groups: [
      G("size", [
        net(["g", "ml"]),
        dims(),
        R("wicks", "Wicks", "number", { units: ["wicks"], help: "It shows when it is lit." }),
      ]),
      G(
        "formula",
        [
          R("wax", "Wax", "choice", {
            ...ch(["Soy", "Rapeseed", "Coconut", "Beeswax", "Paraffin", "Blend"]),
            level: "short",
          }),
          R("wax-colour", "Colour of the wax", "colour"),
          R("wax-surface", "Wax surface", "choice", {
            ...ch(["Smooth", "Frosted", "Rustic"]),
            help: "Natural waxes frost: a soft white bloom on the top.",
          }),
          R("wick-type", "Wick", "choice", {
            ...ch(["Cotton", "Cotton-paper", "Wood", "Crackling wood"]),
            help: "A wood wick is flat and wide, and burns with a low flame.",
          }),
          F("burn", "Burn time", "number", { units: ["h"] }),
          F("wick-series", "Wick series and size", "text", { ...tech, placeholder: "ECO 10" }),
          F("fragrance-load", "Fragrance load", "number", {
            units: ["%"],
            ...tech,
            help: "Of the wax weight; 6–12 % is usual.",
          }),
        ],
        "Wax and wick",
      ),
      G(
        "materials",
        [
          R("vessel", "Vessel", "material", {
            ...ch(["Clear glass", "Amber glass", "Frosted glass", "Ceramic", "Concrete", "Tin", "Stone"]),
            level: "short",
          }),
          finish("vessel-finish", "Vessel finish"),
          R("lid", "Lid", "choice", ch(["None", "Wood", "Ceramic", "Metal", "Travertine", "Glass", "Cork"])),
        ],
        "Vessel",
      ),
      G("decoration", [decoration(), foil, labelStock, carton]),
      G("label", [
        front,
        sizePrinted,
        wordmark,
        F("safety", "Safety label", "text", {
          compliance: true,
          help: "The candle pictograms (EN 15494) on the base or the back.",
        }),
        F("clp", "CLP classification", "text", { ...tech, compliance: true }),
      ]),
      G("use", [F("notes", "Scent notes", "list"), claims, origin]),
    ],
    shots: [
      shot.front,
      shot.side,
      S("top", "Top", "The wax from above.", true),
      S("lid-off", "Lid off", "Lid beside it.", false),
      S("lit", "Lit", "Burning, in a dim room.", false),
      shot.scale,
    ],
  },
  {
    id: "kind-furniture",
    name: "Furniture",
    examples: "Chairs, tables, lamps, shelving",
    image: kindImg("furniture"),
    parts: ["Frame", "Top or seat", "Legs", "Upholstery"],
    files: [
      { ...fileKinds.model, help: "STEP, 3DS or GLB: furniture renders start from the model." },
      { ...fileKinds.cad, label: "CAD drawing", help: "The DWG or PDF drawing with every measure." },
      { ...fileKinds.spec, label: "Spec sheet", help: "Materials, finish codes and fabric per part (PDF)." },
    ],
    groups: [
      G("identity", [
        R("type", "Type", "choice", {
          ...ch(["Chair", "Lounge chair", "Sofa", "Table", "Desk", "Shelving", "Lamp", "Bed", "Stool", "Cabinet"]),
          level: "short",
        }),
      ]),
      G("size", [
        dims("Width, depth and height in cm.", { level: "short" }),
        R("seat", "Seat height", "number", {
          units: ["cm"],
          help: "Proportion against a body: 45 cm is a dining chair, 38 cm a lounge chair.",
        }),
        F("seat-depth", "Seat depth", "number", { units: ["cm"] }),
        F("arm", "Arm height", "number", { units: ["cm"] }),
        F("weight", "Weight", "number", { units: ["kg"], ...tech }),
        F("packed", "Packed size", "text", tech),
      ]),
      G("materials", [
        R("main-material", "Main material", "material", {
          ...ch(["Oak", "Walnut", "Ash", "Beech", "Birch", "Steel", "Aluminium", "Marble", "Travertine", "Glass"]),
          level: "short",
        }),
        R("parts", "Materials per part", "parts", {
          help: "Frame, seat, back, legs, top, upholstery, glides: material, finish and colour each.",
        }),
        R(
          "wood-finish",
          "Wood finish",
          "choice",
          ch(["Oiled", "White oil", "Matt lacquer", "Soap", "Stained", "Painted", "No wood"]),
        ),
        F(
          "metal-finish",
          "Metal finish",
          "choice",
          ch(["Powder-coated", "Chrome", "Brushed steel", "Brass", "No metal"]),
        ),
        R("finish-code", "Finish code", "text", { placeholder: "WO-01 white oil" }),
        R("fabric", "Upholstery fabric", "text", { placeholder: "Maker, quality, colour number" }),
        F("com", "COM yardage", "number", { units: ["m"], ...tech }),
        F("martindale", "Rub test", "number", { units: ["Martindale"], ...tech }),
      ]),
      G("variants", [F("options", "Colour and wood options", "list")]),
      G("label", [F("logo", "Logo or stamp", "text", { detail: "logo" })]),
      G("use", [F("assembly", "Assembly", "choice", ch(["Assembled", "Self-assembly", "Flat-pack"])), certs, origin]),
    ],
    shots: [
      shot.front,
      S("three-quarter", "Three-quarter", "From the front corner, the hero view.", true),
      shot.side,
      S("back", "Back", "From behind.", false),
      S("detail", "Detail", "A joint, the grain, the fabric.", false),
      S("room", "In a room", "For scale.", false),
    ],
  },
  {
    id: "kind-food",
    name: "Food and drink",
    examples: "Drinks, snacks, coffee, chocolate",
    image: kindImg("food"),
    parts: ["Pack", "Closure", "Label"],
    files: [fileKinds.artwork, fileKinds.dieline, fileKinds.model],
    groups: [
      G("size", [net(["ml", "g", "cl"]), dims()]),
      G(
        "materials",
        [
          R("pack", "Pack", "choice", {
            ...ch(["Can", "Glass bottle", "PET bottle", "Pouch", "Box", "Jar", "Wrapper", "Bag"]),
            level: "short",
          }),
          R(
            "pack-material",
            "Pack material",
            "material",
            ch(["Aluminium", "Glass", "PET", "Carton", "Kraft paper", "Foil", "Compostable film"]),
          ),
          finish("pack-finish", "Pack finish"),
          R(
            "closure",
            "Closure",
            "choice",
            ch(["Crown cap", "Screw cap", "Ring pull", "Cork", "Zip", "Tear notch", "None"]),
          ),
        ],
        "Pack",
      ),
      G("decoration", [decoration(false), foil]),
      G(
        "formula",
        [
          R("inside", "What is inside, as it looks", "text", {
            help: "Colour and texture out of the pack: how it pours, breaks, foams.",
          }),
          R("inside-colour", "Its colour", "colour"),
        ],
        "The product itself",
      ),
      G("label", [front, sizePrinted, wordmark, back, F("ean", "EAN / GTIN", "text", tech)]),
      G("variants", [F("flavours", "Flavours", "list")]),
      G("use", [
        F("serving", "How it is served", "text"),
        F("allergens", "Ingredients and allergens", "text", { compliance: true }),
        F("nutrition", "Nutrition per 100 g", "text", { compliance: true, ...tech }),
        F("storage", "Storage and best before", "text", { compliance: true, ...tech }),
        F("claims", "Nutrition and health claims", "list", {
          compliance: true,
          help: "Only claims on the EU's authorised list.",
        }),
        origin,
      ]),
    ],
    shots: [
      shot.front,
      shot.back,
      shot.side,
      S("out", "Out of the pack", "The food or drink itself.", true),
      S("served", "Served", "As it is eaten or poured.", false),
    ],
  },
  {
    id: "kind-supplements",
    name: "Supplements",
    examples: "Capsules, gummies, powders",
    image: kindImg("supplements"),
    parts: ["Pack", "Lid", "Label"],
    files: [fileKinds.artwork, fileKinds.dieline, fileKinds.model],
    groups: [
      G("size", [
        R("count", "Count or net content", "number", { units: ["capsules", "tablets", "g", "ml"], level: "short" }),
        dims(),
      ]),
      G(
        "formula",
        [
          R("format", "Format", "choice", {
            ...ch(["Capsule", "Tablet", "Softgel", "Gummy", "Powder", "Liquid"]),
            level: "short",
          }),
          R("capsule-size", "Capsule size", "choice", {
            ...ch(["000", "00", "0", "1", "2", "3", "4", "Not a capsule"]),
            help: "The lower the number, the larger the capsule.",
          }),
          R("dose-colour", "Colour of the dose", "colour"),
          F(
            "shell",
            "Shell",
            "choice",
            ch(["Gelatin", "HPMC (vegan)", "Pullulan", "Softgel", "Coated tablet", "Uncoated"]),
          ),
          R("dose-look", "The dose, as it looks", "text", { help: "Shape and size in mm." }),
        ],
        "The dose",
      ),
      G(
        "materials",
        [
          R("pack", "Pack", "choice", ch(["Bottle", "Jar", "Pouch", "Blister", "Box", "Tube"])),
          R(
            "pack-material",
            "Pack material",
            "material",
            ch(["Amber glass", "HDPE", "PET", "Kraft pouch", "Aluminium", "Biopolymer"]),
          ),
          finish("pack-finish", "Pack finish"),
          F("closure", "Closure", "choice", ch(["Screw cap", "Child-resistant cap", "Zip", "Flip-top"])),
        ],
        "Pack",
      ),
      G("decoration", [decoration(false), foil, labelStock]),
      G("label", [front, sizePrinted, wordmark, back]),
      G("use", [
        F("dose", "Daily dose and warnings", "text", { compliance: true }),
        F("per-dose", "Ingredients per dose", "text", { compliance: true }),
        F("claims", "Health claims", "list", { compliance: true, help: "Only claims on the EU's register." }),
        certs,
        origin,
      ]),
    ],
    shots: [shot.front, shot.back, shot.side, S("dose", "The dose", "A few out of the pack.", true), shot.scale],
  },
  {
    id: "kind-electronics",
    name: "Electronics",
    examples: "Audio, devices, chargers, lamps",
    image: kindImg("electronics"),
    parts: ["Body", "Screen", "Buttons", "Cable"],
    files: [
      fileKinds.model,
      { ...fileKinds.cad, help: "The industrial design CAD (STEP)." },
      { ...fileKinds.spec, label: "CMF spec", help: "Colour, material and finish per surface (PDF)." },
    ],
    groups: [
      G("size", [dims(undefined, { level: "short" }), F("weight", "Weight", "number", { units: ["g", "kg"] })]),
      G(
        "materials",
        [
          R("cmf", "Colour, material and finish per surface", "parts", {
            help: "Housing, front, back, buttons, grille, cable: anodised aluminium, glass, PC/ABS, silicone.",
          }),
          finish(),
          F("texture", "Texture", "text", { ...tech, placeholder: "VDI 3400 ref 24" }),
          F("gloss", "Gloss", "number", { units: ["GU"], ...tech }),
        ],
        "CMF",
      ),
      G("variants", [colourways]),
      G("label", [
        R("ports", "Ports, buttons and lights", "list", { help: "Where each one sits. Reviewers look for them." }),
        wordmark,
      ]),
      G("use", [
        F("screen", "What the screen shows", "text"),
        F("ip", "Water and dust", "choice", ch(["None", "IPX4", "IP54", "IP67", "IP68"])),
        F("in-box", "In the box", "list"),
        F("marks", "Marks", "list", { ...ch(["CE", "UKCA", "FCC", "WEEE", "RoHS"]), compliance: true }),
        F("battery", "Battery and power", "text", { ...tech, compliance: true }),
      ]),
    ],
    shots: [
      shot.front,
      shot.back,
      S("sides", "Sides", "Each side, the ports.", true),
      shot.top,
      S("on", "Switched on", "Screen or light on.", false),
      shot.scale,
    ],
  },
  {
    id: "kind-other",
    name: "Something else",
    examples: "Anything that is not above",
    image: kindImg("other"),
    parts: ["Main part"],
    files: [fileKinds.model, fileKinds.artwork],
    groups: [
      G("size", [dims(undefined, { level: "short" })]),
      G("materials", [
        R(
          "material",
          "Main material",
          "material",
          ch(["Glass", "Metal", "Wood", "Plastic", "Paper", "Textile", "Ceramic", "Stone"]),
        ),
        finish(),
        R("colour", "Main colour", "colour", short),
        F("parts", "Parts", "parts"),
      ]),
      G("label", [F("text", "Text on it", "text", { detail: "label" })]),
      G("use", [claims, origin]),
    ],
    shots: [shot.front, shot.back, shot.side, shot.detail, shot.scale],
  },
];

// ─── What the Engine reads ──────────────────────────────────────────────────

const blend = (...rows: [string, number][]): FibreBlend => ({ fibres: rows.map(([fibre, pct]) => ({ fibre, pct })) });

/** What the Engine "reads" for a new product of a kind (the mock's stand-in for reading photos and the page). */
export const readGuesses: Record<
  string,
  { fieldId: string; value: SpecEntry["value"]; unit?: string; evidence: string }[]
> = {
  "kind-skincare": [
    { fieldId: "container", value: "Bottle", evidence: "Your front photo" },
    { fieldId: "container-material", value: "Clear glass", evidence: "Your front photo" },
    { fieldId: "texture", value: "Serum", evidence: "The product page" },
    { fieldId: "decoration", value: ["Screen print"], evidence: "Your front photo" },
  ],
  "kind-fragrance": [
    { fieldId: "concentration", value: "Eau de parfum", evidence: "The product page" },
    { fieldId: "glass", value: "Clear glass", evidence: "Your front photo" },
  ],
  "kind-home": [
    { fieldId: "vessel", value: "Amber glass", evidence: "Your front photo" },
    { fieldId: "wicks", value: 1, unit: "wicks", evidence: "Your top photo" },
    { fieldId: "wick-type", value: "Cotton", evidence: "Your top photo" },
  ],
  "kind-apparel": [
    { fieldId: "garment", value: "Sweater", evidence: "Your front photo" },
    { fieldId: "knit", value: "Jersey", evidence: "Your detail photo" },
    { fieldId: "trim-rib", value: "Rib 2:2", evidence: "Your detail photo" },
    { fieldId: "fit", value: "Regular", evidence: "The product page" },
    { fieldId: "composition", value: blend(["Merino wool", 100]), evidence: "The product page" },
  ],
  "kind-footwear": [{ fieldId: "upper", value: "Full-grain leather", evidence: "Your outside photo" }],
  "kind-furniture": [{ fieldId: "main-material", value: "Oak", evidence: "Your front photo" }],
};

/** What the Engine reads from a file of each kind the customer adds (mock). */
export const fileReads: Record<ProductFile["kind"], string[]> = {
  techpack: ["Measurements and tolerances", "Materials and construction", "Colourways"],
  flats: ["Front and back drawings", "Seams and trims"],
  cad: ["Pattern pieces or the shape, in exact measures"],
  model: ["The exact shape, every side"],
  dieline: ["The flat pack with its measures", "Where the print and the finishes sit"],
  artwork: ["Every letter, the logo, the foil areas"],
  spec: ["Material, finish and colour per part"],
};
