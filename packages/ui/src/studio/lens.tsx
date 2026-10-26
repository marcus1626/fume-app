// StudioLens: the camera in three numbers (FLOWS §9.3): focal length (mm), camera height (cm from the surface) and
// tilt (degrees, negative looks down), each a small slider under one label, the whole lens as data on the label line.
//   <StudioLens label="Lens" value={{ focal: 50, height: 30, tilt: -8 }} onChange={set} />
import { StudioRow } from "./row";
import { StudioSlider } from "./slider";
import { studioId, type StudioControlProps, type StudioLensValue as Lens } from "./types";

export interface StudioLensProps extends StudioControlProps<Lens> {
  focal?: [number, number];
  height?: [number, number];
  tilt?: [number, number];
  help?: string;
}

export function StudioLens({
  value,
  onChange,
  label,
  id,
  disabled,
  focal = [14, 200],
  height = [0, 200],
  tilt = [-45, 45],
  help,
}: StudioLensProps) {
  const sid = studioId(label, id);
  const part = (key: keyof Lens, name: string, [min, max]: [number, number], unit: string, step = 1) => (
    <div className="ui-sc-lens-part">
      <span className="ui-sc-label" aria-hidden="true">
        {name}
      </span>
      <StudioSlider
        bare
        label={`${label}: ${name.toLowerCase()}`}
        id={`${sid}-${key}`}
        value={value[key]}
        min={min}
        max={max}
        step={step}
        unit={unit}
        disabled={disabled}
        onChange={(n) => onChange({ ...value, [key]: n })}
      />
      <span className="ui-sc-readout">
        {value[key]}
        {unit === "°" ? "°" : ` ${unit}`}
      </span>
    </div>
  );
  return (
    <StudioRow label={label} labelId={`${sid}-l`} readout={`${value.focal} mm`} help={help} disabled={disabled}>
      <div className="ui-sc-lens" role="group" aria-labelledby={`${sid}-l`}>
        {part("focal", "Focal", focal, "mm")}
        {part("height", "Height", height, "cm")}
        {part("tilt", "Tilt", tilt, "°")}
      </div>
    </StudioRow>
  );
}
