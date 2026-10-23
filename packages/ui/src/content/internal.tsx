// Shared helpers for the content family (not exported from the package): a minimal Slot for asChild, ref merging,
// controlled state, custom properties for inline style, and the glass menu disclosure that nav.js runs for the page
// header's More, the breadcrumb's ellipsis, the filter chips and the action bar's More.
import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
  type ReactElement,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import { cx } from "../cx";

type AnyProps = Record<string, unknown>;

/** Sets every ref it is given. */
export function mergeRefs<T>(...refs: Array<Ref<T> | undefined | null>): (node: T | null) => void {
  return (node) => {
    for (const r of refs) {
      if (typeof r === "function") r(node);
      else if (r && typeof r === "object") (r as MutableRefObject<T | null>).current = node;
    }
  };
}

/** Custom properties for an inline style (the only inline style the conventions allow). */
export function cssVars(vars: Record<string, string | number | undefined>): CSSProperties {
  const out: Record<string, string | number> = {};
  for (const k in vars) if (vars[k] !== undefined) out[k] = vars[k] as string | number;
  return out as CSSProperties;
}

/** The ref an element was created with (React 18 keeps it on the element). */
export function elementRef(el: ReactElement): Ref<unknown> | undefined {
  return (el as unknown as { ref?: Ref<unknown> }).ref;
}

/** Merges slot props into a child element: classes and styles join, handlers chain, refs merge, the child's other props win. */
export function mergeIntoChild(child: ReactElement, slotProps: AnyProps, ref?: Ref<unknown>, children?: ReactNode): ReactElement {
  const childProps = child.props as AnyProps;
  const out: AnyProps = { ...slotProps, ...childProps };
  for (const k in slotProps) {
    const s = slotProps[k];
    const c = childProps[k];
    if (/^on[A-Z]/.test(k) && typeof s === "function" && typeof c === "function") {
      out[k] = (...args: unknown[]) => {
        (c as (...a: unknown[]) => void)(...args);
        (s as (...a: unknown[]) => void)(...args);
      };
    }
  }
  out.className = cx(slotProps.className as string | undefined, childProps.className as string | undefined) || undefined;
  if (slotProps.style || childProps.style) out.style = { ...(slotProps.style as CSSProperties), ...(childProps.style as CSSProperties) };
  const cref = elementRef(child);
  out.ref = ref ? mergeRefs(ref, cref) : cref;
  return children === undefined ? cloneElement(child, out) : cloneElement(child, out, children);
}

/** shadcn's Slot: renders its one child with these props merged in (asChild). */
export const Slot = forwardRef<HTMLElement, HTMLAttributes<HTMLElement> & AnyProps>(function Slot({ children, ...props }, ref) {
  const child = Children.only(children);
  if (!isValidElement(child)) return null;
  return mergeIntoChild(child, props, ref);
});

/** Adds a class (and aria-hidden) to a ReactNode when it is an element: the logo lockup and mark. */
export function withClass(node: ReactNode, className: string): ReactNode {
  if (!isValidElement(node)) return node;
  const p = node.props as AnyProps;
  return cloneElement(node as ReactElement<AnyProps>, { className: cx(p.className as string | undefined, className), "aria-hidden": true });
}

/** Controlled or uncontrolled state, as Radix does it. */
export function useControllable<T>(value: T | undefined, defaultValue: T, onChange?: (v: T) => void): [T, (v: T) => void] {
  const [inner, setInner] = useState<T>(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? (value as T) : inner;
  const set = useCallback(
    (v: T) => {
      if (!controlled) setInner(v);
      onChange?.(v);
    },
    [controlled, onChange],
  );
  return [current, set];
}

/** Reads a duration token (ms or s) from the document. */
export function motionMs(name: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(v);
  if (!isFinite(n)) return fallback;
  return /ms$/.test(v) ? n : /s$/.test(v) ? n * 1000 : n;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const MENU_ITEMS = "a[href], button:not([disabled]), [role='menuitem'], [role='menuitemcheckbox'], [role='menuitemradio']";

export interface MenuTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ref: RefObject<HTMLButtonElement>;
  "data-state": "open" | "closed";
}
export interface MenuContentProps extends HTMLAttributes<HTMLDivElement> {
  ref: RefObject<HTMLDivElement>;
  "data-state": "open" | "closed";
}

/**
 * The glass menu behaviour of nav.js, in React: click toggles; opened from the keyboard (or ArrowDown on the trigger),
 * focus goes to the first row; ArrowUp/ArrowDown/Home/End move; Escape or a press outside closes and focus returns to
 * the trigger; focus leaving the menu closes it; choosing a link or a menuitem closes it (checkbox rows keep it open).
 */
export function useGlassMenu(id: string): {
  open: boolean;
  setOpen: (open: boolean, focus?: boolean) => void;
  triggerProps: MenuTriggerProps;
  contentProps: MenuContentProps;
} {
  const [open, setOpenState] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const focusFirst = useRef(false);

  const items = (): HTMLElement[] =>
    contentRef.current
      ? Array.from(contentRef.current.querySelectorAll<HTMLElement>(MENU_ITEMS)).filter((x) => !x.hidden && x.offsetParent !== null)
      : [];

  const setOpen = useCallback((next: boolean, focus = false) => {
    setOpenState(next);
    if (next) focusFirst.current = focus;
    else if (focus) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (open && focusFirst.current) {
      focusFirst.current = false;
      const first = items()[0];
      if (first) first.focus({ preventScroll: true });
    }
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (t && (contentRef.current?.contains(t) || triggerRef.current?.contains(t))) return;
      setOpenState(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpenState(false);
        triggerRef.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const triggerProps: MenuTriggerProps = {
    ref: triggerRef,
    type: "button",
    "aria-controls": id,
    "aria-expanded": open,
    "aria-haspopup": "menu",
    "data-state": open ? "open" : "closed",
    onClick: (e: ReactMouseEvent<HTMLButtonElement>) => setOpen(!open, e.detail === 0),
    onKeyDown: (e: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true, true);
      }
    },
  };

  const contentProps: MenuContentProps = {
    ref: contentRef,
    id,
    hidden: !open,
    "data-state": open ? "open" : "closed",
    onKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const list = items();
      if (!list.length) return;
      const i = list.indexOf(document.activeElement as HTMLElement);
      const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
      if (step) {
        e.preventDefault();
        list[(i + step + list.length) % list.length].focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        list[0].focus();
      } else if (e.key === "End") {
        e.preventDefault();
        list[list.length - 1].focus();
      }
    },
    onBlur: (e: ReactFocusEvent<HTMLDivElement>) => {
      const next = e.relatedTarget as Node | null;
      if (next && !contentRef.current?.contains(next) && next !== triggerRef.current) setOpenState(false);
    },
    onClick: (e: ReactMouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest("a[href], [role='menuitem']")) setOpenState(false);
    },
  };

  return { open, setOpen, triggerProps, contentProps };
}

/**
 * Radix Toolbar's roving focus, as toolbar.js does it: the bar is one tab stop; ArrowLeft/Right (Up/Down when vertical),
 * Home and End move between its own controls (not those of a menu hanging off it) and skip disabled ones.
 */
export function useRovingBar(ref: RefObject<HTMLElement>, vertical = false, onEscape?: () => void): {
  onKeyDown: (e: ReactKeyboardEvent<HTMLElement>) => void;
  onFocus: (e: ReactFocusEvent<HTMLElement>) => void;
} {
  const own = useCallback((): HTMLElement[] => {
    const bar = ref.current;
    if (!bar) return [];
    return Array.from(bar.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea")).filter((el) => {
      if (el.closest('[role="menu"]')) return false;
      if ((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true" || el.closest("[hidden]")) return false;
      return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    });
  }, [ref]);
  const settle = useCallback(
    (current?: HTMLElement | null) => {
      const bar = ref.current;
      const list = own();
      if (!bar || !list.length) return;
      const pick =
        current && list.includes(current)
          ? current
          : list.find((el) => el.getAttribute("aria-checked") === "true" || el.getAttribute("aria-pressed") === "true") || list[0];
      bar.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea").forEach((el) => {
        if (!el.closest('[role="menu"]')) el.tabIndex = -1;
      });
      pick.tabIndex = 0;
    },
    [own, ref],
  );
  useEffect(() => settle());
  return {
    onFocus: (e) => {
      const t = e.target as HTMLElement;
      if (!t.closest('[role="menu"]')) settle(t);
    },
    onKeyDown: (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('[role="menu"]')) return;
      if (e.key === "Escape" && onEscape) {
        onEscape();
        return;
      }
      const list = own();
      const i = list.indexOf(t);
      if (i < 0) return;
      const fwd = vertical ? "ArrowDown" : "ArrowRight";
      const back = vertical ? "ArrowUp" : "ArrowLeft";
      let next: HTMLElement | null = null;
      if (e.key === fwd) next = list[(i + 1) % list.length];
      else if (e.key === back) next = list[(i - 1 + list.length) % list.length];
      else if (e.key === "Home") next = list[0];
      else if (e.key === "End") next = list[list.length - 1];
      if (!next) return;
      e.preventDefault();
      e.stopPropagation();
      settle(next);
      next.focus();
    },
  };
}
