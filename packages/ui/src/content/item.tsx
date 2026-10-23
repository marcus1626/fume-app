// Item: list rows, design-system/components/item.css (shadcn's item parts). No lines between rows; groups are parted
// by space. A row you can press (a link, a button, or asChild with a router Link) behaves like a quiet button.
import { forwardRef, type HTMLAttributes, type ImgHTMLAttributes, type ReactNode, type Ref } from "react";
import { cx } from "../cx";
import { Slot } from "./internal";

export interface ItemGroupProps extends HTMLAttributes<HTMLElement> {
  /** The element: a div (default), or a ul/ol whose <li> children each hold an Item. */
  as?: "div" | "ul" | "ol";
}
export function ItemGroup({ as: Tag = "div", className, ...props }: ItemGroupProps) {
  return <Tag data-slot="item-group" className={cx("ui-item-group", className)} {...props} />;
}

export interface ItemGroupLabelProps extends HTMLAttributes<HTMLDivElement> {
  /** A count at the end of the label, tabular ("12"). */
  count?: ReactNode;
}
export function ItemGroupLabel({ count, className, children, ...props }: ItemGroupLabelProps) {
  return (
    <div className={cx("ui-item-group-label", className)} {...props}>
      <span>{children}</span>
      {count !== undefined && <span className="ui-item-group-count">{count}</span>}
    </div>
  );
}

/** shadcn's ItemSeparator: space between groups, never a line. */
export function ItemSeparator({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="item-separator" aria-hidden="true" className={cx("ui-item-separator", className)} {...props} />;
}

export interface ItemProps extends HTMLAttributes<HTMLElement> {
  /** "muted" (and shadcn's "outline", drawn as the muted surface) give the row a surface at rest. */
  variant?: "default" | "muted" | "outline";
  size?: "default" | "sm";
  /** The element. Defaults to "a" when href is set, else "div". "button" renders type="button" unless `type` is given. */
  as?: "div" | "li" | "a" | "button";
  href?: string;
  target?: string;
  rel?: string;
  type?: "button" | "submit" | "reset";
  /** Greyed and not pressable (aria-disabled, and disabled on a button). */
  disabled?: boolean;
  /** Render the one child (a router Link) as the row. */
  asChild?: boolean;
}

export const Item = forwardRef<HTMLElement, ItemProps>(function Item(
  { variant = "default", size = "default", as, href, target, rel, type, disabled, asChild, className, ...props },
  ref,
) {
  const common = {
    "data-slot": "item",
    "data-variant": variant === "default" ? undefined : variant,
    "data-size": size === "default" ? undefined : size,
    "aria-disabled": disabled || undefined,
    className: cx("ui-item", className),
  };
  if (asChild) {
    const row = <Slot ref={ref} {...common} {...props} />;
    // In a list (ItemGroup as ul/ol) the link still sits in its own <li>.
    return as === "li" ? <li>{row}</li> : row;
  }
  const tag = as ?? (href ? "a" : "div");
  if (tag === "a")
    return <a ref={ref as Ref<HTMLAnchorElement>} href={disabled ? undefined : href} target={target} rel={rel} {...common} {...props} />;
  if (tag === "button")
    return <button ref={ref as Ref<HTMLButtonElement>} type={type ?? "button"} disabled={disabled} {...common} {...props} />;
  if (tag === "li") return <li ref={ref as Ref<HTMLLIElement>} {...common} {...props} />;
  return <div ref={ref as Ref<HTMLDivElement>} {...common} {...props} />;
});

export interface ItemMediaProps extends HTMLAttributes<HTMLSpanElement> {
  /** icon: a sunken tile with a 24 px icon; image: a square image; creative: the customer's 4:5 creative with its hairline. */
  variant?: "default" | "icon" | "image" | "creative";
}
export function ItemMedia({ variant = "default", className, ...props }: ItemMediaProps) {
  return (
    <span
      data-slot="item-media"
      aria-hidden={variant === "icon" ? true : undefined}
      className={cx("ui-item-media", variant !== "default" && `ui-item-media--${variant}`, className)}
      {...props}
    />
  );
}

/** An <img> for ItemMedia variant image or creative. */
export function ItemMediaImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  return <img alt="" {...props} />;
}

export function ItemContent({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span data-slot="item-content" className={cx("ui-item-content", className)} {...props} />;
}

export function ItemTitle({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span data-slot="item-title" className={cx("ui-item-title", className)} {...props} />;
}

export function ItemDescription({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span data-slot="item-description" className={cx("ui-item-description", className)} {...props} />;
}

/** A time in the data face, for the second ItemContent at the end of a row. */
export function ItemTime({ className, ...props }: HTMLAttributes<HTMLTimeElement> & { dateTime?: string }) {
  return <time className={cx("ui-item-time", className)} {...props} />;
}

/** The end of the row: a badge, a button, a count or a chevron (an Icon). */
export function ItemActions({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span data-slot="item-actions" className={cx("ui-item-actions", className)} {...props} />;
}

export function ItemHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="item-header" className={cx("ui-item-header", className)} {...props} />;
}

export function ItemFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="item-footer" className={cx("ui-item-footer", className)} {...props} />;
}
