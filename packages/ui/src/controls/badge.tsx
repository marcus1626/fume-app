// Badge (design-system/components/badge.css), shadcn's badge: a pill, 24 px, 12 px label.
// Variants: neutral (default, sunken), ink, secondary (white, lifted by depth), danger (Rouge, errors only).
// Quality Gate status: check="waiting" puts the grey checked triangle before "In check"; check="approved" the
// Amber one before "Checked by Anna" (the expert) or "Approved" (the customer). The words always say the state.
// A badge that is a link or a button (asChild) gets the 44 px hit area, hover, press and focus from the CSS.
import { forwardRef, type HTMLAttributes, type Ref } from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../icons";
import { Slot } from "./slot";

export type BadgeVariant = "neutral" | "ink" | "secondary" | "danger";
export type BadgeDotKind = "on" | "live" | "idle" | "danger";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Default "neutral". */
  variant?: BadgeVariant;
  /** A count: 20 px with tabular figures (.ui-badge--count). Give it an aria-label such as "2 new". */
  count?: boolean;
  /** The checked triangle of the Quality Gate: "waiting" (grey, In check) or "approved" (Amber). */
  check?: "waiting" | "approved";
  /** A dot before the label: on (Ink), live (Ink, breathing), idle (grey), danger (Rouge). */
  dot?: BadgeDotKind;
  /** An icon before the label. Ignored when check is set (the triangle takes its place). */
  icon?: IconName;
  /** Render the one child (a link or button) as the badge. */
  asChild?: boolean;
}

const variantClass: Record<BadgeVariant, string | false> = {
  neutral: false,
  ink: "ui-badge--ink",
  secondary: "ui-badge--secondary",
  danger: "ui-badge--danger",
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { variant = "neutral", count = false, check, dot, icon, asChild = false, className, children, ...props },
  ref,
) {
  const classes = cx(
    "ui-badge",
    check === "waiting" && "ui-badge--check",
    check === "approved" && "ui-badge--approved",
    variantClass[variant],
    count && "ui-badge--count",
    className,
  );
  if (asChild) {
    return (
      <Slot ref={ref as Ref<HTMLElement>} className={classes} {...props}>
        {children}
      </Slot>
    );
  }
  return (
    <span ref={ref} className={classes} {...props}>
      {dot ? <BadgeDot kind={dot} /> : null}
      {check ? <Icon name="fume-check" /> : icon ? <Icon name={icon} /> : null}
      {children}
    </span>
  );
});

export interface BadgeDotProps extends HTMLAttributes<HTMLSpanElement> {
  /** Default "on" (Ink). */
  kind?: BadgeDotKind;
}

/** The dot before a badge's label (.ui-badge-dot). Decorative: the label says the state. */
export const BadgeDot = forwardRef<HTMLSpanElement, BadgeDotProps>(function BadgeDot({ kind = "on", className, ...props }, ref) {
  return <span ref={ref} aria-hidden="true" className={cx("ui-badge-dot", kind !== "on" && `ui-badge-dot--${kind}`, className)} {...props} />;
});

/** A dot on its own at the corner of an icon button or an avatar (.ui-badge--dot). Put it in a positioned
 *  wrapper next to the button; say what it means in the button's aria-label ("Notifications, 2 new"). */
export const DotBadge = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(function DotBadge({ className, ...props }, ref) {
  return <span ref={ref} aria-hidden="true" className={cx("ui-badge", "ui-badge--dot", className)} {...props} />;
});
