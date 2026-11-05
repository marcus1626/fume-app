// LYSNE's Look Book (FLOWS §32, PROPOSED): its photography as Fume read it from twelve of its pictures, the way the
// brand-book function writes it (supabase/functions/brand-book/look.ts). Version 1 is checked by Anna and waits on
// Maja. The evidence names the pictures by number, in the order Fume read them.
import type { LookBook } from "../../contract";
import { gen, img } from "./helpers";

export function lysneLook(): LookBook {
  return {
    summary:
      "LYSNE is shot in the last hour of sun: one low, warm light through a window, falling across travertine and through amber glass. The bottle is the one sharp thing, close and at its own height, and the light’s patterns around it do the talking. Everything is real and a little worn: stone with pits, oil that runs, a hand that is a hand.",
    signature: [
      "Low sun from one side through a window, always from a source you could point to.",
      "Light broken by glass or water into patterns on the stone.",
      "Travertine and sand-coloured plaster, never a seamless backdrop.",
      "The amber bottle with its matte burgundy cap sharp, the rest falling soft.",
      "Long, hard shadows that go warm brown, never black.",
      "Hands in the light, never a face.",
    ],
    camera: {
      capture: "Full-frame digital with a 35 mm film look: clean files, fine grain added in the grade.",
      lenses: [
        { focalMm: 35, use: "A room: the bedside, the bath, the window." },
        { focalMm: 50, use: "The bottle on stone, at its own height." },
        { focalMm: 85, use: "Close: the label, the cap, a hand with the bottle." },
        { focalMm: 100, use: "Macro: oil, drops and the stone’s texture." },
      ],
      aperture: "f/2.8 to f/4: the bottle sharp from cap to base, the background soft but still stone.",
      height: "At the bottle’s height or a little below. Top-down only for oil on stone, never for the bottle.",
      distance: "Close: the bottle fills a third to half of the frame. A crop cuts the light, never the cap.",
      motion: "Still and locked off. Only oil or water moves, frozen.",
    },
    light: {
      key: "The sun, low through a window or a slatted blind. No flash; at night only the bedside lamp.",
      quality: "Hard, with clean edges, falling off fast into warm shade.",
      direction: "From one side, about 30° above the bottle, often from behind it so the oil glows.",
      colourTemperatureK: "2700 to 3200 K sun against a 4500 K shade; 2400 K from the bedside lamp at night.",
      contrast: "High, about 4:1 from the sun to the shade. The shadows are deep but keep the stone’s detail.",
      timeOfDay: "The last hour of sun, or a lamp after dark.",
      rules: [
        "One source, and you can tell where it is.",
        "The light passes through the glass: the oil glows from inside.",
        "Window shapes and patterns on the stone come from the light, never from an overlay.",
        "No light from the front or from the camera.",
      ],
    },
    colour: {
      grade:
        "Warm and golden, like a print from a slow 35 mm film: honey highlights, terracotta mid-tones, umber shadows.",
      saturation: "Rich in the ambers and held back everywhere else. The cream label stays cream.",
      blacks: "Rich, never crushed: the deepest shadow is a warm brown with detail in it.",
      highlights:
        "Roll off softly into warm cream. The sun’s patterns may bloom a little at their edge, never clip to white.",
      whiteBalance: "Warm, set for daylight so the sun reads gold. The label is the neutral.",
      palette: [
        "Honey amber #B5651D",
        "Sunlit gold #E8B04A",
        "Travertine sand #D9C4A3",
        "Label cream #EFE6D6",
        "Burgundy cap #4E1B23",
        "Umber shadow #4A2C1A",
      ],
    },
    texture: {
      grain: "fine",
      grainCharacter: "Fine 35 mm film grain, even in the shadows.",
      sharpness: "The label’s words crisp; everything else falls off with the depth of field, never sharpened.",
      surfaces: "The pits and veins of travertine, dust in the light, oil that has run, drops on the glass.",
      lensCharacter: "A little softness at the edges. No flare stars and no added vignette.",
    },
    composition: {
      rules: [
        "The bottle off centre, on a third, with the light’s pattern on the other side.",
        "One product, one surface, one light.",
        "Diagonals from the shadows and the sun’s shapes.",
        "Crops close: the frame never shows the edge of the set.",
      ],
      negativeSpace: "A calm third of the frame in stone or plaster, where words can sit.",
      subjectPlacement: "On the lower third, a little left or right. A bottle on its side lies on the diagonal.",
    },
    styling: {
      settings: [
        "A stone ledge by a window",
        "The edge of a travertine bath",
        "A bedside table at night",
        "Plaster walls in sand",
      ],
      props: "Few: a glass of water, a dried branch, a folded linen towel. Nothing with a brand on it.",
      surfaces: "Travertine, plaster, ribbed glass and still water. Never marble, never a seamless backdrop.",
      wardrobe: "Hands only, bare: no rings, no nail colour.",
    },
    people: {
      shows: true,
      casting: "Hands only, adult, of any skin. Never a face.",
      direction: "A hand reaches into the light or holds the bottle as one would at night; never posed for the camera.",
      skin: "Real skin: pores, fine lines and veins, the light catching the oil on it. No smoothing.",
    },
    retouch:
      "Clean the dust from the label and the glass; keep the stone’s pits, the oil’s runs and the skin as they are. Never change the bottle’s shape, the cap’s colour or the label’s words.",
    never: [
      "Cool or blue light",
      "A flash look, or light from the camera",
      "A white seamless backdrop, or marble",
      "Smoothed, plastic skin",
      "Light with no source in the scene",
      "A glossy cap: LYSNE’s cap is matte",
      "Everything sharp from front to back",
      "Glow or haze laid over the picture",
    ],
    recipes: [
      {
        scene: "The bottle on stone in the last sun",
        camera: "50 mm at f/4, at the bottle’s height, a metre away",
        light: "Low sun from behind on the left through a window, 3000 K, hard, 4:1",
        grade: "Golden, rich blacks, fine grain",
        composition: "The bottle on the lower right third, window shapes across the left",
      },
      {
        scene: "A bottle on its side in the light’s patterns",
        camera: "85 mm at f/2.8, from 30° above",
        light: "Sun through water or ribbed glass, 3200 K, patterns across the stone",
        grade: "Golden, honey highlights that bloom a little",
        composition: "The bottle on the diagonal, its cap to the top right",
      },
      {
        scene: "Oil on stone, close",
        camera: "100 mm macro at f/5.6; top-down allowed",
        light: "Raking sun from the side, 3000 K",
        grade: "The amber held rich, fine grain",
        composition: "The oil’s edge across the frame; no bottle, or only a part of it",
      },
      {
        scene: "A hand in the light",
        camera: "85 mm at f/2.8, at the hand’s height",
        light: "One shaft of low sun, 2900 K, the rest in warm shade",
        grade: "Golden, the skin kept true",
        composition: "The hand comes in from the edge; the bottle sharp, the hand a little soft",
      },
      {
        scene: "The bedside at night",
        camera: "35 mm at f/2, at the table’s height",
        light: "The bedside lamp, 2400 K, the only light, falling off fast",
        grade: "Warm, deep umber shadows, a little more grain",
        composition: "The bottle by the lamp’s foot, the bed soft behind",
      },
    ],
    evidence: [
      {
        picture: 1,
        url: img("02-01", "square"),
        kind: "brand",
        shows: "Window shapes across the plaster, the bottle on the right third.",
      },
      {
        picture: 2,
        url: img("05-03", "square"),
        kind: "brand",
        shows: "Oil and drops on travertine, the light’s patterns through the glass.",
      },
      {
        picture: 3,
        url: img("04-06", "square"),
        kind: "brand",
        shows: "A hand in the low sun: real skin, and no face.",
      },
      {
        picture: 4,
        url: img("07-10", "square"),
        kind: "site",
        shows: "Oil running from a hand into the light. One source, a hard shadow.",
      },
      {
        picture: 5,
        url: img("09-13", "square"),
        kind: "site",
        shows: "A bottle on its side in water’s patterns, its cap to the top.",
      },
      {
        picture: 6,
        url: img("03-08", "square"),
        kind: "brand",
        shows: "The label close: cream and crisp, the glass soft around it.",
      },
      {
        picture: 7,
        url: img("10-08", "square"),
        kind: "brand",
        shows: "A stone ledge in warm shade, the bottle small in a calm frame.",
      },
      {
        picture: 8,
        url: img("01-12", "square"),
        kind: "site",
        shows: "The bottle on the diagonal, the light’s pattern on the stone.",
      },
      {
        picture: 9,
        url: gen("taste-stone"),
        kind: "liked",
        shows: "Travertine blocks and linen in warm light from the side.",
      },
      { picture: 10, url: gen("taste-hands"), kind: "liked", shows: "Hands with oil at the bedside, in lamp light." },
      { picture: 11, url: gen("taste-bedroom"), kind: "liked", shows: "The bedroom at dusk with one lamp." },
      {
        picture: 12,
        url: gen("taste-clinical"),
        kind: "not_us",
        shows: "Cool, clinical white with glass and a lab: what LYSNE is not.",
      },
    ],
    sources: [
      {
        part: "light",
        source: "pictures",
        evidence: "Pictures 1, 2, 4, 5 and 8: low sun from one side and hard shadows.",
      },
      {
        part: "colour",
        source: "pictures",
        evidence: "Every picture has honey ambers and warm shadows; picture 12, cool white, was turned down.",
      },
      {
        part: "people",
        source: "taste",
        evidence: "Hands were liked (picture 10); none of the brand’s own pictures shows a face.",
      },
      {
        part: "styling",
        source: "brand_dna",
        evidence: "Imagery: travertine, plaster and linen; the cap is matte burgundy.",
      },
      {
        part: "the bedside at night",
        source: "taste",
        evidence: "Pictures 10 and 11, both liked; none of the brand’s own pictures is at night.",
      },
      { part: "retouching", source: "fume", evidence: "Fume’s proposal: the pictures show no retouching to read." },
    ],
    gaps: [
      "Does LYSNE show people beyond hands? None of its pictures has a face.",
      "Is there a night look of its own? Only two liked pictures are at night.",
      "Which lenses does LYSNE’s photographer use? Fume read them from the pictures.",
    ],
    pictures: 12,
  };
}
