// Attachment: a creative or a brief attached to a message or a brief (design-system/components/attachment.css).
// DECIDED 13 Oct, round 8. A small card with no border; a creative keeps its hairline, a brief is the file-text
// icon on a sunken tile. Name in medium, then a data line (format and size). States: idle (Waiting), uploading
// (an Ink bar), processing (spinner and words), error (circle-alert and the reason in Rouge, try again and
// remove), done. Vertical: the creative at its own format on top, remove on a bit of Smoke glass.
import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "../cx";
import { Btn, Glyph, ProgressBar, Spinner, extOf, formatAttrs, type CreativeFormat } from "./_parts";

export type AttachmentState = "idle" | "uploading" | "processing" | "error" | "done";

export type AttachmentMedia = { kind: "image"; src?: string; alt?: string; format?: CreativeFormat } | { kind: "icon" };

export interface AttachmentProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** The name ("Autumn launch brief.pdf", "Creative 3"); cut with an ellipsis, whole in the title attribute. */
  title: string;
  /** The data line: "PDF · 240 KB", "Story · 9:16". See attachmentMeta(). */
  meta?: string;
  /** Replaces the description line entirely. */
  description?: ReactNode;
  /** An image (a creative) or the file-text icon (a brief). */
  media?: AttachmentMedia;
  state?: AttachmentState;
  size?: "default" | "sm";
  orientation?: "horizontal" | "vertical";
  /** 0–100 while uploading. */
  progress?: number;
  /** The reason, in words, when state="error" ("Connection lost"). */
  error?: string;
  /** Words while processing ("Reading the pages"). */
  processingLabel?: string;
  /** Words while idle ("Waiting"). */
  idleLabel?: string;
  /** Makes the whole attachment open it (a button laid over it). */
  onOpen?: () => void;
  /** "Open Autumn launch brief.pdf" by default. */
  openLabel?: string;
  /** Shows the remove circle (or Stop uploading while uploading). */
  onRemove?: () => void;
  removeLabel?: string;
  /** With state="error": shows Try again (refresh-cw). */
  onRetry?: () => void;
  /** On glass the circles are glass-clear; the vertical one always sits on its own bit of glass. */
  glass?: boolean;
}

/** div.ui-attachment[data-slot=attachment][data-state][data-size][data-orientation]. */
export const Attachment = forwardRef<HTMLDivElement, AttachmentProps>(function Attachment(
  {
    title,
    meta,
    description,
    media = { kind: "icon" },
    state = "done",
    size = "default",
    orientation = "horizontal",
    progress = 0,
    error,
    processingLabel = "Reading",
    idleLabel = "Waiting",
    onOpen,
    openLabel,
    onRemove,
    removeLabel,
    onRetry,
    glass,
    className,
    ...props
  },
  ref,
) {
  const vertical = orientation === "vertical";
  const btn = glass || vertical ? "glass-clear" : "quiet";
  const fmt = media.kind === "image" ? formatAttrs(media.format) : {};

  let desc: ReactNode = description;
  if (desc === undefined) {
    if (state === "uploading")
      desc = (
        <>
          <ProgressBar value={Math.round(progress)} max={100} label={`Uploading ${title}`} />
          <span className="ui-attachment-meta">{Math.round(progress)} %</span>
        </>
      );
    else if (state === "processing")
      desc = (
        <>
          <Spinner label={processingLabel} />
          <span>{processingLabel}</span>
        </>
      );
    else if (state === "error")
      desc = (
        <>
          <Glyph name="circle-alert" />
          <span>{error}</span>
        </>
      );
    else if (state === "idle") desc = <span>{idleLabel}</span>;
    else if (meta) desc = <span className="ui-attachment-meta">{meta}</span>;
  }

  const actions =
    onRemove || (state === "error" && onRetry) ? (
      <div className={cx("ui-attachment-actions", vertical && "ui-glass ui-glass--small ui-glass--bar")}>
        {state === "error" && onRetry && (
          <Btn variant={btn} size="sm" iconOnly icon="refresh-cw" aria-label={`Try ${title} again`} onClick={onRetry} />
        )}
        {onRemove && (
          <Btn
            variant={btn}
            size="sm"
            iconOnly
            icon="x"
            aria-label={removeLabel ?? (state === "uploading" ? `Stop uploading ${title}` : `Remove ${title}`)}
            onClick={onRemove}
          />
        )}
      </div>
    ) : null;

  return (
    <div
      ref={ref}
      className={cx("ui-attachment", className)}
      data-slot="attachment"
      data-state={state}
      data-size={size === "sm" ? "sm" : undefined}
      data-orientation={vertical ? "vertical" : undefined}
      {...props}
    >
      {onOpen && (
        <button
          className="ui-attachment-trigger"
          type="button"
          aria-label={openLabel ?? `Open ${title}`}
          onClick={onOpen}
        />
      )}
      <div className="ui-attachment-media" data-variant={media.kind === "image" ? "image" : "icon"} {...fmt}>
        {media.kind === "image" ? (
          media.src && <img src={media.src} alt={media.alt ?? ""} />
        ) : (
          <Glyph name="file-text" />
        )}
      </div>
      <div className="ui-attachment-content">
        <span className="ui-attachment-title" title={title}>
          {title}
        </span>
        {desc !== undefined && desc !== null && <span className="ui-attachment-description">{desc}</span>}
      </div>
      {actions}
    </div>
  );
});

export interface AttachmentGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** One line that scrolls sideways instead of wrapping. */
  scroll?: boolean;
}

/** div.ui-attachment-group: attachments wrap, 8 apart (they line up at the end in your own message). */
export const AttachmentGroup = forwardRef<HTMLDivElement, AttachmentGroupProps>(function AttachmentGroup(
  { scroll, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cx("ui-attachment-group", scroll && "ui-attachment-group--scroll", className)}
      {...props}
    />
  );
});

/** The data line for an attachment: "PDF · 240 KB" from a name and a size in bytes (contract Attachment). */
export function attachmentMeta(name: string, bytes: number): string {
  const ext = extOf(name);
  const size = bytes >= 1e6 ? (bytes / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(bytes / 1e3)) + " KB";
  return (ext ? ext + " · " : "") + size;
}
