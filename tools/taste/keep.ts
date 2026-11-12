// Keeps cards made on disk (measure.ts, read.ts, merge.ts) as a brand's readings, through the edge function
// `taste-read`: no picture is sent and no model is asked, so it costs nothing. The brand's profile, taste score and
// direction are counted again after each card; the last line says where the brand stands.
//   FUME_ACCESS_TOKEN=<a Fume designer's session token> deno run -A tools/taste/keep.ts <cards.json> --workspace <brand id>
//       --brand <set>[,<set>] [--engine <set>[,<set>]] [--reader <the reader that read them>]
// A card kept before is replaced by its name, so the same run can be sent again.
import type { Card } from "../../supabase/functions/_shared/taste/profile.ts";

const [cardsPath, ...rest] = Deno.args;
const flag = (name: string) => (rest.includes(`--${name}`) ? rest[rest.indexOf(`--${name}`) + 1] : undefined);
const token = Deno.env.get("FUME_ACCESS_TOKEN");
const workspaceId = flag("workspace");
const brandSets = flag("brand")?.split(",") ?? [];
const engineSets = flag("engine")?.split(",") ?? [];
if (!cardsPath || !workspaceId || !token || !brandSets.length) throw new Error("usage: see the top of tools/taste/keep.ts");
const reader = flag("reader");

const env = Object.fromEntries(
  (await Deno.readTextFile(new URL("../../app/.env.local", import.meta.url))).split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const endpoint = `${env.VITE_SUPABASE_URL}/functions/v1/taste-read`;
const sets = JSON.parse(await Deno.readTextFile(cardsPath)) as Record<string, Card[]>;

let last: { score?: number; pictures?: number; enginePictures?: number } = {};
let kept = 0;
for (const [source, names] of [["brand", brandSets], ["engine", engineSets]] as const) {
  for (const name of names) {
    const cards = sets[name];
    if (!cards) throw new Error(`no set "${name}" in ${cardsPath}`);
    for (const c of cards) {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          keep: { source, ref: c.id, title: c.id, ...(c.campaign ? { campaign: c.campaign } : {}), measured: c.measured },
          card: { read: c.read ?? {}, shows: c.shows, ...(reader ? { reader } : {}) },
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.kept) {
        console.error(`${source} ${c.id}: not kept (${res.status}) ${body.message ?? ""} ${body.detail ?? ""}`);
        // Refused for everyone: stop, the next card would be refused too.
        if (res.status === 400 || res.status === 403 || res.status === 502) Deno.exit(1);
        continue;
      }
      kept++;
      last = body;
      console.log(`${source} ${c.id}: kept, ${body.fields} read fields`);
    }
  }
}
console.log(`${kept} cards kept. The brand has ${last.pictures ?? 0} pictures and ${last.enginePictures ?? 0} of the Engine's; taste score ${last.score ?? "?"} of 100.`);
