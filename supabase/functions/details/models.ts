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
const Reading = z.object({ reads: z.string(), expected: z.string(), ok: z.boolean(), note: z.string() });

export const FIND_SYSTEM = [
  "You help Fume's expert check a product picture an image model made. You get the product's own photographs first and",
  "the generated picture last. Find the places on the generated picture where the product itself shows printed or",
  "woven letters, a wordmark, a logo or a number: a label, a tag, a print on the pack. Never anything outside the product.",
  "At most three, the most visible first. For each, give a tight box around just that part on the generated picture, as",
  "shares of its width and height (x and y are the top left corner, from 0 to 1), then the photograph where the same",
  "part shows largest (photo 1 is the first image) and a tight box around it there. When no photograph shows it, photo 0",
  "and photoBox null. When the product shows no print in the picture, answer no places.",
].join(" ");

export const READ_SYSTEM = [
  "You read small print for Fume's expert. Image 1 is a close crop of a generated product picture; image 2, when given,",
  "is the same part on the real product's photograph. In reads, write only the letters of the main word or words on",
  "image 1, exactly as printed, letter for letter: no description, no quotes, no small lines you cannot read. In",
  "expected, the same for image 2. Leave either empty when its letters cannot be read. ok is true when the letters are",
  "the same (case and spacing aside) and a logo has the same shape; a garbled, missing, extra or swapped letter is not",
  "ok. The note says in one short sentence what is wrong, for a designer, in the form: The collar label reads",
  "DRESSMEANN; on the product it reads Dressmann. When ok is true, or there is no image 2, the note is empty.",
].join(" ");

export const REFINE_SYSTEM = [
  "You help Fume's expert read small print on a product picture. You get a crop of the picture and the name of a part",
  "of the product with print on it (a label, a tag, a wordmark). Give a tight box around just that part on this crop, as",
  "shares of the crop's width and height (x and y are the top left corner, from 0 to 1). When the crop does not show",
  "it, found is false.",
].join(" ");

export function claudeDetails(claude: Anthropic, allowed: () => Promise<boolean>): Pick<Deps, "find" | "read" | "refine"> {
  async function ask<T>(system: string, urls: string[], text: string, schema: z.ZodType<T>) {
    if (!(await allowed())) throw new Error("This week's budget for Fume's language model is used up.");
    const images = urls.map((url): Anthropic.Beta.Messages.BetaContentBlockParam => ({ type: "image", source: { type: "url", url } }));
    const m = await claude.beta.messages.parse({
      model: MODEL,
      max_tokens: 4_000,
      system,
      messages: [{ role: "user", content: [...images, { type: "text", text }] }],
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: betaZodOutputFormat(schema) },
    });
    if (!m.parsed_output) throw new Error("The answer could not be read.");
    return { out: m.parsed_output as T, usd: costOf(m.usage) };
  }
  return {
    async find({ pictureUrl, photoUrls, products }) {
      const { out, usd } = await ask(FIND_SYSTEM, [...photoUrls, pictureUrl],
        `Images 1 to ${photoUrls.length} are the product's own photographs (${products}); image ${photoUrls.length + 1} is the generated picture.`, Found);
      return { places: out.places, usd };
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
  };
}
