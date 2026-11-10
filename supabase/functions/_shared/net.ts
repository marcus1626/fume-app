// Reading the open web from an edge function. Fume opens only public addresses: never the machine itself, a private
// network or a cloud's metadata address, by name, by number or after a redirect.

const V4_CLOSED: [number, number][] = [
  [0x00000000, 8], // 0.0.0.0/8
  [0x0a000000, 8], // 10/8
  [0x64400000, 10], // 100.64/10
  [0x7f000000, 8], // 127/8
  [0xa9fe0000, 16], // 169.254/16
  [0xac100000, 12], // 172.16/12
  [0xc0000000, 24], // 192.0.0/24
  [0xc0a80000, 16], // 192.168/16
  [0xc6120000, 15], // 198.18/15
  [0xe0000000, 3], // 224/3: multicast and reserved
];

function v4(address: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((p) => p > 255)) return null;
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

/** Whether an IP address (v4 or v6, brackets allowed) is a private, local or reserved one. */
export function closedAddress(address: string): boolean {
  const a = address.replace(/^\[|\]$/g, "").toLowerCase();
  const n = v4(a);
  if (n !== null) return V4_CLOSED.some(([base, bits]) => n >>> (32 - bits) === base >>> (32 - bits));
  if (!a.includes(":")) return false;
  // An IPv4 address carried in IPv6 (::ffff:10.0.0.1, or its hex form).
  const mapped = /^(?:0*:)*:?ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(a);
  if (mapped) return closedAddress(mapped[1]!);
  const hex = /^(?:0*:)*:?ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(a);
  if (hex) {
    const hi = parseInt(hex[1]!, 16),
      lo = parseInt(hex[2]!, 16);
    return closedAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  if (/^[0:]*:?1?$/.test(a)) return true; // :: and ::1
  return /^(f[cd]|fe[89ab]|ff)/.test(a); // unique local, link local, multicast
}

/** Whether Fume may open this host name as it is written (DNS is checked when fetching). */
export function publicHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (!h || h === "localhost" || /\.(localhost|local|internal|lan|home|corp)$/.test(h)) return false;
  if (closedAddress(h)) return false;
  // A name needs a dot; an address in v4 or v6 that is public passes.
  return h.includes(".") || h.startsWith("[");
}

/** The address as a URL Fume may open, or undefined. */
export function publicUrl(raw: string): URL | undefined {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return undefined;
    if (u.username || u.password) return undefined;
    if (u.port && u.port !== "80" && u.port !== "443") return undefined;
    return publicHost(u.hostname) ? u : undefined;
  } catch {
    return undefined;
  }
}

type Resolve = (host: string, type: "A" | "AAAA") => Promise<string[]>;
const resolveDns: Resolve = (host, type) => (Deno as unknown as { resolveDns: Resolve }).resolveDns(host, type);

/** Whether the name points only at public addresses. A name that does not resolve is left to fetch to fail. */
async function resolvesPublic(hostname: string, resolve: Resolve): Promise<boolean> {
  if (hostname.startsWith("[") || v4(hostname) !== null) return true;
  const found = await Promise.all(
    (["A", "AAAA"] as const).map((t) => resolve(hostname, t).catch(() => [] as string[])),
  );
  return !found.flat().some(closedAddress);
}

/**
 * fetch for an address someone typed or a page linked: only public addresses, and each redirect is checked again
 * (up to five). Returns null when an address on the way is closed.
 */
export async function openFetch(
  target: string,
  init: RequestInit = {},
  deps: { fetch?: typeof fetch; resolve?: Resolve } = {},
): Promise<Response | null> {
  const get = deps.fetch ?? fetch;
  const resolve = deps.resolve ?? resolveDns;
  let url = target;
  for (let hop = 0; hop <= 5; hop++) {
    const u = publicUrl(url);
    if (!u || !(await resolvesPublic(u.hostname, resolve))) return null;
    const res = await get(u.href, { ...init, redirect: "manual" });
    const next = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!next) {
      // The address it ended on, for reading relative links.
      if (hop > 0) Object.defineProperty(res, "url", { value: u.href });
      return res;
    }
    await res.body?.cancel();
    url = new URL(next, u).href;
  }
  return null;
}

/** Whether the request carries a signed-in person's token, asked of Supabase Auth (not read from its shape). */
export async function signedIn(
  client: { auth: { getUser(jwt?: string): Promise<{ data: { user: unknown } }> } },
  authorization: string,
): Promise<boolean> {
  const jwt = authorization.replace(/^Bearer\s+/i, "");
  if (!/^\S+\.\S+\.\S+$/.test(jwt)) return false;
  try {
    const { data } = await client.auth.getUser(jwt);
    return Boolean(data.user);
  } catch {
    return false;
  }
}
