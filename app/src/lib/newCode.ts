// When Fume ships new code while a tab is open, the tab's pages point at files that are gone, and opening one failed
// with the error page. Then the tab loads the new code once, quietly, where it was; a second failure within a minute
// shows the error page as before, so a real fault never loops.
const KEY = "fume-new-code-at";

/** True for the browsers' words for a page's code that could not be fetched. */
export function isOldCode(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(message);
}

/** Loads the new code once; false when it just did, so the caller shows the error instead. */
export function loadNewCode(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/** Vite says so itself when a page's code fails to load in the background. */
export function watchForNewCode(): void {
  window.addEventListener("vite:preloadError", (event) => {
    if (loadNewCode()) event.preventDefault();
  });
}
