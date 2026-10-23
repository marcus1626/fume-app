// StudioSlider: the design system's slider (slider.css, DECIDED 13 Oct) as a React control, with its unit and the
// value as data on the label line. Drag anywhere on the track; arrows one step, Page Up/Down ten, Home/End.
//   <StudioSlider label="Hair length" value={40} min={0} max={100} unit="%" onChange={set} />
import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { cx } from "../cx";
import { StudioRow } from "./row";
import { studioId, type StudioControlProps } from "./types";

export interface StudioSliderProps extends StudioControlProps<number> {
  min?: number;
  max?: number;
  step?: number;
  /** Shown after the value: "%", "K", "mm", "°". */
  unit?: string;
  help?: string;
  /** The words for the value instead of the number ("70° from the right"). */
  format?: (value: number) => string;
  /** Without the row: only the track (inside another control, e.g. the light dial). */
  bare?: boolean;
  className?: string;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const snap = (v: number, step: number, min: number) => {
  const n = Math.round((v - min) / step) * step + min;
  return Number(n.toFixed(4));
};

export function withUnit(value: number, unit?: string) {
  if (!unit) return String(value);
  return /^[°%]$/.test(unit) ? `${value}${unit === "%" ? " %" : unit}` : `${value} ${unit}`;
}

export function StudioSlider({ value, onChange, label, id, disabled, min = 0, max = 100, step = 1, unit, help, format, bare, className }: StudioSliderProps) {
  const sid = studioId(label, id);
  const root = useRef<HTMLDivElement>(null);
  const p = max > min ? (clamp(value, min, max) - min) / (max - min) : 0;

  const fromPointer = (clientX: number) => {
    const el = root.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const thumb = el.querySelector<HTMLElement>(".ui-slider-thumb")?.offsetWidth ?? 0;
    const ratio = clamp((clientX - r.left - thumb / 2) / Math.max(1, r.width - thumb), 0, 1);
    const next = clamp(snap(min + ratio * (max - min), step, min), min, max);
    if (next !== value) onChange(next);
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.querySelector<HTMLElement>(".ui-slider-thumb")?.focus({ preventScroll: true });
    e.currentTarget.querySelector<HTMLElement>(".ui-slider-thumb")?.setAttribute("data-dragging", "");
    fromPointer(e.clientX);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e.clientX);
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.querySelector<HTMLElement>(".ui-slider-thumb")?.removeAttribute("data-dragging");
  };
  const keys = (e: KeyboardEvent<HTMLSpanElement>) => {
    const by: Record<string, number> = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: step * 10, PageDown: -step * 10 };
    let next: number | undefined;
    if (e.key in by) next = value + by[e.key]!;
    if (e.key === "Home") next = min;
    if (e.key === "End") next = max;
    if (next === undefined) return;
    e.preventDefault();
    next = clamp(snap(next, step, min), min, max);
    if (next !== value) onChange(next);
  };

  const words = format ? format(value) : withUnit(value, unit);
  const track = (
    <div
      ref={root}
      className={cx("ui-slider", "ui-sc-slider", bare && className)}
      data-thumbs="1"
      data-disabled={disabled ? "" : undefined}
      style={{ "--b": p } as CSSProperties}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <span className="ui-slider-track">
        <span className="ui-slider-range" />
      </span>
      <span
        id={sid}
        className="ui-slider-thumb"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={words}
        aria-disabled={disabled || undefined}
        style={{ "--p": p } as CSSProperties}
        onKeyDown={keys}
      />
    </div>
  );
  if (bare) return track;
  return (
    <StudioRow label={label} labelId={`${sid}-l`} readout={words} help={help} disabled={disabled} className={className}>
      {track}
    </StudioRow>
  );
}
