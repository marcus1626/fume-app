// Creative tile, check mark and aspect ratio: design-system/components/creative.css. The customer's creative, the one
// pure white content surface, always with its hairline. The check (rule check-states): checked = the Amber fume-check
// beside the checker's name and time; in check = the same triangle in grey beside "In check". Selected = the Ink ring
// and the round Ink badge, never Amber. The "more" circle sits on its own Smoke glass, revealed on hover, always on touch.
// Round 9, the desktop (PROPOSED 19 Oct 2026, UX review DTSK-10): onSelectedChange gets the click, so a grid can select a
// range with shift; on a tile that opens and selects, Space on the picture toggles the selection (Enter opens it); with
// a mouse, a quiet "Open" shows on the picture of a tile that opens.
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type Ref,
} from "react";
import { cx } from "../cx";
import { Icon } from "../icons";
import { cssVars } from "./internal";

/** The formats, with their ratios from the --ui-creative-ratio-* tokens: Feed 4:5, Story 9:16, Banner 1.91:1. */
export type CreativeFormat = "feed" | "story" | "banner" | "square";

/* ---------- aspect ratio ---------- */

export interface AspectRatioProps extends HTMLAttributes<HTMLDivElement> {
  /** A format from the tokens (default feed). */
  format?: CreativeFormat;
  /** Any other ratio: a number (width / height) or a CSS ratio ("1 / 1"). Overrides format. */
  ratio?: number | string;
}
/** shadcn's aspect-ratio: an <img> or <video> child fills it. */
export function AspectRatio({ format, ratio, className, style, ...props }: AspectRatioProps) {
  return (
    <div
      data-slot="aspect-ratio"
      className={cx("ui-aspect-ratio", format && `ui-aspect-ratio--${format}`, className)}
      style={ratio !== undefined ? { ...cssVars({ "--ratio": String(ratio) }), ...style } : style}
      {...props}
    />
  );
}

/* ---------- check mark ---------- */

/**
 * checked: the expert has checked it (Amber fume-check, data-check="approved"); in-check: waiting for the expert (grey);
 * generating: the Engine is making it (fume-engine, quiet words); changes: a change was asked for (message-square).
 */
export type CheckState = "checked" | "in-check" | "generating" | "changes";

const CHECK_DATA: Record<CheckState, string> = {
  checked: "approved",
  "in-check": "waiting",
  generating: "generating",
  changes: "changes",
};

export interface CheckMarkProps extends HTMLAttributes<HTMLSpanElement> {
  state: CheckState;
  /** Who checked it ("Anna"). */
  by?: string;
  /** When ("14:02"), in the data face. */
  time?: string;
  /** The machine-readable time for <time dateTime>. */
  dateTime?: string;
  /** "short" (default, the tile caption on the board): "Anna 14:02"; "long": "Checked by Anna 14:02". */
  wording?: "short" | "long";
  /** Words that replace the defaults ("In check", "Generating", "Changes", the checker's name). */
  label?: ReactNode;
}

export function CheckMark({
  state,
  by,
  time,
  dateTime,
  wording = "short",
  label,
  className,
  ...props
}: CheckMarkProps) {
  const words =
    label ??
    (state === "checked"
      ? by
        ? wording === "long"
          ? `Checked by ${by}`
          : by
        : "Checked"
      : state === "in-check"
        ? "In check"
        : state === "generating"
          ? "Generating"
          : "Changes");
  const icon = state === "generating" ? "fume-engine" : state === "changes" ? "message-square" : "fume-check";
  return (
    <span className={cx("ui-creative-check", className)} data-check={CHECK_DATA[state]} {...props}>
      <Icon name={icon} />
      {words}
      {state === "checked" && time && (
        <>
          {" "}
          <time className="ui-creative-time" dateTime={dateTime}>
            {time}
          </time>
        </>
      )}
    </span>
  );
}

/* ---------- grid ---------- */

/** A grid of creatives (ul): tight inside a tile, wide between tiles. Put CreativeTile (li) inside. */
export function CreativeGrid({ className, ...props }: HTMLAttributes<HTMLUListElement>) {
  return <ul className={cx("ui-creative-grid", className)} {...props} />;
}

/* ---------- the more button ---------- */

/**
 * The tile's "more" circle (glass-clear icon button). Use it as a DropdownMenuTrigger's asChild child and pass that
 * whole menu to CreativeTile's `more`.
 */
export const CreativeMoreButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  function CreativeMoreButton({ className, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-haspopup="menu"
        className={cx("ui-btn ui-btn--glass-clear ui-btn--icon ui-btn--sm", className)}
        {...props}
      >
        <Icon name="ellipsis" />
      </button>
    );
  },
);

/* ---------- tile ---------- */

export interface CreativeTileProps extends Omit<HTMLAttributes<HTMLElement>, "onSelect"> {
  /** The element: li (default, inside CreativeGrid) or div. */
  as?: "li" | "div";
  /** The creative's image. */
  src?: string;
  /** Alt text for the image; empty when `label` already names it. */
  alt?: string;
  /** Media of your own (a <video>, a <picture>) instead of src. */
  media?: ReactNode;
  /** The format: sets the ratio from the tokens (data-format). Default feed. */
  format?: CreativeFormat;
  /** Any other ratio for the media (number or "4 / 5"); overrides format. */
  ratio?: number | string;
  /** The creative's name for the media target and the more button ("Feed 01"). */
  label: string;
  /** Left side of the caption, the format line ("Feed · 01"). */
  caption?: ReactNode;
  /** Right side of the caption: a <CheckMark />. */
  check?: ReactNode;
  /** Selection mode: true/false makes the media a toggle (aria-pressed) and shows the ring and badge when true. */
  selected?: boolean;
  /** The click comes along, so a grid can select a range with shift (it is absent for Space). */
  onSelectedChange?: (selected: boolean, event?: ReactMouseEvent<HTMLElement>) => void;
  /** Open mode: the media is a link. */
  href?: string;
  /** Open mode: the media is a button. With `selected` too, a tap on the media opens it and the round corner
   *  checkbox selects it (the standard grid pattern; PROPOSED 15 Oct 2026, walk-through Must 8). */
  onOpen?: () => void;
  /** The more circle: pass a whole menu whose trigger is <CreativeMoreButton/> (asChild). */
  more?: ReactNode;
  /** Or just a click handler for a default more circle labelled `moreLabel`. */
  onMore?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  /** Default `More for ${label}`. */
  moreLabel?: string;
  /** The Engine is still making it: a skeleton in the creative's shape, aria-busy. */
  loading?: boolean;
}

export const CreativeTile = forwardRef<HTMLElement, CreativeTileProps>(function CreativeTile(
  {
    as = "li",
    src,
    alt = "",
    media,
    format,
    ratio,
    label,
    caption,
    check,
    selected,
    onSelectedChange,
    href,
    onOpen,
    more,
    onMore,
    moreLabel,
    loading,
    className,
    ...props
  },
  ref,
) {
  const selectable = selected !== undefined;
  // Open and select at once: the media opens, the corner checkbox selects.
  const pickable = selectable && Boolean(onOpen);
  const mediaStyle: CSSProperties | undefined = ratio !== undefined ? cssVars({ "--ratio": String(ratio) }) : undefined;
  const inner = media ?? (src ? <img src={src} alt={alt} /> : null);
  const mediaCommon = { className: "ui-creative-media", "data-format": format, style: mediaStyle };

  let mediaEl: ReactNode;
  if (loading) {
    mediaEl = (
      <span className="ui-skeleton ui-skeleton--creative" aria-hidden="true" data-format={format} style={mediaStyle} />
    );
  } else if (selectable && !pickable) {
    mediaEl = (
      <button
        type="button"
        {...mediaCommon}
        aria-pressed={!!selected}
        aria-label={label}
        onClick={(e) => onSelectedChange?.(!selected, e)}
      >
        {inner}
      </button>
    );
  } else if (href) {
    mediaEl = (
      <a href={href} {...mediaCommon} aria-label={label}>
        {inner}
      </a>
    );
  } else if (onOpen) {
    // Open and select at once: Space toggles the selection, Enter opens (a grid's keys, like a file browser's).
    const space = pickable
      ? (e: ReactKeyboardEvent<HTMLButtonElement>) => {
          if (e.key !== " " || e.repeat) return;
          e.preventDefault();
          onSelectedChange?.(!selected);
        }
      : undefined;
    mediaEl = (
      <button
        type="button"
        {...mediaCommon}
        aria-label={label}
        onClick={onOpen}
        onKeyDown={space}
        onKeyUp={space ? (e) => e.key === " " && e.preventDefault() : undefined}
      >
        {inner}
        <span className="ui-creative-open ui-glass ui-glass--small" aria-hidden="true">
          <Icon name="maximize-2" />
          Open
        </span>
      </button>
    );
  } else {
    mediaEl = <div {...mediaCommon}>{inner}</div>;
  }

  const moreEl =
    !loading && (more || onMore) ? (
      <span className="ui-creative-actions ui-glass ui-glass--small">
        {more ?? <CreativeMoreButton aria-label={moreLabel ?? `More for ${label}`} onClick={onMore} />}
      </span>
    ) : null;

  const Tag = as as "li";
  return (
    <Tag
      ref={ref as Ref<HTMLLIElement>}
      className={cx("ui-creative", className)}
      data-state={selectable ? (selected ? "checked" : "unchecked") : undefined}
      aria-busy={loading || undefined}
      {...props}
    >
      <div className="ui-creative-frame">
        {mediaEl}
        {pickable && !loading ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={!!selected}
            aria-label={`Select ${label ?? "this creative"}`}
            className={cx("ui-creative-badge ui-creative-pick", !selected && "ui-glass ui-glass--small")}
            onClick={(e) => onSelectedChange?.(!selected, e)}
          >
            <Icon name="check" />
          </button>
        ) : (
          selectable &&
          !loading && (
            <span className="ui-creative-badge" aria-hidden="true">
              <Icon name="check" />
            </span>
          )
        )}
        {moreEl}
      </div>
      {(caption !== undefined || check !== undefined) && (
        <div className="ui-creative-caption">
          {caption !== undefined && <span className="ui-creative-format">{caption}</span>}
          {check}
        </div>
      )}
    </Tag>
  );
});

/** A bare creative media box (for CardMedia and strips): the creative with its hairline in a format's ratio. */
export function CreativeMedia({
  format,
  ratio,
  src,
  alt = "",
  className,
  style,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { format?: CreativeFormat; ratio?: number | string; src?: string; alt?: string }) {
  return (
    <div
      className={cx("ui-creative-media", className)}
      data-format={format}
      style={ratio !== undefined ? { ...cssVars({ "--ratio": String(ratio) }), ...style } : style}
      {...props}
    >
      {src ? <img src={src} alt={alt} /> : children}
    </div>
  );
}
