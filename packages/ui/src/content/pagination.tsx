// Pagination: design-system/components/pagination.css (shadcn's parts). Page numbers are 40 px circles, the current
// page Ink; Previous and Next are quiet pills. Narrow (under 440 px) it turns compact: two chevron circles around
// "Page 2 of 9". The page list follows the board: every page up to 6, else 1, the neighbours of the current one and
// the last, with an ellipsis mark in the gaps.
import { forwardRef, type AnchorHTMLAttributes, type HTMLAttributes, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { cx } from "../cx";
import { Icon } from "../icons";

export function PaginationRoot({ className, "aria-label": label = "Pages", ...props }: HTMLAttributes<HTMLElement>) {
  return <nav data-slot="pagination" aria-label={label} className={cx("ui-pagination", className)} {...props} />;
}

export function PaginationContent({ className, ...props }: HTMLAttributes<HTMLUListElement>) {
  return <ul data-slot="pagination-content" className={cx("ui-pagination-content", className)} {...props} />;
}

export interface PaginationLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  isActive?: boolean;
  disabled?: boolean;
  /** "previous" / "next" add the chevron pill classes. */
  kind?: "page" | "previous" | "next";
}
/** A page number, Previous or Next (an <a>; give it href or onClick). */
export const PaginationLink = forwardRef<HTMLAnchorElement, PaginationLinkProps>(function PaginationLink(
  { isActive, disabled, kind = "page", className, children, ...props },
  ref,
) {
  return (
    <a
      ref={ref}
      data-slot="pagination-link"
      aria-current={isActive ? "page" : undefined}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      className={cx("ui-pagination-link", kind === "previous" && "ui-pagination-previous", kind === "next" && "ui-pagination-next", className)}
      {...props}
    >
      {children}
    </a>
  );
});

export function PaginationEllipsis({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span aria-hidden="true" className={cx("ui-pagination-ellipsis", className)} {...props}>
      <Icon name="ellipsis" />
    </span>
  );
}

/** The pages in view: numbers and "gap" marks. */
export function paginationRange(page: number, pageCount: number): Array<number | "gap"> {
  if (pageCount <= 6) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const list = Array.from(new Set([1, pageCount, page - 1, page, page + 1].filter((i) => i >= 1 && i <= pageCount))).sort((a, b) => a - b);
  const out: Array<number | "gap"> = [];
  list.forEach((p, k) => {
    if (k && p - list[k - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

export interface PaginationProps extends Omit<HTMLAttributes<HTMLElement>, "onChange"> {
  /** The current page, from 1. */
  page: number;
  pageCount: number;
  onPageChange?: (page: number) => void;
  /** Links for each page (a real URL); without it the links act on onPageChange only. */
  hrefFor?: (page: number) => string;
  /** Words: "Previous", "Next". */
  previousLabel?: string;
  nextLabel?: string;
  /** The compact summary; default `Page <b>2</b> of 9`. */
  summary?: (page: number, pageCount: number) => ReactNode;
}

/** The whole control, from page and pageCount. */
export function Pagination({ page, pageCount, onPageChange, hrefFor, previousLabel = "Previous", nextLabel = "Next", summary, ...props }: PaginationProps) {
  const go = (to: number) => (e: ReactMouseEvent<HTMLAnchorElement>) => {
    if (to < 1 || to > pageCount || to === page) {
      e.preventDefault();
      return;
    }
    if (!hrefFor) e.preventDefault();
    onPageChange?.(to);
  };
  const href = (p: number) => (hrefFor ? hrefFor(p) : "#");
  return (
    <PaginationRoot {...props}>
      <PaginationContent>
        <li>
          <PaginationLink kind="previous" href={href(page - 1)} onClick={go(page - 1)} disabled={page <= 1} aria-label="Go to the previous page">
            <Icon name="chevron-left" />
            <span className="ui-pagination-label">{previousLabel}</span>
          </PaginationLink>
        </li>
        <li className="ui-pagination-summary">
          {summary ? (
            summary(page, pageCount)
          ) : (
            <>
              Page&nbsp;<b>{page}</b>&nbsp;of {pageCount}
            </>
          )}
        </li>
        {paginationRange(page, pageCount).map((p, i) =>
          p === "gap" ? (
            <li key={`gap-${i}`}>
              <PaginationEllipsis />
            </li>
          ) : (
            <li key={p}>
              <PaginationLink href={href(p)} onClick={go(p)} isActive={p === page} aria-label={`Page ${p}`}>
                {p}
              </PaginationLink>
            </li>
          ),
        )}
        <li>
          <PaginationLink kind="next" href={href(page + 1)} onClick={go(page + 1)} disabled={page >= pageCount} aria-label="Go to the next page">
            <span className="ui-pagination-label">{nextLabel}</span>
            <Icon name="chevron-right" />
          </PaginationLink>
        </li>
      </PaginationContent>
    </PaginationRoot>
  );
}
