// Button (design-system/components/button.css), shadcn's API: variant + size, asChild. Always a pill.
// On light ground: primary (Ink), secondary (white + hairline), quiet, danger (Rouge), link.
// On glass (inside .ui-glass): glass-white (the one main action), glass-clear (the rest), glass-danger (delete).
// Loading sets aria-busy and swaps the leading icon for the spinner; the label stays, so the width never jumps.
// Icon-only buttons (iconOnly) need an aria-label.
// Round 9 (DWAY-9; PROPOSED 19 Oct 2026): an icon-only button names itself: it wraps itself in a tooltip with its
// aria-label and, when it has one, its shortcut (`shortcut="⌘B"`, shown "Ctrl+B" off a Mac). Inside a TooltipTrigger
// (WithTooltip) it does not add a second one; `tooltip={false}` leaves it out, a string says something shorter.
import { cloneElement, forwardRef, isValidElement, type ButtonHTMLAttributes, type ReactNode, type Ref } from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../icons";
import { useInTooltipTrigger, WithTooltip } from "../overlays/tooltip";
import { Slot } from "./slot";
import { Spinner } from "./spinner";

export type ButtonVariant =
  "primary" | "secondary" | "quiet" | "danger" | "link" | "glass-white" | "glass-clear" | "glass-danger";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Default "primary". */
  variant?: ButtonVariant;
  /** sm, md (default), lg. */
  size?: ButtonSize;
  /** A square (circle) button with only an icon: give it an aria-label. It shows that label in a tooltip. */
  iconOnly?: boolean;
  /** Icon before the label (or the only content when iconOnly). */
  icon?: IconName;
  /** Icon after the label. */
  iconEnd?: IconName;
  /** Busy: aria-busy="true", the spinner in place of the leading icon, presses ignored. */
  loading?: boolean;
  /** Render the one child (a link, a router Link) with the button's classes and props. */
  asChild?: boolean;
  /** iconOnly: the key that does the same, written the Mac way ("⌘B", "Esc", "→"); the tooltip shows it. */
  shortcut?: string;
  /** iconOnly: the tooltip's words (default: the aria-label), or false for none. */
  tooltip?: string | false;
}

/** The modifier class of a variant and size, for elements that only need the look (a link styled as a button). */
export function buttonClass({
  variant = "primary",
  size = "md",
  iconOnly = false,
}: Pick<ButtonProps, "variant" | "size" | "iconOnly"> = {}): string {
  return cx("ui-btn", `ui-btn--${variant}`, size !== "md" && `ui-btn--${size}`, iconOnly && "ui-btn--icon");
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    iconOnly = false,
    icon,
    iconEnd,
    loading = false,
    asChild = false,
    shortcut,
    tooltip,
    type,
    className,
    children,
    ...props
  },
  ref,
) {
  const inTrigger = useInTooltipTrigger();
  const classes = cx(buttonClass({ variant, size, iconOnly }), className);
  const busy = loading ? { "aria-busy": true as const } : {};
  const lead = loading ? <Spinner decorative /> : icon ? <Icon name={icon} /> : null;
  let el: ReactNode;
  if (asChild) {
    // The icons go inside the child (a router Link), around its own words.
    const child = isValidElement<{ children?: ReactNode }>(children) ? children : null;
    el = (
      <Slot ref={ref as Ref<HTMLElement>} className={classes} {...busy} {...props}>
        {child
          ? cloneElement(
              child,
              undefined,
              <>
                {lead}
                {child.props.children}
                {iconEnd && !(iconOnly && (icon || loading)) ? <Icon name={iconEnd} /> : null}
              </>,
            )
          : children}
      </Slot>
    );
  } else {
    el = (
      <button ref={ref} type={type ?? "button"} className={classes} {...busy} {...props}>
        {lead}
        {children}
        {iconEnd && !(iconOnly && (icon || loading)) ? <Icon name={iconEnd} /> : null}
      </button>
    );
  }
  const label = typeof tooltip === "string" ? tooltip : props["aria-label"];
  if (!iconOnly || tooltip === false || inTrigger || !label || !isValidElement(el)) return el as JSX.Element;
  return (
    <WithTooltip label={label} shortcut={shortcut}>
      {el}
    </WithTooltip>
  );
});
