// Format is the placement; the ratio follows (FLOWS §15), and Make formats (FLOWS §16). PROPOSED 15 Oct 2026.
// - PlacementPicker: in the Output section, a row that opens the placements grouped by where they run (Instagram,
//   Meta ads, Pinterest, Email, Web), each with its ratio as a small proportional frame. Under it a quiet line says
//   how it is made: natively when the image model renders that ratio, otherwise at the nearest ratio and cropped.
// - SafeZones: the chosen placement's frame and safe zones over the creative on the board.
// - MakeFormats: a strip over the versions. Pick the target placements, the Engine makes each one and says how
//   (native, crop or expand) and why; the designer switches crop and expand per tile and moves a crop's window.
// Styles: design-system/components/studio-formats.css.
import {
  Button,
  Icon,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  SegmentedControl,
  SegmentedOption,
  Skeleton,
  StudioRow,
  TextShimmer,
  ToggleGroup,
  ToggleGroupItem,
  useToast,
} from "@fume/ui";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { useMakeFormats, useSetFormatTile } from "../../../api/hooks";
import type { CreativeDocument, Format, FormatTile, Placement, RenderVersion, Specs } from "../../../contract";

// ─── Ratios ──────────────────────────────────────────────────────────────────

/** "9:16" → 0.5625 (width over height). */
export const ratioNum = (r: string) => {
  const [w, h] = r.split(":").map(Number);
  return w && h ? w / h : 1;
};

const FORMAT_RATIO: Record<Format, string> = { feed: "4:5", square: "1:1", story: "9:16" };

/** The placement the specs are made for: the one picked, or the first that matches the short format. */
export function placementOf(
  specs: Pick<Specs, "placementId" | "format">,
  placements: Placement[],
): Placement | undefined {
  return placements.find((p) => p.id === specs.placementId) ?? placements.find((p) => p.format === specs.format);
}

/** The ratio a version was rendered at, as a number. */
export function versionRatio(v: RenderVersion | undefined, placements: Placement[]): number {
  if (!v) return ratioNum(FORMAT_RATIO.feed);
  const p = placements.find((x) => x.id === v.specs.placementId);
  return ratioNum(p?.ratio ?? FORMAT_RATIO[v.specs.format] ?? "4:5");
}

/** Staff only: the ratios each image model renders natively. A small local map until the Engine reports it. */
const MODEL_RATIOS: Record<string, string[]> = {
  "Nano Banana Pro": ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
  "Seedream 4": ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"],
  "FLUX Kontext Pro": ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9"],
  "Imagen 4": ["1:1", "3:4", "4:3", "9:16", "16:9"],
};

/** How a placement is made with this image model: natively at its ratio, or at the nearest one and cropped. */
export function howMade(p: Placement, model: string): string {
  const native = MODEL_RATIOS[model] ?? ["1:1"];
  if (native.includes(p.ratio)) return `Rendered at ${p.ratio}`;
  const want = Math.log(ratioNum(p.ratio));
  const nearest = [...native].sort(
    (a, b) => Math.abs(Math.log(ratioNum(a)) - want) - Math.abs(Math.log(ratioNum(b)) - want),
  )[0];
  return `Rendered at ${nearest} and cropped to ${p.ratio}`;
}

/** A frame of `ratio` fitted inside a square: its width and height as 0–1 of the square. */
function fit(ratio: number) {
  return ratio >= 1 ? { fw: 1, fh: 1 / ratio } : { fw: ratio, fh: 1 };
}

/** The small proportional frame that shows a ratio. */
export function RatioFrame({ ratio, className }: { ratio: string; className?: string }) {
  const { fw, fh } = fit(ratioNum(ratio));
  return (
    <span
      className={className ? `ui-fmt-ratio ${className}` : "ui-fmt-ratio"}
      style={{ "--fw": fw, "--fh": fh } as CSSProperties}
      aria-hidden="true"
    />
  );
}

const GROUPS = ["Instagram", "Meta ads", "Pinterest", "Email", "Web"];
const grouped = (placements: Placement[]) => {
  const names = [...GROUPS, ...placements.map((p) => p.group).filter((g) => !GROUPS.includes(g))];
  return [...new Set(names)]
    .map((g) => ({ group: g, items: placements.filter((p) => p.group === g) }))
    .filter((g) => g.items.length);
};

// ─── The format picker ───────────────────────────────────────────────────────

export function PlacementPicker({
  placements,
  specs,
  onPick,
}: {
  placements: Placement[];
  specs: Specs;
  onPick: (p: Placement) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = placementOf(specs, placements);
  return (
    <StudioRow
      label="Format"
      labelId="spec-placement-l"
      help={
        current ? (
          <>
            {howMade(current, specs.imageModel)}
            {current.textLimit && <span className="ui-fmt-limit">{current.textLimit}</span>}
          </>
        ) : undefined
      }
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="ui-fmt-pick" aria-labelledby="spec-placement-l spec-placement-v">
            {current && <RatioFrame ratio={current.ratio} />}
            <span className="ui-fmt-pick-text" id="spec-placement-v">
              <span className="ui-fmt-pick-name">{current?.name ?? "Choose a format"}</span>
              {current && <span className="ui-fmt-pick-ratio">{current.ratio}</span>}
            </span>
            <Icon name="chevrons-up-down" className="ui-fmt-pick-icon" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" className="ui-fmt-popover" aria-labelledby="fmt-title">
          <PopoverHeader>
            <PopoverTitle id="fmt-title">Formats</PopoverTitle>
            <PopoverDescription>Pick where it runs. The ratio, safe zones and text limits follow.</PopoverDescription>
          </PopoverHeader>
          <div className="ui-fmt-groups">
            {grouped(placements).map(({ group, items }) => (
              <div
                key={group}
                className="ui-fmt-group"
                role="group"
                aria-labelledby={`fmt-g-${group.replace(/\W+/g, "-")}`}
              >
                <p className="ui-fmt-group-title" id={`fmt-g-${group.replace(/\W+/g, "-")}`}>
                  {group}
                </p>
                <ul className="ui-fmt-options">
                  {items.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="ui-fmt-option"
                        aria-current={p.id === current?.id ? "true" : undefined}
                        onClick={() => {
                          setOpen(false);
                          if (p.id !== current?.id) onPick(p);
                        }}
                      >
                        <RatioFrame ratio={p.ratio} />
                        <span className="ui-fmt-option-name">{p.name}</span>
                        <span className="ui-fmt-option-ratio">{p.ratio}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </StudioRow>
  );
}

// ─── Safe zones on the board ─────────────────────────────────────────────────

/** The window a ratio takes out of a source of another ratio, centred, 0–1. */
function windowOf(target: number, source: number) {
  if (Math.abs(target - source) < 0.01) return { x: 0, y: 0, w: 1, h: 1 };
  if (target < source) {
    const w = target / source;
    return { x: (1 - w) / 2, y: 0, w, h: 1 };
  }
  const h = source / target;
  return { x: 0, y: (1 - h) / 2, w: 1, h };
}

/** The chosen placement over the creative: what a crop keeps, and the safe zone the platform leaves free. */
export function SafeZones({ placement, sourceRatio }: { placement: Placement; sourceRatio: number }) {
  const win = windowOf(ratioNum(placement.ratio), sourceRatio);
  const cropped = win.w < 1 || win.h < 1;
  const s = placement.safe;
  return (
    <span
      className="ui-fmt-safe"
      style={
        {
          "--x": win.x,
          "--y": win.y,
          "--w": win.w,
          "--h": win.h,
          "--st": s.top,
          "--sb": s.bottom,
          "--sl": s.left,
          "--sr": s.right,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      {cropped && <span className="ui-fmt-safe-out" />}
      <span className="ui-fmt-safe-window">
        <span className="ui-fmt-safe-band" />
        <span className="ui-fmt-safe-label">
          {placement.name} · {placement.ratio}
          {cropped ? " · cropped" : ""}
        </span>
      </span>
    </span>
  );
}

// ─── Make formats ────────────────────────────────────────────────────────────

const methodWord = { native: "Native", crop: "Crop", expand: "Expand" } as const;

export function MakeFormats({
  doc,
  placements,
  source,
  onClose,
}: {
  doc: CreativeDocument;
  placements: Placement[];
  source?: RenderVersion;
  onClose: () => void;
}) {
  const make = useMakeFormats();
  const toast = useToast();
  const tiles = doc.formats ?? [];
  const current = placementOf(doc.specs, placements);
  const [choosing, setChoosing] = useState(tiles.length === 0);
  const [targets, setTargets] = useState<string[]>(() => tiles.map((t) => t.placementId));
  const options = placements.filter((p) => p.id !== current?.id);
  const byId = (id: string) => placements.find((p) => p.id === id);
  const making = tiles.filter((t) => t.state === "making").length;

  const go = () =>
    make.mutate(
      { documentId: doc.id, placementIds: targets },
      {
        onSuccess: () => setChoosing(false),
        onError: (e) => toast.error("The formats didn’t start", { description: e.message }),
      },
    );

  return (
    <section className="ui-fmt-strip" aria-labelledby="fmt-strip-title">
      <header className="ui-fmt-strip-head">
        <h2 className="ui-fmt-strip-title" id="fmt-strip-title">
          Make formats
          <span className="ui-fmt-strip-sub">
            {source
              ? `from version ${source.number}${current ? `, ${current.name} ${current.ratio}` : ""}`
              : "Render and pick a version first"}
            {!choosing && making > 0 ? ` · the Engine is making ${making}` : ""}
          </span>
        </h2>
        <div className="ui-fmt-strip-actions">
          {choosing ? (
            <>
              {tiles.length > 0 && (
                <Button size="sm" variant="quiet" onClick={() => setChoosing(false)}>
                  Back to the formats
                </Button>
              )}
              <Button size="sm" icon="crop" loading={make.isPending} disabled={!targets.length || !source} onClick={go}>
                {targets.length
                  ? `Make ${targets.length} ${targets.length === 1 ? "format" : "formats"}`
                  : "Make formats"}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="secondary" icon="plus" onClick={() => setChoosing(true)}>
              Change the formats
            </Button>
          )}
          <Button size="sm" variant="quiet" iconOnly icon="x" aria-label="Close Make formats" onClick={onClose} />
        </div>
      </header>

      {choosing ? (
        <ToggleGroup
          type="multiple"
          size="sm"
          variant="outline"
          className="ui-fmt-targets"
          aria-label="Formats to make"
          value={targets}
          onValueChange={setTargets}
        >
          {options.map((p) => (
            <ToggleGroupItem key={p.id} value={p.id}>
              {p.name} <span className="ui-fmt-chip-ratio">{p.ratio}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      ) : (
        <ol className="ui-fmt-tiles" aria-label="Formats">
          {tiles.map((t) => {
            const p = byId(t.placementId);
            return p ? (
              <FormatTileView
                key={t.placementId}
                doc={doc}
                tile={t}
                placement={p}
                source={source}
                sourceRatio={versionRatio(source, placements)}
              />
            ) : null;
          })}
        </ol>
      )}
    </section>
  );
}

function FormatTileView({
  doc,
  tile,
  placement,
  source,
  sourceRatio,
}: {
  doc: CreativeDocument;
  tile: FormatTile;
  placement: Placement;
  source?: RenderVersion;
  sourceRatio: number;
}) {
  const set = useSetFormatTile();
  const toast = useToast();
  const making = tile.state === "making";
  const why =
    tile.method === tile.engineChose
      ? `The Engine chose ${methodWord[tile.method].toLowerCase()}. ${tile.why}`
      : `You switched to ${methodWord[tile.method].toLowerCase()}. The Engine chose ${methodWord[tile.engineChose].toLowerCase()}.`;
  return (
    <li className="ui-fmt-tile" data-state={tile.state} aria-busy={making ? "true" : undefined}>
      <FormatPreview doc={doc} tile={tile} placement={placement} source={source} sourceRatio={sourceRatio} />
      <div className="ui-fmt-tile-text">
        <p className="ui-fmt-tile-name">
          <span className="ui-fmt-tile-title">{placement.name}</span>
          <span className="ui-fmt-tile-ratio">{placement.ratio}</span>
        </p>
        {tile.method === "native" ? (
          <p className="ui-fmt-tile-native">
            <Icon name="circle-check" /> Native, same ratio
          </p>
        ) : (
          <SegmentedControl
            className="ui-fmt-method"
            aria-label={`How ${placement.name} is made`}
            value={tile.method}
            onValueChange={(m) =>
              m !== tile.method &&
              set.mutate(
                { documentId: doc.id, placementId: tile.placementId, change: { method: m as FormatTile["method"] } },
                { onError: (e) => toast.error("That didn’t change", { description: e.message }) },
              )
            }
          >
            <SegmentedOption value="crop">Crop</SegmentedOption>
            <SegmentedOption value="expand">Expand</SegmentedOption>
          </SegmentedControl>
        )}
        <p className="ui-fmt-tile-why" title={why}>
          {making ? (
            <TextShimmer>
              {tile.method === "expand" ? "The Engine is extending the scene" : "The Engine is making it"}
            </TextShimmer>
          ) : (
            why
          )}
        </p>
      </div>
    </li>
  );
}

/** The tile's picture: for a crop, the source with its window you can drag; otherwise the made format. */
function FormatPreview({
  doc,
  tile,
  placement,
  source,
  sourceRatio,
}: {
  doc: CreativeDocument;
  tile: FormatTile;
  placement: Placement;
  source?: RenderVersion;
  sourceRatio: number;
}) {
  const target = ratioNum(placement.ratio);
  if (tile.method === "crop" && source)
    return <CropPreview doc={doc} tile={tile} placement={placement} source={source} sourceRatio={sourceRatio} />;
  const { fw, fh } = fit(target);
  const image = tile.method === "native" ? (tile.image ?? source?.image) : tile.image;
  return (
    <span className="ui-fmt-preview">
      <span className="ui-fmt-frame" style={{ "--fw": fw, "--fh": fh } as CSSProperties}>
        {tile.state === "making" || !image ? (
          <Skeleton className="ui-fmt-skeleton" />
        ) : (
          <img src={image} alt={`${placement.name}, ${placement.ratio}`} />
        )}
      </span>
    </span>
  );
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function CropPreview({
  doc,
  tile,
  placement,
  source,
  sourceRatio,
}: {
  doc: CreativeDocument;
  tile: FormatTile;
  placement: Placement;
  source: RenderVersion;
  sourceRatio: number;
}) {
  const set = useSetFormatTile();
  const frame = useRef<HTMLSpanElement>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number }>();
  const start = tile.crop ?? windowOf(ratioNum(placement.ratio), sourceRatio);
  const [crop, setCrop] = useState(start);
  useEffect(
    () => setCrop(tile.crop ?? windowOf(ratioNum(placement.ratio), sourceRatio)),
    [tile.crop, placement.ratio, sourceRatio],
  );
  const { fw, fh } = fit(sourceRatio);

  const send = (c: typeof crop) =>
    set.mutate({ documentId: doc.id, placementId: tile.placementId, change: { crop: c } });
  const move = (dx: number, dy: number) => {
    const c = { ...crop, x: clamp(crop.x + dx, 0, 1 - crop.w), y: clamp(crop.y + dy, 0, 1 - crop.h) };
    setCrop(c);
    return c;
  };

  const down = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, x: crop.x, y: crop.y };
  };
  const moveTo = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    const box = frame.current?.getBoundingClientRect();
    if (!d || !box) return;
    setCrop((c) => ({
      ...c,
      x: clamp(d.x + (e.clientX - d.px) / box.width, 0, 1 - c.w),
      y: clamp(d.y + (e.clientY - d.py) / box.height, 0, 1 - c.h),
    }));
  };
  const up = () => {
    if (!drag.current) return;
    drag.current = undefined;
    send(crop);
  };
  const key = (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    send(move(d[0], d[1]));
  };

  return (
    <span className="ui-fmt-preview">
      <span ref={frame} className="ui-fmt-frame" style={{ "--fw": fw, "--fh": fh } as CSSProperties}>
        <img src={source.image} alt="" draggable={false} />
        <span
          className="ui-fmt-crop-out"
          style={{ "--x": crop.x, "--y": crop.y, "--w": crop.w, "--h": crop.h } as CSSProperties}
          aria-hidden="true"
        />
        <button
          type="button"
          className="ui-fmt-crop"
          style={{ "--x": crop.x, "--y": crop.y, "--w": crop.w, "--h": crop.h } as CSSProperties}
          aria-label={`Move the ${placement.name} crop. Drag, or use the arrow keys.`}
          onPointerDown={down}
          onPointerMove={moveTo}
          onPointerUp={up}
          onPointerCancel={up}
          onKeyDown={key}
        />
      </span>
    </span>
  );
}
