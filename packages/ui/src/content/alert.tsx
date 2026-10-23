// Alert: an inline banner, design-system/components/alert.css (shadcn's alert parts plus Fume's action and dismiss).
// A surface step, never a bordered box. Info, success and warning differ by icon and words; error is the one coloured
// alert (Rouge on icon and title). On glass (inside a dialog or sheet) use `glass`.
import { type HTMLAttributes, type ReactNode } from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../icons";

export type AlertVariant = "default" | "info" | "success" | "warning" | "error";

const ICONS: Record<AlertVariant, IconName | null> = {
  default: null,
  info: "info",
  success: "circle-check",
  warning: "triangle-alert",
  error: "circle-alert",
};

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  /** "error" is shadcn's destructive. */
  variant?: AlertVariant;
  /** The icon on the title's line; each variant has its own, false for none. */
  icon?: IconName | false;
  /** On Smoke glass (.ui-alert--glass). */
  glass?: boolean;
  /** On a surface that is not a card (inside a card it steps by itself): .ui-alert--on-surface. */
  onSurface?: boolean;
  /** Shows the dismiss button in the top corner. */
  onDismiss?: () => void;
  /** The dismiss button's label; "Dismiss". */
  dismissLabel?: string;
  children?: ReactNode;
}

export function Alert({
  variant = "default",
  icon,
  glass,
  onSurface,
  onDismiss,
  dismissLabel = "Dismiss",
  role,
  className,
  children,
  ...props
}: AlertProps) {
  const name = icon === false ? null : (icon ?? ICONS[variant]);
  return (
    <div
      data-slot="alert"
      role={role ?? (variant === "error" ? "alert" : "status")}
      className={cx(
        "ui-alert",
        variant !== "default" && `ui-alert--${variant}`,
        glass && "ui-alert--glass",
        onSurface && "ui-alert--on-surface",
        className,
      )}
      {...props}
    >
      {name && <Icon name={name} className="ui-alert-icon" />}
      {children}
      {onDismiss && (
        <button
          className="ui-btn ui-btn--quiet ui-btn--icon ui-btn--sm ui-alert-close"
          type="button"
          aria-label={dismissLabel}
          onClick={onDismiss}
        >
          <Icon name="x" />
        </button>
      )}
    </div>
  );
}

export function AlertTitle({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="alert-title" className={cx("ui-alert-title", className)} {...props} />;
}

export function AlertDescription({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="alert-description" className={cx("ui-alert-description", className)} {...props} />;
}

/** Buttons under the words (small secondary or quiet buttons; on glass, glass-clear). */
export function AlertAction({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="alert-action" className={cx("ui-alert-action", className)} {...props} />;
}
