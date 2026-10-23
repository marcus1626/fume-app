#!/usr/bin/env node
// Fume rule gate: checks CSS and HTML against rules/ui.rules.json (rules with check:"auto"). The checks live in lib.mjs.
// Usage: node tools/gate/gate.mjs [paths...] [--json]
//   With no paths it checks the default scope. Exit code 1 when any error is found.
// Allow one line explicitly with a comment containing  gate-allow:<rule-id>  (state why next to it).
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { root, RULES, DEFAULT_SCOPE, EXEMPT, walk, checkText, checkTokens, takeFindings } from "./lib.mjs";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const targets = args.filter((a) => !a.startsWith("--"));

const files = (targets.length ? targets : DEFAULT_SCOPE).flatMap((t) => walk(join(root, t), []))
  .map((f) => relative(root, f)).filter((f) => !EXEMPT.some((re) => re.test(f)));
for (const f of files) checkText(readFileSync(join(root, f), "utf8"), f);
if (!targets.length) checkTokens();
const findings = takeFindings();

const errors = findings.filter((f) => f.level === "error"), warns = findings.filter((f) => f.level === "warn");
if (asJson) {
  console.log(JSON.stringify({ files: files.length, errors: errors.length, warnings: warns.length, findings }, null, 2));
} else {
  for (const f of findings) console.log(`${f.level.padEnd(5)} ${f.rule.padEnd(26)} ${f.file}:${f.line}  ${f.detail}${f.fix && f.level !== "info" ? `\n      fix: ${f.fix}` : ""}`);
  console.log(`\nFume gate: ${files.length} files, ${errors.length} errors, ${warns.length} warnings, ${Object.values(RULES).filter((r) => r.check === "auto").length} automatic rules, ${Object.values(RULES).filter((r) => r.check === "review").length} review rules.`);
}
process.exit(errors.length ? 1 : 0);
