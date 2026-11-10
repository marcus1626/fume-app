// The Studio's typed controls: StudioText (words: a direction, "what to make") and StudioNumber (a count, with a
// minus and a plus pill either side). Both sit in a StudioRow; the field is the design system's small field.
//   <StudioText label="What to make" value={object} onChange={set} />
//   <StudioNumber label="Count" value={4} min={1} max={8} onChange={set} />
// Round 16 (PROPOSED 9 Nov 2026): a number may have presets, as Figma's font size has (Marcus: "Size should have
// presets, the natural steps of graphic design"). Then the field holds a handle to drag the value (up or right for
// more), the number, and a list of the presets by its end; minus and plus step to the preset before and after.
//   <StudioNumber label="Size" unit="px" value={64} presets={[{ label: "LYSNE's sizes", items: [{ value: 76,
//     meta: "Heading 1" }] }, { label: "Type scale", items: [{ value: 48 }, { value: 60 }] }]} onChange={set} />
import { useEffect, useState } from "react";
import { Button } from "../controls/button";
import { Input, Textarea } from "../controls/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "../controls/input-group";
import { Icon } from "../icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../overlays/dropdown-menu";
import { StudioRow } from "./row";
import { ScrubHandle } from "./scrub";
import { studioId, type StudioControlProps } from "./types";

export interface StudioTextProps extends StudioControlProps<string> {
  placeholder?: string;
  /** Two lines by default; one for a short name. */
  rows?: 1 | 2 | 3;
  help?: string;
}

export function StudioText({ value, onChange, label, id, disabled, placeholder, rows = 2, help }: StudioTextProps) {
  const sid = studioId(label, id);
  return (
    <StudioRow label={label} htmlFor={sid} help={help} disabled={disabled}>
      {rows === 1 ? (
        <Input
          id={sid}
          size="sm"
          className="ui-sc-field"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Textarea
          id={sid}
          rows={rows}
          className="ui-sc-field ui-sc-textarea"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </StudioRow>
  );
}

export interface StudioNumberPresetGroup {
  /** Whose the sizes are: "LYSNE's sizes", "Type scale". */
  label: string;
  items: { value: number; /** What it is for: "Heading 1". */ meta?: string }[];
}

export interface StudioNumberProps extends StudioControlProps<number> {
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  help?: string;
  /** Presets in groups: a list at the field's end, and minus and plus step between them. */
  presets?: StudioNumberPresetGroup[];
}

export function StudioNumber({
  value,
  onChange,
  label,
  id,
  disabled,
  min = 0,
  max = 999,
  step = 1,
  unit,
  help,
  presets,
}: StudioNumberProps) {
  const sid = studioId(label, id);
  const props = { value, onChange, label, sid, disabled, min, max, step, unit, help };
  // Two components, so a field that gains or loses its presets never changes the order of its hooks
  return presets?.length ? <PresetNumber {...props} presets={presets} /> : <PlainNumber {...props} />;
}

function PlainNumber({
  value,
  onChange,
  label,
  sid,
  disabled,
  min,
  max,
  step,
  unit,
  help,
}: Omit<StudioNumberProps, "id" | "presets" | "min" | "max" | "step"> & {
  sid: string;
  min: number;
  max: number;
  step: number;
}) {
  // The field keeps what is typed until it is a number in range; the value changes only then.
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const set = (n: number) => onChange(Math.min(max, Math.max(min, n)));
  return (
    <StudioRow label={label} htmlFor={sid} help={help} disabled={disabled} readout={unit}>
      <div className="ui-sc-number">
        <Button
          variant="quiet"
          size="sm"
          iconOnly
          icon="minus"
          aria-label={`Less ${label.toLowerCase()}`}
          disabled={disabled || value <= min}
          onClick={() => set(value - step)}
        />
        <Input
          id={sid}
          size="sm"
          inputMode="numeric"
          className="ui-sc-field ui-sc-number-field"
          value={draft}
          disabled={disabled}
          onChange={(e) => {
            setDraft(e.target.value);
            const n = Number(e.target.value);
            if (e.target.value !== "" && Number.isFinite(n) && n >= min && n <= max) onChange(n);
          }}
          onBlur={() => setDraft(String(value))}
        />
        <Button
          variant="quiet"
          size="sm"
          iconOnly
          icon="plus"
          aria-label={`More ${label.toLowerCase()}`}
          disabled={disabled || value >= max}
          onClick={() => set(value + step)}
        />
      </div>
    </StudioRow>
  );
}

/** A number with presets: the handle, the field and the list in one field; minus and plus go from preset to preset. */
function PresetNumber({
  value,
  onChange,
  label,
  sid,
  disabled,
  min,
  max,
  step,
  unit,
  help,
  presets,
}: Omit<StudioNumberProps, "id" | "presets" | "min" | "max" | "step"> & {
  sid: string;
  min: number;
  max: number;
  step: number;
  presets: StudioNumberPresetGroup[];
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const steps = [...new Set(presets.flatMap((g) => g.items.map((i) => i.value)))]
    .filter((n) => n >= min && n <= max)
    .sort((a, b) => a - b);
  const below = [...steps].reverse().find((n) => n < value);
  const above = steps.find((n) => n > value);
  const set = (n: number) => onChange(Math.min(max, Math.max(min, n)));
  const name = label.toLowerCase();
  return (
    <StudioRow label={label} htmlFor={sid} help={help} disabled={disabled} readout={unit}>
      <div className="ui-sc-number" data-presets="">
        <Button
          variant="quiet"
          size="sm"
          iconOnly
          icon="minus"
          aria-label={below !== undefined ? `Down to ${below}${unit ? ` ${unit}` : ""}` : `Less ${name}`}
          disabled={disabled || below === undefined}
          onClick={() => below !== undefined && set(below)}
        />
        <InputGroup size="sm" className="ui-sc-number-group" disabled={disabled}>
          <InputGroupAddon>
            <ScrubHandle value={value} min={min} max={max} step={step} disabled={disabled} onChange={set}>
              <Icon name="chevrons-up-down" />
            </ScrubHandle>
          </InputGroupAddon>
          <InputGroupInput
            id={sid}
            inputMode="numeric"
            className="ui-sc-number-field"
            value={draft}
            disabled={disabled}
            onKeyDown={(e) => {
              const by = e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0;
              if (!by) return;
              e.preventDefault();
              set(value + by * step * (e.shiftKey ? 10 : 1));
            }}
            onChange={(e) => {
              setDraft(e.target.value);
              const n = Number(e.target.value);
              if (e.target.value !== "" && Number.isFinite(n) && n >= min && n <= max) onChange(n);
            }}
            onBlur={() => setDraft(String(value))}
          />
          <InputGroupAddon align="inline-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <InputGroupButton
                  size="sm"
                  icon="chevron-down"
                  className="ui-sc-number-menu"
                  aria-label={`${label} presets`}
                  disabled={disabled}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="ui-sc-number-list">
                <DropdownMenuRadioGroup value={String(value)} onValueChange={(v) => set(Number(v))}>
                  {presets.map((g, gi) => (
                    <div key={g.label} role="group" aria-label={g.label}>
                      {gi > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuLabel>{g.label}</DropdownMenuLabel>
                      {g.items
                        .filter((i) => i.value >= min && i.value <= max)
                        .map((i) => (
                          <DropdownMenuRadioItem key={`${g.label}-${i.value}`} value={String(i.value)}>
                            <span className="ui-sc-number-value">{i.value}</span>
                            {i.meta && <span className="ui-sc-number-meta">{i.meta}</span>}
                          </DropdownMenuRadioItem>
                        ))}
                    </div>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </InputGroupAddon>
        </InputGroup>
        <Button
          variant="quiet"
          size="sm"
          iconOnly
          icon="plus"
          aria-label={above !== undefined ? `Up to ${above}${unit ? ` ${unit}` : ""}` : `More ${name}`}
          disabled={disabled || above === undefined}
          onClick={() => above !== undefined && set(above)}
        />
      </div>
    </StudioRow>
  );
}
