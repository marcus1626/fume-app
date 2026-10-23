// A product's specs read against its kind (round 6): how ready it is for the Engine, what is missing, and how each
// value reads in words. Pure functions, no React; the product page, the add flow and the Studio read the same.
import type {
  ColourValue,
  Dimensions,
  FibreBlend,
  FidelityGap,
  MeasureTable,
  PartsValue,
  Product,
  ProductKind,
  SpecEntry,
  SpecField,
  SpecLevel,
  SpecValue,
} from "../../contract";

export const fieldsOf = (kind: ProductKind) => kind.groups.flatMap((g) => g.fields);

export const isDims = (v: SpecValue | undefined): v is Dimensions =>
  typeof v === "object" && v !== null && !Array.isArray(v) && "w" in v;
export const isColour = (v: unknown): v is ColourValue =>
  typeof v === "object" && v !== null && !Array.isArray(v) && "hex" in v;
// Round 7: the rich types.
const isObj = (v: unknown): v is object => typeof v === "object" && v !== null && !Array.isArray(v);
export const isBlend = (v: unknown): v is FibreBlend => isObj(v) && "fibres" in v;
export const isTable = (v: unknown): v is MeasureTable => isObj(v) && "rows" in v && "sizes" in v;
export const isParts = (v: unknown): v is PartsValue => isObj(v) && "parts" in v;

/** The level a field sits on (round 7): short on top, full in the sections, technical beside the files. */
export const levelOf = (f: SpecField): SpecLevel => f.level ?? "full";

/** A blend's total, rounded to a tenth. */
export const blendSum = (b: FibreBlend) =>
  Math.round(b.fibres.reduce((n, r) => n + (Number.isFinite(r.pct) ? r.pct : 0), 0) * 10) / 10;
export const blendOk = (b: FibreBlend) =>
  b.fibres.length > 0 && b.fibres.every((r) => r.fibre.trim() && r.pct > 0) && blendSum(b) === 100;

/** The cells of a table still empty (base size first). */
export function tableGaps(t: MeasureTable): number {
  return t.rows.reduce(
    (n, r) =>
      n +
      t.sizes.filter((_, i) => r.values[i] === null || r.values[i] === undefined || !(Number(r.values[i]) > 0)).length,
    0,
  );
}

export function filled(v: SpecValue | undefined): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return Number.isFinite(v) && v > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (isDims(v)) return v.w > 0 && v.h > 0;
  if (isBlend(v)) return blendOk(v);
  if (isTable(v)) {
    // Filled when the base size has a value on every row.
    const at = Math.max(0, v.sizes.indexOf(v.base ?? v.sizes[0] ?? ""));
    return v.rows.length > 0 && v.rows.every((r) => Number(r.values[at]) > 0);
  }
  if (isParts(v)) return v.parts.length > 0;
  return isColour(v) ? Boolean(v.hex) : true;
}

export interface Fidelity {
  /** 0–1: required fields and shots, an Engine proposal counting half until it is approved. */
  score: number;
  ready: boolean;
  gaps: FidelityGap[];
  /** Engine proposals (fields, parts, shots) that wait for the customer. */
  proposals: number;
  /** Required items (fields + shots) in all, and how many are settled. */
  total: number;
  settled: number;
}

export function fidelity(product: Product, kind: ProductKind | undefined): Fidelity {
  if (!kind) return { score: 0, ready: false, gaps: [], proposals: 0, total: 0, settled: 0 };
  const specs = product.specs ?? [];
  const shots = product.shots ?? [];
  const gaps: FidelityGap[] = [];
  let points = 0;
  let settled = 0;
  let total = 0;
  for (const g of kind.groups)
    for (const f of g.fields) {
      if (!f.required) continue;
      total += 1;
      const s = specs.find((x) => x.fieldId === f.id);
      if (!s || !filled(s.value)) gaps.push({ kind: "field", id: f.id, label: f.label, groupId: g.id });
      else if (s.provenance.state === "proposed") points += 0.5;
      else {
        points += 1;
        settled += 1;
      }
    }
  for (const slot of kind.shots) {
    if (!slot.required) continue;
    total += 1;
    const s = shots.find((x) => x.slotId === slot.id);
    if (!s) gaps.push({ kind: "shot", id: slot.id, label: `${slot.label} photo` });
    else if (s.provenance.state === "proposed") points += 0.5;
    else {
      points += 1;
      settled += 1;
    }
  }
  const proposals =
    specs.filter((s) => s.provenance.state === "proposed").length +
    (product.parts ?? []).filter((p) => p.provenance.state === "proposed").length +
    shots.filter((s) => s.provenance.state === "proposed").length;
  if (proposals)
    gaps.push({
      kind: "proposals",
      id: "proposals",
      label: `${proposals} ${proposals === 1 ? "detail" : "details"} Fume read, to confirm`,
    });
  const score = total ? points / total : 0;
  return { score, ready: gaps.length === 0, gaps, proposals, total, settled };
}

/** What Fume still needs and could not read (fields and photos), not what it read and waits to be confirmed: the
 *  number the add toast and the confirm queue both say (round 13, robot note 05). */
export const missingDetails = (product: Product, kind: ProductKind | undefined) =>
  fidelity(product, kind).gaps.filter((g) => g.kind !== "proposals").length;

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ""));

export function dimsWords(d: Dimensions): string {
  if (d.shape === "round") return `Ø ${num(d.w)} × ${num(d.h)} ${d.unit}`;
  return `${num(d.w)} × ${num(d.h)}${d.d ? ` × ${num(d.d)}` : ""} ${d.unit}`;
}

export function colourWords(c: ColourValue): string {
  return [c.name, c.hex.toUpperCase(), c.pantone && `Pantone ${c.pantone}`].filter(Boolean).join(" · ");
}

/** A value in words, for a row, a tag or a proposal. */
export function valueWords(field: SpecField | undefined, entry: Pick<SpecEntry, "value" | "unit">): string {
  const v = entry.value;
  if (typeof v === "number")
    return `${num(v)}${(entry.unit ?? field?.units?.[0]) ? ` ${entry.unit ?? field?.units?.[0]}` : ""}`;
  if (typeof v === "string") return v.split("\n").join(" · ");
  if (Array.isArray(v))
    return (v as (string | ColourValue)[]).map((x) => (typeof x === "string" ? x : x.name)).join(", ");
  if (isDims(v)) return dimsWords(v);
  if (isColour(v)) return colourWords(v);
  if (isBlend(v)) return blendWords(v);
  if (isTable(v))
    return `${v.rows.length} ${v.rows.length === 1 ? "measure" : "measures"} × ${v.sizes.length} sizes, in ${v.unit}${v.base ? `, base size ${v.base}` : ""}`;
  if (isParts(v)) return v.parts.map((p) => p.name).join(", ");
  return "";
}

/** The colours a value holds, for swatches. */
export function coloursIn(v: SpecValue | undefined): ColourValue[] {
  if (isColour(v)) return [v];
  if (Array.isArray(v)) return (v as unknown[]).filter(isColour);
  return [];
}

/** Lines of "Name #hex Pantone" (a colour list typed by hand) into colours; a line without a hex stays a name. */
export function parseColourLines(text: string): (ColourValue | string)[] {
  return text
    .split(/\n|,(?![^#]*\d{3,}\s*C)/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const hex = /#[0-9a-f]{6}\b/i.exec(line)?.[0];
      if (!hex) return line;
      const pantone = /pantone\s+([\w -]+)$/i.exec(line)?.[1]?.trim();
      const name =
        line
          .replace(hex, "")
          .replace(/pantone\s+[\w -]+$/i, "")
          .replace(/[·,]/g, " ")
          .trim() || hex;
      return { name, hex, ...(pantone ? { pantone } : {}) };
    });
}

export const pct = (score: number) => `${Math.round(score * 100)}%`;

/** "70 % merino wool, 30 % cashmere": fibres by weight, highest first (EU 1007/2011 art. 9). */
export function blendWords(b: FibreBlend): string {
  return [...b.fibres]
    .sort((x, y) => y.pct - x.pct)
    .map((r) => `${num(r.pct)} % ${r.fibre.toLowerCase()}`)
    .join(", ");
}

/** The fields of a group the page shows before "Show all": Engine-critical ones, and any that wait for the customer. */
export function essentials(fields: SpecField[], specs: SpecEntry[]): SpecField[] {
  return fields.filter((f) => f.required || specs.find((s) => s.fieldId === f.id)?.provenance.state === "proposed");
}
