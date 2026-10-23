// Page header: the top of a page in the app, design-system/components/page-header.css. The back link (back-link.tsx;
// it replaced the breadcrumb, Marcus 15 Oct) 12 above the title
// (GT Standard, 32; 24 on a phone), a meta line in the data face, the actions on the title's line: secondary actions
// are white pills, one Ink main action, More (a quiet circle) holds the rest in a glass menu. Narrow (under 640 px)
// the secondary actions fold into More, and the main action keeps its words (walk-through 19 Oct, MOB-6; PROPOSED
// 19 Oct 2026): it goes under the title and meta line as a full-width labelled pill, since a bare icon in the corner
// said too little (two actions shared one glyph). A button passed in `actions` with a .ui-page-header-label (New
// campaign's +) stays a circle on a phone, the same on every top-level page.
// Round 9 (DLAY-13, desktop review 19 Oct; PROPOSED 19 Oct 2026): the primary action has two homes only. (1) A
// page-level action sits in this header, right, on the title's line (`actions` / `primaryAction`). (2) A step or a
// decision (a form, a queue, an onboarding step) has its actions in PageFooter, pinned to the bottom right of the
// content column while the page scrolls. One Ink per view; the rest secondary or quiet.
import { cloneElement, forwardRef, isValidElement, useId, type ButtonHTMLAttributes, type HTMLAttributes, type ReactElement, type ReactNode } from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../icons";
import { WithTooltip } from "../overlays/tooltip";
import { useGlassMenu } from "./internal";

export interface PageHeaderAction {
  label: string;
  icon?: IconName;
  onSelect?: () => void;
  disabled?: boolean;
}

export interface PageHeaderPrimaryAction extends PageHeaderAction {
  /** Saving or generating: the button is busy (aria-busy). */
  busy?: boolean;
}

export interface PageHeaderProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title: ReactNode;
  /** The heading element; h1 by default. */
  titleAs?: "h1" | "h2";
  /** The way up: a BackLink to the parent page, above the title (it gets .ui-page-header-back). The app uses
   *  this, never a breadcrumb (Marcus 15 Oct). */
  back?: ReactNode;
  /** @deprecated The app shows a back link (`back`), not a path. A Breadcrumb or BreadcrumbPath; it gets .ui-page-header-crumbs. */
  breadcrumb?: ReactNode;
  /** One line under the title (a settings page). */
  description?: ReactNode;
  /** The meta line, each part after a quiet dot: ["12 creatives", "9 approved", <>updated <time>14:32</time></>]. */
  meta?: ReactNode[];
  /** White pills on the title's line that fold into More on a phone. */
  secondaryActions?: PageHeaderAction[];
  /** The page's one Ink action ("Generate more", icon fume-engine). On a phone an Ink circle with its icon. */
  primaryAction?: PageHeaderPrimaryAction;
  /** Rows for the More menu beyond the folded secondary actions: PageHeaderMenuItem, PageHeaderMenuSeparator. */
  menu?: ReactNode;
  /** More's name; default `More for ${title}` when title is a string. */
  moreLabel?: string;
  /** Other controls on the title's line, before the main action. */
  actions?: ReactNode;
  /** Tabs under the header (24 below). */
  tabs?: ReactNode;
}

export const PageHeader = forwardRef<HTMLElement, PageHeaderProps>(function PageHeader(
  { title, titleAs: H = "h1", back, breadcrumb, description, meta, secondaryActions = [], primaryAction, menu, moreLabel, actions, tabs, className, ...props },
  ref,
) {
  const menuId = `ui-pagehead-${useId().replace(/:/g, "")}`;
  const more = useGlassMenu(menuId);
  const hasMore = secondaryActions.length > 0 || menu !== undefined;
  const moreName = moreLabel ?? (typeof title === "string" ? `More for ${title}` : "More");
  const crumbs =
    breadcrumb && isValidElement(breadcrumb)
      ? cloneElement(breadcrumb as ReactElement<{ className?: string }>, {
          className: cx((breadcrumb.props as { className?: string }).className, "ui-page-header-crumbs"),
        })
      : breadcrumb;
  const up =
    back && isValidElement(back)
      ? cloneElement(back as ReactElement<{ className?: string }>, {
          className: cx((back.props as { className?: string }).className, "ui-page-header-back"),
        })
      : back;
  return (
    <header ref={ref} className={cx("ui-page-header", className)} {...props}>
      {up}
      {crumbs}
      <div className="ui-page-header-main">
        <div className="ui-page-header-heading">
          <H className="ui-page-header-title">{title}</H>
          {description !== undefined && <p className="ui-page-header-description">{description}</p>}
          {meta && meta.length > 0 && (
            <p className="ui-page-header-meta">
              {meta.map((m, i) => (
                <span key={i}>{m}</span>
              ))}
            </p>
          )}
        </div>
        {(secondaryActions.length > 0 || primaryAction || hasMore || actions) && (
          <div className="ui-page-header-actions">
            {secondaryActions.map((a, i) => (
              <button key={i} className="ui-btn ui-btn--secondary ui-page-header-fold" type="button" disabled={a.disabled} onClick={a.onSelect}>
                {a.icon && <Icon name={a.icon} />}
                {a.label}
              </button>
            ))}
            {actions}
            {primaryAction && (
              <button
                className="ui-btn ui-btn--primary ui-page-header-primary"
                type="button"
                disabled={primaryAction.disabled}
                aria-busy={primaryAction.busy || undefined}
                onClick={primaryAction.onSelect}
              >
                {primaryAction.icon && <Icon name={primaryAction.icon} />}
                <span className="ui-page-header-label">{primaryAction.label}</span>
              </button>
            )}
            {hasMore && (
              <div className="ui-page-header-more" data-folded-only={menu === undefined || undefined}>
                <WithTooltip label={moreName}>
                  <button {...more.triggerProps} className="ui-btn ui-btn--quiet ui-btn--icon" aria-label={moreName}>
                    <Icon name="ellipsis" />
                  </button>
                </WithTooltip>
                <div {...more.contentProps} className="ui-glass ui-menu ui-page-header-menu" role="menu" aria-label={moreName}>
                  {secondaryActions.map((a, i) => (
                    <button
                      key={i}
                      className="ui-menu-item ui-page-header-folded"
                      type="button"
                      role="menuitem"
                      disabled={a.disabled}
                      onClick={a.onSelect}
                    >
                      {a.icon && <Icon name={a.icon} />}
                      {a.label}
                    </button>
                  ))}
                  {menu}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {tabs !== undefined && <div className="ui-page-header-tabs">{tabs}</div>}
    </header>
  );
});

export interface PageHeaderMenuItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: IconName;
  /** Delete: neutral at rest, Rouge at 80 % when reached (.ui-menu-item--danger). */
  danger?: boolean;
}
/** A row in the More menu (also usable in any glass menu this family renders). */
export const PageHeaderMenuItem = forwardRef<HTMLButtonElement, PageHeaderMenuItemProps>(function PageHeaderMenuItem(
  { icon, danger, className, children, ...props },
  ref,
) {
  return (
    <button ref={ref} type="button" role="menuitem" className={cx("ui-menu-item", danger && "ui-menu-item--danger", className)} {...props}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
});

/** Space between groups of rows in a glass menu (never a line). */
export function PageHeaderMenuSeparator({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div role="separator" className={cx("ui-menu-sep", className)} {...props} />;
}

export interface PageFooterProps extends HTMLAttributes<HTMLDivElement> {
  /** Quiet words or a quiet action at the start of the footer ("3 of 7", "Skip for now"); the actions sit at the end. */
  start?: ReactNode;
}

/**
 * The step footer (DLAY-13): a step's or a decision's actions, pinned to the bottom right of the content column while
 * the page scrolls, on the page's own ground (div.ui-page-footer[data-ui-foot], so toasts rise above it). Put it last
 * in the Page. The main action last, the one Ink; Later / Skip for now quiet before it. On a phone it is the end of the
 * page, the actions full width.
 *   <PageFooter start="3 of 7"><Button variant="quiet">Later</Button><Button>Confirm</Button></PageFooter>
 */
export const PageFooter = forwardRef<HTMLDivElement, PageFooterProps>(function PageFooter({ start, className, children, ...props }, ref) {
  return (
    <div ref={ref} className={cx("ui-page-footer", className)} data-ui-foot="" {...props}>
      {start !== undefined && <div className="ui-page-footer-start">{start}</div>}
      <div className="ui-page-footer-actions">{children}</div>
    </div>
  );
});
