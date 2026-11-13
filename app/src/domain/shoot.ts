// A shoot's pictures sorted into picks, the rest and left out (FLOWS §38.3), from what a quick look measures in each.
// Pure rules: the mock measures a dropped shoot in the browser (lib/probe.ts) and sorts it here; live,
// the Engine also reads the Look Book and the products. The tests are in test/shoot.test.ts.
import { FumeError } from "../contract";
import type { ShootRights, Format, Id, OwnPicture, OwnRead, OwnSort, Shoot, ShootSummary } from "../contract";

/** The place a picture stands in: the expert's move, else the Engine's read. */
export const sortOf = (p: Pick<OwnPicture, "read" | "moved">): OwnSort | undefined => p.moved?.sort ?? p.read?.sort;

/** What a quick look measures in one photograph. */
export interface PictureProbe {
  /** Edge strength where the picture is in focus (the variance of a Laplacian in its sharpest tiles): higher is
   *  sharper. Only compared within one shoot. */
  sharpness: number;
  /** Mean light, 0 (black) to 1 (white). */
  light: number;
  /** How far the tones spread (their standard deviation), 0 (one flat tone) to 0.5. */
  contrast: number;
  /** The share of the picture's middle that is pure white, 0 to 1; 0 for a packshot on a white backdrop. */
  blown: number;
  /** A 64-bit difference fingerprint as 16 hex characters: near copies differ in few bits. */
  hash: string;
}

/** How many of the 64 bits two fingerprints differ in. */
export function hashDistance(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

/** Two pictures this close are near copies: the same frame a moment later, or a little lighter or darker. */
export const NEAR = 6;
/** At most this many picks from one shoot: a shortlist, not a second shoot. */
export const MOST_PICKS = 8;

export const pad = (n: number) => String(n).padStart(2, "0");

/** Sorts a shoot's photographs. Clips are kept for the video editor; a photograph with no probe is kept for later. */
export function readShoot(
  pictures: Pick<OwnPicture, "id" | "number" | "kind">[],
  probes: Map<Id, PictureProbe>,
): Map<Id, OwnRead> {
  const reads = new Map<Id, OwnRead>();
  const photos = pictures.filter((p) => p.kind === "photo" && probes.has(p.id));
  for (const p of pictures) {
    if (p.kind === "clip") reads.set(p.id, { sort: "rest", why: "Kept for the video editor.", sharp: true });
    else if (!probes.has(p.id)) reads.set(p.id, { sort: "rest", why: "Kept for later.", sharp: true });
  }
  if (!photos.length) return reads;

  const probe = (p: { id: Id }) => probes.get(p.id)!;
  const sharpnesses = photos.map((p) => probe(p).sharpness).sort((a, b) => a - b);
  const median = sharpnesses[Math.floor(sharpnesses.length / 2)] || 1;
  /** How good a photograph is beside the rest of its shoot: in focus (half the shoot's usual sharpness is enough, so
   *  a close-up of a label does not win only for its letters), not burnt out, in good light, with depth in its tones. */
  const quality = (p: { id: Id }) => {
    const x = probe(p);
    return (
      Math.min(1, x.sharpness / (median * 0.5)) *
      (1 - Math.min(1, x.blown * 3)) *
      (1 - Math.abs(x.light - 0.45)) *
      Math.min(1, 0.5 + x.contrast * 2.5)
    );
  };

  // First what cannot be used as it is.
  const kept: typeof photos = [];
  for (const p of photos) {
    const x = probe(p);
    const out = (why: string, sharp = true) => reads.set(p.id, { sort: "out", why, sharp });
    if (x.sharpness < median * 0.2) out("Soft: out of focus beside the rest of the shoot.", false);
    else if (x.blown > 0.25) out("Burnt out: the brightest part has no detail left.");
    else if (x.light < 0.1) out("Too dark to use as it is.");
    else if (x.light > 0.93) out("Washed out: too light to use as it is.");
    else kept.push(p);
  }

  // Then near copies: the best of each group stays, the others are left out with the one kept in their place.
  const parent = new Map(kept.map((p) => [p.id, p.id]));
  const root = (id: Id): Id => (parent.get(id) === id ? id : root(parent.get(id)!));
  for (let i = 0; i < kept.length; i += 1)
    for (let j = i + 1; j < kept.length; j += 1)
      if (hashDistance(probe(kept[i]).hash, probe(kept[j]).hash) <= NEAR)
        parent.set(root(kept[j].id), root(kept[i].id));
  const groups = new Map<Id, typeof kept>();
  for (const p of kept) groups.set(root(p.id), [...(groups.get(root(p.id)) ?? []), p]);
  const distinct: typeof kept = [];
  for (const group of groups.values()) {
    const [best, ...others] = [...group].sort((a, b) => quality(b) - quality(a));
    distinct.push(best);
    for (const o of others) {
      const ox = probe(o);
      const bx = probe(best);
      const step = ox.light < bx.light - 0.04 ? "darker" : ox.light > bx.light + 0.04 ? "lighter" : "nearly the same";
      const better =
        bx.sharpness >= ox.sharpness * 1.15
          ? "sharper"
          : Math.abs(bx.light - 0.45) < Math.abs(ox.light - 0.45)
            ? "better lit"
            : "the stronger of the two";
      reads.set(o.id, {
        sort: "out",
        why: `Like ${pad(best.number)}, ${step}; ${pad(best.number)} is ${better}.`,
        like: best.id,
        sharp: ox.sharpness >= median * 0.6,
      });
    }
  }

  // Then the picks: the best third of what is left, at most eight; the others are kept for later.
  const ranked = [...distinct].sort((a, b) => quality(b) - quality(a));
  const picks = Math.min(MOST_PICKS, Math.max(1, Math.round(ranked.length / 3)));
  ranked.forEach((p, i) => {
    const x = probe(p);
    const light = x.light < 0.3 ? "low, dark light" : x.light > 0.7 ? "bright, airy light" : "even light";
    const depth = x.contrast >= 0.2 ? ", deep shadows to clean highlights" : "";
    reads.set(
      p.id,
      i < picks
        ? { sort: "pick", why: `One of the strongest: in focus, ${light}${depth}.`, sharp: true }
        : { sort: "rest", why: `Usable; kept for later. In focus, ${light}.`, sharp: true },
    );
  });
  return reads;
}

/** A shoot as a list shows it. A customer sees the picks only once an expert has checked them. */
export function summarise(shoot: Shoot, forCustomer: boolean): ShootSummary {
  const sorted = shoot.state !== "reading" && !(forCustomer && shoot.state !== "checked");
  const photos = shoot.pictures.filter((p) => p.kind === "photo");
  const count = (s: OwnSort) => (sorted ? photos.filter((p) => sortOf(p) === s).length : 0);
  const picks = sorted ? photos.filter((p) => sortOf(p) === "pick") : [];
  const cover = [...picks, ...photos.filter((p) => !picks.includes(p) && sortOf(p) !== "out")]
    .slice(0, 4)
    .map((p) => p.src);
  const { pictures: _pictures, ...rest } = shoot;
  return {
    ...rest,
    cover,
    counts: {
      photos: photos.length,
      clips: shoot.pictures.length - photos.length,
      picks: count("pick"),
      rest: count("rest"),
      out: count("out"),
      used: shoot.pictures.filter((p) => p.usedIn.length > 0).length,
    },
  };
}

/** The format nearest a picture's own shape, for the words the viewer puts on it. */
export function nearestFormat(width?: number, height?: number): Format {
  if (!width || !height) return "feed";
  const r = width / height;
  return r >= 0.9 ? "square" : r >= 0.66 ? "feed" : "story";
}

/** Every production use, including clips, must pass the shoot's rights first. Reading and checking are not use. */
export function requireShootUse(rights: ShootRights, today = new Date().toISOString().slice(0, 10)): void {
  if (rights.people === "unsure") throw new FumeError("invalid", "Ask who is in the pictures before they are used.");
  if (rights.until && rights.until < today) throw new FumeError("invalid", "The shoot's usage period has ended.");
}
