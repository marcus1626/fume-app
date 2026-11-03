// The edge function `product-import` (handler.ts says what it does). Deployed with verify_jwt off: the caller's own token
// saves what was read, and the database decides who may.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { openFetch, signedIn as isSignedIn } from "../_shared/net.ts";
import { handleImport } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const keyOf = (json: string, legacy: string) =>
  (Deno.env.get(json) && JSON.parse(Deno.env.get(json)!).default) || Deno.env.get(legacy)!;
const publishable = keyOf("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
const CODES = ["not_found", "forbidden", "invalid", "conflict"];
const LIMIT = 2_000_000;

async function fetchText(target: string): Promise<{ url: string; text: string } | null> {
  try {
    const res = await openFetch(target, {
      signal: AbortSignal.timeout(10_000),
      headers: {
        "User-Agent": "FumeProductReader/1.0 (+https://fumecreatives.com)",
        Accept: "text/html,application/json,application/xml,*/*",
      },
    });
    if (!res?.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!/text|html|xml|json/.test(type)) return null;
    const text = await res.text();
    return { url: res.url || target, text: text.slice(0, LIMIT) };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const authorization = req.headers.get("Authorization") ?? "";
  const asCaller = createClient(url, publishable, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // A real signed-in person, asked of Supabase Auth before Fume opens anything on the web for them.
  const signedIn = await isSignedIn(asCaller, authorization);
  return handleImport(req, signedIn, {
    fetchText,
    save: async (input) => {
      const { data, error } = await asCaller.rpc("save_product_import", input);
      if (!error) return { data };
      const code = CODES.find((c) => c === error.details) ?? "unavailable";
      if (code === "unavailable") console.error("product-import", error.message);
      return {
        error: {
          code,
          message: code === "unavailable" ? "Fume could not keep the products it read. Try again." : error.message,
        },
      };
    },
  });
});
