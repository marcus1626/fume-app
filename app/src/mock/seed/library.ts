// LYSNE's own pictures in the Library (FLOWS §38): two shoots Maja uploaded. "Autumn studio day" is read by the Engine
// and waits for an expert to check its picks; "Spring packshots" was checked by Anna and two of its pictures are in
// campaigns. The pictures are the demo's (gen/ and, for the weak ones the Engine leaves out, shoot/: a step to the
// side, burnt out, soft, cut at the edge, darker).
import type { OwnPicture, OwnRead, Shoot } from "../../contract";
import { at, gen, pic, poster, shot } from "./helpers";

type Row = [file: string, read: OwnRead, size?: [number, number]];

const SQUARE: [number, number] = [800, 800];
const TALL: [number, number] = [640, 800];

const pictures = (shootId: string, rows: Row[]): OwnPicture[] =>
  rows.map(([file, read, size], i) => {
    const derived = file.startsWith("shoot/");
    const [width, height] = size ?? SQUARE;
    return {
      id: `${shootId}-p${i + 1}`,
      shootId,
      workspaceId: "w-lysne",
      number: i + 1,
      kind: "photo",
      name: `${shootId === "sh-autumn" ? "LYSNE_AUTUMN" : "LYSNE_SPRING"}_${String(i + 1).padStart(3, "0")}.jpg`,
      src: derived ? pic(`lysne/${file}.jpg`) : gen(file),
      width,
      height,
      bytes: 6_400_000 + ((i * 731_113) % 3_100_000),
      read,
      usedIn: [],
    };
  });

const pick = (why: string, look: number, productId?: string, productName?: string): OwnRead => ({
  sort: "pick",
  why,
  sharp: true,
  look,
  productId,
  productName,
});
const rest = (why: string, look?: number, productId?: string, productName?: string): OwnRead => ({
  sort: "rest",
  why,
  sharp: true,
  look,
  productId,
  productName,
});
const out = (why: string, sharp = true, like?: string): OwnRead => ({ sort: "out", why, sharp, like });

const OIL = ["pr-oil", "Night Body Oil"] as const;

const autumnPhotos = pictures("sh-autumn", [
  [
    "oil-scene",
    pick("Night Body Oil on stone in low side light: the Look Book's own picture. The label is sharp.", 94, ...OIL),
    TALL,
  ],
  ["shoot/s02", out("Like 01, a step to the side and darker; 01 is sharper.", true, "sh-autumn-p1"), TALL],
  ["oil-ref-label", pick("The label close, every letter sharp: a detail the plan can use.", 81, ...OIL)],
  ["shoot/s04", out("Blown highlights: the label's white has burnt out.")],
  ["oil-ref-hand", pick("In the hand, for scale. The hand model signed a release.", 78, ...OIL)],
  ["oil-pack", rest("A clean packshot; Spring packshots already has a sharper one.", 70, ...OIL)],
  ["shoot/s07", out("Soft: out of focus beside the rest of the shoot.", false)],
  ["oil-ref-back", rest("The back label, for the facts; not a picture to lead with.", 52, ...OIL)],
  ["oil-ref-side", rest("The side, plain; kept for a narrow format.", 55, ...OIL)],
  ["oil-ref-top", pick("The cap from above: a strong square in the brand's burgundy.", 76, ...OIL)],
  [
    "ritual-pack",
    pick(
      "The gift box open, both products whole and their labels readable.",
      85,
      "pr-ritual",
      "Evening Ritual gift box",
    ),
  ],
  ["shoot/s12", out("Soft: the focus missed the box.", false)],
  [
    "candle-scene",
    pick(
      "The candle at the window at dusk: the Look Book's evening, and the label reads.",
      90,
      "pr-candle",
      "Evening Candle",
    ),
    TALL,
  ],
  ["shoot/s14", out("The candle is cut at the edge, and its label with it."), TALL],
  [
    "balm-scene",
    pick("Hand Balm in warm morning light on wood, with room for words on the left.", 88, "pr-balm", "Hand Balm"),
    TALL,
  ],
  ["shoot/s16", out("Like 15, darker; 15 is better lit.", true, "sh-autumn-p15"), TALL],
  [
    "mist-scene",
    rest("Pillow Mist is small in the frame: good for a story with words above it.", 74, "pr-mist", "Pillow Mist"),
    TALL,
  ],
  [
    "scrub-detail",
    pick("The scrub's texture close: what no packshot shows. The jar is not in LYSNE's products yet.", 83),
  ],
  ["holder-lit", rest("A mood picture with no LYSNE product in it: a calm opener.", 69)],
  ["taste-stone", rest("Stone and linen, no product: a ground for words.", 72), TALL],
  ["taste-bedroom", rest("The bedroom at dusk, no product: the evening the campaign talks about.", 77), TALL],
  ["holder-top", rest("The holder from above, plain; kept for later.", 48)],
]);

const clip = (name: string, number: number, seconds: number, why: string): OwnPicture => ({
  id: `sh-autumn-p${number}`,
  shootId: "sh-autumn",
  workspaceId: "w-lysne",
  number,
  kind: "clip",
  name: `LYSNE_AUTUMN_${String(number).padStart(3, "0")}.mov`,
  src: shot(name),
  poster: poster(name),
  width: 540,
  height: 968,
  seconds,
  bytes: 48_000_000 + number * 1_300_000,
  read: { sort: "rest", why, sharp: true },
  usedIn: [],
});

const springPhotos = pictures("sh-spring", [
  ["balm-pack", pick("Hand Balm, sharp and whole on the brand's packshot white.", 86, "pr-balm", "Hand Balm")],
  ["candle-pack", pick("Evening Candle with its lid: the label reads at any size.", 88, "pr-candle", "Evening Candle")],
  ["face-pack", pick("Face Oil, the dropper straight, an even shadow.", 84, "pr-face", "Face Oil")],
  ["lip-pack", pick("Lip Balm open: the colour of the balm shows.", 80, "pr-lip", "Lip Balm")],
  ["kveld-pack", pick("Kveld, the glass clean and the label sharp.", 87, "pr-kveld", "Kveld Eau de Parfum")],
  ["wash-pack", pick("Evening Body Wash, the pump straight.", 82, "pr-wash", "Evening Body Wash")],
  ["diffuser-pack", rest("Room Diffuser; the reeds cut close at the top.", 66, "pr-diffuser", "Room Diffuser")],
  ["mist-pack", rest("Pillow Mist; the taller bottle beside it is sharper.", 70, "pr-mist", "Pillow Mist")],
  ["mist100-pack", rest("Pillow Mist, 100 ml; kept for later.", 71, "pr-mist", "Pillow Mist")],
  ["linen-pack", rest("A spray not in LYSNE's products yet; kept for later.", 68)],
  ["sleep-pack", rest("A tin not in LYSNE's products yet; kept for later.", 64)],
  ["scrub-pack", rest("A jar not in LYSNE's products yet; kept for later.", 67)],
]);
// Two of the checked picks are already in campaigns.
springPhotos[1].usedIn = [{ campaignId: "c-winter", campaignName: "Winter gifting", at: at(60 * 24 * 6) }];
springPhotos[0].usedIn = [{ campaignId: "c-balm", campaignName: "Hand Balm introduction", at: at(60 * 24 * 15) }];

export const shoots: Shoot[] = [
  {
    id: "sh-autumn",
    workspaceId: "w-lysne",
    name: "Autumn studio day",
    shotOn: "2026-10-08",
    by: "u-maja",
    at: at(60 * 26),
    rights: { photographer: "Ingrid Holm", until: "2027-10-08", people: "released" },
    state: "read",
    pictures: [
      ...autumnPhotos,
      clip("light", 23, 6, "Light moving over stone, 6 seconds: a calm opener for a Reel."),
      clip("bottle", 24, 5, "The bottle turning, 5 seconds, steady from start to end."),
    ],
  },
  {
    id: "sh-spring",
    workspaceId: "w-lysne",
    name: "Spring packshots",
    shotOn: "2026-03-12",
    by: "u-maja",
    at: at(60 * 24 * 31),
    rights: { photographer: "Our own", people: "none" },
    state: "checked",
    checkedBy: "u-anna",
    checkedAt: at(60 * 24 * 30),
    pictures: springPhotos,
  },
];
