// The Studio: creative documents with their versions and the Engine's reads, the placements a creative is made for,
// and the kit and sessions of the earlier Studio.
import { designEvaluation, withMeasures } from "../measures";
import type {
  CastMember,
  CreativeDocument,
  CreativeType,
  DetailFind,
  EnginePrompt,
  Generation,
  Layer,
  ProductFix,
  Recipe,
  RenderVersion,
  Scene,
  Specs,
  StudioSession,
  Variables,
} from "../../contract";
import { models } from "./brandAssets";
import { at, img, ok } from "./helpers";
import { defaults } from "./studioModes";
import { videoDocuments } from "./video";

// ─── Creative documents ─────────────────────────────────────────────────────

const specs = (extra: Partial<Specs> = {}): Specs => ({
  format: "feed",
  count: 4,
  imageModel: "Nano Banana Pro",
  referenceIds: ["rf-stone"],
  productId: "pr-oil",
  variantId: "va-oil-100",
  modelIds: [],
  ...extra,
});

const version = (
  id: string,
  n: number,
  tile: string,
  minutesAgo: number,
  variables: Variables,
  extra: Partial<RenderVersion> = {},
): RenderVersion => ({
  id,
  number: n,
  image: img(tile),
  at: at(minutesAgo),
  by: "u-anna",
  state: "done",
  variables,
  specs: specs(),
  evaluation: ok,
  cost: 0.12,
  ...extra,
});

// The prompt behind a render, as the Engine keeps it (FLOWS §29): what it had to carry and what the checks said.
const codeChecks: EnginePrompt["codeChecks"] = [
  { text: "No words for the picture to print", pass: true },
  { text: "No studio equipment in the frame", pass: true },
  { text: "No file names or links", pass: true },
  { text: "None of LYSNE's forbidden words", pass: true },
  { text: "The locked parts unchanged: the product's name, size and pictures", pass: true },
];
const carried = (item: string, note?: string) => ({ item, verdict: "carried" as const, ...(note ? { note } : {}) });
const lysneFindings = [
  carried("Night Body Oil, 100 ml, amber glass with a burgundy matte cap", "From the verified facts, word for word"),
  carried("Warm low light from one side, like a lamp in the evening"),
  carried("Linen, travertine and walnut; nothing glossy"),
  carried("The bottle is the one sharp thing; the rest falls soft"),
  { item: "No people, no hands", verdict: "not_visible" as const, note: "Nothing in the picture to show it" },
];
// What the Engine had for a LYSNE prompt, piece by piece (engine_prompts.ledger): what went in, how the check looked for
// it, and why the rest stayed out.
type Ledger = NonNullable<EnginePrompt["ledger"]>;
const fact = (what: string, why?: string): Ledger[number] =>
  why
    ? { source: "product_fact", what, used: false, why }
    : { source: "product_fact", what, used: true, how: "verbatim", passed: true };
const meant = (source: Ledger[number]["source"], what: string): Ledger[number] => ({
  source,
  what,
  used: true,
  how: "meaning",
  passed: true,
});
const left = (source: Ledger[number]["source"], what: string, why: string): Ledger[number] => ({
  source,
  what,
  used: false,
  why,
});
const read = (source: Ledger[number]["source"], what: string): Ledger[number] => ({
  source,
  what,
  used: true,
  how: "guidance",
});
const lysneLedger: Ledger = [
  fact("Bottle: 100 ml amber glass bottle"),
  fact("Cap: Burgundy matte cap, never glossy"),
  fact("Label: The LYSNE wordmark in white on the front"),
  fact("Scent: Cedar, vetiver and bergamot", "A scent fact is for the words, not the picture."),
  fact("Use: Massage into damp skin before bed", "A use fact is for the words, not the picture."),
  fact("Travel size: 30 ml", "Not verified yet."),
  meant("brand_rule", "Imagery: Warm low light from one side, like a lamp in the evening"),
  meant("brand_rule", "Imagery: Linen, travertine and walnut; nothing glossy"),
  meant("brand_rule", "Imagery: No people, no hands"),
  left(
    "brand_rule",
    "Voice: Quiet and unhurried, never salesy",
    "A voice rule is for the words and the layout, not the picture.",
  ),
  left(
    "brand_rule",
    "Claims: Never say it helps you sleep",
    "A claims rule is for the words and the layout, not the picture.",
  ),
  meant("taste", "Analog film, soft halation"),
  meant("taste", "Shallow depth of field"),
  meant("taste", "Avoid hard flash and clinical white"),
  left("taste", "Brass and gold details", "Not sure enough yet (48 %)."),
  meant("brain", "Picture: The bottle on a bedside ledge at dusk"),
  meant("brain", "Colour: Burgundy #5B1A23 (accent)"),
  meant("brain", "Market: Norway, women 30 to 50"),
  left("brain", "Colour: Bone #EDE6DA (ground)", "A text or ground colour is for layouts."),
  left("brain", "Picture: Morning light in a white bathroom", "Proposed, not confirmed by the brand."),
  left("brain", "Audience: Reads slowly, buys once she trusts it", "About the words or the business, not the picture."),
  read("lesson", "Avoid: Hands in the frame read as stock"),
  read("lesson", "Prefer: The bottle low in the frame, with air above it"),
  read("lesson", "Prefer: Travertine reads warmer than marble"),
  { source: "picture", what: "The product's own photograph", used: true, how: "reference" },
  read("plan", "An approved prompt: Analog 35 mm photograph, warm evening light from a single lamp…"),
];
/** The ledger of the stopped try: the cap and the rule against gloss went in, and the check did not find them. */
const blockedLedger: Ledger = lysneLedger.map((e) =>
  e.what.startsWith("Cap:") || e.what.includes("nothing glossy") ? { ...e, passed: false } : e,
);

const prompt = (text: string, extra: Partial<EnginePrompt> = {}): EnginePrompt => ({
  status: "validated",
  model: "Nano Banana Pro",
  method: "Product on a surface",
  text,
  tries: 1,
  findings: lysneFindings,
  codeChecks,
  llmUsd: 0.002,
  ledger: lysneLedger,
  ...extra,
});
const scenePrompt = (place: string) =>
  `Analog 35 mm photograph, warm evening light from a single lamp to the left. A 100 ml amber glass bottle with a burgundy matte cap, LYSNE Night Body Oil, stands ${place} on a travertine ledge beside folded linen. Walnut wall softly out of focus behind it. The bottle is the only sharp thing; shallow depth of field, fine film grain, soft halation, warm brown shadows. Calm, unhurried, the hour before sleep.`;

const sceneVars = { ...defaults("m-scene") };

/** The email header's layers in the Design studio: the words at the top, clear of the label; the logo reversed on
 *  the dark picture, as LYSNE's design system asks. */
export const layoutLayers: Layer[] = [
  {
    id: "ly-img",
    kind: "image",
    name: "Picture",
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    image: img("05-01", "story"),
    visible: true,
    locked: true,
    fit: "fill",
  },
  {
    id: "ly-body",
    kind: "text",
    name: "Line",
    x: 0.08,
    y: 0.24,
    w: 0.6,
    h: 0.05,
    text: "Night Body Oil · 100 ml",
    style: "small",
    visible: true,
  },
  {
    id: "ly-head",
    kind: "text",
    name: "Headline",
    x: 0.08,
    y: 0.13,
    w: 0.84,
    h: 0.1,
    text: "For the hour before sleep.",
    style: "headline",
    visible: true,
  },
  {
    id: "ly-logo",
    kind: "logo",
    name: "LYSNE logo",
    x: 0.08,
    y: 0.07,
    w: 0.2,
    h: 0.05,
    visible: true,
    variant: "Wordmark, reversed",
  },
];

const seeded: CreativeDocument[] = [
  {
    id: "doc-autumn-m3",
    workspaceId: "w-lysne",
    campaignId: "c-autumn",
    title: "Master 3",
    slot: "Master 3 · feed",
    studio: "render",
    modeId: "m-scene",
    variables: { ...sceneVars, productSize: 28, productPlace: "low" },
    specs: specs(),
    overrides: [
      {
        id: "ov-1",
        productId: "pr-oil",
        field: "Cap",
        value: "Burgundy, matte, with a soft sheen in low light",
        was: "Burgundy, matte. Never glossy, never black.",
        scope: "this_render",
        by: "u-anna",
        at: at(30),
        state: "applied",
      },
      {
        id: "ov-2",
        productId: "pr-oil",
        field: "Oil",
        value: "Reads golden, warmer in low evening light; never orange.",
        was: "Reads golden, never orange.",
        scope: "product",
        by: "u-anna",
        at: at(25),
        state: "proposed",
      },
    ],
    layers: [],
    versions: [
      version("rv-1", 1, "05-08", 90, sceneVars, {
        evaluation: {
          ...ok,
          productTruth: "flag",
          notes: ["Cap reads glossy"],
          scores: { product: 74, engine: 85, why: [{ score: "product", text: "The cap reads glossy; it is matte" }] },
        },
        prompt: prompt(scenePrompt("in the centre")),
      }),
      version(
        "rv-2",
        2,
        "04-06",
        60,
        { ...sceneVars, productSize: 34 },
        {
          instruction: "Make the bottle a little bigger",
          evaluation: { ...ok, scores: { product: 88, engine: 87 } },
          prompt: prompt(scenePrompt("a little larger in the frame, in the centre"), { tries: 2 }),
        },
      ),
      version(
        "rv-3",
        3,
        "05-01",
        20,
        { ...sceneVars, productSize: 28, productPlace: "low" },
        {
          instruction: "Move the bottle lower, more air above",
          evaluation: { ...ok, scores: { product: 82, engine: 91 } },
          prompt: prompt(scenePrompt("low in the frame with calm air above it")),
        },
      ),
      // Anna's ask works against two of LYSNE's rules. The Engine says so and renders it anyway: the picture carries a
      // warning and its scores, and Anna decides (FLOWS §34.1, PROPOSED).
      version(
        "rv-4",
        4,
        "05-01g",
        6,
        { ...sceneVars, productSize: 28, productPlace: "low" },
        {
          instruction: "Add a glossy reflection on the cap",
          evaluation: {
            productTruth: "flag",
            brandRules: "flag",
            artefacts: "none",
            notes: ["The cap reads glossy"],
            scores: {
              product: 64,
              engine: 58,
              why: [
                { score: "engine", text: "A glossy reflection, where LYSNE allows nothing glossy" },
                { score: "product", text: "The cap reads glossy; it is matte" },
              ],
            },
          },
          prompt: prompt(
            scenePrompt("low in the frame with calm air above it").replace(
              "a burgundy matte cap",
              "a burgundy cap with a glossy reflection",
            ),
            {
              status: "warned",
              reason: "A glossy cap works against the verified facts and the brand's rule: nothing glossy.",
              tries: 3,
              llmUsd: 0.006,
              ledger: blockedLedger,
              findings: [
                {
                  item: "Burgundy matte cap, never glossy (verified fact)",
                  verdict: "against",
                  note: "The instruction asks for a glossy reflection on the cap",
                },
                {
                  item: "Linen, travertine and walnut; nothing glossy",
                  verdict: "against",
                  note: "A glossy reflection is the one thing the rule rules out",
                },
                ...lysneFindings.slice(1, 2),
                ...lysneFindings.slice(3),
              ],
            },
          ),
        },
      ),
    ],
    pickedVersionId: "rv-3",
    edits: [
      {
        id: "ed-1",
        text: "Make the bottle a little bigger",
        changes: [{ key: "productSize", label: "Product in frame", from: 32, to: 34 }],
        by: "u-anna",
        at: at(62),
        state: "kept",
      },
      {
        id: "ed-2",
        text: "Move the bottle lower, more air above",
        changes: [
          { key: "productSize", label: "Product in frame", from: 34, to: 28 },
          { key: "productPlace", label: "Placement", from: "centre", to: "low" },
        ],
        by: "u-anna",
        at: at(22),
        state: "kept",
      },
    ],
    state: "draft",
    by: "u-anna",
    updatedAt: at(20),
  },
  {
    id: "doc-model-mia",
    workspaceId: "w-lysne",
    title: "Mia",
    studio: "render",
    modeId: "m-model",
    variables: { ...defaults("m-model"), ...models[2].variables },
    specs: specs({ format: "square", count: 3, productId: undefined, variantId: undefined, referenceIds: [] }),
    overrides: [],
    layers: [],
    edits: [],
    versions: [version("rv-mia-1", 1, "07-10", 90, models[2].variables)],
    pickedVersionId: "rv-mia-1",
    state: "draft",
    by: "u-anna",
    updatedAt: at(90),
  },
  {
    id: "doc-model-leo",
    workspaceId: "w-lysne",
    title: "Leo",
    studio: "render",
    modeId: "m-model",
    variables: { ...defaults("m-model"), ...models[1].variables },
    specs: specs({ format: "square", count: 3, productId: undefined, variantId: undefined, referenceIds: [] }),
    overrides: [],
    layers: [],
    edits: [],
    versions: [version("rv-leo-1", 1, "07-11", 60 * 27, models[1].variables, { by: "u-tuva" })],
    pickedVersionId: "rv-leo-1",
    state: "draft",
    by: "u-tuva",
    updatedAt: at(60 * 26),
  },
  {
    id: "doc-ref-lamp",
    workspaceId: "w-lysne",
    title: "Linen lamp",
    studio: "render",
    modeId: "m-reference",
    variables: defaults("m-reference"),
    specs: specs({ format: "square", count: 2, productId: undefined, variantId: undefined, referenceIds: [] }),
    overrides: [],
    layers: [],
    edits: [],
    versions: [version("rv-lamp-1", 1, "02-04", 60 * 5, defaults("m-reference"))],
    pickedVersionId: "rv-lamp-1",
    state: "draft",
    by: "u-anna",
    updatedAt: at(60 * 5),
  },
  {
    // A Black Friday packshot; the campaign's look (Night black, one hard top light) leads its look sections.
    id: "doc-bf-1",
    workspaceId: "w-lysne",
    campaignId: "c-bf",
    title: "Night Body Oil on black",
    slot: "Packshot · square",
    studio: "render",
    modeId: "m-packshot",
    variables: {
      ...defaults("m-packshot"),
      background: "#141110",
      shadow: "hard",
      softness: 15,
      warmth: 4300,
      lightAngle: { azimuth: 0, elevation: 80 },
    },
    specs: specs({ format: "square", count: 4, referenceIds: [] }),
    overrides: [],
    layers: [],
    edits: [],
    versions: [
      version(
        "rv-bf-1",
        1,
        "10-06",
        40,
        { ...defaults("m-packshot"), background: "#141110" },
        { specs: specs({ format: "square" }) },
      ),
    ],
    pickedVersionId: "rv-bf-1",
    state: "draft",
    by: "u-anna",
    updatedAt: at(10),
    sources: { Ground: "campaign", Light: "campaign", Camera: "brand" },
  },
  {
    id: "doc-autumn-email",
    workspaceId: "w-lysne",
    campaignId: "c-autumn",
    title: "Email header",
    slot: "Email · header",
    studio: "design",
    modeId: "m-layout",
    // The words sit at the top, clear of the label (round 15: Align is where they are on the canvas).
    variables: { ...defaults("m-layout"), align: "top" },
    specs: specs({ format: "story", count: 1 }),
    overrides: [],
    layers: layoutLayers,
    edits: [],
    versions: [
      version("rv-email-1", 1, "05-01", 15, defaults("m-layout"), {
        image: img("05-01", "story"),
        specs: specs({ format: "story" }),
      }),
    ],
    pickedVersionId: "rv-email-1",
    state: "draft",
    by: "u-anna",
    updatedAt: at(15),
  },
];

/** What the Engine read on doc-autumn-m3's renders: version 3 reads "200 ml", the demo's product fix. */
const detailFinds: Record<string, DetailFind[]> = {
  "rv-2": [
    {
      tokenId: "dt-label",
      region: { x: 0.205, y: 0.478, w: 0.22, h: 0.255 },
      read: "LYSNE · Night Body Oil",
      ok: true,
    },
    { tokenId: "dt-size", region: { x: 0.345, y: 0.692, w: 0.05, h: 0.027 }, read: "100 ml", ok: true },
    { tokenId: "dt-cap", region: { x: 0.23, y: 0.252, w: 0.16, h: 0.165 }, read: "Burgundy, matte", ok: true },
  ],
  "rv-3": [
    {
      tokenId: "dt-label",
      region: { x: 0.44, y: 0.455, w: 0.275, h: 0.355 },
      read: "LYSNE · Night Body Oil",
      ok: true,
    },
    { tokenId: "dt-size", region: { x: 0.65, y: 0.755, w: 0.06, h: 0.035 }, read: "200 ml", ok: false },
    { tokenId: "dt-cap", region: { x: 0.42, y: 0.12, w: 0.205, h: 0.195 }, read: "Burgundy, matte", ok: true },
  ],
};

/** The fixes the Engine made on a document's product. */
const fixes: Record<string, ProductFix[]> = {
  "doc-autumn-m3": [
    {
      id: "fx-1",
      tokenId: "dt-cap",
      region: { x: 0.23, y: 0.252, w: 0.16, h: 0.165 },
      found: "Burgundy, glossy",
      expected: "Burgundy, matte",
      auto: true,
      by: "engine",
      at: at(88),
      state: "fixed",
      versionId: "rv-2",
    },
  ],
};

/** A version's scores as its studio scores it (FLOWS §35.3): a design by what code measured on it, else a picture or
 *  a video from its two scores. */
function scored(d: CreativeDocument, v: CreativeDocument["versions"][number]) {
  if (v.design?.state === "made") return designEvaluation(v.evaluation, v.design.checks, v.number);
  return withMeasures(v.evaluation, d.studio, v.number);
}

/** Every document with what the Engine read on its renders, its fixes and its look sources; a feed render is placed in
 *  the Instagram feed. */
export const documents: CreativeDocument[] = [
  ...seeded.map((d) => ({
    ...d,
    versions: (d.id === "doc-autumn-m3"
      ? d.versions.map((v) => (detailFinds[v.id] ? { ...v, details: detailFinds[v.id] } : v))
      : d.versions
    ).map((v) => ({ ...v, evaluation: scored(d, v) })),
    fixes: fixes[d.id] ?? [],
    sources: d.sources ?? { Light: "brand", Camera: "brand" },
    specs: d.studio === "render" && d.specs.format === "feed" ? { ...d.specs, placementId: "pl-ig-feed" } : d.specs,
  })),
  ...videoDocuments,
];

// ─── Placements: the format picker (the one list, in src/domain/placements.ts) ───────

export { placements } from "../../domain/placements";

// ─── The Studio's kit and sessions ──────────────────────────────────────────

export const creativeTypes: CreativeType[] = [
  {
    id: "ct-packshot",
    name: "Packshot",
    description: "The product alone, true to the Product Truth, on a ground from the Brand DNA.",
    family: "H-B Product in light",
    needs: ["product", "variant", "angle"],
    formats: ["square", "feed"],
    checks: ["Edges clean", "Label legible"],
    cover: img("03-08", "square"),
  },
  {
    id: "ct-scene",
    name: "Product in scene",
    description: "The product in a place and a light from the brand world.",
    family: "S4 Product still life",
    needs: ["product", "variant", "scene"],
    formats: ["feed", "square", "story"],
    checks: ["Scale believable"],
    cover: img("05-06", "square"),
  },
  {
    id: "ct-lifestyle",
    name: "Lifestyle with a person",
    description: "A person from the cast with the product. The creative is labelled as an AI model.",
    family: "S3 Lifestyle in motion",
    needs: ["product", "cast", "scene"],
    formats: ["feed", "story"],
    checks: ["AI model label", "Hands never cover the label"],
    cover: img("07-05", "square"),
  },
  {
    id: "ct-portrait",
    name: "Portrait and beauty",
    description: "The product in use on skin, close and calm.",
    family: "S2 Portrait and beauty",
    needs: ["product", "cast"],
    formats: ["feed", "story"],
    checks: ["AI model label", "No result claims in the image"],
    cover: img("07-02", "square"),
  },
  {
    id: "ct-detail",
    name: "Detail",
    description: "One part of the product, close: the cap, the oil, the label.",
    family: "H-D Focus detail",
    needs: ["product", "area"],
    formats: ["square", "feed"],
    checks: ["Material true"],
    cover: img("01-12", "square"),
  },
  {
    id: "ct-layout",
    name: "Layout",
    description: "A creative with words and the logo, built from the brand's own components.",
    family: "Layout (OpenPencil)",
    needs: ["product", "layout"],
    formats: ["feed", "story", "square"],
    checks: ["Words against the claims list", "Logo clear space"],
    cover: img("04-05", "square"),
  },
];

export const cast: CastMember[] = [
  {
    id: "cm-ane",
    name: "Ane",
    look: "30s, dark hair, freckles, calm",
    image: img("07-05", "square"),
    isAiPerson: true,
    allowedUses: ["Brand photography", "Paid social"],
  },
  {
    id: "cm-leo",
    name: "Leo",
    look: "40s, grey at the temples, wool",
    image: img("07-11", "square"),
    isAiPerson: true,
    allowedUses: ["Brand photography"],
  },
  {
    id: "cm-hands",
    name: "Hands only",
    look: "Hands and shoulders, no face",
    image: img("07-02", "square"),
    isAiPerson: true,
    allowedUses: ["Brand photography", "Paid social", "Product page"],
  },
];

export const scenes: Scene[] = [
  {
    id: "sc-stone",
    workspaceId: "w-lysne",
    name: "Evening stone",
    light: "Low side light, warm, 2700 K",
    image: img("05-06", "square"),
  },
  {
    id: "sc-linen",
    workspaceId: "w-lysne",
    name: "Linen and water",
    light: "Soft window light, late",
    image: img("09-13", "square"),
  },
  {
    id: "sc-bath",
    workspaceId: "w-lysne",
    name: "Bathroom shelf",
    light: "One lamp, amber",
    image: img("02-04", "square"),
  },
];

const recipe = (extra: Partial<Recipe> = {}): Recipe => ({
  mode: "type",
  creativeTypeId: "ct-scene",
  productId: "pr-oil",
  variantId: "va-oil-100",
  angle: "Front",
  castIds: [],
  sceneId: "sc-stone",
  references: [img("05-06", "square")],
  format: "feed",
  count: 4,
  route: { provider: "Higgsfield", model: "Nano Banana Pro" },
  prompt:
    "Evening stone · LYSNE Night Body Oil 100 ml, amber glass, matte burgundy cap · low side light 2700 K · 50 mm · product low, air above · label front and centred",
  seed: 48213,
  ...extra,
});

const generation = (
  id: string,
  branch: number,
  tile: string,
  state: Generation["state"],
  minutesAgo: number,
  evaluation: Partial<Generation["evaluation"]> = {},
  extra: Partial<Generation> = {},
): Generation => ({
  id,
  sessionId: "ss-autumn-m3",
  branch,
  image: img(tile),
  recipe: recipe(),
  cost: 0.12,
  state,
  at: at(minutesAgo),
  evaluation: { productTruth: "pass", brandRules: "pass", artefacts: "none", notes: [], ...evaluation },
  ...extra,
});

export const sessions: StudioSession[] = [
  {
    id: "ss-autumn-m3",
    workspaceId: "w-lysne",
    campaignId: "c-autumn",
    slot: "Master 3 · feed",
    recipe: recipe(),
    by: "u-anna",
    updatedAt: at(20),
    generations: [
      generation("g1", 1, "05-06", "candidate", 60),
      generation("g2", 1, "05-08", "candidate", 60, { productTruth: "flag", notes: ["Cap reads glossy"] }),
      generation("g3", 1, "03-05", "discarded", 60, { artefacts: "minor", notes: ["Label edge soft"] }),
      generation("g4", 1, "04-06", "candidate", 60),
      generation("g5", 2, "05-01", "picked", 20, {}, { repair: "Make the cap matte and move the bottle lower." }),
      generation("g6", 2, "04-08", "candidate", 20),
    ],
    pickedId: "g5",
  },
];
