// The Engine's language model: it composes the prompt, answers the checks' questions and verifies what stays unclear.
// Claude Haiku first (Marcus, 3 Nov: the cheap model first); the prompt machine only sees the three functions, so
// another provider fits without changing it.
import type Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { betaZodOutputFormat } from "npm:@anthropic-ai/sdk@1.3.0/helpers/beta/zod";
import { z } from "npm:zod@4.6.7";
import type { Digester, Evaluator } from "./handler.ts";
import {
  type Composer,
  COMPOSER_SYSTEM,
  composerPrompt,
  type Decider,
  DECIDER_SYSTEM,
  deciderPrompt,
  DIGEST_SYSTEM,
  digestPrompt,
  EVALUATOR_SYSTEM,
  evaluatorPrompt,
  type ModelCall,
  type Verifier,
  VERIFIER_SYSTEM,
  verifierPrompt,
} from "../_shared/engine/index.ts";

export const MODEL = "claude-haiku-5-5";
/** Claude Haiku 5.5's list price for prompts up to 100K tokens, in dollars per million tokens. */
const PRICE = { input: 0.1, output: 0.5 };
export function costOf(usage: { input_tokens?: number | null; output_tokens?: number | null }): number {
  const cost = ((usage.input_tokens ?? 0) * PRICE.input + (usage.output_tokens ?? 0) * PRICE.output) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

const Slots = z.object({ slots: z.array(z.object({ slotKey: z.string(), text: z.string(), sources: z.array(z.string()) })) });
const Answers = z.object({ answers: z.array(z.object({ n: z.number().int(), probability: z.number().min(0).max(1) })) });
const Verdict = z.object({ expressed: z.boolean(), probability: z.number().min(0).max(1), reason: z.string() });
export const Looked = z.object({
  answers: z.array(z.object({ n: z.number().int(), verdict: z.enum(["holds", "off", "unclear"]), note: z.string(), cause: z.enum(["frame_edge", "missing_part", "other"]).optional() })),
  artefacts: z.enum(["none", "minor", "major"]),
  artefactNotes: z.array(z.string()),
  printedText: z.boolean(),
});
const Lessons = z.object({
  lessons: z.array(z.object({ statement: z.string(), polarity: z.enum(["do", "avoid"]), reason: z.string(), scope: z.enum(["brand", "brand_and_model"]) })),
});

export function claudeModels(
  claude: Anthropic,
  allowed: () => Promise<boolean>,
): { compose: Composer; decide: Decider; verify: Verifier; digest: Digester; evaluate: Evaluator } {
  async function ask<T>(
    task: string,
    system: string,
    content: string | Anthropic.Beta.Messages.BetaContentBlockParam[],
    schema: z.ZodType<T>,
    effort: "low" | "medium",
  ) {
    if (!(await allowed())) throw new Error("This week's budget for Fume's language model is used up.");
    const started = Date.now();
    const m = await claude.beta.messages.parse({
      model: MODEL,
      // Room for its thinking and the answer: the compose prompt grew with the Look Book and the brand's lessons, and at
      // 8,000 it was cut off mid-answer (Anthem v9, 9 Nov: two of six pictures never made). index.ts gives it the time.
      max_tokens: 12_000,
      system,
      messages: [{ role: "user", content }],
      thinking: { type: "adaptive" },
      output_config: { effort, format: betaZodOutputFormat(schema) },
    });
    const call: ModelCall = {
      task,
      provider: "anthropic",
      model: m.model,
      latencyMs: Date.now() - started,
      costUsd: costOf(m.usage),
      inputTokens: m.usage.input_tokens,
      outputTokens: m.usage.output_tokens,
    };
    if (m.stop_reason === "refusal") throw Object.assign(new Error(`The model declined the ${task}.`), { call });
    if (m.stop_reason === "max_tokens") throw Object.assign(new Error(`The ${task} answer was cut off.`), { call });
    if (!m.parsed_output) throw Object.assign(new Error(`The ${task} answer could not be read.`), { call });
    return { out: m.parsed_output as T, call };
  }
  return {
    async compose({ compilePackage, previous }) {
      const { out, call } = await ask("compose", COMPOSER_SYSTEM, composerPrompt(compilePackage, previous), Slots, "medium");
      return { slots: out.slots, call };
    },
    async decide({ text, questions }) {
      const { prompt, keys } = deciderPrompt(text, questions);
      const { out, call } = await ask("decide", DECIDER_SYSTEM, prompt, Answers, "low");
      const probabilities: Record<string, number | null> = Object.fromEntries(keys.map((k) => [k, null]));
      for (const a of out.answers) if (keys[a.n - 1]) probabilities[keys[a.n - 1]] = a.probability;
      return { probabilities, call };
    },
    async verify({ prompt, requirement }) {
      const { out, call } = await ask("verify", VERIFIER_SYSTEM, verifierPrompt(prompt, requirement), Verdict, "low");
      return { ...out, call };
    },
    async evaluate({ pictureUrl, productPhotos, checks, size }) {
      const images = [...productPhotos, { url: pictureUrl }].map(
        (p): Anthropic.Beta.Messages.BetaContentBlockParam => ({
          type: "image",
          source: "url" in p
            ? { type: "url", url: p.url }
            : { type: "base64", media_type: p.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: p.data },
        }),
      );
      const content = [...images, { type: "text" as const, text: evaluatorPrompt(checks, productPhotos.length > 0, size) }];
      const { out, call } = await ask("evaluate", EVALUATOR_SYSTEM, content, Looked, "low");
      return { looked: out, call };
    },
    async digest(a) {
      const prompt = digestPrompt({ decision: a.verdict === "yes" ? "approved" : "rejected", reason: a.why, wanted: null, concept: a.concept, slots: a.slots });
      const { out, call } = await ask("digest", DIGEST_SYSTEM, prompt, Lessons, "low");
      return { lessons: out.lessons, call };
    },
  };
}
