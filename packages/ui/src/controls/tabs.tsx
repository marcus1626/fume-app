// Tabs (design-system/components/tabs.css on segmented.css; behaviour from tabs.js and segmented.js), shadcn's
// Tabs, TabsList, TabsTrigger, TabsContent with Radix's attributes (data-orientation, data-state="active|inactive",
// aria-selected, aria-controls), written here: no Radix tabs dependency. Fume's tabs are the segmented control:
// a sunken track and one white pill that slides to the chosen tab. No underline variant.
// Horizontal (default): the list is a .ui-seg in a .ui-tabs-scroll (scrolls sideways on a phone).
// Vertical (settings pages): an upright track beside the panel; triggers take an icon and a hint.
// The arrow keys, Home and End choose (wrapping, skipping disabled tabs); Tab reaches the chosen tab, then the panel.
//   <Tabs value={tab} onValueChange={setTab}>
//     <TabsList aria-label="Campaign"><TabsTrigger value="creatives" count={12}>Creatives</TabsTrigger>…</TabsList>
//     <TabsContent value="creatives">…</TabsContent>
//   </Tabs>
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../icons";
import { composeRefs } from "./slot";
import { nextByKey, useSlidingIndicator } from "./sliding-indicator";

type Orientation = "horizontal" | "vertical";

interface TabsContextValue {
  value: string | undefined;
  select: (value: string) => void;
  orientation: Orientation;
  triggerId: (value: string) => string;
  contentId: (value: string) => string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs(part: string): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error(`${part} must be inside Tabs`);
  return ctx;
}

export interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange" | "dir"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Default "horizontal". */
  orientation?: Orientation;
}

export const Tabs = forwardRef<HTMLDivElement, TabsProps>(function Tabs(
  { value, defaultValue, onValueChange, orientation = "horizontal", className, ...props },
  ref,
) {
  const [own, setOwn] = useState(defaultValue);
  const current = value !== undefined ? value : own;
  const select = useCallback(
    (v: string) => {
      if (v === current) return;
      if (value === undefined) setOwn(v);
      onValueChange?.(v);
    },
    [current, value, onValueChange],
  );
  const base = useId();
  const ctx = useMemo<TabsContextValue>(() => {
    const safe = (v: string) => v.replace(/[^A-Za-z0-9_-]/g, "-");
    return {
      value: current,
      select,
      orientation,
      triggerId: (v) => `${base}-trigger-${safe(v)}`,
      contentId: (v) => `${base}-content-${safe(v)}`,
    };
  }, [current, select, orientation, base]);
  return (
    <TabsContext.Provider value={ctx}>
      <div ref={ref} data-orientation={orientation} className={cx("ui-tabs", className)} {...props} />
    </TabsContext.Provider>
  );
});

export interface TabsListProps extends HTMLAttributes<HTMLDivElement> {
  /** Horizontal only: wrap the list in .ui-tabs-scroll so a long list scrolls sideways. Default true. */
  scroll?: boolean;
}

/** The track. Label it (aria-label or aria-labelledby). */
export const TabsList = forwardRef<HTMLDivElement, TabsListProps>(function TabsList({ scroll = true, className, onKeyDown, children, ...props }, ref) {
  const tabs = useTabs("TabsList");
  const vertical = tabs.orientation === "vertical";
  const listRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const { ready, placing } = useSlidingIndicator(listRef, indicatorRef, tabs.value, vertical ? "y" : "x");
  const setRef = useMemo(() => composeRefs(ref, listRef), [ref]);

  const list = (
    <div
      ref={setRef}
      role="tablist"
      aria-orientation={vertical ? "vertical" : undefined}
      data-orientation={tabs.orientation}
      className={cx(
        vertical ? "ui-tabs-list ui-tabs-list--vertical" : "ui-seg ui-tabs-list",
        ready && "is-ready",
        placing && "is-placing",
        className,
      )}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(e);
        if (e.defaultPrevented) return;
        const next = nextByKey(e.currentTarget, e.key, '[role="tab"]');
        if (!next) return;
        e.preventDefault();
        next.focus();
        const v = next.getAttribute("data-value");
        if (v !== null) tabs.select(v);
      }}
      {...props}
    >
      <span ref={indicatorRef} className={vertical ? "ui-tabs-indicator" : "ui-seg-indicator"} aria-hidden="true" />
      {children}
    </div>
  );
  return !vertical && scroll ? <div className="ui-tabs-scroll">{list}</div> : list;
});

export interface TabsTriggerProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value"> {
  value: string;
  /** Icon before the label (vertical lists). */
  icon?: IconName;
  /** A count after the label (horizontal): "Creatives 12". */
  count?: ReactNode;
  /** A quiet hint at the end of the row (vertical): a member count. */
  hint?: ReactNode;
}

export const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(function TabsTrigger(
  { value, icon, count, hint, disabled, className, onClick, children, ...props },
  ref,
) {
  const tabs = useTabs("TabsTrigger");
  const selected = tabs.value === value;
  const vertical = tabs.orientation === "vertical";
  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      id={tabs.triggerId(value)}
      aria-selected={selected}
      aria-controls={tabs.contentId(value)}
      data-state={selected ? "active" : "inactive"}
      data-disabled={disabled ? "" : undefined}
      data-orientation={tabs.orientation}
      data-value={value}
      disabled={disabled}
      tabIndex={selected || tabs.value === undefined ? 0 : -1}
      className={cx(vertical ? "ui-tabs-trigger" : "ui-seg-option", className)}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) tabs.select(value);
      }}
      {...props}
    >
      {icon ? <Icon name={icon} /> : null}
      {children}
      {count !== undefined ? (
        <>
          {" "}
          <span className="ui-seg-count">{count}</span>
        </>
      ) : null}
      {hint !== undefined ? <span className="ui-tabs-hint">{hint}</span> : null}
    </button>
  );
});

export interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  /** Keep the panel mounted (hidden) while inactive, to keep its state. */
  forceMount?: boolean;
}

/** A panel: shown with a short fade when its tab is chosen; focusable, with the sharp ring. */
export const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(function TabsContent({ value, forceMount = false, className, ...props }, ref) {
  const tabs = useTabs("TabsContent");
  const active = tabs.value === value;
  if (!active && !forceMount) return null;
  return (
    <div
      ref={ref}
      role="tabpanel"
      id={tabs.contentId(value)}
      aria-labelledby={tabs.triggerId(value)}
      data-state={active ? "active" : "inactive"}
      data-orientation={tabs.orientation}
      hidden={!active}
      tabIndex={0}
      className={cx("ui-tabs-content", className)}
      {...props}
    />
  );
});
