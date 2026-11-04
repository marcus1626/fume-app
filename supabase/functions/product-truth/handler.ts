// Fume reads a product's page and pictures and proposes its facts (supabase/migrations/20261105010000_product_truth.sql).
// The caller's own token decides whether they may ask (ask_product_truth); the service role takes the work. The answer
// comes at once (202); the reading goes on in the background. handler.test.ts runs it without Supabase or a model.
import { judgeTruth, type PageText, type Proposal, type TruthAnswer, type TruthTask } from "./truth.ts";

type Failure = { message: string; details?: string | null } | null;
export type Usage = { model: string; input_tokens: number; output_tokens: number; cost_usd: number };
export type Read = { ok: true; answer: TruthAnswer; usage: Usage; pictureIds: string[] } | { ok: false; error: string; usage: Usage };

export interface Deps {
  /** As the caller: whether they may ask Fume to read this product. */
  mayAsk(productId: string): Promise<{ ok: boolean; reading?: boolean }>;
  service: {
    take(productId: string): Promise<{ data: TruthTask | null; error: Failure }>;
    finish(runId: string, facts: (Proposal & { why?: string })[], output: Record<string, unknown>, usage: Usage): Promise<{ data: { added: number } | null; error: Failure }>;
    fail(runId: string, error: string, usage: Usage): Promise<{ error: Failure }>;
  };
  /** The product's pages as text; none when they will not open. */
  pages(task: TruthTask): Promise<PageText[]>;
  /** Asks the model with the pictures it can open; says which source each picture number is. */
  read(task: TruthTask, pages: PageText[]): Promise<Read>;
  later(work: Promise<unknown>): void;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const answer = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const NONE: Usage = { model: "", input_tokens: 0, output_tokens: 0, cost_usd: 0 };

export async function readProduct(task: TruthTask, deps: Deps): Promise<"read" | "failed"> {
  let pages: PageText[] = [];
  try {
    pages = await deps.pages(task);
  } catch {
    // Read from the pictures only.
  }
  if (!pages.length && !task.pictures.length) {
    await deps.service.fail(task.run_id, "The product has no page that opens and no pictures.", NONE);
    return "failed";
  }
  let read: Read;
  try {
    read = await deps.read(task, pages);
  } catch (e) {
    read = { ok: false, error: e instanceof Error ? e.message : String(e), usage: NONE };
  }
  if (!read.ok) {
    await deps.service.fail(task.run_id, read.error, read.usage);
    return "failed";
  }
  const judged = judgeTruth(task, pages, read.pictureIds, read.answer);
  const { error } = await deps.service.finish(task.run_id, judged.keep,
    { dropped: judged.dropped, unclear: read.answer.unclear, pages: pages.map((p) => p.url), pictures: read.pictureIds.length }, read.usage);
  if (error) {
    await deps.service.fail(task.run_id, error.message, read.usage);
    return "failed";
  }
  return "read";
}

export async function handleTruth(req: Request, deps: (authorization: string) => Deps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return answer(400, { code: "invalid", message: "Use POST." });
  const authorization = req.headers.get("Authorization");
  if (!authorization) return answer(403, { code: "forbidden", message: "Sign in first." });
  let productId: unknown;
  try {
    productId = (await req.json()).productId;
  } catch {
    // handled below
  }
  if (typeof productId !== "string" || !/^[0-9a-f-]{36}$/i.test(productId)) return answer(400, { code: "invalid", message: "Name the product." });
  const d = deps(authorization);
  const may = await d.mayAsk(productId);
  if (!may.ok) return answer(404, { code: "not_found", message: "No such product." });
  if (may.reading) return answer(200, { reading: true });
  const { data: task, error } = await d.service.take(productId);
  if (error) return answer(error.details === "budget" ? 429 : 503, { code: error.details === "budget" ? "budget" : "unavailable", message: error.message });
  if (!task) return answer(200, { reading: true });
  d.later(readProduct(task, d));
  return answer(202, { reading: true });
}
