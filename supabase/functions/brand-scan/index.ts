// The edge function `brand-scan` (handler.ts says what it does). Deployed with verify_jwt off: the caller's own token
// saves what was read, and the database decides who may.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { handleScan } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const keyOf = (json: string, legacy: string) =>
  (Deno.env.get(json) && JSON.parse(Deno.env.get(json)!).default) || Deno.env.get(legacy)!;
const publishable = keyOf("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
const CODES = ["not_found", "forbidden", "invalid", "conflict"];
const LIMIT = 2_000_000;

async function fetchText(target: string): Promise<{ url: string; text: string } | null> {
  try {
    const res = await fetch(target, {
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "FumeBrandReader/1.0 (+https://fumecreatives.com)", Accept: "text/html,text/css,*/*" },
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!/text|css|html|xml/.test(type)) return null;
    const text = await res.text();
    return { url: res.url || target, text: text.slice(0, LIMIT) };
  } catch {
    return null;
  }
}

Deno.serve((req) => {
  const authorization = req.headers.get("Authorization") ?? "";
  const asCaller = createClient(url, publishable, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signedIn = /^Bearer\s+\S+\.\S+\.\S+$/.test(authorization);
  return handleScan(req, signedIn, {
    fetchText,
    save: async (input) => {
      const { data, error } = await asCaller.rpc("save_brand_scan", input);
      if (!error) return { data };
      const code = CODES.find((c) => c === error.details) ?? "unavailable";
      if (code === "unavailable") console.error("brand-scan", error.message);
      return {
        error: {
          code,
          message: code === "unavailable" ? "Fume could not keep what it read. Try again." : error.message,
        },
      };
    },
  });
});
