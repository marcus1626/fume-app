// StudioSwatch: one colour from a row of round swatches (FLOWS §9.4). The chosen colours come first, each group under
// whose they are: a campaign's look first ("Black Friday"), then the brand's ("LYSNE"); then the mode's others. The
// colour is data: it reaches the CSS through the --swatch custom property, never a class. Arrow keys move between
// swatches (a radio group).
//   <StudioSwatch label="Background" value="#F4EFE8" options={…} presets={[{ name: "LYSNE packshot white",
//     hex: "#F4EFE8", brand: "LYSNE" }]} onChange={set} />
// Round 16 (PROPOSED 9 Nov 2026): with `custom`, a last swatch opens a colour of her own (a picker and its hex).
// Marcus: "No custom option?" The designer has the last word; the brand's colours still come first, and a colour of
// her own is named as such ("Custom · #A13D2D").
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Button } from "../controls/button";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "../controls/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "../overlays/popover";
import { StudioRow } from "./row";
import { studioId, type StudioControlProps, type StudioOption, type StudioPreset } from "./types";

export interface StudioSwatchProps extends StudioControlProps<string> {
  options: StudioOption[];
  /** The brand's chosen colours of this kind; they lead the row. */
  presets?: StudioPreset[];
  help?: string;
  /** A last swatch that opens a colour of her own. */
  custom?: boolean;
}

const same = (a?: string, b?: string) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());

const HEX = /^#[0-9a-f]{6}$/i;

export function StudioSwatch({
  value,
  onChange,
  label,
  id,
  disabled,
  options,
  presets = [],
  help,
  custom,
}: StudioSwatchProps) {
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
  const listed = [...brand, ...rest];
  // Her own colour: shown as the chosen swatch after the brand's, named by its hex
  const own =
    custom && HEX.test(value) && !listed.some((o) => same(o.value, value) || same(o.hex, value))
      ? { value, label: `Custom · ${value.toUpperCase()}`, hex: value }
      : undefined;
  const all = own ? [...listed, own] : listed;
  const chosen = all.find((o) => same(o.value, value) || same(o.hex, value));

  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key];
    if (!step) return;
    e.preventDefault();
    const i = Math.max(
      0,
      all.findIndex((o) => o === chosen),
    );
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
      <div
        ref={list}
        id={sid}
        role="radiogroup"
        aria-labelledby={`${sid}-l`}
        className="ui-sc-swatches"
        onKeyDown={keys}
      >
        {groups.map((g) => (
          <span key={g.name} className="ui-sc-swatch-group" data-brand="">
            <span className="ui-sc-swatch-brand">{g.name}</span>
            {g.options.map(swatch)}
          </span>
        ))}
        {rest.length > 0 && <span className="ui-sc-swatch-group">{rest.map(swatch)}</span>}
        {custom && (
          <span className="ui-sc-swatch-group" data-custom="">
            {own && swatch(own)}
            <CustomColour value={own?.hex ?? chosen?.hex ?? "#000000"} disabled={disabled} onChange={onChange} />
          </span>
        )}
      </div>
    </StudioRow>
  );
}

/** The last swatch: a colour of her own, from the picker or typed as a hex. */
function CustomColour({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (hex: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value.toUpperCase());
  useEffect(() => {
    if (open) setHex(value.toUpperCase());
  }, [open, value]);
  const ok = HEX.test(hex);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="ui-sc-swatch ui-sc-swatch-add"
          aria-label="A colour of your own"
          title="A colour of your own"
          disabled={disabled}
        >
          <svg className="ico" aria-hidden="true">
            <use href="#fi-plus" />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="ui-sc-custom">
        <form
          className="ui-sc-custom-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!ok) return;
            onChange(hex.toUpperCase());
            setOpen(false);
          }}
        >
          <input
            type="color"
            className="ui-sc-custom-pick"
            aria-label="Pick a colour"
            value={ok ? hex.toLowerCase() : "#000000"}
            onChange={(e) => setHex(e.target.value.toUpperCase())}
          />
          <InputGroup size="sm" className="ui-sc-custom-hex" invalid={!ok}>
            <InputGroupAddon>
              <InputGroupText>Hex</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              aria-label="The colour as a hex code"
              value={hex}
              spellCheck={false}
              onChange={(e) => {
                // One # in front, however it was typed or pasted ("D9B48F", "#D9B48F", "##D9B48F")
                setHex(`#${e.target.value.trim().replace(/#/g, "").toUpperCase()}`);
              }}
            />
          </InputGroup>
          <Button type="submit" size="sm" variant="primary" disabled={!ok}>
            Use it
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
