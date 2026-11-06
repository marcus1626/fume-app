// The validation machine's bench (docs/mvp/product-parts.md): asks the `details` function to check every case in
// parts-bench.json, three at a time, and scores what it flags against what is known to be wrong.
//
//   FUME_ACCESS_TOKEN=<a designer's session token> node tools/bench/parts.mjs [--only <id-prefix>,...]
//   (or FUME_BENCH_EMAIL and FUME_BENCH_PASSWORD for a designer test account)
//
// The project's URL and publishable key come from app/.env.local. Each run costs about 5 cents a case. Behind a proxy,
// run it with NODE_USE_ENV_PROXY=1.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const require = createRequire(join(root, "app", "package.json"));
const { createClient } = require("@supabase/supabase-js");

const env = Object.fromEntries(
  readFileSync(join(root, "app", ".env.local"), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  ...(process.env.FUME_ACCESS_TOKEN ? { global: { headers: { Authorization: `Bearer ${process.env.FUME_ACCESS_TOKEN}` } } } : {}),
});
if (!process.env.FUME_ACCESS_TOKEN) {
  const { error } = await sb.auth.signInWithPassword({ email: process.env.FUME_BENCH_EMAIL, password: process.env.FUME_BENCH_PASSWORD });
  if (error) throw new Error(`Sign in: ${error.message}`);
}

const bench = JSON.parse(readFileSync(join(here, "parts-bench.json"), "utf8"));
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1].split(",") : null;
const cases = bench.cases.filter((c) => !only || only.some((p) => c.id.startsWith(p)));

async function check(c) {
  const before = (await sb.from("candidates").select("details_at").eq("id", c.id).single()).data?.details_at;
  const { error } = await sb.functions.invoke("details", { body: { candidateId: c.id } });
  if (error) return { ...c, error: error.message };
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const row = (await sb.from("candidates").select("details, details_at").eq("id", c.id).single()).data;
    if (row?.details && row.details_at !== before) return { ...c, details: row.details };
  }
  return { ...c, error: "no answer in five minutes" };
}

const results = [];
for (let i = 0; i < cases.length; i += 3) results.push(...(await Promise.all(cases.slice(i, i + 3).map(check))));

let caught = 0, wrongs = 0, alarms = 0, rights = 0;
for (const r of results) {
  const flagged = (r.details ?? []).filter((d) => d.kind === "part" && !d.ok);
  // A case the function did not answer counts against the machine, never for it.
  const hit = !r.error && (r.wrong.length ? flagged.some((d) => r.wrong.includes(d.part)) : flagged.length === 0);
  if (r.wrong.length) (wrongs += 1), (caught += hit ? 1 : 0);
  else (rights += 1), (alarms += hit ? 0 : 1);
  console.log(`${hit ? "ok  " : "MISS"} ${r.what}${r.error ? ` (${r.error})` : ""}`);
  for (const d of flagged) console.log(`       ${d.part}: ${d.note ?? ""}`);
}
console.log(`\nCaught ${caught} of ${wrongs} wrong pictures; ${alarms} of ${rights} right pictures with a part alarm.`);
writeFileSync(join(here, "last-run.json"), JSON.stringify(results, null, 1));
