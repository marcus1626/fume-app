// The curve editor (round 16, PROPOSED 9 Nov 2026). Marcus: "Ingen manuell motion controll? Eller ease in ease out
// number?" A layer's easing drawn as its curve: time across, progress up. Drag either handle, or type the four numbers
// (cubic-bezier x1, y1, x2, y2, as CSS and every motion tool write them). After Effects' way is there too: the ease
// out of the first key and the ease into the next, as influence in per cent (Easy ease is 33 and 33). The brand's
// easings are the presets; a curve of her own is "Custom". A curve that goes past its mark and back is a bounce,
// which the brand's motion never has: allowed, and said so under it. "Try it" runs a dot along the curve. The look is
// studio-video.css (.ui-video-curve).
import { Button } from "@fume/ui";
import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { EaseId } from "../../../../contract";
import { EASES, easeNamed, fromInfluence, influence, overshoots } from "./motion";
import { Field } from "./Transform";

type Curve = [number, number, number, number];

// The graph: time 0–1 across 200 units, progress −0.3–1.3 up 100 units each.
const W = 200;
const H = 100;
const px = (x: number) => x * W;
const py = (y: number) => H - y * H;
const Y_MIN = -0.3;
const Y_MAX = 1.3;

export function CurveEditor({
  curve,
  brandName,
  disabled,
  onCurve,
  onEase,
}: {
  curve: Curve;
  brandName: string;
  disabled?: boolean;
  /** A curve of her own; the key merges a drag into one undo step. */
  onCurve: (curve: Curve, key: string) => void;
  /** One of the brand's easings. */
  onEase: (id: EaseId) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [grab, setGrab] = useState<1 | 2>();
  const [go, setGo] = useState(false);
  const named = easeNamed(curve);
  const [x1, y1, x2, y2] = curve;
  const inf = influence(curve);
  const easy = Math.abs(x1 - 0.33) < 0.005 && y1 === 0 && Math.abs(x2 - 0.67) < 0.005 && y2 === 1;

  const set = (i: 0 | 1 | 2 | 3, v: number, key: string) => {
    const next = [...curve] as Curve;
    next[i] = i % 2 === 0 ? clamp(v, 0, 1) : clamp(v, -1, 2);
    onCurve(next.map((n) => Math.round(n * 100) / 100) as Curve, key);
  };
  const pointAt = (e: PointerEvent<SVGElement>) => {
    const m = svg.current?.getScreenCTM();
    if (!m) return undefined;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: clamp(p.x / W, 0, 1), y: clamp((H - p.y) / H, Y_MIN, Y_MAX) };
  };
  const down = (which: 1 | 2) => (e: PointerEvent<SVGCircleElement>) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setGrab(which);
  };
  const move = (which: 1 | 2) => (e: PointerEvent<SVGCircleElement>) => {
    if (grab !== which || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const p = pointAt(e);
    if (!p) return;
    const next: Curve = which === 1 ? [p.x, p.y, x2, y2] : [x1, y1, p.x, p.y];
    onCurve(next.map((n) => Math.round(n * 100) / 100) as Curve, "curve-drag");
  };

  const d = `M${px(0)} ${py(0)} C${px(x1)} ${py(y1)} ${px(x2)} ${py(y2)} ${px(1)} ${py(1)}`;
  return (
    <div
      className="ui-video-curve"
      data-disabled={disabled ? "" : undefined}
      style={{ "--curve": `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})` } as CSSProperties}
    >
      <div className="ui-video-curve-presets" role="group" aria-label="Easing">
        {(Object.keys(EASES) as EaseId[]).map((id) => (
          <button
            key={id}
            type="button"
            className="ui-video-chip"
            aria-pressed={named === id}
            title={`${EASES[id].line} · cubic-bezier ${EASES[id].curve.join(", ")}`}
            disabled={disabled}
            onClick={() => onEase(id)}
          >
            {EASES[id].name}
          </button>
        ))}
        <button
          type="button"
          className="ui-video-chip"
          aria-pressed={easy}
          title="After Effects’ Easy ease: 33 % out and in, at rest on both keys"
          disabled={disabled}
          onClick={() => onCurve(fromInfluence(33, 33), "curve-easy")}
        >
          Easy ease
        </button>
        {!named && !easy && (
          <span className="ui-video-chip" data-static="" aria-current="true">
            Custom
          </span>
        )}
      </div>
      <svg
        ref={svg}
        className="ui-video-curve-graph"
        viewBox={`-12 ${py(Y_MAX) - 4} ${W + 24} ${(Y_MAX - Y_MIN) * H + 8}`}
        role="img"
        aria-label={`The curve: cubic-bezier ${x1}, ${y1}, ${x2}, ${y2}`}
      >
        <rect className="ui-video-curve-box" x={0} y={0} width={W} height={H} rx={4} />
        <line className="ui-video-curve-arm" x1={px(0)} y1={py(0)} x2={px(x1)} y2={py(y1)} />
        <line className="ui-video-curve-arm" x1={px(1)} y1={py(1)} x2={px(x2)} y2={py(y2)} />
        <path className="ui-video-curve-line" d={d} />
        <circle className="ui-video-curve-end" cx={px(0)} cy={py(0)} r={3} />
        <circle className="ui-video-curve-end" cx={px(1)} cy={py(1)} r={3} />
        {([1, 2] as const).map((which) => (
          <circle
            key={which}
            className="ui-video-curve-handle"
            data-grabbed={grab === which ? "" : undefined}
            data-handle={which}
            cx={px(which === 1 ? x1 : x2)}
            cy={py(which === 1 ? y1 : y2)}
            r={7}
            onPointerDown={down(which)}
            onPointerMove={move(which)}
            onPointerUp={() => setGrab(undefined)}
            onPointerCancel={() => setGrab(undefined)}
          />
        ))}
      </svg>
      <div className="ui-video-curve-numbers" role="group" aria-label="The curve’s numbers, cubic-bezier">
        <Field
          id="cv-x1"
          label="Curve x1"
          short="x1"
          value={x1}
          min={0}
          max={1}
          step={0.01}
          disabled={disabled}
          onValue={(v) => set(0, v, "curve-x1")}
        />
        <Field
          id="cv-y1"
          label="Curve y1"
          short="y1"
          value={y1}
          min={-1}
          max={2}
          step={0.01}
          disabled={disabled}
          onValue={(v) => set(1, v, "curve-y1")}
        />
        <Field
          id="cv-x2"
          label="Curve x2"
          short="x2"
          value={x2}
          min={0}
          max={1}
          step={0.01}
          disabled={disabled}
          onValue={(v) => set(2, v, "curve-x2")}
        />
        <Field
          id="cv-y2"
          label="Curve y2"
          short="y2"
          value={y2}
          min={-1}
          max={2}
          step={0.01}
          disabled={disabled}
          onValue={(v) => set(3, v, "curve-y2")}
        />
      </div>
      <div className="ui-video-curve-influence" role="group" aria-label="Influence, as in After Effects">
        <Field
          id="cv-out"
          label="Ease out of the first key, influence in per cent"
          short="Ease out"
          named
          value={inf.out}
          unit="%"
          min={0}
          max={100}
          disabled={disabled}
          onValue={(v) => onCurve(fromInfluence(v, inf.in), "curve-out")}
        />
        <Field
          id="cv-in"
          label="Ease into the next key, influence in per cent"
          short="Ease into"
          named
          value={inf.in}
          unit="%"
          min={0}
          max={100}
          disabled={disabled}
          onValue={(v) => onCurve(fromInfluence(inf.out, v), "curve-in")}
        />
      </div>
      <div className="ui-video-curve-try">
        <span className="ui-video-curve-track" aria-hidden="true">
          <span className="ui-video-curve-dot" data-go={go ? "" : undefined} />
        </span>
        <Button size="sm" variant="quiet" icon="play" onClick={() => setGo((g) => !g)}>
          Try it
        </Button>
      </div>
      <p className="ui-video-help">
        {overshoots(curve)
          ? `This curve goes past its mark and back: a bounce. ${brandName}’s motion never bounces, so keep it only if you mean it.`
          : named
            ? `${EASES[named].line}. From ${brandName}’s motion.`
            : "Your own curve. The keys and the way in and out follow it."}
      </p>
    </div>
  );
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
