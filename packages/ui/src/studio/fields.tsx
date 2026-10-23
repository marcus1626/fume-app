// The Studio's typed controls: StudioText (words: a direction, "what to make") and StudioNumber (a count, with a
// minus and a plus pill either side). Both sit in a StudioRow; the field is the design system's small field.
//   <StudioText label="What to make" value={object} onChange={set} />
//   <StudioNumber label="Count" value={4} min={1} max={8} onChange={set} />
import { useEffect, useState } from "react";
import { Button } from "../controls/button";
import { Input, Textarea } from "../controls/field";
import { StudioRow } from "./row";
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

export interface StudioNumberProps extends StudioControlProps<number> {
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  help?: string;
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
}: StudioNumberProps) {
  const sid = studioId(label, id);
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
