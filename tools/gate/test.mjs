// Self-test for the gate: bad.css must trip every listed rule, good.css must pass.
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const run = (p) => { try { return JSON.parse(execFileSync("node", ["tools/gate/gate.mjs", p, "--json"], { cwd: root })); } catch (e) { return JSON.parse(e.stdout); } };
const bad = run("tools/gate/fixtures/bad.css"), good = run("tools/gate/fixtures/good.css");
const want = ["tokens-only-color", "radius-from-tokens", "type-from-tokens", "canon-not-in-ui", "ui-tokens-not-primitives", "no-gradient", "no-glow", "glass-only-floating", "glass-no-stroke", "motion-from-tokens", "reduced-motion", "reduced-transparency", "amber-is-a-point", "actions-are-pills", "few-strokes", "hover-needs-hover", "touch-target", "touch-feedback", "air", "space-from-tokens", "state-tokens-in-state"];
const got = new Set(bad.findings.map((f) => f.rule));
const missing = want.filter((r) => !got.has(r));
if (missing.length || good.errors) { console.error("gate self-test FAILED", { missing, goodFindings: good.findings }); process.exit(1); }
console.log(`gate self-test passed: ${want.length} rules caught, clean file clean`);
