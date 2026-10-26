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
  return client;
}

/** A database error as the contract's error: the commands put the code in the error's detail. */
export function toFumeError(error: PostgrestError | { message: string; details?: string | null }): FumeError {
  const detail = (error as PostgrestError).details ?? undefined;
  const code = CODES.find((c) => c === detail) ?? "unavailable";
  return new FumeError(code, error.message);
}

/** Calls a command by name with its p_* parameters and returns what it answers. */
export async function command<T>(name: string, params: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().rpc(name, params);
  if (error) throw toFumeError(error);
  return data as T;
}

/** Reads rows; an error becomes the contract's error. */
export async function rows<T>(query: PromiseLike<{ data: T[] | null; error: PostgrestError | null }>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw toFumeError(error);
  return data ?? [];
}

/** Reads one row, or fails with not_found. */
export async function one<T>(
  query: PromiseLike<{ data: T | null; error: PostgrestError | null }>,
  what: string,
): Promise<T> {
  const { data, error } = await query;
  if (error) throw toFumeError(error);
  if (!data) throw new FumeError("not_found", `No such ${what}.`);
  return data;
}

/** A key for one press of a button, so a retry of the same press never acts twice. */
export function requestKey(): string {
  return crypto.randomUUID();
}
