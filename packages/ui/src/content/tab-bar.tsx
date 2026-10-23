// Tab bar: a customer's few places at the foot of a phone screen (design-system/components/tab-bar.css, PROPOSED
// 15 Oct 2026). A Smoke glass pill that floats over the page; each place is an icon over its label, the current one
// on the glass's one white pill. It shows under 640 px only (the CSS hides it on a desk, where the sidebar holds the
// same places in the same order). A count is for the one thing that waits on you (Home), nowhere else.
import {
  Children,
  forwardRef,
  isValidElement,
  type AnchorHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
} from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../icons";
import { mergeIntoChild } from "./internal";

export interface TabBarProps extends HTMLAttributes<HTMLElement> {
  /** The bar's name for a screen reader ("LYSNE in Fume"). */
  "aria-label": string;
}

/** The dock (fixed at the foot, above the safe area) and the glass bar in it. Children are TabBarItems. */
export const TabBar = forwardRef<HTMLElement, TabBarProps>(function TabBar({ className, children, ...props }, ref) {
  return (
    <div className="ui-tab-bar-dock" data-slot="tab-bar-dock">
      <nav ref={ref} className={cx("ui-tab-bar ui-glass ui-glass--bar", className)} {...props}>
        {children}
      </nav>
    </div>
  );
});

export interface TabBarItemProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Render the one child (a router Link) as the item; the child's children become the label. */
  asChild?: boolean;
  icon: IconName;
  /** The current place: aria-current="page" and the white pill. */
  isActive?: boolean;
  /** What waits, as a number; nothing when 0 or undefined. */
  count?: number;
}

/** One place: icon over label, 48 px tall (the hit area is the whole cell). */
export const TabBarItem = forwardRef<HTMLAnchorElement, TabBarItemProps>(function TabBarItem(
  { asChild, icon, isActive, count, className, children, ...props },
  ref,
) {
  const inner = (label: ReactNode) => (
    <>
      <span className="ui-tab-bar-icon">
        <Icon name={icon} />
        {count ? (
          <span className="ui-tab-bar-count" aria-hidden="true">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </span>
      <span className="ui-tab-bar-label">
        {label}
        {count ? <span className="ui-sr-only">, {count} waiting</span> : null}
      </span>
    </>
  );
  const own = {
    ...props,
    "data-slot": "tab-bar-item",
    "aria-current": isActive ? ("page" as const) : undefined,
    className: cx("ui-tab-bar-item", className),
  };
  if (asChild) {
    const child = Children.only(children);
    if (isValidElement(child))
      return mergeIntoChild(child, own, ref, inner((child.props as { children?: ReactNode }).children));
  }
  return (
    <a ref={ref as Ref<HTMLAnchorElement>} {...own}>
      {inner(children)}
    </a>
  );
});
