// Back link: the one way up from a page that sits under another (design-system/components/back-link.css). The app uses
// it instead of a breadcrumb: a rounded square with the arrow and the parent's name small beside it, above the page
// title. It is a real <a href> to the parent, so it opens in a new tab like any link; the app decides on click (onClick
// + preventDefault) whether going back in history is the same as going to the parent, so a list keeps its place, its
// filters and its scroll.
import { forwardRef, type AnchorHTMLAttributes } from "react";
import { cx } from "../cx";
import { Icon } from "../icons";

export interface BackLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** The parent's name ("Products"): shown small beside the arrow, read as "Back to Products". */
  label: string;
  /** The arrow only; the name stays for screen readers. */
  iconOnly?: boolean;
}

/** a.ui-back > span.ui-back-icon (arrow-left) + span.ui-back-label. */
export const BackLink = forwardRef<HTMLAnchorElement, BackLinkProps>(function BackLink(
  { label, iconOnly, className, ...props },
  ref,
) {
  return (
    <a ref={ref} className={cx("ui-back", className)} {...props}>
      <span className="ui-back-icon" aria-hidden="true">
        <Icon name="arrow-left" />
      </span>
      <span className={iconOnly ? "ui-sr-only" : "ui-back-label"}>
        <span className="ui-sr-only">Back to </span>
        {label}
      </span>
    </a>
  );
});
