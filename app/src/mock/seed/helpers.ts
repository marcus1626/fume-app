// The demo's clock and pictures, shared by every seed file.
import type { Evaluation, Format, Provenance } from "../../contract";

/** The mock's clock: 14 Oct 2026, 14:32 in Oslo. */
export const NOW = Date.parse("2026-10-14T12:32:00Z");
export const at = (minutesAgo: number) => new Date(NOW - minutesAgo * 60_000).toISOString();
export const inDays = (days: number) => new Date(NOW + days * 86_400_000).toISOString();

export const SIZE: Record<Format, [number, number]> = { feed: [1080, 1350], square: [1080, 1080], story: [1080, 1920] };
export const img = (tile: string, format: Format = "feed") =>
  `${import.meta.env.BASE_URL}demo/lysne/${tile}-${format}.jpg`;
/** Pictures made with Higgsfield (app/public/demo/lysne/gen/MANIFEST.md). */
export const gen = (name: string) => `${import.meta.env.BASE_URL}demo/lysne/gen/${name}.jpg`;
/** Pictures for the agency's example clients and the product kinds. */
export const pic = (path: string) => `${import.meta.env.BASE_URL}demo/${path}`;

/** What the Engine read and Maja approved. */
export const engineFound = (evidence: string, minutesAgo = 60 * 24 * 9): Provenance => ({
  origin: "engine",
  state: "approved",
  evidence,
  by: "u-maja",
  at: at(minutesAgo),
});
/** What Maja gave Fume herself. */
export const supplied = (evidence: string): Provenance => ({
  origin: "customer",
  state: "approved",
  evidence,
  by: "u-maja",
  at: at(60 * 24 * 12),
});
/** What the Engine read and proposes, not yet decided. */
export const proposed = (evidence: string, confidence: Provenance["confidence"] = "medium"): Provenance => ({
  origin: "engine",
  state: "proposed",
  evidence,
  confidence,
});

/** An evaluation with nothing found. */
export const ok: Evaluation = { productTruth: "pass", brandRules: "pass", artefacts: "none", notes: [] };
