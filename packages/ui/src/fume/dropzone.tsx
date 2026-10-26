// Upload box (design-system/components/dropzone.css, behaviour from dropzone.js).
// A well you drop on or press (a real button opens the picker), a row per creative on its way in with its
// progress, a tile per creative that made it, and an overlay while creatives are dragged over: the seat turns
// Ink and the words say where they go. No shimmer and no Amber where creatives land. Errors are words.
// The screen owns the uploads: `items` are what it is uploading or holds; onFiles hands it the creatives that
// pass the type and size check. Creatives that do not pass get a row here with the reason, until removed.
// `dropAnywhere` makes the whole page the drop target while the zone is on it (onboarding step 1): files dragged
// anywhere over the window light the zone up with its "Drop to add to …" words, and a drop anywhere adds them. An
// upload that is not a picture or a video shows what it is (a document, a typeface, a folder for a zip), never a
// picture icon.
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type DragEvent,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cx } from "../cx";
import type { IconName } from "../icons";
import { Btn, Glyph, ProgressBar, extOf, formatBytes, formatBytesPart, pickFiles, useAnnouncer } from "./_parts";

export interface DropzoneItem {
  id: string;
  name: string;
  bytes: number;
  state: "uploading" | "done" | "error";
  /** 0–100 while uploading. */
  progress?: number;
  /** The reason, in words, when state="error". */
  error?: string;
  /** With state="error": shows Try again. */
  retry?: boolean;
  /** A preview (an object URL or a data URL); a video shows its first frame. */
  src?: string;
  kind?: "image" | "video";
}

export interface DropzoneRejection {
  file: File;
  reason: string;
}

export interface DropzoneHandle {
  /** Opens the system picker (for an "Add more" button elsewhere). */
  open: () => void;
  /** The zone element. */
  element: HTMLDivElement | null;
}

export interface DropzoneProps extends Omit<HTMLAttributes<HTMLDivElement>, "onDrop"> {
  items: DropzoneItem[];
  /** The creatives that passed the check, dropped or picked. */
  onFiles: (files: File[]) => void;
  /** The creatives that did not pass (they also show as rows here with the reason). */
  onReject?: (rejections: DropzoneRejection[]) => void;
  onCancel?: (id: string) => void;
  onRetry?: (id: string) => void;
  onRemove?: (id: string) => void;
  /** input accept: "image/jpeg,image/png,video/mp4". */
  accept?: string;
  /** The size limit in bytes. */
  maxBytes?: number;
  /** The limit as written ("200 MB"); defaults to formatBytes(maxBytes). */
  maxLabel?: string;
  /** Where the creatives go ("Autumn launch"): the overlay says "Drop to add to Autumn launch". */
  target?: string;
  /** One row in a form (.ui-dropzone--compact). */
  compact?: boolean;
  /** Creatives that made it show as tiles (the default unless compact); otherwise as done rows. */
  grid?: boolean;
  disabled?: boolean;
  /** The words with a mouse; default "Drop creatives here or choose". */
  copy?: ReactNode;
  /** On a touch screen; default "Tap to choose creatives". */
  touchCopy?: ReactNode;
  /** Once creatives are in; default "Add more creatives" (not in the compact row). */
  moreCopy?: ReactNode;
  /** The limits line; default from accept and the size ("JPG, PNG or MP4 · up to 200 MB"). */
  meta?: string;
  /** The seat's icon: "upload" by default, "image-plus" for reference images. */
  icon?: IconName;
  /** The overlay's words; default "Drop to add to {target}". */
  dropLabel?: string;
  /** The grid's and the list's aria-labels. */
  gridLabel?: string;
  listLabel?: string;
  /** Freeze the copy for one kind of screen (a demo): "touch" or "pointer". */
  pointer?: "touch" | "pointer";
  /** The whole page takes the drop while this zone is mounted: dragging over the window lights the zone up. */
  dropAnywhere?: boolean;
}

const NB = " ";

function typeNames(accept: string[]): string {
  const names = accept
    .map((a) => {
      const b = a.replace(/^\./, "").replace(/^.*\//, "");
      return b === "jpeg" ? "JPG" : b === "*" ? "" : b.toUpperCase();
    })
    .filter((a, i, all) => a && all.indexOf(a) === i);
  return names.length > 1 ? names.slice(0, -1).join(", ") + " or " + names[names.length - 1] : names[0] || "";
}

function allowed(file: File, accept: string[]): boolean {
  if (!accept.length) return true;
  const type = (file.type || "").toLowerCase(),
    name = (file.name || "").toLowerCase();
  return accept.some((a) => {
    if (a.charAt(0) === ".") return name.endsWith(a) || (a === ".jpg" && /\.jpeg$/.test(name));
    if (/\/\*$/.test(a)) return type.indexOf(a.slice(0, -1)) === 0;
    return type === a;
  });
}

/** Why a creative cannot be added, in words, or "" when it can (dropzone.js check). */
export function checkCreativeFile(file: File, opts: { accept?: string; maxBytes?: number; maxLabel?: string }): string {
  const accept = (opts.accept ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed(file, accept))
    return `${extOf(file.name) || "This type"} is not supported here. Use ${typeNames(accept)}.`;
  if (opts.maxBytes && file.size > opts.maxBytes)
    return `Too big at ${formatBytes(file.size)}. Up to ${(opts.maxLabel ?? formatBytes(opts.maxBytes)).replace(/\s+/g, NB)}.`;
  return "";
}

const plural = (n: number) => `${n} ${n === 1 ? "creative" : "creatives"}`;

/** What an upload without a preview is, from its name: a document, a typeface, a folder (a zip), a picture. */
function glyphOf(name: string, kind?: DropzoneItem["kind"]): IconName {
  if (kind === "video") return "play";
  if (kind === "image") return "image";
  const ext = extOf(name).toLowerCase();
  if (["pdf", "doc", "docx", "txt", "rtf", "pages", "key", "ppt", "pptx", "indd", "ai"].includes(ext))
    return "file-text";
  if (["otf", "ttf", "woff", "woff2"].includes(ext)) return "type";
  if (["zip", "rar", "7z"].includes(ext)) return "folder";
  if (["mp4", "mov", "webm", "m4v"].includes(ext)) return "play";
  if (["jpg", "jpeg", "png", "webp", "gif", "svg", "heic", "tif", "tiff", "avif"].includes(ext)) return "image";
  return "file";
}
const isFiles = (e: DragEvent | globalThis.DragEvent) =>
  !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files");

interface Rejected extends DropzoneItem {
  rejected: true;
}

/** div.ui-dropzone[data-filled][data-drag][data-disabled]: the upload box. */
export const Dropzone = forwardRef<DropzoneHandle, DropzoneProps>(function Dropzone(
  {
    items,
    onFiles,
    onReject,
    onCancel,
    onRetry,
    onRemove,
    accept = "",
    maxBytes,
    maxLabel,
    target,
    compact,
    grid,
    disabled,
    copy,
    touchCopy,
    moreCopy,
    meta,
    icon = "upload",
    dropLabel,
    gridLabel = "Added creatives",
    listLabel = "Uploads",
    pointer,
    dropAnywhere,
    className,
    ...props
  },
  ref,
) {
  const zone = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLButtonElement>(null);
  const depth = useRef(0);
  const [drag, setDrag] = useState(false);
  const [rejected, setRejected] = useState<Rejected[]>([]);
  const [live, say] = useAnnouncer();
  const metaId = useId();
  const titleId = useId();

  const types = typeNames(
    accept
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  const limit = maxLabel ?? (maxBytes ? formatBytes(maxBytes) : "");
  const metaText =
    meta ?? [types, limit ? `up${NB}to${NB}${limit.replace(/\s+/g, NB)}` : ""].filter(Boolean).join(`${NB}· `);
  const tiles = grid ?? !compact;

  const add = useCallback(
    (files: File[]) => {
      if (disabled || !files.length) return;
      const ok: File[] = [],
        bad: DropzoneRejection[] = [];
      files.forEach((f) => {
        const reason = checkCreativeFile(f, { accept, maxBytes, maxLabel });
        if (reason) bad.push({ file: f, reason });
        else ok.push(f);
      });
      if (bad.length) {
        setRejected((r) => [
          ...r,
          ...bad.map((b, i) => ({
            id: `rejected-${Date.now()}-${i}`,
            name: b.file.name || "Untitled creative",
            bytes: b.file.size,
            state: "error" as const,
            error: b.reason,
            rejected: true as const,
          })),
        ]);
        onReject?.(bad);
        if (!ok.length)
          say(
            bad.length === 1
              ? `${bad[0].file.name} could not be added. ${bad[0].reason}`
              : `${bad.length} creatives could not be added. Each row says why.`,
          );
      }
      if (ok.length) onFiles(ok);
    },
    [accept, disabled, maxBytes, maxLabel, onFiles, onReject, say],
  );

  const open = useCallback(() => {
    if (disabled) return;
    pickFiles(accept).then(add);
  }, [accept, add, disabled]);

  useImperativeHandle(
    ref,
    () => ({
      open,
      get element() {
        return zone.current;
      },
    }),
    [open],
  );

  // say what landed: creatives that finished uploading since the last render, and the ones that stopped
  const prev = useRef(new Map<string, DropzoneItem["state"]>());
  useEffect(() => {
    let added = 0,
      failed = 0;
    items.forEach((it) => {
      const was = prev.current.get(it.id);
      if (was === "uploading" && it.state === "done") added++;
      if (was === "uploading" && it.state === "error") failed++;
    });
    prev.current = new Map(items.map((it) => [it.id, it.state]));
    const words = [
      added ? `${plural(added)} added${target ? ` to ${target}` : ""}.` : "",
      failed ? `${plural(failed)} stopped uploading.` : "",
    ]
      .filter(Boolean)
      .join(" ");
    if (words) say(words);
  }, [items, say, target]);

  // a creative dropped beside the zone must not replace the page; with dropAnywhere the page itself takes it
  useEffect(() => {
    let over = 0;
    const enter = (e: globalThis.DragEvent) => {
      if (!dropAnywhere || !isFiles(e)) return;
      over++;
      if (!disabled) setDrag(true);
    };
    const leave = (e: globalThis.DragEvent) => {
      if (!dropAnywhere || !isFiles(e)) return;
      over = Math.max(0, over - 1);
      if (!over) setDrag(false);
    };
    const hover = (e: globalThis.DragEvent) => {
      if (!isFiles(e) || e.defaultPrevented) return;
      e.preventDefault();
      if (!e.dataTransfer) return;
      if (dropAnywhere) e.dataTransfer.dropEffect = disabled ? "none" : "copy";
      else if (!(zone.current && e.target instanceof Node && zone.current.contains(e.target)))
        e.dataTransfer.dropEffect = "none";
    };
    const drop = (e: globalThis.DragEvent) => {
      if (!isFiles(e)) return;
      over = 0;
      if (dropAnywhere) setDrag(false);
      if (e.defaultPrevented) return;
      e.preventDefault();
      if (dropAnywhere && e.dataTransfer) add(Array.from(e.dataTransfer.files));
    };
    const end = () => {
      over = 0;
      if (dropAnywhere) setDrag(false);
    };
    document.addEventListener("dragenter", enter);
    document.addEventListener("dragleave", leave);
    document.addEventListener("dragover", hover);
    document.addEventListener("drop", drop);
    document.addEventListener("dragend", end);
    return () => {
      document.removeEventListener("dragenter", enter);
      document.removeEventListener("dragleave", leave);
      document.removeEventListener("dragover", hover);
      document.removeEventListener("drop", drop);
      document.removeEventListener("dragend", end);
    };
  }, [dropAnywhere, disabled, add]);

  const focusNear = (id: string) => {
    requestAnimationFrame(() => {
      const root = zone.current;
      if (!root) return;
      const btns = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-dz-action]"));
      const next = btns.find((b) => b.getAttribute("data-dz-for") !== id) ?? area.current;
      next?.focus({ preventScroll: true });
    });
  };

  const removeItem = (it: DropzoneItem | Rejected, cancel: boolean) => {
    if ("rejected" in it) setRejected((r) => r.filter((x) => x.id !== it.id));
    else if (cancel) onCancel?.(it.id);
    else onRemove?.(it.id);
    say(cancel ? `Upload of ${it.name} cancelled.` : `${it.name} removed.`);
    focusNear(it.id);
  };

  const rows = [...items.filter((it) => !(tiles && it.state === "done")), ...rejected];
  const done = tiles ? items.filter((it) => it.state === "done") : [];
  const filled = items.length + rejected.length > 0;

  const media = (it: DropzoneItem) =>
    it.src && it.kind === "video" ? (
      <video muted playsInline preload="metadata" src={`${it.src}#t=0.1`} aria-hidden="true" />
    ) : it.src ? (
      <img src={it.src} alt="" />
    ) : (
      <Glyph name={glyphOf(it.name, it.kind)} />
    );

  const btn = (kind: "cancel" | "retry" | "remove", it: DropzoneItem | Rejected, glass = false) => (
    <Btn
      key={kind}
      variant={glass ? "glass-clear" : "quiet"}
      size="sm"
      iconOnly
      icon={kind === "retry" ? "rotate-ccw" : "x"}
      aria-label={
        kind === "cancel" ? `Cancel ${it.name}` : kind === "retry" ? `Try ${it.name} again` : `Remove ${it.name}`
      }
      data-dz-action={kind}
      data-dz-for={it.id}
      onClick={() => (kind === "retry" ? onRetry?.(it.id) : removeItem(it, kind === "cancel"))}
    />
  );

  const words = (
    <span className="ui-dropzone-text">
      <span className="ui-dropzone-title" id={titleId}>
        <span className="ui-dropzone-copy">
          {copy ?? (
            <>
              Drop creatives here or <span className="ui-dropzone-choose">choose</span>
            </>
          )}
        </span>
        <span className="ui-dropzone-copy-touch">{touchCopy ?? "Tap to choose creatives"}</span>
        {!compact && <span className="ui-dropzone-copy-more">{moreCopy ?? "Add more creatives"}</span>}
      </span>
      {metaText && (
        <span className="ui-dropzone-meta" id={metaId}>
          {metaText}
        </span>
      )}
    </span>
  );

  return (
    <div
      ref={zone}
      className={cx(
        "ui-dropzone",
        compact && "ui-dropzone--compact",
        pointer === "touch" && "is-touch",
        pointer === "pointer" && "is-pointer",
        className,
      )}
      data-filled={filled ? "" : undefined}
      data-drag={drag && !disabled ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      role="group"
      data-anywhere={dropAnywhere ? "" : undefined}
      onDragEnter={(e) => {
        if (!isFiles(e)) return;
        e.preventDefault();
        if (dropAnywhere) return;
        depth.current++;
        if (!disabled) setDrag(true);
      }}
      onDragOver={(e) => {
        if (!isFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = disabled ? "none" : "copy";
      }}
      onDragLeave={(e) => {
        if (!isFiles(e) || dropAnywhere) return;
        depth.current = Math.max(0, depth.current - 1);
        if (!depth.current) setDrag(false);
      }}
      onDrop={(e) => {
        if (!isFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setDrag(false);
        add(Array.from(e.dataTransfer.files));
      }}
      {...props}
    >
      {tiles && (
        <ul className="ui-dropzone-grid" aria-label={gridLabel}>
          {done.map((it) => (
            <li key={it.id} className="ui-creative ui-dropzone-tile">
              <div className="ui-creative-frame">
                <div className="ui-creative-media">{it.src ? <img src={it.src} alt={it.name} /> : media(it)}</div>
                <span className="ui-creative-actions ui-glass ui-glass--small">{btn("remove", it, true)}</span>
              </div>
              <div className="ui-creative-caption">
                <span className="ui-creative-format">{it.name}</span>
                <span className="ui-dropzone-size">{formatBytes(it.bytes)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ul className="ui-dropzone-list" aria-label={listLabel}>
        {rows.map((it) => {
          const p = Math.max(0, Math.min(100, Math.round(it.progress ?? 0)));
          return (
            <li key={it.id} className="ui-item ui-item--sm ui-dropzone-row" data-state={it.state}>
              <span className="ui-item-media ui-item-media--creative">{media(it)}</span>
              <div className="ui-item-content">
                <div className="ui-dropzone-row-head">
                  <span className="ui-dropzone-name">{it.name}</span>
                  <span className="ui-dropzone-size">
                    {it.state === "uploading" ? formatBytesPart((it.bytes * p) / 100, it.bytes) : formatBytes(it.bytes)}
                  </span>
                </div>
                {it.state === "uploading" && <ProgressBar value={p} max={100} label={`Uploading ${it.name}`} />}
                {it.state === "error" && (
                  <p className="ui-field-error">
                    <Glyph name="circle-alert" />
                    <span>{it.error ?? "Upload stopped. Check your connection and try again."}</span>
                  </p>
                )}
              </div>
              <div className="ui-item-actions">
                {it.state === "uploading"
                  ? btn("cancel", it)
                  : [it.state === "error" && it.retry && onRetry ? btn("retry", it) : null, btn("remove", it)]}
              </div>
            </li>
          );
        })}
      </ul>
      <button
        ref={area}
        className="ui-dropzone-area"
        type="button"
        aria-labelledby={titleId}
        aria-describedby={metaText ? metaId : undefined}
        disabled={disabled}
        onClick={open}
      >
        <span className="ui-dropzone-icon">
          <Glyph name={icon} />
        </span>
        {words}
      </button>
      <div className="ui-dropzone-overlay" aria-hidden="true">
        <span className="ui-dropzone-icon">
          <Glyph name="upload" />
        </span>
        <span className="ui-dropzone-text">
          <span className="ui-dropzone-title">
            {dropLabel ?? (target ? `Drop to add to ${target}` : "Drop to add them")}
          </span>
          {metaText && <span className="ui-dropzone-meta">{metaText}</span>}
        </span>
      </div>
      <p className="ui-dropzone-status" role="status" aria-live="polite">
        {live}
      </p>
    </div>
  );
});

export interface DropzonePanelProps extends Omit<HTMLAttributes<HTMLElement>, "onDrop"> {
  onFiles: (files: File[]) => void;
  onReject?: (rejections: DropzoneRejection[]) => void;
  accept?: string;
  maxBytes?: number;
  maxLabel?: string;
  /** "the brief": the overlay says "Drop to add to the brief". */
  target?: string;
  dropLabel?: string;
  disabled?: boolean;
  /** The element: a section (default) or a div. Put .ui-card on it for a card that takes drops. */
  as?: "section" | "div";
  children: ReactNode;
}

/** .ui-dropzone-panel: a panel (a brief, a campaign) that takes drops anywhere; the overlay covers it. */
export const DropzonePanel = forwardRef<HTMLElement, DropzonePanelProps>(function DropzonePanel(
  {
    onFiles,
    onReject,
    accept = "",
    maxBytes,
    maxLabel,
    target,
    dropLabel,
    disabled,
    as = "section",
    className,
    children,
    ...props
  },
  ref,
) {
  const depth = useRef(0);
  const [drag, setDrag] = useState(false);
  const Tag = as;
  return (
    <Tag
      ref={ref as never}
      className={cx("ui-dropzone-panel", className)}
      data-drag={drag && !disabled ? "" : undefined}
      onDragEnter={(e: DragEvent) => {
        if (!isFiles(e)) return;
        e.preventDefault();
        depth.current++;
        if (!disabled) setDrag(true);
      }}
      onDragOver={(e: DragEvent) => {
        if (!isFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = disabled ? "none" : "copy";
      }}
      onDragLeave={(e: DragEvent) => {
        if (!isFiles(e)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (!depth.current) setDrag(false);
      }}
      onDrop={(e: DragEvent) => {
        if (!isFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setDrag(false);
        if (disabled) return;
        const ok: File[] = [],
          bad: DropzoneRejection[] = [];
        Array.from(e.dataTransfer.files).forEach((f) => {
          const reason = checkCreativeFile(f, { accept, maxBytes, maxLabel });
          if (reason) bad.push({ file: f, reason });
          else ok.push(f);
        });
        if (bad.length) onReject?.(bad);
        if (ok.length) onFiles(ok);
      }}
      {...props}
    >
      {children}
      <div className="ui-dropzone-overlay" aria-hidden="true">
        <span className="ui-dropzone-icon">
          <Glyph name="upload" />
        </span>
        <span className="ui-dropzone-text">
          <span className="ui-dropzone-title">
            {dropLabel ?? (target ? `Drop to add to ${target}` : "Drop to add them")}
          </span>
        </span>
      </div>
    </Tag>
  );
});

/** Opens the system picker and resolves with the chosen files (for "Attach creatives" buttons). */
export { pickFiles };
