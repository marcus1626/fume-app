// StudioSwatch: one colour from a row of round swatches (FLOWS §9.4). The chosen colours come first, each group under
// whose they are: a campaign's look first ("Black Friday", v5), then the brand's ("LYSNE"); then the mode's others. The colour is data: it reaches the CSS through the
// --swatch custom property, never a class. Arrow keys move between swatches (a radio group).
//   <StudioSwatch label="Background" value="#F4EFE8" options={…} presets={[{ name: "LYSNE packshot white",
//     hex: "#F4EFE8", brand: "LYSNE" }]} onChange={set} />
import { useRef, type CSSProperties, type KeyboardEvent } from "react";
import { StudioRow } from "./row";
import { studioId, type StudioControlProps, type StudioOption, type StudioPreset } from "./types";

export interface StudioSwatchProps extends StudioControlProps<string> {
  options: StudioOption[];
  /** The brand's chosen colours of this kind; they lead the row. */
  presets?: StudioPreset[];
  help?: string;
}

const same = (a?: string, b?: string) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());

export function StudioSwatch({ value, onChange, label, id, disabled, options, presets = [], help }: StudioSwatchProps) {
  const sid = studioId(label, id);
  const list = useRef<HTMLDivElement>(null);
  // One group per owner (a campaign, the brand), in the order given; a colour shows once, in its first group.
  const groups: { name: string; options: StudioOption[] }[] = [];
  const brand: StudioOption[] = [];
  for (const p of presets) {
    if (!p.hex || brand.some((b) => same(b.hex, p.hex))) continue;
    const o: StudioOption = { value: p.hex, label: p.name, hex: p.hex };
    brand.push(o);
    const g = groups.find((x) => x.name === p.brand) ?? (groups.push({ name: p.brand, options: [] }), groups.at(-1)!);
    g.options.push(o);
  }
  const rest = options.filter((o) => !brand.some((b) => same(b.hex, o.hex ?? o.value)));
  const all = [...brand, ...rest];
  const chosen = all.find((o) => same(o.value, value) || same(o.hex, value));

  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key];
    if (!step) return;
    e.preventDefault();
    const i = Math.max(0, all.findIndex((o) => o === chosen));
    const next = all[(i + step + all.length) % all.length]!;
    onChange(next.value);
    requestAnimationFrame(() => list.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
  };

  const swatch = (o: StudioOption) => {
    const on = o === chosen;
    return (
      <button
        key={`${o.value}-${o.label}`}
        type="button"
        role="radio"
        aria-checked={on}
        aria-label={o.label}
        title={o.label}
        tabIndex={on || (!chosen && o === all[0]) ? 0 : -1}
        disabled={disabled}
        className="ui-sc-swatch"
        style={{ "--swatch": o.hex ?? o.value } as CSSProperties}
        onClick={() => onChange(o.value)}
      />
    );
  };

  return (
    <StudioRow label={label} labelId={`${sid}-l`} readout={chosen?.label} help={help} disabled={disabled}>
      <div ref={list} id={sid} role="radiogroup" aria-labelledby={`${sid}-l`} className="ui-sc-swatches" onKeyDown={keys}>
        {groups.map((g) => (
          <span key={g.name} className="ui-sc-swatch-group" data-brand="">
            <span className="ui-sc-swatch-brand">{g.name}</span>
            {g.options.map(swatch)}
          </span>
        ))}
        {rest.length > 0 && <span className="ui-sc-swatch-group">{rest.map(swatch)}</span>}
      </div>
    </StudioRow>
  );
}
