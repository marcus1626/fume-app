// Fonts for the tests, from Fontsource packages (the service itself takes the brand's files or Google Fonts).
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { start } from "../src/render.ts";

const dir = new URL("../node_modules/@fontsource/", import.meta.url).pathname;
export function startWithTestFonts() {
  return start({
    online: false,
    fonts: async (family, weight, italic) => {
      const slug = family.toLowerCase().replace(/\s+/g, "-");
      for (const ext of ["woff", "woff2"]) {
        const f = `${dir}${slug}/files/${slug}-latin-${weight}-${italic ? "italic" : "normal"}.${ext}`;
        if (existsSync(f)) {
          const b = await readFile(f);
          return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
        }
      }
      return null;
    },
  });
}
