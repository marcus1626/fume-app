// Fume writes a campaign's plan (supabase/migrations/20261027190000_fume_writes_plans.sql). The app calls this after
// sending a brief or "Change it with Fume", and again while the plan page shows "Fume is writing" (a run that never
// came back is taken again after four minutes). The caller's own token decides whether they may see the campaign;
// the service role takes the work, and the database checks the model's plan before it becomes the version.
// The answer comes at once (202); the writing goes on in the background. handler.test.ts runs it without Supabase.
import type { ClaimRead, CopyLine, PlanAnswer, PlanTask } from "./plan.ts";
import { copyLines, copyProblem, judgeCopy } from "./plan.ts";

type Failure = { message: string; details?: string | null } | null;
export interface Usage {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

/** What the model answers: a plan, or why there is none (a refusal, cut off, unreadable). */
export type Written =
  { ok: true; answer: PlanAnswer; usage: Usage } | { ok: false; error: string; usage: Usage; final?: boolean };

export interface Deps {
  /** As the caller: true when they may read the campaign. */
  canRead(campaignId: string): Promise<boolean>;
  service: {
    take(campaignId: string): Promise<{ data: PlanTask | null; error: Failure }>;
    finish(runId: string, body: Record<string, unknown>, changes: string[], usage: Usage): Promise<{ error: Failure }>;
    fail(runId: string, error: string, usage: Usage, final: boolean): Promise<{ error: Failure }>;
    /** Keeps the claim check on the run (staff only), before the plan is handed over. */
    copyChecked?(runId: string, check: Record<string, unknown>): Promise<{ error: Failure }>;
  };
  /** Reads every line of words for claims and voice (the copy lane); absent, the words are not read. */
  checkCopy?(task: PlanTask, lines: CopyLine[]): Promise<{ read: ClaimRead | null; usage: Usage }>;
  /** Asks the model; `problem` is set on the second try after the database refused the first plan. */
  write(task: PlanTask, problem?: string): Promise<Written>;
  toBody(answer: PlanAnswer): Record<string, unknown>;
  /** Keeps the work running after the answer (EdgeRuntime.waitUntil). */
  later(work: Promise<unknown>): void;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const answer = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const add = (a: Usage, b: Usage): Usage => ({
  model: b.model || a.model,
  input_tokens: a.input_tokens + b.input_tokens,
  output_tokens: a.output_tokens + b.output_tokens,
  cost_usd: Math.round((a.cost_usd + b.cost_usd) * 10_000) / 10_000,
});

/** One run: ask, read the words for claims (one rewrite when a claim has no verified fact), hand the plan to the
 * database, and on a refusal by the database ask once more with its reasons. */
export async function writePlan(task: PlanTask, deps: Deps): Promise<"written" | "failed"> {
  let usage: Usage = { model: "", input_tokens: 0, output_tokens: 0, cost_usd: 0 };
  let problem: string | undefined;
  let refused = false;
  let rewroteCopy = false;
  let rewroteFor: unknown[] = [];
  for (let round = 0; round < 3; round++) {
    let written: Written;
    try {
      written = await deps.write(task, problem);
    } catch (e) {
      written = { ok: false, error: e instanceof Error ? e.message : String(e), usage };
    }
    usage = add(usage, written.usage);
    if (!written.ok) {
      await deps.service.fail(task.run_id, written.error, usage, written.final ?? false);
      return "failed";
    }
    if (deps.checkCopy) {
      const lines = copyLines(written.answer);
      let read: ClaimRead | null = null;
      let readError: string | undefined;
      if (lines.length) {
        try {
          const c = await deps.checkCopy(task, lines);
          usage = add(usage, c.usage);
          read = c.read;
          if (!read) readError = "The words could not be read.";
        } catch (e) {
          readError = e instanceof Error ? e.message : String(e);
        }
      }
      const judged = judgeCopy(task, lines, read);
      const blocking = judged.findings.filter((f) => f.blocking);
      if (blocking.length && !rewroteCopy && round < 2) {
        rewroteCopy = true;
        rewroteFor = blocking;
        const claims = blocking.filter((f) => f.kind === "unbacked_claim");
        const language = blocking.filter((f) => f.kind === "language");
        const repeats = blocking.filter((f) => f.kind === "repeats_headline");
        problem = [
          claims.length ? `Words that make a claim no verified fact states: ${copyProblem(claims)} Rewrite those words without the claim, or keep to the product name, the moment and the brief's message.` : "",
          language.length ? `Words with a mistake in their language: ${copyProblem(language)} Write them correctly.` : "",
          repeats.length ? `${copyProblem(repeats)}` : "",
        ].filter(Boolean).join(" ");
        continue;
      }
      await deps.service.copyChecked?.(task.run_id, {
        read: Boolean(read) || lines.length === 0,
        ...(readError ? { error: readError } : {}),
        rewritten: rewroteCopy,
        ...(rewroteCopy ? { rewrote_for: rewroteFor } : {}),
        unbacked: blocking.filter((f) => f.kind === "unbacked_claim").length,
        language: blocking.filter((f) => f.kind === "language").length,
        voice_book: task.voice ? { id: task.voice.id, version: task.voice.version, state: task.voice.state } : null,
        lines: judged.lines,
        findings: judged.findings,
      });
    }
    const { error } = await deps.service.finish(
      task.run_id,
      deps.toBody(written.answer),
      task.change ? written.answer.changes : [],
      usage,
    );
    if (!error) return "written";
    if (error.details !== "invalid" || refused) {
      await deps.service.fail(task.run_id, refused ? `The plan did not pass: ${error.message}` : error.message, usage, false);
      return "failed";
    }
    refused = true;
    problem = error.message;
  }
  await deps.service.fail(task.run_id, `The plan did not pass: ${problem}`, usage, false);
  return "failed";
}

export async function handlePlan(req: Request, deps: (authorization: string) => Deps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return answer(400, { code: "invalid", message: "Use POST." });
  const authorization = req.headers.get("Authorization");
  if (!authorization) return answer(403, { code: "forbidden", message: "Sign in first." });
  let campaignId: string | undefined;
  try {
    campaignId = (await req.json()).campaignId;
  } catch {
    // handled below
  }
  if (!campaignId) return answer(400, { code: "invalid", message: "Name the campaign." });

  const d = deps(authorization);
  if (!(await d.canRead(campaignId))) return answer(404, { code: "not_found", message: "No such campaign." });
  const { data: task, error } = await d.service.take(campaignId);
  if (error) return answer(503, { code: "unavailable", message: error.message });
  if (!task) return answer(200, { writing: false });
  d.later(writePlan(task, d));
  return answer(202, { writing: true, version: task.version });
}
