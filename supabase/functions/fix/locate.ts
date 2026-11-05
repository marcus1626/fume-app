// The fix's language model (docs/mvp/picture-fix.md): it looks at the marked part of the Engine's picture and at the
// product's own photographs, and says where the same part shows best, so the design service can crop it close for the
// image model. Claude Haiku, the cheap model; the handler only sees `locate`, so another provider fits.
import type Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { betaZodOutputFormat } from "npm:@anthropic-ai/sdk@1.3.0/helpers/beta/zod";
import { z } from "npm:zod@4.6.7";
import type { Deps, Found } from "./handler.ts";
import { costOf, MODEL } from "../engine/models.ts";

export const LOCATE_SYSTEM = [
  "You help Fume's designers fix a product picture an image model made. You get a close crop of that picture (image 1)",
  "and the product's own photographs. The designer marked a part of image 1 that is wrong, often a label, a wordmark or",
  "a logo whose letters came out wrong; Fume has blanked that part to a plain patch in image 1, and the designer's words",
  "say what it is. Find the same part of the product on its own photographs.",
  "Pick the one photograph where that part shows largest and sharpest, and give a box around just that part, as shares",
  "of that photograph's width and height (x and y are the top left corner, from 0 to 1). Keep the box tight around the",
  "part itself; Fume adds the room around it. When no photograph shows the part, answer photo 0.",
].join(" ");

const Located = z.object({
  photo: z.number().int().min(0),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  why: z.string(),
});

export function locatePrompt(ask: string, photos: number): string {
  return [
    `Image 1 is the crop of the picture. ${photos === 1 ? "Image 2 is the product's own photograph" : `Images 2 to ${photos + 1} are the product's own photographs; call them photo 1 to ${photos}`}.`,
    `What the designer says is wrong in image 1: ${ask}`,
    "Which photograph shows that same part best, and where on it? In why, say in a few words what the part is, as it reads on the photograph (for example: the woven collar label reading Dressmann).",
  ].join("\n");
}

export function claudeLocate(claude: Anthropic, allowed: () => Promise<boolean>): Deps["locate"] {
  return async ({ ask, cropUrl, photoUrls }) => {
    if (!(await allowed())) return { found: null, usd: 0 };
    const images = [cropUrl, ...photoUrls].map(
      (url): Anthropic.Beta.Messages.BetaContentBlockParam => ({ type: "image", source: { type: "url", url } }),
    );
    const m = await claude.beta.messages.parse({
      model: MODEL,
      max_tokens: 4_000,
      system: LOCATE_SYSTEM,
      messages: [{ role: "user", content: [...images, { type: "text", text: locatePrompt(ask, photoUrls.length) }] }],
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: betaZodOutputFormat(Located) },
    });
    const usd = costOf(m.usage);
    const o = m.parsed_output;
    if (!o || o.photo < 1 || o.photo > photoUrls.length) return { found: null, usd };
    const found: Found = { photo: o.photo, box: { x: o.x, y: o.y, w: o.w, h: o.h }, why: o.why.slice(0, 200) };
    return { found, usd };
  };
}
