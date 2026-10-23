// Accordion and collapsible: design-system/components/accordion.css, behaviour from accordion.js (Radix's states:
// data-state="open|closed" on item, trigger and content; aria-expanded; data-disabled). Sections are parted by space;
// the content opens by its grid row (0fr to 1fr) and stays mounted, hidden from focus while closed (visibility).
// Keyboard: Enter and Space toggle; ArrowDown/ArrowUp move between triggers; Home and End jump.
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { cx } from "../cx";
import { Icon } from "../icons";
import { mergeRefs, useControllable } from "./internal";

interface AccordionCtx {
  open: string[];
  toggle: (value: string) => void;
}
const AccordionContext = createContext<AccordionCtx | null>(null);

interface ItemCtx {
  value: string;
  open: boolean;
  disabled: boolean;
  triggerId: string;
  contentId: string;
}
const ItemContext = createContext<ItemCtx | null>(null);

export interface AccordionProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue"> {
  /** "single" (default): one section open at a time; "multiple": any number. */
  type?: "single" | "multiple";
  /** The open sections' values (controlled). */
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  /** Single only: the open section can be closed again (default true, as on the board). */
  collapsible?: boolean;
  /** Inside a card or panel: no surfaces, rows on the card (.ui-accordion--flush). */
  flush?: boolean;
}

export const Accordion = forwardRef<HTMLDivElement, AccordionProps>(function Accordion(
  { type = "single", value, defaultValue = [], onValueChange, collapsible = true, flush, className, onKeyDown, ...props },
  ref,
) {
  const [open, setOpen] = useControllable<string[]>(value, defaultValue, onValueChange);
  const rootRef = useRef<HTMLDivElement>(null);
  const toggle = useCallback(
    (v: string) => {
      const isOpen = open.includes(v);
      if (type === "multiple") setOpen(isOpen ? open.filter((x) => x !== v) : [...open, v]);
      else if (isOpen) {
        if (collapsible) setOpen([]);
      } else setOpen([v]);
    },
    [open, setOpen, type, collapsible],
  );
  const ctx = useMemo(() => ({ open, toggle }), [open, toggle]);

  const onKeys = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    const root = rootRef.current;
    const t = (e.target as HTMLElement).closest?.(".ui-accordion-trigger") as HTMLElement | null;
    if (!root || !t) return;
    const list = Array.from(root.querySelectorAll<HTMLButtonElement>(":scope > .ui-accordion-item > .ui-accordion-header > .ui-accordion-trigger")).filter(
      (x) => !x.disabled && !x.hasAttribute("data-disabled"),
    );
    const i = list.indexOf(t as HTMLButtonElement);
    if (i < 0) return;
    const go = ({ ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: list.length - 1 } as Record<string, number>)[e.key];
    if (go === undefined) return;
    e.preventDefault();
    list[(go + list.length) % list.length].focus();
  };

  return (
    <AccordionContext.Provider value={ctx}>
      <div
        ref={mergeRefs(ref, rootRef)}
        data-slot="accordion"
        data-orientation="vertical"
        className={cx("ui-accordion", flush && "ui-accordion--flush", className)}
        onKeyDown={onKeys}
        {...props}
      />
    </AccordionContext.Provider>
  );
});

export interface AccordionItemProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  disabled?: boolean;
}
export function AccordionItem({ value, disabled = false, className, ...props }: AccordionItemProps) {
  const acc = useContext(AccordionContext);
  const id = useId();
  const open = !!acc && acc.open.includes(value);
  const ctx = useMemo(() => ({ value, open, disabled, triggerId: `${id}-trigger`, contentId: `${id}-content` }), [value, open, disabled, id]);
  return (
    <ItemContext.Provider value={ctx}>
      <div
        data-slot="accordion-item"
        data-state={open ? "open" : "closed"}
        data-orientation="vertical"
        data-disabled={disabled ? "" : undefined}
        className={cx("ui-accordion-item", className)}
        {...props}
      />
    </ItemContext.Provider>
  );
}

export interface AccordionTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** A count or status in tertiary before the chevron ("5 rules"). */
  meta?: ReactNode;
  /** The heading that wraps the trigger; h3 by default. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
}
export const AccordionTrigger = forwardRef<HTMLButtonElement, AccordionTriggerProps>(function AccordionTrigger(
  { meta, headingLevel = 3, className, children, onClick, ...props },
  ref,
) {
  const acc = useContext(AccordionContext);
  const item = useContext(ItemContext);
  const H = `h${headingLevel}` as "h3";
  const state = item?.open ? "open" : "closed";
  return (
    <H className="ui-accordion-header">
      <button
        ref={ref}
        type="button"
        id={item?.triggerId}
        aria-controls={item?.contentId}
        aria-expanded={!!item?.open}
        data-state={state}
        data-disabled={item?.disabled ? "" : undefined}
        disabled={item?.disabled}
        className={cx("ui-accordion-trigger", className)}
        onClick={(e) => {
          onClick?.(e);
          if (!e.defaultPrevented && item && acc && !item.disabled) acc.toggle(item.value);
        }}
        {...props}
      >
        <span className="ui-accordion-label">{children}</span>
        {meta !== undefined && <span className="ui-accordion-meta">{meta}</span>}
        <Icon name="chevron-down" className="ui-accordion-chevron" />
      </button>
    </H>
  );
});

export function AccordionContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const item = useContext(ItemContext);
  return (
    <div
      data-slot="accordion-content"
      id={item?.contentId}
      role="region"
      aria-labelledby={item?.triggerId}
      data-state={item?.open ? "open" : "closed"}
      className={cx("ui-accordion-content", className)}
      {...props}
    >
      <div>
        <div className="ui-accordion-body">{children}</div>
      </div>
    </div>
  );
}

/* ---------- collapsible ---------- */

interface CollapsibleCtx {
  open: boolean;
  setOpen: (open: boolean) => void;
  contentId: string;
}
const CollapsibleContext = createContext<CollapsibleCtx | null>(null);

export interface CollapsibleProps extends HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}
export function Collapsible({ open: openProp, defaultOpen = false, onOpenChange, className, ...props }: CollapsibleProps) {
  const [open, setOpen] = useControllable<boolean>(openProp, defaultOpen, onOpenChange);
  const id = useId();
  const ctx = useMemo(() => ({ open, setOpen, contentId: `${id}-content` }), [open, setOpen, id]);
  return (
    <CollapsibleContext.Provider value={ctx}>
      <div data-slot="collapsible" data-state={open ? "open" : "closed"} className={cx("ui-collapsible", className)} {...props} />
    </CollapsibleContext.Provider>
  );
}

export interface CollapsibleTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Show the turning chevron after the words (default true). */
  chevron?: boolean;
}
/** A quiet small button by default (ui-btn ui-btn--quiet ui-btn--sm, as on the board); pass className to change. */
export const CollapsibleTrigger = forwardRef<HTMLButtonElement, CollapsibleTriggerProps>(function CollapsibleTrigger(
  { chevron = true, className, children, onClick, ...props },
  ref,
) {
  const c = useContext(CollapsibleContext);
  return (
    <button
      ref={ref}
      type="button"
      aria-expanded={!!c?.open}
      aria-controls={c?.contentId}
      data-state={c?.open ? "open" : "closed"}
      className={cx(className ?? "ui-btn ui-btn--quiet ui-btn--sm", "ui-collapsible-trigger")}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented && c) c.setOpen(!c.open);
      }}
      {...props}
    >
      {children}
      {chevron && <Icon name="chevron-down" className="ui-accordion-chevron" />}
    </button>
  );
});

export function CollapsibleContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const c = useContext(CollapsibleContext);
  return (
    <div data-slot="collapsible-content" id={c?.contentId} data-state={c?.open ? "open" : "closed"} className={cx("ui-collapsible-content", className)} {...props}>
      <div>{children}</div>
    </div>
  );
}
