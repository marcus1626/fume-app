// Has a brand's product pictures looked at, a few at a time, until each has its reference card (what it is of, from
// where it is seen, how close: supabase/functions/_shared/engine/references.ts). The Engine then sends the pictures a
// planned picture needs. Through the edge function `taste-read`; a picture costs a small fraction of a cent.
//   FUME_ACCESS_TOKEN=<a Fume designer's session token> deno run -A tools/taste/refcards.ts --workspace <brand id>
//       [--reader jev|gpt-luna|gpt-terra|...] [--rounds <most calls, 10 unless said>]
// A picture already carrying a card is not read again, so the same run can be started again.
const flag = (name: string) => (Deno.args.includes(`--${name}`) ? Deno.args[Deno.args.indexOf(`--${name}`) + 1] : undefined);
const token = Deno.env.get("FUME_ACCESS_TOKEN");
const workspaceId = flag("workspace");
if (!workspaceId || !token) throw new Error("usage: see the top of tools/taste/refcards.ts");
const reader = flag("reader");
const rounds = Number(flag("rounds") ?? 10);

const env = Object.fromEntries(
  (await Deno.readTextFile(new URL("../../app/.env.local", import.meta.url))).split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const endpoint = `${env.VITE_SUPABASE_URL}/functions/v1/taste-read`;

let read = 0, unread = 0, cost = 0;
for (let round = 0; round < rounds; round++) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceId, references: { most: 20 }, ...(reader ? { reader } : {}) }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`not read (${res.status}) ${body.message ?? ""} ${body.detail ?? ""}`);
    Deno.exit(1);
  }
  for (const c of body.cards ?? [])
    console.log(`${c.product}, ${c.slot ?? "no slot"}: ${c.error ? `failed: ${c.error}` : c.card?.unread ? "could not be fetched" : `${c.card.of}, ${c.card.view ?? "side not told"}, ${c.card.crop ?? "crop not told"}`}`);
  read += body.read ?? 0;
  unread += body.unread ?? 0;
  cost += body.usage?.cost_usd ?? 0;
  // Nothing left, or nothing but pictures the reader fails on: stop rather than ask the same ones again.
  if (!body.left || !(body.cards ?? []).some((c: { error?: string }) => !c.error)) {
    console.log(`${read} pictures read, ${unread} could not be fetched, ${body.left ?? 0} left. Reader ${body.reader}; $${cost.toFixed(4)}.`);
    Deno.exit(0);
  }
}
console.log(`${read} pictures read, ${unread} could not be fetched; more are waiting (run again). $${cost.toFixed(4)}.`);
