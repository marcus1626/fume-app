#!/usr/bin/env node
// Copies the design system from the brand repository (marcus1626/Fume-Brand) into this one. Shared tokens,
// components, icons, fonts, the logo and the rules are changed there first, then synced here. It never deletes: a file
// that exists only here (an app screen's own stylesheet) is kept and listed.
// Usage: node tools/sync-design-system.mjs [path to a Fume-Brand checkout]   (default: ../Fume-Brand)
import { cpSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const brand = resolve(process.argv[2] ?? join(root, "../Fume-Brand"));
if (!existsSync(join(brand, "design-system/tokens/ui.css"))) {
  console.error(`No Fume-Brand checkout at ${brand}. Pass its path: node tools/sync-design-system.mjs <path>`);
  process.exit(1);
}

/** The folders that come from the brand repository, replaced whole on every sync. */
export const SYNCED = [
  "design-system",
  "tokens",
  "assets/fonts",
  "assets/logo",
  "rules",
  "tools/gate",
  "tools/tokens",
  "tools/icons",
];

const files = (dir) =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((name) => {
        const p = join(dir, name);
        return statSync(p).isDirectory() ? files(p) : [p];
      })
    : [];

for (const path of SYNCED) {
  cpSync(join(brand, path), join(root, path), {
    recursive: true,
    // The render audit needs the brand repository's review board, so it stays there.
    filter: (src) => !/\/tools\/gate\/audit[^/]*\.mjs$/.test(src),
  });
  const onlyHere = files(join(root, path)).filter((f) => !existsSync(join(brand, relative(root, f))));
  console.log(`synced ${path}${onlyHere.length ? `; kept ${onlyHere.length} files that Fume-Brand does not have:` : ""}`);
  for (const f of onlyHere) console.log(`  ${relative(root, f)}`);
}
console.log("Now run: npm run check");
