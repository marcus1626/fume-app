// Fume's pictures, kept on this device (a service worker; src/lib/pictures.ts starts it in the live app).
// A creative is a picture of 2 to 9 MB in Fume's private storage, behind a signed link that changes every few hours.
// This keeps each picture by its place in storage, not by its link, so a page opened again shows it at once; and on
// Vercel it fetches the picture through Vercel's image service, as WebP at most 2048 pixels wide (the size a creative
// is made at), a tenth of the bytes. Only what the page shows as a picture: a download or a file the app reads goes
// straight to storage, untouched. Signing out deletes what is kept.
const KEPT = "fume-pictures-v1";
const MOST = 600;
const SMALLER = self.location.hostname !== "localhost" && self.location.hostname !== "127.0.0.1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.destination !== "image") return;
  const url = new URL(request.url);
  if (!url.hostname.endsWith(".supabase.co")) return;
  const place = url.pathname.match(/^\/storage\/v1\/object\/sign\/(.+)$/);
  if (!place || url.searchParams.has("download")) return;
  event.respondWith(picture(url, place[1]));
});

async function picture(url, place) {
  const key = new Request(`${self.location.origin}/__pictures/${url.hostname}/${place}`);
  const kept = await caches.open(KEPT);
  const hit = await kept.match(key);
  if (hit) return hit;
  let response = null;
  if (SMALLER && !/\.svg$/i.test(place)) {
    // The image service picks WebP from Accept, which a fetch from here does not send by itself.
    response = await fetch(`/_vercel/image?url=${encodeURIComponent(url.href)}&w=2048&q=80`, {
      headers: { Accept: "image/webp,image/*;q=0.8" },
    }).catch(() => null);
    if (response && !response.ok) response = null;
  }
  if (!response) response = await fetch(url.href, { mode: "cors", credentials: "omit" });
  if (response.ok) {
    await kept.put(key, response.clone());
    void trim(kept);
  }
  return response;
}

/** The oldest go first once more than MOST are kept. */
async function trim(kept) {
  const keys = await kept.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MOST))) await kept.delete(key);
}
