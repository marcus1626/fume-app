// Measures pictures on disk against the taste schema's measured fields and writes their cards as JSON.
//   deno run -A tools/taste/measure.ts <manifest.json> <out.json>
// The manifest: { "sets": [{ "name": "nike", "pictures": [{ "path": "...", "campaign": "why-do-it", "source": "ad" }] }] }
import { measureCard } from "../../supabase/functions/_shared/taste/card.ts";
import { FIELD } from "../../supabase/functions/_shared/taste/schema.ts";
import { decode } from "./decode.ts";

const [manifestPath, outPath] = Deno.args;
const manifest = JSON.parse(await Deno.readTextFile(manifestPath!));
const out: Record<string, unknown[]> = {};
for (const set of manifest.sets) {
  out[set.name] = [];
  for (const p of set.pictures) {
    const started = Date.now();
    const px = decode(await Deno.readFile(p.path));
    const { measured, palette } = measureCard(px);
    const unknown = Object.keys(measured).filter((k) => !FIELD.has(k));
    if (unknown.length) throw new Error(`Not in the schema: ${unknown.join(", ")}`);
    out[set.name]!.push({ id: p.path.split("/").pop(), path: p.path, source: p.source, campaign: p.campaign, measured, palette, read: {} });
    console.error(`${set.name} ${p.path.split("/").pop()} ${px.width}x${px.height} ${Date.now() - started} ms`);
  }
}
await Deno.writeTextFile(outPath!, JSON.stringify(out, null, 1));
