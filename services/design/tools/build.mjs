// Bundles Fume's code into one function file; OpenPencil and CanvasKit stay packages Vercel installs.
import { build } from "esbuild";
await build({
  entryPoints: ["api-src/design.ts"],
  outfile: "api/design.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  external: ["@open-pencil/*", "canvaskit-wasm"],
  banner: { js: "// Built by tools/build.mjs from api-src/design.ts and src/. Do not edit." },
});
console.log("api/design.js");
