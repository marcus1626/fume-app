// Fume writes a brand's book (supabase/migrations/20261104233000_brand_books.sql): the app calls this after
// write_brand_book, and again while the page shows "Fume is writing" (a writing that never came back is taken again
// after four minutes). The caller's own token decides whether they may see the brand; the service role takes the
// work. The answer comes at once (202); the writing goes on in the background. handler.test.ts runs it without
// Supabase or a model.
import type { BookTask, PageText } from "./book.ts";

type Failure = { message: string; details?: string | null } | null;
export type Usage = { model: string; input_tokens: number; output_tokens: number; cost_usd: number };
export type Written =
  | { ok: true; body: Record<string, unknown>; sources: Record<string, unknown>; usage: Usage }
  | { ok: false; error: string; usage: Usage; final?: boolean };

export interface Deps {
  canRead(bookId: string): Promise<boolean>;
  service: {
    take(bookId: string): Promise<{ data: BookTask | null; error: Failure }>;
    finish(bookId: string, body: Record<string, unknown>, sources: Record<string, unknown>, usage: Usage): Promise<{ error: Failure }>;
    fail(bookId: string, error: string, usage: Usage, final: boolean): Promise<{ error: Failure }>;
  };
  /** The brand's own pages, read as text (home and a few linked pages); none when there is no site or it is closed. */
  pages(website: string | null): Promise<PageText[]>;
  /** Asks the model for the book and turns the answer into its body (with the CSS and contrast built by code). */
  write(task: BookTask, pages: PageText[]): Promise<Written>;
  later(work: Promise<unknown>): void;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const answer = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

export async function writeBook(task: BookTask, deps: Deps): Promise<"written" | "failed"> {
  let pages: PageText[] = [];
  try {
    pages = await deps.pages(task.website);
  } catch {
    // Written from what Fume knows, without the pages.
  }
  let written: Written;
  try {
    written = await deps.write(task, pages);
  } catch (e) {
    written = { ok: false, error: e instanceof Error ? e.message : String(e), usage: { model: "", input_tokens: 0, output_tokens: 0, cost_usd: 0 } };
  }
  if (!written.ok) {
    await deps.service.fail(task.book.id, written.error, written.usage, written.final ?? false);
    return "failed";
  }
  const { error } = await deps.service.finish(task.book.id, written.body, { ...written.sources, pages: pages.map((p) => p.url) }, written.usage);
  if (error) {
    await deps.service.fail(task.book.id, error.message, written.usage, false);
    return "failed";
  }
  return "written";
}

export async function handleBook(req: Request, deps: (authorization: string) => Deps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return answer(400, { code: "invalid", message: "Use POST." });
  const authorization = req.headers.get("Authorization");
  if (!authorization) return answer(403, { code: "forbidden", message: "Sign in first." });
  let bookId: unknown;
  try {
    bookId = (await req.json()).bookId;
  } catch {
    // handled below
  }
  if (typeof bookId !== "string" || !/^[0-9a-f-]{36}$/i.test(bookId)) return answer(400, { code: "invalid", message: "Name the book." });
  const d = deps(authorization);
  if (!(await d.canRead(bookId))) return answer(404, { code: "not_found", message: "No such book." });
  const { data: task, error } = await d.service.take(bookId);
  if (error) return answer(503, { code: "unavailable", message: error.message });
  if (!task) return answer(200, { writing: false });
  d.later(writeBook(task, d));
  return answer(202, { writing: true, version: task.book.version });
}
