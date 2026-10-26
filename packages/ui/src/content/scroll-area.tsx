// Scroll area: design-system/components/scroll-area.css, behaviour ported from scroll-area.js. A thin overlay thumb
// instead of the native scrollbar: it shows while scrolling (data-state="visible") and on hover, can be dragged, and a
// press on the bar jumps there. Without JS the area still scrolls natively. The viewport takes keyboard focus.
import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { cx } from "../cx";
import { motionMs, prefersReducedMotion } from "./internal";

const MIN = 24; // shortest thumb, px

export interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  /** Which scrollbars to draw: "vertical" (default), "horizontal" or "both". */
  orientation?: "vertical" | "horizontal" | "both";
  /** The viewport's accessible name (it is a focusable region). */
  viewportLabel?: string;
  /** Props for the viewport element. */
  viewportProps?: HTMLAttributes<HTMLDivElement>;
  children?: ReactNode;
}

type Axis = "vertical" | "horizontal";

export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(function ScrollArea(
  { orientation = "vertical", viewportLabel, viewportProps, className, children, ...props },
  ref,
) {
  const vpRef = useRef<HTMLDivElement>(null);
  const barRefs = useRef<Partial<Record<Axis, HTMLDivElement | null>>>({});
  const thumbRefs = useRef<Partial<Record<Axis, HTMLDivElement | null>>>({});
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [dragging, setDragging] = useState<Axis | null>(null);
  const hideTimer = useRef<number>(0);
  const axes: Axis[] = orientation === "both" ? ["vertical", "horizontal"] : [orientation];

  const metrics = useCallback((axis: Axis) => {
    const vp = vpRef.current;
    const bar = barRefs.current[axis];
    if (!vp || !bar) return null;
    const h = axis === "horizontal";
    const view = h ? vp.clientWidth : vp.clientHeight;
    const size = h ? vp.scrollWidth : vp.scrollHeight;
    const pos = h ? Math.abs(vp.scrollLeft) : vp.scrollTop;
    const cs = getComputedStyle(bar);
    const track = h
      ? bar.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      : bar.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const thumb = Math.max(MIN, Math.min(track, (view / Math.max(size, 1)) * track));
    return { h, pos, track, thumb, max: size - view };
  }, []);

  const place = useCallback(() => {
    for (const axis of ["vertical", "horizontal"] as Axis[]) {
      const bar = barRefs.current[axis];
      const t = thumbRefs.current[axis];
      const m = metrics(axis);
      if (!bar || !t || !m) continue;
      bar.setAttribute("data-overflow", String(m.max > 1));
      t.style.setProperty("--thumb-size", m.thumb + "px");
      t.style.setProperty("--thumb-pos", (m.max > 0 ? (m.pos / m.max) * (m.track - m.thumb) : 0) + "px");
    }
  }, [metrics]);

  const show = useCallback(() => {
    setVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setVisible(false), motionMs("--ui-motion-slow", 480) * 2);
  }, []);

  useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;
    setReady(true);
    place();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => place());
    ro.observe(vp);
    Array.from(vp.children).forEach((c) => ro.observe(c));
    return () => ro.disconnect();
  }, [place, children]);

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  const onBarDown = (axis: Axis) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const vp = vpRef.current;
    const bar = barRefs.current[axis];
    const thumb = thumbRefs.current[axis];
    const m = metrics(axis);
    if (!vp || !bar || !m) return;
    const r = bar.getBoundingClientRect();
    if (e.target !== thumb) {
      const at = (m.h ? e.clientX - r.left : e.clientY - r.top) - m.thumb / 2;
      const to = (at / Math.max(1, m.track - m.thumb)) * m.max;
      const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
      if (m.h) vp.scrollTo({ left: to, behavior });
      else vp.scrollTo({ top: to, behavior });
      return;
    }
    e.preventDefault();
    const start = m.h ? e.clientX : e.clientY;
    const from = m.h ? vp.scrollLeft : vp.scrollTop;
    setDragging(axis);
    bar.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const d = (m.h ? ev.clientX : ev.clientY) - start;
      const to = from + d * (m.max / Math.max(1, m.track - m.thumb));
      if (m.h) vp.scrollLeft = to;
      else vp.scrollTop = to;
    };
    const up = () => {
      setDragging(null);
      bar.removeEventListener("pointermove", move);
      bar.removeEventListener("pointerup", up);
      bar.removeEventListener("pointercancel", up);
      show();
    };
    bar.addEventListener("pointermove", move);
    bar.addEventListener("pointerup", up);
    bar.addEventListener("pointercancel", up);
  };

  const { className: vpClass, onScroll: vpOnScroll, ...vpRest } = viewportProps ?? {};

  return (
    <div ref={ref} data-slot="scroll-area" className={cx("ui-scroll-area", ready && "is-ready", className)} {...props}>
      <div
        ref={vpRef}
        className={cx("ui-scroll-area-viewport", vpClass)}
        tabIndex={0}
        role={viewportLabel ? "region" : undefined}
        aria-label={viewportLabel}
        onScroll={(e) => {
          vpOnScroll?.(e);
          place();
          show();
        }}
        {...vpRest}
      >
        {children}
      </div>
      {axes.map((axis) => (
        <div
          key={axis}
          ref={(n) => {
            barRefs.current[axis] = n;
          }}
          className="ui-scroll-area-scrollbar"
          data-orientation={axis}
          data-state={visible || dragging === axis ? "visible" : "hidden"}
          onPointerDown={onBarDown(axis)}
        >
          <div
            ref={(n) => {
              thumbRefs.current[axis] = n;
            }}
            className="ui-scroll-area-thumb"
            data-dragging={dragging === axis ? "" : undefined}
          />
        </div>
      ))}
    </div>
  );
});
