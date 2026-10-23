// The board's renderer (FLOWS §3.3, §6): draws a Board's items on an infinite canvas and turns pointers, wheels and
// keys into callbacks. It holds only the view (pan, zoom, a drag under way); the data and what a change means live
// with the caller (Board.tsx), which saves through the API.
//
// OpenPencil seam: FLOWS §6 puts the boards on OpenPencil's scene graph and renderer later. This file is the only
// part that would change: a BoardView with the same props (board, selectedId, onSelect, onMove, editable) and the
// same handle (zoomBy, fit, centre) can draw with OpenPencil's CanvasKit renderer instead of positioned elements,
// while Board.tsx, the toolbar, the side panel and the API stay as they are.
//
// Gestures: drag the background, hold Space and drag, or one finger to pan; ctrl/⌘ + wheel, a pinch or the buttons
// to zoom; a plain wheel or two-finger trackpad scroll pans. A mouse drags an item to move it; on touch a selected
// item can be dragged, everything else pans. Arrow keys move the selected item (Shift for bigger steps), + and −
// zoom, Shift+1 fits, Escape lets go.
import { cx, Icon } from "@fume/ui";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Board as BoardData, BoardItem } from "../../contract";

export interface BoardViewHandle {
  /** Zoom by a factor around the middle of the view. */
  zoomBy: (factor: number) => void;
  /** Show every item. */
  fit: () => void;
  /** The board point in the middle of the view, where new items land. */
  centre: () => { x: number; y: number };
}

export interface BoardViewProps {
  board: BoardData;
  /** Names the canvas for assistive tech ("Autumn launch moodboard"). */
  label: string;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** Called once when an item is dropped somewhere new, in board units. */
  onMove?: (id: string, x: number, y: number) => void;
  /** Items can be moved. */
  editable?: boolean;
  /** The zoom as a factor (1 = 100 %), for a readout. */
  onZoomChange?: (k: number) => void;
  /** A fixed height inside a page (a tab) instead of filling its parent. */
  embedded?: boolean;
  /** How an item is named to assistive tech. */
  itemLabel?: (item: BoardItem) => string;
  /** What floats over the canvas: the toolbar, the side panel. Gestures never start on it. */
  children?: ReactNode;
}

interface View {
  x: number;
  y: number;
  k: number;
}

type Gesture =
  | { type: "pan"; sx: number; sy: number; vx: number; vy: number; moved: boolean; itemId: string | null }
  | { type: "drag"; id: string; sx: number; sy: number; ix: number; iy: number; x: number; y: number; moved: boolean }
  | { type: "pinch"; dist: number; mid: { x: number; y: number }; view: View };

const MIN_K = 0.1;
const MAX_K = 3;
const PAD = 48;
const TAP = 4;
const clamp = (k: number) => Math.min(MAX_K, Math.max(MIN_K, k));

const editableTarget = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName));

export function defaultItemLabel(item: BoardItem): string {
  const proposal = item.provenance.state === "proposed" ? ", found by Fume" : "";
  const verdict = item.verdict === "liked" ? ", this is us" : item.verdict === "disliked" ? ", not us" : "";
  switch (item.kind) {
    case "section":
      return `Section ${item.text ?? ""}`.trim();
    case "note":
      return `Note: ${item.text ?? ""}${proposal}`;
    case "swatch":
      return `Colour ${item.text ?? ""} ${item.hex ?? ""}${proposal}`;
    default:
      return `${item.kind === "creative" ? "Creative" : "Image"}${item.note ? `: ${item.note}` : ""}${verdict}${proposal}`;
  }
}

export const BoardView = forwardRef<BoardViewHandle, BoardViewProps>(function BoardView(
  { board, label, selectedId = null, onSelect, onMove, editable = false, onZoomChange, embedded, itemLabel = defaultItemLabel, children },
  ref,
) {
  const frame = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const [view, setViewState] = useState<View>({ x: 0, y: 0, k: 1 });
  const viewRef = useRef(view);
  const [easing, setEasing] = useState(false);
  const [space, setSpace] = useState(false);
  const [panning, setPanning] = useState(false);
  // Where items sit while dragged, and after a drop until the saved board comes back with the same place.
  const [moved, setMoved] = useState<Record<string, { x: number; y: number }>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const hover = useRef(false);
  const fitted = useRef(false);

  const items = board.items.filter((i) => i.provenance.state !== "removed");
  // Sections lie under the work.
  const ordered = [...items.filter((i) => i.kind === "section"), ...items.filter((i) => i.kind !== "section")];
  const place = (i: BoardItem) => moved[i.id] ?? { x: i.x, y: i.y };

  const setView = useCallback(
    (next: View, ease = false) => {
      viewRef.current = next;
      setViewState(next);
      onZoomChange?.(next.k);
      if (ease) {
        setEasing(true);
        window.setTimeout(() => setEasing(false), 260);
      }
    },
    [onZoomChange],
  );

  // A saved board that agrees with a dropped place lets the local place go.
  useEffect(() => {
    setMoved((m) => {
      const left = Object.fromEntries(Object.entries(m).filter(([id, p]) => {
        const it = board.items.find((x) => x.id === id);
        return it && (it.x !== p.x || it.y !== p.y) && dragging !== id;
      }));
      return Object.keys(left).length === Object.keys(m).length ? m : left;
    });
  }, [board, dragging]);

  const size = () => {
    const r = surface.current?.getBoundingClientRect();
    return { w: r?.width ?? 0, h: r?.height ?? 0, left: r?.left ?? 0, top: r?.top ?? 0 };
  };

  const zoomAt = useCallback(
    (factor: number, sx: number, sy: number, ease = false) => {
      const v = viewRef.current;
      const k = clamp(v.k * factor);
      const r = k / v.k;
      setView({ k, x: sx - (sx - v.x) * r, y: sy - (sy - v.y) * r }, ease);
    },
    [setView],
  );

  const fit = useCallback(
    (ease = true) => {
      const { w, h } = size();
      if (!w || !h) return;
      const list = board.items.filter((i) => i.provenance.state !== "removed");
      const box = list.length
        ? list.reduce(
            (b, i) => ({ x0: Math.min(b.x0, i.x), y0: Math.min(b.y0, i.y), x1: Math.max(b.x1, i.x + i.w), y1: Math.max(b.y1, i.y + i.h) }),
            { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity },
          )
        : { x0: 0, y0: 0, x1: board.width, y1: board.height };
      const bw = Math.max(1, box.x1 - box.x0);
      const bh = Math.max(1, box.y1 - box.y0);
      // Room at the foot for the floating toolbar.
      const foot = 72;
      const k = clamp(Math.min((w - 2 * PAD) / bw, (h - PAD - foot) / bh, 1.25));
      setView({ k, x: (w - bw * k) / 2 - box.x0 * k, y: (h - foot + PAD - bh * k) / 2 - box.y0 * k }, ease);
    },
    [board, setView],
  );

  useImperativeHandle(
    ref,
    () => ({
      zoomBy: (factor) => {
        const { w, h } = size();
        zoomAt(factor, w / 2, h / 2, true);
      },
      fit: () => fit(true),
      centre: () => {
        const { w, h } = size();
        const v = viewRef.current;
        return { x: Math.round((w / 2 - v.x) / v.k), y: Math.round((h / 2 - v.y) / v.k) };
      },
    }),
    [fit, zoomAt],
  );

  // Fit once the canvas has a size, and again for another board.
  useLayoutEffect(() => {
    fitted.current = false;
  }, [board.id]);
  useEffect(() => {
    const el = surface.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (!fitted.current && el.clientWidth > 0) {
        fitted.current = true;
        fit(false);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  // The wheel: ctrl/⌘ (and a trackpad pinch, which arrives as ctrl + wheel) zooms at the pointer; otherwise it pans.
  useEffect(() => {
    const el = surface.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
      else {
        const v = viewRef.current;
        setView({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt, setView]);

  // Space held over the board (or with the board focused) turns any drag into a pan.
  useEffect(() => {
    const inBoard = (t: EventTarget | null) => t instanceof Node && Boolean(frame.current?.contains(t));
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || editableTarget(e.target)) return;
      if (!hover.current && !inBoard(e.target)) return;
      if (e.target instanceof HTMLElement && e.target.closest("[data-board-ui]")) return;
      e.preventDefault();
      setSpace(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpace(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", () => setSpace(false));
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const local = (e: { clientX: number; clientY: number }) => {
    const { left, top } = size();
    return { x: e.clientX - left, y: e.clientY - top };
  };

  const startPinch = () => {
    const [a, b] = [...pointers.current.values()];
    if (!a || !b) return;
    gesture.current = { type: "pinch", dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, view: viewRef.current };
    setDragging(null);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse" && e.button !== 1) return;
    surface.current?.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2) return startPinch();
    if (pointers.current.size > 2) return;
    const el = (e.target as Element).closest<HTMLElement>("[data-item-id]");
    const id = el?.dataset.itemId ?? null;
    const item = id ? items.find((i) => i.id === id) : undefined;
    const touch = e.pointerType === "touch";
    if (item && editable && !space && e.button === 0 && item.kind !== "section" && (!touch || selectedId === item.id)) {
      const at = place(item);
      gesture.current = { type: "drag", id: item.id, sx: p.x, sy: p.y, ix: at.x, iy: at.y, x: at.x, y: at.y, moved: false };
      onSelect?.(item.id);
    } else {
      gesture.current = { type: "pan", sx: p.x, sy: p.y, vx: viewRef.current.x, vy: viewRef.current.y, moved: false, itemId: id };
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (!g) return;
    if (g.type === "pinch") {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const k = clamp(g.view.k * (dist / g.dist));
      // The board point under the first midpoint stays under the fingers.
      const wx = (g.mid.x - g.view.x) / g.view.k;
      const wy = (g.mid.y - g.view.y) / g.view.k;
      setView({ k, x: mid.x - wx * k, y: mid.y - wy * k });
      return;
    }
    const dx = p.x - g.sx;
    const dy = p.y - g.sy;
    if (!g.moved && Math.hypot(dx, dy) < TAP) return;
    g.moved = true;
    if (g.type === "pan") {
      setPanning(true);
      setView({ ...viewRef.current, x: g.vx + dx, y: g.vy + dy });
    } else {
      const k = viewRef.current.k;
      g.x = Math.round(g.ix + dx / k);
      g.y = Math.round(g.iy + dy / k);
      setDragging(g.id);
      setMoved((m) => ({ ...m, [g.id]: { x: g.x, y: g.y } }));
    }
  };

  const end = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (g?.type === "pinch") {
      // One finger left after a pinch pans on from where it is.
      const rest = [...pointers.current.values()][0];
      gesture.current = rest ? { type: "pan", sx: rest.x, sy: rest.y, vx: viewRef.current.x, vy: viewRef.current.y, moved: true, itemId: null } : null;
      return;
    }
    if (pointers.current.size > 0) return;
    gesture.current = null;
    setPanning(false);
    if (!g) return;
    if (g.type === "drag") {
      setDragging(null);
      if (g.moved && !cancelled) onMove?.(g.id, g.x, g.y);
      else if (cancelled) setMoved(({ [g.id]: _, ...rest }) => rest);
    } else if (!g.moved && !cancelled) {
      onSelect?.(g.itemId);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (editableTarget(e.target) || (e.target as HTMLElement).closest("[data-board-ui]")) return;
    const { w, h } = size();
    if (e.key === "+" || e.key === "=") zoomAt(1.25, w / 2, h / 2, true);
    else if (e.key === "-" || e.key === "_") zoomAt(0.8, w / 2, h / 2, true);
    else if (e.key === "!" || (e.shiftKey && e.key === "1")) fit(true);
    else if (e.key === "Escape") onSelect?.(null);
    else if (e.key === "Enter") {
      const id = (e.target as HTMLElement).dataset.itemId;
      if (id) onSelect?.(id);
      else return;
    } else if (e.key.startsWith("Arrow") && editable && selectedId) {
      const item = items.find((i) => i.id === selectedId);
      if (!item || item.kind === "section") return;
      const step = e.shiftKey ? 40 : 8;
      const at = place(item);
      const nx = at.x + (e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0);
      const ny = at.y + (e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0);
      setMoved((m) => ({ ...m, [item.id]: { x: nx, y: ny } }));
      onMove?.(item.id, nx, ny);
    } else return;
    e.preventDefault();
  };

  const worldStyle = { "--board-x": `${view.x}px`, "--board-y": `${view.y}px`, "--board-k": view.k } as CSSProperties;

  return (
    <div
      ref={frame}
      className={cx("ui-board", embedded && "ui-board--embedded")}
      data-editable={editable || undefined}
      data-panning={panning ? "active" : space ? "" : undefined}
      data-easing={easing || undefined}
      onKeyDown={onKeyDown}
      onPointerEnter={() => (hover.current = true)}
      onPointerLeave={() => (hover.current = false)}
    >
      <div
        ref={surface}
        role="application"
        aria-roledescription="board"
        aria-label={`${label}. Drag or use two fingers to move around, pinch or ctrl and the wheel to zoom.`}
        tabIndex={0}
        className="ui-board-surface"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => end(e, false)}
        onPointerCancel={(e) => end(e, true)}
      >
        <div className="ui-board-world" style={worldStyle}>
          {ordered.map((item) => {
            const at = place(item);
            const style = { "--x": at.x, "--y": at.y, "--w": item.w, "--h": item.h, ...(item.hex ? { "--swatch": item.hex } : {}) } as CSSProperties;
            const proposed = item.provenance.state === "proposed";
            return (
              <div
                key={item.id}
                data-item-id={item.id}
                className="ui-board-item"
                data-kind={item.kind}
                data-state={proposed ? "proposed" : "approved"}
                data-selected={selectedId === item.id || undefined}
                data-dragging={dragging === item.id || undefined}
                role="button"
                tabIndex={item.kind === "section" ? -1 : 0}
                aria-pressed={selectedId === item.id}
                aria-label={itemLabel(item)}
                style={style}
              >
                <ItemBody item={item} />
                {(proposed || item.verdict) && item.kind !== "section" && (
                  <span className="ui-board-marks" aria-hidden="true">
                    {item.verdict && (
                      <span className="ui-board-mark" data-verdict={item.verdict}>
                        <Icon name={item.verdict === "liked" ? "thumbs-up" : "x"} />
                      </span>
                    )}
                    {proposed && (
                      <span className="ui-board-mark">
                        <Icon name="fume-engine" />
                      </span>
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {children}
    </div>
  );
});

function ItemBody({ item }: { item: BoardItem }) {
  switch (item.kind) {
    case "image":
    case "creative":
      return item.image ? <img className="ui-board-image" src={item.image} alt="" draggable={false} loading="lazy" /> : null;
    case "note":
      return <p className="ui-board-note-text">{item.text}</p>;
    case "section":
      return <span className="ui-board-section-label">{item.text}</span>;
    case "swatch":
      return (
        <>
          <span className="ui-board-swatch-chip" />
          <span className="ui-board-swatch-name">
            {item.text}
            <span className="ui-board-swatch-num">{item.hex}</span>
          </span>
        </>
      );
  }
}
