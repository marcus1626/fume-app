// Has a vision model read pictures on disk against the taste schema's read fields, through the edge function
// `taste-read`, and writes what it answered beside the picture's id. Each picture costs money (about a cent with the
// cheap reader, twenty to forty with the large ones), so the run prints what it spent.
//   FUME_ACCESS_TOKEN=<a Fume designer's session token> deno run -A tools/taste/read.ts <manifest.json> <out.json>
//       --workspace <brand id> [--reader haiku|sonnet|opus] [--effort low|medium|high] [--sets a,b] [--only <id part>,...]
//       [--passes idea,...]
// The manifest is the one measure.ts takes. A picture already in <out.json> is not read again. With --passes only
// those passes are asked: `idea` alone says what a picture shows and what kind it is, which is enough to sort a large
// set before the pictures worth reading are read in full.
import jpeg from "npm:jpeg-js@0.4.4";
import { shrink } from "../../supabase/functions/taste-learn/measure.ts";
import { decode } from "./decode.ts";

const [manifestPath, outPath, ...rest] = Deno.args;
const flag = (name: string) => (rest.includes(`--${name}`) ? rest[rest.indexOf(`--${name}`) + 1] : undefined);
const token = Deno.env.get("FUME_ACCESS_TOKEN");
const workspaceId = flag("workspace");
if (!manifestPath || !outPath || !workspaceId || !token) throw new Error("usage: see the top of tools/taste/read.ts");
const reader = flag("reader") ?? "haiku";
const effort = flag("effort") ?? "low";
const sets = flag("sets")?.split(",");
const only = flag("only")?.split(",");
const passes = flag("passes")?.split(",");

const env = Object.fromEntries(
  (await Deno.readTextFile(new URL("../../app/.env.local", import.meta.url))).split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const endpoint = `${env.VITE_SUPABASE_URL}/functions/v1/taste-read`;

/** The picture as the model gets it: at most 1568 px on its long side, as a JPEG. */
function forReading(bytes: Uint8Array): string {
  const px = shrink(decode(bytes), 1568);
  const out = jpeg.encode({ width: px.width, height: px.height, data: px.data }, 88).data;
  let s = "";
  for (let i = 0; i < out.length; i += 0x8000) s += String.fromCharCode(...out.subarray(i, i + 0x8000));
  return btoa(s);
}

type Read = { id: string; set: string; path: string; campaign?: string; source?: string; reader: string; effort: string; seconds: number; [k: string]: unknown };
const manifest = JSON.parse(await Deno.readTextFile(manifestPath));
let done: Read[] = [];
try {
  done = JSON.parse(await Deno.readTextFile(outPath));
} catch { /* a new run */ }
let spent = 0;
for (const set of manifest.sets) {
  if (sets && !sets.includes(set.name)) continue;
  for (const p of set.pictures) {
    const id = p.path.split("/").pop() as string;
    if (only && !only.some((o) => id.includes(o))) continue;
    if (done.some((d) => d.id === id && d.set === set.name)) continue;
    const picture = { base64: forReading(await Deno.readFile(p.path)), mediaType: "image/jpeg" };
    type Answered = { message?: string; detail?: string; shows?: unknown; read?: unknown; fields?: number; answered?: number; failed?: unknown[]; usage?: { cost_usd: number } };
    let res: Response, body: Answered, seconds = 0;
    // A picture whose questions did not all come back (the provider was busy) is asked again, up to three times.
    for (let attempt = 1; ; attempt++) {
      const started = Date.now();
      res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, reader, effort, picture, ...(passes ? { passes } : {}) }),
      });
      body = await res.json().catch(() => ({}));
      seconds = Math.round((Date.now() - started) / 1000);
      spent += body.usage?.cost_usd ?? 0;
      const whole = res.ok && !body.failed?.length;
      if (whole || attempt === 3 || res.status === 400 || res.status === 403 || res.status === 429) break;
      await new Promise((r) => setTimeout(r, 8000 * attempt));
    }
    if (!res.ok) {
      console.error(`${set.name} ${id}: ${res.status} ${body.message ?? ""} ${body.detail ?? ""}`);
      if (res.status === 403 || res.status === 429) Deno.exit(1);
      continue;
    }
    done.push({ id, set: set.name, path: p.path, campaign: p.campaign, source: p.source, reader, effort, seconds, shows: body.shows, read: body.read, failed: body.failed, usage: body.usage });
    await Deno.writeTextFile(outPath, JSON.stringify(done, null, 1));
    console.error(`${set.name} ${id}: ${body.answered} of ${body.fields} fields, ${body.failed?.length ?? 0} passes failed, ${seconds} s, $${body.usage?.cost_usd ?? 0}`);
  }
}
console.error(`spent $${spent.toFixed(3)}`);
