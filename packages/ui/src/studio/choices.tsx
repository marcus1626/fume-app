// The Studio's choosing controls, each the design system's own control in a StudioRow:
//   StudioSegmented  one of a few (SegmentedControl, full width)        <StudioSegmented label="Shadow" options={…} />
//   StudioSelect     one of many (Select, small trigger); options that are the brand's presets come first, marked
//                    with the brand's name
//   StudioToggle     on or off (Switch, small, on the label line)
//   StudioChips      several of a few (ToggleGroup multiple, small pills that wrap)
import { SegmentedControl, SegmentedOption } from "../controls/segmented";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../controls/select";
import { Switch } from "../controls/switch";
import { ToggleGroup, ToggleGroupItem } from "../controls/toggle";
import { StudioRow } from "./row";
import { studioId, type StudioControlProps, type StudioOption, type StudioPreset } from "./types";

const labelOf = (options: StudioOption[], value: string) => options.find((o) => o.value === value)?.label ?? value;

export interface StudioSegmentedProps extends StudioControlProps<string> {
  options: StudioOption[];
  help?: string;
}

export function StudioSegmented({ value, onChange, label, id, disabled, options, help }: StudioSegmentedProps) {
  const sid = studioId(label, id);
  return (
    <StudioRow label={label} labelId={`${sid}-l`} help={help} disabled={disabled}>
      <SegmentedControl
        id={sid}
        className="ui-sc-seg"
        aria-labelledby={`${sid}-l`}
        value={value}
        onValueChange={(v) => !disabled && onChange(v)}
      >
        {options.map((o) => (
          <SegmentedOption key={o.value} value={o.value} disabled={disabled}>
            {o.label}
          </SegmentedOption>
        ))}
      </SegmentedControl>
    </StudioRow>
  );
}

export interface StudioSelectProps extends StudioControlProps<string> {
  options: StudioOption[];
  /** The brand's chosen presets: options whose label is a preset's name come first, marked with the brand. */
  presets?: StudioPreset[];
  placeholder?: string;
  help?: string;
}

export function StudioSelect({
  value,
  onChange,
  label,
  id,
  disabled,
  options,
  presets = [],
  placeholder,
  help,
}: StudioSelectProps) {
  const sid = studioId(label, id);
  const isPreset = (o: StudioOption) => presets.find((p) => p.name.toLowerCase() === o.label.toLowerCase());
  const brandOptions = options.filter(isPreset);
  const rest = options.filter((o) => !isPreset(o));
  return (
    <StudioRow label={label} labelId={`${sid}-l`} help={help} disabled={disabled}>
      <Select value={value} onValueChange={onChange} disabled={disabled} className="ui-sc-select">
        <SelectTrigger id={sid} size="sm" aria-labelledby={`${sid}-l`}>
          <SelectValue placeholder={placeholder ?? labelOf(options, value)} />
        </SelectTrigger>
        <SelectContent>
          {brandOptions.length > 0 && (
            <SelectGroup>
              <SelectLabel>{presets[0]!.brand}’s choice</SelectLabel>
              {brandOptions.map((o) => (
                <SelectItem key={o.value} value={o.value} meta={presets[0]!.brand}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {rest.length > 0 && (
            <SelectGroup>
              {brandOptions.length > 0 && <SelectLabel>More</SelectLabel>}
              {rest.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
    </StudioRow>
  );
}

export interface StudioToggleProps extends StudioControlProps<boolean> {
  help?: string;
}

export function StudioToggle({ value, onChange, label, id, disabled, help }: StudioToggleProps) {
  const sid = studioId(label, id);
  return (
    <StudioRow
      label={label}
      htmlFor={sid}
      help={help}
      disabled={disabled}
      className="ui-sc--inline"
      inline={<Switch id={sid} size="sm" checked={value} disabled={disabled} onCheckedChange={(on) => onChange(on)} />}
    />
  );
}

export interface StudioChipsProps extends StudioControlProps<string[]> {
  options: StudioOption[];
  help?: string;
}

export function StudioChips({ value, onChange, label, id, disabled, options, help }: StudioChipsProps) {
  const sid = studioId(label, id);
  return (
    <StudioRow
      label={label}
      labelId={`${sid}-l`}
      readout={value.length ? `${value.length} of ${options.length}` : undefined}
      help={help}
      disabled={disabled}
    >
      <ToggleGroup
        id={sid}
        type="multiple"
        size="sm"
        variant="outline"
        className="ui-sc-chips"
        aria-labelledby={`${sid}-l`}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
      >
        {options.map((o) => (
          <ToggleGroupItem key={o.value} value={o.value}>
            {o.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </StudioRow>
  );
}
