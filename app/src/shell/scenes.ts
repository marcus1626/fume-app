// The pictures of the empty pages (PROPOSED 27 Oct 2026, Marcus): a page with nothing in it, because everything is
// done or because it is not set up yet, shows one calm card in the middle with a picture that carries the moment.
// Fume's own pictures (house layer: analog interiors and light, nobody posing), made with the Engine, in
// public/scenes/ at 1200 × 800. Which page uses which is in FLOWS §28.
export type Scene =
  | "morning" // hands around a coffee cup in low sun: nothing waits, before noon
  | "afternoon" // tea and a closed notebook on an oak desk: nothing waits, after noon
  | "evening" // a lamp switched on at dusk: nothing waits, in the evening
  | "checked" // a loupe on a squared stack of proofs: nothing waits for a check
  | "start" // an open notebook and a fountain pen: no campaigns yet
  | "parcel" // a kraft parcel on a sunlit stone bench: no deliveries yet
  | "connect" // a lamp with its plug beside the socket: something is not connected yet
  | "quiet" // a window seat with a folded blanket: nothing to review
  | "studio" // an empty studio with the camera ready: the Engine has not run yet
  | "letters"; // opened letters squared away: every notification read

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
