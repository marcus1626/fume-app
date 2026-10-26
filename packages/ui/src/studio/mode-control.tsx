// ModeControl: the one component a mode needs. It takes a mode variable (a StudioVariable, the backend's
// ModeVariable), its value and onChange, and renders the control its `control` kind names. An agent that makes a new
// mode writes only the schema; the Studio renders every variable through this.
//   {mode.variables.map((v) => <ModeControl key={v.key} variable={v} value={vars[v.key]} onChange={(x) => set(v.key, x)}
//     presets={presetsFor(v.brandPreset)} />)}
import { angleWords, StudioAngle } from "./angle";
import { StudioChips, StudioSegmented, StudioSelect, StudioToggle } from "./choices";
import { StudioNumber, StudioText } from "./fields";
import { StudioLens } from "./lens";
import { StudioLightboard } from "./lightboard";
import { StudioSlider } from "./slider";
import { StudioSwatch } from "./swatch";
import type {
  StudioLensValue as Lens,
  StudioLightAngle,
  StudioLightRig,
  StudioPreset,
  StudioValue,
  StudioVariable,
} from "./types";

export interface ModeControlProps {
  variable: StudioVariable;
  /** The document's value; the variable's default when the document has none yet. */
  value: StudioValue | undefined;
  onChange: (value: StudioValue) => void;
  /** The brand's presets of the variable's brandPreset kind (swatches and selects list them first). */
  presets?: StudioPreset[];
  disabled?: boolean;
}

export function ModeControl({ variable: v, value, onChange, presets, disabled }: ModeControlProps) {
  const val = value ?? v.default;
  const common = { label: v.label, id: `sc-${v.key}`, disabled, help: v.help };
  switch (v.control) {
    case "slider":
      return (
        <StudioSlider
          {...common}
          value={Number(val)}
          min={v.min}
          max={v.max}
          step={v.step}
          unit={v.unit}
          onChange={onChange}
        />
      );
    case "number":
      return (
        <StudioNumber
          {...common}
          value={Number(val)}
          min={v.min}
          max={v.max}
          step={v.step}
          unit={v.unit}
          onChange={onChange}
        />
      );
    case "segmented":
      return <StudioSegmented {...common} value={String(val)} options={v.options ?? []} onChange={onChange} />;
    case "select":
      return (
        <StudioSelect {...common} value={String(val)} options={v.options ?? []} presets={presets} onChange={onChange} />
      );
    case "swatch":
      return (
        <StudioSwatch {...common} value={String(val)} options={v.options ?? []} presets={presets} onChange={onChange} />
      );
    case "toggle":
      return <StudioToggle {...common} value={Boolean(val)} onChange={onChange} />;
    case "chips":
      return (
        <StudioChips {...common} value={Array.isArray(val) ? val : []} options={v.options ?? []} onChange={onChange} />
      );
    case "text":
      return <StudioText {...common} value={String(val ?? "")} onChange={onChange} />;
    case "angle":
      return <StudioAngle {...common} value={val as StudioLightAngle} onChange={onChange} />;
    case "lens":
      return <StudioLens {...common} value={val as Lens} onChange={onChange} />;
    case "lightboard":
      return <StudioLightboard {...common} value={val as StudioLightRig} onChange={onChange} />;
  }
}

/** A variable's value in words, for a change line ("Hair length 40 → 65", "Light 70° from the right"). */
export function studioValueWords(v: StudioVariable | undefined, value: StudioValue | undefined): string {
  if (value === undefined || value === null) return "–";
  if (typeof value === "boolean") return value ? "on" : "off";
  if (Array.isArray(value))
    return value.map((x) => v?.options?.find((o) => o.value === x)?.label ?? x).join(", ") || "none";
  if (typeof value === "object") {
    if ("lights" in value) return `${value.lights.length} ${value.lights.length === 1 ? "light" : "lights"}`;
    return "azimuth" in value
      ? `${angleWords(value)}, ${value.elevation}° up`
      : `${value.focal} mm, ${value.height} cm, ${value.tilt}°`;
  }
  const option = v?.options?.find((o) => o.value === String(value));
  if (option) return option.label;
  if (typeof value === "number")
    return v?.unit ? `${value}${v.unit === "%" ? " %" : v.unit === "°" ? "°" : ` ${v.unit}`}` : String(value);
  return value.length > 40 ? `${value.slice(0, 40)}…` : value;
}
