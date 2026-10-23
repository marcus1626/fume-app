// Marker: a place in a conversation (design-system/components/marker.css). DECIDED 13 Oct, round 8.
// Space and a label, never a line. default: an icon and words at the start (read up to here, a run done);
// separator: the words alone in the middle (a day); border: space under the words; isNew: new since you left,
// in Ink, with an Ink count badge.
import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "../cx";
import type { IconName } from "../icons";
import { Glyph } from "./_parts";

export interface MarkerProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "separator" | "border";
  /** New since you left: the Ink dot, the words and `count` as an Ink count badge. */
  isNew?: boolean;
  /** With isNew: how many are new. */
  count?: number;
  /** "2 new" by default. */
  countLabel?: string;
  /** An icon before the words (default variant): "check" for read up to here and a run done. */
  icon?: IconName;
  /** The words. Put times and counts in MarkerTime and MarkerCount (data). */
  children: ReactNode;
}

/** div.ui-marker[data-variant]. */
export const Marker = forwardRef<HTMLDivElement, MarkerProps>(function Marker(
  { variant = "default", isNew, count, countLabel, icon, className, children, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cx("ui-marker", isNew && "ui-marker--new", className)}
      data-variant={variant === "default" ? undefined : variant}
      {...props}
    >
      {isNew && <span className="ui-marker-dot" aria-hidden="true" />}
      {!isNew && icon && (
        <span className="ui-marker-icon" aria-hidden="true">
          <Glyph name={icon} />
        </span>
      )}
      <span className="ui-marker-content">{children}</span>
      {isNew && count !== undefined && (
        <span className="ui-badge ui-badge--ink ui-badge--count" aria-label={countLabel ?? `${count} new`}>
          {count}
        </span>
      )}
    </div>
  );
});

/** span.ui-marker-time: a time in a marker (data). */
export function MarkerTime({ children }: { children: ReactNode }) {
  return <span className="ui-marker-time">{children}</span>;
}

/** span.ui-marker-count: a count in a marker (data). */
export function MarkerCount({ children }: { children: ReactNode }) {
  return <span className="ui-marker-count">{children}</span>;
}
