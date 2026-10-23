// Filter bar: search, filter chips, sort, the active filters and the result count over a set of creatives,
// design-system/components/filter-bar.css, behaviour from filter-bar.js, here controlled: the page owns the query, the
// chosen values and the sort, and filters its own creatives. One calm row: the search field with "/" as its key, white
// chips that turn Ink and count their values once they filter (each opens a glass menu of checkbox rows), the sort at
// the row's end. Under it: "3 of 8 creatives" in the data face, each active filter as a sunken pill with a remove
// circle, and Clear all. Narrow (under 640 px) the chips and sort leave the row for a Filters button: the page opens
// its Drawer (overlays) and puts FilterSheetOptions in it, with a footer of glass-clear "Clear all" and glass-white filterShowLabel(shown).
import { useEffect, useId, useRef, type ChangeEvent, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../icons";
import { useGlassMenu } from "./internal";

export interface FilterOption {
  value: string;
  label: string;
  icon?: IconName;
  /** Data beside the label in the data face ("4:5"). */
  meta?: string;
}
export interface FilterDef {
  key: string;
  /** The chip's words and the pill's key ("Status"). */
  label: string;
  options: FilterOption[];
  /** The menu opens to the chip's end (.ui-filter-menu--end), for the last chip on a narrow row. */
  alignEnd?: boolean;
}
export interface SortOption {
  /** "attribute:asc|desc", as filter-bar.js has it ("time:desc"). */
  value: string;
  label: string;
}
export type FilterValue = Record<string, string[]>;

export interface FilterBarProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  query: string;
  onQueryChange: (query: string) => void;
  /** "Search creatives"; also the field's name. */
  searchPlaceholder?: string;
  filters?: FilterDef[];
  value: FilterValue;
  onValueChange: (value: FilterValue) => void;
  /** A native select at the row's end; or pass `sortSlot` (a Select from controls). */
  sort?: string;
  sortOptions?: SortOption[];
  onSortChange?: (sort: string) => void;
  sortLabel?: string;
  sortSlot?: ReactNode;
  /** How many creatives are shown and how many there are: "3 of 8 creatives", or "8 creatives" when nothing filters. */
  shown: number;
  total: number;
  /** One and many: ["creative", "creatives"]. */
  noun?: [string, string];
  /** The phone's Filters button; open the filter sheet (a Drawer holding FilterSheetOptions). */
  onOpenSheet?: () => void;
  sheetLabel?: string;
  clearLabel?: string;
  /** "/" focuses the search (default true). */
  slashKey?: boolean;
}

const activeOf = (filters: FilterDef[], value: FilterValue): Array<[FilterDef, FilterOption]> =>
  filters.flatMap((f) => (value[f.key] || []).map((v) => [f, f.options.find((o) => o.value === v) ?? { value: v, label: v }] as [FilterDef, FilterOption]));

const toggled = (value: FilterValue, key: string, v: string): FilterValue => {
  const list = value[key] || [];
  return { ...value, [key]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v] };
};

/** The result words: "3 of 8 creatives" or "8 creatives". */
export function filterCount(shown: number, total: number, filtering: boolean, noun: [string, string] = ["creative", "creatives"]): string {
  const word = total === 1 ? noun[0] : noun[1];
  return filtering ? `${shown} of ${total} ${word}` : `${total} ${word}`;
}

/** The whole bar (div.ui-filter-bar), controlled. */
export function FilterBar({
  query,
  onQueryChange,
  searchPlaceholder = "Search creatives",
  filters = [],
  value,
  onValueChange,
  sort,
  sortOptions,
  onSortChange,
  sortLabel = "Sort",
  sortSlot,
  shown,
  total,
  noun = ["creative", "creatives"],
  onOpenSheet,
  sheetLabel = "Filters",
  clearLabel = "Clear all",
  slashKey = true,
  className,
  ...props
}: FilterBarProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const pillsRef = useRef<HTMLUListElement>(null);
  const focusPill = useRef<number | null>(null);
  const active = activeOf(filters, value);
  const filtering = active.length > 0 || query.trim() !== "";

  // "/" jumps to the search
  useEffect(() => {
    if (!slashKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const s = searchRef.current;
      if (!s) return;
      const r = s.getBoundingClientRect();
      if (r.width > 0 && r.bottom > 0 && r.top < window.innerHeight) {
        e.preventDefault();
        s.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [slashKey]);

  // after a pill goes, focus moves to the next pill's remove circle, or back to the search
  useEffect(() => {
    if (focusPill.current === null) return;
    const i = focusPill.current;
    focusPill.current = null;
    const rest = pillsRef.current ? Array.from(pillsRef.current.querySelectorAll<HTMLButtonElement>(".ui-filter-pill-remove")) : [];
    const next = rest[Math.min(i, rest.length - 1)] ?? searchRef.current;
    next?.focus({ preventScroll: true });
  });

  return (
    <div className={cx("ui-filter-bar", className)} {...props}>
      <div className="ui-filter-bar-controls">
        <div className="ui-input-group ui-filter-bar-search" role="search">
          <div className="ui-input-group-addon" data-align="inline-start">
            <Icon name="search" />
          </div>
          <input
            ref={searchRef}
            className="ui-input-group-input"
            type="search"
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            value={query}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onQueryChange(e.target.value)}
          />
          {slashKey && (
            <div className="ui-input-group-addon" data-align="inline-end">
              <kbd className="ui-kbd">/</kbd>
            </div>
          )}
        </div>
        {filters.length > 0 && (
          <div className="ui-filter-bar-chips" role="group" aria-label={sheetLabel}>
            {filters.map((f) => (
              <FilterChip key={f.key} filter={f} chosen={value[f.key] || []} onToggle={(v) => onValueChange(toggled(value, f.key, v))} />
            ))}
          </div>
        )}
        {(sortSlot !== undefined || (sortOptions && sortOptions.length > 0)) && (
          <div className="ui-filter-bar-sort">
            {sortSlot ?? (
              <div className="ui-native-select-wrap">
                <select className="ui-native-select" aria-label={sortLabel} value={sort} onChange={(e) => onSortChange?.(e.target.value)}>
                  {sortOptions!.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <Icon name="chevrons-up-down" className="ui-native-select-icon" />
              </div>
            )}
          </div>
        )}
        {onOpenSheet && (
          <button className="ui-btn ui-btn--secondary ui-filter-bar-sheet-btn" type="button" aria-haspopup="dialog" onClick={onOpenSheet}>
            <Icon name="sliders-horizontal" />
            <span className="ui-filter-bar-sheet-label">{sheetLabel}</span>
            <span className="ui-filter-chip-count" hidden={active.length === 0}>
              {active.length}
            </span>
          </button>
        )}
      </div>
      <div className="ui-filter-bar-applied">
        <p className="ui-filter-bar-count" aria-live="polite">
          {filterCount(shown, total, filtering, noun)}
        </p>
        <ul ref={pillsRef} className="ui-filter-bar-pills" aria-label="Active filters">
          {active.map(([f, o], i) => (
            <li key={f.key + ":" + o.value} className="ui-filter-pill">
              <span className="ui-filter-pill-key">{f.label}</span>
              <span className="ui-filter-pill-value">{o.label}</span>
              <button
                className="ui-filter-pill-remove"
                type="button"
                aria-label={`Remove ${f.label}: ${o.label}`}
                onClick={() => {
                  focusPill.current = i;
                  onValueChange(toggled(value, f.key, o.value));
                }}
              >
                <Icon name="x" />
              </button>
            </li>
          ))}
        </ul>
        <button
          className="ui-btn ui-btn--quiet ui-btn--sm ui-filter-bar-clear"
          type="button"
          hidden={active.length === 0}
          onClick={() => {
            onValueChange({});
            searchRef.current?.focus({ preventScroll: true });
          }}
        >
          {clearLabel}
        </button>
      </div>
    </div>
  );
}

function FilterChip({ filter, chosen, onToggle }: { filter: FilterDef; chosen: string[]; onToggle: (value: string) => void }) {
  const id = `ui-filter-${useId().replace(/:/g, "")}`;
  const menu = useGlassMenu(id);
  const n = chosen.length;
  return (
    <div className="ui-filter-chip-wrap">
      <button {...menu.triggerProps} className="ui-btn ui-btn--secondary ui-filter-chip" data-active={n > 0 ? "" : undefined}>
        {filter.label}
        <span className="ui-filter-chip-count" hidden={n === 0}>
          {n}
        </span>
        <Icon name="chevron-down" className="ui-filter-chip-chevron" />
      </button>
      <div {...menu.contentProps} className={cx("ui-glass ui-menu ui-filter-menu", filter.alignEnd && "ui-filter-menu--end")} role="menu" aria-label={filter.label}>
        {filter.options.map((o) => (
          <button
            key={o.value}
            className="ui-menu-item ui-filter-option"
            type="button"
            role="menuitemcheckbox"
            aria-checked={chosen.includes(o.value)}
            onClick={() => onToggle(o.value)}
          >
            {o.icon && <Icon name={o.icon} />}
            <span>{o.label}</span>
            {o.meta !== undefined && <span className="ui-filter-option-meta">{o.meta}</span>}
            <Icon name="check" className="ui-menu-check" />
          </button>
        ))}
      </div>
    </div>
  );
}

export interface FilterSheetOptionsProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  filters: FilterDef[];
  value: FilterValue;
  onValueChange: (value: FilterValue) => void;
  sort?: string;
  sortOptions?: SortOption[];
  onSortChange?: (sort: string) => void;
  sortLabel?: string;
}
/**
 * The phone's filter sheet body: each filter (and the sort) as a group of rows edge to edge, the check at the end.
 * Put it in a Drawer (overlays) with className "ui-filter-sheet" on the drawer; it renders its own .ui-drawer-body.
 */
export function FilterSheetOptions({ filters, value, onValueChange, sort, sortOptions, onSortChange, sortLabel = "Sort", className, ...props }: FilterSheetOptionsProps) {
  const row = (key: string, label: string, pressed: boolean, onClick: () => void, icon?: IconName) => (
    <button key={key} className="ui-filter-sheet-option" type="button" aria-pressed={pressed} onClick={onClick}>
      {icon && <Icon name={icon} />}
      <span>{label}</span>
      <Icon name="check" className="ui-filter-sheet-check" />
    </button>
  );
  return (
    <div className={cx("ui-drawer-body", className)} {...props}>
      {filters.map((f) => (
        <div key={f.key} className="ui-filter-sheet-group" role="group" aria-label={f.label}>
          <p className="ui-filter-sheet-label">{f.label}</p>
          <div className="ui-filter-sheet-options">
            {f.options.map((o) => row(o.value, o.label, (value[f.key] || []).includes(o.value), () => onValueChange(toggled(value, f.key, o.value)), o.icon))}
          </div>
        </div>
      ))}
      {sortOptions && sortOptions.length > 0 && (
        <div className="ui-filter-sheet-group" role="group" aria-label={sortLabel}>
          <p className="ui-filter-sheet-label">{sortLabel}</p>
          <div className="ui-filter-sheet-options">{sortOptions.map((o) => row(o.value, o.label, o.value === sort, () => onSortChange?.(o.value), "arrow-up-down"))}</div>
        </div>
      )}
    </div>
  );
}

/** The sheet's footer words for its white button: "Show 3 creatives", or "Nothing to show". */
export function filterShowLabel(shown: number, noun: [string, string] = ["creative", "creatives"]): string {
  return shown ? `Show ${shown} ${shown === 1 ? noun[0] : noun[1]}` : "Nothing to show";
}
