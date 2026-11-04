// The preview's password (Vercel Routing Middleware). Every request but the emails' logo (/email/) asks for it first;
// the browser remembers it for the session. The password is the PREVIEW_PASSWORD environment variable of the Vercel
// project. Without it, nothing is served. Any user name works. This runs only on Vercel; `npm run dev` never asks.
import { next } from "@vercel/functions";

export default function middleware(request: Request) {
  // The logo in Fume's sign-in and invitation emails (supabase/templates) must load in any inbox.
  const path = new URL(request.url).pathname;
  if (path.startsWith("/email/")) return next();
  // The design service is called by Fume's backend, not a browser. It holds no keys and does work only with a live
  // signed link to a picture in Fume's own storage and signed links to store the result there, which only Fume's
  // backend can make (services/design/src/handler.ts).
  if (path === "/api/design") return next();
  // The same holds for the screenshots of a brand's website (services/design/src/shot.ts): it stores them only through
  // signed upload links to Fume's storage.
  if (path === "/api/shot") return next();
  const password = process.env.PREVIEW_PASSWORD;
  const given = passwordOf(request.headers.get("authorization"));
  if (password && given !== undefined && same(given, password)) return next();
  return new Response("This preview of the Fume app needs a password.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Fume app preview", charset="UTF-8"', "Cache-Control": "no-store" },
  });
}

/** The password from an HTTP Basic Authorization header ("Basic base64(user:password)"). */
function passwordOf(header: string | null): string | undefined {
  if (!header?.startsWith("Basic ")) return undefined;
  try {
    const decoded = atob(header.slice(6));
    return decoded.slice(decoded.indexOf(":") + 1);
  } catch {
    return undefined;
  }
}

/** Compares in constant time, so the answer's timing says nothing about how much of the password was right. */
function same(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
