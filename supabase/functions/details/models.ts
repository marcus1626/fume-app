// The details function's language model (docs/mvp/detail-read.md): it finds the product's print on the picture and on
// the product's own photographs, and reads each close crop against the real one. Claude Haiku, the cheap model; the
// handler only sees `find` and `read`, so another provider fits.
import type Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { betaZodOutputFormat } from "npm:@anthropic-ai/sdk@1.3.0/helpers/beta/zod";
import { z } from "npm:zod@4.6.7";
import type { Deps } from "./handler.ts";
import { costOf, MODEL } from "../engine/models.ts";

const Box = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });
const Found = z.object({
  places: z.array(z.object({ what: z.string(), box: Box, photo: z.number().int().min(0), photoBox: Box.nullable() })),
});
const Again = z.object({ found: z.boolean(), box: Box });
const Reading = z.object({ reads: z.string(), expected: z.string(), marks: z.enum(["same", "different", "none"]), ok: z.boolean(), note: z.string() });
const Mapped = z.object({
  parts: z.array(z.object({
    key: z.string(), kind: z.enum(["count", "present", "look"]), what: z.string(), count: z.number().int().nullable(),
    looks: z.string(), photo: z.number().int().min(1), box: Box.nullable(),
  })),
});
const Where = z.object({
  parts: z.array(z.object({ key: z.string(), shown: z.enum(["yes", "hidden", "missing"]), box: Box.nullable() })),
});
const Side = z.object({
  shows: z.string(), whole: z.boolean(), count: z.number().int().nullable(), differs: z.enum(["no", "slightly", "clearly"]), note: z.string(),
});

/** The map is made once per product, so it is made by the careful model; Sonnet 5.5's list price, dollars per million tokens. */
export const MAP_MODEL = "claude-sonnet-5-5";
const MAP_PRICE = { input: 2, output: 10 };
const mapCost = (u: { input_tokens?: number | null; output_tokens?: number | null }) =>
  Math.round(((u.input_tokens ?? 0) * MAP_PRICE.input + (u.output_tokens ?? 0) * MAP_PRICE.output)) / 1_000_000;

export const FIND_SYSTEM = [
  "You help Fume's expert check a product picture an image model made. You get the product's own photographs first and",
  "the generated picture last. Find the places on the generated picture where the product itself shows printed or",
  "woven letters, a wordmark, a logo or a number: a label, a tag, a print on the pack. Never anything outside the product.",
  "A woven or printed label inside a collar or on a seam counts, however small, and so do letters embossed or engraved",
  "in glass, metal or leather (a name raised in a bottle's shoulder): image models garble them as often.",
  "Each block of print is its own place: the wordmark, the product name, a banner or badge, the words around a seal or",
  "an emblem, a line of small words under icons, a count, a line of small print. Go over the whole product top to",
  "bottom and list every block you see, up to eight, the small print first:",
  "image models garble small letters most, so a line of small words is never left out for a big one. For each, what",
  "names that one block so it can be found again (the small words under the three icons), then a tight box around just",
  "it (with the icons that go with its words) on the generated picture, as shares of its width and height (x and y are the top left corner, from 0 to 1), then",
  "the photograph where the same block shows largest (photo 1 is the first image) and a tight box around it there. When",
  "no photograph shows it, photo 0 and photoBox null. When the product shows no print in the picture, answer no places.",
].join(" ");

export const READ_SYSTEM = [
  "You read print for Fume's expert. Image 1 is a close crop of a generated product picture; image 2, when given, is the",
  "same part on the real product's photograph. Read only the named part, the same words on both. Read image 1 as it is,",
  "not as it should be: image models garble letters, and a garbled word must be written garbled, letter for letter,",
  "even when it looks almost like the right word. Letters embossed in glass or metal are low in contrast: follow each",
  "raised stroke and write the letters the strokes make, never the word you expect there.",
  "In reads, write every word and number of the named part on image 1,",
  "exactly as printed, small lines too, in reading order: no description, no quotes; leave out a footnote mark. In",
  "expected, the same for image 2. Leave either empty when its letters cannot be made out at all. ok is true when the",
  "letters are the same (case and spacing aside) and a logo has the same shape; a garbled, missing, extra or swapped",
  "letter or digit is not ok. marks: when the named part has icons, symbols or a logo beside its words, compare their",
  "shapes on image 1 with image 2: same (the same drawings, whatever the size or light), different (another drawing:",
  "a tick for a cross, a head for a brain, a pulse line added to a heart), or none (no icons, or no image 2). A",
  "different icon is not ok. The note says in one short sentence what is wrong, for a designer, in the form: The",
  "collar label reads DRESSMEANN; on the product it reads Dressmann. When ok is true, or there is no image 2, the note",
  "is empty.",
].join(" ");

export const REFINE_SYSTEM = [
  "You help Fume's expert read small print on a product picture. You get a crop of the picture and the name of a part",
  "of the product with print on it (a label, a tag, a wordmark). Give a tight box around just its letters, and the icons or",
  "symbols that go with them, on this crop, as",
  "shares of the crop's width and height (x and y are the top left corner, from 0 to 1). When the crop does not show",
  "it, found is false.",
].join(" ");

export const MAP_SYSTEM = [
  "You map a product's parts for Fume's expert, from the product's own photographs, so that every picture an image model",
  "makes of it can be checked part by part against the real product. List the parts an image model could get wrong: for",
  "a shirt the collar, the buttons on the front, the cuffs, the sleeves, the pockets, the yoke, the hem, the label, the",
  "pattern and the fabric; for a shoe the laces, the eyelets, the tongue, the sole, the heel, the logo, the stitching and",
  "the material; for a bottle or a pack the cap, the neck, the label, the shape and what shows through it. Only parts the",
  "photographs show. At most ten, the most telling first. For each: key, a short lowercase name (buttons, chest-pocket);",
  "kind: count when how many matters (buttons, eyelets, pockets), present when it must be there and look like this (a",
  "collar, a zip, a flap), look when its look is what matters (pattern, fabric, finish, colour, shape); what, its name as a",
  "designer says it (the front buttons); count, how many the product has, counted with care on the photograph that shows",
  "them all, for count only, else null; looks, one plain sentence a designer can check a picture against, with its colour,",
  "shape, number and material as a shopper sees them, no thread or fibre detail (seven white buttons down the front",
  "placket, none on the collar points); photo,",
  "the photograph where it shows best (1 is the first image); box, a tight box around it there, as shares of that",
  "photograph's width and height (x and y are the top left corner, from 0 to 1). For pattern, fabric and finish, the box is",
  "a plain patch of it about a fifth of the product wide; for shape, the whole product. Never the printed letters",
  "themselves: they are read elsewhere; the label as a part (where it sits, its colour and shape) is a part.",
].join(" ");

export const LOCATE_SYSTEM = [
  "You help Fume's expert check a product picture an image model made, part by part. The first images are the real",
  "product's own photographs; the last image is the generated picture. You get a list of the product's parts, each with a",
  "key and how it looks on the real product. For each part, say whether the generated picture shows it. yes: it is there;",
  "give a tight box around it on the generated picture. hidden: this view of the product would not show it (it is on the",
  "back, under an arm, cut by the frame, covered), which is no fault; box null. missing: the picture shows the side of",
  "the product where the part belongs, uncovered, and the part is not drawn; give a box where it should be. Missing is a",
  "fault the designer must fix, so say it only when you are sure. Boxes are shares of the generated picture's width and",
  "height (x and y are the top left corner, from 0 to 1). Answer every key once.",
].join(" ");

const Counted = z.object({ count: z.number().int().nullable(), whole: z.boolean() });
export const COUNT_SYSTEM = [
  "You count for Fume's expert. The image is a close crop of a product picture an image model made. Count the named",
  "things on it one by one, carefully, top to bottom: only those you can see, each once, none you expect but cannot",
  "see. A sewn or fixed part (a pocket, a flap, a strap) counts only when its edges show as made: a blurred trace, a",
  "faint partial outline or a smudge where one might have been is not one. whole: true when the crop shows the whole",
  "run of them, none cut by the crop's edge or covered. When you cannot count them, count is null.",
].join(" ");

export const COMPARE_SYSTEM = [
  "You compare one part of a product for Fume's expert. Image 1 is a close crop of a picture an image model made; image 2",
  "is the same part on the real product's photograph. Look only at the named part, and judge it as a shopper would who",
  "gets the real product after seeing the picture at its normal size. A fault is what that shopper would notice: a",
  "different number (buttons, eyelets, pockets), a part that is missing or added (a pocket, a flap, a zip, a collar's",
  "points, a strap), a different shape or cut, a clearly different colour, a different pattern (stripes for checks, much",
  "bigger or smaller checks, other colours in it), a different material (leather for canvas, knit for woven, shiny for",
  "matte). Never a fault: light, angle, folds, wrinkles, scale; a softer or crisper rendering of the same fabric; the",
  "fine texture of a weave (brushed, fuzzy, melange); thread-level detail, stitching, raw or clean edges; single or",
  "double lines in the same pattern; anything image 1 shows too small, blurred, turned away, covered or cut by the crop",
  "to tell. What image 1 does not show clearly is not a difference, with two exceptions that are always clearly: the",
  "part is absent where it belongs (a smooth shirt front where the pocket should be), and a patch of another pattern or",
  "colour anywhere on it (a stripe across a check). Image 2 is the truth: the words about the real product are a short",
  "description and can be loose or wrong; where they disagree with image 2, image 2 is right, and only when image 2",
  "does not show the part clearly do the words decide. shows: one plain sentence of how the part looks on",
  "image 1, with its number, colour and shape. whole: true when image 1 shows the whole part. count: when the part is",
  "counted and image 1 shows them clearly, how many, else null. differs: no; slightly (a small difference the shopper",
  "would not mind); clearly (a fault as above). note: when differs is clearly, one short sentence for a designer in the",
  "form: The chest pocket has a flap; on the product it has none. Else empty.",
].join(" ");

export function claudeDetails(claude: Anthropic, allowed: () => Promise<boolean>): Pick<Deps, "find" | "read" | "refine" | "map" | "locate" | "compare"> {
  async function ask<T>(system: string, urls: string[], text: string, schema: z.ZodType<T>, model = MODEL) {
    if (!(await allowed())) throw new Error("This week's budget for Fume's language model is used up.");
    const images = urls.map((url): Anthropic.Beta.Messages.BetaContentBlockParam => ({ type: "image", source: { type: "url", url } }));
    const m = await claude.beta.messages.parse({
      model,
      max_tokens: 4_000,
      system,
      messages: [{ role: "user", content: [...images, { type: "text", text }] }],
      thinking: { type: "adaptive" },
      output_config: { effort: model === MAP_MODEL ? "medium" : "low", format: betaZodOutputFormat(schema) },
    });
    if (!m.parsed_output) throw new Error("The answer could not be read.");
    return { out: m.parsed_output as T, usd: model === MAP_MODEL ? mapCost(m.usage) : costOf(m.usage) };
  }
  return {
    async find({ pictureUrl, photoUrls, products }) {
      // The careful model finds the print: the quick one listed the big words and left the small lines out (9 Nov).
      const text = `Images 1 to ${photoUrls.length} are the product's own photographs (${products}); image ${photoUrls.length + 1} is the generated picture.`;
      const { out, usd } = await ask(FIND_SYSTEM, [...photoUrls, pictureUrl], text, Found, MAP_MODEL);
      if (out.places.length > 0) return { places: out.places, usd };
      // The careful model passed over a shirt's small collar label that the quick one finds (Dressmann, 9 Nov).
      const quick = await ask(FIND_SYSTEM, [...photoUrls, pictureUrl], text, Found);
      return { places: quick.out.places, usd: usd + quick.usd };
    },
    async refine({ cropUrl, what }) {
      const { out, usd } = await ask(REFINE_SYSTEM, [cropUrl], `The part is: ${what}.`, Again);
      return { box: out.found ? out.box : null, usd };
    },
    async read({ cropUrl, refUrl, what }) {
      const { out, usd } = await ask(READ_SYSTEM, refUrl ? [cropUrl, refUrl] : [cropUrl],
        `The part is: ${what}.${refUrl ? "" : " There is no image 2."}`, Reading);
      return { ...out, usd };
    },
    async map({ photoUrls, product }) {
      const { out, usd } = await ask(MAP_SYSTEM, photoUrls, `The product: ${product}. ${photoUrls.length} photograph(s).`, Mapped, MAP_MODEL);
      return { parts: out.parts, model: MAP_MODEL, usd };
    },
    async locate({ pictureUrl, photoUrls, parts }) {
      const list = parts.map((p) => `${p.key}: ${p.what}, on the real product ${p.looks}`).join("\n");
      const { out, usd } = await ask(LOCATE_SYSTEM, [...photoUrls, pictureUrl],
        `Images 1 to ${photoUrls.length} are the real product's photographs; image ${photoUrls.length + 1} is the generated picture. The parts:\n${list}`, Where);
      return { parts: out.parts, usd };
    },
    async compare({ cropUrl, refUrl, part, careful }) {
      // A count is made blind, on the picture alone, so the product's number does not lead the model to it; a look (a
      // pattern, a fabric, a shape) is the hardest to see, so the careful model looks at it.
      // The careful second opinion gets no words about the product, only its photograph: a part map's words can be
      // wrong (the Jordan's toe, 6 Nov), and a fault must show on the two pictures.
      const about = careful ? "Judge it from image 2 alone." : `On the real product: ${part.looks}`;
      const { out, usd } = await ask(COMPARE_SYSTEM, [cropUrl, refUrl],
        `The part: ${part.what}. ${about}${part.count != null ? " Its number is counted elsewhere: judge only its look." : ""}`,
        Side, careful || part.kind === "look" ? MAP_MODEL : MODEL);
      if (part.count != null) {
        // A few large parts (a pocket, a flap) are counted by the careful model: a trace where one was removed fools
        // the quick one (the bench, 6 Nov); many small ones (buttons) the quick one counts well.
        const blind = await ask(COUNT_SYSTEM, [cropUrl], `Count the ${part.what}.`, Counted, part.count <= 3 ? MAP_MODEL : MODEL);
        return { shows: out.shows, whole: blind.out.whole, count: blind.out.count, same: out.differs !== "clearly",
          slightly: out.differs === "slightly", note: out.note, usd: usd + blind.usd };
      }
      return { shows: out.shows, whole: out.whole, count: out.count, same: out.differs !== "clearly", slightly: out.differs === "slightly", note: out.note, usd };
    },
  };
}
