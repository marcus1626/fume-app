// Card: design-system/components/card.css (shadcn's card parts). A surface step off its ground; no border, no shadow.
// Interactive when it is a link or a button (asChild, or `interactive`); selectable cards take the Ink ring.
import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "../cx";
import { Slot } from "./internal";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** "lg": 24 of air and the larger title (.ui-card--lg). */
  size?: "default" | "lg";
  /** On the layer behind the page (a sidebar ground): the card comes forward to Porcelain (.ui-card--behind). */
  behind?: boolean;
  /** The whole card is one target (.ui-card--interactive) without being a link or button element. */
  interactive?: boolean;
  /** Selectable card: true shows the Ink selection ring (data-state="checked"), false sets data-state="unchecked". */
  selected?: boolean;
  /** Greyed and not pressable (aria-disabled). */
  disabled?: boolean;
  /** Render the one child (an <a>, a router Link or a <button>) as the card. */
  asChild?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { size = "default", behind, interactive, selected, disabled, asChild, className, ...props },
  ref,
) {
  const Comp = (asChild ? Slot : "div") as "div";
  return (
    <Comp
      ref={ref}
      data-slot="card"
      className={cx(
        "ui-card",
        size === "lg" && "ui-card--lg",
        behind && "ui-card--behind",
        interactive && "ui-card--interactive",
        className,
      )}
      data-state={selected === undefined ? undefined : selected ? "checked" : "unchecked"}
      aria-disabled={disabled || undefined}
      {...props}
    />
  );
});

export type CardHeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "div";

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-header" className={cx("ui-card-header", className)} {...props} />;
}

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  /** The heading element; h3 by default. */
  as?: CardHeadingTag;
}
export function CardTitle({ as: Tag = "h3", className, ...props }: CardTitleProps) {
  return <Tag data-slot="card-title" className={cx("ui-card-title", className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p data-slot="card-description" className={cx("ui-card-description", className)} {...props} />;
}

/** Beside the title: an icon button (ui-btn--icon ui-btn--sm) or another short control, never a worded button. */
export function CardAction({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-action" className={cx("ui-card-action", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-content" className={cx("ui-card-content", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-footer" className={cx("ui-card-footer", className)} {...props} />;
}

/** The end of the footer, pushed right. */
export function CardFooterEnd({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("ui-card-footer-end", className)} {...props} />;
}

/** A quiet count line ("12 creatives"), tabular. */
export function CardMeta({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cx("ui-card-meta", className)} {...props} />;
}

/** A time in the data face. */
export function CardTime({ className, ...props }: HTMLAttributes<HTMLTimeElement> & { dateTime?: string }) {
  return <time className={cx("ui-card-time", className)} {...props} />;
}

/** A row of small creatives at the top of a card; put CreativeMedia (or .ui-creative-media elements) inside. */
export function CardMedia({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) {
  return (
    <div className={cx("ui-card-media", className)} {...props}>
      {children}
    </div>
  );
}
