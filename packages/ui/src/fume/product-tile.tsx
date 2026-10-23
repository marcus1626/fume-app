// Product pick (design-system/components/product-pick.css): products, collections and campaigns are picked as a grid of
// pictures, never a list of names. One tile for every picker.
//   <PickGrid aria-label="Products">
//     <ProductTile name="Night Body Oil" variant="100 ml" src={img} selected={on} onSelectedChange={set} />
//     <ProductTile name="Hand Balm" variant="50 ml" flag="To confirm" action={<Button size="sm" …>Confirm</Button>} />
//     <PickTile title="AW26" line="Collection · 4 products" images={[…]} icon="layers" selected … />
//   </PickGrid>
//   <PickTrigger label="Product" name="Night Body Oil · 100 ml" src={img} />   (a popover trigger, asChild-friendly)
import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode, type Ref } from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../icons";

export interface PickGridProps extends HTMLAttributes<HTMLUListElement> {
  /** Smaller tiles (a chat card, a narrow panel): about three across on a phone. */
  size?: "md" | "sm";
}

/** A grid of pick tiles (ul). Put PickTile or ProductTile (li) inside. */
export function PickGrid({ size = "md", className, ...props }: PickGridProps) {
  return <ul className={cx("ui-pick-grid", size === "sm" && "ui-pick-grid--sm", className)} {...props} />;
}

export interface PickTileProps extends Omit<HTMLAttributes<HTMLElement>, "title" | "onSelect"> {
  /** li (default, inside PickGrid) or div. */
  as?: "li" | "div";
  /** The name under the picture. */
  title: string;
  /** The second line: a variant ("100 ml"), what a collection holds. */
  line?: ReactNode;
  /** A quiet third line: why it is picked already ("In AW26"), a date. */
  note?: ReactNode;
  /** The picture. */
  src?: string;
  /** Several pictures as one mosaic (a collection): up to four are shown. */
  images?: string[];
  /** The icon when there is no picture (default package). */
  icon?: IconName;
  /** Selection mode: the picture toggles (aria-pressed); picked shows the Ink ring and badge. */
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  /** Picked through something else (a collection): the badge on the quiet surface, not a target of its own. */
  included?: boolean;
  /** Open mode: the picture is a button. Ignored when `selected` is set. */
  onOpen?: () => void;
  /** Not pickable yet: a calm label on the picture ("To confirm"); put the way forward in `action`. */
  flag?: ReactNode;
  /** The flag's icon (default clock; lock for "To confirm"). */
  flagIcon?: IconName;
  /** A small button under the words (a secondary sm Button), e.g. "Confirm". */
  action?: ReactNode;
  /** The picture's accessible name; default "title, line". */
  label?: string;
  disabled?: boolean;
}

export const PickTile = forwardRef<HTMLElement, PickTileProps>(function PickTile(
  {
    as = "li",
    title,
    line,
    note,
    src,
    images,
    icon = "package",
    selected,
    onSelectedChange,
    included,
    onOpen,
    flag,
    flagIcon = "clock",
    action,
    label,
    disabled,
    className,
    ...props
  },
  ref,
) {
  const pics = (images ?? []).filter(Boolean).slice(0, 4);
  const picture = src ? (
    <img src={src} alt="" loading="lazy" />
  ) : pics.length ? (
    <span className="ui-pick-mosaic" data-count={pics.length}>
      {pics.map((p, i) => (
        <img key={`${p}-${i}`} src={p} alt="" loading="lazy" />
      ))}
    </span>
  ) : (
    <span className="ui-pick-empty">
      <Icon name={icon} />
    </span>
  );
  const name = label ?? (typeof line === "string" && line ? `${title}, ${line}` : title);
  const selectable = selected !== undefined && !included && !flag;
  const state = included
    ? "included"
    : selected !== undefined && !flag
      ? selected
        ? "checked"
        : "unchecked"
      : undefined;

  let media: ReactNode;
  if (selectable)
    media = (
      <button
        type="button"
        className="ui-pick-media"
        aria-pressed={Boolean(selected)}
        aria-label={name}
        disabled={disabled}
        onClick={() => onSelectedChange?.(!selected)}
      >
        {picture}
      </button>
    );
  else if (onOpen && !flag)
    media = (
      <button type="button" className="ui-pick-media" aria-label={name} disabled={disabled} onClick={onOpen}>
        {picture}
      </button>
    );
  else media = <div className="ui-pick-media">{picture}</div>;

  const Tag = as as "li";
  return (
    <Tag
      ref={ref as Ref<HTMLLIElement>}
      className={cx("ui-pick", className)}
      data-state={state}
      data-flag={flag ? "" : undefined}
      {...props}
    >
      <div className="ui-pick-frame">
        {media}
        {state && (
          <span className="ui-pick-badge" aria-hidden="true">
            <Icon name="check" />
          </span>
        )}
        {flag && (
          <span className="ui-pick-flag">
            <Icon name={flagIcon} />
            {flag}
          </span>
        )}
      </div>
      <div className="ui-pick-text">
        <span className="ui-pick-title">{title}</span>
        {line && <span className="ui-pick-line">{line}</span>}
        {note && <span className="ui-pick-note">{note}</span>}
        {included && <span className="ui-sr-only">, picked with its collection</span>}
      </div>
      {action && <div className="ui-pick-action">{action}</div>}
    </Tag>
  );
});

export interface ProductTileProps extends Omit<PickTileProps, "title" | "line"> {
  /** The product's name. */
  name: string;
  /** Its variant ("100 ml"). */
  variant?: string;
  /** A line of your own in place of the variant. */
  line?: ReactNode;
}

/** A product as a pick tile: picture (or the package icon), name, variant. */
export const ProductTile = forwardRef<HTMLElement, ProductTileProps>(function ProductTile(
  { name, variant, line, ...props },
  ref,
) {
  return <PickTile ref={ref} title={name} line={line ?? (variant || undefined)} {...props} />;
});

export interface PickTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** What it picks ("Product"). */
  label: string;
  /** What is picked now, in words; a placeholder when nothing is. */
  name: string;
  /** The picked thing's picture. */
  src?: string;
  /** The icon when there is no picture (default package). */
  icon?: IconName;
}

/** The button that opens a grid of tiles (a PopoverTrigger's asChild child). */
export const PickTrigger = forwardRef<HTMLButtonElement, PickTriggerProps>(function PickTrigger(
  { label, name, src, icon = "package", className, ...props },
  ref,
) {
  return (
    <button ref={ref} type="button" className={cx("ui-pick-trigger", className)} {...props}>
      <span className="ui-pick-trigger-media" aria-hidden="true">
        {src ? <img src={src} alt="" /> : <Icon name={icon} />}
      </span>
      <span className="ui-pick-trigger-text">
        <span className="ui-pick-trigger-label">{label}</span>
        <span className="ui-pick-trigger-name">{name}</span>
      </span>
      <Icon name="layout-grid" className="ui-pick-trigger-icon" />
    </button>
  );
});
