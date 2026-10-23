// Breadcrumb: design-system/components/breadcrumb.css (shadcn's parts: breadcrumb, list, item, link, page, separator,
// ellipsis). Links in secondary, the page in Ink, the chevron between. Narrow (under 400 px) the middle folds into an
// ellipsis button that opens the hidden levels as a glass menu; BreadcrumbPath does that for you.
import { Fragment, forwardRef, useId, type AnchorHTMLAttributes, type HTMLAttributes, type LiHTMLAttributes, type ReactNode } from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../icons";
import { Slot, useGlassMenu } from "./internal";

export function Breadcrumb({ className, "aria-label": label = "Breadcrumb", ...props }: HTMLAttributes<HTMLElement>) {
  return <nav data-slot="breadcrumb" aria-label={label} className={cx("ui-breadcrumb", className)} {...props} />;
}

export function BreadcrumbList({ className, ...props }: HTMLAttributes<HTMLOListElement>) {
  return <ol data-slot="breadcrumb-list" className={cx("ui-breadcrumb-list", className)} {...props} />;
}

export interface BreadcrumbItemProps extends LiHTMLAttributes<HTMLLIElement> {
  /** Hidden when the path folds (data-fold); its level then lives in the ellipsis menu. */
  fold?: boolean;
}
export function BreadcrumbItem({ fold, className, ...props }: BreadcrumbItemProps) {
  return <li data-slot="breadcrumb-item" data-fold={fold ? "" : undefined} className={cx("ui-breadcrumb-item", className)} {...props} />;
}

export interface BreadcrumbLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Render the one child (a router Link) as the link. */
  asChild?: boolean;
}
export const BreadcrumbLink = forwardRef<HTMLAnchorElement, BreadcrumbLinkProps>(function BreadcrumbLink({ asChild, className, ...props }, ref) {
  const Comp = (asChild ? Slot : "a") as "a";
  return <Comp ref={ref} data-slot="breadcrumb-link" className={cx("ui-breadcrumb-link", className)} {...props} />;
});

/** The current page, in Ink; it truncates last. */
export function BreadcrumbPage({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span data-slot="breadcrumb-page" role="link" aria-disabled="true" aria-current="page" className={cx("ui-breadcrumb-page", className)} {...props} />;
}

export interface BreadcrumbSeparatorProps extends LiHTMLAttributes<HTMLLIElement> {
  /** Hidden when the path folds (data-fold). */
  fold?: boolean;
  /** Shown only when the path folds (.ui-breadcrumb-fold): the separator after the ellipsis. */
  folded?: boolean;
}
export function BreadcrumbSeparator({ fold, folded, className, children, ...props }: BreadcrumbSeparatorProps) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      data-fold={fold ? "" : undefined}
      className={cx("ui-breadcrumb-separator", folded && "ui-breadcrumb-fold", className)}
      {...props}
    >
      {children ?? <Icon name="chevron-right" />}
    </li>
  );
}

export interface BreadcrumbEllipsisProps extends Omit<LiHTMLAttributes<HTMLLIElement>, "children"> {
  /** The folded levels: menu rows (BreadcrumbMenuLink). */
  children: ReactNode;
  /** The button's name; "Show the whole path". */
  label?: string;
}
/** The folded middle: a quiet circle that opens a glass menu of the hidden levels. Shown only when the path folds. */
export function BreadcrumbEllipsis({ children, label = "Show the whole path", className, ...props }: BreadcrumbEllipsisProps) {
  const id = `ui-crumbs-${useId().replace(/:/g, "")}`;
  const menu = useGlassMenu(id);
  return (
    <li className={cx("ui-breadcrumb-item ui-breadcrumb-fold", className)} {...props}>
      <button {...menu.triggerProps} className="ui-btn ui-btn--quiet ui-btn--icon ui-btn--sm ui-breadcrumb-ellipsis" aria-label={label}>
        <Icon name="ellipsis" />
      </button>
      <div {...menu.contentProps} className="ui-glass ui-menu ui-breadcrumb-menu" role="menu" aria-label={label}>
        {children}
      </div>
    </li>
  );
}

export interface BreadcrumbMenuLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  icon?: IconName;
  asChild?: boolean;
}
/** A level in the ellipsis menu (a glass menu row that is a link). */
export const BreadcrumbMenuLink = forwardRef<HTMLAnchorElement, BreadcrumbMenuLinkProps>(function BreadcrumbMenuLink(
  { icon, asChild, className, children, ...props },
  ref,
) {
  if (asChild) return <Slot ref={ref} role="menuitem" className={cx("ui-menu-item", className)} {...props}>{children}</Slot>;
  return (
    <a ref={ref} role="menuitem" className={cx("ui-menu-item", className)} {...props}>
      {icon && <Icon name={icon} />}
      {children}
    </a>
  );
});

export interface BreadcrumbPathItem {
  label: string;
  /** Omit on the last item (the current page). */
  href?: string;
  /** The icon of this level's row in the folded menu. */
  icon?: IconName;
}
export interface BreadcrumbPathProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** The path from the top; the last item is the current page. */
  items: BreadcrumbPathItem[];
  /** Renders a link for a router; default <a href>. Spread the props onto your Link. */
  renderLink?: (props: { href: string; className: string; role?: string; children: ReactNode }) => ReactNode;
  /** The ellipsis button's name; "Show the whole path". */
  foldLabel?: string;
}
/**
 * The whole path, folding on a phone: with three or more levels the middle ones (all but the first and the page)
 * fold into the ellipsis menu under 400 px.
 */
export function BreadcrumbPath({ items, renderLink, foldLabel, ...props }: BreadcrumbPathProps) {
  const link = (it: BreadcrumbPathItem, className: string, role?: string, children: ReactNode = it.label) =>
    renderLink ? (
      renderLink({ href: it.href ?? "#", className, role, children })
    ) : (
      <a className={className} href={it.href} role={role}>
        {children}
      </a>
    );
  const n = items.length;
  const middle = n >= 3 ? items.slice(1, n - 1) : [];
  return (
    <Breadcrumb {...props}>
      <BreadcrumbList>
        {items.map((it, i) => {
          const last = i === n - 1;
          const isMiddle = n >= 3 && i > 0 && !last;
          return (
            <Fragment key={i}>
              {i === 1 && middle.length > 0 && (
                <>
                  <BreadcrumbEllipsis label={foldLabel}>
                    {middle.map((m, j) => (
                      <Fragment key={j}>
                        {link(
                          m,
                          "ui-menu-item",
                          "menuitem",
                          <>
                            {m.icon && <Icon name={m.icon} />}
                            {m.label}
                          </>,
                        )}
                      </Fragment>
                    ))}
                  </BreadcrumbEllipsis>
                  <BreadcrumbSeparator folded />
                </>
              )}
              <BreadcrumbItem fold={isMiddle}>{last ? <BreadcrumbPage>{it.label}</BreadcrumbPage> : link(it, "ui-breadcrumb-link")}</BreadcrumbItem>
              {!last && <BreadcrumbSeparator fold={isMiddle} />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
