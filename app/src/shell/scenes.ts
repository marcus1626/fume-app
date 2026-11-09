// The pictures of the empty pages (PROPOSED 27 Oct 2026, Marcus): a page with nothing in it, because everything is
// done or because it is not set up yet, shows a picture that carries the moment, with the words on glass over it.
// Fume's own pictures in the house layer of the Imagery system (one warm light, one sharp thing, the subject in the
// right third), made with the Engine, in public/scenes/ at 1920 × 1072. Which page uses which is in FLOWS §28.
export type Scene =
  | "morning" // hands around a coffee cup, steam in the first light: nothing waits, before noon
  | "afternoon" // water in amber glass by a linen curtain: nothing waits, after noon
  | "evening" // a lamp on a walnut sideboard at dusk: nothing waits, in the evening
  | "checked" // a brass loupe on a stack of proofs: nothing waits for a check
  | "start" // a blank notebook and a fountain pen: no campaigns yet
  | "parcel" // a kraft parcel on a travertine bench: no deliveries yet
  | "connect" // a lamp with its plug beside the socket: something is not connected yet
  | "quiet" // a window seat with a folded throw: nothing to review
  | "studio" // a bare plinth under a softbox, the camera ready: the Engine has not run yet
  | "letters"; // opened letters squared, a brass opener: every notification read

export const sceneSrc = (scene: Scene) => `${import.meta.env.BASE_URL}scenes/${scene}.jpg`;

/** The moment of the day, for the pages that greet her: the same hours as Home's "Good morning". */
export function dayScene(hour: number): Scene {
  if (hour < 5 || hour >= 22) return "evening";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

/** The hour in Oslo now, as Home reads it for its greeting. */
export const osloHour = () =>
  Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/Oslo" }).format(Date.now()),
  );
