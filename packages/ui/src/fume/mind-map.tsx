// Mind map (design-system/components/mind-map.css): Fume reading a brand for the first time (FLOWS §7 step 3). A calm
// Paper grid; the center (the brand's logo) lands first, then each node arrives one by one, drawn to the center with a
// thin connector, while one line says what Fume is reading. When `settled` turns true the map hands over to `board`:
// every element there with data-mind-map-part="<node id>" (or "center") flies in from where its node stood and comes
// from soft to sharp (FLIP with WAAPI), while the map blurs away. Without a board (the onboarding keeps the map as the
// payoff) the settled map simply stays, every node landed. On a narrow container the map stacks: center on top, nodes
// below on one spine.
//   <MindMap label="LYSNE, as Fume reads it" center={<logo/>} centerState="landed"
//     nodes={[{ id: "palette", title: "Palette", icon: "palette", place: "nw", state: "reading", reading: "Reading lysne.no", children: … }]} />
// Children of a node that should land one by one carry className "ui-mind-map-item" (CSS staggers them).
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../icons";

export type MindMapPlace = "nw" | "n" | "ne" | "w" | "e" | "sw" | "s" | "se";
export type MindMapState = "waiting" | "reading" | "landed";

export interface MindMapNode {
  id: string;
  title: string;
  icon?: IconName;
  /** Where it sits around the center on a wide container. */
  place: MindMapPlace;
  /** Takes two columns (from sw or s), for a row of picture tiles. */
  wide?: boolean;
  state: MindMapState;
  /** What Fume reads for it now ("Reading lysne.no/about"); shimmers while the node is reading. */
  reading?: string;
  /** Where it was read, once landed ("lysne.no/about"). */
  source?: string;
  /** A short line under the title once landed ("6 products"). */
  meta?: ReactNode;
  children: ReactNode;
}

export interface MindMapProps {
  /** The map's name for assistive tech. */
  label: string;
  center: ReactNode;
  centerState: "waiting" | "landed";
  nodes: MindMapNode[];
  /** The reading is done: the map settles into `board`. */
  settled?: boolean;
  board?: ReactNode;
  className?: string;
}

type Box = { x: number; y: number; w: number; h: number };

function useReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setReduced(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}

const boxOf = (el: Element, origin: DOMRect): Box => {
  const r = el.getBoundingClientRect();
  return { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height };
};

/** A box in its offset parent's layout, without the transform it may be animating through. */
const layoutBox = (el: HTMLElement): Box => ({
  x: el.offsetLeft,
  y: el.offsetTop,
  w: el.offsetWidth,
  h: el.offsetHeight,
});

/** A wide map: from the center's edge toward the node, a soft curve into the node's nearest side. */
function spoke(c: Box, n: Box): string {
  const cx0 = c.x + c.w / 2;
  const cy0 = c.y + c.h / 2;
  const nx = n.x + n.w / 2;
  const ny = n.y + n.h / 2;
  if (n.x >= c.x + c.w || n.x + n.w <= c.x) {
    const right = nx > cx0;
    const sx = right ? c.x + c.w : c.x;
    const sy = Math.min(c.y + c.h - 8, Math.max(c.y + 8, cy0 + (ny - cy0) * 0.25));
    const ex = right ? n.x : n.x + n.w;
    const ey = Math.min(n.y + n.h - 16, Math.max(n.y + 16, sy));
    const mx = (sx + ex) / 2;
    return `M${sx.toFixed(1)} ${sy.toFixed(1)}C${mx.toFixed(1)} ${sy.toFixed(1)} ${mx.toFixed(1)} ${ey.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
  }
  const below = ny > cy0;
  const sx = cx0 + (Math.min(Math.max(nx, c.x + 16), c.x + c.w - 16) - cx0) * 0.6;
  const sy = below ? c.y + c.h : c.y;
  const ex = Math.min(n.x + n.w - 24, Math.max(n.x + 24, sx));
  const ey = below ? n.y : n.y + n.h;
  const my = (sy + ey) / 2;
  return `M${sx.toFixed(1)} ${sy.toFixed(1)}C${sx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
}

/** A stacked map: down from the center, along one spine at the left, and a short arm into the node's head. */
function branch(c: Box, n: Box, gutter: number): string {
  const g = 12;
  const lx = c.x + c.w / 2;
  const y0 = c.y + c.h;
  const sx = n.x - gutter / 2;
  const yh = n.y + 28;
  return [
    `M${lx} ${y0}`,
    `L${lx} ${y0 + g}`,
    `Q${lx} ${y0 + 2 * g} ${lx - g} ${y0 + 2 * g}`,
    `L${sx + g} ${y0 + 2 * g}`,
    `Q${sx} ${y0 + 2 * g} ${sx} ${y0 + 3 * g}`,
    `L${sx} ${yh - g}`,
    `Q${sx} ${yh} ${sx + g} ${yh}`,
    `L${n.x} ${yh}`,
  ].join("");
}

const endOf = (d: string): [number, number] => {
  const nums = d.match(/-?\d+(\.\d+)?/g) ?? ["0", "0"];
  return [Number(nums[nums.length - 2]), Number(nums[nums.length - 1])];
};

const ms = (value: string, fallback: number) => {
  const v = value.trim();
  if (!v) return fallback;
  return v.endsWith("ms") ? parseFloat(v) : v.endsWith("s") ? parseFloat(v) * 1000 : fallback;
};

export function MindMap({ label, center, centerState, nodes, settled = false, board, className }: MindMapProps) {
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const centerEl = useRef<HTMLDivElement>(null);
  const nodeEls = useRef(new Map<string, HTMLElement>());
  const boxes = useRef(new Map<string, Box>());
  const [geo, setGeo] = useState<{ w: number; h: number; links: Record<string, string> }>({ w: 0, h: 0, links: {} });
  const [leaving, setLeaving] = useState(false);
  const stackedRef = useRef(false);
  const handover = settled && board !== undefined;
  const readingId = nodes.find((n) => n.state === "reading")?.id;

  // The node being read may be below the fold (stacked on a phone, or the last row on a laptop): follow it down,
  // gently, only ever forward. A pinned foot is the page's scroll-margin-bottom on the node, so it stops above it.
  const follow = (el: HTMLElement | null | undefined) => {
    if (!el) return;
    const below = parseFloat(getComputedStyle(el).scrollMarginBottom) || 0;
    if (el.getBoundingClientRect().bottom > window.innerHeight - below)
      el.scrollIntoView({ block: "end", behavior: reduced ? "auto" : "smooth" });
  };
  useEffect(() => {
    if (readingId) follow(nodeEls.current.get(readingId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readingId, reduced]);
  // Settled while she watched (or skipped to the result): the whole map comes into view above the foot. A map that
  // opens settled stays where the page opens.
  const openedSettled = useRef(settled);
  useEffect(() => {
    if (!settled || openedSettled.current || stackedRef.current || handover) return;
    follow(stage.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);
  const pattern = `ui-mind-map-dots-${useRef(Math.random().toString(36).slice(2, 8)).current}`;

  // Measure the center and the nodes, keep their boxes for the settle, and draw the connectors.
  useLayoutEffect(() => {
    if (handover) return;
    const measure = () => {
      const s = stage.current;
      const c = centerEl.current;
      const r = root.current;
      if (!s || !c || !r) return;
      const o = s.getBoundingClientRect();
      const ro = r.getBoundingClientRect();
      const shift = (b: Box): Box => ({ ...b, x: b.x + o.left - ro.left, y: b.y + o.top - ro.top });
      const stacked = getComputedStyle(s).getPropertyValue("--mind-map-stacked").trim() === "1";
      stackedRef.current = stacked;
      const gutter = parseFloat(getComputedStyle(s).getPropertyValue("--mind-map-gutter")) || 32;
      const cb = layoutBox(c);
      boxes.current.set("center", shift(cb));
      const links: Record<string, string> = {};
      nodeEls.current.forEach((el, id) => {
        const nb = layoutBox(el);
        boxes.current.set(id, shift(nb));
        links[id] = stacked ? branch(cb, nb, gutter) : spoke(cb, nb);
      });
      setGeo({ w: o.width, h: o.height, links });
    };
    measure();
    const obs = new ResizeObserver(measure);
    if (stage.current) obs.observe(stage.current);
    nodeEls.current.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [handover, nodes.length]);

  // The settle: each board part flies in from its node's box and comes sharp while the map blurs away.
  useLayoutEffect(() => {
    if (!handover) return;
    const r = root.current;
    if (!r) return;
    const css = getComputedStyle(r);
    const slow = ms(css.getPropertyValue("--ui-motion-slow"), 480);
    const ease = css.getPropertyValue("--ui-motion-ease").trim() || "ease";
    const blur = parseFloat(css.getPropertyValue("--ui-motion-enter-blur")) || 8;
    if (reduced) return;
    setLeaving(true);
    const t = window.setTimeout(() => setLeaving(false), slow * 3);
    const ro = r.getBoundingClientRect();
    const parts = Array.from(r.querySelectorAll<HTMLElement>("[data-mind-map-part]"));
    const anims = parts.map((el, i) => {
      const from = boxes.current.get(el.dataset.mindMapPart ?? "");
      const to = boxOf(el, ro);
      const delay = i * (slow / 4);
      if (!from || !to.w) {
        return el.animate(
          [
            { opacity: 0, filter: `blur(${blur * 1.5}px)` },
            { opacity: 1, filter: "blur(0px)" },
          ],
          { duration: slow * 3, delay, easing: ease, fill: "backwards" },
        );
      }
      const scale = Math.min(1, Math.max(0.35, from.w / to.w));
      const dx = from.x + from.w / 2 - (to.x + (to.w * scale) / 2);
      const dy = from.y - to.y;
      return el.animate(
        [
          {
            transformOrigin: "0 0",
            transform: `translate(${dx}px, ${dy}px) scale(${scale})`,
            opacity: 0.2,
            filter: `blur(${blur * 1.5}px)`,
          },
          { transformOrigin: "0 0", transform: "none", opacity: 1, filter: "blur(0px)" },
        ],
        { duration: slow * 3.5, delay, easing: ease, fill: "backwards" },
      );
    });
    return () => {
      window.clearTimeout(t);
      anims.forEach((a) => a.cancel());
    };
  }, [handover, reduced]);

  const map = (
    <div
      className={cx("ui-mind-map-stage", leaving && "ui-mind-map-stage--leaving")}
      ref={stage}
      aria-hidden={handover || undefined}
    >
      <svg
        className="ui-mind-map-lines"
        width={geo.w}
        height={geo.h}
        viewBox={`0 0 ${geo.w || 1} ${geo.h || 1}`}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <pattern id={pattern} width="24" height="24" patternUnits="userSpaceOnUse">
            <circle className="ui-mind-map-dot" cx="12" cy="12" r="1" />
          </pattern>
        </defs>
        <rect className="ui-mind-map-grid" width="100%" height="100%" fill={`url(#${pattern})`} />
        {nodes.map((n) => {
          const d = geo.links[n.id];
          if (!d) return null;
          const [ex, ey] = endOf(d);
          return (
            <g key={n.id} className="ui-mind-map-link" data-state={n.state}>
              <path d={d} pathLength={1} />
              <circle cx={ex} cy={ey} r="3" />
            </g>
          );
        })}
      </svg>
      <div className="ui-mind-map-center" ref={centerEl} data-state={centerState}>
        {center}
      </div>
      <ol className="ui-mind-map-nodes">
        {nodes.map((n) => (
          <li
            key={n.id}
            className="ui-mind-map-node"
            data-state={n.state}
            data-place={n.place}
            data-wide={n.wide ? "" : undefined}
            ref={(el) => {
              if (el) nodeEls.current.set(n.id, el);
              else nodeEls.current.delete(n.id);
            }}
            aria-hidden={n.state === "waiting" || undefined}
          >
            <div className="ui-mind-map-node-head">
              {n.icon && <Icon name={n.icon} />}
              <h3 className="ui-mind-map-node-title">{n.title}</h3>
              {n.meta !== undefined && n.state === "landed" && <span className="ui-mind-map-node-meta">{n.meta}</span>}
            </div>
            <div className="ui-mind-map-node-body">{n.children}</div>
            <p className="ui-mind-map-node-source">
              {n.state === "reading" ? (
                <span className="ui-text-shimmer">{n.reading ?? "Reading"}</span>
              ) : n.state === "landed" && n.source ? (
                n.source
              ) : (
                " "
              )}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );

  return (
    <div
      className={cx("ui-mind-map", className)}
      ref={root}
      role="group"
      aria-label={label}
      data-settled={settled ? "" : undefined}
    >
      {handover ? (
        <>
          {leaving && map}
          <div className="ui-mind-map-board">{board}</div>
        </>
      ) : (
        map
      )}
    </div>
  );
}
