// Shared helpers for the overlay family: reading the design system's tokens at run time, controllable
// state, a merged ref, the phone breakpoint, and the reset Radix's floating wrapper needs.
// Nothing here carries a look; the look lives in design-system/components/*.css.
import { useCallback, useEffect, useRef, useState, type CSSProperties, type MutableRefObject, type Ref } from "react";

function cssVar(name: string): string {
  if (typeof window === "undefined" || typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** A length token in px (--ui-overlay-offset is 8, --ui-overlay-margin 16), or the fallback before the CSS loads. */
export function tokenPx(name: string, fallback: number): number {
  const v = parseFloat(cssVar(name));
  return Number.isNaN(v) ? fallback : v;
}

/** A plain number token (--ui-drawer-snap is 0.6). */
export function tokenNumber(name: string, fallback: number): number {
  return tokenPx(name, fallback);
}

/** A duration token in ms (--ui-tooltip-delay is 500ms), as the vanilla scripts read them. */
export function tokenMs(name: string, fallback: number): number {
  const v = cssVar(name);
  if (!v) return fallback;
  const n = parseFloat(v);
  if (Number.isNaN(n)) return fallback;
  return /ms$/.test(v) ? n : /s$/.test(v) ? n * 1000 : n;
}

/** Controlled when `value` is given, otherwise its own state; `onChange` hears every change either way. */
export function useControllableState<T>(
  value: T | undefined,
  defaultValue: T,
  onChange?: (next: T) => void,
): [T, (next: T) => void] {
  const [inner, setInner] = useState<T>(defaultValue);
  const controlled = value !== undefined;
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  const set = useCallback(
    (next: T) => {
      if (!controlled) setInner(next);
      onChangeRef.current?.(next);
    },
    [controlled],
  );
  return [controlled ? (value as T) : inner, set];
}

/** One ref callback that feeds several refs (a forwarded ref and our own). */
export function mergeRefs<T>(...refs: Array<Ref<T> | undefined>): (node: T | null) => void {
  return (node) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as MutableRefObject<T | null>).current = node;
    }
  };
}

/** The design system's phone breakpoint (dialog footers stack, the sheet becomes a drawer): max-width 600px. */
export const NARROW_QUERY = "(max-width: 600px)";

/** True on a phone-width screen; screens use it to pick Drawer over Sheet (shadcn's responsive pattern). */
export function useNarrowScreen(query: string = NARROW_QUERY): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return narrow;
}

/**
 * Radix places floating content inside its own fixed wrapper and measures that wrapper. The design system's
 * .ui-popover and .ui-tooltip are written for popover.js, which places the element itself (position: fixed,
 * top 0, left 0), so inside the wrapper they would take no room and Radix would measure nothing. This puts the
 * element back in the wrapper's flow and grows it from the trigger (Radix's transform-origin variable).
 * Behaviour only: no colour, size, radius or shadow. See the report: the design system could own this reset.
 */
export function floatingStyle(originVar: string, style?: CSSProperties): CSSProperties {
  return { position: "relative", top: "auto", left: "auto", transformOrigin: `var(${originVar})`, ...style };
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Focus the first control in a layer, skipping its chrome (close, handle), as dialog.js does. */
export function focusFirst(layer: HTMLElement | null, skip: string): boolean {
  if (!layer) return false;
  const target =
    layer.querySelector<HTMLElement>("[data-ui-autofocus]") ||
    Array.from(layer.querySelectorAll<HTMLElement>(FOCUSABLE)).find(
      (n) => !n.matches(skip) && n.getClientRects().length > 0,
    ) ||
    null;
  if (!target) return false;
  target.focus({ preventScroll: true });
  return true;
}

// ─── Focus goes back where it came from (round 9, DWAY-8; PROPOSED 19 Oct 2026) ────────────────────────────────────
// Radix gives focus back to a layer's Trigger. A layer opened from code (a menu row, a shortcut, a button that sets
// state, the palette's Search) has none, so focus fell to the page body and the keyboard started over at the top.
// Each layer notes what had focus when it opened (in onOpenAutoFocus, before focus moves in) and gives it back when
// it closes. When that element is gone (a menu row that opened a dialog), the element focused just before it (the
// menu's own button) takes it.
const recent: HTMLElement[] = [];
if (typeof document !== "undefined" && !(document as { __fumeFocusTrail?: boolean }).__fumeFocusTrail) {
  (document as { __fumeFocusTrail?: boolean }).__fumeFocusTrail = true;
  document.addEventListener(
    "focusin",
    (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const i = recent.indexOf(t);
      if (i >= 0) recent.splice(i, 1);
      recent.push(t);
      if (recent.length > 24) recent.shift();
    },
    true,
  );
}

/** The page (its path) each opener was on when its layer opened. */
const openedOn = new WeakMap<HTMLElement, string>();
/** The page's path (not its search or hash: an overlay's ?c= or a tab's ?show= is the same page). */
export const pagePath = () => (typeof location === "undefined" ? "" : location.pathname);

/** What has focus right now, unless it is the page itself: the opener of a layer about to open. A row of a menu
 *  ("Book a meeting") stands for the menu's own button, which is where focus belongs once both have closed. */
export function currentOpener(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const a = document.activeElement;
  let el = a instanceof HTMLElement && a !== document.body && a !== document.documentElement ? a : null;
  const by = el?.closest<HTMLElement>("[role='menu']")?.getAttribute("aria-labelledby");
  const trigger = by ? document.getElementById(by) : null;
  if (trigger) el = trigger;
  if (el) openedOn.set(el, pagePath());
  return el;
}

/**
 * Gives focus back to a layer's opener as it closes (call it in onCloseAutoFocus, and preventDefault when it returns
 * true). Skips anything inside the closing layer or gone from the page. When the layer's choice took you to another
 * page, it gives nothing back and returns true: the new page's title takes focus (the app's Root does that).
 */
export function returnFocusTo(opener: HTMLElement | null, layer?: HTMLElement | null): boolean {
  if (typeof document === "undefined") return false;
  if (opener && openedOn.has(opener) && openedOn.get(opener) !== pagePath()) return true;
  const ok = (el: HTMLElement | null | undefined): el is HTMLElement =>
    Boolean(
      el &&
      el.isConnected &&
      !(layer && layer.contains(el)) &&
      !el.closest("[inert], [hidden]") &&
      el.getClientRects().length > 0,
    );
  let target: HTMLElement | null = ok(opener) ? opener : null;
  if (!target && opener) {
    // the opener is gone (a menu row): the element focused just before it
    const at = recent.lastIndexOf(opener);
    for (let i = at - 1; at > 0 && i >= Math.max(0, at - 3) && !target; i--) if (ok(recent[i])) target = recent[i]!;
  }
  if (!target) return false;
  target.focus({ preventScroll: true });
  return document.activeElement === target;
}

/**
 * For a menu or popover that hands focus back to its trigger as it closes: true when a row took you to another page
 * since `openedOn` (pagePath() when it opened), so the caller preventDefaults and the new page's title takes focus.
 */
export const leftPage = (openedOnPath: string) => openedOnPath !== pagePath();
