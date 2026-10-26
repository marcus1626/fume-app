// Glass: the Smoke glass surface (design-system/components/glass.css), for floating things the overlay
// components do not already cover (a floating toolbar, a bar over a creative). Never on cards or pages
// (rule glass-only-floating). No stroke, and at most one white or coloured button on it (glass-one-white):
// the main action is ui-btn--glass-white or ui-btn--glass-danger, every other button ui-btn--glass-clear.
import { forwardRef, type HTMLAttributes } from "react";
import { cx } from "../cx";

export type GlassVariant = "panel" | "small" | "bar";

export interface GlassProps extends HTMLAttributes<HTMLDivElement> {
  /** panel: the panel radius (32), small: the floating radius with the small blur (22), bar: a pill bar. */
  variant?: GlassVariant;
  /** "open" plays the arrival from blur to sharp (glass.css); leave it out for a surface that is simply there. */
  "data-state"?: "open" | "closed";
}

/** A Smoke glass surface: div.ui-glass (+ ui-glass--small | ui-glass--bar). */
export const Glass = forwardRef<HTMLDivElement, GlassProps>(({ variant = "panel", className, ...props }, ref) => (
  <div
    ref={ref}
    className={cx(
      "ui-glass",
      variant === "small" && "ui-glass--small",
      variant === "bar" && "ui-glass--bar",
      className,
    )}
    {...props}
  />
));
Glass.displayName = "Glass";

/** The glass scrim (div.ui-scrim, aria-hidden) for a custom layer; Dialog, Sheet and Drawer bring their own. */
export const Scrim = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} aria-hidden="true" className={cx("ui-scrim", className)} {...props} />
));
Scrim.displayName = "Scrim";
