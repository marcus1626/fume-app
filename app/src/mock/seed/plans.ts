// The plans in the seed: Winter gifting's, written by hand and waiting on Maja, and Black Friday's, written by Fume from
// its brief (db.ts) with the campaign's own look, in check with Anna because Maja asked for the check.
import type { CampaignPlan, Id, PlannedCreative, PlanDirection, PlanLine, PlanReference } from "../../contract";
import { at, gen, img, inDays } from "./helpers";

export const line = (key: string, label: string, value: string, source: PlanLine["source"], why?: string): PlanLine => ({
  key,
  label,
  value,
  source,
  ...(why ? { why } : {}),
});

export const ref = (image: string, caption: string, source: PlanReference["source"], campaignId?: Id): PlanReference => ({
  image,
  caption,
  source,
  ...(campaignId ? { campaignId } : {}),
});

// ─── Winter gifting: the hand-written plan ─────────────────────────────────

/** The masters and what follows them, in one direction. `scenes` gives the three masters' scenes and words. */
function winterCreatives(
  prefix: string,
  scenes: { scene: string; text: string; people: string; format: "feed" | "story"; products: Id[] }[],
  variants: {
    name: string;
    of: number;
    scene: string;
    format: "feed" | "story";
    text?: string;
    people?: string;
    products?: Id[];
  }[],
): PlannedCreative[] {
  const masters: PlannedCreative[] = scenes.map((s, i) => ({
    id: `${prefix}-m${i + 1}`,
    name: `Master ${i + 1}`,
    kind: "master",
    format: s.format,
    productIds: s.products,
    scene: s.scene,
    text: s.text,
    people: s.people,
  }));
  const rest: PlannedCreative[] = variants.map((v, i) => {
    const master = masters[v.of - 1];
    return {
      id: `${prefix}-v${i + 1}`,
      name: v.name,
      kind: "variant",
      of: master.id,
      format: v.format,
      productIds: v.products ?? master.productIds,
      scene: v.scene,
      text: v.text ?? master.text,
      people: v.people ?? master.people,
    };
  });
  return [...masters, ...rest];
}

const OIL = "pr-oil";
const CANDLE = "pr-candle";

/** Winter gifting's plan, written by hand: checked by Anna and waiting on Maja. */
function winter(): CampaignPlan {
  const lookBase = (overrides: Partial<Record<string, PlanLine>>): PlanLine[] =>
    [
      line(
        "light",
        "Light",
        "Low, warm side light from a window at dusk; the lit candle as a second, small warm light. Never cold blue light inside the room.",
        "brand_dna",
        "Your Brand DNA: warm neutrals and amber light",
      ),
      line("camera", "Camera", "50 mm at table height, close. The bottle sharp, the window soft behind it.", "fume"),
      line(
        "set",
        "Set",
        "A deep windowsill in pale stone and oak, a linen cloth, the dark blue evening outside.",
        "moodboard",
        "From your Winter gifting moodboard",
      ),
      line(
        "props",
        "Props",
        "The gift sleeve, a loose ribbon in clay, Evening Candle lit. Nothing seasonal beyond that: no trees, no baubles.",
        "brief",
        "Your brief: never red and green Christmas colours",
      ),
      line("colour", "Colour", "Amber glass, cream, clay and the window's deep blue. No red, no green.", "brand_dna"),
      line(
        "people",
        "People",
        "Hands only, in one master: tying the ribbon, never holding the bottle. Never a face.",
        "memory",
        "You passed on hands that hold the bottle in Autumn launch",
      ),
    ].map((l) => overrides[l.key] ?? l);

  const a: PlanDirection = {
    id: "pd-w-a",
    letter: "A",
    name: "Window light",
    recommended: true,
    idea: "A gift waits by a window on a dark December afternoon: the oil in its sleeve, the candle just lit, the last blue light outside and warm light inside. It is the moment before the gift is given, calm and certain.",
    hook: "The candle is lit before the gift is opened.",
    why: [
      { text: "Warm, low side light leads in your Brand DNA.", source: "brand_dna" },
      { text: "You chose warm light over cool every time it came up in your taste.", source: "taste" },
      { text: "Your moodboard keeps the product low, with air above it.", source: "moodboard" },
      { text: "Evening stone won in Autumn launch; this carries its warmth into winter.", source: "memory" },
    ],
    references: [
      ref(gen("candle-scene"), "A candle by a window at dusk: the light we aim for", "moodboard"),
      ref(gen("ritual-pack"), "The Evening Ritual box: the gift itself", "product"),
      ref(img("08-06"), "Product low, air above it, as you liked", "taste"),
      ref(img("02-05"), "The reference in your brief", "brief"),
      ref(img("03-12"), "Window light through glass", "moodboard"),
      ref(gen("taste-bedroom"), "The evening room, one warm lamp", "taste"),
    ],
    look: lookBase({}),
    creatives: winterCreatives(
      "pc-w-a",
      [
        {
          format: "feed",
          products: [OIL, CANDLE],
          scene: "The oil in its gift sleeve on the sill, the candle lit behind it, the window going blue.",
          text: "En roligere kveld, gitt.",
          people: "No people",
        },
        {
          format: "feed",
          products: [OIL],
          scene: "Two hands tie a clay ribbon around the sleeve; the bottle stands beside them, label to the front.",
          text: "Gi bort en roligere kveld.",
          people: "Hands only",
        },
        {
          format: "story",
          products: [OIL, CANDLE],
          scene: "From above: the open Evening Ritual box on linen, the candle lit, the lid set aside.",
          text: "Til noen som fortjener kvelden.",
          people: "No people",
        },
      ],
      [
        {
          name: "Master 1 in Story",
          of: 1,
          format: "story",
          scene: "Master 1, taller: more of the window and the evening above the bottle.",
        },
        {
          name: "Master 2 in Story",
          of: 2,
          format: "story",
          scene: "Master 2, taller: the ribbon's loose end falls into the frame.",
        },
        {
          name: "Master 3 in Feed",
          of: 3,
          format: "feed",
          scene: "Master 3, closer: the box and the candle fill the frame.",
        },
        {
          name: "The candle alone",
          of: 1,
          format: "feed",
          products: [CANDLE],
          scene: "Master 1's sill with Evening Candle alone, its flame the only light inside.",
          text: "Tenn kvelden.",
        },
        {
          name: "The label, close",
          of: 1,
          format: "feed",
          products: [OIL],
          scene: "Close on the label and the sleeve's edge, the candle a warm blur behind.",
          text: "For timen før søvn.",
        },
        {
          name: "The candle alone in Story",
          of: 1,
          format: "story",
          products: [CANDLE],
          scene: "The candle alone, taller, the window's blue above it.",
          text: "Tenn kvelden.",
        },
      ],
    ),
  };

  const b: PlanDirection = {
    id: "pd-w-b",
    letter: "B",
    name: "Linen and glass",
    idea: "Close and quiet: the oil and the candle on folded linen, warm light through ribbed glass, as if the gift were already unwrapped at home. No window and no season, only the evening.",
    hook: "Wrapped as softly as the evening it gives.",
    why: [
      { text: "Ribbed glass and slow light are on your list of liked pictures.", source: "taste" },
      { text: "Linen and glass are named in your Brand DNA's imagery.", source: "brand_dna" },
      { text: "Less seasonal than A: it can run past Christmas.", source: "fume" },
    ],
    references: [
      ref(img("02-04"), "Ribbed glass and slow light, as you liked", "taste"),
      ref(img("05-08"), "Light through ribbed glass", "moodboard"),
      ref(gen("taste-stone"), "Stone and folded linen", "taste"),
      ref(gen("ritual-pack"), "The Evening Ritual box", "product"),
    ],
    look: lookBase({
      light: line(
        "light",
        "Light",
        "Soft, warm light through a ribbed glass screen, from the left. The candle lit but not the main light.",
        "taste",
        "Ribbed glass and slow light, from your liked pictures",
      ),
      set: line("set", "Set", "Folded cream linen on oak, a ribbed glass screen behind.", "brand_dna"),
      people: line("people", "People", "No people.", "fume"),
    }),
    creatives: winterCreatives(
      "pc-w-b",
      [
        {
          format: "feed",
          products: [OIL, CANDLE],
          scene: "The oil and the candle on folded linen, light striped by the ribbed glass.",
          text: "En roligere kveld, gitt.",
          people: "No people",
        },
        {
          format: "feed",
          products: [OIL],
          scene: "The oil lying on the linen, its sleeve half off, the stripes of light across the label's edge.",
          text: "Gi bort en roligere kveld.",
          people: "No people",
        },
        {
          format: "story",
          products: [OIL, CANDLE],
          scene: "The open box on linen, seen from above, a stripe of light across it.",
          text: "Til noen som fortjener kvelden.",
          people: "No people",
        },
      ],
      [
        { name: "Master 1 in Story", of: 1, format: "story", scene: "Master 1, taller, more linen above." },
        { name: "Master 2 in Story", of: 2, format: "story", scene: "Master 2, taller." },
        { name: "Master 3 in Feed", of: 3, format: "feed", scene: "Master 3, closer." },
        {
          name: "The candle alone",
          of: 1,
          format: "feed",
          products: [CANDLE],
          scene: "The candle alone on the linen, lit.",
          text: "Tenn kvelden.",
        },
        {
          name: "The label, close",
          of: 1,
          format: "feed",
          products: [OIL],
          scene: "Close on the label in a stripe of light.",
          text: "For timen før søvn.",
        },
        {
          name: "The candle alone in Story",
          of: 1,
          format: "story",
          products: [CANDLE],
          scene: "The candle alone, taller.",
          text: "Tenn kvelden.",
        },
      ],
    ),
  };

  const c: PlanDirection = {
    id: "pd-w-c",
    letter: "C",
    name: "Candle hour",
    idea: "A dark room and only the candle: the oil catches its flame. The most intimate of the three, and darker than LYSNE usually goes, so the words must stay readable on a phone.",
    hook: "The first hour after the candle is lit.",
    why: [
      { text: "The candle is the gift's second product: here it is also the light.", source: "product" },
      { text: "Darker than your recent campaigns: a risk on small screens.", source: "fume" },
    ],
    references: [
      ref(gen("candle-scene"), "The candle as the only light", "moodboard"),
      ref(img("10-06"), "Darker, the bottle in deep shadow", "fume"),
      ref(gen("holder-lit"), "A dark shelf, one warm source", "fume"),
    ],
    look: lookBase({
      light: line(
        "light",
        "Light",
        "The candle is the only light: warm, low, falling off fast into deep shadow.",
        "fume",
      ),
      set: line("set", "Set", "A dark oak shelf, a stone dish, the room behind in shadow.", "fume"),
      people: line("people", "People", "No people.", "fume"),
    }),
    creatives: winterCreatives(
      "pc-w-c",
      [
        {
          format: "feed",
          products: [OIL, CANDLE],
          scene: "The oil beside the lit candle on a dark shelf, the flame in the glass.",
          text: "En roligere kveld, gitt.",
          people: "No people",
        },
        {
          format: "feed",
          products: [OIL],
          scene: "The oil alone, its glass glowing from the candle just out of frame.",
          text: "Gi bort en roligere kveld.",
          people: "No people",
        },
        {
          format: "story",
          products: [OIL, CANDLE],
          scene: "The open box in candlelight, from above.",
          text: "Til noen som fortjener kvelden.",
          people: "No people",
        },
      ],
      [
        { name: "Master 1 in Story", of: 1, format: "story", scene: "Master 1, taller." },
        { name: "Master 2 in Story", of: 2, format: "story", scene: "Master 2, taller." },
        { name: "Master 3 in Feed", of: 3, format: "feed", scene: "Master 3, closer." },
        {
          name: "The candle alone",
          of: 1,
          format: "feed",
          products: [CANDLE],
          scene: "The candle alone, the flame sharp.",
          text: "Tenn kvelden.",
        },
        {
          name: "The label, close",
          of: 1,
          format: "feed",
          products: [OIL],
          scene: "Close on the label in candlelight.",
          text: "For timen før søvn.",
        },
        {
          name: "The candle alone in Story",
          of: 1,
          format: "story",
          products: [CANDLE],
          scene: "The candle alone, taller.",
          text: "Tenn kvelden.",
        },
      ],
    ),
  };

  // One master with its own look over the plan's: the box from straight above.
  a.creatives[2].look = {
    camera: "From straight above, 35 mm; the box square in the frame.",
    light: "The same window light, softer, the box lit from the left.",
  };

  return {
    campaignId: "c-winter",
    version: 1,
    state: "ready",
    briefVersion: 1,
    summary:
      "Winter gifting puts Night Body Oil and Evening Candle forward as one considered gift in the weeks before Christmas. It speaks to people buying for someone close, who want a present that feels chosen rather than grabbed. The message: a slower evening, given. It runs in paid and organic social in Norway, in Norwegian, from Tuesday 3 November.",
    directions: [a, b, c],
    chosenDirectionId: a.id,
    content: [
      line(
        "products",
        "Products",
        "Night Body Oil 100 ml and Evening Candle, as their Product Truth says: amber glass, matte burgundy cap, the label front and centred.",
        "product",
      ),
      line(
        "formats",
        "Formats",
        "Feed 4:5 (5 creatives) and Story 9:16 (4 creatives): 9 in all, as your brief asks.",
        "brief",
      ),
      line(
        "text",
        "Text on the creative",
        "One short line in Norwegian on each creative, as planned under The 9 creatives; nothing else on the picture.",
        "brand_dna",
        "Your voice: short, quiet sentences",
      ),
      line("cta", "Call to action", "“Kjøp gaven” in the ad's button, never on the picture.", "fume"),
      line(
        "logo",
        "Logo",
        "The LYSNE wordmark on the label only; no logo added on the picture.",
        "brand_dna",
        "Your Brand DNA: the wordmark stands alone on the label",
      ),
      line("language", "Language", "Norwegian, for Norway.", "brief"),
    ],
    rules: [
      { text: "The bottle with its gift sleeve", kind: "must", source: "brief" },
      { text: "Warm, low light", kind: "must", source: "brief" },
      { text: "Red and green Christmas colours", kind: "never", source: "brief" },
      { text: "Discount language", kind: "never", source: "brief" },
      {
        text: "Skin-result claims; only “For the hour before sleep.”",
        kind: "never",
        source: "brand_dna",
        ruleId: "r7",
      },
      { text: "A cropped or covered label", kind: "never", source: "product" },
      { text: "A glossy or black cap", kind: "never", source: "product" },
    ],
    timeline: [
      { label: "Masters, checked by Anna", at: inDays(5) },
      { label: "Variants and formats", at: inDays(9) },
      { label: "Delivery", at: inDays(13) },
      { label: "Goes live", at: inDays(20) },
    ],
    changeRequestsIncluded: 2,
    writtenAt: at(60 * 18),
    checkedBy: "u-anna",
    checkedAt: at(60 * 3),
  };
}

export const winterPlan: CampaignPlan = winter();

// ─── Black Friday: the plan Fume wrote, with the campaign's look ────────────

/** Black Friday's plan as Fume wrote it from the brief, given the campaign's own look; in check because Maja asked. */
export function blackFridayPlan(p: CampaignPlan): CampaignPlan {
  // Black Friday's own look (the campaign's look in the brief): black grounds, gold words, one hard light.
  for (const d of p.directions) {
    d.look = d.look.map((l) =>
      l.key === "light"
        ? line("light", "Light", "Hard top light, one bright edge on the glass.", "brief", "Your Black Friday look")
        : l.key === "colour"
          ? line(
              "colour",
              "Colour",
              "Night black grounds, gold-foil words, linen for small text.",
              "brief",
              "Your Black Friday look",
            )
          : l,
    );
  }
  p.directions[0].name = "One evening, wrapped";
  p.directions[0].idea =
    "The oil and the candle as one set on night black, gold words, one hard light catching the glass. The offer readable at a glance, the evening still calm.";
  p.directions[0].references = [
    ref(img("10-06"), "Darker, one hard light on the glass", "brief"),
    ref(gen("ritual-pack"), "The set", "product"),
    ref(img("02-09"), "The bottle close, glass catching light", "fume"),
  ];
  return {
    ...p,
    state: "in_check",
    writtenAt: at(60 * 4),
    readyBy: inDays(2),
    checkAsked: { by: "u-maja", at: at(60 * 3) },
  };
}
