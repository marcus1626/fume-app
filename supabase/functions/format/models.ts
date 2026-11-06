// The format function's language model (docs/mvp/formats.md): it says where the product is on the master, so a crop
// never cuts it. Claude Haiku, the cheap model; the handler only sees `locate`, so another provider fits.
import type Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { betaZodOutputFormat } from "npm:@anthropic-ai/sdk@1.3.0/helpers/beta/zod";
import { z } from "npm:zod@4.6.7";
import type { Deps } from "./handler.ts";
import { costOf, Looked, MODEL } from "../engine/models.ts";
import { checklist, EVALUATOR_SYSTEM, evaluatorPrompt, toEvaluation } from "../_shared/engine/evaluate.ts";

export const PLACE_SYSTEM = [
  "You help Fume make a new format of a product picture a customer approved. Say where the product is on the picture,",
  "so a crop to the new shape never cuts it: one box around all of the product that must stay whole (the product itself,",
  "with its label, and the hand or person holding or wearing it when there is one), as shares of the picture's width and",
  "height (x and y are the top left corner, from 0 to 1). Keep the box tight around those; Fume adds the air. In what,",
  "name it in a few words, for a designer (for example: the shirt and its collar label). When there is no product, found",
  "is false.",
].join(" ");

const Placed = z.object({ found: z.boolean(), what: z.string(), x: z.number(), y: z.number(), w: z.number(), h: z.number() });

export function claudePlace(claude: Anthropic, allowed: () => Promise<boolean>): Deps["locate"] {
  return async ({ pictureUrl, format }) => {
    if (!(await allowed())) return { box: null, what: "", usd: 0 };
    const m = await claude.beta.messages.parse({
      model: MODEL,
      max_tokens: 4_000,
      system: PLACE_SYSTEM,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: pictureUrl } },
          { type: "text", text: `The new shape is the ${format} format. Where is the product?` },
        ],
      }],
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: betaZodOutputFormat(Placed) },
    });
    const usd = costOf(m.usage);
    const o = m.parsed_output;
    if (!o?.found) return { box: null, what: "", usd };
    const x = Math.max(0, o.x), y = Math.max(0, o.y);
    const box = { x, y, w: Math.min(1 - x, o.w), h: Math.min(1 - y, o.h) };
    return box.w > 0.01 && box.h > 0.01 ? { box, what: o.what.slice(0, 120), usd } : { box: null, what: "", usd };
  };
}

/** The Engine's look at a redrawn format, the same as at any new picture of the Engine (engine/handler.ts): with the
 *  product's photographs, the first thing to hold is that the product is that product. */
export function claudeLook(claude: Anthropic, allowed: () => Promise<boolean>): NonNullable<Deps["look"]> {
  return async ({ pictureUrl, productUrls, size }) => {
    if (!(await allowed())) throw new Error("This week's budget for Fume's language model is used up.");
    const checks = checklist([], productUrls.length > 0);
    const images = [...productUrls, pictureUrl].map(
      (url): Anthropic.Beta.Messages.BetaContentBlockParam => ({ type: "image", source: { type: "url", url } }),
    );
    const m = await claude.beta.messages.parse({
      model: MODEL,
      max_tokens: 8_000,
      system: EVALUATOR_SYSTEM,
      messages: [{ role: "user", content: [...images, { type: "text", text: evaluatorPrompt(checks, productUrls.length > 0, size) }] }],
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: betaZodOutputFormat(Looked) },
    });
    if (!m.parsed_output) throw new Error("The Engine's look gave no answer.");
    return { evaluation: toEvaluation(checks, m.parsed_output) as unknown as Record<string, unknown>, usd: costOf(m.usage) };
  };
}
