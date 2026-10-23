// StudioAngle: where the light comes from, seen from above (FLOWS §9.3). The subject sits in the middle of a sunken
// disc and the camera at its foot; drag the light point around the disc for the azimuth (0 = from the camera,
// 90 = from the right, -90 = from the left), and set its height with the small slider beside it (elevation 0–90°).
// Arrow keys on the point turn it 5° at a time.
//   <StudioAngle label="Light direction" value={{ azimuth: 70, elevation: 20 }} onChange={set} />
import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { Icon } from "../icons";
import { StudioRow } from "./row";
import { StudioSlider } from "./slider";
import { studioId, type StudioControlProps, type StudioLightAngle } from "./types";

export interface StudioAngleProps extends StudioControlProps<StudioLightAngle> {
  /** Degrees per drag or key step. Default 5. */
  step?: number;
  help?: string;
}

const wrap = (deg: number) => {
  let d = ((deg + 180) % 360 + 360) % 360 - 180;
  if (d === -180) d = 180;
  return d;
};

/** "70° from the right", "From the camera", "From behind". */
export function angleWords({ azimuth }: StudioLightAngle) {
  const a = wrap(azimuth);
  if (a === 0) return "From the camera";
  if (Math.abs(a) === 180) return "From behind";
  return `${Math.abs(a)}° from the ${a > 0 ? "right" : "left"}`;
}

export function StudioAngle({ value, onChange, label, id, disabled, step = 5, help }: StudioAngleProps) {
  const sid = studioId(label, id);
  const disc = useRef<HTMLDivElement>(null);
  const rad = (wrap(value.azimuth) * Math.PI) / 180;

  const fromPointer = (x: number, y: number) => {
    const r = disc.current?.getBoundingClientRect();
    if (!r) return;
    const dx = x - (r.left + r.width / 2);
    const dy = y - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < 4) return;
    const az = wrap(Math.round((Math.atan2(dx, dy) * 180) / Math.PI / step) * step);
    if (az !== value.azimuth) onChange({ ...value, azimuth: az });
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.querySelector<HTMLElement>(".ui-sc-dial-point")?.focus({ preventScroll: true });
    fromPointer(e.clientX, e.clientY);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e.clientX, e.clientY);
  };
  const keys = (e: KeyboardEvent<HTMLSpanElement>) => {
    const by = ({ ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step } as Record<string, number>)[e.key];
    if (!by) return;
    e.preventDefault();
    onChange({ ...value, azimuth: wrap(value.azimuth + by) });
  };

  return (
    <StudioRow label={label} labelId={`${sid}-l`} readout={`${angleWords(value)} · ${value.elevation}° up`} help={help} disabled={disabled}>
      <div className="ui-sc-angle">
        <div
          ref={disc}
          className="ui-sc-dial"
          data-disabled={disabled ? "" : undefined}
          style={{ "--dx": Math.sin(rad).toFixed(4), "--dy": Math.cos(rad).toFixed(4) } as CSSProperties}
          onPointerDown={down}
          onPointerMove={move}
        >
          <span className="ui-sc-dial-subject" aria-hidden="true" />
          <Icon name="camera" className="ui-sc-dial-camera" />
          <span
            id={sid}
            className="ui-sc-dial-point"
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-labelledby={`${sid}-l`}
            aria-valuemin={-180}
            aria-valuemax={180}
            aria-valuenow={wrap(value.azimuth)}
            aria-valuetext={angleWords(value)}
            onKeyDown={keys}
          />
        </div>
        <div className="ui-sc-angle-height">
          <span className="ui-sc-label" aria-hidden="true">
            Height
          </span>
          <StudioSlider bare label={`${label} height`} id={`${sid}-h`} value={value.elevation} min={0} max={90} step={step} unit="°" disabled={disabled} onChange={(elevation) => onChange({ ...value, elevation })} />
          <span className="ui-sc-readout">{value.elevation}°</span>
        </div>
      </div>
    </StudioRow>
  );
}
