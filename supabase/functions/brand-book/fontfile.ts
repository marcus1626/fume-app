// A brand's own font file, read for what it is: its family, weight and whether it is italic, from the file's own
// tables (name, OS/2). The design layer sets the brand's face from these; it never guesses them from a file name.

export interface FontFace {
  family: string;
  weight: number;
  italic: boolean;
}

/** Whether the bytes are a TrueType or OpenType file (the renderer reads no web font formats). */
export function isSfnt(b: Uint8Array): boolean {
  if (b.length < 12) return false;
  const tag = String.fromCharCode(b[0], b[1], b[2], b[3]);
  return tag === "OTTO" || tag === "true" || (b[0] === 0 && b[1] === 1 && b[2] === 0 && b[3] === 0);
}

/** The face a font file holds, or null when it is not one the renderer reads. */
export function faceOf(bytes: Uint8Array): FontFace | null {
  if (!isSfnt(bytes)) return null;
  try {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const n = v.getUint16(4);
    const tables = new Map<string, number>();
    for (let i = 0; i < n; i++) {
      const r = 12 + i * 16;
      tables.set(String.fromCharCode(v.getUint8(r), v.getUint8(r + 1), v.getUint8(r + 2), v.getUint8(r + 3)), v.getUint32(r + 8));
    }
    const name = tables.get("name");
    if (name == null) return null;
    const count = v.getUint16(name + 2);
    const strings = name + v.getUint16(name + 4);
    const found = new Map<number, string>();
    for (let i = 0; i < count; i++) {
      const r = name + 6 + i * 12;
      const platform = v.getUint16(r);
      const encoding = v.getUint16(r + 2);
      const id = v.getUint16(r + 6);
      const len = v.getUint16(r + 8);
      const at = strings + v.getUint16(r + 10);
      if (id !== 1 && id !== 16) continue;
      let text = "";
      if (platform === 3 || platform === 0) {
        for (let k = 0; k + 1 < len; k += 2) text += String.fromCharCode(v.getUint16(at + k));
      } else if (platform === 1 && encoding === 0) {
        for (let k = 0; k < len; k++) text += String.fromCharCode(v.getUint8(at + k));
      } else continue;
      // Windows names win over Mac ones.
      if (!found.has(id) || platform === 3) found.set(id, text.trim());
    }
    const family = (found.get(16) || found.get(1) || "").replace(/\s+/g, " ").trim();
    if (!family || family.length > 60) return null;
    const os2 = tables.get("OS/2");
    const weight = os2 != null ? v.getUint16(os2 + 4) : 400;
    const italic = os2 != null ? (v.getUint16(os2 + 62) & 1) === 1 : false;
    return { family, weight: weight >= 100 && weight <= 1000 ? Math.min(900, Math.round(weight / 100) * 100) : 400, italic };
  } catch {
    return null;
  }
}

/** Family names compared as a designer would: case, spaces and hyphens do not count. */
export const sameFamily = (a: string, b: string) => a.toLowerCase().replace(/[\s_-]+/g, "") === b.toLowerCase().replace(/[\s_-]+/g, "");

export interface BookFont extends FontFace {
  bucket: string;
  path: string;
  from: string;
}

type Typeface = { role: string; family: string; fallback: string; source: string; note?: string; [k: string]: unknown };

/**
 * The book's typefaces with the brand's own files set where they name the same family, and a gap for each file no
 * typeface names (the expert sees which file is not used, and why).
 */
export function withFontFiles<T extends { typefaces: Typeface[]; gaps?: string[] }>(body: T, fonts: BookFont[]): T & { fonts: BookFont[] } {
  if (!fonts.length) return { ...body, fonts };
  const used = new Set<string>();
  const typefaces = body.typefaces.map((t) => {
    const file = fonts.find((f) => sameFamily(f.family, t.family) || sameFamily(f.family, t.fallback));
    if (!file) return t;
    used.add(file.family);
    return { ...t, family: file.family, source: "brand", note: `The brand's own font file (${file.from}).` };
  });
  const unused = [...new Set(fonts.map((f) => f.family))].filter((f) => !used.has(f));
  const gaps = [...(body.gaps ?? []), ...unused.map((f) => `The brand's font file ${f} is not one the design system names; tell Fume which type it is for.`)];
  return { ...body, typefaces, fonts, gaps };
}

/** What the writer is told about the brand's files, so it names their families. */
export function fontFilesPage(fonts: BookFont[]): { url: string; text: string } | null {
  const families = [...new Set(fonts.map((f) => f.family))];
  if (!families.length) return null;
  const faces = families.map((fam) => `${fam} (${fonts.filter((f) => f.family === fam).map((f) => `${f.weight}${f.italic ? " italic" : ""}`).join(", ")})`);
  return {
    url: "the brand's own font files",
    text: `The brand gave Fume its own font files: ${faces.join("; ")}. These are the brand's typefaces: name them by exactly these family names, with source "brand", for the roles they are for.`,
  };
}
