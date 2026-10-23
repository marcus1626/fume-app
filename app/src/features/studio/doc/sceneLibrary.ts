// The scene library (round 13, Marcus #57 "only four choices?" and #63 "templates, upload a background or pick an
// existing one: scenes, backgrounds, surfaces, references"). One catalogue for a mode's Scene section: Fume's scene
// templates, the brand's own scenes and backgrounds (its background presets and what was uploaded), surfaces, props
// and the brand's references. Every entry is a value of the mode's own variables (scene, surface, props), so the
// Engine, the version notes and Undo read it like any other choice. Mock data: the pictures are the demo set.
import type { BrandAssetsView, StudioMode } from "../../../contract";

export type LibraryKind = "scene" | "background" | "surface" | "prop" | "reference";
export type LibraryOrigin = "fume" | "brand" | "upload" | "reference";

export interface LibraryItem {
  /** The variable's value it sets. */
  value: string;
  name: string;
  kind: LibraryKind;
  origin: LibraryOrigin;
  image?: string;
}

/** Which variable each kind sets: scenes, backgrounds and references are what the product stands in. */
export const KIND_VAR: Record<LibraryKind, "scene" | "surface" | "props"> = {
  scene: "scene",
  background: "scene",
  reference: "scene",
  surface: "surface",
  prop: "props",
};

export const KIND_LABEL: Record<LibraryKind, string> = {
  scene: "Scenes",
  background: "Backgrounds",
  surface: "Surfaces",
  prop: "Props",
  reference: "References",
};

const pic = (tile: string) => `${import.meta.env.BASE_URL}demo/lysne/${tile}-square.jpg`;
const gen = (name: string) => `${import.meta.env.BASE_URL}demo/lysne/gen/${name}.jpg`;
/** A flat colour as a picture: a surface or a background swatch. */
const swatch = (hex: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="${hex}"/></svg>`)}`;

/** The brand's own scenes (the mode's first three) and Fume's templates. */
const SCENES: LibraryItem[] = [
  { value: "stone", name: "Evening stone", kind: "scene", origin: "brand", image: pic("10-08") },
  { value: "linen", name: "Linen and water", kind: "scene", origin: "brand", image: pic("09-13") },
  { value: "bath", name: "Bathroom shelf", kind: "scene", origin: "brand", image: pic("08-02") },
  { value: "fume-window", name: "Window light on plaster", kind: "scene", origin: "fume", image: pic("02-01") },
  { value: "fume-fluted", name: "Fluted glass", kind: "scene", origin: "fume", image: pic("02-04") },
  { value: "fume-plinth", name: "Travertine plinth", kind: "scene", origin: "fume", image: pic("05-06") },
  { value: "fume-water", name: "Sunlit water", kind: "scene", origin: "fume", image: pic("06-04") },
  { value: "fume-shadow", name: "Shadow play", kind: "scene", origin: "fume", image: pic("01-07") },
  { value: "fume-branch", name: "A wild branch", kind: "scene", origin: "fume", image: pic("09-07") },
  { value: "fume-table", name: "Warm tabletop", kind: "scene", origin: "fume", image: pic("04-05") },
  { value: "fume-hands", name: "Hands and a drop", kind: "scene", origin: "fume", image: pic("07-10") },
  { value: "fume-bedroom", name: "Bedroom at night", kind: "scene", origin: "fume", image: gen("taste-bedroom") },
  { value: "fume-stone-close", name: "Stone, close", kind: "scene", origin: "fume", image: gen("taste-stone") },
];

const SURFACES: LibraryItem[] = (
  [
    ["stone", "Stone", "#B5A691"],
    ["plaster", "Plaster", "#E4DACB"],
    ["wood", "Wood", "#9C7651"],
    ["linen", "Linen", "#EFE6DA"],
    ["marble", "Marble", "#E9E6E1"],
    ["travertine", "Travertine", "#D8C6A8"],
    ["oak", "Light oak", "#C8A77F"],
    ["walnut", "Walnut", "#5C4030"],
    ["terrazzo", "Terrazzo", "#D9D2C7"],
    ["slate", "Slate", "#4B4A47"],
    ["steel", "Brushed steel", "#A7A9AB"],
    ["paper", "Paper", "#F4EFE8"],
  ] as const
).map(([value, name, hex], i) => ({
  value,
  name,
  kind: "surface",
  origin: i < 4 ? "brand" : "fume",
  image: swatch(hex),
}));

const PROPS: LibraryItem[] = (
  [
    ["towel", "Towel"],
    ["glass", "Water glass"],
    ["branch", "Branch"],
    ["lamp", "Lamp"],
    ["flowers", "Dried flowers"],
    ["dish", "Ceramic dish"],
    ["candle", "Candle"],
    ["book", "Book"],
    ["pebbles", "Pebbles"],
    ["folded-linen", "Folded linen"],
    ["tray", "Brass tray"],
    ["soap", "Soap"],
  ] as const
).map(([value, name], i) => ({ value, name, kind: "prop", origin: i < 4 ? "brand" : "fume" }));

/** What was uploaded in this session (mock: kept in memory until the backend stores it). */
const uploads: LibraryItem[] = [];

export function addUpload(name: string, image: string): LibraryItem {
  const item: LibraryItem = {
    value: `upload-${uploads.length + 1}`,
    name,
    kind: "background",
    origin: "upload",
    image,
  };
  uploads.unshift(item);
  return item;
}

/** The whole library for a brand: scenes, its backgrounds (presets and uploads), surfaces, props, its references. */
export function libraryOf(assets?: BrandAssetsView): LibraryItem[] {
  const backgrounds: LibraryItem[] = [
    ...uploads,
    ...(assets?.presets ?? [])
      .filter((p) => p.kind === "background" && p.hex)
      .map((p) => ({
        value: `bg-${p.hex}`,
        name: p.name,
        kind: "background" as const,
        origin: "brand" as const,
        image: swatch(p.hex!),
      })),
  ];
  const references: LibraryItem[] = (assets?.references ?? []).map((r) => ({
    value: `ref-${r.id}`,
    name: r.name,
    kind: "reference",
    origin: "reference",
    image: r.image,
  }));
  return [...SCENES, ...backgrounds, ...SURFACES, ...PROPS, ...references];
}

/** The mode with the library's entries as options of its scene, surface and props, so every place that puts a value
 *  in words (the summary, a version's note, the Engine bar) names a template or an upload, not its id. */
export function withLibrary(mode: StudioMode | undefined, assets?: BrandAssetsView): StudioMode | undefined {
  if (!mode || !mode.variables.some((v) => v.key === "scene" && v.section === "Scene")) return mode;
  const all = libraryOf(assets);
  return {
    ...mode,
    variables: mode.variables.map((v) => {
      if (v.section !== "Scene" || !(["scene", "surface", "props"] as string[]).includes(v.key)) return v;
      const extra = all
        .filter((i) => KIND_VAR[i.kind] === v.key && !(v.options ?? []).some((o) => o.value === i.value))
        .map((i) => ({ value: i.value, label: i.name }));
      return extra.length ? { ...v, options: [...(v.options ?? []), ...extra] } : v;
    }),
  };
}
