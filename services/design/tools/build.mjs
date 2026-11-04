// Bundles Fume's code into one function file in the app's Vercel project (app/api/design.js; Marcus, 4 Nov 2026:
// the service lives in fume-app, not in a project of its own). OpenPencil and CanvasKit stay packages: the app
// installs them, and they read their own files (the wasm, the default fonts) from where they are installed.
import { build } from "esbuild";
for (const name of ["design", "shot"]) {
  await build({
    entryPoints: [`api-src/${name}.ts`],
    outfile: `../../app/api/${name}.js`,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    external: ["@open-pencil/*", "canvaskit-wasm", "@sparticuz/chromium", "puppeteer-core"],
    banner: { js: `// Built by tools/build.mjs from api-src/${name}.ts and src/. Do not edit.` },
  });
  console.log(`app/api/${name}.js`);
}
