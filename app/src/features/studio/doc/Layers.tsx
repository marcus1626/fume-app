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
import { Button, Icon, type IconName } from "@fume/ui";
import { useMemo, type CSSProperties, type KeyboardEvent } from "react";
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
import { ctaOf, FRAME, inkOf, layerName, logoInk, roleOf, typeOf, type LayerRole } from "./layers";

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
                  icon="lock"
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
                  icon="eye"
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

/** The layers drawn over the picture, each a box to pick (a locked one only shows). */
export function CanvasLayers({
  layers,
  variables,
  format,
  brandName,
  selected,
  onSelect,
  readOnly,
}: {
  layers: Layer[];
  variables: Variables;
  format: Format;
  brandName: string;
  selected?: string;
  onSelect: (id: string | undefined) => void;
  readOnly: boolean;
}) {
  const book = useDesignSystem();
  useFonts(book ? [...new Set(book.typefaces.map((t) => t.fallback || t.family))] : []);
  const [W] = FRAME[format];
  return (
    <span className="ui-desk-layers">
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
          const box = { "--x": l.x, "--y": l.y, "--w": l.w, "--h": l.h } as Record<string, string | number>;
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
              disabled={readOnly || l.locked}
              style={box as CSSProperties}
              onClick={() => onSelect(l.id)}
            >
              <span className="ui-desk-layer-words">{role === "logo" ? brandName.toUpperCase() : l.text}</span>
            </button>
          );
        })}
    </span>
  );
}
