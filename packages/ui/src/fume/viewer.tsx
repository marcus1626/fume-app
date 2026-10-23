// Creative viewer: full screen on Ink (design-system/components/viewer.css, behaviour from viewer.js).
// Modal on Radix Dialog (focus trap, Escape, focus back to the creative you came from,
// the page stops scrolling); inline (in place on a page) as a region with the same screen and keys.
// Keys inside: the arrows move, + and - zoom, 0 fits, I shows the info, F expands, Escape closes (inline:
// Escape brings the tools back). A swipe of --ui-viewer-swipe moves on touch; past fit a drag pans; a double
// press zooms to 2x and back. Download is the one white button on the glass bar, Share is clear.
// The toast after Download ("Downloading Feed · 03") is the app's.
import * as Dialog from "@radix-ui/react-dialog";
import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { cx } from "../cx";
import { Icon } from "../icons";
import { Btn, formatAttrs, tokenPx, vars, type CreativeFormat } from "./_parts";

const LEVELS = [1, 1.5, 2, 3];

/** The format as the viewer names it. */
export const VIEWER_FORMAT_LABEL: Record<CreativeFormat, string> = {
  feed: "Feed · 4:5",
  story: "Story · 9:16",
  banner: "Banner · 1.91:1",
  square: "Square · 1:1",
};

export interface ViewerFact {
  label: string;
  value: ReactNode;
  /** Set in the data type (sizes, ids). */
  data?: boolean;
}

export interface ViewerItem {
  src: string;
  alt: string;
  /** "Feed · 03". */
  name: string;
  /** "Autumn launch · LYSNE". */
  campaign?: string;
  /** "Night Body Oil", before the campaign in the info head. */
  product?: string;
  format: CreativeFormat;
  /** "1080 × 1350" (data). */
  size?: string;
  /** "Run 214 · 12 Oct 14:02". */
  run?: string;
  /** The expert's check: the Amber triangle beside "Checked · Anna" and the time; grey beside "In check". */
  check?: { state: "checked" | "in_check"; by?: string; time?: string };
  /** More rows for the info list, after Format, Size and Engine run. */
  facts?: ViewerFact[];
}

export interface CreativeViewerProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  items: ViewerItem[];
  /** The creative shown (0-based). Moves wrap round. */
  index: number;
  onIndexChange: (index: number) => void;
  /** Modal (default) or in place on a page. */
  inline?: boolean;
  /** Modal only. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Download: without it the viewer saves the image under a name made from the creative's. */
  onDownload?: (item: ViewerItem) => void;
  /** Share: shows the Share button (open ShareDialog from here). */
  onShare?: (item: ViewerItem) => void;
  /** aria-label: "Creative viewer". */
  label?: string;
  closeLabel?: string;
  downloadLabel?: string;
  shareLabel?: string;
  /** The info panel's label: "About this creative". */
  infoLabel?: string;
}

function itemSlug(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "creative"
  );
}

/** div.ui-viewer[data-state][data-info][data-chrome][data-zoomed][data-dragging] > div.ui-viewer-screen. */
export const CreativeViewer = forwardRef<HTMLDivElement, CreativeViewerProps>(function CreativeViewer(
  {
    items,
    index,
    onIndexChange,
    inline,
    open = false,
    onOpenChange,
    onDownload,
    onShare,
    label = "Creative viewer",
    closeLabel = "Close the viewer",
    downloadLabel = "Download",
    shareLabel = "Share",
    infoLabel = "About this creative",
    className,
    onKeyDown,
    ...props
  },
  ref,
) {
  const n = items.length;
  const i = n ? ((index % n) + n) % n : 0;
  const item = items[i];

  const rootRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoomState] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [info, setInfo] = useState<boolean | null>(null);
  const [chromeHidden, setChromeHidden] = useState(false);
  const [changing, setChanging] = useState(false);

  // the info shows by default when the viewer is 720 wide or more; measured when the screen mounts
  const setRoot = useCallback(
    (el: HTMLDivElement | null) => {
      rootRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
      if (el && info === null) setInfo(el.getBoundingClientRect().width >= 720);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ref],
  );

  // each opening starts with the tools in view and the info by width
  useEffect(() => {
    if (inline) return;
    if (open) setChromeHidden(false);
    else {
      setInfo(null);
      setZoomState(1);
      setPan({ x: 0, y: 0 });
    }
  }, [open, inline]);

  const clampPan = useCallback((x: number, y: number, z: number) => {
    const f = frameRef.current;
    if (!f || z <= 1) return { x: 0, y: 0 };
    const mx = ((z - 1) * f.offsetWidth) / 2,
      my = ((z - 1) * f.offsetHeight) / 2;
    return { x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) };
  }, []);

  const setZoom = useCallback(
    (z: number) => {
      const v = Math.max(LEVELS[0], Math.min(LEVELS[LEVELS.length - 1], z));
      setZoomState(v);
      setPan((p) => clampPan(p.x, p.y, v));
    },
    [clampPan],
  );
  const stepZoom = (dir: number) => {
    const at = Math.max(0, LEVELS.indexOf(zoom));
    setZoom(LEVELS[Math.max(0, Math.min(LEVELS.length - 1, at + dir))]);
  };

  // a new creative: fit, and it arrives soft to sharp
  const lastIndex = useRef(i);
  useEffect(() => {
    if (lastIndex.current !== i) {
      lastIndex.current = i;
      setChanging(true);
      setZoomState(1);
      setPan({ x: 0, y: 0 });
    }
  }, [i]);

  const go = (step: number) => {
    if (n > 1) onIndexChange((((i + step) % n) + n) % n);
  };

  const download = () => {
    if (!item) return;
    if (onDownload) return onDownload(item);
    const a = document.createElement("a");
    a.href = item.src;
    a.download = itemSlug(item.name) + ".jpg";
    document.body.appendChild(a);
    try {
      a.click();
    } finally {
      a.remove();
    }
  };

  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if ((e.target as HTMLElement).closest("input, textarea, select")) return;
    const k = e.key;
    const act: Record<string, () => void> = {
      ArrowRight: () => go(1),
      ArrowLeft: () => go(-1),
      "+": () => stepZoom(1),
      "=": () => stepZoom(1),
      "-": () => stepZoom(-1),
      _: () => stepZoom(-1),
      "0": () => setZoom(1),
      i: () => setInfo((v) => !v),
      I: () => setInfo((v) => !v),
      f: () => setChromeHidden((v) => !v),
      F: () => setChromeHidden((v) => !v),
    };
    if (act[k]) {
      e.preventDefault();
      act[k]();
    } else if (k === "Escape" && inline && chromeHidden) {
      e.preventDefault();
      setChromeHidden(false);
    }
  };

  // swipe to move, drag to pan once zoomed
  const drag = useRef<{ x: number; y: number; px: number; py: number; id: number; moved: boolean } | null>(null);
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button > 0 || (e.target as HTMLElement).closest("button, a")) return;
    drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, id: e.pointerId, moved: false };
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x,
      dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    if (!d.moved) {
      d.moved = true;
      setDragging(true);
      try {
        e.currentTarget.setPointerCapture(d.id);
      } catch {
        /* the pointer is gone */
      }
    }
    if (zoom > 1) setPan(clampPan(d.px + dx, d.py + dy, zoom));
    else setDragX(dx * 0.6);
  };
  const end = (e: ReactPointerEvent<HTMLDivElement>, cancel?: boolean) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    setDragging(false);
    setDragX(0);
    if (cancel || !d.moved || zoom > 1) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > tokenPx("--ui-viewer-swipe", 48) && Math.abs(dx) > Math.abs(e.clientY - d.y))
      go(dx < 0 ? 1 : -1);
  };

  const checked = item?.check?.state === "checked";
  const tool = (extra?: string) => cx("ui-viewer-tool", extra);

  const screen = item ? (
    <div className="ui-viewer-screen">
      <div className="ui-viewer-bar">
        <div className="ui-viewer-lead">
          {inline ? null : (
            <Dialog.Close asChild>
              <Btn variant="glass-clear" iconOnly icon="x" aria-label={closeLabel} />
            </Dialog.Close>
          )}
          <span className="ui-viewer-title">
            {inline ? (
              <b>{item.name}</b>
            ) : (
              <Dialog.Title asChild>
                <b>{item.name}</b>
              </Dialog.Title>
            )}
            {item.campaign && <small>{item.campaign}</small>}
          </span>
        </div>
        <span className="ui-viewer-count" aria-live="polite">
          {i + 1} of {n}
        </span>
        <div className="ui-viewer-tools">
          <span className="ui-viewer-zoom" role="group" aria-label="Zoom">
            <Btn
              variant="glass-clear"
              size="sm"
              iconOnly
              icon="zoom-out"
              className="ui-viewer-hide"
              aria-label="Zoom out"
              disabled={zoom <= LEVELS[0]}
              onClick={() => stepZoom(-1)}
            />
            <span className="ui-viewer-zoom-num ui-viewer-hide">
              {zoom === 1 ? "Fit" : `${Math.round(zoom * 100)} %`}
            </span>
            <Btn
              variant="glass-clear"
              size="sm"
              iconOnly
              icon="zoom-in"
              className="ui-viewer-hide"
              aria-label="Zoom in"
              disabled={zoom >= LEVELS[LEVELS.length - 1]}
              onClick={() => stepZoom(1)}
            />
          </span>
          <span className="ui-viewer-gap" aria-hidden="true" />
          <Btn
            variant="glass-clear"
            size="sm"
            iconOnly
            icon={chromeHidden ? "minimize-2" : "maximize-2"}
            className={tool()}
            aria-pressed={chromeHidden}
            aria-label={chromeHidden ? "Show the tools" : "Expand: the creative alone"}
            onClick={() => setChromeHidden((v) => !v)}
          />
          <Btn
            variant="glass-clear"
            size="sm"
            iconOnly
            icon="info"
            className={tool("ui-viewer-hide")}
            aria-pressed={!!info}
            aria-label="Info"
            onClick={() => setInfo((v) => !v)}
          />
        </div>
      </div>
      <div
        className="ui-viewer-stage"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={(e) => end(e)}
        onPointerCancel={(e) => end(e, true)}
      >
        <div ref={frameRef} className="ui-viewer-frame" {...formatAttrs(item.format)}>
          <div
            className={cx("ui-viewer-media", changing && "is-changing")}
            style={vars({ "--zoom": zoom, "--pan-x": `${pan.x}px`, "--pan-y": `${pan.y}px`, "--drag-x": `${dragX}px` })}
            onDoubleClick={() => setZoom(zoom > 1 ? 1 : 2)}
          >
            <img key={i} src={item.src} alt={item.alt} draggable={false} />
          </div>
          <div className="ui-glass ui-glass--bar ui-viewer-actions">
            <Btn variant="glass-white" icon="download" onClick={download}>
              {downloadLabel}
            </Btn>
            {onShare && (
              <Btn variant="glass-clear" icon="share-2" onClick={() => onShare(item)}>
                {shareLabel}
              </Btn>
            )}
          </div>
        </div>
      </div>
      <Btn
        variant="glass-clear"
        iconOnly
        icon="chevron-left"
        className="ui-viewer-prev"
        aria-label="Previous creative"
        disabled={n < 2}
        onClick={() => go(-1)}
      />
      <Btn
        variant="glass-clear"
        iconOnly
        icon="chevron-right"
        className="ui-viewer-next"
        aria-label="Next creative"
        disabled={n < 2}
        onClick={() => go(1)}
      />
      <aside className="ui-viewer-info" aria-label={infoLabel}>
        <div className="ui-viewer-info-head">
          <b>{item.name}</b>
          {(item.product || item.campaign) && <span>{[item.product, item.campaign].filter(Boolean).join(" · ")}</span>}
        </div>
        {item.check && (
          <p className="ui-viewer-status" data-check={checked ? "approved" : "waiting"}>
            <Icon name="fume-check" />
            <span>{checked ? `Checked · ${item.check.by ?? ""}` : "In check"}</span>
            {checked && item.check.time && <time className="ui-viewer-status-time">{item.check.time}</time>}
          </p>
        )}
        <dl className="ui-datalist ui-datalist--stacked">
          <div>
            <dt>Format</dt>
            <dd>{VIEWER_FORMAT_LABEL[item.format]}</dd>
          </div>
          {item.size && (
            <div>
              <dt>Size</dt>
              <dd>
                <span className="ui-datalist-data">{item.size}</span>
              </dd>
            </div>
          )}
          {item.run && (
            <div>
              <dt>Engine run</dt>
              <dd>{item.run}</dd>
            </div>
          )}
          {item.facts?.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.data ? <span className="ui-datalist-data">{f.value}</span> : f.value}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </div>
  ) : null;

  const attrs = {
    "data-info": info === null ? undefined : info ? "open" : "closed",
    "data-chrome": chromeHidden ? "hidden" : undefined,
    "data-zoomed": zoom > 1 ? "" : undefined,
    "data-dragging": dragging ? "" : undefined,
  };

  if (inline)
    return (
      <div
        ref={setRoot}
        className={cx("ui-viewer ui-viewer--inline", className)}
        role="region"
        aria-label={label}
        tabIndex={-1}
        {...attrs}
        {...props}
        onKeyDown={keys}
      >
        {screen}
      </div>
    );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Content asChild aria-describedby={undefined} aria-label={label}>
          <div
            ref={setRoot}
            className={cx("ui-viewer", className)}
            aria-modal="true"
            {...attrs}
            {...props}
            onKeyDown={keys}
          >
            {screen}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
});

/* ---------- a full-screen layer for a viewer of the app's own (the review viewer, Swipe through) ---------- */

export interface ViewerLayerProps extends HTMLAttributes<HTMLDivElement> {
  /** The layer's name for assistive tech ("Night Body Oil · Feed"). Put a ViewerLayerTitle inside too. */
  label: string;
  /** Escape or the layer closing itself. */
  onClose: () => void;
  /** Escape first: prevent its default to keep the layer open (a draft pin to take away, a sheet to close). */
  onEscape?: (event: globalThis.KeyboardEvent) => void;
}

/**
 * The review viewer's frame: a modal layer over the page that opened it, so the page and what was selected on it stay
 * put underneath. Radix Dialog gives the focus trap, Escape and focus back to the tile it came from. Nothing outside
 * closes it: the layer covers the screen, and the only things outside are the toasts, whose Undo must stay pressable.
 */
export const ViewerLayer = forwardRef<HTMLDivElement, ViewerLayerProps>(function ViewerLayer(
  { label, onClose, onEscape, children, ...props },
  ref,
) {
  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Content
          asChild
          aria-describedby={undefined}
          aria-label={label}
          onEscapeKeyDown={onEscape}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <div ref={ref} aria-modal="true" {...props}>
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
});

/** The layer's title (Radix Dialog.Title): use asChild on the heading the bar shows. */
export const ViewerLayerTitle = Dialog.Title;
