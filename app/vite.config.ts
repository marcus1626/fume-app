/// <reference types="vitest" />
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import pkg from "./package.json";

const ui = fileURLToPath(new URL("../packages/ui/src", import.meta.url));

// The app reads the design system straight from the repository (design-system/, tokens/, assets/), so it is always
// the decided version. Vite may serve files above app/ for that. packages/ui is compiled from source: its imports
// (React, Radix) resolve from app/node_modules (dedupe), so there is one React and no install in packages/ui.
export default defineConfig({
  // The preview build is served from a folder, so its files are linked relatively.
  base: process.env.VITE_ROUTER === "memory" ? "./" : "/",
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@fume\/ui$/, replacement: `${ui}/index.ts` },
      { find: /^@fume\/ui\/(.*)$/, replacement: `${ui}/$1` },
    ],
    dedupe: ["react", "react-dom", ...Object.keys(pkg.dependencies).filter((d) => d.startsWith("@radix-ui/"))],
  },
  server: { fs: { allow: [".."] } },
  test: { environment: "node", include: ["test/**/*.test.ts"] },
});
