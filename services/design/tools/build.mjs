// Bundles Fume's code into one function file in the app's Vercel project (app/api/design.js; Marcus, 4 Nov 2026:
// the service lives in fume-app, not in a project of its own). OpenPencil and CanvasKit stay packages: the app
// installs them, and they read their own files (the wasm, the default fonts) from where they are installed.
import { build } from "esbuild";
await build({
  entryPoints: ["api-src/design.ts"],
  outfile: "../../app/api/design.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  external: ["@open-pencil/*", "canvaskit-wasm"],
  banner: { js: "// Built by tools/build.mjs from api-src/design.ts and src/. Do not edit." },
});
console.log("app/api/design.js");
