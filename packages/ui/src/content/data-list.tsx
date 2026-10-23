// Data list: metadata without a table, design-system/components/data-list.css. A <dl>: label tertiary, value Ink;
// data (sizes, times, codes) in the data face (DataListData). No lines, no zebra.
import { type HTMLAttributes, type ReactNode } from "react";
import { cx } from "../cx";

export interface DataListProps extends HTMLAttributes<HTMLDListElement> {
  /** "stacked": label above value (narrow panels); "grid": facts as cells that wrap (stats under a creative). */
  variant?: "default" | "stacked" | "grid";
}
export function DataList({ variant = "default", className, ...props }: DataListProps) {
  return <dl className={cx("ui-datalist", variant !== "default" && `ui-datalist--${variant}`, className)} {...props} />;
}

export interface DataListItemProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  label: ReactNode;
  children?: ReactNode;
}
/** One fact: <div><dt>label</dt><dd>value</dd></div>. */
export function DataListItem({ label, children, ...props }: DataListItemProps) {
  return (
    <div {...props}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** A value that is data (a size, a time, a code): the data face. */
export function DataListData({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cx("ui-datalist-data", className)} {...props} />;
}

/** A quiet note after a value. */
export function DataListNote({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cx("ui-datalist-note", className)} {...props} />;
}
