// The Vercel function (built to api/design.js by tools/build.mjs). Fonts the brand has not given Fume come from
// Google Fonts; a family Google does not have is set in the book's fallback, and the check says so.
import { handle } from "../src/handler.ts";
import { start } from "../src/render.ts";

start({ online: true });

export async function POST(req: Request): Promise<Response> {
  return handle(req, { storageHost: process.env.FUME_STORAGE_HOST ?? "vkusmctftfzsrxbcxtdz.supabase.co", fetch });
}

export async function GET(): Promise<Response> {
  return new Response(JSON.stringify({ service: "fume-design", ok: true }), { headers: { "content-type": "application/json" } });
}
