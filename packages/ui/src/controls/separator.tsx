// Separator (design-system/components/separator.css), shadcn's API. Fume has no lines: a separator is space.
// sm 8 (inside a menu or list), md 24 (default, between groups in a surface), lg --ui-space-2xl (between sections).
// Decorative by default (role="none"), as in shadcn; pass decorative={false} for a semantic separator.
import { forwardRef, type HTMLAttributes } from "react";
import { cx } from "../cx";

export interface SeparatorProps extends HTMLAttributes<HTMLDivElement> {
  /** Default "horizontal". */
  orientation?: "horizontal" | "vertical";
  /** Default "md". */
  size?: "sm" | "md" | "lg";
  /** Default true: hidden from assistive tech. */
  decorative?: boolean;
}

export const Separator = forwardRef<HTMLDivElement, SeparatorProps>(function Separator(
  { orientation = "horizontal", size = "md", decorative = true, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      role={decorative ? "none" : "separator"}
      aria-orientation={decorative ? undefined : orientation}
      data-orientation={orientation}
      className={cx("ui-separator", size !== "md" && `ui-separator--${size}`, className)}
      {...props}
    />
  );
});
