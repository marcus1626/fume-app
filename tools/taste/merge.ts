// Puts what a reader answered (tools/taste/read.ts) onto the measured cards of the same pictures (tools/taste/measure.ts),
// so report.ts counts both halves of the schema.
//   deno run -A tools/taste/merge.ts <measured cards.json> <reads.json> <out cards.json>
const [cardsPath, readsPath, outPath] = Deno.args;
if (!cardsPath || !readsPath || !outPath) throw new Error("usage: merge.ts <measured cards.json> <reads.json> <out cards.json>");
type Card = { id: string; read?: unknown; shows?: unknown; [k: string]: unknown };
const sets = JSON.parse(await Deno.readTextFile(cardsPath)) as Record<string, Card[]>;
const reads = JSON.parse(await Deno.readTextFile(readsPath)) as { id: string; set: string; read: unknown; shows: unknown }[];
let merged = 0;
for (const [name, cards] of Object.entries(sets))
  for (const c of cards) {
    const r = reads.find((x) => x.id === c.id && x.set === name);
    c.read = r?.read ?? {};
    if (r) (c.shows = r.shows), merged++;
  }
await Deno.writeTextFile(outPath, JSON.stringify(sets, null, 1));
console.log(`${merged} of ${Object.values(sets).flat().length} cards have a reading`);
