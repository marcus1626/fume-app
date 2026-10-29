// The live backend's client: Fume's Supabase project (EU), reached with the publishable key. Every read goes through
// the database's row-level security, and every change through a command (a Postgres function) that checks the
// caller's role and the rules (supabase/migrations/*_commands.sql). Nothing secret lives in the browser.
import { createClient, type PostgrestError, type SupabaseClient } from "@supabase/supabase-js";
import { FumeError, type FumeErrorCode } from "../../contract";

const CODES: FumeErrorCode[] = ["not_found", "forbidden", "conflict", "invalid", "unavailable"];

/** True when this build talks to the live backend (VITE_FUME_API=supabase). */
export const isLive = import.meta.env.VITE_FUME_API === "supabase";

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!url || !key) throw new FumeError("unavailable", "The live backend is not configured for this build.");
  client = createClient(url, key, { auth: { persistSession: true, detectSessionInUrl: true, flowType: "pkce" } });
  // Someone else signed in (or out): nothing read for the last person may answer for the next.
  client.auth.onAuthStateChange(() => forgetReads());
  return client;
}

// ─── Reads asked for twice ───────────────────────────────────────────────────
// One screen asks for the same rows from several places at once (the session, the campaign, the plan and Home each
// read the brand's campaigns). The same read within a moment answers from the one request already made. Any command
// and any live update forgets them, so a read after a change is always fresh.

const FRESH_MS = 1500;
const reads = new Map<string, { at: number; result: Promise<unknown> }>();

/** Forget the reads kept for a moment: after a change, a live update, or another person signing in. */
export function forgetReads(): void {
  reads.clear();
}

/** The read's address, when it is a plain read (GET) that may be shared; anything else is never shared. */
function readKey(query: unknown): string | undefined {
  const b = query as { url?: URL; method?: string; headers?: unknown; isMaybeSingle?: boolean };
  if (!(b.url instanceof URL) || b.method !== "GET") return undefined;
  const headers = b.headers instanceof Headers ? Object.fromEntries(b.headers.entries()) : (b.headers ?? {});
  return `${b.url.toString()} ${JSON.stringify(headers)} ${b.isMaybeSingle ? "maybe" : ""}`;
}

function shared<R>(query: PromiseLike<R>): Promise<R> {
  const key = readKey(query);
  if (!key) return Promise.resolve(query);
  const now = Date.now();
  const kept = reads.get(key);
  if (kept && now - kept.at < FRESH_MS) return kept.result as Promise<R>;
  const result = Promise.resolve(query);
  reads.set(key, { at: now, result });
  // A failed read is asked again next time.
  result.then(
    (r) => {
      if ((r as { error?: unknown }).error) reads.delete(key);
    },
    () => reads.delete(key),
  );
  return result;
}

/** A database error as the contract's error: the commands put the code in the error's detail. */
export function toFumeError(error: PostgrestError | { message: string; details?: string | null }): FumeError {
  const detail = (error as PostgrestError).details ?? undefined;
  const code = CODES.find((c) => c === detail) ?? "unavailable";
  return new FumeError(code, error.message);
}

/** Calls a command by name with its p_* parameters and returns what it answers. */
export async function command<T>(name: string, params: Record<string, unknown>): Promise<T> {
  forgetReads();
  const { data, error } = await supabase().rpc(name, params);
  forgetReads();
  if (error) throw toFumeError(error);
  return data as T;
}

/** Reads rows; an error becomes the contract's error. */
export async function rows<T>(query: PromiseLike<{ data: T[] | null; error: PostgrestError | null }>): Promise<T[]> {
  const { data, error } = await shared(query);
  if (error) throw toFumeError(error);
  return data ?? [];
}

/** Reads one row, or fails with not_found. */
export async function one<T>(
  query: PromiseLike<{ data: T | null; error: PostgrestError | null }>,
  what: string,
): Promise<T> {
  const { data, error } = await shared(query);
  if (error) throw toFumeError(error);
  if (!data) throw new FumeError("not_found", `No such ${what}.`);
  return data;
}

/** A key for one press of a button, so a retry of the same press never acts twice. */
export function requestKey(): string {
  return crypto.randomUUID();
}

const asked = new Map<string, number>();
/** Asks Fume to write the campaign's plan when one is waiting for it (supabase/functions/fume-plan). It answers at
 *  once and writes in the background; the record's new row refreshes the plan. At most once a minute per campaign,
 *  unless `now`, and never in the way: a failure here only means the next read asks again. */
export function askFumeToWrite(campaignId: string, now = false): void {
  const last = asked.get(campaignId) ?? 0;
  if (!now && Date.now() - last < 60_000) return;
  asked.set(campaignId, Date.now());
  void supabase()
    .functions.invoke("fume-plan", { body: { campaignId } })
    .catch(() => undefined);
}
