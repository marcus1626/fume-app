// Table and data table: design-system/components/table.css (shadcn's table parts and its data-table pattern),
// behaviour from table.js as hooks: useTableSort (click a header: ascending, then descending; aria-sort and the arrow
// follow) and useTableSelection (rows, select all with the dash while some are selected, Shift-click a range).
// No row or column lines; rows are parted by space and step toward Ink on hover and selection. Under 600 px each row
// stacks into a list row (select, thumbnail, cells as lines, the trail cell top right, actions bottom right).
import {
  forwardRef,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ImgHTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from "react";
import { cx } from "../cx";
import { Icon } from "../icons";

export const TableContainer = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function TableContainer({ className, ...props }, ref) {
  return <div ref={ref} data-slot="table-container" className={cx("ui-table-container", className)} {...props} />;
});

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table data-slot="table" className={cx("ui-table", className)} {...props} />;
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead data-slot="table-header" className={cx("ui-table-header", className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody data-slot="table-body" className={cx("ui-table-body", className)} {...props} />;
}

export function TableFooter({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tfoot data-slot="table-footer" className={cx("ui-table-footer", className)} {...props} />;
}

export function TableCaption({ className, ...props }: HTMLAttributes<HTMLTableCaptionElement>) {
  return <caption data-slot="table-caption" className={cx("ui-table-caption", className)} {...props} />;
}

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  /** A selected row (data-state="selected", aria-selected). Leave undefined in the header. */
  selected?: boolean;
}
export function TableRow({ selected, className, ...props }: TableRowProps) {
  return (
    <tr
      data-slot="table-row"
      data-state={selected ? "selected" : undefined}
      aria-selected={selected === undefined ? undefined : selected}
      className={cx("ui-table-row", className)}
      {...props}
    />
  );
}

export type SortDirection = "ascending" | "descending" | "none";

interface CellFlags {
  /** Numbers right-aligned (head: --num). */
  num?: boolean;
  /** The checkbox column. */
  select?: boolean;
  /** The row actions column. */
  actions?: boolean;
  /** Hidden when the table stacks on a phone. */
  hideStacked?: boolean;
}

export interface TableHeadProps extends ThHTMLAttributes<HTMLTableCellElement>, CellFlags {
  /** Sortable: the current direction of this column ("none" when another column sorts). */
  sort?: SortDirection;
  /** Makes the header a sort button. */
  onSort?: () => void;
}
export function TableHead({ sort, onSort, num, select, actions, hideStacked, className, children, scope = "col", ...props }: TableHeadProps) {
  const sortable = onSort !== undefined;
  const icon = sort === "ascending" ? "arrow-up" : sort === "descending" ? "arrow-down" : "arrow-up-down";
  return (
    <th
      data-slot="table-head"
      scope={scope}
      aria-sort={sortable ? sort ?? "none" : undefined}
      data-sort={sortable ? "" : undefined}
      className={cx(
        "ui-table-head",
        num && "ui-table-head--num",
        select && "ui-table-cell--select",
        actions && "ui-table-cell--actions",
        hideStacked && "ui-table-cell--hide-stacked",
        className,
      )}
      {...props}
    >
      {sortable ? (
        <button className="ui-table-sort" type="button" onClick={onSort}>
          {children}
          <Icon name={icon} />
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement>, CellFlags {
  /** Data (sizes, times, codes): the data face, secondary (.ui-table-cell--data). */
  data?: boolean;
  /** The creative's thumbnail column. */
  media?: boolean;
  /** Top right when the row stacks (the time). */
  trail?: boolean;
  /** Tertiary words (a dash for "nobody yet"). */
  muted?: boolean;
}
export function TableCell({ data, num, select, actions, media, trail, hideStacked, muted, className, ...props }: TableCellProps) {
  return (
    <td
      data-slot="table-cell"
      className={cx(
        "ui-table-cell",
        data && "ui-table-cell--data",
        num && "ui-table-cell--num",
        select && "ui-table-cell--select",
        actions && "ui-table-cell--actions",
        media && "ui-table-cell--media",
        trail && "ui-table-cell--trail",
        hideStacked && "ui-table-cell--hide-stacked",
        muted && "ui-table-muted",
        className,
      )}
      {...props}
    />
  );
}

/** The creative's 4:5 thumbnail with its hairline, in a media cell. */
export function TableCreativeThumb({ className, alt = "", ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  return <img className={cx("ui-table-creative-thumb", className)} alt={alt} {...props} />;
}

export interface TableTitleProps extends HTMLAttributes<HTMLSpanElement> {
  /** A second line in tertiary ("Night Body Oil"). */
  sub?: ReactNode;
}
export function TableTitle({ sub, className, children, ...props }: TableTitleProps) {
  return (
    <span className={cx("ui-table-title", className)} {...props}>
      {children}
      {sub !== undefined && <small>{sub}</small>}
    </span>
  );
}

export type TableStatusKind = "approved" | "waiting" | "draft";

export interface TableStatusProps extends HTMLAttributes<HTMLSpanElement> {
  /** approved: checked by the expert (the Amber triangle); waiting: in check (grey); draft: generated, not sent. */
  status: TableStatusKind;
}
const STATUS_WORDS: Record<TableStatusKind, string> = { approved: "Checked", waiting: "In check", draft: "Generated" };
/** The check state beside its word; defaults "Checked", "In check", "Generated". */
export function TableStatus({ status, className, children, ...props }: TableStatusProps) {
  return (
    <span className={cx("ui-table-status", className)} data-status={status} {...props}>
      <Icon name={status === "draft" ? "fume-engine" : "fume-check"} />
      {children ?? STATUS_WORDS[status]}
    </span>
  );
}

export interface TableCheckboxProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean | "indeterminate";
  /** The event carries shiftKey for range selection. */
  onCheckedChange?: (checked: boolean, event: ReactMouseEvent<HTMLButtonElement>) => void;
  /** Required: "Select Feed 04", "Select all creatives". */
  "aria-label": string;
}
/** The Fume checkbox (checkbox.css markup) for the select column. */
export const TableCheckbox = forwardRef<HTMLButtonElement, TableCheckboxProps>(function TableCheckbox(
  { checked, onCheckedChange, className, onClick, ...props },
  ref,
) {
  const state = checked === "indeterminate" ? "indeterminate" : checked ? "checked" : "unchecked";
  return (
    <button
      ref={ref}
      type="button"
      role="checkbox"
      aria-checked={checked === "indeterminate" ? "mixed" : checked}
      data-state={state}
      className={cx("ui-checkbox", className)}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) onCheckedChange?.(checked === "indeterminate" ? true : !checked, e);
      }}
      {...props}
    >
      <span className="ui-checkbox-indicator">
        <Icon name="check" className="ui-checkbox-check" />
        <Icon name="minus" className="ui-checkbox-minus" />
      </span>
    </button>
  );
});

/* ---------- hooks ---------- */

export interface TableSort<K extends string> {
  key: K | null;
  direction: "ascending" | "descending";
  /** For TableHead's sort prop. */
  directionOf: (key: K) => SortDirection;
  /** For TableHead's onSort: ascending first, then descending. */
  sortBy: (key: K) => void;
  /** Sorts rows by a column's value: numbers as numbers, the rest in natural order. */
  sorted: <R>(rows: R[], value: (row: R, key: K) => string | number | null | undefined) => R[];
}

/** Sorting as table.js does it. */
export function useTableSort<K extends string>(initial?: { key: K; direction?: "ascending" | "descending" }): TableSort<K> {
  const [key, setKey] = useState<K | null>(initial?.key ?? null);
  const [direction, setDirection] = useState<"ascending" | "descending">(initial?.direction ?? "ascending");
  const sortBy = useCallback(
    (k: K) => {
      if (k === key) setDirection((d) => (d === "ascending" ? "descending" : "ascending"));
      else {
        setKey(k);
        setDirection("ascending");
      }
    },
    [key],
  );
  const directionOf = useCallback((k: K): SortDirection => (k === key ? direction : "none"), [key, direction]);
  const sorted = useCallback(
    <R,>(rows: R[], value: (row: R, key: K) => string | number | null | undefined): R[] => {
      if (!key) return rows;
      const num = (x: string) => (/^-?\d+(\.\d+)?$/.test(x.trim()) ? parseFloat(x) : NaN);
      const out = rows.slice().sort((a, b) => {
        const x = String(value(a, key) ?? ""), y = String(value(b, key) ?? "");
        const nx = num(x), ny = num(y);
        const c = !isNaN(nx) && !isNaN(ny) ? nx - ny : x.localeCompare(y, undefined, { numeric: true, sensitivity: "base" });
        return direction === "ascending" ? c : -c;
      });
      return out;
    },
    [key, direction],
  );
  return { key, direction, directionOf, sortBy, sorted };
}

export interface TableSelection<Id extends string | number> {
  selected: Set<Id>;
  count: number;
  isSelected: (id: Id) => boolean;
  /** For a row's TableCheckbox onCheckedChange: Shift-click selects the range from the last box clicked. */
  toggle: (id: Id, checked: boolean, event?: { shiftKey?: boolean }) => void;
  /** For the header box: checked, unchecked or the dash. */
  allState: boolean | "indeterminate";
  toggleAll: (checked: boolean) => void;
  clear: () => void;
  set: (ids: Id[]) => void;
}

/** Row selection as table.js does it; `ids` are the rows in their shown order. */
export function useTableSelection<Id extends string | number>(ids: Id[], initial: Id[] = []): TableSelection<Id> {
  const [selected, setSelected] = useState<Set<Id>>(() => new Set(initial));
  const anchor = useRef<Id | null>(null);
  const toggle = useCallback(
    (id: Id, checked: boolean, event?: { shiftKey?: boolean }) => {
      setSelected((prev) => {
        const next = new Set(prev);
        const a = anchor.current;
        if (event?.shiftKey && a !== null && a !== id && ids.includes(a)) {
          const [i, j] = [ids.indexOf(a), ids.indexOf(id)].sort((m, n) => m - n);
          ids.slice(i, j + 1).forEach((x) => (checked ? next.add(x) : next.delete(x)));
        } else if (checked) next.add(id);
        else next.delete(id);
        return next;
      });
      anchor.current = id;
    },
    [ids],
  );
  const count = ids.filter((id) => selected.has(id)).length;
  const allState: boolean | "indeterminate" = count === 0 ? false : count === ids.length ? true : "indeterminate";
  const toggleAll = useCallback((checked: boolean) => setSelected(checked ? new Set(ids) : new Set()), [ids]);
  const clear = useCallback(() => setSelected(new Set()), []);
  const set = useCallback((list: Id[]) => setSelected(new Set(list)), []);
  return useMemo(
    () => ({ selected, count, isSelected: (id: Id) => selected.has(id), toggle, allState, toggleAll, clear, set }),
    [selected, count, toggle, allState, toggleAll, clear, set],
  );
}
