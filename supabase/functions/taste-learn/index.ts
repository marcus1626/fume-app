// The edge function `taste-learn` (handler.ts says what it does). Deployed with verify_jwt off: the caller's own token
// lists what waits (taste_pending decides who may); the service signs stored files and saves the numbers.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import jpeg from "npm:jpeg-js@0.4.4";
import { decode as decodePng } from "npm:fast-png@6.2.0";
import { handleLearn, type Pending } from "./handler.ts";
import { shrink } from "./measure.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const keyOf = (json: string, legacy: string) =>
  (Deno.env.get(json) && JSON.parse(Deno.env.get(json)!).default) || Deno.env.get(legacy)!;
const publishable = keyOf("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
const secret = keyOf("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
const service = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const CODES = ["not_found", "forbidden", "invalid"];
const LIMIT = 15_000_000;

async function fetchImage(target: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(target, {
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
      headers: {
        "User-Agent": "FumeTasteReader/1.0 (+https://fumecreatives.com)",
        Accept: "image/jpeg,image/png;q=0.9,*/*;q=0.5",
      },
    });
    if (!res.ok || !/^image\//.test(res.headers.get("content-type") ?? "")) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return bytes.length > LIMIT ? null : bytes;
  } catch {
    return null;
  }
}

// JPEG and PNG, in plain JavaScript (the edge runtime has no native image codecs); then made small.
async function decode(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    const img = jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 256, formatAsRGBA: true });
    return shrink({ width: img.width, height: img.height, data: img.data }, 256);
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50) {
    const img = decodePng(bytes);
    const ch = img.channels,
      n = img.width * img.height,
      data = new Uint8ClampedArray(n * 4);
    const scale = img.depth === 16 ? 1 / 257 : 1;
    for (let i = 0; i < n; i++) {
      const g = img.data[i * ch]! * scale;
      data[i * 4] = g;
      data[i * 4 + 1] = ch >= 3 ? img.data[i * ch + 1]! * scale : g;
      data[i * 4 + 2] = ch >= 3 ? img.data[i * ch + 2]! * scale : g;
      data[i * 4 + 3] = 255;
    }
    return shrink({ width: img.width, height: img.height, data }, 256);
  }
  return null;
}

Deno.serve((req) => {
  const authorization = req.headers.get("Authorization") ?? "";
  const asCaller = createClient(url, publishable, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signedIn = /^Bearer\s+\S+\.\S+\.\S+$/.test(authorization);
  return handleLearn(req, signedIn, {
    pending: async (workspaceId) => {
      const { data, error } = await asCaller.rpc("taste_pending", { p_workspace_id: workspaceId });
      if (!error) return { data: data as Pending[] };
      const code = CODES.find((c) => c === error.details) ?? "unavailable";
      return {
        error: { code, message: code === "unavailable" ? "Fume could not read the brand just now." : error.message },
      };
    },
    sign: async (bucket, path) => {
      const { data } = await service.storage.from(bucket).createSignedUrl(path, 300);
      return data?.signedUrl ?? null;
    },
    fetchImage,
    decode,
    save: async (workspaceId, measures) => {
      const { data, error } = await service.rpc("save_taste_measures", {
        p_workspace_id: workspaceId,
        p_measures: measures,
      });
      if (error) console.error("taste-learn", error.message);
      return error ? { error } : { data };
    },
  });
});
