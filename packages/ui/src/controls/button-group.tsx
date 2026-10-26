// Button group and split button (design-system/components/button-group.css), shadcn's ButtonGroup,
// ButtonGroupText and ButtonGroupSeparator. The group is the pill: its children are ordinary Buttons, cut
// straight at the joins with 2 px of ground between them. Give the group an aria-label.
// Split button: <ButtonGroup aria-label="Generate"><Button>Generate 12 creatives</Button>
//   <Button iconOnly icon="chevron-down" aria-label="More ways to generate" aria-haspopup="menu" aria-expanded={open} /></ButtonGroup>
import { forwardRef, type HTMLAttributes } from "react";
import { cx } from "../cx";

export interface ButtonGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** Default "horizontal". */
  orientation?: "horizontal" | "vertical";
  /** Small text segments (use with size="sm" buttons): .ui-btn-group--sm. */
  size?: "sm" | "md";
}

export const ButtonGroup = forwardRef<HTMLDivElement, ButtonGroupProps>(function ButtonGroup(
  { orientation = "horizontal", size = "md", className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      role="group"
      data-orientation={orientation}
      className={cx("ui-btn-group", size === "sm" && "ui-btn-group--sm", className)}
      {...props}
    />
  );
});

export interface ButtonGroupTextProps extends HTMLAttributes<HTMLSpanElement> {
  /** A number or value: the data face with tabular figures (.ui-btn-group-text--num). */
  numeric?: boolean;
}

/** A sunken segment inside the group: a value or a label. */
export const ButtonGroupText = forwardRef<HTMLSpanElement, ButtonGroupTextProps>(function ButtonGroupText(
  { numeric = false, className, ...props },
  ref,
) {
  return (
    <span ref={ref} className={cx("ui-btn-group-text", numeric && "ui-btn-group-text--num", className)} {...props} />
  );
});

/** More space between buttons of a group (8), never a line. */
export const ButtonGroupSeparator = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(
  function ButtonGroupSeparator({ className, ...props }, ref) {
    return <span ref={ref} aria-hidden="true" className={cx("ui-btn-group-separator", className)} {...props} />;
  },
);
