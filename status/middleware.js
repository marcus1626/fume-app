// Password for the status page (Vercel Routing Middleware). The password is the STATUS_PASSWORD environment
// variable of the Vercel project; any user name works. Without the variable set, nothing is served.
export const config = { matcher: "/:path*" };

export default function middleware(request) {
  const password = process.env.STATUS_PASSWORD;
  const given = passwordOf(request.headers.get("authorization"));
  if (password && given !== undefined && same(given, password)) {
    return new Response(null, { headers: { "x-middleware-next": "1" } });
  }
  return new Response("Fume status needs a password.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Fume status", charset="UTF-8"', "Cache-Control": "no-store" },
  });
}

function passwordOf(header) {
  if (!header || !header.startsWith("Basic ")) return undefined;
  try {
    const decoded = atob(header.slice(6));
    return decoded.slice(decoded.indexOf(":") + 1);
  } catch {
    return undefined;
  }
}

// Constant time, so timing says nothing about how much of the password was right.
function same(a, b) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
