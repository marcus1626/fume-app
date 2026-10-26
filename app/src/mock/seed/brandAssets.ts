// What the Studio keeps for LYSNE: its presets (grounds, colours, light), its AI models with their sheets and specs,
// and the references made or uploaded for it.
import type { BrandModel, BrandPreset, BrandReference, ModelAngle, ModelSpec } from "../../contract";
import { at, gen, img } from "./helpers";

const decided = (evidence: string): BrandPreset["provenance"] => ({
  origin: "customer",
  state: "approved",
  evidence,
  by: "u-maja",
  at: at(60 * 24 * 9),
});

export const presets: BrandPreset[] = [
  {
    id: "bp-white",
    workspaceId: "w-lysne",
    kind: "background",
    name: "LYSNE packshot white",
    hex: "#F4EFE8",
    use: "Packshot background",
    provenance: decided("LYSNE brand guide 2026.pdf, page 9"),
  },
  {
    id: "bp-linen",
    workspaceId: "w-lysne",
    kind: "background",
    name: "Linen",
    hex: "#EFE6DA",
    use: "Product page grounds",
    provenance: decided("LYSNE brand guide 2026.pdf, page 6"),
  },
  {
    id: "bp-stone",
    workspaceId: "w-lysne",
    kind: "background",
    name: "Evening stone",
    hex: "#B5A691",
    use: "Scenes and surfaces",
    provenance: { origin: "engine", state: "proposed", evidence: "Spring relaunch", confidence: "medium" },
  },
  {
    id: "bp-night",
    workspaceId: "w-lysne",
    kind: "colour",
    name: "Night brown",
    hex: "#2B1D17",
    use: "Words on light grounds",
    provenance: decided("LYSNE brand guide 2026.pdf, page 6"),
  },
  {
    id: "bp-evening",
    workspaceId: "w-lysne",
    kind: "light",
    name: "Low evening light",
    value: "Low side light, warm, 2700 K",
    use: "Every scene",
    provenance: decided("Brand DNA v3, Light"),
  },
];

// ─── The AI models' sheets ──────────────────────────────────────────────────
// Seven angles in a white studio in the same plain clothes, and their specs.

const angles: ModelAngle[] = [
  "front",
  "three-quarter",
  "profile",
  "back",
  "face",
  "face-three-quarter",
  "face-profile",
];
const sheet = (name: string) => angles.map((angle) => ({ angle, image: gen(`models/${name}-${angle}`) }));
const clothing = "Off-white t-shirt, grey trousers, barefoot";
const never = ["Shown as a real customer, a review or a testimonial", "Before-and-after", "Nudity"];

const modelSpecs: Record<string, { look: string; spec: ModelSpec }> = {
  "bm-ane": {
    look: "30s, ash-blonde hair, freckles, calm",
    spec: {
      ageRange: "32 to 38",
      height: "170 cm",
      build: "Slim, soft shoulders",
      skinTone: "Fair, warm undertone, light freckles",
      hair: "Ash blonde, shoulder length, loose waves",
      eyes: "Grey-blue",
      sizes: [
        { label: "Top", value: "S" },
        { label: "Trousers", value: "36" },
        { label: "Shoes", value: "38" },
      ],
      clothing,
      allowedUses: ["Brand photography", "Paid social", "Product pages"],
      neverUses: never,
    },
  },
  "bm-leo": {
    look: "early 30s, light brown hair, light stubble",
    spec: {
      ageRange: "30 to 35",
      height: "184 cm",
      build: "Lean, broad shoulders",
      skinTone: "Fair, neutral undertone",
      hair: "Light brown, short, textured",
      eyes: "Blue-grey",
      sizes: [
        { label: "Top", value: "M" },
        { label: "Trousers", value: "50" },
        { label: "Shoes", value: "44" },
      ],
      clothing,
      allowedUses: ["Brand photography"],
      neverUses: never,
    },
  },
  "bm-mia": {
    look: "20s, long dark-brown hair",
    spec: {
      ageRange: "24 to 28",
      height: "167 cm",
      build: "Slim",
      skinTone: "Fair, cool undertone",
      hair: "Dark brown, long, straight",
      eyes: "Green-grey",
      sizes: [
        { label: "Top", value: "XS" },
        { label: "Trousers", value: "34" },
        { label: "Shoes", value: "38" },
      ],
      clothing,
      allowedUses: ["Brand photography", "Paid social"],
      neverUses: never,
    },
  },
};

/** A model's look, spec, sheet of angles, and its face as the picture. */
const sheetOf = (id: string, name: string) => {
  const angles = sheet(name);
  return { ...modelSpecs[id]!, angles, image: gen(`models/${name}-face`), sheet: angles.map((a) => a.image) };
};

export const models: BrandModel[] = [
  {
    id: "bm-ane",
    workspaceId: "w-lysne",
    name: "Ane",
    ...sheetOf("bm-ane", "ane"),
    variables: {
      gender: "woman",
      age: 34,
      skin: "#E2B796",
      hairColour: "#3B2A20",
      hairLength: 45,
      hairTexture: "wavy",
      eyes: "#5B4636",
      freckles: 55,
      expression: "calm",
    },
    state: "approved",
    isAiPerson: true,
    madeBy: "u-anna",
    savedBy: "u-anna",
    decidedBy: "u-maja",
    at: at(60 * 24 * 8),
    usedIn: 6,
  },
  {
    id: "bm-leo",
    workspaceId: "w-lysne",
    name: "Leo",
    ...sheetOf("bm-leo", "leo"),
    variables: {
      gender: "man",
      age: 44,
      skin: "#F1D3BD",
      hairColour: "#B9B4AE",
      hairLength: 15,
      hairTexture: "straight",
      eyes: "#6C819A",
      freckles: 0,
      expression: "serious",
    },
    state: "saved",
    isAiPerson: true,
    madeBy: "u-tuva",
    savedBy: "u-anna",
    at: at(60 * 26),
    usedIn: 0,
    documentId: "doc-model-leo",
  },
  {
    id: "bm-mia",
    workspaceId: "w-lysne",
    name: "Mia",
    ...sheetOf("bm-mia", "mia"),
    variables: {
      gender: "woman",
      age: 26,
      skin: "#A47452",
      hairColour: "#151110",
      hairLength: 20,
      hairTexture: "curly",
      eyes: "#5B4636",
      freckles: 0,
      expression: "soft_smile",
    },
    state: "draft",
    isAiPerson: true,
    madeBy: "u-anna",
    at: at(90),
    usedIn: 0,
    documentId: "doc-model-mia",
  },
];

export const brandReferences: BrandReference[] = [
  {
    id: "rf-lamp",
    workspaceId: "w-lysne",
    name: "Linen lamp",
    image: img("02-04", "square"),
    origin: "made",
    state: "saved",
    madeBy: "u-anna",
    at: at(60 * 5),
    documentId: "doc-ref-lamp",
  },
  {
    id: "rf-stone",
    workspaceId: "w-lysne",
    name: "Evening stone",
    image: img("05-06", "square"),
    origin: "brand",
    state: "saved",
    madeBy: "u-maja",
    at: at(60 * 24 * 10),
  },
  {
    id: "rf-towel",
    workspaceId: "w-lysne",
    name: "Folded towel",
    image: img("09-13", "square"),
    origin: "upload",
    state: "saved",
    madeBy: "u-maja",
    at: at(60 * 24 * 6),
  },
  {
    id: "rf-branch",
    workspaceId: "w-lysne",
    name: "Dry branch",
    image: img("01-07", "square"),
    origin: "made",
    state: "draft",
    madeBy: "u-anna",
    at: at(40),
  },
];
