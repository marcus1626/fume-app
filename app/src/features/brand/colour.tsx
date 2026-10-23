// Round 13 (Marcus's video comments #2 and #42, 22 Oct 2026; PROPOSED): a colour is checked and changed with a colour
// picker beside its hex (the hex stays: most brands know theirs), and its uses are chosen as chips (Buttons, Accent,
// Backgrounds, Text, Light, Packaging, UI and design system) instead of one line of words. The same two controls in
// the onboarding's Colour part, on the Brand DNA board and in Confirm your brand. The look is r13-brand.css.
import { ToggleGroup, ToggleGroupItem } from "@fume/ui";
import type { ColourUse } from "../../contract";
import { vars } from "./board";

export const colourUses: ColourUse[] = ["buttons", "accent", "backgrounds", "text", "light", "packaging", "ui"];

export const colourUseLabel: Record<ColourUse, string> = {
  buttons: "Buttons",
  accent: "Accent",
  backgrounds: "Backgrounds",
  text: "Text",
  light: "Light",
  packaging: "Packaging",
  ui: "UI and design system",
};

/** "Accent · Light · Packaging", or undefined when none is chosen. */
export const usesWords = (uses?: ColourUse[]) =>
  uses?.length
    ? colourUses
        .filter((u) => uses.includes(u))
        .map((u) => colourUseLabel[u])
        .join(" · ")
    : undefined;

/** "Primary · Accent · Light": a colour's role, then its uses (a use that repeats the role is said once). */
export const roleAndUses = (role: string, uses?: ColourUse[]) =>
  [
    role,
    ...colourUses.filter((u) => uses?.includes(u) && colourUseLabel[u] !== role).map((u) => colourUseLabel[u]),
  ].join(" · ");

const HEX = /^#?[0-9a-f]{6}$/i;
/** A hex as the picker takes it: "#5c1f2a", or black while what is typed is not a hex yet. */
const pickerValue = (hex: string) =>
  HEX.test(hex.trim()) ? `#${hex.trim().replace(/^#/, "")}`.toLowerCase() : "#000000";

/**
 * The colour picker beside the hex field (#2): a swatch of the colour as typed; a click opens the system's picker,
 * and what is picked is written into the hex field (in capitals, with its #).
 */
export function HexPicker({
  value,
  onChange,
  label,
  disabled,
}: {
  value: string;
  onChange: (hex: string) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label
      className="ui-colour-picker"
      style={vars({ "--swatch": pickerValue(value) })}
      data-disabled={disabled ? "" : undefined}
    >
      <input
        type="color"
        value={pickerValue(value)}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        aria-label={label}
        disabled={disabled}
      />
    </label>
  );
}

/** What a colour is used for, as chips (#42): any number of them. */
export function ColourUsesField({
  id,
  value,
  onChange,
  disabled,
  label = "What it is used for",
}: {
  id: string;
  value: ColourUse[];
  onChange: (uses: ColourUse[]) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div className="ui-colour-uses" role="group" aria-labelledby={`${id}-label`}>
      <p className="ui-colour-uses-label" id={`${id}-label`}>
        {label}
      </p>
      <ToggleGroup
        type="multiple"
        variant="outline"
        size="sm"
        value={value}
        onValueChange={(v) => onChange(v as ColourUse[])}
        disabled={disabled}
        aria-labelledby={`${id}-label`}
      >
        {colourUses.map((u) => (
          <ToggleGroupItem key={u} value={u}>
            {colourUseLabel[u]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
