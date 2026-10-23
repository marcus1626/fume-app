// Popover (design-system/components/popover.css, behaviour of popover.js), on Radix Popover as shadcn does.
// Markup: div.ui-glass.ui-popover[role=dialog][data-state][data-side][data-align]
//   > div.ui-popover-header (h3.ui-popover-title, p.ui-popover-description), div.ui-popover-row (input.ui-input + button).
// No arrow: it opens --ui-overlay-offset (8) from its trigger, grows from it, flips when there is no room and
// keeps --ui-overlay-margin (16) inside the screen. A small task in place, with one white button (ui-btn--glass-white).
// It is solid over the light app (glass.css). A popover that holds a whole list takes className "ui-popover--list"
// (popover.css: a head, .ui-popover-tabs, a .ui-popover-scroll that scrolls on its own, up to 70 % of the screen); the
// bell's notifications use it. A link inside that goes to another page does not hand focus back to the trigger, so the
// new page's title can take it.
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { forwardRef, useRef, type ComponentPropsWithoutRef, type ElementRef, type HTMLAttributes } from "react";
import { cx } from "../cx";
import { floatingStyle, leftPage, pagePath, tokenPx } from "./shared";

/** Root. Props: open, defaultOpen, onOpenChange(open), modal (default false). */
export const Popover = PopoverPrimitive.Root;
export type PopoverProps = PopoverPrimitive.PopoverProps;
/** The button that toggles it (aria-haspopup="dialog", aria-expanded, data-state); use asChild around a Button. */
export const PopoverTrigger = PopoverPrimitive.Trigger;
/** Places the popover against something other than its trigger. */
export const PopoverAnchor = PopoverPrimitive.Anchor;
/** Closes it and returns focus to the trigger; use asChild. */
export const PopoverClose = PopoverPrimitive.Close;

export interface PopoverContentProps extends ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> {
  container?: HTMLElement | null;
}

/** The glass popover in a portal. side top|right|bottom|left (default bottom), align start|center|end (default center). */
export const PopoverContent = forwardRef<ElementRef<typeof PopoverPrimitive.Content>, PopoverContentProps>(
  (
    {
      className,
      side = "bottom",
      align = "center",
      sideOffset,
      collisionPadding,
      container,
      style,
      onCloseAutoFocus,
      ...props
    },
    ref,
  ) => {
    // a link inside that went to another page leaves focus to that page's title, not to the trigger
    const openedOn = useRef(pagePath());
    return (
      <PopoverPrimitive.Portal container={container}>
        <PopoverPrimitive.Content
          ref={ref}
          side={side}
          align={align}
          sideOffset={sideOffset ?? tokenPx("--ui-overlay-offset", 8)}
          collisionPadding={collisionPadding ?? tokenPx("--ui-overlay-margin", 16)}
          className={cx("ui-glass ui-popover", className)}
          style={floatingStyle("--radix-popover-content-transform-origin", style)}
          onCloseAutoFocus={(event) => {
            onCloseAutoFocus?.(event);
            if (!event.defaultPrevented && leftPage(openedOn.current)) event.preventDefault();
          }}
          {...props}
        />
      </PopoverPrimitive.Portal>
    );
  },
);
PopoverContent.displayName = "PopoverContent";

/** div.ui-popover-header: title and description, 4 apart. */
export const PopoverHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cx("ui-popover-header", className)} {...props} />,
);
PopoverHeader.displayName = "PopoverHeader";

/** h3.ui-popover-title. Give PopoverContent aria-labelledby with its id (Radix does not wire a popover's title). */
export const PopoverTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => <h3 ref={ref} className={cx("ui-popover-title", className)} {...props} />,
);
PopoverTitle.displayName = "PopoverTitle";

/** p.ui-popover-description. */
export const PopoverDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => <p ref={ref} className={cx("ui-popover-description", className)} {...props} />,
);
PopoverDescription.displayName = "PopoverDescription";

/** div.ui-popover-row: a field (input.ui-input) and its button on one line. */
export const PopoverRow = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cx("ui-popover-row", className)} {...props} />
));
PopoverRow.displayName = "PopoverRow";
