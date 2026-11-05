import { assertEquals } from "jsr:@std/assert@1";
import { faceOf, fontFilesPage, isSfnt, withFontFiles } from "./fontfile.ts";

/** A smallest TrueType file with a name table (family, typographic family) and an OS/2 table. */
function font(family: string, weight: number, italic: boolean, typographic?: string): Uint8Array {
  const names: [number, string][] = [[1, family], ...(typographic ? [[16, typographic] as [number, string]] : [])];
  const strings = names.map(([, s]) => [...s].flatMap((c) => [0, c.charCodeAt(0)]));
  const nameLen = 6 + names.length * 12 + strings.reduce((n, s) => n + s.length, 0);
  const os2Len = 78;
  const out = new Uint8Array(12 + 2 * 16 + nameLen + os2Len);
  const v = new DataView(out.buffer);
  v.setUint32(0, 0x00010000);
  v.setUint16(4, 2);
  const nameAt = 12 + 32;
  const os2At = nameAt + nameLen;
  const dir = (i: number, tag: string, at: number, len: number) => {
    for (let k = 0; k < 4; k++) v.setUint8(12 + i * 16 + k, tag.charCodeAt(k));
    v.setUint32(12 + i * 16 + 8, at);
    v.setUint32(12 + i * 16 + 12, len);
  };
  dir(0, "name", nameAt, nameLen);
  dir(1, "OS/2", os2At, os2Len);
  v.setUint16(nameAt + 2, names.length);
  v.setUint16(nameAt + 4, 6 + names.length * 12);
  let off = 0;
  names.forEach(([id], i) => {
    const r = nameAt + 6 + i * 12;
    v.setUint16(r, 3);
    v.setUint16(r + 2, 1);
    v.setUint16(r + 6, id);
    v.setUint16(r + 8, strings[i].length);
    v.setUint16(r + 10, off);
    out.set(strings[i], nameAt + 6 + names.length * 12 + off);
    off += strings[i].length;
  });
  v.setUint16(os2At + 4, weight);
  v.setUint16(os2At + 62, italic ? 1 : 0);
  return out;
}

Deno.test("a font file says its own family, weight and italic", () => {
  assertEquals(faceOf(font("Brand Sans", 700, false)), { family: "Brand Sans", weight: 700, italic: false });
  assertEquals(faceOf(font("Brand Sans Condensed Bold", 700, true, "Brand Sans Condensed")), { family: "Brand Sans Condensed", weight: 700, italic: true });
});

Deno.test("a web font or anything else is not read", () => {
  assertEquals(isSfnt(new TextEncoder().encode("wOF2xxxxxxxxxxxx")), false);
  assertEquals(faceOf(new Uint8Array(4)), null);
});

const at = { bucket: "workspace-files", path: "w/brand/font/b-0", from: "Brand-Bold.ttf" };
const body = {
  typefaces: [
    { role: "display", family: "Brand Sans", fallback: "Anton", source: "stand_in" },
    { role: "body", family: "Helvetica Neue", fallback: "Inter", source: "brand" },
  ],
  gaps: [] as string[],
};

Deno.test("the brand's file sets its face where the book names the family; an unnamed file is a gap", () => {
  const out = withFontFiles(body, [
    { ...at, family: "brand-sans", weight: 700, italic: false },
    { ...at, family: "Brand Serif", weight: 400, italic: false },
  ]);
  assertEquals([out.typefaces[0].family, out.typefaces[0].source], ["brand-sans", "brand"]);
  assertEquals(out.typefaces[1], body.typefaces[1]);
  assertEquals(out.gaps.length, 1);
  assertEquals(out.fonts.length, 2);
});

Deno.test("the writer is told the brand's families", () => {
  assertEquals(fontFilesPage([]), null);
  const page = fontFilesPage([{ ...at, family: "Brand Sans", weight: 700, italic: false }, { ...at, family: "Brand Sans", weight: 400, italic: true }]);
  assertEquals(page?.text.includes("Brand Sans (700, 400 italic)"), true);
});
