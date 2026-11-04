// The edge function `brand-scan` (handler.ts says what it does). Deployed with verify_jwt off: the caller's own token
// saves what was read, and the database decides who may.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { openFetch, signedIn as isSignedIn } from "../_shared/net.ts";
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { betaZodOutputFormat } from "npm:@anthropic-ai/sdk@1.3.0/helpers/beta/zod";
import { handleScan } from "./handler.ts";
import { PICTURES_MODEL, PICTURES_SYSTEM, PicturesAnswer, picturesPrompt, toRead } from "./pictures.ts";

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
      headers: { "User-Agent": "FumeBrandReader/1.0 (+https://fumecreatives.com)", Accept: "text/html,text/css,*/*" },
    });
    if (!res?.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!/text|css|html|xml/.test(type)) return null;
    const text = await res.text();
    return { url: res.url || target, text: text.slice(0, LIMIT) };
  } catch {
    return null;
  }
}

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** The pictures as the caller may read them from the brand's folder, read with eyes. */
// deno-lint-ignore no-explicit-any
async function readPictures(asCaller: any, workspaceId: string, ids: string[], brand: string) {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return { error: "Fume's reader is not set up." };
  const { data: rows } = await asCaller.from("files").select("id, bucket, path, name, content_type").eq("workspace_id", workspaceId).in("id", ids);
  const images: { type: "image"; source: { type: "base64"; media_type: "image/jpeg"; data: string } }[] = [];
  const names: string[] = [];
  for (const f of (rows ?? []) as { bucket: string; path: string; name: string; content_type: string }[]) {
    if (!IMAGE_TYPES.has(f.content_type)) continue;
    const { data } = await asCaller.storage.from(f.bucket).download(f.path);
    if (!data || data.size > 4_500_000) continue;
    const bytes = new Uint8Array(await data.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    images.push({ type: "image", source: { type: "base64", media_type: f.content_type as "image/jpeg", data: btoa(bin) } });
    names.push(f.name);
  }
  if (!images.length) return { error: "none of the pictures could be opened." };
  try {
    const workspace = Deno.env.get("ANTHROPIC_WORKSPACE_ID");
    const claude = new Anthropic({ apiKey: key, ...(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : {}) });
    const message = await claude.beta.messages.parse({
      model: PICTURES_MODEL,
      max_tokens: 8_000,
      system: PICTURES_SYSTEM,
      messages: [{ role: "user", content: [...images, { type: "text", text: picturesPrompt(brand, names) }] }],
      output_config: { effort: "low", format: betaZodOutputFormat(PicturesAnswer) },
    });
    const answer = message.stop_reason === "end_turn" ? (message.parsed_output as PicturesAnswer | null) : null;
    return answer ? { read: toRead(answer, names), names } : { error: "the reading could not be used." };
  } catch (e) {
    console.error("brand-scan pictures", e instanceof Error ? e.message : String(e));
    return { error: "the reader did not answer." };
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
  return handleScan(req, signedIn, {
    fetchText,
    readPictures: (ws, ids, brand) => readPictures(asCaller, ws, ids, brand),
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
