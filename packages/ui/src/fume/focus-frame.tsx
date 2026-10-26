// Focus frame (design-system/components/focus-frame.css): Fume's own sign in UI, two corners and one point, drawn with
// the Focus System v1.3 geometry (F-D059). The geometry is the same as templates/lib/focus.mjs (the port of
// tools/canvas/tools/geo.py): corners sized from the frame's short side (u = 5 % of it / 3, corner 11u, arms 2.5u), the
// point from its area (5 % of √(w × h)). Never draw a frame by hand.
//   <div style={{ position: "relative" }}> … <FocusFrame point="focal" /></div>
// The frame fills its positioned parent; it redraws when the parent changes size.
import { useEffect, useRef, useState, type HTMLAttributes } from "react";
import { cx } from "../cx";

const POINT_D =
  "M225 245C225 234 234 225 245 225H326.7C334.8 225 342.1 229.9 345.2 237.3C348.3 244.8 346.6 253.4 340.9 259.1L259.1 340.9C253.4 346.6 244.8 348.3 237.3 345.2C229.9 342.1 225 334.8 225 326.7Z";
const f2 = (x: number) => x.toFixed(2);
const g6 = (x: number) => String(+(+x).toPrecision(6));

type Pt = [number, number];

function poly(pts: Pt[], r: number): string {
  const n = pts.length;
  let d = "";
  const toward = (a: Pt, b: Pt, dd: number): Pt => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy);
    const k = Math.min(dd, l / 2);
    return [a[0] + (dx / l) * k, a[1] + (dy / l) * k];
  };
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const a = toward(p1, p0, r);
    const b = toward(p1, p2, r);
    d += `${i ? "L" : "M"}${f2(a[0])} ${f2(a[1])} Q${f2(p1[0])} ${f2(p1[1])} ${f2(b[0])} ${f2(b[1])}`;
  }
  return `${d}Z`;
}

function cornerD(u: number): string {
  const t = 2.5 * u;
  const g = t / 3;
  const r = 0.1 * t;
  const L = 11 * u;
  return (
    poly(
      [
        [0, 0],
        [L, 0],
        [L - t, t],
        [0, t],
      ],
      r,
    ) +
    poly(
      [
        [0, t + g],
        [t, t + g],
        [t, L - t],
        [0, L],
      ],
      r,
    )
  );
}

/** The two corners and the focal point for a frame of W × H, in its own coordinates. */
export function focusFrameGeometry(W: number, H: number) {
  const u = (0.05 * Math.min(W, H)) / 3;
  const P = 0.05 * Math.sqrt(W * H);
  const d = cornerD(u);
  const tip: Pt = [W / 2, H / 2 - (P * Math.SQRT2) / 3];
  return {
    corners: [
      { d, transform: "translate(0 0) scale(1 1)" },
      { d, transform: `translate(${g6(W)} ${g6(H)}) scale(-1 -1)` },
    ],
    point: {
      d: POINT_D,
      transform: `translate(${g6(tip[0])} ${g6(tip[1])}) rotate(45) scale(${g6(P / 150)}) translate(-225 -225)`,
    },
  };
}

export interface FocusFrameProps extends HTMLAttributes<HTMLSpanElement> {
  /** focal: the point at rest in the centre, the Engine at work (it breathes). none: corners only. */
  point?: "focal" | "none";
  /** ink on light grounds (UI surfaces), paper on photographs and dark grounds. */
  tone?: "ink" | "paper";
}

/** The frame over its positioned parent. Decorative: aria-hidden; say in words what is in focus. */
export function FocusFrame({ point = "focal", tone = "ink", className, ...props }: FocusFrameProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setSize((s) => (s && s.w === w && s.h === h ? s : w && h ? { w, h } : null));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const geo = size ? focusFrameGeometry(size.w, size.h) : null;
  return (
    <span ref={ref} className={cx("ui-focus-frame", className)} data-tone={tone} aria-hidden="true" {...props}>
      {geo && size && (
        <svg viewBox={`0 0 ${size.w} ${size.h}`} focusable="false">
          {geo.corners.map((c, i) => (
            <path key={i} className="ui-focus-frame-corner" d={c.d} transform={c.transform} />
          ))}
          {point === "focal" && (
            <path className="ui-focus-frame-point" d={geo.point.d} transform={geo.point.transform} />
          )}
        </svg>
      )}
    </span>
  );
}
