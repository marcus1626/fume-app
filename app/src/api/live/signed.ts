// Signed links to private files, kept while they are good. A new link for the same file on every read gave the browser
// a new address each time, so it fetched every picture again; one link per file for hours lets it keep them. The
// pictures themselves are kept and made smaller by public/pictures.js.
import { supabase } from "./supabase";

/** How long a link is good for, and how long before its end a new one is made. */
const LIFE_SECONDS = 6 * 60 * 60;
const RENEW_MS = 30 * 60 * 1000;

const STORE = "fume-signed-links";
type Kept = Map<string, { url: string; until: number }>;
/** Kept for the tab (sessionStorage), so a page opened again or reloaded asks storage for no link it has. */
const kept: Kept = read();

function read(): Kept {
  try {
    const now = Date.now();
    const list = JSON.parse(sessionStorage.getItem(STORE) ?? "[]") as [string, { url: string; until: number }][];
    return new Map(list.filter(([, k]) => k.until > now));
  } catch {
    return new Map();
  }
}

let writing = false;
function write(): void {
  if (writing) return;
  writing = true;
  setTimeout(() => {
    writing = false;
    try {
      sessionStorage.setItem(STORE, JSON.stringify([...kept].slice(-2000)));
    } catch {
      /* no storage: links last until the page reloads */
    }
  }, 500);
}

/** Signed links for paths in one bucket, by path; a path the caller may not read gets none. */
export async function signedLinks(bucket: string, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const now = Date.now();
  const missing: string[] = [];
  for (const path of new Set(paths)) {
    const k = kept.get(`${bucket}/${path}`);
    if (k && k.until - RENEW_MS > now) out.set(path, k.url);
    else missing.push(path);
  }
  if (missing.length === 0) return out;
  const { data } = await supabase().storage.from(bucket).createSignedUrls(missing, LIFE_SECONDS);
  const until = now + LIFE_SECONDS * 1000;
  for (const d of data ?? []) {
    if (!d.path || !d.signedUrl || d.error) continue;
    kept.set(`${bucket}/${d.path}`, { url: d.signedUrl, until });
    out.set(d.path, d.signedUrl);
  }
  write();
  return out;
}

/** On sign-out: no link and no kept picture outlives the session. */
export async function forgetSignedLinks(): Promise<void> {
  kept.clear();
  try {
    sessionStorage.removeItem(STORE);
  } catch {
    /* nothing kept */
  }
  if (typeof caches !== "undefined") await caches.delete("fume-pictures-v1").catch(() => false);
}
