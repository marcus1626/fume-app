// Fume's alternatives for a brief (the brief form's "Alternatives"). The caller's own token decides whether they may
// see the brand and its products; the service role reads the context and keeps the run. handler.test.ts runs it
// without Supabase or the model.
import type { BriefAnswer, BriefAsk, BriefContext } from "./brief.ts";
import { toAlternatives } from "./brief.ts";

export interface Usage {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}
export type Answer = { ok: true; answer: BriefAnswer; usage: Usage } | { ok: false; error: string; usage: Usage };

export interface Deps {
  /** As the caller: true when they may read the brand. */
  canRead(workspaceId: string): Promise<boolean>;
  context(workspaceId: string, productIds: string[]): Promise<BriefContext | null>;
  write(ask: BriefAsk, ctx: BriefContext): Promise<Answer>;
  keep(run: { workspaceId: string; ask: BriefAsk; output: unknown; error: string | null; usage: Usage }): Promise<void>;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const answer = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

export async function handleBrief(req: Request, deps: (authorization: string) => Deps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return answer(400, { code: "invalid", message: "Use POST." });
  const authorization = req.headers.get("Authorization");
  if (!authorization) return answer(403, { code: "forbidden", message: "Sign in first." });
  let ask: BriefAsk;
  try {
    ask = await req.json();
  } catch {
    return answer(400, { code: "invalid", message: "The request could not be read." });
  }
  if (!ask?.workspaceId || (ask.part !== "message" && ask.part !== "brief"))
    return answer(400, { code: "invalid", message: "Name the brand and what to suggest." });
  if (ask.part === "message" && !ask.goal?.trim() && !ask.message?.trim())
    return answer(400, { code: "invalid", message: "Write the goal or a first message, and Fume suggests from it." });

  const d = deps(authorization);
  if (!(await d.canRead(ask.workspaceId))) return answer(404, { code: "not_found", message: "No such brand." });
  const ctx = await d.context(ask.workspaceId, ask.productIds ?? []);
  if (!ctx) return answer(503, { code: "unavailable", message: "Fume could not read the brand just now." });

  let written: Answer;
  try {
    written = await d.write(ask, ctx);
  } catch (e) {
    written = {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      usage: { model: "", input_tokens: 0, output_tokens: 0, cost_usd: 0 },
    };
  }
  const alternatives = written.ok ? toAlternatives(ask, written.answer) : null;
  await d
    .keep({
      workspaceId: ask.workspaceId,
      ask,
      output: alternatives,
      error: written.ok ? null : written.error,
      usage: written.usage,
    })
    .catch(() => undefined);
  if (!alternatives || alternatives.length === 0)
    return answer(503, { code: "unavailable", message: "Fume has no alternatives this time. Try again in a moment." });
  return answer(200, { alternatives });
}
