// Chart: area, line, bar (stacked, grouped, rows), donut and sparkline, design-system/components/chart.css, ported from
// chart.js to React: the same inline SVG, classes and attributes. As in shadcn's ChartStyle each series colour becomes
// --color-<key> on the container and every mark takes its colour from --c.
// Colour: series come from Ink and the Focus ramp in a fixed order (--ui-chart-series-1..4). Amber
// (--ui-chart-approved, or `approved: true` on a series) is ONLY for a series that counts checked work.
// Behaviour: legend pills toggle series (one always stays on; the scale never moves). Pointer, touch (press and drag)
// and keyboard (focus the plot, arrows, Home, End, Escape) move through the points: a soft band marks the point and the
// Smoke glass tooltip shows every series; a live region says it in words; a hidden table holds every value. On first
// draw lines draw in, bars grow and the donut sweeps round; stacked and grouped morph (CSS transitions on d); reduced
// motion draws at once. States: loading (skeleton in the chart's size), empty and error (an Empty in its place).
import {
  forwardRef,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../icons";
import { cssVars, mergeRefs, prefersReducedMotion } from "./internal";

/* ============================== types ============================== */

export type ChartType = "area" | "line" | "bar" | "donut" | "spark";

export interface ChartSeries {
  label: string;
  /** A CSS colour from the chart tokens; defaults to --ui-chart-series-<n> in order. */
  color?: string;
  /** This series counts checked work: full Amber (--ui-chart-approved). Never for anything else. */
  approved?: boolean;
}
export type ChartConfig = Record<string, ChartSeries>;
export type ChartDatum = Record<string, string | number>;

export interface ChartProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  type: ChartType;
  /** The chart's name (the SVG's title and the plot's label). */
  title: string;
  /** Joined to the title in the hidden table's caption. */
  description?: string;
  /** The SVG's desc; written from the data when left out. */
  summary?: string;
  /** Series by key (area, line, bar, spark), or the donut's slices by name. */
  config: ChartConfig;
  /** Rows; a sparkline may take plain numbers. */
  data: ChartDatum[] | number[];
  /** The x value of a row (week, campaign). */
  xKey?: string;
  /** x values are ISO dates: "week" (a week from that day) or "date". */
  xFormat?: "week" | "date";
  /** Column heads in the hidden table. */
  xLabel?: string;
  valueLabel?: string;
  /** What one point is called ("week", "campaign"), for the words. */
  point?: string;
  /** A unit after every value ("%"). */
  unit?: string;
  /** "minutes": 220 reads "3 h 40 min". */
  format?: "minutes";
  /** A fixed top of the scale (100 for a rate). */
  max?: number;
  /** Sparkline: the bottom of its range (default its lowest value). */
  min?: number;
  /** Lines: false drops the last values beside the points. */
  endLabels?: boolean;
  /** Pill toggles above the plot (area, line, bar). */
  legend?: boolean;
  /** Controls at the far end of the legend's row (a view switch); needs `legend`. */
  toolbar?: ReactNode;
  /** Bars: stacked (totals on top, no ticks) or grouped (round ticks). */
  stack?: boolean;
  /** Bars: "auto" turns columns into rows when the names no longer fit. */
  orientation?: "auto" | "vertical" | "horizontal";
  /** Rows: a sunken track to `max` behind each bar (a ranking of rates). */
  track?: boolean;
  /** Donut: the row's name key and value key. */
  nameKey?: string;
  dataKey?: string;
  /** Donut: the words under the total ("creatives"); default "in all". */
  centerLabel?: string;
  /** In a card stretched to its row, the plot takes the height left over (.ui-chart--fill). */
  fill?: boolean;
  state?: "loading" | "empty" | "error";
  emptyTitle?: string;
  emptyDescription?: string;
  /** Empty: a primary button with these words ("Write a brief"). */
  emptyAction?: string;
  onEmptyAction?: () => void;
  errorTitle?: string;
  errorDescription?: string;
  /** Error: "Try again". */
  retryLabel?: string;
  onRetry?: () => void;
  /** Keeps one point open (a frozen tooltip). */
  active?: number;
  onActiveChange?: (index: number) => void;
  onSeriesToggle?: (key: string, on: boolean) => void;
  /** "reduce": draws at once. */
  motion?: "reduce";
}

/* ============================== helpers ============================== */

const NS_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const NS_MONTH = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const nf = new Intl.NumberFormat("en-GB");
const SVGNS = "http://www.w3.org/2000/svg";

const f = (n: number) => Math.round(n * 100) / 100;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const amax = (a: number[]) => a.reduce((x, y) => Math.max(x, y), 0);
const day = (v: string | number) => {
  const p = String(v).split("-");
  return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] || 1));
};
const cssVal = (node: Element, name: string) => getComputedStyle(node).getPropertyValue(name).trim();
const cssPx = (node: Element, name: string, fb: number) => {
  const n = parseFloat(cssVal(node, name));
  return isFinite(n) ? n : fb;
};
const cssMs = (node: Element, name: string, fb: number) => {
  const v = cssVal(node, name);
  const n = parseFloat(v);
  return !isFinite(n) ? fb : /ms$/.test(v) ? n : /s$/.test(v) ? n * 1000 : n;
};
let ctx2d: CanvasRenderingContext2D | null = null;
const measure = (text: string, font: string) => {
  if (!ctx2d) ctx2d = document.createElement("canvas").getContext("2d");
  if (!ctx2d) return String(text).length * 7;
  ctx2d.font = font;
  return ctx2d.measureText(String(text)).width;
};
const fontOf = (svg: SVGSVGElement, cls: string) => {
  const p = document.createElementNS(SVGNS, "text");
  p.setAttribute("class", cls);
  svg.appendChild(p);
  const cs = getComputedStyle(p);
  const font = cs.fontStyle + " " + cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
  p.remove();
  return font;
};

// round ticks from zero, in steps of 1, 2, 2.5 or 5 x 10^n (as chart.js)
const before = (a: number[], b: number[]) => {
  for (let j = 0; j < a.length; j++) if (a[j] !== b[j]) return a[j] < b[j];
  return false;
};
function nice(top: number, most: number): { max: number; ticks: number[] } {
  if (!(top > 0)) return { max: 1, ticks: [0, 1] };
  most = Math.max(2, Math.floor(most) || 2);
  let best: { step: number; n: number; score: number[] } | null = null;
  const e0 = Math.floor(Math.log10(top / most)) - 1;
  for (let e = e0; e <= e0 + 3; e++)
    for (const k of [1, 2, 2.5, 5]) {
      if (k === 2.5 && e < 1) continue;
      const step = k * Math.pow(10, e);
      const n = Math.ceil(top / step - 1e-9);
      if (n < 2 || n > most) continue;
      const score = [n < 3 ? 1 : 0, n * step, n];
      if (!best || before(score, best.score)) best = { step, n, score };
    }
  if (!best) {
    const step = Math.pow(10, Math.ceil(Math.log10(top)));
    best = { step, n: 1, score: [] };
  }
  const ticks: number[] = [];
  for (let i = 0; i <= best.n; i++) ticks.push(Math.round(i * best.step * 1e6) / 1e6);
  return { max: best.n * best.step, ticks };
}
const room = (span: number) => clamp(Math.floor(span / 36), 2, 5);

// a monotone curve through the points (d3 curveMonotoneX)
function monotone(p: Array<[number, number]>): string {
  const n = p.length;
  if (!n) return "";
  if (n < 3) return "M" + p.map((q) => f(q[0]) + "," + f(q[1])).join("L");
  const dx: number[] = [],
    m: number[] = [],
    t: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = p[i + 1][0] - p[i][0];
    m[i] = dx[i] ? (p[i + 1][1] - p[i][1]) / dx[i] : 0;
  }
  for (let i = 1; i < n - 1; i++) {
    const pm = (m[i - 1] * dx[i] + m[i] * dx[i - 1]) / (dx[i - 1] + dx[i]);
    t[i] =
      (Math.sign(m[i - 1]) + Math.sign(m[i])) * Math.min(Math.abs(m[i - 1]), Math.abs(m[i]), 0.5 * Math.abs(pm)) || 0;
  }
  t[0] = (3 * m[0] - t[1]) / 2;
  t[n - 1] = (3 * m[n - 2] - t[n - 2]) / 2;
  let d = "M" + f(p[0][0]) + "," + f(p[0][1]);
  for (let i = 0; i < n - 1; i++) {
    const k = dx[i] / 3;
    d +=
      "C" +
      f(p[i][0] + k) +
      "," +
      f(p[i][1] + k * t[i]) +
      "," +
      f(p[i + 1][0] - k) +
      "," +
      f(p[i + 1][1] - k * t[i + 1]) +
      "," +
      f(p[i + 1][0]) +
      "," +
      f(p[i + 1][1]);
  }
  return d;
}
// bars: the data end rounded, the baseline end square; same commands at any size, so CSS can morph d
function barUp(x: number, y: number, w: number, hh: number, r: number) {
  r = Math.max(0, Math.min(r, w / 2, hh));
  const b = y + hh,
    x1 = x + w;
  return (
    "M" +
    f(x) +
    "," +
    f(b) +
    "V" +
    f(y + r) +
    "A" +
    f(r) +
    "," +
    f(r) +
    " 0 0 1 " +
    f(x + r) +
    "," +
    f(y) +
    "H" +
    f(x1 - r) +
    "A" +
    f(r) +
    "," +
    f(r) +
    " 0 0 1 " +
    f(x1) +
    "," +
    f(y + r) +
    "V" +
    f(b) +
    "Z"
  );
}
function barRight(x: number, y: number, w: number, hh: number, r: number, r0 = 0) {
  r = Math.max(0, Math.min(r, hh / 2, w));
  r0 = Math.max(0, Math.min(r0, hh / 2, w));
  const x1 = x + w,
    y1 = y + hh;
  return (
    "M" +
    f(x + r0) +
    "," +
    f(y) +
    "H" +
    f(x1 - r) +
    "A" +
    f(r) +
    "," +
    f(r) +
    " 0 0 1 " +
    f(x1) +
    "," +
    f(y + r) +
    "V" +
    f(y1 - r) +
    "A" +
    f(r) +
    "," +
    f(r) +
    " 0 0 1 " +
    f(x1 - r) +
    "," +
    f(y1) +
    "H" +
    f(x + r0) +
    "A" +
    f(r0) +
    "," +
    f(r0) +
    " 0 0 1 " +
    f(x) +
    "," +
    f(y1 - r0) +
    "V" +
    f(y + r0) +
    "A" +
    f(r0) +
    "," +
    f(r0) +
    " 0 0 1 " +
    f(x + r0) +
    "," +
    f(y) +
    "Z"
  );
}
function wrap(name: string, font: string, space: number): string[] {
  if (measure(name, font) <= space) return [name];
  const w = name.split(" ");
  if (w.length < 2) return [name];
  let best: { m: number; lines: string[] } | null = null;
  for (let i = 1; i < w.length; i++) {
    const a = w.slice(0, i).join(" "),
      b = w.slice(i).join(" ");
    const m = Math.max(measure(a, font), measure(b, font));
    if (!best || m < best.m) best = { m, lines: [a, b] };
  }
  return best ? best.lines : [name];
}
// percentages that add up to 100 (largest remainder)
function shares(vals: number[]): number[] {
  const tot = sum(vals) || 1;
  const raw = vals.map((v) => (v / tot) * 100);
  const out = raw.map(Math.floor);
  let left = 100 - sum(out);
  raw
    .map((r, i) => [r - Math.floor(r), i] as [number, number])
    .sort((a, b) => b[0] - a[0])
    .forEach(([, i]) => {
      if (left > 0) {
        out[i]++;
        left--;
      }
    });
  return out;
}

/* ============================== words ============================== */

interface Cfg {
  type: ChartType;
  title: string;
  description?: string;
  summary?: string;
  config: ChartConfig;
  data: ChartDatum[] | number[];
  xKey: string;
  xFormat?: "week" | "date";
  xLabel?: string;
  valueLabel?: string;
  point?: string;
  unit?: string;
  format?: "minutes";
  max?: number;
  min?: number;
  endLabels?: boolean;
  stack: boolean;
  orientation: "auto" | "vertical" | "horizontal";
  track: boolean;
  nameKey: string;
  dataKey: string;
  centerLabel?: string;
}

const rows = (cfg: Cfg) => cfg.data as ChartDatum[];
const raw = (r: ChartDatum | number, k: string) => (typeof r === "number" ? r : +r[k]);
const num = (r: ChartDatum | number, k: string) => raw(r, k) || 0;
const labelOf = (cfg: Cfg, k: string | number) => (cfg.config[String(k)] && cfg.config[String(k)].label) || String(k);

function fmtV(cfg: Cfg, v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "–";
  if (cfg.format === "minutes") {
    const hh = Math.floor(v / 60),
      mm = Math.round(v % 60);
    return (hh ? hh + " h " : "") + mm + " min";
  }
  return nf.format(v) + (cfg.unit || "");
}
function fmtX(cfg: Cfg, v: string | number, mode: "tick" | "head" | "spoken"): string {
  if (cfg.xFormat === "week" || cfg.xFormat === "date") {
    const a = day(v);
    if (mode === "spoken")
      return (cfg.xFormat === "week" ? "Week of " : "") + a.getUTCDate() + " " + NS_MONTH[a.getUTCMonth()];
    if (cfg.xFormat === "date" || mode === "tick") return a.getUTCDate() + " " + NS_MON[a.getUTCMonth()];
    const b = new Date(a.getTime() + 6 * 864e5);
    return a.getUTCMonth() === b.getUTCMonth()
      ? a.getUTCDate() + "–" + b.getUTCDate() + " " + NS_MON[b.getUTCMonth()]
      : a.getUTCDate() + " " + NS_MON[a.getUTCMonth()] + " – " + b.getUTCDate() + " " + NS_MON[b.getUTCMonth()];
  }
  return String(v);
}
const lower1 = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

function summaryOf(cfg: Cfg, keys: string[]): string {
  const d = cfg.data;
  if (cfg.summary) return cfg.summary;
  if (!d.length) return "";
  if (cfg.type === "donut") {
    const r = rows(cfg);
    const vals = r.map((x) => num(x, cfg.dataKey)),
      sh = shares(vals);
    return (
      r.map((x, i) => labelOf(cfg, x[cfg.nameKey]) + " " + nf.format(vals[i]) + " (" + sh[i] + "%)").join(", ") +
      "; " +
      nf.format(sum(vals)) +
      " in all."
    );
  }
  if (cfg.type === "bar") {
    const r = rows(cfg);
    const tot = r.map((x) => sum(keys.map((k) => num(x, k))));
    const i = tot.indexOf(amax(tot));
    return r.length + " " + (cfg.point || "item") + "s. Highest: " + r[i][cfg.xKey] + ", " + fmtV(cfg, tot[i]) + ".";
  }
  const vals = (k: string) => (d as Array<ChartDatum | number>).map((x) => raw(x, k));
  const first = d[0],
    last = d[d.length - 1];
  return (
    keys
      .map((k) => labelOf(cfg, k) + " from " + fmtV(cfg, vals(k)[0]) + " to " + fmtV(cfg, vals(k)[d.length - 1]))
      .join("; ") +
    (cfg.xKey && typeof first !== "number" && typeof last !== "number"
      ? ", from the " +
        lower1(fmtX(cfg, first[cfg.xKey], "spoken")) +
        " to the " +
        lower1(fmtX(cfg, last[cfg.xKey], "spoken"))
      : "") +
    "."
  );
}
function spokenOf(cfg: Cfg, keys: string[], hidden: Record<string, boolean>, i: number): string {
  const r = rows(cfg)[i];
  if (!r) return "";
  if (cfg.type === "donut") {
    const vals = rows(cfg).map((x) => num(x, cfg.dataKey));
    return labelOf(cfg, r[cfg.nameKey]) + ": " + fmtV(cfg, vals[i]) + ", " + shares(vals)[i] + "%.";
  }
  const vis = keys.filter((k) => !hidden[k]);
  let t =
    fmtX(cfg, r[cfg.xKey], "spoken") + ": " + vis.map((k) => labelOf(cfg, k) + " " + fmtV(cfg, raw(r, k))).join(", ");
  if (cfg.stack && vis.length > 1) t += ", total " + fmtV(cfg, sum(vis.map((k) => num(r, k))));
  return t + ".";
}

/* ============================== layout ============================== */

type ChartNode =
  | {
      t: "text";
      key: string;
      cls: string;
      x: number;
      y: number;
      str: string;
      anchor?: "start" | "middle" | "end";
      series?: string;
      style?: CSSProperties;
    }
  | {
      t: "path";
      key: string;
      cls: string;
      d: string;
      series?: string;
      pathLength?: string;
      style?: CSSProperties;
      index?: number;
    }
  | { t: "circle"; key: string; cls: string; cx: number; cy: number; r: number; series?: string; style?: CSSProperties }
  | { t: "line"; key: string; cls: string; x1: number; x2: number; y1: number; y2: number }
  | { t: "g"; key: string; cls?: string; hidden?: boolean; style?: CSSProperties; children: ChartNode[] };

interface Metrics {
  gap: number;
  point: number;
  ring: number;
  barMax: number;
  barGrouped: number;
  barRow: number;
  radius: number;
  rowGap: number;
  line: number;
}

interface Geo {
  kind: "xy" | "cols" | "rows" | "donut" | "spark";
  n: number;
  X?: (i: number) => number;
  Y?: (v: number) => number;
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  step?: number;
  slot?: number;
  W?: number;
  cx?: (i: number) => number;
  marks?: (i: number) => [number, number];
  topOf?: (i: number) => number;
  rowH?: number;
  R?: number;
  ring?: number;
  center?: number;
  arcs?: Array<[number, number]>;
}

interface Model {
  nodes: ChartNode[];
  geo: Geo;
  rows?: boolean;
  frameHeight?: number;
}

interface LayoutIn {
  cfg: Cfg;
  keys: string[];
  hidden: Record<string, boolean>;
  W: number;
  H: number;
  elW: number;
  M: Metrics;
  fontData: string;
  fontName: string;
  donutRing: number;
}

const tint = (k: string): CSSProperties => cssVars({ "--c": `var(--color-${k})` });
const dPath = (d: string): CSSProperties => ({ d: `path("${d}")` }) as unknown as CSSProperties;
const visibleKeys = (keys: string[], hidden: Record<string, boolean>) => keys.filter((k) => !hidden[k]);

function layoutXY(I: LayoutIn): Model {
  const { cfg, keys, hidden, W, H, M, fontData: font } = I;
  const d = rows(cfg),
    n = d.length;
  const top = Math.max(M.line / 2, M.point / 2 + M.ring),
    bottom = H - M.line - M.gap;
  const sc = nice(cfg.max || amax(d.map((r) => amax(keys.map((k) => num(r, k))))), room(bottom - top));
  const left = Math.ceil(amax(sc.ticks.map((t) => measure(fmtV(cfg, t), font))) + M.gap);
  const endW = cfg.endLabels === false ? 0 : amax(keys.map((k) => measure(fmtV(cfg, raw(d[n - 1], k)), font)));
  const right = endW ? Math.ceil(M.point / 2 + M.ring + M.gap + endW) : M.point / 2 + M.ring;
  const plotW = Math.max(16, W - left - right),
    step = n > 1 ? plotW / (n - 1) : plotW;
  const X = (i: number) => left + (n > 1 ? i * step : plotW / 2);
  const Y = (v: number) => top + (1 - v / sc.max) * (bottom - top);
  const marks = (i: number): [number, number] => {
    const ys = visibleKeys(keys, hidden).map((k) => Y(num(d[i], k)));
    return [Math.min(...ys), Math.max(...ys)];
  };
  const ticks: ChartNode[] = sc.ticks.map((t) => ({
    t: "text",
    key: "tick" + t,
    cls: "ui-chart-data",
    x: left - M.gap,
    y: Y(t),
    str: fmtV(cfg, t),
    anchor: "end",
  }));
  const labels = d.map((r) => fmtX(cfg, r[cfg.xKey], "tick"));
  const lw = amax(labels.map((l) => measure(l, font)));
  const every = [1, 2, 3, 4, 6, 12].find((k) => k * step >= lw + M.gap * 2 && Math.ceil(n / k) <= 7) || n;
  for (let i = n - 1; i >= 0; i -= every) {
    const w = measure(labels[i], font);
    ticks.push({
      t: "text",
      key: "x" + i,
      cls: "ui-chart-data",
      x: clamp(X(i), w / 2, W - w / 2),
      y: bottom + M.gap + M.line / 2,
      str: labels[i],
      anchor: "middle",
    });
  }
  const areas: ChartNode[] = [],
    lines: ChartNode[] = [],
    points: ChartNode[] = [];
  const ends: Array<{ k: string; y: number; v: number; off: string }> = [];
  keys.forEach((k) => {
    const pts = d.map((r, i) => [X(i), Y(num(r, k))] as [number, number]);
    const line = monotone(pts),
      off = hidden[k] ? " is-off" : "";
    if (cfg.type === "area")
      areas.push({
        t: "path",
        key: "a" + k,
        cls: "ui-chart-area" + off,
        d: line + "L" + f(X(n - 1)) + "," + f(Y(0)) + "L" + f(X(0)) + "," + f(Y(0)) + "Z",
        series: k,
        style: tint(k),
      });
    lines.push({
      t: "path",
      key: "l" + k,
      cls: "ui-chart-line" + off,
      d: line,
      pathLength: "1",
      series: k,
      style: tint(k),
    });
    ends.push({ k, y: pts[n - 1][1], v: raw(d[n - 1], k), off });
  });
  let last = -Infinity;
  ends
    .sort((a, b) => a.y - b.y)
    .forEach((e) => {
      points.push({
        t: "circle",
        key: "p" + e.k,
        cls: "ui-chart-dot" + e.off,
        cx: X(n - 1),
        cy: e.y,
        r: M.point / 2 + M.ring / 2,
        series: e.k,
      });
      if (endW && e.y - last >= M.line) {
        points.push({
          t: "text",
          key: "e" + e.k,
          cls: "ui-chart-data ui-chart-data--label" + e.off,
          x: X(n - 1) + M.point / 2 + M.ring + M.gap,
          y: e.y,
          str: fmtV(cfg, e.v),
          series: e.k,
          style: tint(e.k),
        });
        last = e.y;
      }
    });
  // circles take their colour too
  points.forEach((p) => {
    if (p.t === "circle" && p.series) p.style = tint(p.series);
  });
  return {
    nodes: [
      { t: "g", key: "ticks", hidden: true, children: ticks },
      { t: "g", key: "areas", children: areas },
      { t: "g", key: "lines", children: lines },
      { t: "g", key: "points", children: points },
    ],
    geo: { kind: "xy", n, X, Y, top, bottom, left, right: left + plotW, step, W, cx: X, marks },
  };
}

function scaleTop(cfg: Cfg, keys: string[]) {
  const d = rows(cfg);
  if (cfg.max) return cfg.max;
  return cfg.stack
    ? amax(d.map((r) => sum(keys.map((k) => num(r, k)))))
    : amax(d.map((r) => amax(keys.map((k) => num(r, k)))));
}

function layoutColumns(I: LayoutIn): Model {
  const { cfg, keys, hidden, W, H, M, fontData: font, fontName } = I;
  const d = rows(cfg),
    n = d.length,
    stack = cfg.stack;
  const sc = stack
    ? { max: scaleTop(cfg, keys), ticks: [] as number[] }
    : nice(scaleTop(cfg, keys), room(H - M.line * 3));
  const left = stack ? 0 : Math.ceil(amax(sc.ticks.map((t) => measure(fmtV(cfg, t), font))) + M.gap);
  const slot = (W - left) / n;
  const names = d.map((r) => wrap(String(r[cfg.xKey]), fontName, slot - M.gap * 2));
  const lineCount = amax(names.map((l) => l.length));
  const bottom = Math.round(H - lineCount * M.line - M.gap),
    top = stack ? M.line + M.gap : M.line / 2;
  const scMax = sc.max || 1;
  const Y = (v: number) => bottom - (v / scMax) * (bottom - top);
  const vis = visibleKeys(keys, hidden),
    m = vis.length;
  const bw = stack
    ? Math.min(M.barMax, slot * 0.5)
    : Math.min(M.barGrouped, (slot * 0.72 - M.ring * (m - 1)) / Math.max(m, 1));
  const tops = d.map((r) => Y(stack ? sum(vis.map((k) => num(r, k))) : amax(vis.map((k) => num(r, k)))));
  const ticks: ChartNode[] = [];
  if (!stack)
    sc.ticks.forEach((t) =>
      ticks.push({
        t: "text",
        key: "tick" + t,
        cls: "ui-chart-data",
        x: left - M.gap,
        y: Y(t),
        str: fmtV(cfg, t),
        anchor: "end",
      }),
    );
  names.forEach((l, i) =>
    l.forEach((line, j) =>
      ticks.push({
        t: "text",
        key: "n" + i + "-" + j,
        cls: "ui-chart-name",
        x: left + slot * (i + 0.5),
        y: bottom + M.gap + M.line * (j + 0.5),
        str: line,
        anchor: "middle",
      }),
    ),
  );
  const groups: ChartNode[] = [],
    totals: ChartNode[] = [];
  d.forEach((r, i) => {
    const cx = left + slot * (i + 0.5);
    const bars: ChartNode[] = [];
    let acc = 0;
    if (stack) {
      const live = vis.filter((k) => num(r, k) > 0),
        topKey = live[live.length - 1];
      keys.forEach((k) => {
        const v = hidden[k] ? 0 : num(r, k),
          y1 = Y(acc),
          y0 = Y(acc + v),
          isTop = k === topKey,
          cut = v && !isTop ? M.ring : 0;
        acc += v;
        const dd = barUp(cx - bw / 2, y0 + cut, bw, Math.max(0, y1 - y0 - cut), isTop ? M.radius : 0);
        bars.push({
          t: "path",
          key: i + "|" + k,
          cls: "ui-chart-bar" + (v ? "" : " is-off"),
          d: dd,
          series: k,
          style: { ...tint(k), ...dPath(dd) },
        });
      });
    } else {
      const gw = m * bw + (m - 1) * M.ring;
      let j = 0;
      keys.forEach((k) => {
        const hid = !!hidden[k],
          v = hid ? 0 : num(r, k),
          x = hid ? cx - bw / 2 : cx - gw / 2 + j++ * (bw + M.ring),
          hh = bottom - Y(v);
        acc += v;
        const dd = barUp(x, bottom - hh, bw, hh, M.radius);
        bars.push({
          t: "path",
          key: i + "|" + k,
          cls: "ui-chart-bar" + (v ? "" : " is-off"),
          d: dd,
          series: k,
          style: { ...tint(k), ...dPath(dd) },
        });
      });
    }
    groups.push({ t: "g", key: "c" + i, cls: "ui-chart-grow", style: cssVars({ "--i": i }), children: bars });
    totals.push({
      t: "text",
      key: "total|" + i,
      cls: "ui-chart-data ui-chart-data--label ui-chart-data--total" + (stack ? "" : " is-off"),
      x: 0,
      y: 0,
      str: fmtV(cfg, acc),
      anchor: "middle",
      style: { transform: `translate(${f(cx)}px, ${f(Y(acc) - M.gap - M.line / 2)}px)` },
    });
  });
  return {
    nodes: [
      { t: "g", key: "ticks", hidden: true, children: ticks },
      { t: "line", key: "base", cls: "ui-chart-baseline", x1: left, x2: W, y1: bottom + 0.5, y2: bottom + 0.5 },
      { t: "g", key: "bars", children: groups },
      { t: "g", key: "totals", children: totals },
    ],
    geo: {
      kind: "cols",
      n,
      left,
      slot,
      top,
      bottom,
      W,
      cx: (i) => left + slot * (i + 0.5),
      step: slot,
      marks: (i) => [tops[i], bottom],
    },
  };
}

function layoutRows(I: LayoutIn): Model {
  const { cfg, keys, hidden, W, M } = I;
  const d = rows(cfg),
    n = d.length,
    stack = cfg.stack,
    vis = visibleKeys(keys, hidden),
    m = vis.length;
  const single = keys.length === 1,
    grouped = !stack && !single;
  const subH = Math.round((M.barRow * 2) / 3),
    barH = grouped ? m * subH + (m - 1) * M.ring : M.barRow;
  const rowH = M.line + M.gap + barH,
    band = grouped ? M.line + M.gap : 0;
  const H = n * rowH + (n - 1) * M.rowGap + band;
  const x0 = M.gap,
    x1 = W - M.gap;
  const sc = grouped ? nice(scaleTop(cfg, keys), 3) : { max: scaleTop(cfg, keys), ticks: [] as number[] };
  const scMax = sc.max || 1;
  const X = (v: number) => x0 + (v / scMax) * (x1 - x0);
  const topOf = (i: number) => i * (rowH + M.rowGap);
  const texts: ChartNode[] = [],
    tracks: ChartNode[] = [],
    groups: ChartNode[] = [];
  d.forEach((r, i) => {
    const y = topOf(i),
      by = y + M.line + M.gap;
    texts.push({
      t: "text",
      key: "n" + i,
      cls: "ui-chart-name ui-chart-name--strong",
      x: x0,
      y: y + M.line / 2,
      str: String(r[cfg.xKey]),
      anchor: "start",
    });
    if (cfg.track)
      tracks.push({
        t: "path",
        key: "tr" + i,
        cls: "ui-chart-track",
        d: barRight(x0, by, x1 - x0, barH, barH / 2, barH / 2),
      });
    const bars: ChartNode[] = [];
    let acc = 0;
    if (grouped) {
      let j = 0;
      keys.forEach((k) => {
        const hid = !!hidden[k],
          v = hid ? 0 : num(r, k),
          yy = hid ? by : by + j++ * (subH + M.ring);
        acc += v;
        const dd = barRight(x0, yy, X(v) - x0, hid ? 0 : subH, M.radius);
        bars.push({
          t: "path",
          key: i + "|" + k,
          cls: "ui-chart-bar" + (v ? "" : " is-off"),
          d: dd,
          series: k,
          style: { ...tint(k), ...dPath(dd) },
        });
      });
    } else {
      const live = vis.filter((k) => num(r, k) > 0),
        lastKey = live[live.length - 1];
      keys.forEach((k) => {
        const v = hidden[k] ? 0 : num(r, k),
          xa = X(acc),
          xb = X(acc + v),
          isLast = k === lastKey,
          cut = v && !isLast ? M.ring : 0;
        acc += v;
        const rr = cfg.track ? barH / 2 : isLast ? M.radius : 0;
        const dd = barRight(xa, by, Math.max(0, xb - xa - cut), barH, rr, cfg.track ? rr : 0);
        bars.push({
          t: "path",
          key: i + "|" + k,
          cls: "ui-chart-bar" + (v ? "" : " is-off"),
          d: dd,
          series: k,
          style: { ...tint(k), ...dPath(dd) },
        });
      });
    }
    groups.push({
      t: "g",
      key: "r" + i,
      cls: "ui-chart-grow ui-chart-grow--x",
      style: cssVars({ "--i": i }),
      children: bars,
    });
    texts.push({
      t: "text",
      key: "total|" + i,
      cls: "ui-chart-data ui-chart-data--label ui-chart-data--total" + (grouped ? " is-off" : ""),
      x: 0,
      y: 0,
      str: fmtV(cfg, acc),
      anchor: "end",
      style: { transform: `translate(${f(x1)}px, ${f(y + M.line / 2)}px)` },
    });
  });
  if (grouped)
    sc.ticks.forEach((t, i) =>
      texts.push({
        t: "text",
        key: "tick" + t,
        cls: "ui-chart-data",
        x: X(t),
        y: H - M.line / 2,
        str: fmtV(cfg, t),
        anchor: i === 0 ? "start" : i === sc.ticks.length - 1 ? "end" : "middle",
      }),
    );
  return {
    nodes: [
      { t: "g", key: "texts", hidden: true, children: texts },
      { t: "g", key: "bars", children: [...tracks, ...groups] },
    ],
    geo: { kind: "rows", n, topOf, rowH, W },
    rows: true,
    frameHeight: H,
  };
}

function layoutDonut(I: LayoutIn): Model {
  const { cfg, W, M, donutRing: ring } = I;
  const d = rows(cfg);
  const size = W,
    R = size / 2 - ring / 2,
    cx = size / 2;
  const vals = d.map((r) => num(r, cfg.dataKey)),
    tot = sum(vals) || 1,
    gapA = M.ring / R;
  let a = -Math.PI / 2,
    acc = 0;
  const arcs: Array<[number, number]> = [];
  const nodes: ChartNode[] = [];
  d.forEach((r, i) => {
    const fr = vals[i] / tot,
      a0 = a,
      a1 = a + fr * Math.PI * 2;
    a = a1;
    arcs.push([a0, a1]);
    const s0 = a0 + gapA / 2,
      s1 = a1 - gapA / 2;
    if (s1 <= s0) {
      acc += fr;
      return;
    }
    const p = (t: number) => f(cx + R * Math.cos(t)) + "," + f(cx + R * Math.sin(t));
    nodes.push({
      t: "path",
      key: "arc" + i,
      cls: "ui-chart-arc",
      d: "M" + p(s0) + "A" + f(R) + "," + f(R) + " 0 " + (s1 - s0 > Math.PI ? 1 : 0) + " 1 " + p(s1),
      pathLength: "1",
      index: i,
      style: { ...tint(String(r[cfg.nameKey])), ...cssVars({ "--d": f(acc), "--f": f(fr) }) },
    });
    acc += fr;
  });
  return {
    nodes: [{ t: "g", key: "arcs", children: nodes }],
    geo: { kind: "donut", n: d.length, center: cx, R, ring, arcs },
  };
}

function layoutSpark(I: LayoutIn): Model {
  const { cfg, keys, W, H, M } = I;
  const d = cfg.data as Array<ChartDatum | number>,
    n = d.length,
    k = keys[0] || "value";
  const vals = d.map((r) => (typeof r === "number" ? r : num(r, cfg.dataKey || k)));
  const pad = M.point / 2 + M.ring;
  const lo = cfg.min != null ? cfg.min : Math.min(...vals),
    hi = Math.max(...vals),
    span = hi - lo || 1;
  const X = (i: number) => pad + (n > 1 ? (i * (W - 2 * pad)) / (n - 1) : (W - 2 * pad) / 2);
  const Y = (v: number) => pad + (1 - (v - lo) / span) * (H - 2 * pad);
  const line = monotone(vals.map((v, i) => [X(i), Y(v)] as [number, number]));
  return {
    nodes: [
      {
        t: "path",
        key: "a",
        cls: "ui-chart-area",
        d: line + "L" + f(X(n - 1)) + "," + H + "L" + f(X(0)) + "," + H + "Z",
        style: tint(k),
      },
      { t: "path", key: "l", cls: "ui-chart-line", d: line, pathLength: "1", style: tint(k) },
      {
        t: "circle",
        key: "p",
        cls: "ui-chart-dot",
        cx: X(n - 1),
        cy: Y(vals[n - 1]),
        r: M.point / 2 + M.ring / 2 - 1,
        series: k,
      },
    ],
    geo: { kind: "spark", n },
  };
}

function layout(I: LayoutIn): { model: Model; rowsMode: boolean } {
  const { cfg, M } = I;
  if (cfg.type === "area" || cfg.type === "line") return { model: layoutXY(I), rowsMode: false };
  if (cfg.type === "donut") return { model: layoutDonut(I), rowsMode: false };
  if (cfg.type === "spark") return { model: layoutSpark(I), rowsMode: false };
  const d = rows(cfg),
    n = d.length;
  let orient = cfg.orientation;
  if (orient === "auto") {
    const slot0 = I.elW / Math.max(n, 1);
    const fits =
      slot0 >= 56 &&
      d.every((r) => {
        const l = wrap(String(r[cfg.xKey]), I.fontName, slot0 - M.gap * 2);
        return l.length <= 2 && l.every((x) => measure(x, I.fontName) <= slot0 - M.gap * 2);
      });
    orient = fits ? "vertical" : "horizontal";
  }
  return orient === "horizontal"
    ? { model: layoutRows(I), rowsMode: true }
    : { model: layoutColumns(I), rowsMode: false };
}

function readMetrics(el: Element): Metrics {
  return {
    gap: cssPx(el, "--ui-chart-tick-gap", 8),
    point: cssPx(el, "--ui-chart-point", 8),
    ring: cssPx(el, "--ui-chart-gap", 2),
    barMax: cssPx(el, "--ui-chart-bar-max", 24),
    barGrouped: cssPx(el, "--ui-chart-bar-grouped", 16),
    barRow: cssPx(el, "--ui-chart-bar-row", 12),
    radius: cssPx(el, "--ui-chart-bar-radius", 4),
    rowGap: cssPx(el, "--ui-space-xl", 24),
    line: 16,
  };
}

/* ============================== rendering ============================== */

function renderNode(n: ChartNode, dimExcept: number): ReactNode {
  switch (n.t) {
    case "g":
      return (
        <g key={n.key} className={n.cls} aria-hidden={n.hidden ? true : undefined} style={n.style}>
          {n.children.map((c) => renderNode(c, dimExcept))}
        </g>
      );
    case "text":
      return (
        <text
          key={n.key}
          className={n.cls}
          x={f(n.x)}
          y={f(n.y)}
          textAnchor={n.anchor ?? "start"}
          dominantBaseline="central"
          data-series={n.series}
          style={n.style}
        >
          {n.str}
        </text>
      );
    case "path":
      return (
        <path
          key={n.key}
          className={n.cls + (dimExcept >= 0 && n.index !== undefined && n.index !== dimExcept ? " is-dim" : "")}
          d={n.d}
          pathLength={n.pathLength}
          data-series={n.series}
          data-index={n.index}
          style={n.style}
        />
      );
    case "circle":
      return (
        <circle
          key={n.key}
          className={n.cls}
          cx={f(n.cx)}
          cy={f(n.cy)}
          r={f(n.r)}
          data-series={n.series}
          style={n.style ?? (n.series ? tint(n.series) : undefined)}
        />
      );
    case "line":
      return <line key={n.key} className={n.cls} x1={n.x1} x2={n.x2} y1={n.y1} y2={n.y2} />;
  }
}

/* ============================== component ============================== */

/** shadcn's ChartContainer with the chart drawn inside. */
export const Chart = forwardRef<HTMLDivElement, ChartProps>(function Chart(props, ref) {
  const {
    type,
    title,
    description,
    summary,
    config,
    data,
    xKey = "",
    xFormat,
    xLabel,
    valueLabel,
    point,
    unit,
    format,
    max,
    min,
    endLabels,
    legend,
    toolbar,
    stack = false,
    orientation = "auto",
    track = false,
    nameKey = "name",
    dataKey = "value",
    centerLabel,
    fill,
    state,
    emptyTitle = "No creatives yet.",
    emptyDescription = "Your first brief starts the chart.",
    emptyAction,
    onEmptyAction,
    errorTitle = "The chart didn’t load.",
    errorDescription = "Fume couldn’t reach the numbers just now.",
    retryLabel = "Try again",
    onRetry,
    active: pinned,
    onActiveChange,
    onSeriesToggle,
    motion,
    className,
    style,
    ...rest
  } = props;

  const cfg: Cfg = {
    type,
    title,
    description,
    summary,
    config,
    data,
    xKey,
    xFormat,
    xLabel,
    valueLabel,
    point,
    unit,
    format,
    max,
    min,
    endLabels,
    stack,
    orientation,
    track,
    nameKey,
    dataKey,
    centerLabel,
  };
  const keys = Object.keys(config).filter((k) => /^[\w-]+$/.test(k));
  const cfgKey = JSON.stringify([
    type,
    config,
    data,
    xKey,
    xFormat,
    unit,
    format,
    max,
    min,
    endLabels,
    stack,
    orientation,
    track,
    nameKey,
    dataKey,
  ]);
  const id = `ui-chart-${useId().replace(/:/g, "")}`;

  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tipBoxRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [model, setModel] = useState<Model | null>(null);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [focusVisible, setFocusVisible] = useState(false);
  const [live, setLive] = useState("");
  const [placing, setPlacing] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0, elW: 0 });
  const [fontsTick, setFontsTick] = useState(0);

  const focused = useRef(false);
  const touch = useRef(false);
  const dragging = useRef(false);
  const drawn = useRef(false);
  const drawTimer = useRef(0);
  const prevSize = useRef(size);
  const prevShown = useRef(-1);
  const hiddenKey = JSON.stringify(hidden);

  const shown = state ? -1 : activeIdx >= 0 ? activeIdx : pinned != null && pinned >= 0 ? pinned : -1;

  // series colours as --color-<key> (shadcn's ChartStyle)
  const colorVars: Record<string, string> = {};
  if (type === "donut") {
    Object.keys(config).forEach((k, i) => {
      colorVars["--color-" + k] = config[k].approved
        ? "var(--ui-chart-approved)"
        : config[k].color || `var(--ui-chart-series-${Math.min(i + 1, 4)})`;
    });
  } else {
    keys.forEach((k, i) => {
      colorVars["--color-" + k] = config[k].approved
        ? "var(--ui-chart-approved)"
        : config[k].color || `var(--ui-chart-series-${Math.min(i + 1, 4)})`;
    });
  }

  // fonts: measure again once they are in
  useEffect(() => {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fonts || !fonts.ready) return;
    let alive = true;
    void Promise.race([fonts.ready, new Promise((r) => setTimeout(r, 400))]).then(() => {
      if (alive) setFontsTick((t) => t + 1);
    });
    return () => {
      alive = false;
    };
  }, []);

  // the box the chart is drawn for
  useLayoutEffect(() => {
    const el = rootRef.current,
      fr = frameRef.current;
    if (!el || !fr) return;
    const read = () => {
      const s = { w: fr.clientWidth, h: fr.clientHeight, elW: el.clientWidth };
      setSize((prev) => {
        const same = type === "bar" ? prev.elW === s.elW && prev.w === s.w : prev.w === s.w && prev.h === s.h;
        return same ? prev : s;
      });
    };
    read();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", read);
      return () => window.removeEventListener("resize", read);
    }
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(read);
    });
    ro.observe(el);
    ro.observe(fr);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [type]);

  // lay out the marks
  useLayoutEffect(() => {
    const el = rootRef.current,
      fr = frameRef.current,
      svg = svgRef.current;
    if (!el || !fr || !svg) return;
    if (state) {
      setModel(null);
      drawn.current = false;
      return;
    }
    const d = cfg.data;
    if (!d.length) {
      setModel(null);
      return;
    }
    if (type === "bar") fr.style.height = "";
    const W = fr.clientWidth;
    if (!W) return;
    const sizeChanged = prevSize.current !== size;
    prevSize.current = size;
    const { model: m } = layout({
      cfg,
      keys,
      hidden,
      W,
      H: fr.clientHeight,
      elW: el.clientWidth,
      M: readMetrics(el),
      fontData: fontOf(svg, "ui-chart-data"),
      fontName: fontOf(svg, "ui-chart-name"),
      donutRing: cssPx(el, "--ui-chart-donut-ring", 20),
    });
    // rows set the frame's height themselves (as chart.js); columns fill the height the CSS gives
    fr.style.height = m.frameHeight !== undefined ? m.frameHeight + "px" : "";
    setPlacing(!model || sizeChanged);
    setModel(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, cfgKey, hiddenKey, fontsTick, state]);

  // placed without transitions, then transitions come back
  useEffect(() => {
    if (!placing) return;
    const r = requestAnimationFrame(() => setPlacing(false));
    return () => cancelAnimationFrame(r);
  }, [placing, model]);

  // draw in, on the first draw only
  useEffect(() => {
    if (!model || drawn.current) return;
    drawn.current = true;
    const el = rootRef.current;
    if (!el || motion === "reduce" || prefersReducedMotion()) return;
    setDrawing(true);
    const ms =
      cssMs(el, "--ui-chart-draw", 480) +
      cssMs(el, "--ui-motion-base", 240) +
      (model.geo.n * cssMs(el, "--ui-motion-instant", 100)) / 4 +
      120;
    window.clearTimeout(drawTimer.current);
    drawTimer.current = window.setTimeout(() => setDrawing(false), ms);
  }, [model, motion]);
  useEffect(() => () => window.clearTimeout(drawTimer.current), []);

  // a tap outside the chart closes its tooltip
  useEffect(() => {
    if (activeIdx < 0) return;
    const onDown = (e: PointerEvent) => {
      if (!focused.current && rootRef.current && !rootRef.current.contains(e.target as Node)) setActiveIdx(-1);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [activeIdx]);

  const geo = model?.geo;
  const M = rootRef.current ? readMetrics(rootRef.current) : null;

  // the band and the box the tooltip keeps clear of
  let band: { x: number; y: number; w: number; h: number } | null = null;
  let box: { x0: number; x1: number; y0: number; y1: number; top: number; above?: boolean } | null = null;
  if (geo && M && shown >= 0 && shown < geo.n) {
    if (
      geo.kind === "xy" &&
      geo.X &&
      geo.step !== undefined &&
      geo.left !== undefined &&
      geo.right !== undefined &&
      geo.bottom !== undefined &&
      geo.marks
    ) {
      const bw = clamp(geo.step * 0.9, M.point * 2, M.point * 5);
      const x = clamp(geo.X(shown) - bw / 2, geo.left - M.point, geo.right + M.point - bw);
      band = { x, y: 0, w: bw, h: geo.bottom + M.gap / 2 };
      box = { x0: x, x1: x + bw, y0: 0, y1: geo.bottom, top: geo.marks(shown)[0] };
    } else if (
      geo.kind === "cols" &&
      geo.left !== undefined &&
      geo.slot !== undefined &&
      geo.bottom !== undefined &&
      geo.marks
    ) {
      const x = geo.left + geo.slot * shown + M.ring;
      band = { x, y: 0, w: geo.slot - M.ring * 2, h: geo.bottom + M.gap / 2 };
      box = { x0: x, x1: x + geo.slot - M.ring * 2, y0: 0, y1: geo.bottom, top: geo.marks(shown)[0] };
    } else if (geo.kind === "rows" && geo.topOf && geo.rowH !== undefined && geo.W !== undefined) {
      const y = geo.topOf(shown) - M.gap / 2 - M.ring;
      band = { x: 0, y, w: geo.W, h: geo.rowH + M.gap + M.ring * 2 };
      box = { x0: 0, x1: geo.W, y0: y, y1: y + geo.rowH, top: y, above: true };
    }
  }

  // where the tooltip goes (as chart.js placeTip)
  useLayoutEffect(() => {
    const tipBox = tipBoxRef.current,
      tip = tipRef.current,
      el = rootRef.current,
      fr = frameRef.current;
    const fresh = prevShown.current < 0;
    prevShown.current = box ? shown : -1;
    if (!tipBox || !tip || !el || !fr || !box || !geo) return;
    if (fresh) tipBox.classList.add("is-placing");
    const W = fr.clientWidth,
      off = cssPx(el, "--ui-chart-tick-gap", 8);
    const tw = tip.offsetWidth,
      th = tip.offsetHeight,
      mid = (box.x0 + box.x1) / 2;
    const ceiling = el.getBoundingClientRect().top - fr.getBoundingClientRect().top;
    let x: number | null = null;
    let y: number;
    if (!box.above && !touch.current) {
      if (box.x1 + off + tw <= W) x = box.x1 + off;
      else if (box.x0 - off - tw >= 0) x = box.x0 - off - tw;
    }
    if (x == null) {
      x = clamp(mid - tw / 2, 0, Math.max(0, W - tw));
      y = Math.max(ceiling, (box.above ? box.y0 : box.top) - th - off * 2);
    } else {
      y = box.y0;
      if (geo.marks && geo.cx && geo.step !== undefined) {
        let lo = Infinity,
          hi = -Infinity;
        for (let i = 0; i < geo.n; i++) {
          const cx = geo.cx(i);
          if (cx < x - geo.step || cx > x + tw + geo.step) continue;
          const [a, z] = geo.marks(i);
          lo = Math.min(lo, a);
          hi = Math.max(hi, z);
        }
        const H = fr.clientHeight,
          up = lo - off * 2 - th,
          down = hi + off * 2;
        if (lo < Infinity) y = up >= 0 ? up : down + th <= H ? down : up >= ceiling ? up : box.y0;
      }
    }
    tipBox.style.setProperty("--x", Math.round(x) + "px");
    tipBox.style.setProperty("--y", Math.round(y) + "px");
    if (fresh) requestAnimationFrame(() => tipBox.classList.remove("is-placing"));
  });

  const setActive = (i: number) => {
    if (!geo || state || !(i >= 0) || i >= geo.n) return;
    i = Math.round(i);
    if (i !== shown) {
      onActiveChange?.(i);
      if (focused.current) setLive(spokenOf(cfg, keys, hidden, i));
    }
    setActiveIdx(i);
  };
  const clearActive = () => setActiveIdx(-1);

  const hit = (e: { clientX: number; clientY: number }) => {
    const fr = frameRef.current;
    if (!geo || !fr) return -1;
    const rc = fr.getBoundingClientRect(),
      x = e.clientX - rc.left,
      y = e.clientY - rc.top;
    if (geo.kind === "xy" && geo.left !== undefined && geo.step)
      return clamp(Math.round((x - geo.left) / geo.step), 0, geo.n - 1);
    if (geo.kind === "cols" && geo.left !== undefined && geo.slot)
      return clamp(Math.floor((x - geo.left) / geo.slot), 0, geo.n - 1);
    if (geo.kind === "rows" && geo.topOf && geo.rowH !== undefined) {
      const gapY = rootRef.current ? cssPx(rootRef.current, "--ui-space-xl", 24) / 2 : 12;
      for (let i = 0; i < geo.n; i++) if (y < geo.topOf(i) + geo.rowH + gapY) return i;
      return geo.n - 1;
    }
    if (geo.kind === "donut" && geo.center !== undefined && geo.R !== undefined && geo.ring !== undefined && geo.arcs) {
      const dx = x - geo.center,
        dy = y - geo.center,
        dist = Math.hypot(dx, dy);
      if (dist < geo.R - geo.ring / 2 - 8 || dist > geo.R + geo.ring / 2 + 12) return -1;
      let a = Math.atan2(dy, dx);
      if (a < -Math.PI / 2) a += Math.PI * 2;
      return geo.arcs.findIndex(([a0, a1]) => a >= a0 && a < a1);
    }
    return -1;
  };

  const plotHandlers = {
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "mouse") touch.current = false;
      if (e.pointerType === "mouse" || dragging.current) {
        const i = hit(e);
        if (i >= 0) setActive(i);
        else if (!focused.current) clearActive();
      }
    },
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "mouse") return;
      dragging.current = true;
      touch.current = true;
      const i = hit(e);
      if (i >= 0) setActive(i);
    },
    onPointerUp: () => {
      dragging.current = false;
    },
    onPointerCancel: () => {
      dragging.current = false;
    },
    onPointerLeave: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "mouse" && !focused.current) clearActive();
    },
    onFocus: (e: ReactFocusEvent<HTMLDivElement>) => {
      focused.current = true;
      let kb = true;
      try {
        kb = e.currentTarget.matches(":focus-visible");
      } catch {
        /* older engines */
      }
      if (kb) setFocusVisible(true);
      if (geo) {
        const start = shown >= 0 ? shown : type === "donut" ? 0 : geo.n - 1;
        setActiveIdx(start);
        setLive(spokenOf(cfg, keys, hidden, start));
      }
    },
    onBlur: () => {
      focused.current = false;
      setFocusVisible(false);
      clearActive();
    },
    onKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!geo) return;
      const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key];
      let i: number | null = null;
      if (step) i = clamp((shown < 0 ? (step > 0 ? -1 : geo.n) : shown) + step, 0, geo.n - 1);
      else if (e.key === "Home") i = 0;
      else if (e.key === "End") i = geo.n - 1;
      else if (e.key === "Escape" && activeIdx >= 0 && pinned == null) {
        e.preventDefault();
        clearActive();
        return;
      }
      if (i == null) return;
      e.preventDefault();
      touch.current = false;
      setFocusVisible(true);
      setActive(i);
    },
  };

  const toggle = (k: string) => {
    const vis = visibleKeys(keys, hidden);
    const on = !!hidden[k];
    if (!on && vis.length === 1 && vis[0] === k) return; // one series always stays
    setHidden((h) => ({ ...h, [k]: !on }));
    onSeriesToggle?.(k, on);
  };

  const r = type !== "spark" ? (cfg.data as ChartDatum[]) : [];
  const visKeys = visibleKeys(keys, hidden);
  const donutVals = type === "donut" ? r.map((x) => num(x, dataKey)) : [];
  const donutShares = type === "donut" ? shares(donutVals) : [];

  const legendEl =
    legend && type !== "donut" && type !== "spark" ? (
      <div className="ui-chart-legend" role="group" aria-label={`Series in ${title}`} data-slot="chart-legend">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            className="ui-chart-legend-item"
            aria-pressed={!hidden[k]}
            data-state={hidden[k] ? "off" : "on"}
            data-key={k}
            onClick={() => toggle(k)}
          >
            <span className="ui-chart-legend-swatch" aria-hidden="true" style={tint(k)} />
            <span>{labelOf(cfg, k)}</span>
          </button>
        ))}
      </div>
    ) : null;

  const dimExcept = type === "donut" ? shown : -1;
  const skeletonCount = type === "donut" || type === "spark" ? 1 : cfg.data.length || 12;
  const frame = (
    <div
      ref={frameRef}
      className={cx("ui-chart-frame", model?.rows && "ui-chart-frame--rows")}
      data-active={shown >= 0 && model ? shown : undefined}
      data-focus={focusVisible ? "visible" : undefined}
      hidden={state === "empty" || state === "error" ? true : undefined}
    >
      <div
        className="ui-chart-cursor"
        style={
          band
            ? cssVars({
                "--x": f(band.x) + "px",
                "--y": f(band.y) + "px",
                "--w": f(band.w) + "px",
                "--h": f(band.h) + "px",
              })
            : undefined
        }
      />
      <svg ref={svgRef} className="ui-chart-svg" role="img" aria-labelledby={`${id}-t ${id}-d`} focusable="false">
        <title id={`${id}-t`}>{title}</title>
        <desc id={`${id}-d`}>{summaryOf(cfg, keys)}</desc>
        {model && model.nodes.map((n) => renderNode(n, dimExcept))}
        {model && geo?.kind === "xy" && geo.X && geo.Y && M && (
          <g>
            {shown >= 0 &&
              visKeys.map((k) => (
                <circle
                  key={k}
                  className="ui-chart-dot"
                  cx={f(geo.X!(shown))}
                  cy={f(geo.Y!(num(r[shown], k)))}
                  r={f(M.point / 2 + M.ring / 2)}
                  data-series={k}
                  style={tint(k)}
                />
              ))}
          </g>
        )}
      </svg>
      {type !== "spark" && (
        <div
          className="ui-chart-plot"
          tabIndex={0}
          role="group"
          aria-roledescription="chart"
          aria-label={`${title}. Arrow keys read each ${point || "point"}.`}
          {...plotHandlers}
        />
      )}
      {type !== "spark" && (
        <div ref={tipBoxRef} className="ui-chart-tip">
          <div
            ref={tipRef}
            className="ui-glass ui-glass--small ui-chart-tooltip"
            data-slot="chart-tooltip"
            hidden={!box}
            data-state={box ? "open" : undefined}
          >
            {box && shown >= 0 && r[shown] && (
              <>
                <div className={cx("ui-chart-tooltip-head", xFormat && "ui-chart-tooltip-time")}>
                  {fmtX(cfg, r[shown][xKey], "head")}
                </div>
                <div className="ui-chart-tooltip-rows">
                  {visKeys.map((k) => (
                    <TooltipRow key={k} name={labelOf(cfg, k)} value={fmtV(cfg, raw(r[shown], k))} />
                  ))}
                  {stack && visKeys.length > 1 && (
                    <>
                      <span className="ui-chart-tooltip-name ui-chart-tooltip-total is-total">Total</span>
                      <span className="ui-chart-tooltip-num is-total">
                        {fmtV(cfg, sum(visKeys.map((k) => num(r[shown], k))))}
                      </span>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {type === "donut" && (
        <div className="ui-chart-donut-center" aria-hidden="true">
          <span className="ui-chart-donut-num">{fmtV(cfg, shown >= 0 ? donutVals[shown] : sum(donutVals))}</span>
          <span className="ui-chart-donut-caption">
            {shown >= 0 && r[shown]
              ? `${labelOf(cfg, r[shown][nameKey])} · ${donutShares[shown]}%`
              : centerLabel || "in all"}
          </span>
        </div>
      )}
      {state === "loading" && (
        <div className={cx("ui-chart-skeleton", type === "donut" && "ui-chart-skeleton--donut")} aria-hidden="true">
          {Array.from({ length: skeletonCount }, (_, i) => (
            <span
              key={i}
              className="ui-skeleton"
              style={cssVars({
                "--i": i,
                "--h": Math.round(42 + 44 * Math.sin((i / Math.max(skeletonCount - 1, 1)) * 1.4)) + "%",
              })}
            />
          ))}
        </div>
      )}
    </div>
  );

  const stateBox =
    state === "empty" || state === "error" ? (
      <div className={cx("ui-empty ui-empty--sm ui-chart-state", state === "error" && "ui-chart-state--error")}>
        <div className="ui-empty-header">
          <div className="ui-empty-media ui-empty-media--icon">
            <Icon
              name={
                (state === "error"
                  ? "circle-alert"
                  : type === "donut"
                    ? "chart-pie"
                    : type === "bar"
                      ? "chart-column"
                      : "chart-line") as IconName
              }
            />
          </div>
          <p className="ui-empty-title">{state === "error" ? errorTitle : emptyTitle}</p>
          <p className="ui-empty-description">{state === "error" ? errorDescription : emptyDescription}</p>
        </div>
        {(state === "error" || !!emptyAction) && (
          <div className="ui-empty-content">
            {state === "error" ? (
              <button className="ui-btn ui-btn--sm ui-btn--secondary" type="button" onClick={onRetry}>
                <Icon name="rotate-ccw" />
                {retryLabel}
              </button>
            ) : (
              <button className="ui-btn ui-btn--sm ui-btn--primary" type="button" onClick={onEmptyAction}>
                <Icon name="plus" />
                {emptyAction}
              </button>
            )}
          </div>
        )}
      </div>
    ) : null;

  return (
    <div
      ref={mergeRefs(ref, rootRef)}
      data-slot="chart"
      data-chart={id}
      data-state={state}
      data-draw={drawing ? "run" : undefined}
      data-motion={motion}
      aria-busy={state === "loading" || undefined}
      className={cx("ui-chart", `ui-chart--${type}`, fill && "ui-chart--fill", placing && "is-placing", className)}
      style={{ ...cssVars(colorVars), ...style }}
      {...rest}
    >
      {legendEl &&
        (toolbar !== undefined ? (
          <div className="ui-chart-toolbar">
            {legendEl}
            {toolbar}
          </div>
        ) : (
          legendEl
        ))}
      {type === "donut" ? (
        <div className="ui-chart-body" hidden={state === "empty" || state === "error" ? true : undefined}>
          {frame}
          <ul className="ui-chart-legend ui-chart-legend--list" data-slot="chart-legend">
            {r.map((row, i) => (
              <li
                key={i}
                className={cx("ui-chart-legend-row", shown === i && "is-active")}
                data-index={i}
                onPointerOver={(e) => {
                  if (e.pointerType === "mouse") setActive(i);
                }}
                onPointerLeave={(e) => {
                  if (e.pointerType === "mouse" && !focused.current) clearActive();
                }}
              >
                <span className="ui-chart-legend-swatch" aria-hidden="true" style={tint(String(row[nameKey]))} />
                <span>{labelOf(cfg, row[nameKey])}</span>
                <span className="ui-chart-legend-num">{fmtV(cfg, donutVals[i])}</span>
                <span className="ui-chart-legend-num ui-chart-legend-num--share">{donutShares[i]}%</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        frame
      )}
      {stateBox}
      {type !== "spark" && (
        <>
          <div className="ui-chart-sr">
            <ChartTable cfg={cfg} keys={keys} />
          </div>
          <p className="ui-chart-sr" aria-live="polite">
            {state === "loading" ? `Loading ${title}.` : live}
          </p>
        </>
      )}
    </div>
  );
});

function TooltipRow({ name, value }: { name: string; value: string }) {
  return (
    <>
      <span className="ui-chart-tooltip-name">{name}</span>
      <span className="ui-chart-tooltip-num">{value}</span>
    </>
  );
}

/** The visually hidden table every value lives in. */
function ChartTable({ cfg, keys }: { cfg: Cfg; keys: string[] }) {
  const d = rows(cfg);
  const caption = cfg.title + (cfg.description ? ", " + cfg.description : "");
  if (cfg.type === "donut") {
    const vals = d.map((r) => num(r, cfg.dataKey)),
      sh = shares(vals);
    return (
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{cfg.xLabel || "Format"}</th>
            <th scope="col">{cfg.valueLabel || "Creatives"}</th>
            <th scope="col">Share</th>
          </tr>
        </thead>
        <tbody>
          {d.map((r, i) => (
            <tr key={i}>
              <th scope="row">{labelOf(cfg, r[cfg.nameKey])}</th>
              <td>{fmtV(cfg, vals[i])}</td>
              <td>{sh[i]}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <table>
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{cfg.xLabel || ""}</th>
          {keys.map((k) => (
            <th key={k} scope="col">
              {labelOf(cfg, k)}
            </th>
          ))}
          {cfg.stack && <th scope="col">Total</th>}
        </tr>
      </thead>
      <tbody>
        {d.map((r, i) => (
          <tr key={i}>
            <th scope="row">{fmtX(cfg, r[cfg.xKey], "head")}</th>
            {keys.map((k) => (
              <td key={k}>{fmtV(cfg, raw(r, k))}</td>
            ))}
            {cfg.stack && <td>{fmtV(cfg, sum(keys.map((k) => num(r, k))))}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ============================== trend ============================== */

export interface ChartTrendProps extends HTMLAttributes<HTMLParagraphElement> {
  /** The trending icon in Ink (never red or green). */
  trend?: "up" | "down";
}
/** A trend under a chart in words ("48% more a week than in July."); put a ChartTrendNote inside for the quieter part. */
export function ChartTrend({ trend, className, children, ...props }: ChartTrendProps) {
  return (
    <p className={cx("ui-chart-trend", className)} {...props}>
      {trend && <Icon name={trend === "up" ? "trending-up" : "trending-down"} />}
      <span>{children}</span>
    </p>
  );
}

export function ChartTrendNote({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cx("ui-chart-trend-note", className)} {...props} />;
}
