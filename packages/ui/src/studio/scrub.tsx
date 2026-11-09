// Scrubbing a number, as in Figma, OpenPencil and After Effects (round 16, PROPOSED 9 Nov 2026): the short label beside
// a number field ("X", "W", "Aa") is a handle. Drag it right or up for more, left or down for less: one step for every
// two pixels, ten with Shift, a tenth with Alt when the step allows it. The field stays the control a keyboard and a
// screen reader use (type, or the arrow keys); the handle is the mouse's and the pen's way to the same value.
//   <ScrubHandle value={x} min={0} max={1080} onChange={setX}>X</ScrubHandle>
//   const scrub = useScrub({ value, onChange }); <span {...scrub.handlers} />
import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { cx } from "../cx";

export interface ScrubOptions {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  /** One step: 1 for pixels, 0.01 for a fraction. */
  step?: number;
  disabled?: boolean;
}

/** Pixels of pointer travel for one step. */
const PX_PER_STEP = 2;

export function useScrub({ value, onChange, min = -Infinity, max = Infinity, step = 1, disabled }: ScrubOptions) {
  const [scrubbing, setScrubbing] = useState(false);
  const from = useRef<{ x: number; y: number; value: number } | null>(null);
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  const round = (n: number) => Number((Math.round(n / step) * step).toFixed(decimals + 1));
  const handlers = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (disabled || e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      from.current = { x: e.clientX, y: e.clientY, value };
      setScrubbing(true);
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const f = from.current;
      if (!f) return;
      // Right and up are more; whichever way the pointer went further wins, so a slightly crooked drag still counts.
      const dx = e.clientX - f.x;
      const dy = f.y - e.clientY;
      const travel = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
      const by = e.shiftKey ? 10 : e.altKey && step < 1 ? 0.1 : 1;
      const next = Math.min(max, Math.max(min, round(f.value + Math.trunc(travel / PX_PER_STEP) * step * by)));
      if (next !== value) onChange(next);
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      from.current = null;
      setScrubbing(false);
    },
    onPointerCancel: () => {
      from.current = null;
      setScrubbing(false);
    },
  };
  return { handlers, scrubbing };
}

export interface ScrubHandleProps extends ScrubOptions {
  /** The short name of the value: "X", "Y", "W", "Size". */
  children: ReactNode;
  className?: string;
}

/** The short label of a number, which drags its value (aria-hidden: the field beside it is the control). */
export function ScrubHandle({ children, className, ...options }: ScrubHandleProps) {
  const { handlers, scrubbing } = useScrub(options);
  return (
    <span
      className={cx("ui-scrub", className)}
      data-scrubbing={scrubbing ? "" : undefined}
      data-disabled={options.disabled ? "" : undefined}
      title={options.disabled ? undefined : "Drag to change"}
      aria-hidden="true"
      {...handlers}
    >
      {children}
    </span>
  );
}
