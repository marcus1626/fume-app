// The Design studio laid out like Figma (round 15, PROPOSED 9 Nov 2026; app/FLOWS-r15-design.md). Marcus: "Layers
// should be on the right, since people are used to Figma, with more control" and "'Show the logo' should not be a
// button, it is a layer". As in Figma (and OpenPencil), the layers are on the left and what is picked is set on the
// right (Properties.tsx).
// - LayersPanel: the frame's format on top, compact; then the frame and its layers as they stack, the top one first:
//   logo, headline, the line, the call to action, the shade, the picture. A row picks its layer (and the canvas picks
//   it too); its eye hides it, its lock keeps it from being picked or moved on the canvas. The frame row picks nothing:
//   the right panel then shows the frame.
// - CanvasLayers: the layers drawn on the board in the brand's design system (its typefaces, sizes, colours and its
//   call to action), each a box to pick. Every layer listed is on the canvas, or listed as hidden.
//   Round 16 (PROPOSED 9 Nov 2026), as in Figma: a layer is dragged on the canvas and snaps to the layout grid, the
//   safe area and the middle (⌘ held places it freely, Shift keeps it on one axis); the selected one has a handle on
//   each side for its width; the arrow keys nudge it (Shift for ten). The layout grid (⇧G) is drawn over the frame.
import { Button, Icon, type IconName } from "@fume/ui";
import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { useBrandBooks, usePlacements } from "../../../api/hooks";
import type {
  BrandBook,
  CreativeDocument,
  DesignBook,
  Format,
  Layer,
  RenderVersion,
  Specs,
  Variables,
} from "../../../contract";
import { PlacementPicker } from "./formats";
import { useFonts } from "./graphic";
import {
  ctaOf,
  FRAME,
  gridOf,
  gridTracks,
  inkOf,
  layerName,
  logoInk,
  roleOf,
  snapAxis,
  snapLines,
  typeOf,
  type LayerRole,
} from "./layers";

/** The brand's design system in use: approved, else checked, else the newest draft (as Fume designs with). */
export function useDesignSystem(): DesignBook | undefined {
  const books = useBrandBooks().data;
  return useMemo(() => {
    const written = (books?.design ?? []).filter(
      (b): b is Extract<BrandBook, { kind: "design" }> & { body: DesignBook } => b.kind === "design" && Boolean(b.body),
    );
    for (const state of ["approved", "checked", "draft"] as const) {
      const b = written.filter((x) => x.state === state).sort((a, z) => z.version - a.version)[0];
      if (b) return b.body;
    }
    return undefined;
  }, [books]);
}

const icons: Record<LayerRole, IconName> = {
  logo: "tag",
  headline: "type",
  subline: "type",
  text: "type",
  cta: "arrow-up-right",
  shade: "square",
  picture: "image",
};

/** The second line of a row: the words, the logo's version, the picture's version, where the shade comes from. */
function detailOf(l: Layer, pictureNumber: number | undefined): string | undefined {
  const role = roleOf(l);
  if (role === "picture") return pictureNumber ? `V${pictureNumber}` : undefined;
  if (role === "shade") return l.shade?.from === "bottom" ? "From the foot" : "From the top";
  if (role === "logo") return l.variant ?? "Wordmark";
  return l.text;
}

export interface LayersPanelProps {
  doc: CreativeDocument;
  specs: Specs;
  onSpecs: (specs: Specs, key: string) => void;
  /** The layers on the board, bottom first (as they are kept). */
  layers: Layer[];
  /** The version Fume designed, when the layers are Fume's. */
  design?: RenderVersion;
  /** The picture's version number (the one under Fume's design, or the version on the board). */
  pictureNumber?: number;
  selected?: string;
  onSelect: (id: string | undefined) => void;
  onLayers: (layers: Layer[], key: string) => void;
}

export function LayersPanel({
  doc,
  specs,
  onSpecs,
  layers,
  design,
  pictureNumber,
  selected,
  onSelect,
  onLayers,
}: LayersPanelProps) {
  const placements = usePlacements().data;
  const [W, H] = FRAME[specs.format];
  const set = (id: string, change: Partial<Layer>, key: string) =>
    onLayers(
      layers.map((l) => (l.id === id ? { ...l, ...change } : l)),
      `layer-${id}-${key}`,
    );
  // Up and down move through the rows, as in Figma's layers.
  const rows = [undefined, ...[...layers].reverse().map((l) => l.id)];
  const move = (e: KeyboardEvent<HTMLUListElement>) => {
    const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const at = rows.indexOf(selected);
    const next = rows[Math.min(rows.length - 1, Math.max(0, at + step))];
    onSelect(next);
    requestAnimationFrame(() =>
      e.currentTarget
        ?.querySelector<HTMLElement>(`[data-row="${next ?? "frame"}"] .ui-desk-layer-pick`)
        ?.focus({ preventScroll: false }),
    );
  };
  return (
    <aside className="ui-desk-panel ui-desk-specs ui-desk-layerbar" aria-label="Layers">
      {placements && (
        <div className="ui-desk-frame-set">
          <PlacementPicker
            compact
            placements={placements}
            specs={specs}
            onPick={(p) => onSpecs({ ...specs, placementId: p.id, format: p.format }, "placement")}
          />
        </div>
      )}
      <div className="ui-desk-layerbar-head">
        <h2 className="ui-desk-panel-title">Layers</h2>
        <span className="ui-desk-layerbar-meta">
          {design ? `By Fume · V${design.number}` : `${layers.length} layers`}
        </span>
      </div>
      {design && design.state !== "done" ? (
        <p className="ui-sc-help ui-desk-layerbar-note">Fume is designing V{design.number}. Its layers come with it.</p>
      ) : (
        <ul className="ui-desk-layer-list ui-desk-layer-tree" aria-label="Layers" onKeyDown={move}>
          <li className="ui-desk-layer-row" data-row="frame" aria-current={selected ? undefined : "true"}>
            <button type="button" className="ui-desk-layer-pick" onClick={() => onSelect(undefined)}>
              <Icon name="crop" />
              <span className="ui-desk-layer-name">
                Frame
                <span className="ui-desk-layer-text">{`${W} × ${H}`}</span>
              </span>
            </button>
          </li>
          {[...layers].reverse().map((l) => {
            const name = layerName(l);
            return (
              <li
                key={l.id}
                className="ui-desk-layer-row"
                data-row={l.id}
                data-depth="1"
                data-hidden={l.visible ? undefined : ""}
                aria-current={selected === l.id ? "true" : undefined}
              >
                <button type="button" className="ui-desk-layer-pick" onClick={() => onSelect(l.id)}>
                  <Icon name={icons[roleOf(l)]} />
                  <span className="ui-desk-layer-name">
                    {name}
                    {detailOf(l, pictureNumber) && (
                      <span className="ui-desk-layer-text">{detailOf(l, pictureNumber)}</span>
                    )}
                  </span>
                </button>
                <Button
                  size="sm"
                  variant="quiet"
                  iconOnly
                  icon={l.locked ? "lock" : "lock-open"}
                  className="ui-desk-layer-lock"
                  data-on={l.locked ? "" : undefined}
                  aria-pressed={Boolean(l.locked)}
                  aria-label={l.locked ? `Unlock ${name}` : `Lock ${name}`}
                  onClick={() => set(l.id, { locked: !l.locked }, "locked")}
                />
                <Button
                  size="sm"
                  variant="quiet"
                  iconOnly
                  icon={l.visible ? "eye" : "eye-off"}
                  className="ui-desk-layer-eye"
                  data-hidden={l.visible ? undefined : ""}
                  aria-pressed={!l.visible}
                  aria-label={l.visible ? `Hide ${name}` : `Show ${name}`}
                  onClick={() => set(l.id, { visible: !l.visible }, "visible")}
                />
              </li>
            );
          })}
        </ul>
      )}
      <p className="ui-sr-only">{doc.title}</p>
    </aside>
  );
}

// ─── On the canvas ───────────────────────────────────────────────────────────

/** A drag on the canvas: moving a layer, or pulling one of its sides. */
interface Drag {
  id: string;
  edge?: "start" | "end";
  pointer: { x: number; y: number };
  /** The layer's box when the drag began, 0–1 of the frame (its height as drawn). */
  box: { x: number; y: number; w: number; h: number };
  /** The frame on screen, for pixels to fractions. */
  frame: { width: number; height: number };
  moved: boolean;
}

/** Where a dragged layer is now, and the lines it snapped to (drawn as guides). */
interface Live {
  id: string;
  x: number;
  y: number;
  w: number;
  guides: { x?: number; y?: number };
}

/** Pixels a press must travel before it is a drag, not a click. */
const DRAG_FROM = 3;

/** The layers drawn over the picture, each a box to pick (a locked one only shows), to drag and to size. */
export function CanvasLayers({
  layers,
  variables,
  format,
  brandName,
  selected,
  onSelect,
  onLayers,
  gridShown = false,
  snap = true,
  readOnly,
}: {
  layers: Layer[];
  variables: Variables;
  format: Format;
  brandName: string;
  selected?: string;
  onSelect: (id: string | undefined) => void;
  /** A layer dragged, sized or nudged here; without it the layers are only picked. */
  onLayers?: (layers: Layer[], key: string) => void;
  /** The layout grid drawn over the frame (⇧G). */
  gridShown?: boolean;
  /** A dragged layer snaps to the grid, the safe area and the middle. */
  snap?: boolean;
  readOnly: boolean;
}) {
  const book = useDesignSystem();
  useFonts(book ? [...new Set(book.typefaces.map((t) => t.fallback || t.family))] : []);
  const [W, H] = FRAME[format];
  const grid = gridOf(variables, book, format, brandName).grid;
  const lines = snapLines(grid, book, format);
  const surface = useRef<HTMLSpanElement>(null);
  const drag = useRef<Drag | null>(null);
  // The drag's place is kept in a ref as well: a pointer let go in the same frame as its last move reads it there.
  const [live, setLiveState] = useState<Live | null>(null);
  const liveRef = useRef<Live | null>(null);
  const setLive = (next: Live | null) => {
    liveRef.current = next;
    setLiveState(next);
  };
  const movable = (l: Layer) => Boolean(onLayers) && !readOnly && !l.locked;
  const minWidth = (l: Layer) => (roleOf(l) === "logo" ? (book?.logo.minWidthPx ?? 80) : 40) / W;
  const commit = (id: string, change: Partial<Layer>, key: string) =>
    onLayers?.(
      layers.map((l) => (l.id === id ? { ...l, ...change } : l)),
      `layer-${id}-${key}`,
    );

  const begin = (e: PointerEvent<HTMLElement>, l: Layer, edge?: Drag["edge"]) => {
    if (!movable(l) || e.button !== 0 || !surface.current) return;
    if (edge) e.stopPropagation();
    const frame = surface.current.getBoundingClientRect();
    const own = (e.currentTarget.closest(".ui-desk-layer") ?? e.currentTarget).getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      id: l.id,
      edge,
      pointer: { x: e.clientX, y: e.clientY },
      box: { x: l.x, y: l.y, w: l.w, h: own.height / frame.height },
      frame: { width: frame.width, height: frame.height },
      moved: false,
    };
    if (selected !== l.id) onSelect(l.id);
  };
  const follow = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const px = e.clientX - d.pointer.x;
    const py = e.clientY - d.pointer.y;
    if (!d.moved && Math.hypot(px, py) < DRAG_FROM) return;
    d.moved = true;
    const free = !snap || e.metaKey || e.ctrlKey;
    let dx = px / d.frame.width;
    let dy = py / d.frame.height;
    const layer = layers.find((l) => l.id === d.id)!;
    if (d.edge) {
      // One side pulled: the other stays where it is.
      const right = d.box.x + d.box.w;
      if (d.edge === "end") {
        const edge = free ? { at: right + dx, line: undefined } : snapAxis(right + dx, 0, lines.xs, W);
        const w = Math.max(minWidth(layer), Math.min(1 - d.box.x, edge.at - d.box.x));
        setLive({ id: d.id, x: d.box.x, y: d.box.y, w, guides: { x: edge.line } });
      } else {
        const edge = free ? { at: d.box.x + dx, line: undefined } : snapAxis(d.box.x + dx, 0, lines.xs, W);
        const x = Math.max(0, Math.min(right - minWidth(layer), edge.at));
        setLive({ id: d.id, x, y: d.box.y, w: right - x, guides: { x: edge.line } });
      }
      return;
    }
    // Shift keeps it on the axis it went further along, as in Figma.
    if (e.shiftKey) {
      if (Math.abs(px) >= Math.abs(py)) dy = 0;
      else dx = 0;
    }
    const sx = free ? { at: d.box.x + dx, line: undefined } : snapAxis(d.box.x + dx, d.box.w, lines.xs, W);
    const sy = free ? { at: d.box.y + dy, line: undefined } : snapAxis(d.box.y + dy, d.box.h, lines.ys, H);
    const x = Math.min(1 - d.box.w, Math.max(0, sx.at));
    const y = Math.min(1 - d.box.h, Math.max(0, sy.at));
    setLive({ id: d.id, x, y, w: d.box.w, guides: { x: sx.line, y: sy.line } });
  };
  const end = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    const live = liveRef.current;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current = null;
    if (d?.moved && live?.id === d.id) {
      const layer = layers.find((l) => l.id === d.id)!;
      const logo = roleOf(layer) === "logo";
      commit(
        d.id,
        d.edge
          ? { x: round(live.x), w: round(live.w), ...(logo ? { h: round((live.w * W * 0.24) / H) } : {}) }
          : { x: round(live.x), y: round(live.y) },
        d.edge ? "w" : "drag",
      );
    }
    setLive(null);
  };
  const cancel = () => {
    drag.current = null;
    setLive(null);
  };
  // The arrow keys nudge the picked layer a pixel (ten with Shift), as in Figma.
  const nudge = (e: KeyboardEvent<HTMLButtonElement>, l: Layer) => {
    const by = e.shiftKey ? 10 : 1;
    const step = (
      { ArrowLeft: [-by, 0], ArrowRight: [by, 0], ArrowUp: [0, -by], ArrowDown: [0, by] } as Record<
        string,
        [number, number]
      >
    )[e.key];
    if (!step || !movable(l)) return;
    e.preventDefault();
    commit(
      l.id,
      { x: round(Math.min(1 - l.w, Math.max(0, l.x + step[0] / W))), y: round(Math.max(0, l.y + step[1] / H)) },
      "nudge",
    );
  };

  const tracks = gridShown ? gridTracks(grid, format) : undefined;
  return (
    <span className="ui-desk-layers" ref={surface} data-dragging={live ? "" : undefined}>
      {tracks && (
        <span className="ui-desk-grid" aria-hidden="true" data-lines={grid.gutterPx === 0 ? "" : undefined}>
          {tracks.columns.map((c, i) => (
            <span
              key={`c${i}`}
              className="ui-desk-grid-col"
              style={{ "--start": c.start, "--end": c.end } as CSSProperties}
            />
          ))}
          {tracks.rows.map((r, i) => (
            <span
              key={`r${i}`}
              className="ui-desk-grid-row"
              style={{ "--start": r.start, "--end": r.end } as CSSProperties}
            />
          ))}
        </span>
      )}
      {live?.guides.x !== undefined && (
        <span
          className="ui-desk-guide"
          data-axis="x"
          aria-hidden="true"
          style={{ "--at": live.guides.x } as CSSProperties}
        />
      )}
      {live?.guides.y !== undefined && (
        <span
          className="ui-desk-guide"
          data-axis="y"
          aria-hidden="true"
          style={{ "--at": live.guides.y } as CSSProperties}
        />
      )}
      {layers
        .filter((l) => l.visible && roleOf(l) !== "picture")
        .map((l) => {
          const role = roleOf(l);
          if (role === "shade")
            return (
              <span
                key={l.id}
                className="ui-desk-layer-shade"
                data-from={l.shade?.from ?? "top"}
                data-selected={selected === l.id ? "" : undefined}
                style={{ "--shade": l.shade?.opacity ?? 0.3 } as CSSProperties}
                aria-hidden="true"
              />
            );
          const name = layerName(l);
          const at = live?.id === l.id ? live : l;
          const box = { "--x": at.x, "--y": at.y, "--w": at.w, "--h": l.h } as Record<string, string | number>;
          if (book && role === "logo") {
            const logo = book.typefaces.find((t) => t.role === "display") ?? book.typefaces[0]!;
            Object.assign(box, {
              "--layer-font": `"${logo.family}", "${logo.fallback}", Georgia, serif`,
              "--layer-size": (l.w * W) / 4.4,
              "--layer-ink": logoInk(l, book) ?? "",
            });
          } else if (book) {
            const t = typeOf(l, book);
            Object.assign(box, {
              "--layer-font": t.family,
              "--layer-size": t.sizePx,
              "--layer-weight": t.weight,
              "--layer-leading": t.lineHeight,
              "--layer-tracking": `${t.trackingEm}em`,
              "--layer-ink": inkOf(l, book, variables) ?? "",
            });
            if (role === "cta") {
              const c = ctaOf(book);
              Object.assign(box, {
                "--layer-fill": c.fill ?? "",
                "--layer-radius": Math.min(c.radiusPx, 999),
                "--layer-pad": c.paddingPx,
              });
            }
          } else if (l.colour || typeof variables.textColour === "string") {
            box["--layer-ink"] = l.colour ?? String(variables.textColour);
          }
          return (
            <button
              key={l.id}
              type="button"
              className="ui-desk-layer"
              data-kind={l.kind}
              data-role={role}
              data-style={l.style}
              data-typo={book ? "" : undefined}
              data-align={l.align ?? "left"}
              data-upper={book && role !== "logo" && typeOf(l, book).upper ? "" : undefined}
              aria-pressed={selected === l.id}
              aria-label={`${name} layer`}
              data-movable={movable(l) ? "" : undefined}
              data-dragged={live?.id === l.id ? "" : undefined}
              disabled={readOnly || l.locked}
              style={box as CSSProperties}
              onClick={() => onSelect(l.id)}
              onKeyDown={(e) => nudge(e, l)}
              onPointerDown={(e) => begin(e, l)}
              onPointerMove={follow}
              onPointerUp={end}
              onPointerCancel={cancel}
            >
              <span className="ui-desk-layer-words">{role === "logo" ? brandName.toUpperCase() : l.text}</span>
              {selected === l.id && movable(l) && role !== "cta" && (
                <>
                  {(["start", "end"] as const).map((edge) => (
                    <span
                      key={edge}
                      className="ui-desk-layer-handle"
                      data-edge={edge}
                      aria-hidden="true"
                      title="Drag for the width"
                      onPointerDown={(e) => begin(e, l, edge)}
                    />
                  ))}
                </>
              )}
            </button>
          );
        })}
    </span>
  );
}

const round = (n: number) => Math.round(n * 10000) / 10000;
