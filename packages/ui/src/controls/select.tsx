// Select (design-system/components/select.css + menu.css), shadcn's select on @radix-ui/react-select: Select,
// SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectLabel, SelectItem, SelectSeparator; and
// NativeSelect (the browser's own list, best on phones). The trigger is a field with chevrons-up-down; the open
// listbox is glass (.ui-glass .ui-menu), rows fill it edge to edge, the chosen row carries the check. Never Amber.
// Radix gives the keyboard (arrows, Home, End, typeahead, Escape), focus return and data-state, data-placeholder,
// data-side, data-highlighted, data-disabled, which the CSS reads.
//   <FieldLabel as="span" id="brand-l">Brand</FieldLabel>
//   <Select value={brand} onValueChange={setBrand}>
//     <SelectTrigger aria-labelledby="brand-l"><SelectValue placeholder="Choose a brand" /></SelectTrigger>
//     <SelectContent><SelectItem value="lysne">LYSNE</SelectItem></SelectContent>
//   </Select>
import * as SelectPrimitive from "@radix-ui/react-select";
import { forwardRef, type ComponentPropsWithoutRef, type CSSProperties, type ReactNode, type SelectHTMLAttributes } from "react";
import { cx } from "../cx";
import { Icon } from "../icons";

export interface SelectProps extends SelectPrimitive.SelectProps {
  /** Classes for the .ui-select wrapper around the trigger. */
  className?: string;
}

/** The root: Radix Select.Root inside the .ui-select wrapper (value, defaultValue, onValueChange, open,
 *  onOpenChange, name, required, disabled, as in Radix). */
export function Select({ className, children, ...props }: SelectProps) {
  return (
    <div className={cx("ui-select", className)}>
      <SelectPrimitive.Root {...props}>{children}</SelectPrimitive.Root>
    </div>
  );
}

export interface SelectTriggerProps extends ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> {
  /** sm 32 or md 40 (default). */
  size?: "sm" | "md";
}

/** The field-like button; put a SelectValue in it. Mark errors with aria-invalid. */
export const SelectTrigger = forwardRef<HTMLButtonElement, SelectTriggerProps>(function SelectTrigger({ size = "md", className, children, ...props }, ref) {
  return (
    <SelectPrimitive.Trigger ref={ref} className={cx("ui-select-trigger", size === "sm" && "ui-select-trigger--sm", className)} {...props}>
      {children}
      <SelectPrimitive.Icon asChild>
        <svg className="ui-select-icon" aria-hidden="true">
          <use href="#fi-chevrons-up-down" />
        </svg>
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});

/** The chosen row's words, or the placeholder in tertiary. */
export const SelectValue = forwardRef<HTMLSpanElement, ComponentPropsWithoutRef<typeof SelectPrimitive.Value>>(function SelectValue({ className, ...props }, ref) {
  return <SelectPrimitive.Value ref={ref} className={cx("ui-select-value", className)} {...props} />;
});

export interface SelectContentProps extends ComponentPropsWithoutRef<typeof SelectPrimitive.Content> {
  /** Portal target; default document.body. */
  container?: Element | DocumentFragment | null;
}

/** The glass listbox. Opens 8 under the trigger, at least as wide, flipping above when there is no room. */
export const SelectContent = forwardRef<HTMLDivElement, SelectContentProps>(function SelectContent(
  { container, position = "popper", sideOffset = 8, align = "start", className, style, children, ...props },
  ref,
) {
  // .ui-select-content was written for select.js, which positions the listbox itself (absolute, under its
  // trigger). Radix positions it through a fixed wrapper, so the listbox sits in flow inside that wrapper,
  // takes the trigger's width as its minimum and its available height as a cap (run-time values from Radix).
  const placed: CSSProperties & Record<string, string> = {
    position: "relative",
    top: "0",
    left: "0",
    minWidth: "var(--radix-select-trigger-width)",
    "--max-h": "min(var(--ui-field-list-max), var(--radix-select-content-available-height))",
  };
  return (
    <SelectPrimitive.Portal container={container}>
      <SelectPrimitive.Content
        ref={ref}
        position={position}
        sideOffset={position === "popper" ? sideOffset : undefined}
        align={position === "popper" ? align : undefined}
        className={cx("ui-glass", "ui-menu", "ui-select-content", className)}
        style={position === "popper" ? { ...placed, ...style } : style}
        {...props}
      >
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});

/** Rows that belong together, with a SelectLabel; groups are parted by space. */
export const SelectGroup = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof SelectPrimitive.Group>>(function SelectGroup({ className, ...props }, ref) {
  return <SelectPrimitive.Group ref={ref} className={cx("ui-select-group", className)} {...props} />;
});

/** A group's quiet title. */
export const SelectLabel = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof SelectPrimitive.Label>>(function SelectLabel({ className, ...props }, ref) {
  return <SelectPrimitive.Label ref={ref} className={cx("ui-menu-label", "ui-select-label", className)} {...props} />;
});

export interface SelectItemProps extends ComponentPropsWithoutRef<typeof SelectPrimitive.Item> {
  /** Data beside the option, in the mono face ("1080 × 1350"). It also shows in the trigger when chosen. */
  meta?: ReactNode;
}

/** One option: its words and the check that shows when it is chosen. */
export const SelectItem = forwardRef<HTMLDivElement, SelectItemProps>(function SelectItem({ meta, className, children, ...props }, ref) {
  return (
    <SelectPrimitive.Item ref={ref} className={cx("ui-menu-item", "ui-select-item", className)} {...props}>
      <SelectPrimitive.ItemText className="ui-select-item-text">
        {children}
        {meta !== undefined ? <small>{meta}</small> : null}
      </SelectPrimitive.ItemText>
      <svg className="ui-menu-check ui-select-item-indicator" aria-hidden="true">
        <use href="#fi-check" />
      </svg>
    </SelectPrimitive.Item>
  );
});

/** Space between groups (.ui-menu-sep), never a line. */
export const SelectSeparator = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>>(function SelectSeparator({ className, ...props }, ref) {
  return <SelectPrimitive.Separator ref={ref} className={cx("ui-menu-sep", className)} {...props} />;
});

export interface NativeSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  /** sm 32 or md 40 (default). */
  size?: "sm" | "md";
  /** Classes for the wrapper. */
  wrapperClassName?: string;
}

/** The browser's own select inside the field look. An <option value=""> chosen reads as the placeholder. */
export const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(function NativeSelect({ size = "md", wrapperClassName, className, ...props }, ref) {
  return (
    <div className={cx("ui-native-select-wrap", wrapperClassName)}>
      <select ref={ref} className={cx("ui-native-select", size === "sm" && "ui-native-select--sm", className)} {...props} />
      <Icon name="chevrons-up-down" className="ui-native-select-icon" />
    </div>
  );
});
