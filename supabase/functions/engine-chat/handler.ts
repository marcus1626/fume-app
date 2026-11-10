// The edge function `engine-chat` (20261110060000_engine_chat.sql). The app calls it right after engine_say with the
// message's id, and the Engine answers in the same thread; or with a field ("Write with Engine"), and the words go back
// to the one who asked. The caller's own token decides whether they may read the message or the field; the service
// role reads what the Engine may know and keeps the answer. When the model cannot answer (over the week's budget, an
// error), the Engine says so in the thread, so nobody waits on it. handler.test.ts runs it without Supabase or the model.
import { type ChatContext, type EngineAnswer, type EngineWriting, type Field, type Knows, knownItems } from "./chat.ts";

export interface Usage {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}
export type Written<T> = { ok: true; out: T; usage: Usage } | { ok: false; error: string; usage: Usage };

export interface Deps {
  /** As the caller: true when they may read the message. */
  canRead(messageId: string): Promise<boolean>;
  context(messageId: string): Promise<ChatContext | null>;
  /** As the caller: what the Engine knows for the field, or null when they may not write it. */
  writeContext(field: Field): Promise<{ workspace_id: string; knows: Knows } | null>;
  answer(ctx: ChatContext): Promise<Written<EngineAnswer>>;
  write(field: Field, knows: Knows): Promise<Written<EngineWriting>>;
  /** engine_chat_answer: the answer as kept, or null when the message was answered already. */
  keepAnswer(messageId: string, text: string, items: string[], suggestion: string | null): Promise<unknown>;
  keep(run: { workspaceId: string; kind: "engine_chat" | "engine_write"; subjectId: string | null; input: unknown; output: unknown; error: string | null; usage: Usage }): Promise<void>;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const NONE: Usage = { model: "", input_tokens: 0, output_tokens: 0, cost_usd: 0 };
export const COULD_NOT = "I could not answer just now. Ask me again in a moment.";

const isField = (f: unknown): f is Field =>
  typeof f === "object" && f !== null && ["plan_line", "plan_creative", "book_line"].includes((f as { kind?: string }).kind ?? "") &&
  typeof (f as { label?: unknown }).label === "string" && typeof (f as { value?: unknown }).value === "string";

async function tried<T>(f: () => Promise<Written<T>>): Promise<Written<T>> {
  try {
    return await f();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), usage: NONE };
  }
}

export async function handleEngineChat(req: Request, deps: (authorization: string) => Deps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply(400, { code: "invalid", message: "Use POST." });
  const authorization = req.headers.get("Authorization");
  if (!authorization) return reply(403, { code: "forbidden", message: "Sign in first." });
  let body: { messageId?: unknown; field?: unknown };
  try {
    body = (await req.json()) ?? {};
  } catch {
    return reply(400, { code: "invalid", message: "The request could not be read." });
  }
  const d = deps(authorization);

  // Write with Engine: words for one field, never written over hers.
  if (body.field !== undefined) {
    if (!isField(body.field)) return reply(400, { code: "invalid", message: "Name the field." });
    const field = body.field;
    const ctx = await d.writeContext(field).catch(() => null);
    if (!ctx) return reply(404, { code: "not_found", message: "No such field." });
    const written = await tried(() => d.write(field, ctx.knows));
    await d.keep({
      workspaceId: ctx.workspace_id, kind: "engine_write", subjectId: null, input: { field },
      output: written.ok ? written.out : null, error: written.ok ? null : written.error, usage: written.usage,
    }).catch(() => undefined);
    if (!written.ok || !written.out.text.trim())
      return reply(503, { code: "unavailable", message: "The Engine could not write it just now. Ask again in a moment." });
    return reply(200, { text: written.out.text.trim(), why: written.out.why.trim() });
  }

  const messageId = body.messageId;
  if (typeof messageId !== "string" || !/^[0-9a-f-]{36}$/i.test(messageId))
    return reply(400, { code: "invalid", message: "Name the message." });
  if (!(await d.canRead(messageId))) return reply(404, { code: "not_found", message: "No such message." });
  const ctx = await d.context(messageId);
  if (!ctx) return reply(503, { code: "unavailable", message: "The Engine could not read the thread just now." });
  if (!ctx.answer) return reply(200, { message: null });

  const written = await tried(() => d.answer(ctx));
  const text = written.ok && written.out.reply.trim() ? written.out.reply.trim() : COULD_NOT;
  const items = written.ok ? knownItems(written.out.items, ctx) : [];
  const suggestion = written.ok && ctx.message.field ? written.out.suggestion?.trim() || null : null;
  const kept = await d.keepAnswer(messageId, text, items, suggestion);
  await d.keep({
    workspaceId: ctx.message.workspace_id, kind: "engine_chat", subjectId: messageId,
    input: { message: ctx.message.text, field: ctx.message.field, talk: ctx.talk.length },
    output: written.ok ? written.out : null, error: written.ok ? null : written.error, usage: written.usage,
  }).catch(() => undefined);
  return reply(200, { message: kept ?? null });
}
