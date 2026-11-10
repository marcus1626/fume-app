// Starts public/pictures.js, which keeps Fume's pictures on this device and fetches them smaller (live app only; the
// demo's pictures are in the app itself).
import { isLive } from "../api/live/supabase";

export function keepPictures(): void {
  if (!isLive || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/pictures.js").catch(() => undefined);
  });
}
