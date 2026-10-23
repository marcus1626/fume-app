// The parts of a product's spec (round 6): the fidelity meter, rows that say where each value came from, swatches,
// the dimensions drawing, the packaging parts, the reference-shot slots, and one editor for every field type. The
// product page, the add-product flow and the Studio's read-only summary use these. Looks: product-spec.css.
import {
  Button,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  Icon,
  Input,
  NativeSelect,
  ProposalTag,
  SegmentedControl,
  ToggleGroup,
  ToggleGroupItem,
  SegmentedOption,
  Textarea,
  pickFiles,
  useNarrowScreen,
} from "@fume/ui";
import { useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import type { ColourValue, Dimensions, FibreBlend, FidelityGap, MeasureTable, PartsValue, ProductKind, ProductPart, ReferenceShot, SpecEntry, SpecField, SpecPart, SpecValue } from "../../contract";
import { date } from "../../lib/time";
import { blendOk, blendSum, coloursIn, isBlend, isColour, isDims, isParts, isTable, parseColourLines, valueWords } from "./spec";

// ─── Swatch ─────────────────────────────────────────────────────────────────

export function Swatch({ colour, finish, large, label }: { colour: ColourValue; finish?: string; large?: boolean; label?: string }) {
  return (
    <span
      className={large ? "ui-pswatch ui-pswatch--lg" : "ui-pswatch"}
      data-finish={finish?.toLowerCase()}
      style={{ "--swatch": colour.hex } as CSSProperties}
      role="img"
      aria-label={label ?? colour.name}
    />
  );
}

// ─── Dimensions drawing ─────────────────────────────────────────────────────

/** A quiet silhouette in proportion, with its measures: width under it, height beside it. */
export function DimsDrawing({ dims, label }: { dims: Dimensions; label: string }) {
  const box = 120;
  const ratio = dims.w / dims.h;
  const h = ratio > 1 ? box / ratio : box;
  const w = ratio > 1 ? box : box * ratio;
  const x = 20 + (box - w) / 2;
  const y = 10 + (box - h);
  const round = dims.shape === "round";
  const n = (v: number) => (Number.isInteger(v) ? v : v.toFixed(1));
  return (
    <svg className="ui-dims" viewBox="0 0 190 170" role="img" aria-label={label}>
      <rect className="ui-dims-body" x={x} y={y} width={w} height={h} rx={round ? Math.min(w / 2, 14) : 4} />
      {round && <ellipse className="ui-dims-line" cx={x + w / 2} cy={y} rx={w / 2} ry={Math.min(6, w / 6)} />}
      <path className="ui-dims-line" d={`M${x} ${y + h + 12}H${x + w}M${x} ${y + h + 8}v8M${x + w} ${y + h + 8}v8`} />
      <text className="ui-dims-text" x={x + w / 2} y={y + h + 30} textAnchor="middle">
        {round ? "Ø " : ""}
        {n(dims.w)} {dims.unit}
      </text>
      <path className="ui-dims-line" d={`M${x + w + 12} ${y}V${y + h}M${x + w + 8} ${y}h8M${x + w + 8} ${y + h}h8`} />
      <text className="ui-dims-text" x={x + w + 18} y={y + h / 2 + 4}>
        {n(dims.h)} {dims.unit}
      </text>
    </svg>
  );
}

// ─── What would make it truer (round 8) ─────────────────────────────────────

const gapAction = (g: FidelityGap) => (g.kind === "shot" ? "Add the photo" : "Add it");

/** Round 8 (walk-through 19 Oct, LOAD-16, TASK-14): the old "Ready for the Engine N %" meter is gone; what is
 *  missing is an optional extra, one row per gap with its one action, folded under All details. No percentage. */
export function GapList({ gaps, canEdit, onGap }: { gaps: FidelityGap[]; canEdit: boolean; onGap: (gap: FidelityGap) => void }) {
  const shown = gaps.filter((g) => g.kind !== "proposals");
  if (!shown.length) return null;
  return (
    <ul className="ui-fidelity-gaps" aria-label="What would help">
      {shown.map((g) => (
        <li key={`${g.kind}-${g.id}`}>
          <span className="ui-fidelity-gap">{g.label}</span>
          {canEdit && (
            <Button size="sm" variant="quiet" onClick={() => onGap(g)} aria-label={`${gapAction(g)}: ${g.label.toLowerCase()}`}>
              {gapAction(g)}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

// ─── A value with its source ────────────────────────────────────────────────

export function provenanceTag(entry: { provenance: SpecEntry["provenance"] }, who: (id?: string) => string | undefined) {
  const p = entry.provenance;
  return <ProposalTag origin={p.origin} state={p.state} evidence={p.evidence} by={who(p.by)} when={p.at ? date(p.at) : undefined} />;
}

/** Round 8 (LOAD-9): where a value came from shows only while it waits for the customer ("Fume read this on
 *  lysne.no/hand-balm"); what is hers or confirmed shows the value alone. The history is not repeated on every line. */
export function ReadTag({ provenance }: { provenance?: SpecEntry["provenance"] }) {
  if (provenance?.state !== "proposed") return null;
  return (
    <span className="ui-proposal-tag">
      <Icon name="fume-engine" />
      {provenance.evidence ? `Fume read this on ${provenance.evidence}` : "Fume read this"}
      {provenance.confidence === "low" ? " · not sure" : ""}
    </span>
  );
}

export function ValueView({ field, entry }: { field?: SpecField; entry: Pick<SpecEntry, "value" | "unit"> }) {
  const v = entry.value;
  if (isBlend(v)) return <BlendBar blend={v} />;
  if (isTable(v)) return <MeasureView table={v} label={field?.label ?? "Points of measure"} />;
  if (isParts(v)) return <SpecPartsView parts={v.parts} />;
  const colours = coloursIn(entry.value);
  return (
    <>
      {colours.length > 0 && (
        <span className="ui-pswatch-row">
          {colours.map((c) => (
            <Swatch key={`${c.name}-${c.hex}`} colour={c} />
          ))}
        </span>
      )}
      <span>{valueWords(field, entry)}</span>
    </>
  );
}

export function SpecRow({
  field,
  entry,
  canEdit,
  onEdit,
  extra,
}: {
  field: SpecField;
  entry?: SpecEntry;
  canEdit: boolean;
  /** @deprecated round 8: provenance shows only on proposals (ReadTag); kept so callers need not change. */
  who?: (id?: string) => string | undefined;
  onEdit?: () => void;
  extra?: ReactNode;
}) {
  const rich = isRich(field);
  const foot = entry ? <ReadTag provenance={entry.provenance} /> : null;
  return (
    <div className="ui-pspec-row" data-state={entry?.provenance.state} data-missing={entry ? undefined : ""} data-rich={rich || undefined} id={`spec-${field.id}`}>
      <dt className="ui-pspec-label">{field.label}</dt>
      <dd className="ui-pspec-value">{entry ? <ValueView field={field} entry={entry} /> : field.required ? "Needed" : "Not added"}</dd>
      {(foot || extra) && (
        <dd className="ui-pspec-foot">
          {foot}
          {extra}
        </dd>
      )}
      {canEdit && onEdit && (
        // Round 8 (MOB-8): no Keep on each field; a section keeps all its proposals at once. One quiet way to change.
        <dd className="ui-pspec-actions">
          <Button size="sm" variant="quiet" onClick={onEdit} aria-label={entry ? `Change the ${field.label.toLowerCase()}` : `Add the ${field.label.toLowerCase()}`}>
            {entry ? "Change" : "Add"}
          </Button>
        </dd>
      )}
    </div>
  );
}

// ─── Editing one field ──────────────────────────────────────────────────────

export interface Draft {
  text: string;
  num: string;
  unit: string;
  w: string;
  h: string;
  d: string;
  shape: Dimensions["shape"];
  name: string;
  hex: string;
  pantone: string;
  /** Round 7: the value of a blend, a measurement table or parts, edited by its own editor. */
  rich?: SpecValue;
  /** Round 7: a list with options, picked as chips. */
  picks?: string[];
}

export const isRich = (f: SpecField) => f.type === "blend" || f.type === "measurements" || f.type === "parts";

/** An empty value to start a rich field from. */
function emptyRich(field: SpecField): SpecValue | undefined {
  if (field.type === "blend") return { fibres: [{ fibre: "", pct: 100 }] };
  if (field.type === "parts") return { parts: [{ name: "" }] };
  if (field.type === "measurements") {
    const sizes = field.sizes ?? ["S", "M", "L"];
    return { unit: "cm", sizes, base: sizes[Math.floor(sizes.length / 2)], rows: (field.poms ?? ["Chest width ½", "Length"]).map((pom) => ({ pom, values: sizes.map(() => null), tol: 1 })) };
  }
  return undefined;
}

export function draftOf(field: SpecField, entry?: Pick<SpecEntry, "value" | "unit">): Draft {
  const v = entry?.value;
  const d: Draft = { text: "", num: "", unit: entry?.unit ?? field.units?.[0] ?? "", w: "", h: "", d: "", shape: "round", name: "", hex: "#", pantone: "" };
  if (typeof v === "string") d.text = v;
  else if (typeof v === "number") d.num = String(v);
  else if (Array.isArray(v)) d.text = (v as (string | ColourValue)[]).map((x) => (typeof x === "string" ? x : [x.name, x.hex, x.pantone && `Pantone ${x.pantone}`].filter(Boolean).join(" "))).join("\n");
  else if (isDims(v)) Object.assign(d, { w: String(v.w), h: String(v.h), d: v.d ? String(v.d) : "", unit: v.unit, shape: v.shape });
  else if (isColour(v)) Object.assign(d, { name: v.name, hex: v.hex, pantone: v.pantone ?? "" });
  if (isRich(field)) d.rich = v !== undefined && (isBlend(v) || isTable(v) || isParts(v)) ? structuredClone(v) : emptyRich(field);
  if (field.type === "list" && field.options) d.picks = Array.isArray(v) ? (v as (string | ColourValue)[]).map((x) => (typeof x === "string" ? x : x.name)) : [];
  return d;
}

const toNum = (s: string) => Number(s.replace(",", "."));

/** The value a draft holds, or undefined while it is not complete. */
export function valueOf(field: SpecField, d: Draft): { value: SpecValue; unit?: string } | undefined {
  switch (field.type) {
    case "number":
      return toNum(d.num) > 0 ? { value: toNum(d.num), unit: d.unit || undefined } : undefined;
    case "dimensions": {
      const w = toNum(d.w);
      const h = toNum(d.h);
      if (!(w > 0 && h > 0)) return undefined;
      const dd = toNum(d.d);
      return { value: { w, h, ...(d.shape !== "round" && dd > 0 ? { d: dd } : {}), unit: (d.unit as Dimensions["unit"]) || "mm", shape: d.shape } };
    }
    case "colour":
      return /^#[0-9a-f]{6}$/i.test(d.hex) ? { value: { name: d.name.trim() || d.hex.toUpperCase(), hex: d.hex, ...(d.pantone.trim() ? { pantone: d.pantone.trim() } : {}) } } : undefined;
    case "blend":
      return isBlend(d.rich) && blendOk(d.rich) ? { value: { fibres: [...d.rich.fibres].map((r) => ({ fibre: r.fibre.trim(), pct: r.pct })).sort((a, b) => b.pct - a.pct) } } : undefined;
    case "measurements": {
      if (!isTable(d.rich)) return undefined;
      const rows = d.rich.rows.filter((r) => r.pom.trim());
      return rows.length && rows.some((r) => r.values.some((x) => x !== null && x > 0)) ? { value: { ...d.rich, rows } } : undefined;
    }
    case "parts": {
      if (!isParts(d.rich)) return undefined;
      const list = d.rich.parts.filter((p) => p.name.trim());
      return list.length ? { value: { parts: list } } : undefined;
    }
    case "list": {
      if (field.options && d.picks) return d.picks.length ? { value: d.picks } : undefined;
      const items = parseColourLines(d.text);
      if (!items.length) return undefined;
      return { value: items.every((x) => typeof x !== "string") ? (items as ColourValue[]) : items.map((x) => (typeof x === "string" ? x : x.name)) };
    }
    default:
      return d.text.trim() ? { value: d.text.trim() } : undefined;
  }
}

/** One input for any field type. ids are prefixed so several can sit in one form. */
export function SpecInput({ field, draft, onDraft, idPrefix = "spec", autoFocus }: { field: SpecField; draft: Draft; onDraft: (d: Draft) => void; idPrefix?: string; autoFocus?: boolean }) {
  const id = `${idPrefix}-${field.id}`;
  const set = (patch: Partial<Draft>) => onDraft({ ...draft, ...patch });
  const focus = autoFocus ? { "data-ui-autofocus": true } : {};
  const help = field.help && <FieldDescription id={`${id}-help`}>{field.help}</FieldDescription>;
  const units = field.units && field.units.length > 1 && (
    <NativeSelect aria-label={`${field.label}, unit`} value={draft.unit} onChange={(e) => set({ unit: e.target.value })}>
      {field.units.map((u) => (
        <option key={u} value={u}>
          {u}
        </option>
      ))}
    </NativeSelect>
  );

  if (field.type === "blend" && isBlend(draft.rich))
    return <BlendEditor id={id} field={field} blend={draft.rich} onChange={(b) => set({ rich: b })} />;
  if (field.type === "measurements" && isTable(draft.rich))
    return <MeasureEditor id={id} field={field} table={draft.rich} onChange={(t) => set({ rich: t })} />;
  if (field.type === "parts" && isParts(draft.rich))
    return <PartsEditor id={id} field={field} value={draft.rich} onChange={(v) => set({ rich: v })} />;
  if (field.type === "list" && field.options && draft.picks)
    return (
      <Field>
        <FieldLabel as="span" id={`${id}-label`}>
          {field.label}
        </FieldLabel>
        <ToggleGroup type="multiple" size="sm" loose aria-labelledby={`${id}-label`} value={draft.picks} onValueChange={(v) => set({ picks: v })} className="ui-pspec-chips">
          {[...field.options, ...draft.picks.filter((x) => !field.options!.includes(x))].map((o) => (
            <ToggleGroupItem key={o} value={o}>
              {o}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {help}
      </Field>
    );

  if (field.type === "number")
    return (
      <Field>
        <FieldLabel htmlFor={id}>
          {field.label}
          {field.units?.length === 1 ? ` (${field.units[0]})` : ""}
        </FieldLabel>
        <div className="ui-pspec-inline">
          <Input id={id} inputMode="decimal" value={draft.num} onChange={(e) => set({ num: e.target.value })} aria-describedby={field.help ? `${id}-help` : undefined} {...focus} />
          {units}
        </div>
        {help}
      </Field>
    );

  if (field.type === "dimensions")
    return (
      <FieldGroup>
        <Field>
          <FieldLabel as="span">{field.label}</FieldLabel>
          <SegmentedControl aria-label="Shape" value={draft.shape} onValueChange={(v) => set({ shape: v as Dimensions["shape"] })}>
            <SegmentedOption value="round">Round</SegmentedOption>
            <SegmentedOption value="box">Square-ish</SegmentedOption>
            <SegmentedOption value="flat">Flat</SegmentedOption>
          </SegmentedControl>
          {help}
        </Field>
        <div className="ui-pspec-inline">
          <Field>
            <FieldLabel htmlFor={`${id}-w`}>{draft.shape === "round" ? "Diameter" : "Width"}</FieldLabel>
            <Input id={`${id}-w`} inputMode="decimal" value={draft.w} onChange={(e) => set({ w: e.target.value })} {...focus} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-h`}>Height</FieldLabel>
            <Input id={`${id}-h`} inputMode="decimal" value={draft.h} onChange={(e) => set({ h: e.target.value })} />
          </Field>
          {draft.shape !== "round" && (
            <Field>
              <FieldLabel htmlFor={`${id}-d`}>Depth</FieldLabel>
              <Input id={`${id}-d`} inputMode="decimal" value={draft.d} onChange={(e) => set({ d: e.target.value })} />
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor={`${id}-unit`}>Unit</FieldLabel>
            <NativeSelect id={`${id}-unit`} value={draft.unit} onChange={(e) => set({ unit: e.target.value })}>
              {(field.units ?? ["mm", "cm"]).map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </FieldGroup>
    );

  if (field.type === "colour")
    return (
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-name`}>{field.label}</FieldLabel>
          <Input id={`${id}-name`} value={draft.name} onChange={(e) => set({ name: e.target.value })} {...focus} />
          {help}
        </Field>
        <div className="ui-pspec-inline">
          <Field>
            <FieldLabel htmlFor={`${id}-hex`}>Hex</FieldLabel>
            <div className="ui-pspec-inline">
              {/^#[0-9a-f]{6}$/i.test(draft.hex) && <Swatch colour={{ name: draft.name, hex: draft.hex }} />}
              <Input id={`${id}-hex`} value={draft.hex} onChange={(e) => set({ hex: e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}` })} />
            </div>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-pantone`}>Pantone, if you have it</FieldLabel>
            <Input id={`${id}-pantone`} value={draft.pantone} onChange={(e) => set({ pantone: e.target.value })} />
          </Field>
        </div>
      </FieldGroup>
    );

  if (field.options && (field.type === "choice" || field.type === "material" || field.type === "finish"))
    return (
      <Field>
        <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
        <NativeSelect id={id} value={field.options.includes(draft.text) || !draft.text ? draft.text : "__own"} onChange={(e) => set({ text: e.target.value === "__own" ? " " : e.target.value })} aria-describedby={field.help ? `${id}-help` : undefined} {...focus}>
          <option value="">Choose</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          <option value="__own">Something else</option>
        </NativeSelect>
        {draft.text && !field.options.includes(draft.text) && <Input aria-label={`${field.label}, in your words`} value={draft.text.trimStart()} onChange={(e) => set({ text: e.target.value })} />}
        {help}
      </Field>
    );

  return (
    <Field>
      <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
      <Textarea
        id={id}
        rows={field.type === "list" || field.id.startsWith("label") ? 3 : 2}
        value={draft.text}
        onChange={(e) => set({ text: e.target.value })}
        placeholder={field.placeholder ?? (field.type === "list" ? "One per line" : undefined)}
        aria-describedby={field.help ? `${id}-help` : undefined}
        {...focus}
      />
      {help}
    </Field>
  );
}

/** Change or add one field: the value in the customer's words; it counts as theirs. */
export function SpecDialog({
  field,
  entry,
  productName,
  saving,
  onSave,
  onOpenChange,
}: {
  field: SpecField;
  entry?: SpecEntry;
  productName: string;
  saving: boolean;
  onSave: (v: { value: SpecValue; unit?: string }) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState(() => draftOf(field, entry));
  const value = valueOf(field, draft);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (value) onSave(value);
  }
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size={isRich(field) ? "lg" : undefined}>
        <DialogHeader>
          <DialogTitle>
            {entry ? "Change" : "Add"} the {field.label.toLowerCase()}
          </DialogTitle>
          <DialogDescription>
            {entry?.provenance.state === "proposed"
              ? `Fume read “${valueWords(field, entry)}”. Your words replace it.`
              : `For ${productName}. ${field.detail ? "Every creative keeps it." : "Every creative from the next one on uses it."}`}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="spec-edit" onSubmit={submit}>
            <SpecInput field={field} draft={draft} onDraft={setDraft} autoFocus />
          </form>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="glass-clear">Keep it as it was</Button>
          </DialogClose>
          <Button type="submit" form="spec-edit" variant="glass-white" loading={saving} disabled={!value}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Packaging parts ────────────────────────────────────────────────────────

export const partLine = (p: ProductPart) => [p.material, p.finish && p.finish[0]!.toUpperCase() + p.finish.slice(1), p.opacity, p.colour?.pantone && `Pantone ${p.colour.pantone}`].filter(Boolean).join(" · ");

export function PartsList({ parts, actions }: { parts: ProductPart[]; /** @deprecated round 8: provenance shows only on proposals. */ who?: (id?: string) => string | undefined; actions?: (p: ProductPart) => ReactNode }) {
  return (
    <ul className="ui-pparts">
      {parts.map((p) => (
        <li key={p.id} className="ui-pparts-item" data-state={p.provenance.state}>
          {p.colour ? <Swatch colour={p.colour} finish={p.finish} large label={`${p.name}: ${p.colour.name}`} /> : <span className="ui-pswatch ui-pswatch--lg" aria-hidden="true" />}
          <span className="ui-pparts-text">
            <span className="ui-pparts-name">{p.name}</span>
            <span className="ui-pparts-line">{[p.colour?.name, partLine(p)].filter(Boolean).join(" · ") || "Material and finish not known yet"}</span>
            {p.note && <span className="ui-pparts-line">{p.note}</span>}
          </span>
          {(p.provenance.state === "proposed" || actions?.(p)) && (
            <div className="ui-proposal-foot">
              <ReadTag provenance={p.provenance} />
              {actions?.(p)}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

// ─── Reference shots ────────────────────────────────────────────────────────

export function ShotGrid({
  kind,
  shots,
  who,
  onPick,
  busySlot,
  label,
}: {
  kind: ProductKind;
  shots: Pick<ReferenceShot, "slotId" | "image" | "provenance">[];
  who?: (id?: string) => string | undefined;
  /** Given, an empty slot (and a filled one, to replace it) opens the file picker. */
  onPick?: (slotId: string, file: File) => void;
  busySlot?: string;
  label: string;
}) {
  const ordered = [...kind.shots].sort((a, b) => Number(b.required) - Number(a.required));
  async function pick(slotId: string) {
    const [file] = await pickFiles("image/*", false);
    if (file && onPick) onPick(slotId, file);
  }
  return (
    <ul className="ui-shots" aria-label={label}>
      {ordered.map((slot) => {
        const s = shots.find((x) => x.slotId === slot.id);
        const media = s ? <img src={s.image} alt="" loading="lazy" /> : (
          <span className="ui-shot-empty">
            <Icon name={busySlot === slot.id ? "loader-circle" : "camera"} />
            {slot.required ? "Needed" : "Helps"}
          </span>
        );
        return (
          <li key={slot.id} className="ui-shot" data-empty={s ? undefined : ""} data-required={slot.required ? "" : undefined} id={`shot-${slot.id}`}>
            {onPick ? (
              <button type="button" className="ui-shot-media" onClick={() => void pick(slot.id)} aria-label={`${s ? "Replace" : "Add"} the ${slot.label.toLowerCase()} photo`}>
                {media}
              </button>
            ) : (
              <div className="ui-shot-media">{media}</div>
            )}
            <span className="ui-shot-label">{slot.label}</span>
            {s ? who && <ReadTag provenance={s.provenance} /> : <span className="ui-shot-help">{slot.help}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/** The browser's preview of a picked photo; the mock keeps it as the uploaded image. */
export const previewOf = (file: File) => URL.createObjectURL(file);

// ─── Round 7: fibre blend ───────────────────────────────────────────────────

/** Up to four fibres take the chart's four series in order; a fifth and more fold into Other (the design system never
 *  makes up a fifth colour). */
function blendSlices(b: FibreBlend): { fibre: string; pct: number }[] {
  const sorted = [...b.fibres].filter((r) => r.pct > 0).sort((x, y) => y.pct - x.pct);
  if (sorted.length <= 4) return sorted;
  const rest = sorted.slice(3).reduce((n, r) => n + r.pct, 0);
  return [...sorted.slice(0, 3), { fibre: "Other fibres", pct: rest }];
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ""));

/** The blend as one bar of shares, with its fibres named beside their share. */
export function BlendBar({ blend, compact }: { blend: FibreBlend; compact?: boolean }) {
  const slices = blendSlices(blend);
  const sum = blendSum(blend);
  const label = slices.map((r) => `${fmt(r.pct)} % ${r.fibre}`).join(", ");
  return (
    <span className="ui-blend" data-compact={compact || undefined}>
      <span className="ui-blend-bar" role="img" aria-label={label}>
        {slices.map((r, i) => (
          <span key={r.fibre} className="ui-blend-seg" data-series={i + 1} style={{ "--share": `${Math.min(100, (r.pct / Math.max(sum, 100)) * 100)}%` } as CSSProperties} />
        ))}
      </span>
      <span className="ui-blend-legend">
        {slices.map((r, i) => (
          <span key={r.fibre} className="ui-blend-key">
            <span className="ui-blend-dot" data-series={i + 1} aria-hidden="true" />
            <span className="ui-blend-pct">{fmt(r.pct)} %</span> {r.fibre}
          </span>
        ))}
      </span>
    </span>
  );
}

export function BlendEditor({ id, field, blend, onChange }: { id: string; field: SpecField; blend: FibreBlend; onChange: (b: FibreBlend) => void }) {
  const sum = blendSum(blend);
  const options = field.options ?? FIBRES;
  const setRow = (i: number, patch: Partial<FibreBlend["fibres"][number]>) => onChange({ fibres: blend.fibres.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const left = Math.round((100 - sum) * 10) / 10;
  return (
    <FieldGroup>
      <Field>
        <FieldLabel as="span" id={`${id}-label`}>
          {field.label}
        </FieldLabel>
        {field.help && <FieldDescription>{field.help}</FieldDescription>}
      </Field>
      {sum > 0 && <BlendBar blend={blend} />}
      <ul className="ui-blend-rows" aria-labelledby={`${id}-label`}>
        {blend.fibres.map((r, i) => (
          <li key={i} className="ui-blend-row">
            <NativeSelect aria-label={`Fibre ${i + 1}`} value={r.fibre} onChange={(e) => setRow(i, { fibre: e.target.value })} data-ui-autofocus={i === 0 || undefined}>
              <option value="">Choose a fibre</option>
              {[...options, ...(r.fibre && !options.includes(r.fibre) ? [r.fibre] : [])].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </NativeSelect>
            <div className="ui-blend-pct-input">
              <Input aria-label={`${r.fibre || `Fibre ${i + 1}`}, per cent`} inputMode="decimal" value={Number.isFinite(r.pct) && r.pct ? String(r.pct) : ""} onChange={(e) => setRow(i, { pct: Number(e.target.value.replace(",", ".")) || 0 })} />
              <span aria-hidden="true">%</span>
            </div>
            {blend.fibres.length > 1 && <Button size="sm" variant="quiet" iconOnly icon="x" aria-label={`Remove ${r.fibre || `fibre ${i + 1}`}`} onClick={() => onChange({ fibres: blend.fibres.filter((_, j) => j !== i) })} />}
          </li>
        ))}
      </ul>
      <div className="ui-blend-foot">
        <span className="ui-pspec-need" role="status" data-ok={sum === 100 || undefined}>
          {sum === 100 ? "Adds up to 100 %" : left > 0 ? `Adds up to ${fmt(sum)} %: ${fmt(left)} % to place` : `Adds up to ${fmt(sum)} %: ${fmt(-left)} % too much`}
        </span>
        <Button size="sm" variant="quiet" icon="plus" onClick={() => onChange({ fibres: [...blend.fibres, { fibre: "", pct: left > 0 ? left : 0 }] })}>
          Add a fibre
        </Button>
      </div>
    </FieldGroup>
  );
}

/** Fibres a blend picks from when its field names none (research §8). */
const FIBRES = ["Merino wool", "Cashmere", "Alpaca", "Mohair", "Lambswool", "Wool", "Silk", "Cotton", "Organic cotton", "Linen", "Viscose", "Lyocell", "Polyamide", "Elastane", "Recycled polyester", "Polyester"];

// ─── Round 7: measurement table ─────────────────────────────────────────────

/** Points of measure × sizes. It scrolls sideways inside its own box, never the page. */
function MeasureTableView({ table, label }: { table: MeasureTable; label: string }) {
  const base = table.base ?? table.sizes[0];
  return (
    <div className="ui-measure" role="region" aria-label={`${label}, scrolls sideways`} tabIndex={0}>
      <table className="ui-measure-table">
        <caption className="ui-measure-caption">
          In {table.unit}
          {base ? ` · base size ${base}` : ""} · ± is the tolerance
        </caption>
        <thead>
          <tr>
            <th scope="col" className="ui-measure-pom">
              Point of measure
            </th>
            {table.sizes.map((sz) => (
              <th key={sz} scope="col" data-base={sz === base || undefined}>
                {sz}
              </th>
            ))}
            <th scope="col">±</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r) => (
            <tr key={`${r.code ?? ""}${r.pom}`}>
              <th scope="row" className="ui-measure-pom">
                <span className="ui-measure-name">
                  {r.code && <span className="ui-measure-code">{r.code}</span>}
                  {r.pom}
                </span>
                {r.how && <span className="ui-measure-how">{r.how}</span>}
              </th>
              {table.sizes.map((sz, i) => (
                <td key={sz} data-base={sz === base || undefined}>
                  {r.values[i] === null || r.values[i] === undefined ? "–" : fmt(r.values[i] as number)}
                </td>
              ))}
              <td className="ui-measure-tol">{r.tol ? fmt(r.tol) : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The size table. On a desk the whole table; on a phone (LOAD-20) the base size only, one measure per line, and
 *  "See all sizes" opens the whole table in a sheet that scrolls sideways. */
export function MeasureView({ table, label }: { table: MeasureTable; label: string }) {
  const narrow = useNarrowScreen();
  const [all, setAll] = useState(false);
  if (!narrow) return <MeasureTableView table={table} label={label} />;
  const base = table.base ?? table.sizes[0];
  const at = Math.max(0, table.sizes.indexOf(base ?? ""));
  return (
    <div className="ui-measure-base">
      <dl className="ui-measure-list" aria-label={`${label}, size ${base}`}>
        {table.rows.map((r) => {
          const v = r.values[at];
          return (
            <div key={`${r.code ?? ""}${r.pom}`} className="ui-measure-list-row">
              <dt>{r.pom}</dt>
              <dd>{v === null || v === undefined ? "–" : `${fmt(v)} ${table.unit}`}</dd>
            </div>
          );
        })}
      </dl>
      <div className="ui-measure-base-foot">
        <span className="ui-pspec-need">Size {base}</span>
        {table.sizes.length > 1 && (
          <Button size="sm" variant="quiet" onClick={() => setAll(true)}>
            See all {table.sizes.length} sizes
          </Button>
        )}
      </div>
      {all && (
        <Drawer open onOpenChange={setAll}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{label}</DrawerTitle>
              <DrawerDescription>Every size, in {table.unit}. Slide sideways for the rest.</DrawerDescription>
            </DrawerHeader>
            <DrawerBody>
              <MeasureTableView table={table} label={label} />
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="glass-clear">Close</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}

export function MeasureEditor({ id, field, table, onChange }: { id: string; field: SpecField; table: MeasureTable; onChange: (t: MeasureTable) => void }) {
  const setRow = (i: number, patch: Partial<MeasureTable["rows"][number]>) => onChange({ ...table, rows: table.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const cell = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")) || null);
  return (
    <FieldGroup>
      <Field>
        <FieldLabel as="span" id={`${id}-label`}>
          {field.label}
        </FieldLabel>
        {field.help && <FieldDescription>{field.help}</FieldDescription>}
      </Field>
      <div className="ui-pspec-inline">
        <Field>
          <FieldLabel htmlFor={`${id}-unit`}>Unit</FieldLabel>
          <NativeSelect id={`${id}-unit`} value={table.unit} onChange={(e) => onChange({ ...table, unit: e.target.value as MeasureTable["unit"] })}>
            <option value="cm">cm</option>
            <option value="mm">mm</option>
            <option value="in">in</option>
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-base`}>Base size</FieldLabel>
          <NativeSelect id={`${id}-base`} value={table.base ?? ""} onChange={(e) => onChange({ ...table, base: e.target.value })}>
            {table.sizes.map((sz) => (
              <option key={sz} value={sz}>
                {sz}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <div className="ui-measure ui-measure--edit" role="region" aria-labelledby={`${id}-label`} tabIndex={0}>
        <table className="ui-measure-table">
          <thead>
            <tr>
              <th scope="col" className="ui-measure-pom">
                Point of measure
              </th>
              {table.sizes.map((sz) => (
                <th key={sz} scope="col" data-base={sz === table.base || undefined}>
                  {sz}
                </th>
              ))}
              <th scope="col">±</th>
              <th scope="col">
                <span className="ui-sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => (
              <tr key={`${i}-${table.rows.length}`}>
                <th scope="row" className="ui-measure-pom">
                  <Input aria-label={`Point of measure ${i + 1}`} value={r.pom} onChange={(e) => setRow(i, { pom: e.target.value })} />
                </th>
                {table.sizes.map((sz, k) => (
                  <td key={sz} data-base={sz === table.base || undefined}>
                    <Input
                      aria-label={`${r.pom || `Measure ${i + 1}`}, size ${sz}`}
                      inputMode="decimal"
                      defaultValue={r.values[k] ?? ""}
                      onChange={(e) => setRow(i, { values: r.values.map((x, j) => (j === k ? cell(e.target.value) : x)) })}
                    />
                  </td>
                ))}
                <td>
                  <Input aria-label={`${r.pom || `Measure ${i + 1}`}, tolerance`} inputMode="decimal" defaultValue={r.tol ?? ""} onChange={(e) => setRow(i, { tol: cell(e.target.value) ?? undefined })} />
                </td>
                <td>
                  <Button size="sm" variant="quiet" iconOnly icon="x" aria-label={`Remove ${r.pom || `measure ${i + 1}`}`} onClick={() => onChange({ ...table, rows: table.rows.filter((_, j) => j !== i) })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <Button size="sm" variant="quiet" icon="plus" onClick={() => onChange({ ...table, rows: [...table.rows, { pom: "", values: table.sizes.map(() => null), tol: 1 }] })}>
          Add a point of measure
        </Button>
      </div>
    </FieldGroup>
  );
}

// ─── Round 7: parts as data ─────────────────────────────────────────────────

const partWords = (p: SpecPart) => [p.material, p.finish, p.colour?.name, p.decoration, p.size].filter(Boolean).join(" · ");

/** Each part with its swatch, material, finish, colour, decoration and size. */
export function SpecPartsView({ parts }: { parts: SpecPart[] }) {
  return (
    <ul className="ui-pparts ui-pparts--flat">
      {parts.map((p, i) => (
        <li key={`${p.name}-${i}`} className="ui-pparts-item">
          {p.colour ? <Swatch colour={p.colour} finish={p.finish} large label={`${p.name}: ${p.colour.name}`} /> : <span className="ui-pswatch ui-pswatch--lg" aria-hidden="true" />}
          <span className="ui-pparts-text">
            <span className="ui-pparts-name">{p.name}</span>
            <span className="ui-pparts-line">{partWords(p) || "Material and finish not known yet"}</span>
            {p.note && <span className="ui-pparts-line">{p.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

const PART_FINISHES = ["Matte", "Satin", "Gloss", "Frosted", "Metallic", "Brushed", "Soft-touch", "Textured", "Polished"];

export function PartsEditor({ id, field, value, onChange }: { id: string; field: SpecField; value: PartsValue; onChange: (v: PartsValue) => void }) {
  const setPart = (i: number, patch: Partial<SpecPart>) => onChange({ parts: value.parts.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  return (
    <FieldGroup>
      <Field>
        <FieldLabel as="span" id={`${id}-label`}>
          {field.label}
        </FieldLabel>
        {field.help && <FieldDescription>{field.help}</FieldDescription>}
      </Field>
      <ul className="ui-part-edit-list" aria-labelledby={`${id}-label`}>
        {value.parts.map((p, i) => {
          const pid = `${id}-${i}`;
          const hex = p.colour?.hex ?? "#";
          return (
            <li key={i} className="ui-part-edit">
              <div className="ui-part-edit-head">
                <Field>
                  <FieldLabel htmlFor={`${pid}-name`}>Part</FieldLabel>
                  <Input id={`${pid}-name`} value={p.name} onChange={(e) => setPart(i, { name: e.target.value })} placeholder="Main label" data-ui-autofocus={i === 0 || undefined} />
                </Field>
                {value.parts.length > 1 && <Button size="sm" variant="quiet" iconOnly icon="x" aria-label={`Remove ${p.name || `part ${i + 1}`}`} onClick={() => onChange({ parts: value.parts.filter((_, j) => j !== i) })} />}
              </div>
              <div className="ui-pspec-inline">
                <Field>
                  <FieldLabel htmlFor={`${pid}-material`}>Material</FieldLabel>
                  <Input id={`${pid}-material`} value={p.material ?? ""} onChange={(e) => setPart(i, { material: e.target.value || undefined })} />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${pid}-finish`}>Finish</FieldLabel>
                  <NativeSelect id={`${pid}-finish`} value={p.finish ?? ""} onChange={(e) => setPart(i, { finish: e.target.value || undefined })}>
                    <option value="">Choose</option>
                    {[...PART_FINISHES, ...(p.finish && !PART_FINISHES.includes(p.finish) ? [p.finish] : [])].map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
              <div className="ui-pspec-inline">
                <Field>
                  <FieldLabel htmlFor={`${pid}-colour`}>Colour</FieldLabel>
                  <Input id={`${pid}-colour`} value={p.colour?.name ?? ""} onChange={(e) => setPart(i, { colour: e.target.value || p.colour?.hex ? { name: e.target.value, hex } : undefined })} />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${pid}-hex`}>Hex</FieldLabel>
                  <div className="ui-pspec-inline">
                    {/^#[0-9a-f]{6}$/i.test(hex) && <Swatch colour={{ name: p.colour?.name ?? "", hex }} />}
                    <Input id={`${pid}-hex`} value={hex} onChange={(e) => setPart(i, { colour: { name: p.colour?.name ?? "", hex: e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}` } })} />
                  </div>
                </Field>
              </div>
              <div className="ui-pspec-inline">
                <Field>
                  <FieldLabel htmlFor={`${pid}-deco`}>Decoration</FieldLabel>
                  <Input id={`${pid}-deco`} value={p.decoration ?? ""} onChange={(e) => setPart(i, { decoration: e.target.value || undefined })} placeholder="Woven, hot-foil, emboss" />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${pid}-size`}>Size</FieldLabel>
                  <Input id={`${pid}-size`} value={p.size ?? ""} onChange={(e) => setPart(i, { size: e.target.value || undefined })} placeholder="40 × 15 mm" />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor={`${pid}-note`}>Where it sits</FieldLabel>
                <Input id={`${pid}-note`} value={p.note ?? ""} onChange={(e) => setPart(i, { note: e.target.value || undefined })} />
              </Field>
            </li>
          );
        })}
      </ul>
      <div>
        <Button size="sm" variant="quiet" icon="plus" onClick={() => onChange({ parts: [...value.parts, { name: "" }] })}>
          Add a part
        </Button>
      </div>
    </FieldGroup>
  );
}
