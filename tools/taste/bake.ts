// The readers' bake-off: which vision model reads the taste schema best. Takes what tools/taste/read.ts wrote for
// each reader (the same pictures read twice, rounds a and b) and the measured cards of the same pictures, and scores
// each reader on what can be checked without a person:
//   steady    the same picture read twice gives the same answer (choice fields)
//   agrees    its answer is the one the other readers agree on, where at least four of them agree
//   measured  where code measures the same thing (warmth, brightness, grain ...), its reading rises with the number
//   filled    fields it answered with something other than "cannot tell"
// and what it cost and how long it took per picture.
//   deno run -A tools/taste/bake.ts <measured cards.json> <dir with read-<reader>-<a|b>.json> [out.json]
import { FIELD, FIELDS } from "../../supabase/functions/_shared/taste/schema.ts";

const [cardsPath, dir, outPath] = Deno.args;
if (!cardsPath || !dir) throw new Error("usage: bake.ts <measured cards.json> <dir> [out.json]");

type Answer = string | string[] | null;
type Read = { id: string; reader: string; seconds: number; read: Record<string, Answer>; failed: unknown[]; usage: { cost_usd: number } };
const rounds: Record<string, Record<string, Read[]>> = {};
for await (const f of Deno.readDir(dir)) {
  const m = /^read-(.+)-([ab])\.json$/.exec(f.name);
  if (!m) continue;
  (rounds[m[1]!] ??= {})[m[2]!] = JSON.parse(await Deno.readTextFile(`${dir}/${f.name}`));
}
const measured = new Map<string, Record<string, number>>();
for (const set of Object.values(JSON.parse(await Deno.readTextFile(cardsPath)) as Record<string, { id: string; measured: Record<string, number> }[]>))
  for (const c of set) measured.set(c.id, c.measured);

// Only pictures every reader read in both rounds are compared.
const readers = Object.keys(rounds).filter((r) => rounds[r]!.a && rounds[r]!.b).sort();
const ids = [...new Set(readers.flatMap((r) => rounds[r]!.a!.map((x) => x.id)))].filter((id) => readers.every((r) => ["a", "b"].every((k) => rounds[r]![k]!.some((x) => x.id === id))));
const of = (reader: string, round: string, id: string) => rounds[reader]![round]!.find((x) => x.id === id)!;
const choice = FIELDS.filter((f) => f.how === "read" && f.type === "choice");
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

/** A read field whose options run from little to much, beside the number code measures of the same thing. */
const PAIRS: [string, string][] = [
  ["colour.temperature", "colour.warmth"],
  ["light.key_level", "light.key"],
  ["light.contrast", "light.contrast_range"],
  ["colour.saturation_feel", "colour.saturation"],
  ["finish.grain_feel", "finish.grain_mids"],
  ["finish.sharpness_feel", "finish.sharpness_overall"],
  ["finish.local_contrast", "finish.local_contrast_measured"],
  ["finish.glow", "finish.halation"],
  ["composition.empty_space", "composition.space"],
  ["composition.density", "composition.busyness"],
  ["colour.colour_count", "colour.hue_entropy"],
];
const ranks = (xs: number[]) => xs.map((x) => (xs.filter((y) => y < x).length + xs.filter((y) => y <= x).length + 1) / 2);
/** Spearman's rank correlation; NaN where either side does not vary. */
function spearman(a: number[], b: number[]): number {
  const ra = ranks(a), rb = ranks(b), ma = mean(ra), mb = mean(rb);
  const cov = mean(ra.map((x, i) => (x - ma) * (rb[i]! - mb)));
  const sd = Math.sqrt(mean(ra.map((x) => (x - ma) ** 2)) * mean(rb.map((x) => (x - mb) ** 2)));
  return sd > 0 ? cov / sd : NaN;
}

const rows = readers.map((reader) => {
  const steady: number[] = [], agrees: number[] = [], filled: number[] = [];
  for (const id of ids) {
    const a = of(reader, "a", id).read, b = of(reader, "b", id).read;
    for (const f of choice) {
      if (!(f.key in a) || !(f.key in b)) continue;
      steady.push(a[f.key] === b[f.key] ? 1 : 0);
      filled.push(a[f.key] === null ? 0 : 1);
      // What the other readers said of this field in their first round, where they were asked it.
      const others = readers.filter((r) => r !== reader).map((r) => of(r, "a", id).read).filter((r) => f.key in r).map((r) => r[f.key] as string | null);
      const counts = new Map<string | null, number>();
      for (const o of others) counts.set(o, (counts.get(o) ?? 0) + 1);
      const [top, n] = [...counts].sort((x, y) => y[1] - x[1])[0] ?? [null, 0];
      if (n >= 4 && top !== null) agrees.push(a[f.key] === top ? 1 : 0);
    }
  }
  const against = PAIRS.map(([readKey, measuredKey]) => {
    const options = FIELD.get(readKey)!.options!;
    const points = ids.flatMap((id) => {
      const v = of(reader, "a", id).read[readKey], m = measured.get(id)?.[measuredKey];
      return typeof v === "string" && typeof m === "number" ? [[options.indexOf(v), m] as [number, number]] : [];
    });
    return points.length >= 4 ? spearman(points.map((p) => p[0]), points.map((p) => p[1])) : NaN;
  }).filter((x) => !Number.isNaN(x));
  const all = ids.flatMap((id) => [of(reader, "a", id), of(reader, "b", id)]);
  return {
    reader,
    steady: mean(steady),
    agrees: mean(agrees),
    agreesOn: agrees.length,
    measured: mean(against),
    measuredPairs: against.length,
    filled: mean(filled),
    failedPasses: all.reduce((n, x) => n + x.failed.length, 0),
    usdPerPicture: mean(all.map((x) => x.usage.cost_usd)),
    secondsPerPicture: mean(all.map((x) => x.seconds)),
  };
});

console.log(`${ids.length} pictures, ${choice.length} choice fields, readers: ${readers.join(", ")}`);
console.log("reader".padEnd(14), "steady", "agrees", "measured", "filled", "failed", "$/picture", "s/picture");
for (const r of rows)
  console.log(r.reader.padEnd(14), r.steady.toFixed(3).padEnd(6), r.agrees.toFixed(3).padEnd(6), r.measured.toFixed(2).padStart(5).padEnd(8), r.filled.toFixed(3).padEnd(6), String(r.failedPasses).padEnd(6), r.usdPerPicture.toFixed(4).padEnd(9), r.secondsPerPicture.toFixed(0));
if (outPath) await Deno.writeTextFile(outPath, JSON.stringify({ pictures: ids, readers: rows }, null, 1));
