// Fume answers a customer's message in the Fume chat. The app calls this right after `say` when Fume should answer;
// the caller's own token decides whether they may read the message, the service role reads what Fume may know and
// writes the answer. When the model cannot answer (over the week's budget, an error), a person at Fume takes over, so
// a customer is never left without an answer. handler.test.ts runs it without Supabase or the model.
import { type Card, type ChatAnswer, type ChatContext, toCard } from "./chat.ts";

export interface Usage {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}
export type Answer = { ok: true; answer: ChatAnswer; usage: Usage } | { ok: false; error: string; usage: Usage };

export interface Deps {
  /** As the caller: true when they may read the message. */
  canRead(messageId: string): Promise<boolean>;
  context(messageId: string): Promise<ChatContext | null>;
  write(ctx: ChatContext): Promise<Answer>;
  /** fume_chat_answer: the answer as kept, or null when the message was answered already. */
  answer(messageId: string, text: string, card: Card | null): Promise<unknown>;
  keep(run: { ctx: ChatContext; output: unknown; error: string | null; usage: Usage }): Promise<void>;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const NONE: Usage = { model: "", input_tokens: 0, output_tokens: 0, cost_usd: 0 };

export async function handleChat(req: Request, deps: (authorization: string) => Deps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply(400, { code: "invalid", message: "Use POST." });
  const authorization = req.headers.get("Authorization");
  if (!authorization) return reply(403, { code: "forbidden", message: "Sign in first." });
  let messageId: string | undefined;
  try {
    messageId = (await req.json())?.messageId;
  } catch {
    return reply(400, { code: "invalid", message: "The request could not be read." });
  }
  if (!messageId) return reply(400, { code: "invalid", message: "Name the message." });

  const d = deps(authorization);
  if (!(await d.canRead(messageId))) return reply(404, { code: "not_found", message: "No such message." });
  const ctx = await d.context(messageId);
  if (!ctx) return reply(503, { code: "unavailable", message: "Fume could not read the conversation just now." });
  if (!ctx.answer) return reply(200, { message: null });

  let written: Answer;
  try {
    written = await d.write(ctx);
  } catch (e) {
    written = { ok: false, error: e instanceof Error ? e.message : String(e), usage: NONE };
  }
  // A handover's words are Fume's own ("That is one for a person. Sander at Fume will answer you here.").
  const card: Card | null = written.ok
    ? toCard(written.answer, ctx)
    : { kind: "handover", reason: "Fume could not answer this just now, so a person at Fume takes it." };
  const text = written.ok && card?.kind !== "handover" ? written.answer.reply.trim() : "";
  const kept = await d.answer(messageId, text, card);
  await d
    .keep({
      ctx,
      output: written.ok ? written.answer : null,
      error: written.ok ? null : written.error,
      usage: written.usage,
    })
    .catch(() => undefined);
  return reply(200, { message: kept ?? null });
}
