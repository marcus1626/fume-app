#!/usr/bin/env node
// Copies the design system from the brand repository (marcus1626/Fume-Brand) into this one. The brand repository is
// its only source: change tokens, components, icons, fonts, the logo or the rules there, then run this.
// Usage: node tools/sync-design-system.mjs [path to a Fume-Brand checkout]   (default: ../Fume-Brand)
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const brand = resolve(process.argv[2] ?? join(root, "../Fume-Brand"));
if (!existsSync(join(brand, "design-system/tokens/ui.css"))) {
  console.error(`No Fume-Brand checkout at ${brand}. Pass its path: node tools/sync-design-system.mjs <path>`);
  process.exit(1);
}

/** The folders that come from the brand repository, replaced whole on every sync. */
export const SYNCED = ["design-system", "tokens", "assets/fonts", "assets/logo", "rules", "tools/gate"];

for (const path of SYNCED) {
  rmSync(join(root, path), { recursive: true, force: true });
  cpSync(join(brand, path), join(root, path), {
    recursive: true,
    // The render audit needs the brand repository's review board, so it stays there.
    filter: (src) => !/\/tools\/gate\/audit[^/]*\.mjs$/.test(src),
  });
  console.log(`synced ${path}`);
}
console.log("Now run: npm run check");
