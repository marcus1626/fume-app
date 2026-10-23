// Spinner (design-system/components/spinner.css). The line-only loader circle, turning, in the colour of the words
// beside it. On its own it is a status with a label ("Loading"); inside a busy button or a SpinnerLabel it is
// decoration and the words say what is happening.
import { forwardRef, type HTMLAttributes, type SVGProps } from "react";
import { cx } from "../cx";

export type SpinnerSize = "sm" | "md" | "lg" | "xl";

export interface SpinnerProps extends Omit<SVGProps<SVGSVGElement>, "ref"> {
  /** sm 14, md 16 (default), lg 18, xl 24 for a panel that is loading. */
  size?: SpinnerSize;
  /** What a screen reader hears. Default "Loading". Ignored when decorative. */
  label?: string;
  /** Hide it from screen readers: the words beside it already say what is happening. */
  decorative?: boolean;
}

const spinnerSize: Record<SpinnerSize, string | false> = { sm: "ui-spinner--sm", md: false, lg: "ui-spinner--lg", xl: "ui-spinner--xl" };

/** `<svg class="ui-spinner" role="status" aria-label="Loading"><use href="#fi-loader-circle"/></svg>` */
export const Spinner = forwardRef<SVGSVGElement, SpinnerProps>(function Spinner(
  { size = "md", label = "Loading", decorative = false, className, ...props },
  ref,
) {
  return (
    <svg
      ref={ref}
      className={cx("ui-spinner", spinnerSize[size], className)}
      role={decorative ? undefined : "status"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      {...props}
    >
      <use href="#fi-loader-circle" />
    </svg>
  );
});

export interface SpinnerLabelProps extends HTMLAttributes<HTMLSpanElement> {
  /** Spinner above the words, centred (for a panel that is loading). */
  stack?: boolean;
  /** Spinner size; default md, the board uses xl when stacked. */
  size?: SpinnerSize;
}

/** A spinner with words that say what is happening: "Generating 12 creatives". A live status region. */
export const SpinnerLabel = forwardRef<HTMLSpanElement, SpinnerLabelProps>(function SpinnerLabel(
  { stack = false, size, className, children, ...props },
  ref,
) {
  return (
    <span ref={ref} role="status" className={cx("ui-spinner-label", stack && "ui-spinner-label--stack", className)} {...props}>
      <Spinner decorative size={size ?? (stack ? "xl" : "md")} />
      {children}
    </span>
  );
});
